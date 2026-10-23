import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Keyboard, RefreshCw, X, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * BarcodeScanner — PWA-optimized camera scanner
 *
 * Root cause fixes:
 *  1. Uses Html5Qrcode (direct API) instead of Html5QrcodeScanner wrapper,
 *     giving us full control over start/stop lifecycle.
 *  2. Single useEffect drives the entire camera lifecycle. A `cleanupRef`
 *     ensures stop() is always called exactly once, even on fast open/close.
 *  3. facingMode: "environment" with fallback to any camera — iOS PWA compatible.
 *  4. video element gets autoPlay + playsInline + muted attributes via
 *     Html5Qrcode's config; we also force them after mount.
 *  5. Container is flex/full-height so the injected <video> is never clipped.
 *  6. Loading and permission-denied states shown clearly while camera starts.
 */

const SCANNER_ELEMENT_ID = 'pwa-barcode-scanner-view';

const contextLabels = {
    inventory: { title: 'Inventur-Scan',   hint: 'Artikel scannen, um den Bestand zu aktualisieren' },
    storage:   { title: 'Lager-Scan',       hint: 'QR-Code oder Barcode des Lagerartikels scannen' },
    kanban:    { title: 'Kanban-Scan',      hint: 'Artikel scannen, um die Karte zu verknüpfen' },
    default:   { title: 'Barcode scannen',  hint: 'Halte den Code vor die Kamera' },
};

