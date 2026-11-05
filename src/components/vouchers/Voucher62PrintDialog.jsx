/**
 * Voucher62PrintDialog — Druck der 62 × 100 mm Gutschein-Ausgaben (Brother QL-800).
 *
 * Zwei Ausgaben, Auswahl vor dem Druck:
 *  a) Geschenkgutschein (Verkauf)
 *  b) Einlösebeleg (nach Einlösung)
 * Zusätzlich: alle offenen Gutscheine in einem Rutsch (Nachdruck), Anzahl vorab sichtbar.
 * Der 80-mm-Beleg für den Sam4s bleibt davon unberührt.
 */
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { generateVoucherAccessToken } from '@/lib/vouchers';
import { buildVoucherPdf, voucherQrPayload } from '@/lib/voucherPrint62';
import { openPdfForPrint } from '@/lib/slotLabels';
import Voucher62Preview from '@/components/vouchers/Voucher62Preview';
import { Printer, Loader2, AlertTriangle, RotateCcw, ArrowLeft, CheckCircle2 } from 'lucide-react';

const KINDS = [
    { key: 'gift', label: 'Geschenkgutschein', hint: 'Verkauf · 62 × 100 mm' },
    { key: 'redeem', label: 'Einlösebeleg', hint: 'nach Einlösung · 62 × 100 mm' },
];

const isOpenStatus = (v) => v.status === 'offen' || v.status === 'teilweise_eingelöst';

