import { useState, useRef } from 'react';
import { haptics } from '@/components/utils/haptics';
import { cn } from '@/lib/utils';

const SWIPE_THRESHOLD = 120;
const SWIPE_ALT_THRESHOLD = 190;

/**
 * Reusable swipeable row wrapper (touch-only; desktop/hover untouched).
 *
 * Swipe directions:
 *  - Left swipe  (finger leftward):  onSwipe / onSwipeAlt  (reveal on RIGHT)
 *  - Right swipe (finger rightward): onSwipeRight          (reveal on LEFT)
 *
 * Props:
 *  - onSwipe:       primary action at SWIPE_THRESHOLD (left swipe, default reveal: destructive red)
 *  - onSwipeAlt:    optional second action when dragged past SWIPE_ALT_THRESHOLD (left swipe)
 *  - onSwipeRight:  action when swiped rightward past SWIPE_THRESHOLD (reveal on left)
 *  - revealColor:   Tailwind bg class for the primary reveal (default 'bg-destructive')
 *  - revealIcon:    lucide icon component shown in the primary reveal
 *  - revealColorAlt: bg class when past the alt threshold (defaults to revealColor)
 *  - revealIconAlt:  icon shown when past the alt threshold (defaults to revealIcon)
 *  - revealColorRight: bg class for the right-swipe reveal (default 'bg-green-600')
 *  - revealIconRight:  icon shown in the right-swipe reveal
 *  - className:      classes on the outer clipping container
 *  - contentClassName: classes on the inner moving content div
 *  - disabled:      disable swipe interaction
 */
export default function SwipeRow({
    children,
    onSwipe,
    onSwipeAlt,
    onSwipeRight,
    revealColor = 'bg-destructive',
    revealIcon: RevealIcon,
    revealColorAlt,
    revealIconAlt: RevealIconAlt,
    revealColorRight = 'bg-green-600',
    revealIconRight: RevealIconRight,
    className,
    contentClassName,
    disabled = false,
}) {
    const maxCap = onSwipeAlt ? 230 : 140;
    const maxCapRight = 140;
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const [swipeOffset, setSwipeOffset] = useState(0); // + = left swipe, - = right swipe

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
        if (dx > 0 && onSwipe) {
            setSwipeOffset(Math.min(dx, maxCap));
        } else if (dx < 0 && onSwipeRight) {
            setSwipeOffset(Math.max(dx, -maxCapRight));
        }
    };

    const handleTouchEnd = () => {
        if (disabled) return;
        const abs = Math.abs(swipeOffset);
        if (swipeOffset > 0) {
            if (abs >= SWIPE_ALT_THRESHOLD && onSwipeAlt) {
                haptics.medium();
                onSwipeAlt();
            } else if (abs >= SWIPE_THRESHOLD && onSwipe) {
                haptics.medium();
                onSwipe();
            }
        } else if (swipeOffset < 0) {
            if (abs >= SWIPE_THRESHOLD && onSwipeRight) {
                haptics.medium();
                onSwipeRight();
            }
        }
        setSwipeOffset(0);
    };

    const pastAlt = swipeOffset > 0 && swipeOffset >= SWIPE_ALT_THRESHOLD && onSwipeAlt;
    const activeColor = pastAlt ? (revealColorAlt || revealColor) : revealColor;
    const ActiveIcon = pastAlt ? (RevealIconAlt || RevealIcon) : RevealIcon;

    return (
        <div className={cn('relative overflow-hidden', className)}>
            {/* Right-swipe reveal (left side) */}
            {swipeOffset < -20 && (
                <div
                    className={cn(
                        'absolute inset-y-0 left-0 flex items-center justify-center transition-all',
                        revealColorRight
                    )}
                    style={{ width: `${Math.min(Math.abs(swipeOffset), maxCapRight)}px` }}
                >
                    {RevealIconRight && <RevealIconRight className="w-5 h-5 text-white" />}
                </div>
            )}
            {/* Left-swipe reveal (right side) */}
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
                style={{ transform: `translateX(${-swipeOffset}px)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    );
}