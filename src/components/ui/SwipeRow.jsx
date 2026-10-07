import { useState, useRef } from 'react';
import { haptics } from '@/components/utils/haptics';
import { cn } from '@/lib/utils';

const SWIPE_THRESHOLD = 120;
const SWIPE_ALT_THRESHOLD = 190;

/**
 * Reusable swipeable row wrapper (touch-only; desktop/hover untouched).
 *
 * Props:
 *  - onSwipe:       primary action at SWIPE_THRESHOLD (default reveal: destructive red)
 *  - onSwipeAlt:    optional second action when dragged past SWIPE_ALT_THRESHOLD
 *  - revealColor:   Tailwind bg class for the primary reveal (default 'bg-destructive')
 *  - revealIcon:    lucide icon component shown in the primary reveal
 *  - revealColorAlt: bg class when past the alt threshold (defaults to revealColor)
 *  - revealIconAlt:  icon shown when past the alt threshold (defaults to revealIcon)
 *  - className:      classes on the outer clipping container
 *  - contentClassName: classes on the inner moving content div
 *  - disabled:      disable swipe interaction
 */
export default function SwipeRow({
    children,
    onSwipe,
    onSwipeAlt,
    revealColor = 'bg-destructive',
    revealIcon: RevealIcon,
    revealColorAlt,
    revealIconAlt: RevealIconAlt,
    className,
    contentClassName,
    disabled = false,
}) {
    const maxCap = onSwipeAlt ? 230 : 140; // match original QuickListRow cap when no alt
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const [swipeOffset, setSwipeOffset] = useState(0);

    const handleTouchStart = (e) => {
        if (disabled) return;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        setSwipeOffset(0);
    };

    const handleTouchMove = (e) => {
        if (disabled) return;
        const dx = touchStartX.current - e.touches[0].clientX;
        const dy = Math.abs(touchStartY.current - e.touches[0].clientY);
        if (dy > 20) return; // vertical scroll, not a swipe
        if (dx > 0) setSwipeOffset(Math.min(dx, maxCap));
    };

    const handleTouchEnd = () => {
        if (disabled) return;
        if (swipeOffset >= SWIPE_ALT_THRESHOLD && onSwipeAlt) {
            haptics.medium();
            onSwipeAlt();
        } else if (swipeOffset >= SWIPE_THRESHOLD && onSwipe) {
            haptics.medium();
            onSwipe();
        }
        setSwipeOffset(0);
    };

    const pastAlt = swipeOffset >= SWIPE_ALT_THRESHOLD && onSwipeAlt;
    const activeColor = pastAlt ? (revealColorAlt || revealColor) : revealColor;
    const ActiveIcon = pastAlt ? (RevealIconAlt || RevealIcon) : RevealIcon;

    return (
        <div className={cn('relative overflow-hidden', className)}>
            {swipeOffset > 20 && (
                <div
                    className={cn(
                        'absolute inset-y-0 right-0 flex items-center justify-center transition-all',
                        activeColor
                    )}
                    style={{ width: `${Math.min(swipeOffset, maxCap)}px` }}
                >
                    {ActiveIcon && <ActiveIcon className="w-5 h-5 text-white" />}
                </div>
            )}
            <div
                className={cn('transition-transform will-change-transform', contentClassName)}
                style={{ transform: `translateX(-${swipeOffset}px)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    );
}