export default function BarcodeScanner({ onScan, open, onClose, onError, title, hint, mode = 'default' }) {
    const ctx         = contextLabels[mode] || contextLabels.default;
    const dialogTitle = title || ctx.title;
    const dialogHint  = hint  || ctx.hint;

    const [scanStatus, setScanStatus] = useState('idle'); // idle | loading | scanning | error | denied
    const [errorMsg,   setErrorMsg]   = useState('');
    const [manualInput, setManualInput] = useState('');
    const [showManual,  setShowManual]  = useState(false);

    // Refs that survive re-renders without triggering them
    const qrcodeRef   = useRef(null); // Html5Qrcode instance
    const cleanupDone = useRef(true); // true = safe to start a new session
    // onError über eine Ref aufrufen — so bleibt startCamera stabil (kein Kamera-Neustart bei Re-Render)
    const onErrorRef = useRef(onError);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);
    const mountedRef  = useRef(false);

    // ── Stop camera stream completely ────────────────────────────────────────
    const stopCamera = useCallback(async () => {
        if (!qrcodeRef.current) return;
        const instance = qrcodeRef.current;
        qrcodeRef.current = null;
        cleanupDone.current = true;
        try {
            const state = instance.getState();
            // State 2 = SCANNING, state 3 = PAUSED
            if (state === 2 || state === 3) {
                await instance.stop();
            }
            instance.clear();
        } catch (_) {
            // Swallow — camera may already be released
        }
    }, []);

    // ── Start camera stream ──────────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        if (!mountedRef.current) return;
        if (!cleanupDone.current) return; // already starting or running

        cleanupDone.current = false;
        setScanStatus('loading');
        setErrorMsg('');

        // Ensure the DOM element exists (Dialog may delay rendering)
        const el = document.getElementById(SCANNER_ELEMENT_ID);
        if (!el) {
            cleanupDone.current = true;
            setScanStatus('error');
            setErrorMsg('Kamera-Container nicht gefunden. Bitte schließen und erneut öffnen.');
            onErrorRef.current?.();
            return;
        }

        const instance = new Html5Qrcode(SCANNER_ELEMENT_ID, {
            // Verbose = false keeps the console clean
            verbose: false,
        });
        qrcodeRef.current = instance;

        // Camera constraints — prefer rear camera; fallback to any camera
        // iOS PWA requires exact constraint format
        const constraints = {
            facingMode: { ideal: 'environment' },
        };

        const config = {
            fps: 15,
            // qrbox as function = always 80% of the smaller dimension → works on any screen size
            qrbox: (w, h) => {
                const side = Math.min(w, h) * 0.8;
                return { width: Math.round(side), height: Math.round(side * 0.65) };
            },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            // These are critical for iOS PWA autoplay policy
            videoConstraints: constraints,
            rememberLastUsedCamera: false, // avoid stale camera IDs on reopen
            formatsToSupport: [
                0,  // QR_CODE
                8,  // CODE_128
                9,  // CODE_39
                10, // EAN_13
                11, // EAN_8
                12, // UPC_A
                13, // UPC_E
            ],
        };

        const onSuccess = (decodedText) => {
            if (!mountedRef.current) return;
            // Haptic + audio feedback
            try { navigator.vibrate?.(200); } catch (_) {}
            try {
                const beep = new AudioContext();
                const osc  = beep.createOscillator();
                osc.connect(beep.destination);
                osc.frequency.value = 880;
                osc.start();
                osc.stop(beep.currentTime + 0.1);
            } catch (_) {}

            onScan(decodedText);
            stopCamera().then(() => {
                if (mountedRef.current) onClose();
            });
        };

        const onError = () => {
            // Called for every frame that doesn't contain a code — suppress completely
        };

        try {
            await instance.start(constraints, config, onSuccess, onError);

            if (!mountedRef.current) {
                // Component was unmounted while we were starting — clean up immediately
                await stopCamera();
                return;
            }

            // iOS / Safari PWA fix: force video attributes after Html5Qrcode injects the element
            const video = el.querySelector('video');
            if (video) {
                video.setAttribute('playsinline', 'true');
                video.setAttribute('muted', 'true');
                video.muted = true;
                // Trigger play in case autoplay was blocked
                video.play().catch(() => {});
            }

            setScanStatus('scanning');
        } catch (err) {
            cleanupDone.current = true;
            qrcodeRef.current = null;
            if (!mountedRef.current) return;

            const msg = err?.message || String(err);
            if (
                msg.includes('Permission') ||
                msg.includes('permission') ||
                msg.includes('NotAllowed') ||
                msg.includes('denied')
            ) {
                setScanStatus('denied');
                setErrorMsg('Kamerazugriff wurde verweigert. Bitte Berechtigung in den Browser-Einstellungen erteilen.');
            } else if (msg.includes('NotFound') || msg.includes('Requested device not found')) {
                setScanStatus('error');
                setErrorMsg('Keine Kamera gefunden. Bitte prüfe, ob eine Kamera angeschlossen ist.');
            } else {
                setScanStatus('error');
                setErrorMsg(`Kamera konnte nicht gestartet werden: ${msg}`);
            }
            onErrorRef.current?.();
        }
    }, [onScan, onClose, stopCamera]);

    // ── Lifecycle: open/close dialog ────────────────────────────────────────
    useEffect(() => {
        mountedRef.current = true;

        if (open) {
            setScanStatus('idle');
            setShowManual(false);
            setManualInput('');
            // Small delay so the Dialog finishes rendering and the DOM element exists
            const timer = setTimeout(() => {
                if (mountedRef.current) startCamera();
            }, 350);
            return () => clearTimeout(timer);
        } else {
            stopCamera();
            setScanStatus('idle');
        }

        return () => {
            mountedRef.current = false;
            stopCamera();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualInput.trim()) {
            onScan(manualInput.trim());
            setManualInput('');
            setShowManual(false);
        }
    };

    const handleRetry = () => {
        stopCamera().then(() => startCamera());
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <Dialog open={open} onOpenChange={onClose}>
            {/* Full-screen on mobile, contained on desktop */}
            <DialogContent className="w-full max-w-md sm:max-w-lg p-0 gap-0 h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col rounded-none sm:rounded-2xl overflow-hidden">

                {/* Header */}
                <DialogHeader className="flex-row items-center justify-between px-5 py-4 border-b border-border/50 shrink-0 space-y-0">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <Camera className="w-5 h-5 text-amber-500" />
                        {dialogTitle}
                    </DialogTitle>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </DialogHeader>

                {/* Camera viewport */}
                <div className="relative flex-1 bg-black overflow-hidden">

                    {/* Html5Qrcode injects <video> into this div.
                        It MUST be in the DOM before startCamera() is called.
                        overflow-hidden + w-full/h-full keeps it from overflowing. */}
                    <div
                        id={SCANNER_ELEMENT_ID}
                        className="w-full h-full"
                        style={{ minHeight: '260px' }}
                    />

                    {/* Loading overlay */}
                    {scanStatus === 'loading' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
                            <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                            <p className="text-white text-sm font-medium">Kamera wird gestartet…</p>
                        </div>
                    )}

                    {/* Error / denied overlay */}
                    {(scanStatus === 'error' || scanStatus === 'denied') && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-4 px-6 text-center">
                            <AlertCircle className="w-12 h-12 text-red-400" />
                            <p className="text-white text-sm leading-relaxed">{errorMsg}</p>
                            {scanStatus === 'error' && (
                                <Button
                                    onClick={handleRetry}
                                    className="gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold h-11 px-6 rounded-xl"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Erneut versuchen
                                </Button>
                            )}
                            {scanStatus === 'denied' && (
                                <p className="text-xs text-white/60">
                                    iOS: Einstellungen → Safari → Kamera → Erlauben<br />
                                    Android: Einstellungen → Apps → Browser → Berechtigungen
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Bottom bar */}
                <div className="shrink-0 bg-card border-t border-border/50 px-4 pt-3 pb-4 space-y-3">
                    <p className="text-sm text-center text-muted-foreground leading-snug">
                        {dialogHint}
                    </p>

                    {showManual ? (
                        <form onSubmit={handleManualSubmit} className="flex gap-2">
                            <Input
                                autoFocus
                                value={manualInput}
                                onChange={e => setManualInput(e.target.value)}
                                placeholder="Code manuell eingeben…"
                                className="flex-1 h-11 rounded-xl"
                            />
                            <Button type="submit" className="h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold px-5">OK</Button>
                            <Button type="button" variant="outline" className="h-11 w-11 rounded-xl p-0" onClick={() => setShowManual(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </form>
                    ) : (
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowManual(true)}
                                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            >
                                <Keyboard className="w-4 h-4" />
                                Manuell eingeben
                            </button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                className="flex-1 h-11 rounded-xl"
                            >
                                Abbrechen
                            </Button>
                        </div>
                    )}
                </div>

            </DialogContent>
        </Dialog>
    );
}