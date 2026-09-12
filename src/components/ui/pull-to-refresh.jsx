import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PullToRefresh({ onRefresh, children }) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const lastScrollTime = useRef(0);
    const isTracking = useRef(false);

    // The document/window is the real scroll container in this layout — the
    // wrapper div grows with its content (h-full resolves to auto because
    // <main> has no fixed height), so its own scrollTop is always 0 and can't
    // be used to detect "at top". Track window scroll instead.
    useEffect(() => {
        const onScroll = () => {
            lastScrollTime.current = Date.now();
            if (window.scrollY > 0) {
                startY.current = 0;
                isTracking.current = false;
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const handleTouchStart = (e) => {
        if (window.scrollY === 0) {
            // Only start tracking if scroll has settled (not during momentum
            // scrolling) — prevents firing right after the page shifted.
            const timeSinceLastScroll = Date.now() - lastScrollTime.current;
            if (timeSinceLastScroll > 300) {
                startY.current = e.touches[0].clientY;
                isTracking.current = true;
            } else {
                startY.current = 0;
                isTracking.current = false;
            }
        } else {
            startY.current = 0;
            isTracking.current = false;
        }
    };

    const handleTouchMove = (e) => {
        if (isRefreshing || !isTracking.current || startY.current === 0) return;
        // Abort if the page scrolled away from the top since touchstart
        if (window.scrollY > 0) {
            isTracking.current = false;
            setPullDistance(0);
            return;
        }

        const currentY = e.touches[0].clientY;
        const distance = Math.max(0, currentY - startY.current);

        if (distance > 5) {
            e.preventDefault();
            setPullDistance(Math.min(distance, 120));
        }
    };

    const handleTouchEnd = async () => {
        isTracking.current = false;
        if (pullDistance > 80) {
            setIsRefreshing(true);
            if ('vibrate' in navigator) navigator.vibrate(30);

            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
    };

    return (
        <div
            className="relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull indicator */}
            <div
                className="fixed top-0 left-0 right-0 z-40 flex items-center justify-center transition-all duration-200 pointer-events-none"
                style={{
                    height: `${pullDistance}px`,
                    opacity: pullDistance / 100,
                    marginTop: 'env(safe-area-inset-top)'
                }}
            >
                <div className="flex items-center gap-2 text-slate-400">
                    <RefreshCw
                        className={cn(
                            "w-5 h-5",
                            isRefreshing && "animate-spin"
                        )}
                    />
                    <span className="text-sm font-medium">
                        {isRefreshing ? 'Wird aktualisiert...' : pullDistance > 80 ? 'Loslassen' : 'Ziehen zum Aktualisieren'}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div style={{ paddingTop: `${pullDistance}px` }}>
                {children}
            </div>
        </div>
    );
}