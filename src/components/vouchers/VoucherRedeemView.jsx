/**
 * VoucherRedeemView — Team-Ansicht zum Einlösen (Nicht-Manager).
 *
 * Ablauf: Nummer eingeben → Gutschein-Karte → Betrag (Default = Restwert) →
 * Bestätigen → Erfolg mit neuem Restwert.
 */
import React, { useState, useEffect, useRef } from 'react';
import BarcodeScanner from '@/components/restock/BarcodeScanner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    isValidReceiptNumber, sanitizeReceiptNumber, parseVoucherQr,
    RECEIPT_HINT, RECEIPT_PLACEHOLDER, RECEIPT_INVALID_HINT,
} from '@/lib/vouchers';
import {
    Ticket, Search, Loader2, CheckCircle2, AlertTriangle, Euro, ArrowLeft, QrCode,
} from 'lucide-react';

const fmtEUR = (n) => (n ?? 0).toLocaleString('de-DE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const fmtDate = (d) => d ? d.slice(0, 10).split('-').reverse().join('.') : '—';

const STATUS_STYLES = {
    'offen': 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    'teilweise_eingelöst': 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
    'eingelöst': 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
    'ungültig': 'bg-muted text-muted-foreground border-border',
};
const STATUS_LABEL = {
    'offen': 'Offen',
    'teilweise_eingelöst': 'Teilweise',
    'eingelöst': 'Eingelöst',
    'ungültig': 'Ungültig',
};

export default function VoucherRedeemView({ vouchers = [], currentUser, isPending, onRedeem }) {
    const [query, setQuery] = useState('');
    const [voucher, setVoucher] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [amount, setAmount] = useState('');
    const [reference, setReference] = useState('');
    const [done, setDone] = useState(null);
    const [errorText, setErrorText] = useState(null);
    const [scanOpen, setScanOpen] = useState(false);
    const [scanWarning, setScanWarning] = useState(null);
    const [focusAmount, setFocusAmount] = useState(false);
    const amountRef = useRef(null);

    const redeemedBy = currentUser?.full_name || currentUser?.email || '';

    const reset = () => {
        setQuery(''); setVoucher(null); setNotFound(false);
        setAmount(''); setReference(''); setDone(null); setErrorText(null);
        setScanWarning(null);
    };

    // Nach erfolgreichem Scan direkt zur Betrags-Eingabe
    useEffect(() => {
        if (!focusAmount || !voucher) return;
        amountRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        amountRef.current?.focus();
        setFocusAmount(false);
    }, [focusAmount, voucher]);

    /** Übernimmt eine gefundene Nummer — gleicher Weg für Tippen und Scan. */
    const applyVoucher = ({ num, displayNr, token = null, fromScan = false }) => {
        const hit = isNaN(num) ? null : vouchers.find(v => Number(v.voucher_number) === num) || null;
        if (displayNr != null) setQuery(displayNr);
        setVoucher(hit);
        setNotFound(!hit);
        setAmount(hit ? String(hit.remaining_value ?? '') : '');
        setReference('');
        setErrorText(null);
        setDone(null);
        const mismatch = !!(hit && token && hit.access_token
            && String(hit.access_token).toUpperCase() !== String(token).toUpperCase());
        setScanWarning(mismatch ? 'QR-Code passt nicht zu diesem Gutschein' : null);
        if (hit && fromScan) setFocusAmount(true);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyVoucher({ num: parseInt(String(query).trim(), 10) });
    };

    const handleScan = (decodedText) => {
        const { nr, token } = parseVoucherQr(decodedText);
        applyVoucher({
            num: parseInt(String(nr ?? '').trim(), 10),
            displayNr: nr ?? '',
            token,
            fromScan: true,
        });
    };

    const remaining = voucher?.remaining_value ?? 0;
    const redeemable = !!voucher
        && (voucher.status === 'offen' || voucher.status === 'teilweise_eingelöst')
        && remaining > 0;
    const amt = parseFloat(amount);
    const amountValid = !isNaN(amt) && amt > 0 && amt <= remaining;
    const referenceValid = isValidReceiptNumber(reference);
    const valid = redeemable && amountValid && referenceValid;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!valid) return;
        setErrorText(null);
        try {
            const res = await onRedeem({ voucher, amount: amt, reference: reference.trim(), redeemedBy });
            setDone({ voucher, newRemaining: res?.newRemaining ?? 0, reference: reference.trim() });
        } catch (err) {
            setErrorText(String(err?.message || err));
        }
    };

    // ── Erfolg ────────────────────────────────────────────────────────────
    if (done) {
        return (
            <div className="p-4 md:p-6 max-w-md mx-auto space-y-4">
                <Card className="p-6 text-center space-y-3">
                    <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
                    <h1 className="text-xl font-bold text-foreground">Eingelöst</h1>
                    <p className="text-sm text-muted-foreground">
                        Gutschein Nr. <span className="font-semibold text-foreground">{done.voucher.voucher_number}</span>
                    </p>
                    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Am Kassenbon gegenprüfen</p>
                        <p className="text-lg font-bold text-foreground mt-1 tabular-nums">Re.-Nr. {done.reference} erfasst</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 px-4 py-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Neuer Restwert</p>
                        <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{fmtEUR(done.newRemaining)}</p>
                    </div>
                    <Button className="w-full" onClick={reset}>
                        <ArrowLeft className="w-4 h-4 mr-1.5" />
                        Zurück
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-md mx-auto space-y-4">
            <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                    <Ticket className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    Gutschein einlösen
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                    Nummer eingeben und Betrag bestätigen
                </p>
            </div>

            {/* ── Suche ── */}
            <Card className="p-4">
                {/* Mobile: QR-Button in Vollbreite über dem manuellen Feld */}
                <Button type="button" onClick={() => setScanOpen(true)} className="w-full h-12 mb-2.5 md:hidden">
                    <QrCode className="w-4 h-4 mr-1.5" />
                    QR scannen
                </Button>
                <form onSubmit={handleSearch} className="space-y-2.5">
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            inputMode="numeric"
                            autoFocus
                            placeholder="Gutschein-Nummer"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="h-14 flex-1 text-center text-2xl font-bold tabular-nums tracking-wider"
                        />
                        <Button type="button" onClick={() => setScanOpen(true)} className="hidden md:flex h-14 px-5 shrink-0">
                            <QrCode className="w-4 h-4 mr-1.5" />
                            QR scannen
                        </Button>
                    </div>
                    <Button type="submit" className="w-full h-11" disabled={!String(query).trim()}>
                        <Search className="w-4 h-4 mr-1.5" />
                        Suchen
                    </Button>
                    {scanWarning && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 justify-center pt-0.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {scanWarning}
                        </p>
                    )}
                    {notFound && (
                        <p className="text-xs text-destructive flex items-center gap-1.5 justify-center pt-0.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Nummer nicht gefunden
                        </p>
                    )}
                </form>
            </Card>

            {/* ── Gutschein-Karte ── */}
            {voucher && (
                <Card className={cn('p-4 space-y-3', !redeemable && 'border-destructive/40')}>
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-lg font-bold text-foreground tabular-nums">
                                Nr. {voucher.voucher_number}
                            </p>
                            {voucher.holder_name && (
                                <p className="text-[11px] text-muted-foreground">Inhaber: {voucher.holder_name}</p>
                            )}
                            <p className="text-[11px] text-muted-foreground">{fmtDate(voucher.issue_date)}</p>
                        </div>
                        <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', STATUS_STYLES[voucher.status])}>
                            {STATUS_LABEL[voucher.status] || voucher.status}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-lg bg-muted/40 px-3 py-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Original</p>
                            <p className="text-base font-semibold text-foreground mt-0.5 tabular-nums">{fmtEUR(voucher.original_value)}</p>
                        </div>
                        <div className="rounded-lg bg-primary/10 px-3 py-2">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Restwert</p>
                            <p className="text-base font-bold text-foreground mt-0.5 tabular-nums">{fmtEUR(remaining)}</p>
                        </div>
                    </div>

                    {!redeemable ? (
                        <p className="text-xs text-destructive flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Gutschein bereits vollständig eingelöst
                        </p>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-3">
                            {redeemedBy && (
                                <p className="text-[11px] text-muted-foreground">
                                    Eingelöst von: <span className="font-medium text-foreground">{redeemedBy}</span>
                                </p>
                            )}
                            <label className="space-y-1 block">
                                <span className="text-[11px] font-medium text-muted-foreground">Betrag (€) *</span>
                                <Input
                                    ref={amountRef}
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={remaining}
                                    inputMode="decimal"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="h-12 text-lg font-semibold tabular-nums"
                                />
                                {amount !== '' && !amountValid && (
                                    <span className="text-[11px] text-destructive">
                                        Betrag muss zwischen 0 und {fmtEUR(remaining)} liegen.
                                    </span>
                                )}
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-[11px] font-medium text-muted-foreground">Re.-Nr. vom Kassenbon *</span>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="\d*"
                                    autoComplete="off"
                                    placeholder={RECEIPT_PLACEHOLDER}
                                    value={reference}
                                    onChange={(e) => setReference(sanitizeReceiptNumber(e.target.value))}
                                    className="h-12 text-lg font-semibold tabular-nums"
                                />
                                <span className="text-[11px] text-muted-foreground">{RECEIPT_HINT}</span>
                                {reference !== '' && !referenceValid && (
                                    <span className="text-[11px] text-destructive block">{RECEIPT_INVALID_HINT}</span>
                                )}
                            </label>
                            {errorText && (
                                <p className="text-xs text-destructive flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5" />{errorText}
                                </p>
                            )}
                            <Button type="submit" className="w-full h-11" disabled={!valid || isPending}>
                                {isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Euro className="w-4 h-4 mr-1.5" />}
                                Einlösen
                            </Button>
                        </form>
                    )}

                    <Button variant="secondary" className="w-full h-9" onClick={reset}>
                        <ArrowLeft className="w-4 h-4 mr-1.5" />
                        Zurück
                    </Button>
                </Card>
            )}

            <BarcodeScanner
                open={scanOpen}
                onClose={() => setScanOpen(false)}
                onScan={handleScan}
                title="Gutschein-QR scannen"
                hint="QR auf Beleg oder Handy-Karte scannen"
            />
        </div>
    );
}