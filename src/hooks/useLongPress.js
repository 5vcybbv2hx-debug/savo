/**
 * useLongPress — erkennt Langdruck (450ms) auf Touch-Geräten.
 *
 * - 450ms Timer, abgebrochen bei Bewegung (>10px) oder vorzeitigem Loslassen
 * - feuert Callback + haptics.light() beim Auslösen
 * - reguläres Tap-Verhalten bleibt unverändert (Caller prüft ob longPress gefeuert hat)
 *
 * Usage:
 *   const longPressHandlers = useLongPress(() => openContextMenu(item), { enabled: !isDesktop });
 *   <button {...longPressHandlers} onClick={handleTap}>...</button>
 */
import { useRef, useCallback } from 'react';
import { haptics } from '@/components/utils/haptics';

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;

export function useLongPress(onLongPress, { enabled = true } = {}) {
    const timer = useRef(null);
    const startX = useRef(0);
    const startY = useRef(0);
    const fired = useRef(false);

    const start = useCallback((clientX, clientY) => {
        if (!enabled || !onLongPress) return;
        fired.current = false;
        startX.current = clientX;
        startY.current = clientY;
        timer.current = setTimeout(() => {
            fired.current = true;
            haptics.light();
            onLongPress();
        }, LONG_PRESS_MS);
    }, [enabled, onLongPress]);

    const move = useCallback((clientX, clientY) => {
        if (!timer.current) return;
        const dx = Math.abs(clientX - startX.current);
        const dy = Math.abs(clientY - startY.current);
        if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    }, []);

    const clear = useCallback(() => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    }, []);

    const handleTouchStart = useCallback((e) => {
        if (e.touches.length !== 1) return;
        start(e.touches[0].clientX, e.touches[0].clientY);
    }, [start]);

    const handleTouchMove = useCallback((e) => {
        if (e.touches.length !== 1) return;
        move(e.touches[0].clientX, e.touches[0].clientY);
    }, [move]);

    const handleTouchEnd = useCallback(() => {
        clear();
    }, [clear]);

    // Expose whether long press fired (so onClick can skip if it did)
    const didFire = useCallback(() => {
        const f = fired.current;
        // reset after read so next tap is clean
        fired.current = false;
        return f;
    }, []);

    return {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        didFire,
    };
}

export default useLongPress;