/**
 * Gutscheine — kompletter Gutschein-Workflow.
 *
 * Verwaltung von Kassen-Gutscheinen: Anlegen, Einlösen (Teil-/Vollbetrag),
 * Status-Tracking und Einlösungs-Historie. Migration der Gastware-Kasse zu flatpay.
 *
 * Entities:
 *  - Voucher (Gutschein-Stammdaten)
 *  - VoucherRedemption (einzelne Einlösungen)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/components/auth/usePermissions';
import {
    generateVoucherAccessToken, isValidReceiptNumber, sanitizeReceiptNumber,
    RECEIPT_HINT, RECEIPT_PLACEHOLDER, RECEIPT_INVALID_HINT, AMOUNT_HINT,
} from '@/lib/vouchers';
import { createNotification } from '@/utils/createNotification';
import VoucherReceipt from '@/components/vouchers/VoucherReceipt';
import VoucherRedeemView from '@/components/vouchers/VoucherRedeemView';
import { useNavigate } from 'react-router-dom';
import {
    Ticket, Plus, Loader2, X, AlertTriangle, CheckCircle2,
    ChevronDown, ChevronUp, History, Euro, Printer, FileText
} from 'lucide-react';

const fmtEUR = (n) => (n ?? 0).toLocaleString('de-DE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2
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
const PAYMENT_LABEL = {
    'bar': 'Bar',
    'ec': 'EC',
    'ueberweisung': 'Überweisung',
    'bar_ec': 'Bar/EC',
    'rabatt_ueberweisung': 'Rabatt/Überw.',
};

const FILTERS = [
    { key: 'offen', label: 'Offen', match: (v) => v.status === 'offen' || v.status === 'teilweise_eingelöst' },
    { key: 'eingelöst', label: 'Eingelöst', match: (v) => v.status === 'eingelöst' || v.status === 'ungültig' },
    { key: 'alle', label: 'Alle', match: () => true },
];

export default function Vouchers() {
    const queryClient = useQueryClient();
    const permissions = usePermissions();
    const [receiptVoucher, setReceiptVoucher] = useState(null);   // 80mm-Beleg
    const navigate = useNavigate();
    const [filter, setFilter] = useState('offen');
    const [search, setSearch] = useState('');
    const [redeemVoucher, setRedeemVoucher] = useState(null);   // Voucher-Objekt oder null
    const [showCreate, setShowCreate] = useState(false);
    const [detailId, setDetailId] = useState(null);            // expandierte Zeile
    const [currentUser, setCurrentUser] = useState(null);

    // ── Current User (für redeemed_by_name) ──────────────────────────────
    useEffect(() => {
        base44.auth.me().then(setCurrentUser).catch(() => {});
    }, []);

    // ── Queries ──────────────────────────────────────────────────────────
    const { data: vouchers = [], isLoading } = useQuery({
        queryKey: ['vouchers'],
        queryFn: () => base44.entities.Voucher.list('-issue_date', 500),
        placeholderData: [],
        staleTime: 30 * 1000,
    });

    const { data: redemptions = [] } = useQuery({
        queryKey: ['voucher-redemptions'],
        queryFn: () => base44.entities.VoucherRedemption.list('-redemption_date', 1000),
        placeholderData: [],
        staleTime: 30 * 1000,
    });

    // ── KPIs ─────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const openVouchers = vouchers.filter(v => v.status === 'offen' || v.status === 'teilweise_eingelöst');
        const openCount = openVouchers.length;
        const liability = openVouchers.reduce((s, v) => s + (v.remaining_value || 0), 0);
        const redeemedTotal = redemptions.reduce((s, r) => s + (r.amount || 0), 0);
        return { openCount, liability, redeemedTotal };
    }, [vouchers, redemptions]);

    // ── Gefilterte Liste ─────────────────────────────────────────────────
    const filtered = useMemo(() => {
        const activeFilter = FILTERS.find(f => f.key === filter) || FILTERS[0];
        let list = vouchers.filter(activeFilter.match);
        if (search.trim()) {
            const q = search.trim();
            list = list.filter(v => String(v.voucher_number).includes(q));
        }
        return list;
    }, [vouchers, filter, search]);

    // ── Einlösungs-Historie pro Gutschein ────────────────────────────────
    const redemptionsFor = useMemo(() => {
        const map = new Map();
        for (const r of redemptions) {
            if (!map.has(r.voucher_id)) map.set(r.voucher_id, []);
            map.get(r.voucher_id).push(r);
        }
        for (const [, list] of map) {
            list.sort((a, b) => (b.redemption_date || '').localeCompare(a.redemption_date || ''));
        }
        return map;
    }, [redemptions]);

    // ── Mutations ────────────────────────────────────────────────────────
    const redeemMutation = useMutation({
        mutationFn: async ({ voucher, amount, reference, redeemedBy }) => {
            const redemption = await base44.entities.VoucherRedemption.create({
                voucher_id: voucher.id,
                redemption_date: new Date().toISOString().slice(0, 10),
                amount: parseFloat(amount),
                redeemed_by_name: redeemedBy,
                reference: reference || null,
            });
            const newRemaining = Math.round(((voucher.remaining_value || 0) - parseFloat(amount)) * 100) / 100;
            const newStatus = newRemaining <= 0 ? 'eingelöst' : 'teilweise_eingelöst';
            await base44.entities.Voucher.update(voucher.id, {
                remaining_value: newRemaining,
                status: newStatus,
            });
            return { redemption, newRemaining, newStatus };
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['vouchers'] });
            queryClient.invalidateQueries({ queryKey: ['voucher-redemptions'] });
            // Modal bleibt offen und zeigt die erfasste Re.-Nr. zum Gegenprüfen
            // Manager/Admin sehen jede Einlösung in der Benachrichtigungs-Liste
            createNotification({
                type: 'general',
                category: 'admin',
                title: '🎟️ Gutschein eingelöst',
                message: `${variables.redeemedBy || 'Mitarbeiter'} hat Gutschein Nr. ${variables.voucher.voucher_number} `
                    + `über ${fmtEUR(variables.amount)} eingelöst (Rest: ${fmtEUR(data?.newRemaining ?? 0)}) `
                    + `· Re.-Nr. ${variables.reference}`,
                relatedId: variables.voucher.id,
            }).catch(() => {});
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data) => {
            return await base44.entities.Voucher.create({
                voucher_number: parseInt(data.voucher_number, 10),
                access_token: generateVoucherAccessToken(),
                holder_name: data.holder_name?.trim() || null,
                issue_date: data.issue_date,
                original_value: parseFloat(data.original_value),
                remaining_value: parseFloat(data.original_value),
                payment_method: data.payment_method || null,
                status: 'offen',
                source: 'manual',
                notes: data.notes || null,
            });
        },
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: ['vouchers'] });
            setShowCreate(false);
            setReceiptVoucher(created);   // Tresen-Workflow: Beleg direkt drucken
        },
    });

    // ── Auto-Vorschlag Gutscheinnummer ───────────────────────────────────
    const nextVoucherNumber = useMemo(() => {
        if (!vouchers.length) return 1;
        return Math.max(...vouchers.map(v => v.voucher_number || 0)) + 1;
    }, [vouchers]);

    if (isLoading || permissions.isLoading) {
        return (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade Gutscheine …
            </div>
        );
    }

    // Nicht-Manager (Aushilfe, Barkeeper, Vollzeit, Orga): nur Einlöse-Ansicht
    if (!permissions.isManager) {
        return (
            <VoucherRedeemView
                vouchers={vouchers}
                currentUser={currentUser}
                isPending={redeemMutation.isPending}
                onRedeem={(payload) => redeemMutation.mutateAsync(payload)}
            />
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                        <Ticket className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                        Gutscheine
                    </h1>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                        {vouchers.length} Gutscheine · {kpis.openCount} offen
                    </p>
                </div>
                <Button size="sm" onClick={() => setShowCreate(true)} className="shrink-0">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Neuer Gutschein
                </Button>
            </div>

            {/* ── KPI-Karten ── */}
            <div className="grid grid-cols-3 gap-2.5">
                <Card className="p-3.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Offen</p>
                    <p className="text-lg font-bold text-foreground mt-1">{kpis.openCount}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Gutscheine</p>
                </Card>
                <Card className="p-3.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Eingelöst gesamt</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">{fmtEUR(kpis.redeemedTotal)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">alle Einlösungen</p>
                </Card>
                <Card className="p-3.5 border-amber-500/30 bg-amber-500/5">
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Verbindlichkeit</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">{fmtEUR(kpis.liability)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">offene Restwerte</p>
                </Card>
            </div>

            {/* ── Filter + Suche ── */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 p-1 bg-muted/50 rounded-xl">
                    {FILTERS.map(f => (
                        <button key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                filter === f.key
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 min-w-[140px]">
                    <Input type="text" inputMode="numeric"
                        placeholder="Nr. suchen"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="h-9 pl-3 pr-8" />
                    {search && (
                        <button onClick={() => setSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Liste ── */}
            {filtered.length === 0 ? (
                <Card className="p-8 text-center">
                    <Ticket className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Keine Gutscheine in diesem Filter.</p>
                </Card>
            ) : (
                <div className="space-y-2">
                    {filtered.map(v => {
                        const isExpanded = detailId === v.id;
                        const history = redemptionsFor.get(v.id) || [];
                        const canRedeem = v.status === 'offen' || v.status === 'teilweise_eingelöst';
                        return (
                            <Card key={v.id} className="overflow-hidden">
                                {/* Zeile */}
                                <div className="p-3.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <button
                                            onClick={() => setDetailId(isExpanded ? null : v.id)}
                                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-foreground tabular-nums">
                                                    Nr. {v.voucher_number}
                                                    {v.holder_name && <span className="font-normal text-muted-foreground"> · {v.holder_name}</span>}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground">{fmtDate(v.issue_date)}</span>
                                            </div>
                                        </button>
                                        <div className="flex items-center gap-2.5">
                                            <div className="text-right">
                                                <p className="text-[11px] text-muted-foreground">
                                                    {fmtEUR(v.original_value)} → <span className="font-semibold text-foreground">{fmtEUR(v.remaining_value)}</span>
                                                </p>
                                            </div>
                                            <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', STATUS_STYLES[v.status])}>
                                                {STATUS_LABEL[v.status] || v.status}
                                            </Badge>
                                            <button
                                                onClick={() => setReceiptVoucher(v)}
                                                title="Beleg drucken"
                                                className="text-muted-foreground hover:text-foreground p-0.5"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </button>
                                            {v.holder_name && v.status !== 'eingelöst' && (
                                                <button
                                                    onClick={() => navigate(`/ExternalBusiness?new_invoice_voucher=${v.id}`)}
                                                    title="Rechnung für Kauf auf Rechnung erstellen"
                                                    className="text-muted-foreground hover:text-foreground p-0.5"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setDetailId(isExpanded ? null : v.id)}
                                                className="text-muted-foreground hover:text-foreground p-0.5"
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    {v.payment_method && (
                                        <span className="inline-block text-[10px] text-muted-foreground bg-muted/40 border border-border/50 rounded px-1.5 py-0.5 mt-1.5">
                                            {PAYMENT_LABEL[v.payment_method] || v.payment_method}
                                        </span>
                                    )}
                                    {canRedeem && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="w-full mt-2.5 h-8"
                                            onClick={() => setRedeemVoucher(v)}
                                        >
                                            <Euro className="w-3.5 h-3.5 mr-1.5" />
                                            Einlösen
                                        </Button>
                                    )}
                                </div>
                                {/* Detail (expandiert) */}
                                {isExpanded && (
                                    <div className="border-t border-border/50 px-3.5 py-3 bg-muted/20">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <History className="w-3 h-3" />
                                            Einlösungs-Historie ({history.length})
                                        </p>
                                        {history.length === 0 ? (
                                            <p className="text-xs text-muted-foreground py-1">Noch keine Einlösungen.</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {history.map((r, i) => (
                                                    <div key={r.id || i} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-foreground">{fmtEUR(r.amount)}</p>
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {fmtDate(r.redemption_date)}
                                                                {r.redeemed_by_name ? ` · ${r.redeemed_by_name}` : ''}
                                                                {r.reference ? ` · Ref: ${r.reference}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {v.notes && (
                                            <p className="text-[11px] text-muted-foreground mt-2.5 pt-2 border-t border-border/30">
                                                Notiz: {v.notes}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ── Einlösen-Modal ── */}
            {redeemVoucher && (
                <RedeemModal
                    voucher={redeemVoucher}
                    currentUser={currentUser}
                    isPending={redeemMutation.isPending}
                    error={redeemMutation.error}
                    onClose={() => setRedeemVoucher(null)}
                    onSubmit={(amount, reference, redeemedBy) =>
                        redeemMutation.mutateAsync({ voucher: redeemVoucher, amount, reference, redeemedBy })
                    }
                />
            )}

            {/* ── Neuer-Gutschein-Modal ── */}
            {showCreate && (
                <CreateModal
                    nextNumber={nextVoucherNumber}
                    isPending={createMutation.isPending}
                    error={createMutation.error}
                    onClose={() => setShowCreate(false)}
                    onSubmit={(data) => createMutation.mutate(data)}
                />
            )}

            {/* ── 80mm-Beleg zum Drucken ── */}
            {receiptVoucher && (
                <VoucherReceipt
                    voucher={receiptVoucher}
                    onClose={() => setReceiptVoucher(null)}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Einlösen-Modal
// ═══════════════════════════════════════════════════════════════════════════
function RedeemModal({ voucher, currentUser, isPending, error, onClose, onSubmit }) {
    const [amount, setAmount] = useState(String(voucher.remaining_value || 0));
    const [reference, setReference] = useState('');
    const [done, setDone] = useState(null);
    const redeemedBy = currentUser?.full_name || currentUser?.email || '';

    const amt = parseFloat(amount);
    const remaining = voucher.remaining_value || 0;
    const amountValid = !isNaN(amt) && amt > 0 && amt <= remaining;
    const referenceValid = isValidReceiptNumber(reference);
    const valid = amountValid && referenceValid;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!valid) return;
        try {
            const res = await onSubmit(amt, reference.trim(), redeemedBy);
            setDone({ reference: reference.trim(), newRemaining: res?.newRemaining ?? 0 });
        } catch {
            // Fehler wird über die error-Prop angezeigt
        }
    };

    // ── Erfolg: Re.-Nr. bleibt zum Gegenprüfen am Bon stehen ─────────────
    if (done) {
        return (
            <Dialog open onOpenChange={onClose}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            Gutschein Nr. {voucher.voucher_number} eingelöst
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Fertig! Rest der Rechnung ist beglichen. Neuer Gutschein-Restwert:{' '}
                            <span className="font-semibold text-foreground">{fmtEUR(done.newRemaining)}</span>.
                            Der Gast sieht den Restwert jederzeit über den QR-Code.
                        </p>
                        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-center">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Am Kassenbon gegenprüfen</p>
                            <p className="text-lg font-bold text-foreground mt-1 tabular-nums">Re.-Nr. {done.reference} erfasst</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 px-4 py-3 text-center">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Neuer Restwert</p>
                            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{fmtEUR(done.newRemaining)}</p>
                        </div>
                        <Button className="w-full" onClick={onClose} disabled={isPending}>
                            Fertig
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Euro className="w-4 h-4 text-primary" />
                        Gutschein Nr. {voucher.voucher_number} einlösen
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                        <span>Restwert</span>
                        <span className="font-bold text-foreground text-sm">{fmtEUR(remaining)}</span>
                    </div>
                    {redeemedBy && (
                        <p className="text-[11px] text-muted-foreground">
                            Eingelöst von: <span className="font-medium text-foreground">{redeemedBy}</span>
                        </p>
                    )}
                    <label className="space-y-1 block">
                        <span className="text-[11px] font-medium text-muted-foreground">Betrag (€) *</span>
                        <Input type="number" step="0.01" min="0.01" max={remaining}
                            inputMode="decimal" value={amount}
                            onChange={e => setAmount(e.target.value)} autoFocus />
                        <span className="text-[11px] text-muted-foreground block">{AMOUNT_HINT}</span>
                        {!amountValid && amount !== '' && (
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
                            onChange={e => setReference(sanitizeReceiptNumber(e.target.value))} />
                        <span className="text-[11px] text-muted-foreground">{RECEIPT_HINT}</span>
                        {reference !== '' && !referenceValid && (
                            <span className="text-[11px] text-destructive block">{RECEIPT_INVALID_HINT}</span>
                        )}
                    </label>
                    {error && (
                        <p className="text-xs text-destructive flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />{String(error.message || error)}
                        </p>
                    )}
                    <DialogFooter className="flex gap-2">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
                            Abbrechen
                        </Button>
                        <Button type="submit" disabled={!valid || isPending}>
                            {isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                            Einlösen
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Neuer-Gutschein-Modal
// ═══════════════════════════════════════════════════════════════════════════
function CreateModal({ nextNumber, isPending, error, onClose, onSubmit }) {
    const today = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({
        voucher_number: String(nextNumber),
        issue_date: today,
        original_value: '',
        payment_method: 'bar',
        notes: '',
        holder_name: '',
    });

    const value = parseFloat(form.original_value);
    const valid = !isNaN(value) && value > 0 && form.issue_date && form.voucher_number;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit(form);
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="w-4 h-4 text-primary" />
                        Neuer Gutschein
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                        <label className="space-y-1 block">
                            <span className="text-[11px] font-medium text-muted-foreground">Gutscheinnr. *</span>
                            <Input type="number" min="1" value={form.voucher_number}
                                onChange={e => setForm(f => ({ ...f, voucher_number: e.target.value }))} />
                        </label>
                        <label className="space-y-1 block">
                            <span className="text-[11px] font-medium text-muted-foreground">Datum *</span>
                            <Input type="date" value={form.issue_date}
                                onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
                        </label>
                    </div>
                    <label className="space-y-1 block">
                        <span className="text-[11px] font-medium text-muted-foreground">Wert (€) *</span>
                        <Input type="number" step="0.01" min="0.01" inputMode="decimal"
                            placeholder="z. B. 50,00"
                            value={form.original_value}
                            onChange={e => setForm(f => ({ ...f, original_value: e.target.value }))} autoFocus />
                    </label>
                    <div className="flex gap-1 p-1 bg-muted/50 rounded-xl">
                        {[{ k: 'bar', l: 'Bar' }, { k: 'ec', l: 'EC' }].map(o => (
                            <button key={o.k} type="button"
                                onClick={() => setForm(f => ({ ...f, payment_method: o.k }))}
                                className={cn(
                                    'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                    form.payment_method === o.k
                                        ? 'bg-card text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}>
                                {o.l}
                            </button>
                        ))}
                    </div>
                    <label className="space-y-1 block">
                        <span className="text-[11px] font-medium text-muted-foreground">Inhaber / Käufer (optional)</span>
                        <Input type="text" placeholder="z. B. Firma Müller oder bei Wert ab 100 €"
                            value={form.holder_name}
                            onChange={e => setForm(f => ({ ...f, holder_name: e.target.value }))} />
                        <span className="text-[11px] text-muted-foreground">
                            Empfohlen ab 100 € und bei Kauf auf Rechnung — schützt bei Verlust.
                        </span>
                    </label>
                    <label className="space-y-1 block">
                        <span className="text-[11px] font-medium text-muted-foreground">Notiz (optional)</span>
                        <Input type="text" placeholder="z. B. Anlass"
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </label>
                    {error && (
                        <p className="text-xs text-destructive flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />{String(error.message || error)}
                        </p>
                    )}
                    <DialogFooter className="flex gap-2">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
                            Abbrechen
                        </Button>
                        <Button type="submit" disabled={!valid || isPending}>
                            {isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                            Anlegen
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}