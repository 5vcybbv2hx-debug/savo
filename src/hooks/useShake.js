/**
 * useShake — erkennt Schütteln des Geräts via devicemotion.
 *
 * - Konservativer Schwellenwert (~15) zur Vermeidung von Fehlauslösungen
 * - iOS: DeviceMotionPermission wird nur bei Bedarf angefordert (graceful no-op wenn verweigert)
 * - Graceful no-op wenn Sensor fehlt oder nicht erlaubt
 * - Mindest-Intervall 1.5s zwischen Auslösungen (Debounce)
 *
 * Usage:
 *   useShake(() => undoLastAction());
 */
import { useEffect, useRef, useCallback } from 'react';

const SHAKE_THRESHOLD = 15;
const SHAKE_DEBOUNCE_MS = 1500;

export function useShake(onShake, { enabled = true } = {}) {
    const lastFire = useRef(0);
    const handlerRef = useRef(onShake);
    handlerRef.current = onShake;

    const handleMotion = useCallback((e) => {
        if (!enabled) return;
        const now = Date.now();
        if (now - lastFire.current < SHAKE_DEBOUNCE_MS) return;

        // accelerationIncludingGravity für breite Kompatibilität
        const acc = e.accelerationIncludingGravity || e.acceleration;
        if (!acc) return;
        const x = acc.x || 0;
        const y = acc.y || 0;
        const z = acc.z || 0;
        const delta = Math.sqrt(x * x + y * y + z * z);
        if (delta > SHAKE_THRESHOLD) {
            lastFire.current = now;
            handlerRef.current?.();
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return;

        // iOS 13+ benötigt explizite Permission
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            // Permission wird erst bei erstem Shake-Versuch durch User-Interaktion angefordert.
            // Wir registrieren einen einmaligen Click-Handler, der Permission anfordert.
            const requestOnInteraction = () => {
                DeviceMotionEvent.requestPermission()
                    .then(state => {
                        if (state === 'granted') {
                            window.addEventListener('devicemotion', handleMotion, { passive: true });
                        }
                    })
                    .catch(() => {});
                window.removeEventListener('click', requestOnInteraction);
                window.removeEventListener('touchstart', requestOnInteraction);
            };
            window.addEventListener('click', requestOnInteraction, { once: true });
            window.addEventListener('touchstart', requestOnInteraction, { once: true, passive: true });
            return () => {
                window.removeEventListener('click', requestOnInteraction);
                window.removeEventListener('touchstart', requestOnInteraction);
                window.removeEventListener('devicemotion', handleMotion);
            };
        }

        // Standard: direkt registrieren (Android / nicht-iOS)
        if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
            window.addEventListener('devicemotion', handleMotion, { passive: true });
            return () => window.removeEventListener('devicemotion', handleMotion);
        }
        // Sensor fehlt → graceful no-op
        return undefined;
    }, [enabled, handleMotion]);
}

export default useShake;