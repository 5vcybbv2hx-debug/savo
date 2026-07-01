/**
 * Verbindlichkeiten — offene Posten & Schulden verwalten
 *
 * v2 Verbesserungen:
 *  - Status als einziger primärer Filter (kein Woche/Monat-Tab)
 *  - Kompakte Karten — Details per Tap auf Karte
 *  - Formular auf Kern-Felder reduziert, Rest aufklappbar
 *  - KI-Block entfernt
 *  - Kein FAB — ein Button im Header
 *  - Bezahlen-Dialog bleibt (mit Zahlungsart + Datum)
 *  - AlertDialog für Löschen
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
    Plus, TrendingDown, AlertTriangle, CheckCircle2,
    Clock, Trash2, X, ChevronDown, CreditCard,
    ListChecks
} from 'lucide-react';
import { format, isAfter, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Konstanten ────────────────────────────────────────────────────────────────
const fmt = n => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_CFG = {
    offen:        { label: 'Offen',        color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   dot: 'bg-blue-400',   icon: Clock         },
    teilbezahlt:  { label: 'Teilbezahlt',  color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  dot: 'bg-amber-400',  icon: AlertTriangle  },
    ratenzahlung: { label: 'Ratenzahlung', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-400', icon: ListChecks     },
    ueberfaellig: { label: 'Überfällig',   color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    dot: 'bg-red-500',    icon: AlertTriangle  },
    bezahlt:      { label: 'Bezahlt',      color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  dot: 'bg-green-400',  icon: CheckCircle2   },
    gestundet:    { label: 'Gestundet',    color: 'text-muted-foreground', bg: 'bg-secondary/50', border: 'border-border', dot: 'bg-muted-foreground', icon: Clock },
};

const PRIORITY_CFG = {
    niedrig:  { label: 'Niedrig',  color: 'text-muted-foreground' },
    mittel:   { label: 'Mittel',   color: 'text-amber-400'        },
    hoch:     { label: 'Hoch',     color: 'text-orange-400'       },
    kritisch: { label: 'Kritisch', color: 'text-red-400'          },
};

const CATEGORIES   = ['Lieferant', 'Finanzamt', 'Sozialversicherung', 'Bank/Darlehen', 'Leasing', 'Sonstiges'];
const PAY_METHODS  = ['Überweisung', 'Lastschrift', 'Bar', 'EC', 'Sonstiges'];
const CONTRACT_TYPES = ['Einmalrechnung', 'Dauervertrag', 'Darlehen', 'Leasing', 'Sonstiges'];
const TAX_TREATMENTS = ['Betriebsausgabe', 'Nicht abzugsfähig', 'Gemischt', 'Privatanteil'];

const EMPTY_FORM = {
    // Kern
    title: '', creditor_name: '', category: '', original_amount: '',
    paid_amount: 0, due_date: '', start_date: format(new Date(), 'yyyy-MM-dd'),
    status: 'offen', priority: 'mittel',
    // Ratenzahlung
    payment_plan_enabled: false, installment_amount: '',
    installment_interval: 'monatlich', next_payment_date: '',
    // Erweitert
    dunning_level: 0, customer_number: '', contract_type: 'Einmalrechnung',
    contract_number: '', contact_person: '', contact_phone: '',
    late_payment_fee: '', default_interest_rate: '',
    tax_treatment: 'Betriebsausgabe', notes: '',
};

const EMPTY_PAYMENT = {
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    amount: '', payment_method: 'Überweisung', reference: '',
};

// ── Verbindlichkeits-Formular ─────────────────────────────────────────────────
function LiabilityForm({ data, onChange }) {
    const [showAdvanced, setShowAdvanced] = useState(
        !!(data.customer_number || data.contract_number || data.contact_person)
    );

    return (
        <div className="space-y-3">
            {/* Kern */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Bezeichnung *</Label>
                <Input value={data.title || ''}
                    onChange={e => onChange({ ...data, title: e.target.value })}
                    placeholder="z.B. Lieferantenrechnung Metro, USt-Vorauszahlung…"
                    className="h-10" />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Gläubiger</Label>
                    <Input value={data.creditor_name || ''}
                        onChange={e => onChange({ ...data, creditor_name: e.target.value })}
                        placeholder="Wer wird bezahlt?" className="h-10" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Kategorie</Label>
                    <Select value={data.category || ''}
                        onValueChange={v => onChange({ ...data, category: v })}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Wählen…" /></SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Betrag (€) *</Label>
                    <Input type="number" step="0.01" placeholder="0,00"
                        value={data.original_amount || ''}
                        onChange={e => onChange({ ...data, original_amount: e.target.value })}
                        className="h-10" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Fällig am</Label>
                    <Input type="date" value={data.due_date || ''}
                        onChange={e => onChange({ ...data, due_date: e.target.value })}
                        className="h-10" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={data.status || 'offen'}
                        onValueChange={v => onChange({ ...data, status: v })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {Object.entries(STATUS_CFG).map(([k, v]) =>
                                <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Priorität</Label>
                    <Select value={data.priority || 'mittel'}
                        onValueChange={v => onChange({ ...data, priority: v })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {Object.entries(PRIORITY_CFG).map(([k, v]) =>
                                <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Ratenzahlung */}
            <div className="border border-border/50 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-secondary/20">
                    <span className="text-sm font-semibold text-foreground">Ratenzahlung</span>
                    <Switch checked={!!data.payment_plan_enabled}
                        onCheckedChange={v => onChange({ ...data, payment_plan_enabled: v })} />
                </div>
                {data.payment_plan_enabled && (
                    <div className="px-4 pb-4 pt-3 space-y-3 border-t border-border/40">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Rate (€)</Label>
                                <Input type="number" step="0.01"
                                    value={data.installment_amount || ''}
                                    onChange={e => onChange({ ...data, installment_amount: e.target.value })}
                                    className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Intervall</Label>
                                <Select value={data.installment_interval || 'monatlich'}
                                    onValueChange={v => onChange({ ...data, installment_interval: v })}>
                                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {['monatlich', 'wöchentlich', 'quartalsweise'].map(i =>
                                            <SelectItem key={i} value={i}>{i}</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Nächste Zahlung</Label>
                            <Input type="date" value={data.next_payment_date || ''}
                                onChange={e => onChange({ ...data, next_payment_date: e.target.value })}
                                className="h-9 text-sm" />
                        </div>
                    </div>
                )}
            </div>

            {/* Erweitert */}
            <div className="border border-border/50 rounded-xl overflow-hidden">
                <button type="button"
                    onClick={() => setShowAdvanced(s => !s)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-secondary/20 hover:bg-accent/20 transition-all">
                    <span className="text-sm font-semibold text-foreground">Erweitert</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Mahnung, Kontakt, Vertrag</span>
                        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', showAdvanced && 'rotate-180')} />
                    </div>
                </button>
                {showAdvanced && (
                    <div className="px-4 pb-4 pt-3 space-y-3 border-t border-border/40">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Mahnstufe</Label>
                                <Select value={String(data.dunning_level ?? 0)}
                                    onValueChange={v => onChange({ ...data, dunning_level: Number(v) })}>
                                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {[0,1,2,3].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? 'Keine' : `Mahnung ${n}`}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Kundennummer</Label>
                                <Input value={data.customer_number || ''}
                                    onChange={e => onChange({ ...data, customer_number: e.target.value })}
                                    placeholder="KD-Nr." className="h-9 text-sm" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Vertragsart</Label>
                                <Select value={data.contract_type || 'Einmalrechnung'}
                                    onValueChange={v => onChange({ ...data, contract_type: v })}>
                                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CONTRACT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Vertragsnummer</Label>
                                <Input value={data.contract_number || ''}
                                    onChange={e => onChange({ ...data, contract_number: e.target.value })}
                                    placeholder="V-2024-001" className="h-9 text-sm" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Ansprechpartner</Label>
                                <Input value={data.contact_person || ''}
                                    onChange={e => onChange({ ...data, contact_person: e.target.value })}
                                    placeholder="Name" className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Telefon</Label>
                                <Input value={data.contact_phone || ''}
                                    onChange={e => onChange({ ...data, contact_phone: e.target.value })}
                                    placeholder="030 …" className="h-9 text-sm" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Mahngebühren (€)</Label>
                                <Input type="number" step="0.01"
                                    value={data.late_payment_fee || ''}
                                    onChange={e => onChange({ ...data, late_payment_fee: e.target.value })}
                                    placeholder="0,00" className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Verzugszins (% p.a.)</Label>
                                <Input type="number" step="0.01"
                                    value={data.default_interest_rate || ''}
                                    onChange={e => onChange({ ...data, default_interest_rate: e.target.value })}
                                    placeholder="5,00" className="h-9 text-sm" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Steuerl. Behandlung</Label>
                            <Select value={data.tax_treatment || 'Betriebsausgabe'}
                                onValueChange={v => onChange({ ...data, tax_treatment: v })}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TAX_TREATMENTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Verbindlichkeits-Karte ────────────────────────────────────────────────────
function LiabilityCard({ liability, payments, onEdit, onPay }) {
    const cfg      = STATUS_CFG[liability.status] || STATUS_CFG.offen;
    const priCfg   = PRIORITY_CFG[liability.priority] || PRIORITY_CFG.mittel;
    const Icon     = cfg.icon;
    const remaining = (liability.original_amount || 0) - (liability.paid_amount || 0);
    const progress  = liability.original_amount > 0
        ? Math.round(((liability.paid_amount || 0) / liability.original_amount) * 100)
        : 0;
    const today = new Date();
    const daysUntilDue = liability.due_date
        ? differenceInDays(new Date(liability.due_date), today)
        : null;
    const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && liability.status !== 'bezahlt';
    const myPayments = payments.filter(p => p.liability_id === liability.id);

    return (
        <div onClick={onEdit}
            className={cn(
                'flex items-start gap-3 px-3.5 py-3 rounded-xl border border-border/50 bg-card hover:border-border cursor-pointer transition-all group',
                liability.status === 'bezahlt' && 'opacity-50',
                'min-h-[64px]'
            )}>

            {/* Status Icon */}
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                <Icon className={cn('w-4 h-4', cfg.color)} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{liability.title}</p>
                    {liability.dunning_level > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 shrink-0">
                            M{liability.dunning_level}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {liability.creditor_name && (
                        <p className="text-[11px] text-muted-foreground">{liability.creditor_name}</p>
                    )}
                    {liability.due_date && liability.status !== 'bezahlt' && (
                        <p className={cn('text-[11px] font-medium',
                            isOverdue ? 'text-red-400' :
                            daysUntilDue <= 7 ? 'text-amber-400' : 'text-muted-foreground'
                        )}>
                            {liability.creditor_name && '·'} {isOverdue
                                ? `${Math.abs(daysUntilDue)}d überfällig`
                                : daysUntilDue === 0 ? 'heute fällig'
                                : `fällig in ${daysUntilDue}d`
                            }
                        </p>
                    )}
                    {liability.priority !== 'mittel' && (
                        <p className={cn('text-[11px] font-semibold', priCfg.color)}>
                            · {priCfg.label}
                        </p>
                    )}
                </div>

                {/* Fortschrittsbalken bei Teilzahlung */}
                {liability.paid_amount > 0 && liability.original_amount > 0 && (
                    <div className="mt-2">
                        <Progress value={progress} className="h-1" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            {fmt(liability.paid_amount)} / {fmt(liability.original_amount)} € bezahlt
                        </p>
                    </div>
                )}

                {/* Ratenplan */}
                {liability.payment_plan_enabled && liability.installment_amount && (
                    <p className="text-[11px] text-purple-400 mt-1">
                        Rate: {fmt(liability.installment_amount)} € / {liability.installment_interval}
                        {liability.next_payment_date && ` · nächste: ${format(new Date(liability.next_payment_date), 'dd.MM.', { locale: de })}`}
                    </p>
                )}
            </div>

            {/* Betrag + Bezahlen */}
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <p className="text-sm font-bold text-foreground">{fmt(liability.original_amount)} €</p>
                {remaining > 0 && remaining < liability.original_amount && (
                    <p className="text-[10px] text-muted-foreground">Rest: {fmt(remaining)} €</p>
                )}
                {liability.status !== 'bezahlt' && (
                    <button onClick={e => { e.stopPropagation(); onPay(); }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-all min-h-[22px] whitespace-nowrap">
                        Zahlung ✓
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Hauptseite ────────────────────────────────────────────────────────────────
export default function AccountingLiabilities() {
    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const now = new Date();

    const [statusFilter,  setStatusFilter]  = useState('aktiv');
    const [searchOpen,    setSearchOpen]    = useState(false);
    const [search,        setSearch]        = useState('');
    const [modalOpen,     setModalOpen]     = useState(false);
    const [editOpen,      setEditOpen]      = useState(false);
    const [payOpen,       setPayOpen]       = useState(false);
    const [deleteTarget,  setDeleteTarget]  = useState(null);
    const [selected,      setSelected]      = useState(null);
    const [form,          setForm]          = useState(EMPTY_FORM);
    const [editData,      setEditData]      = useState({});
    const [payData,       setPayData]       = useState(EMPTY_PAYMENT);

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: liabilities = [] } = useQuery({
        queryKey: ['liabilities'],
        queryFn:  () => base44.entities.Liability.list('-due_date'),
    });

    const { data: payments = [] } = useQuery({
        queryKey: ['liability-payments'],
        queryFn:  () => base44.entities.LiabilityPayment.list('-payment_date'),
    });

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: d => base44.entities.Liability.create(d),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['liabilities'] });
            setModalOpen(false);
            setForm(EMPTY_FORM);
            toast.success('Verbindlichkeit erfasst');
        },
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Liability.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['liabilities'] });
            setEditOpen(false);
            toast.success('Gespeichert');
        },
        onError: () => toast.error('Fehler beim Aktualisieren'),
    });

    const deleteMutation = useMutation({
        mutationFn: id => base44.entities.Liability.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['liabilities'] });
            setDeleteTarget(null);
            setEditOpen(false);
            toast.success('Gelöscht');
        },
        onError: () => toast.error('Fehler beim Löschen'),
    });

    // Mapping auf die (etwas kleinere) Zahlungsart-Liste im Kassenbuch —
    // Lastschrift existiert dort nicht separat, ist aber wie Ueberweisung
    // ein Bankvorgang.
    const toCashbookPaymentMethod = pm =>
        pm === 'Lastschrift' ? 'Überweisung' : (pm || 'Überweisung');

    const paymentMutation = useMutation({
        mutationFn: async data => {
            const payment = await base44.entities.LiabilityPayment.create(data);
            const liability = liabilities.find(l => l.id === data.liability_id);
            if (liability) {
                const newPaid      = (liability.paid_amount || 0) + parseFloat(data.amount);
                const newRemaining = Math.max(0, (liability.original_amount || 0) - newPaid);
                const newStatus    = newRemaining <= 0 ? 'bezahlt' : newPaid > 0 ? 'teilbezahlt' : liability.status;
                await base44.entities.Liability.update(liability.id, {
                    paid_amount:      Math.round(newPaid * 100) / 100,
                    remaining_amount: Math.round(newRemaining * 100) / 100,
                    status:           newStatus,
                });
            }
            // Automatisch ins Kassenbuch buchen — sonst taucht die Zahlung
            // nie im DATEV-Export auf (der liest nur Belege + Kassenbuch).
            await base44.entities.CashbookEntry.create({
                date:           data.payment_date,
                entry_type:     'Ausgabe',
                amount:         parseFloat(data.amount),
                category:       liability?.category || 'Verbindlichkeiten',
                description:    `Verbindlichkeit: ${liability?.title || liability?.creditor_name || ''}${data.reference ? ' — ' + data.reference : ''}`,
                payment_method: toCashbookPaymentMethod(data.payment_method),
                source:         'verbindlichkeit',
                liability_payment_id: payment.id,
                status:         'gebucht',
            });
            return payment;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['liabilities'] });
            queryClient.invalidateQueries({ queryKey: ['liability-payments'] });
            queryClient.invalidateQueries({ queryKey: ['cashbook-entries'] });
            setPayOpen(false);
            setPayData(EMPTY_PAYMENT);
            toast.success('Zahlung verbucht — erscheint jetzt auch im DATEV-Export');
        },
        onError: () => toast.error('Fehler beim Verbuchen'),
    });

    // ── Daten anreichern ──────────────────────────────────────────────────────
    const enriched = useMemo(() => liabilities.map(l => {
        const isOverdue = l.due_date && isAfter(now, new Date(l.due_date)) &&
            l.status !== 'bezahlt' && l.status !== 'gestundet';
        return { ...l, status: isOverdue && l.status === 'offen' ? 'ueberfaellig' : l.status };
    }), [liabilities]);

    // ── Filter ────────────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = enriched;
        if (statusFilter === 'aktiv')   list = list.filter(l => l.status !== 'bezahlt');
        else if (statusFilter !== 'alle') list = list.filter(l => l.status === statusFilter);
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(l =>
                l.title?.toLowerCase().includes(q) ||
                l.creditor_name?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [enriched, statusFilter, search]);

    // ── Summen ────────────────────────────────────────────────────────────────
    const totals = useMemo(() => {
        const active  = enriched.filter(l => l.status !== 'bezahlt');
        const total   = active.reduce((s, l) => s + Math.max(0, (l.original_amount || 0) - (l.paid_amount || 0)), 0);
        const overdue = enriched.filter(l => l.status === 'ueberfaellig').reduce((s, l) => s + Math.max(0, (l.original_amount || 0) - (l.paid_amount || 0)), 0);
        const counts  = { aktiv: active.length, ueberfaellig: 0, offen: 0, teilbezahlt: 0, ratenzahlung: 0, bezahlt: 0, gestundet: 0 };
        enriched.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });
        return { total, overdue, counts };
    }, [enriched]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const openEdit = liability => {
        setSelected(liability);
        setEditData({ ...liability });
        setEditOpen(true);
    };

    const openPay = liability => {
        setSelected(liability);
        setPayData({
            ...EMPTY_PAYMENT,
            amount: liability.installment_amount ||
                Math.max(0, (liability.original_amount || 0) - (liability.paid_amount || 0)) || '',
        });
        setPayOpen(true);
    };

    const handleCreate = () => {
        if (!form.title || !form.original_amount) {
            toast.error('Bezeichnung und Betrag sind Pflichtfelder');
            return;
        }
        const gross = parseFloat(form.original_amount) || 0;
        createMutation.mutate({
            ...form,
            original_amount:  gross,
            paid_amount:      parseFloat(form.paid_amount) || 0,
            remaining_amount: gross - (parseFloat(form.paid_amount) || 0),
            dunning_level:    parseInt(form.dunning_level) || 0,
            installment_amount: form.installment_amount ? parseFloat(form.installment_amount) : undefined,
        });
    };

    const handleUpdate = () => {
        if (!selected) return;
        const gross = parseFloat(editData.original_amount) || 0;
        updateMutation.mutate({
            id: selected.id,
            data: {
                ...editData,
                original_amount:  gross,
                paid_amount:      parseFloat(editData.paid_amount) || 0,
                remaining_amount: gross - (parseFloat(editData.paid_amount) || 0),
                dunning_level:    parseInt(editData.dunning_level) || 0,
                installment_amount: editData.installment_amount ? parseFloat(editData.installment_amount) : undefined,
            },
        });
    };

    const handlePay = () => {
        if (!selected || !payData.amount) {
            toast.error('Bitte Betrag eingeben');
            return;
        }
        paymentMutation.mutate({ ...payData, liability_id: selected.id, amount: parseFloat(payData.amount) || 0 });
    };

    if (!permissions.canViewAccounting) {
        return <PermissionDenied message="Kein Zugriff auf Verbindlichkeiten." />;
    }

    const FILTERS = [
        { key: 'aktiv',        label: `Aktiv (${totals.counts.aktiv})`              },
        { key: 'ueberfaellig', label: `Überfällig (${totals.counts.ueberfaellig})`  },
        { key: 'offen',        label: `Offen (${totals.counts.offen})`              },
        { key: 'teilbezahlt',  label: `Teilbezahlt (${totals.counts.teilbezahlt})`  },
        { key: 'ratenzahlung', label: `Ratenzahlung (${totals.counts.ratenzahlung})` },
        { key: 'bezahlt',      label: `Bezahlt (${totals.counts.bezahlt})`          },
        { key: 'alle',         label: `Alle (${enriched.length})`                   },
    ];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Verbindlichkeiten</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">Offene Posten · Schulden · Raten</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => { setSearchOpen(s => !s); if (searchOpen) setSearch(''); }}
                            className={cn(
                                'w-9 h-9 flex items-center justify-center rounded-lg border transition-all',
                                searchOpen
                                    ? 'bg-accent border-border text-foreground'
                                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                            )}>
                            {searchOpen
                                ? <X className="w-4 h-4" />
                                : <TrendingDown className="w-4 h-4" />
                            }
                        </button>
                        <Button onClick={() => { setForm(EMPTY_FORM); setModalOpen(true); }}
                            className="h-9 bg-red-600 hover:bg-red-700 text-white gap-1.5">
                            <Plus className="w-4 h-4" /> Neu
                        </Button>
                    </div>
                </div>

                {/* ── KPI ─────────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3.5">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Offene Verbindlichkeiten</p>
                        <p className="text-lg font-bold text-red-400 tabular-nums mt-0.5">{fmt(totals.total)} €</p>
                        <p className="text-[10px] text-muted-foreground">{totals.counts.aktiv} Positionen</p>
                    </div>
                    <div className={cn('border rounded-xl p-3.5', totals.overdue > 0
                        ? 'bg-amber-500/8 border-amber-500/20'
                        : 'bg-secondary/30 border-border/40'
                    )}>
                        <p className={cn('text-[10px] font-bold uppercase tracking-wide', totals.overdue > 0 ? 'text-amber-400' : 'text-muted-foreground')}>Überfällig</p>
                        <p className={cn('text-lg font-bold tabular-nums mt-0.5', totals.overdue > 0 ? 'text-amber-400' : 'text-muted-foreground')}>{fmt(totals.overdue)} €</p>
                        <p className="text-[10px] text-muted-foreground">{totals.counts.ueberfaellig} Posten</p>
                    </div>
                </div>

                {/* ── Suche ───────────────────────────────────────────────── */}
                {searchOpen && (
                    <Input autoFocus
                        placeholder="Bezeichnung oder Gläubiger suchen…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="h-10" />
                )}

                {/* ── Status-Filter-Chips ──────────────────────────────────── */}
                <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                    {FILTERS.map(f => (
                        <button key={f.key} onClick={() => setStatusFilter(f.key)}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all',
                                statusFilter === f.key
                                    ? f.key === 'ueberfaellig'
                                        ? 'bg-red-600 border-red-600 text-white'
                                        : 'bg-amber-600 border-amber-600 text-white'
                                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                            )}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* ── Liste ───────────────────────────────────────────────── */}
                {filtered.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-semibold text-foreground">
                            {statusFilter === 'ueberfaellig' ? 'Keine überfälligen Posten' :
                             statusFilter === 'aktiv' ? 'Keine offenen Verbindlichkeiten' :
                             'Keine Einträge'}
                        </p>
                        <p className="text-sm mt-1">Neue Verbindlichkeit über den Button oben erfassen</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map(l => (
                            <LiabilityCard
                                key={l.id}
                                liability={l}
                                payments={payments}
                                onEdit={() => openEdit(l)}
                                onPay={() => openPay(l)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Neu-Dialog ───────────────────────────────────────────────── */}
            <Dialog open={modalOpen} onOpenChange={o => !o && setModalOpen(false)}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Verbindlichkeit erfassen</DialogTitle>
                    </DialogHeader>
                    <div className="py-1">
                        <LiabilityForm data={form} onChange={setForm} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Abbrechen</Button>
                        <Button onClick={handleCreate}
                            disabled={createMutation.isPending}
                            className="bg-red-600 hover:bg-red-700 text-white flex-1">
                            {createMutation.isPending ? 'Speichert…' : 'Erfassen'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Bearbeiten-Dialog ────────────────────────────────────────── */}
            <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Verbindlichkeit bearbeiten</DialogTitle>
                    </DialogHeader>
                    <div className="py-1">
                        <LiabilityForm data={editData} onChange={setEditData} />
                    </div>
                    <DialogFooter className="gap-2 flex-row">
                        <Button variant="outline" size="sm"
                            onClick={() => setDeleteTarget(selected?.id)}
                            className="text-destructive border-destructive/30 hover:bg-destructive/10 h-9">
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />Löschen
                        </Button>
                        <Button onClick={handleUpdate}
                            disabled={updateMutation.isPending}
                            className="bg-red-600 hover:bg-red-700 text-white flex-1 h-9">
                            {updateMutation.isPending ? 'Speichert…' : 'Speichern'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Zahlungs-Dialog ──────────────────────────────────────────── */}
            <Dialog open={payOpen} onOpenChange={o => !o && setPayOpen(false)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Zahlung verbuchen</DialogTitle>
                    </DialogHeader>
                    <div className="py-1 space-y-3">
                        {selected && (
                            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary/40 border border-border/40">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{selected.title}</p>
                                    {selected.creditor_name && (
                                        <p className="text-xs text-muted-foreground">{selected.creditor_name}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-foreground">{fmt(selected.original_amount)} €</p>
                                    <p className="text-xs text-muted-foreground">
                                        Rest: {fmt(Math.max(0, (selected.original_amount || 0) - (selected.paid_amount || 0)))} €
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Betrag (€) *</Label>
                            <Input type="number" step="0.01"
                                value={payData.amount}
                                onChange={e => setPayData({ ...payData, amount: e.target.value })}
                                className="h-10" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Datum</Label>
                                <Input type="date" value={payData.payment_date}
                                    onChange={e => setPayData({ ...payData, payment_date: e.target.value })}
                                    className="h-10" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Zahlungsart</Label>
                                <Select value={payData.payment_method}
                                    onValueChange={v => setPayData({ ...payData, payment_method: v })}>
                                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PAY_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Verwendungszweck</Label>
                            <Input value={payData.reference || ''}
                                onChange={e => setPayData({ ...payData, reference: e.target.value })}
                                placeholder="Optional" className="h-10" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPayOpen(false)}>Abbrechen</Button>
                        <Button onClick={handlePay}
                            disabled={paymentMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white flex-1">
                            <CreditCard className="w-4 h-4 mr-1.5" />
                            {paymentMutation.isPending ? 'Verbucht…' : 'Zahlung verbuchen'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm ───────────────────────────────────────────── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Verbindlichkeit löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dieser Eintrag und alle zugehörigen Zahlungen werden dauerhaft entfernt.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(deleteTarget)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
