import React, { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PullToRefresh({ onRefresh, children }) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const containerRef = useRef(null);
    const lastScrollTime = useRef(0);
    const isTracking = useRef(false);

    const handleScroll = useCallback(() => {
        lastScrollTime.current = Date.now();
        // Reset startY if user scrolls away from top — prevents stale tracking
        if (containerRef.current && containerRef.current.scrollTop > 0) {
            startY.current = 0;
            isTracking.current = false;
        }
    }, []);

    const handleTouchStart = (e) => {
        if (containerRef.current?.scrollTop === 0) {
            // Only start tracking if scroll has settled (not during momentum scrolling).
            // This prevents pull-to-refresh from firing when the user scrolls back up
            // after content shifted (e.g., closing a panel in the Warehouse/Auffüllliste).
            const timeSinceLastScroll = Date.now() - lastScrollTime.current;
            if (timeSinceLastScroll > 300) {
                startY.current = e.touches[0].clientY;
                isTracking.current = true;
            } else {
                // Still settling — ignore this touch for pull-to-refresh purposes
                startY.current = 0;
                isTracking.current = false;
            }
        } else {
            startY.current = 0;
            isTracking.current = false;
        }
    };

    const handleTouchMove = (e) => {
        if (isRefreshing || !containerRef.current || !isTracking.current || startY.current === 0) return;
        // Re-check scrollTop — if user scrolled since touchstart, abort
        if (containerRef.current.scrollTop > 0) {
            isTracking.current = false;
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
            ref={containerRef}
            className="relative h-full overflow-auto"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onScroll={handleScroll}
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
