/**
 * Fixkosten — wiederkehrende Ausgaben verwalten
 *
 * v2 Verbesserungen:
 *  - Formular auf 8 Kern-Felder reduziert, Rest aufklappbar in "Erweitert"
 *  - Auto-Generierung der Monatseinträge — kein manueller Button
 *  - Auslaufende Verträge als Alert-Block oben
 *  - Status-Toggle direkt in der Karte (kein separater Dialog)
 *  - Konsistente Chip-Styles mit semantic tokens
 *  - Kein FAB — ein Button im Header
 *  - AlertDialog für Löschen
 */
import React, { useState, useMemo, useEffect } from 'react';
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
import {
    Plus, RefreshCw, AlertTriangle, CheckCircle2,
    ChevronLeft, ChevronRight, Trash2, ChevronDown,
    CalendarClock, Euro
} from 'lucide-react';
import { format, addMonths, subMonths, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Konstanten ────────────────────────────────────────────────────────────────
const fmt = n => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORIES = [
    'Pacht/Miete', 'Strom', 'Gas', 'Wasser', 'Internet/Telefon',
    'Versicherungen', 'GEMA', 'Software-Abos', 'Leasing',
    'Reinigung', 'Steuerberater', 'Müllentsorgung', 'Wartungsvertrag', 'Sonstiges',
];
const INTERVALS       = ['monatlich', 'quartalsweise', 'halbjährlich', 'jährlich'];
const PAYMENT_METHODS = ['Überweisung', 'Lastschrift', 'Bar', 'Kreditkarte', 'Sonstiges'];
const TAX_TREATMENTS  = ['Betriebsausgabe', 'Nicht abzugsfähig', 'Gemischt', 'Privatanteil'];

const STATUS_CFG = {
    bezahlt:     { label: 'Bezahlt',    color: 'text-green-400',  bg: 'bg-green-500/10',  dot: 'bg-green-400'  },
    beleg_fehlt: { label: 'Beleg fehlt',color: 'text-amber-400',  bg: 'bg-amber-500/10',  dot: 'bg-amber-400'  },
    überfällig:  { label: 'Überfällig', color: 'text-red-400',    bg: 'bg-red-500/10',    dot: 'bg-red-500'    },
    erwartet:    { label: 'Erwartet',   color: 'text-muted-foreground', bg: 'bg-secondary/50', dot: 'bg-muted-foreground' },
};

const EMPTY_FORM = {
    // Kern-Felder (immer sichtbar)
    title: '', category: 'Sonstiges', amount_gross: '', vat_rate: 19,
    interval: 'monatlich', due_day: 1, payment_method: 'Überweisung', active: true,
    // Erweitert
    supplier_name: '', customer_number: '', contract_number: '',
    contract_start_date: '', contract_end_date: '', notice_period_days: '',
    auto_renewal: false, auto_renewal_period_months: '',
    contact_person: '', contact_phone: '',
    tax_treatment: 'Betriebsausgabe', document_url: '',
};

// ── Monatsnavigation ──────────────────────────────────────────────────────────
function MonthNav({ value, onChange }) {
    const date = new Date(value + '-01');
    return (
        <div className="flex items-center gap-1.5">
            <button onClick={() => onChange(format(subMonths(date, 1), 'yyyy-MM'))}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-foreground min-w-[110px] text-center">
                {format(date, 'MMMM yyyy', { locale: de })}
            </span>
            <button onClick={() => onChange(format(addMonths(date, 1), 'yyyy-MM'))}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

// ── Fixkosten-Formular ────────────────────────────────────────────────────────
function FixedCostForm({ data, onChange }) {
    const [showAdvanced, setShowAdvanced] = useState(
        !!(data.supplier_name || data.contract_number || data.contract_end_date)
    );

    return (
        <div className="space-y-3">
            {/* ── Kern-Felder ── */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Bezeichnung *</Label>
                <Input value={data.title || ''}
                    onChange={e => onChange({ ...data, title: e.target.value })}
                    placeholder="z.B. Strom Stadtwerke, GEMA, Pacht…"
                    className="h-10" />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Betrag Brutto (€) *</Label>
                    <Input type="number" step="0.01" placeholder="0,00"
                        value={data.amount_gross || ''}
                        onChange={e => onChange({ ...data, amount_gross: e.target.value })}
                        className="h-10" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">MwSt.</Label>
                    <Select value={String(data.vat_rate ?? 19)}
                        onValueChange={v => onChange({ ...data, vat_rate: Number(v) })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {['0','7','19'].map(r => <SelectItem key={r} value={r}>{r}%</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Kategorie</Label>
                    <Select value={data.category || 'Sonstiges'}
                        onValueChange={v => onChange({ ...data, category: v })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Intervall</Label>
                    <Select value={data.interval || 'monatlich'}
                        onValueChange={v => onChange({ ...data, interval: v })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {INTERVALS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Fällig am (Tag d.M.)</Label>
                    <Input type="number" min="1" max="31"
                        value={data.due_day || 1}
                        onChange={e => onChange({ ...data, due_day: e.target.value })}
                        className="h-10" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Zahlungsart</Label>
                    <Select value={data.payment_method || 'Überweisung'}
                        onValueChange={v => onChange({ ...data, payment_method: v })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex items-center justify-between py-1">
                <Label className="text-sm cursor-pointer">Aktiv</Label>
                <Switch checked={data.active !== false}
                    onCheckedChange={v => onChange({ ...data, active: v })} />
            </div>

            {/* ── Erweitert ── */}
            <div className="border border-border/50 rounded-xl overflow-hidden">
                <button type="button"
                    onClick={() => setShowAdvanced(s => !s)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-secondary/20 hover:bg-accent/20 transition-all">
                    <span className="text-sm font-semibold text-foreground">Erweitert</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Vertrag, Kontakt, Steuern</span>
                        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', showAdvanced && 'rotate-180')} />
                    </div>
                </button>

                {showAdvanced && (
                    <div className="px-4 pb-4 pt-3 space-y-3 border-t border-border/40">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Lieferant</Label>
                                <Input value={data.supplier_name || ''}
                                    onChange={e => onChange({ ...data, supplier_name: e.target.value })}
                                    placeholder="Anbieter" className="h-9 text-sm" />
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
                                <Label className="text-xs text-muted-foreground">Vertragsende</Label>
                                <Input type="date" value={data.contract_end_date || ''}
                                    onChange={e => onChange({ ...data, contract_end_date: e.target.value })}
                                    className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Kündigungsfrist (Tage)</Label>
                                <Input type="number" value={data.notice_period_days || ''}
                                    onChange={e => onChange({ ...data, notice_period_days: e.target.value })}
                                    placeholder="30" className="h-9 text-sm" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between py-0.5">
                            <Label className="text-xs text-muted-foreground cursor-pointer">Auto-Verlängerung</Label>
                            <Switch checked={!!data.auto_renewal}
                                onCheckedChange={v => onChange({ ...data, auto_renewal: v })} />
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
                                    placeholder="030 123456" className="h-9 text-sm" />
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

// ── Hauptseite ────────────────────────────────────────────────────────────────
export default function AccountingFixedCosts() {
    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const now = new Date();

    const [selectedMonth, setSelectedMonth] = useState(format(now, 'yyyy-MM'));
    const [view,          setView]          = useState('monat'); // 'monat' | 'verwaltung'
    const [catFilter,     setCatFilter]     = useState('alle');
    const [modalOpen,     setModalOpen]     = useState(false);
    const [editItem,      setEditItem]      = useState(null);
    const [form,          setForm]          = useState(EMPTY_FORM);
    const [deleteTarget,  setDeleteTarget]  = useState(null);

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: expenses = [] } = useQuery({
        queryKey: ['recurring-expenses'],
        queryFn:  () => base44.entities.RecurringExpense.list('title'),
    });

    const { data: occurrences = [] } = useQuery({
        queryKey: ['recurring-expense-occurrences'],
        queryFn:  () => base44.entities.RecurringExpenseOccurrence.list('-month'),
    });

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createExpenseMutation = useMutation({
        mutationFn: d => base44.entities.RecurringExpense.create(d),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
            closeModal();
            toast.success('Fixkosten angelegt');
        },
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const updateExpenseMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.RecurringExpense.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
            closeModal();
            toast.success('Gespeichert');
        },
        onError: () => toast.error('Fehler beim Aktualisieren'),
    });

    const deleteExpenseMutation = useMutation({
        mutationFn: id => base44.entities.RecurringExpense.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
            setDeleteTarget(null);
            toast.success('Gelöscht');
        },
        onError: () => toast.error('Fehler beim Löschen'),
    });

    const createOccurrenceMutation = useMutation({
        mutationFn: d => base44.entities.RecurringExpenseOccurrence.create(d),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-expense-occurrences'] }),
    });

    const updateOccurrenceMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.RecurringExpenseOccurrence.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-expense-occurrences'] }),
    });

    // ── Monatseinträge generieren (automatisch) ───────────────────────────────
    const monthOccurrences = useMemo(() => {
        const activeExpenses = expenses.filter(e => e.active !== false).filter(e => {
            const [, m] = selectedMonth.split('-').map(Number);
            if (e.interval === 'monatlich')     return true;
            if (e.interval === 'quartalsweise') return [1, 4, 7, 10].includes(m);
            if (e.interval === 'halbjährlich')  return [1, 7].includes(m);
            if (e.interval === 'jährlich')      return m === 1;
            return true;
        });

        return activeExpenses.map(e => {
            const real = occurrences.find(o =>
                o.recurring_expense_id === e.id && o.month === selectedMonth
            );
            const dueDate = `${selectedMonth}-${String(e.due_day || 1).padStart(2, '0')}`;
            return real
                ? { ...real, _expense: e }
                : { recurring_expense_id: e.id, _expense: e, month: selectedMonth, due_date: dueDate, expected_amount: e.amount_gross || 0, status: 'erwartet', id: null };
        });
    }, [expenses, occurrences, selectedMonth]);

    // Auto-Generierung: fehlende Occurrences beim Monatswechsel anlegen
    useEffect(() => {
        const missing = monthOccurrences.filter(o => !o.id);
        if (missing.length === 0) return;
        missing.forEach(o => {
            createOccurrenceMutation.mutate({
                recurring_expense_id: o.recurring_expense_id,
                month: o.month,
                due_date: o.due_date,
                expected_amount: o.expected_amount,
                status: 'erwartet',
            });
        });
    }, [selectedMonth, monthOccurrences.length]);

    // ── Verträge die in ≤90 Tagen auslaufen ──────────────────────────────────
    const expiringContracts = useMemo(() =>
        expenses.filter(e => {
            if (!e.contract_end_date) return false;
            const days = differenceInDays(new Date(e.contract_end_date), now);
            return days >= 0 && days <= 90;
        }).sort((a, b) => a.contract_end_date.localeCompare(b.contract_end_date)),
        [expenses]
    );

    // ── Filter ────────────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        if (catFilter === 'alle') return monthOccurrences;
        return monthOccurrences.filter(o => o._expense?.category === catFilter);
    }, [monthOccurrences, catFilter]);

    // ── Summen ────────────────────────────────────────────────────────────────
    const totals = useMemo(() => {
        const total   = monthOccurrences.reduce((s, o) => s + (o.expected_amount || 0), 0);
        const paid    = monthOccurrences.filter(o => o.status === 'bezahlt').reduce((s, o) => s + (o.actual_amount || o.expected_amount || 0), 0);
        const open    = monthOccurrences.filter(o => o.status !== 'bezahlt').length;
        return { total, paid, open };
    }, [monthOccurrences]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const openAdd = () => { setForm(EMPTY_FORM); setEditItem(null); setModalOpen(true); };
    const openEdit = exp => { setForm({ ...EMPTY_FORM, ...exp }); setEditItem(exp); setModalOpen(true); };
    const closeModal = () => { setModalOpen(false); setEditItem(null); setForm(EMPTY_FORM); };

    const handleSave = () => {
        if (!form.title || !form.amount_gross) {
            toast.error('Bezeichnung und Betrag sind Pflichtfelder');
            return;
        }
        const gross = parseFloat(form.amount_gross) || 0;
        const rate  = form.vat_rate || 0;
        const net   = gross / (1 + rate / 100);
        const data  = { ...form, amount_gross: gross, amount_net: Math.round(net * 100) / 100, due_day: parseInt(form.due_day) || 1 };
        editItem
            ? updateExpenseMutation.mutate({ id: editItem.id, data })
            : createExpenseMutation.mutate(data);
    };

    // Lastschrift existiert im Kassenbuch nicht separat, ist aber ein
    // Bankvorgang wie Ueberweisung.
    const toCashbookPaymentMethod = pm =>
        pm === 'Lastschrift' ? 'Überweisung' : (pm || 'Überweisung');

    // Bezahlt-Toggle bucht (bzw. storniert) jetzt automatisch einen
    // Kassenbuch-Eintrag mit — sonst tauchen Fixkosten-Zahlungen nie im
    // DATEV-Export auf (der liest nur Belege + Kassenbuch).
    const toggleStatus = async occ => {
        const next = occ.status === 'bezahlt' ? 'erwartet' : 'bezahlt';

        try {
            if (next === 'bezahlt') {
                let occurrenceId = occ.id;
                if (occurrenceId) {
                    await updateOccurrenceMutation.mutateAsync({ id: occurrenceId, data: { status: next } });
                } else {
                    const created = await createOccurrenceMutation.mutateAsync({
                        recurring_expense_id: occ.recurring_expense_id,
                        month: occ.month,
                        due_date: occ.due_date,
                        expected_amount: occ.expected_amount,
                        status: next,
                    });
                    occurrenceId = created.id;
                }

                await base44.entities.CashbookEntry.create({
                    date:           occ.due_date || format(new Date(), 'yyyy-MM-dd'),
                    entry_type:     'Ausgabe',
                    amount:         parseFloat(occ.actual_amount || occ.expected_amount || 0),
                    category:       occ._expense?.category || 'Fixkosten',
                    description:    `Fixkosten: ${occ._expense?.title || occ._expense?.supplier_name || ''}`,
                    payment_method: toCashbookPaymentMethod(occ._expense?.payment_method),
                    source:         'fixkosten',
                    recurring_expense_occurrence_id: occurrenceId,
                    status:         'gebucht',
                });
                queryClient.invalidateQueries({ queryKey: ['cashbook-entries'] });
                toast.success('Als bezahlt markiert — im DATEV-Export erfasst');
            } else {
                if (occ.id) {
                    await updateOccurrenceMutation.mutateAsync({ id: occ.id, data: { status: next } });
                    // verknuepften Kassenbuch-Eintrag wieder entfernen
                    const linked = await base44.entities.CashbookEntry.filter({ recurring_expense_occurrence_id: occ.id });
                    await Promise.all(linked.map(e => base44.entities.CashbookEntry.delete(e.id)));
                    queryClient.invalidateQueries({ queryKey: ['cashbook-entries'] });
                }
            }
        } catch (err) {
            toast.error('Fehler beim Verbuchen: ' + err.message);
        }
    };

    const usedCategories = [...new Set(expenses.map(e => e.category).filter(Boolean))];

    if (!permissions.canViewAccounting) {
        return <PermissionDenied message="Kein Zugriff auf Fixkosten." />;
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Fixkosten</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">Wiederkehrende Ausgaben · monatliche Übersicht</p>
                    </div>
                    <Button onClick={openAdd}
                        className="h-9 bg-orange-600 hover:bg-orange-700 text-white gap-1.5">
                        <Plus className="w-4 h-4" /> Neu
                    </Button>
                </div>

                {/* ── Auslaufende Verträge ─────────────────────────────────── */}
                {expiringContracts.length > 0 && (
                    <div className="space-y-1.5">
                        {expiringContracts.map(e => {
                            const days = differenceInDays(new Date(e.contract_end_date), now);
                            return (
                                <div key={e.id}
                                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-amber-500/25 bg-amber-500/8 cursor-pointer hover:bg-amber-500/12 transition-all"
                                    onClick={() => openEdit(e)}>
                                    <CalendarClock className="w-4 h-4 text-amber-400 shrink-0" />
                                    <p className="text-xs font-semibold text-amber-400 flex-1">
                                        {e.title} läuft in {days} Tag{days !== 1 ? 'en' : ''} aus
                                        {e.notice_period_days && days <= e.notice_period_days
                                            ? ' — Kündigung jetzt fällig!'
                                            : ''}
                                    </p>
                                    <p className="text-xs text-amber-400/70 shrink-0">
                                        {format(new Date(e.contract_end_date), 'dd.MM.yy')}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── View-Toggle ──────────────────────────────────────────── */}
                <div className="flex gap-1 p-1 bg-secondary/40 rounded-xl">
                    {[['monat', 'Monatsübersicht'], ['verwaltung', 'Verwaltung']].map(([key, label]) => (
                        <button key={key} onClick={() => setView(key)}
                            className={cn(
                                'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
                                view === key
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}>
                            {label}
                        </button>
                    ))}
                </div>

                {view === 'monat' && (
                    <>
                        {/* ── Monatsnavigation ────────────────────────────── */}
                        <div className="flex items-center justify-between">
                            <MonthNav value={selectedMonth} onChange={setSelectedMonth} />
                            <div className="text-right">
                                <p className="text-sm font-bold text-foreground">{fmt(totals.total)} €</p>
                                <p className="text-[10px] text-muted-foreground">
                                    {totals.open > 0 ? `${totals.open} offen` : 'alle bezahlt'}
                                </p>
                            </div>
                        </div>

                        {/* ── KPI ─────────────────────────────────────────── */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-secondary/40 rounded-xl p-3 text-center">
                                <p className="text-sm font-bold text-foreground">{monthOccurrences.length}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Positionen</p>
                            </div>
                            <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-3 text-center">
                                <p className="text-sm font-bold text-green-400">{fmt(totals.paid)} €</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Bezahlt</p>
                            </div>
                            <div className={cn('border rounded-xl p-3 text-center',
                                totals.open > 0 ? 'bg-amber-500/8 border-amber-500/20' : 'bg-secondary/40 border-transparent'
                            )}>
                                <p className={cn('text-sm font-bold', totals.open > 0 ? 'text-amber-400' : 'text-muted-foreground')}>
                                    {fmt(totals.total - totals.paid)} €
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Offen</p>
                            </div>
                        </div>

                        {/* ── Kategorie-Filter ─────────────────────────────── */}
                        {usedCategories.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                                {['alle', ...usedCategories].map(cat => (
                                    <button key={cat} onClick={() => setCatFilter(cat)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all',
                                            catFilter === cat
                                                ? 'bg-orange-600 border-orange-600 text-white'
                                                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                                        )}>
                                        {cat === 'alle' ? `Alle (${monthOccurrences.length})` : cat}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* ── Monats-Liste ─────────────────────────────────── */}
                        {filtered.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-semibold text-foreground">Keine Fixkosten</p>
                                <p className="text-sm mt-1">Neuen Eintrag über den Button oben anlegen</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filtered.map((occ, idx) => {
                                    const cfg = STATUS_CFG[occ.status] || STATUS_CFG.erwartet;
                                    const exp = occ._expense || {};
                                    return (
                                        <div key={occ.id || `gen-${idx}`}
                                            onClick={() => openEdit(exp)}
                                            className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border/50 bg-card hover:border-border cursor-pointer transition-all group min-h-[60px]">

                                            {/* Status-Dot */}
                                            <div className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{exp.title}</p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    {exp.category}
                                                    {occ.due_date && ` · fällig ${occ.due_date.slice(8)}.${occ.due_date.slice(5, 7)}.`}
                                                    {exp.payment_method && ` · ${exp.payment_method}`}
                                                </p>
                                            </div>

                                            {/* Betrag + Toggle */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                <p className="text-sm font-bold text-foreground">
                                                    {fmt(occ.expected_amount)} €
                                                </p>
                                                <button
                                                    onClick={e => { e.stopPropagation(); toggleStatus(occ); }}
                                                    className={cn(
                                                        'w-8 h-8 rounded-lg flex items-center justify-center border transition-all min-h-[44px] min-w-[44px]',
                                                        occ.status === 'bezahlt'
                                                            ? 'bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25'
                                                            : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                                                    )}>
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {view === 'verwaltung' && (
                    <div className="space-y-2">
                        {expenses.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-semibold text-foreground">Noch keine Fixkosten angelegt</p>
                                <p className="text-sm mt-1">Über den Button oben anlegen</p>
                            </div>
                        ) : (
                            expenses.map(exp => (
                                <div key={exp.id}
                                    onClick={() => openEdit(exp)}
                                    className={cn(
                                        'flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border/50 bg-card hover:border-border cursor-pointer transition-all group min-h-[60px]',
                                        !exp.active && 'opacity-50'
                                    )}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-foreground truncate">{exp.title}</p>
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground shrink-0">
                                                {exp.interval}
                                            </span>
                                            {!exp.active && (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground shrink-0">
                                                    Inaktiv
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            {exp.category}
                                            {exp.payment_method && ` · ${exp.payment_method}`}
                                            {exp.due_day && ` · Fällig: ${exp.due_day}. d.M.`}
                                            {exp.contract_end_date && (
                                                <span className={cn('ml-1',
                                                    differenceInDays(new Date(exp.contract_end_date), now) <= 90
                                                        ? 'text-amber-400 font-medium' : ''
                                                )}>
                                                    · Ende: {format(new Date(exp.contract_end_date), 'dd.MM.yy')}
                                                    {exp.auto_renewal ? ' ↺' : ''}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <p className="text-sm font-bold text-foreground">{fmt(exp.amount_gross)} €</p>
                                        <button
                                            onClick={e => { e.stopPropagation(); setDeleteTarget(exp.id); }}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 min-w-[28px] min-h-[28px] flex items-center justify-center">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* ── Formular Dialog ──────────────────────────────────────────── */}
            <Dialog open={modalOpen} onOpenChange={o => !o && closeModal()}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editItem ? 'Fixkosten bearbeiten' : 'Fixkosten anlegen'}</DialogTitle>
                    </DialogHeader>
                    <div className="py-1">
                        <FixedCostForm data={form} onChange={setForm} />
                    </div>
                    <DialogFooter className="gap-2 flex-row">
                        {editItem && (
                            <Button variant="outline" size="sm"
                                onClick={() => { closeModal(); setDeleteTarget(editItem.id); }}
                                className="text-destructive border-destructive/30 hover:bg-destructive/10 h-9">
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />Löschen
                            </Button>
                        )}
                        <Button onClick={handleSave}
                            disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending}
                            className="bg-orange-600 hover:bg-orange-700 text-white flex-1 h-9">
                            {createExpenseMutation.isPending || updateExpenseMutation.isPending ? 'Speichert…' : 'Speichern'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm ───────────────────────────────────────────── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Fixkosten löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dieser Eintrag und alle zugehörigen Monatseinträge werden dauerhaft entfernt.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteExpenseMutation.mutate(deleteTarget)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
