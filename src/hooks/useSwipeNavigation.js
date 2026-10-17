/**
 * useSwipeNavigation — horizontales Pointer-Swipe zwischen Tabs/Sektionen.
 *
 * Mobile-only (touch). Desktop-Pointer bleibt unberührt.
 * - >60px horizontales Delta
 * - <300ms Dauer
 * - vertikale Bewegung <40px → wird ignoriert (Scrollen nicht gestört)
 * - passive touch-Handler, kein preventDefault beim Scroll-Start
 *
 * Usage:
 *   const swipeHandlers = useSwipeNavigation({ onLeft: () => nextTab(), onRight: () => prevTab() });
 *   <div {...swipeHandlers}>...</div>
 */
import { useRef, useCallback } from 'react';

const SWIPE_MIN_DELTA = 60;
const SWIPE_MAX_MS = 300;
const SWIPE_MAX_VERTICAL = 40;

export function useSwipeNavigation({ onLeft, onRight, enabled = true }) {
    const startX = useRef(0);
    const startY = useRef(0);
    const startTime = useRef(0);

    const handleTouchStart = useCallback((e) => {
        if (!enabled || e.touches.length !== 1) return;
        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
        startTime.current = Date.now();
    }, [enabled]);

    const handleTouchEnd = useCallback((e) => {
        if (!enabled) return;
        const t = e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - startX.current;
        const dy = Math.abs(t.clientY - startY.current);
        const dt = Date.now() - startTime.current;
        if (dt > SWIPE_MAX_MS) return;
        if (dy > SWIPE_MAX_VERTICAL) return; // vertical scroll
        if (Math.abs(dx) < SWIPE_MIN_DELTA) return;
        if (dx < 0 && onLeft) onLeft();   // finger leftward → next
        else if (dx > 0 && onRight) onRight(); // finger rightward → prev
    }, [enabled, onLeft, onRight]);

    return {
        onTouchStart: handleTouchStart,
        onTouchEnd: handleTouchEnd,
    };
}

export default useSwipeNavigation;