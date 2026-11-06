/**
 * VoucherRedeemDialog — Einlöse-Dialog für gescannte Gutscheine.
 *
 * Deckt alle Fälle nach dem Scan ab:
 *  - offen / teilweise_eingelöst → Betrag (vorbelegt mit Restwert) + Re.-Nr. → Einlösen
 *  - teilweise_eingelöst          → Restwert groß über dem Formular
 *  - eingelöst / ungültig         → Einlösen blockiert, Einlöse-Historie sichtbar
 *  - ohne Token gescannt          → Hinweis, Nummer zu prüfen
 * Nach erfolgreicher Einlösung: Vorschlag "Beleg drucken" (62 mm Einlösebeleg).
 */
import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    isValidReceiptNumber, sanitizeReceiptNumber,
    RECEIPT_HINT, RECEIPT_PLACEHOLDER, RECEIPT_INVALID_HINT, AMOUNT_HINT,
} from '@/lib/vouchers';
import Voucher62PrintDialog from '@/components/vouchers/Voucher62PrintDialog';
import {
    Euro, Loader2, AlertTriangle, CheckCircle2, History, Printer, Info, Ban,
} from 'lucide-react';

const fmtEUR = (n) => (n ?? 0).toLocaleString('de-DE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const fmtDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('.') : '—');

const STATUS_STYLES = {
    'offen': 'bg-status-warn/15 text-status-warn dark:text-status-warn border-status-warn/30',
    'teilweise_eingelöst': 'bg-status-warn/15 text-status-warn dark:text-status-warn border-status-warn/30',
    'eingelöst': 'bg-status-ok/15 text-status-ok dark:text-status-ok border-status-ok/30',
    'ungültig': 'bg-muted text-muted-foreground border-border',
};
const STATUS_LABEL = {
    'offen': 'Offen',
    'teilweise_eingelöst': 'Teilweise',
    'eingelöst': 'Eingelöst',
    'ungültig': 'Ungültig',
};

export default function VoucherRedeemDialog({
    voucher, redemptions = [], vouchers = [], currentUser,
    tokenWarning = false, onClose, onRedeem,
}) {
    const [amount, setAmount] = useState(String(voucher?.remaining_value ?? ''));
    const [reference, setReference] = useState('');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(null);
    const [printOpen, setPrintOpen] = useState(false);

    const redeemedBy = currentUser?.full_name || currentUser?.email || '';
    const remaining = voucher?.remaining_value ?? 0;
    const redeemable = !!voucher
        && (voucher.status === 'offen' || voucher.status === 'teilweise_eingelöst')
        && remaining > 0;

    const history = useMemo(() => (
        redemptions
            .filter((r) => r.voucher_id === voucher?.id)
            .sort((a, b) => String(b.redemption_date || '').localeCompare(String(a.redemption_date || '')))
    ), [redemptions, voucher?.id]);

    const amt = parseFloat(amount);
    const amountValid = !Number.isNaN(amt) && amt > 0 && amt <= remaining;
    const referenceValid = isValidReceiptNumber(reference);
    const valid = redeemable && amountValid && referenceValid;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!valid || pending) return;
        setPending(true);
        setError(null);
        try {
            const res = await onRedeem({ amount: amt, reference: reference.trim(), redeemedBy });
            setDone({ amount: amt, newRemaining: res?.newRemaining ?? 0 });
        } catch (err) {
            setError(String(err?.message || err));
        } finally {
            setPending(false);
        }
    };

    // ── Erfolg: Beleg-Vorschlag direkt im Dialog ───────────────────────────
    if (done) {
        return (
            <>
                <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-status-ok" />
                                Gutschein Nr. {voucher.voucher_number} eingelöst
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-center">
                                <p className="text-[13.5px] font-medium text-primary tracking-tight">Eingelöst</p>
                                <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{fmtEUR(done.amount)}</p>
                            </div>
                            <div className="rounded-xl bg-muted/40 px-4 py-3 text-center">
                                <p className="text-[13.5px] font-medium text-foreground tracking-tight">Neuer Restwert</p>
                                <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{fmtEUR(done.newRemaining)}</p>
                            </div>
                            <Button variant="secondary" className="w-full" onClick={() => setPrintOpen(true)}>
                                <Printer className="w-4 h-4 mr-1.5" />
                                Beleg drucken (62 mm)
                            </Button>
                            <Button className="w-full" onClick={onClose}>
                                Fertig
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {printOpen && (
                    <Voucher62PrintDialog
                        open
                        onClose={() => setPrintOpen(false)}
                        vouchers={vouchers}
                        redemptions={redemptions}
                        single={voucher}
                        redeemed={{ amount: done.amount, remaining: done.newRemaining, at: new Date().toISOString() }}
                        defaultFormat="einloese_beleg"
                        defaultKind="redeem"
                    />
                )}
            </>
        );
    }

    return (
        <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Euro className="w-4 h-4 text-primary" />
                        Gutschein Nr. {voucher.voucher_number}
                        <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 ml-auto', STATUS_STYLES[voucher.status])}>
                            {STATUS_LABEL[voucher.status] || voucher.status}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    {/* Restwert groß — auch bei teilweise eingelöst */}
                    <div className="rounded-xl bg-primary/10 border border-primary/25 px-4 py-3 text-center">
                        <p className="text-[13.5px] font-medium text-primary tracking-tight">Restwert</p>
                        <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">{fmtEUR(remaining)}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            von {fmtEUR(voucher.original_value)} · ausgestellt {fmtDate(voucher.issue_date)}
                        </p>
                    </div>

                    {tokenWarning && (
                        <p className="text-[11px] text-status-warn dark:text-status-warn flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                            Ohne Token gescannt — Nummer geprüft?
                        </p>
                    )}

                    {!redeemable ? (
                        <>
                            <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2.5 flex items-start gap-2">
                                <Ban className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                <p className="text-xs text-destructive">
                                    Einlösen blockiert —{' '}
                                    {voucher.status === 'ungültig'
                                        ? 'dieser Gutschein ist ungültig.'
                                        : 'dieser Gutschein ist bereits vollständig eingelöst.'}
                                </p>
                            </div>

                            <div>
                                <p className="text-[13.5px] font-medium text-foreground tracking-tight mb-1.5 flex items-center gap-1.5">
                                    <History className="w-3 h-3" />
                                    Einlöse-Historie ({history.length})
                                </p>
                                {history.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Keine Einlösungen erfasst.</p>
                                ) : (
                                    <div className="space-y-1">
                                        {history.map((r, i) => (
                                            <div key={r.id || i} className="flex items-center justify-between gap-2 text-xs border-b border-border/30 last:border-0 py-1.5">
                                                <span className="text-muted-foreground">{fmtDate(r.redemption_date)}</span>
                                                <span className="font-semibold text-foreground tabular-nums">{fmtEUR(r.amount)}</span>
                                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                                    {r.reference ? `Re.-Nr. ${r.reference}` : '—'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Button className="w-full" onClick={onClose}>Schließen</Button>
                        </>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-3">
                            {redeemedBy && (
                                <p className="text-[11px] text-muted-foreground">
                                    Eingelöst von: <span className="font-medium text-foreground">{redeemedBy}</span>
                                </p>
                            )}
                            <label className="space-y-1 block">
                                <span className="text-[11px] font-medium text-muted-foreground">Betrag (€) *</span>
                                <Input type="number" step="0.01" min="0.01" max={remaining}
                                    inputMode="decimal" value={amount} autoFocus
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="h-12 text-lg font-semibold tabular-nums" />
                                <span className="text-[11px] text-muted-foreground block">{AMOUNT_HINT}</span>
                                {amount !== '' && !amountValid && (
                                    <span className="text-[11px] text-destructive">
                                        Betrag muss zwischen 0 und {fmtEUR(remaining)} liegen.
                                    </span>
                                )}
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-[11px] font-medium text-muted-foreground">Re.-Nr. vom Kassenbon *</span>
                                <Input type="text" inputMode="numeric" pattern="\d*" autoComplete="off"
                                    placeholder={RECEIPT_PLACEHOLDER}
                                    value={reference}
                                    onChange={(e) => setReference(sanitizeReceiptNumber(e.target.value))}
                                    className="h-12 text-lg font-semibold tabular-nums" />
                                <span className="text-[11px] text-muted-foreground">{RECEIPT_HINT}</span>
                                {reference !== '' && !referenceValid && (
                                    <span className="text-[11px] text-destructive block">{RECEIPT_INVALID_HINT}</span>
                                )}
                            </label>
                            {error && (
                                <p className="text-xs text-destructive flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5" />{error}
                                </p>
                            )}
                            <div className="flex gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                                <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                <p className="text-[11px] leading-snug text-muted-foreground">
                                    Erst in flatpay als Zahlart 'Gutschein' buchen, dann hier bestätigen.
                                </p>
                            </div>
                            <DialogFooter className="flex gap-2">
                                <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                                    Abbrechen
                                </Button>
                                <Button type="submit" disabled={!valid || pending}>
                                    {pending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                                    Einlösen
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}