export default function Voucher62PrintDialog({
    open, onClose, vouchers = [], redemptions = [], single = null, defaultKind = 'gift', redeemed = null,
}) {
    const queryClient = useQueryClient();
    const [kind, setKind] = useState(defaultKind);
    const [stage, setStage] = useState('choose');   // choose | done
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [previewQr, setPreviewQr] = useState(null);
    const [lastCount, setLastCount] = useState(0);

    useEffect(() => {
        if (!open) return;
        setKind(defaultKind);
        setStage('choose');
        setError(null);
    }, [open, defaultKind, single?.id]);

    // QR nur für die Einzel-Vorschau (Batch zeigt nur die Anzahl)
    useEffect(() => {
        if (!open || !single) { setPreviewQr(null); return; }
        const payload = voucherQrPayload(single);
        if (!payload) { setPreviewQr(null); return; }
        let alive = true;
        QRCode.toDataURL(payload, { margin: 0, width: 320, errorCorrectionLevel: 'M' })
            .then((url) => { if (alive) setPreviewQr(url); })
            .catch(() => { if (alive) setPreviewQr(null); });
        return () => { alive = false; };
    }, [open, single?.id, single?.access_token]);

    // ── Ziel-Liste ────────────────────────────────────────────────────────
    const openVouchers = vouchers.filter(isOpenStatus);
    const redeemableHistory = vouchers.filter((v) => v.status === 'teilweise_eingelöst' || v.status === 'eingelöst');
    const batchList = kind === 'gift' ? openVouchers : redeemableHistory;
    const targets = single ? [single] : batchList;

    // ── Einlöse-Daten ermitteln ───────────────────────────────────────────
    const redeemInfoFor = (v) => {
        if (redeemed && single && single.id === v.id) {
            return {
                amount: redeemed.amount,
                remaining: redeemed.remaining ?? v.remaining_value,
                at: redeemed.at,
            };
        }
        const history = redemptions
            .filter((r) => r.voucher_id === v.id)
            .sort((a, b) => String(b.created_date || b.redemption_date || '')
                .localeCompare(String(a.created_date || a.redemption_date || '')));
        const latest = history[0];
        if (latest) {
            return {
                amount: latest.amount,
                remaining: v.remaining_value,
                at: latest.created_date || latest.redemption_date,
            };
        }
        return {
            amount: Math.max(0, (v.original_value || 0) - (v.remaining_value || 0)),
            remaining: v.remaining_value,
            at: null,
        };
    };

    // ── Fehlenden Zugriffscode vor dem Druck erzeugen und speichern ───────
    const ensureTokens = async (list) => {
        let created = false;
        const result = await Promise.all(list.map(async (v) => {
            if (v.access_token) return v;
            const token = generateVoucherAccessToken();
            await base44.entities.Voucher.update(v.id, { access_token: token });
            created = true;
            return { ...v, access_token: token };
        }));
        if (created) queryClient.invalidateQueries({ queryKey: ['vouchers'] });
        return result;
    };

    const handlePrint = async () => {
        if (!targets.length || busy) return;
        setBusy(true);
        setError(null);
        try {
            const withTokens = await ensureTokens(targets);
            const items = withTokens.map((v) => (kind === 'redeem'
                ? { kind: 'redeem', voucher: v, ...redeemInfoFor(v) }
                : { kind: 'gift', voucher: v }));

            const doc = await buildVoucherPdf(items);
            openPdfForPrint(doc);
            setLastCount(items.length);
            setStage('done');
        } catch (err) {
            setError(String(err?.message || err));
        } finally {
            setBusy(false);
        }
    };

    const previewVoucher = single || null;
    const previewInfo = previewVoucher && kind === 'redeem' ? redeemInfoFor(previewVoucher) : null;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Printer className="w-4 h-4 text-primary" />
                        Gutschein drucken · 62 mm
                    </DialogTitle>
                </DialogHeader>

                {stage === 'done' ? (
                    <div className="space-y-3">
                        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-center">
                            <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto" />
                            <p className="text-sm font-semibold text-foreground mt-1.5">
                                {lastCount === 1 ? '1 Seite gedruckt' : `${lastCount} Seiten gedruckt`}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">62 × 100 mm · im Druckdialog 100 % wählen</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" className="flex-1" onClick={() => setStage('choose')}>
                                <RotateCcw className="w-4 h-4 mr-1.5" />
                                Noch einen drucken
                            </Button>
                            <Button className="flex-1" onClick={onClose}>
                                <ArrowLeft className="w-4 h-4 mr-1.5" />
                                Zur Liste
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Ausgabe wählen */}
                        <div className="grid grid-cols-2 gap-2">
                            {KINDS.map((k) => (
                                <button
                                    key={k.key}
                                    type="button"
                                    onClick={() => setKind(k.key)}
                                    className={cn(
                                        'rounded-xl border px-2 py-2.5 text-left transition-all',
                                        kind === k.key
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:border-primary/40'
                                    )}
                                >
                                    <p className={cn('text-xs font-semibold', kind === k.key ? 'text-primary' : 'text-foreground')}>
                                        {k.label}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{k.hint}</p>
                                </button>
                            ))}
                        </div>

                        {/* Einzel-Vorschau / Batch-Anzahl */}
                        {previewVoucher ? (
                            <div className="rounded-xl bg-muted/40 py-3">
                                <Voucher62Preview
                                    kind={kind}
                                    voucher={previewVoucher}
                                    amount={previewInfo?.amount}
                                    remaining={previewInfo?.remaining}
                                    at={previewInfo?.at}
                                    qr={previewQr}
                                />
                                {!previewVoucher.access_token && (
                                    <p className="text-[10px] text-muted-foreground text-center mt-2 px-3">
                                        Kein Zugriffscode vorhanden — er wird beim Druck erzeugt und gespeichert.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-xl bg-muted/40 px-4 py-3 text-center">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Vorschau</p>
                                <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{targets.length}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {kind === 'gift' ? 'offene Gutscheine' : 'eingelöste Gutscheine'} · je 62 × 100 mm,
                                    ein Gutschein pro Seite
                                </p>
                            </div>
                        )}

                        {error && (
                            <p className="text-xs text-destructive flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {error}
                            </p>
                        )}

                        <DialogFooter className="flex gap-2">
                            <Button variant="secondary" onClick={onClose} disabled={busy}>
                                Abbrechen
                            </Button>
                            <Button onClick={handlePrint} disabled={busy || targets.length === 0}>
                                {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Printer className="w-4 h-4 mr-1.5" />}
                                {targets.length === 1 ? 'Drucken' : `${targets.length} drucken`}
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}