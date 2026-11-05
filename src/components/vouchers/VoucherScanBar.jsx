/**
 * VoucherScanBar — Foto-/Scan-Einstieg oben auf der Gutscheinseite.
 *
 * Wunsch Pierre (05.11.2026): bestehende Gutscheine direkt scannen und
 * verarbeiten, ohne den Umweg über die Liste.
 *
 * Ablauf:
 *   Kamera (bestehender BarcodeScanner, facingMode environment, volle Auflösung)
 *   → QR lesen → Inhalt parsen:
 *       · komplette URL  https://savo-lounge-club.de/gutschein?nr=<nr>&t=<token>
 *       · nur die Nummer (altes Etikett)
 *   → Lookup über voucher_number → Einlöse-Dialog (VoucherRedeemDialog)
 *
 * Fälle: Token passt / ohne Token / Token falsch (blockiert) /
 *         Nummer unbekannt (Meldung + manuelle Eingabe) /
 *         bereits eingelöst (Historie, blockiert) / teilweise (Restwert groß).
 *
 * Doppelbuchungsschutz: derselbe QR-Inhalt innerhalb von 5 s wird ignoriert.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import BarcodeScanner from '@/components/restock/BarcodeScanner';
import VoucherRedeemDialog from '@/components/vouchers/VoucherRedeemDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { parseVoucherQr } from '@/lib/vouchers';
import { Camera, AlertTriangle, Keyboard, ShieldAlert, Search } from 'lucide-react';
import { toast } from 'sonner';

const DUPLICATE_SCAN_MS = 5000;

export default function VoucherScanBar({
    vouchers = [], redemptions = [], currentUser, onRedeem,
    autoScan = false, onAutoScanHandled,
}) {
    const [scanOpen, setScanOpen] = useState(false);
    const [manualOpen, setManualOpen] = useState(false);
    const [manualNr, setManualNr] = useState('');
    const [problem, setProblem] = useState(null);      // { kind: 'unbekannt' | 'token', nr }
    const [target, setTarget] = useState(null);        // { voucher, tokenWarning }
    const lastScan = useRef({ value: '', at: 0 });

    // Deep-Link ?scan=1 (Dashboard-Kachel) öffnet die Kamera sofort
    useEffect(() => {
        if (!autoScan) return;
        setScanOpen(true);
        onAutoScanHandled?.();
    }, [autoScan, onAutoScanHandled]);

    /** Inhalt auswerten — gemeinsamer Weg für Kamera und manuelle Eingabe. */
    const resolve = useCallback((raw, { fromCamera = false } = {}) => {
        const text = String(raw ?? '').trim();
        if (!text) return;

        // Doppelscan-Schutz: gleicher Inhalt in 5 s → kein zweiter Vorgang
        const now = Date.now();
        if (fromCamera && text === lastScan.current.value && now - lastScan.current.at < DUPLICATE_SCAN_MS) {
            toast.info('Doppelscan ignoriert — derselbe QR wurde gerade gelesen.');
            return;
        }
        if (fromCamera) lastScan.current = { value: text, at: now };

        const { nr, token } = parseVoucherQr(text);
        const num = parseInt(String(nr ?? '').replace(/\D/g, ''), 10);
        setProblem(null);

        if (!num || Number.isNaN(num)) {
            setProblem({ kind: 'unbekannt', nr: String(nr ?? text) });
            return;
        }

        const hit = vouchers.find((v) => Number(v.voucher_number) === num) || null;
        if (!hit) {
            setProblem({ kind: 'unbekannt', nr: String(num) });
            return;
        }

        const stored = hit.access_token ? String(hit.access_token).toUpperCase() : '';
        if (token && stored && String(token).toUpperCase() !== stored) {
            setProblem({ kind: 'token', nr: String(num) });
            return;
        }

        setTarget({ voucher: hit, tokenWarning: !token });
    }, [vouchers]);

    const openManual = () => {
        setManualNr(problem?.nr || '');
        setManualOpen(true);
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        setManualOpen(false);
        resolve(manualNr, { fromCamera: false });
    };

    return (
        <div className="space-y-1.5">
            <Button className="w-full h-12" onClick={() => setScanOpen(true)}>
                <Camera className="w-5 h-5 mr-2" />
                Gutschein scannen
            </Button>
            <button
                type="button"
                onClick={openManual}
                className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
                Nummer manuell eingeben
            </button>

            {/* Scan-Ergebnis ohne Treffer / mit falschem Token */}
            {problem && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2.5 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-destructive">
                            {problem.kind === 'token'
                                ? 'Token gehört nicht zu dieser Nummer'
                                : `Gutschein Nr. ${problem.nr} nicht gefunden`}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {problem.kind === 'token'
                                ? `Gescannt: Nr. ${problem.nr} — Einlösen blockiert. Bitte den QR vom Original-Beleg verwenden.`
                                : 'Nummer prüfen oder Beleg manuell suchen.'}
                        </p>
                        <Button size="sm" variant="secondary" className="mt-2 h-8" onClick={openManual}>
                            <Keyboard className="w-3.5 h-3.5 mr-1.5" />
                            Nummer manuell eingeben
                        </Button>
                    </div>
                </div>
            )}

            {/* Kamera */}
            <BarcodeScanner
                open={scanOpen}
                onClose={() => setScanOpen(false)}
                onScan={(text) => resolve(text, { fromCamera: true })}
                title="Gutschein scannen"
                hint="QR flach halten, 20–30 cm Abstand"
                manualLabel="Gutschein-Nummer"
                manualPlaceholder="z. B. 319"
                highResolution
            />

            {/* Manuelle Nummer */}
            <Dialog open={manualOpen} onOpenChange={setManualOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-primary" />
                            Gutschein-Nummer eingeben
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleManualSubmit} className="space-y-3">
                        <Input
                            autoFocus
                            type="text"
                            inputMode="numeric"
                            placeholder="z. B. 319"
                            value={manualNr}
                            onChange={(e) => setManualNr(e.target.value)}
                            className="h-12 text-center text-xl font-bold tabular-nums"
                        />
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Ohne QR kann der Zugriffscode nicht geprüft werden.
                        </p>
                        <DialogFooter className="flex gap-2">
                            <Button type="button" variant="secondary" onClick={() => setManualOpen(false)}>
                                Abbrechen
                            </Button>
                            <Button type="submit" disabled={!manualNr.trim()}>Öffnen</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Einlösen / Historie */}
            {target && (
                <VoucherRedeemDialog
                    voucher={target.voucher}
                    tokenWarning={target.tokenWarning}
                    redemptions={redemptions}
                    vouchers={vouchers}
                    currentUser={currentUser}
                    onClose={() => setTarget(null)}
                    onRedeem={({ amount, reference, redeemedBy }) =>
                        onRedeem({ voucher: target.voucher, amount, reference, redeemedBy })}
                />
            )}
        </div>
    );
}