/**
 * Kassenbuch — schlankes digitales Kassenbuch für den Steuerberater
 *
 * Verbesserungen v2:
 *  - Kassenstand Bar (laufend) oben als Banner
 *  - Einträge nach Datum gruppiert mit Tages-Trenner + Tagessaldo
 *  - Formular: Standard Einnahme/Ausgabe/Trinkgeld — Sonderfälle aufklappbar
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
    Plus, TrendingUp, TrendingDown, BookOpen,
    Trash2, ExternalLink, ChevronLeft, ChevronRight,
    Zap, ChevronDown, Wallet, FileText
} from 'lucide-react';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Konstanten ────────────────────────────────────────────────────────────────
const fmt = n => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Standard-Typen (täglich) + Sonderfälle (selten)
const STANDARD_TYPES = ['Einnahme', 'Ausgabe', 'Trinkgeld'];
const SPECIAL_TYPES  = ['Privatentnahme', 'Privateinlage', 'Kassensturz', 'Sonstiges'];
const ALL_TYPES      = [...STANDARD_TYPES, ...SPECIAL_TYPES];

const TAX_RATES  = ['0', '7', '19'];
const PAY_METHODS = ['Bar', 'EC', 'Kreditkarte', 'Überweisung', 'Sonstiges'];

const CATEGORIES = {
    Einnahme:       ['Umsatz Bar', 'Umsatz EC', 'Sonstiges'],
    Ausgabe:        ['Getränke', 'Lebensmittel', 'Reinigung', 'Personal', 'Miete', 'Energie', 'GEMA', 'Büro', 'Marketing', 'Sonstiges'],
    Trinkgeld:      ['Trinkgeld'],
    Privatentnahme: ['Privatentnahme'],
    Privateinlage:  ['Privateinlage'],
    Kassensturz:    ['Kassensturz'],
    Sonstiges:      ['Sonstiges'],
};

const TYPE_STYLE = {
    Einnahme:       { color: 'text-green-400',  bg: 'bg-green-500/10',   icon: TrendingUp   },
    Ausgabe:        { color: 'text-red-400',     bg: 'bg-red-500/10',     icon: TrendingDown },
    Privatentnahme: { color: 'text-orange-400',  bg: 'bg-orange-500/10',  icon: TrendingDown },
    Privateinlage:  { color: 'text-blue-400',    bg: 'bg-blue-500/10',    icon: TrendingUp   },
    Trinkgeld:      { color: 'text-amber-400',   bg: 'bg-amber-500/10',   icon: TrendingUp   },
    Kassensturz:    { color: 'text-purple-400',  bg: 'bg-purple-500/10',  icon: BookOpen     },
    Sonstiges:      { color: 'text-muted-foreground', bg: 'bg-secondary/50', icon: BookOpen  },
};

const isIncome = t => ['Einnahme', 'Privateinlage', 'Trinkgeld'].includes(t);

const EMPTY_FORM = {
    date:           format(new Date(), 'yyyy-MM-dd'),
    entry_type:     'Ausgabe',
    amount:         '',
    tax_rate:       19,
    category:       '',
    description:    '',
    payment_method: 'Bar',
    source:         'manuell',
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

// ── Buchungs-Formular ─────────────────────────────────────────────────────────
function EntryForm({ data, onChange }) {
    const [showSpecial, setShowSpecial] = useState(
        SPECIAL_TYPES.includes(data.entry_type)
    );
    const cats = CATEGORIES[data.entry_type] || ['Sonstiges'];

    const selectType = (t) => {
        onChange({ ...data, entry_type: t, category: '' });
        if (SPECIAL_TYPES.includes(t)) setShowSpecial(true);
    };

    return (
        <div className="space-y-3">
            {/* Typ — Standard als Chips */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Buchungsart *</Label>
                <div className="flex gap-2 flex-wrap">
                    {STANDARD_TYPES.map(t => (
                        <button key={t} type="button"
                            onClick={() => selectType(t)}
                            className={cn(
                                'px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all min-h-[40px]',
                                data.entry_type === t
                                    ? t === 'Ausgabe'  ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                    : t === 'Einnahme' ? 'bg-green-500/20 border-green-500/40 text-green-400'
                                    :                    'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                            )}>
                            {t}
                        </button>
                    ))}
                    {/* Sonderfälle aufklappbar */}
                    <button type="button"
                        onClick={() => setShowSpecial(s => !s)}
                        className={cn(
                            'px-3 py-2 rounded-xl border text-sm font-semibold transition-all min-h-[40px] flex items-center gap-1',
                            SPECIAL_TYPES.includes(data.entry_type)
                                ? 'bg-secondary border-border text-foreground'
                                : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                        )}>
                        {SPECIAL_TYPES.includes(data.entry_type) ? data.entry_type : 'Mehr'}
                        <ChevronDown className={cn('w-3 h-3 transition-transform', showSpecial && 'rotate-180')} />
                    </button>
                </div>

                {/* Sonderfälle */}
                {showSpecial && (
                    <div className="flex gap-2 flex-wrap pt-1 pl-0.5">
                        {SPECIAL_TYPES.map(t => (
                            <button key={t} type="button"
                                onClick={() => selectType(t)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all min-h-[36px]',
                                    data.entry_type === t
                                        ? 'bg-secondary border-border text-foreground'
                                        : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
                                )}>
                                {t}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Betrag (Brutto) *</Label>
                    <Input type="number" step="0.01" placeholder="0,00"
                        value={data.amount}
                        onChange={e => onChange({ ...data, amount: e.target.value })}
                        className="h-10" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Datum *</Label>
                    <Input type="date" value={data.date}
                        onChange={e => onChange({ ...data, date: e.target.value })}
                        className="h-10" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Kategorie</Label>
                    <Select value={data.category || ''}
                        onValueChange={v => onChange({ ...data, category: v })}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Wählen…" /></SelectTrigger>
                        <SelectContent>
                            {cats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Zahlungsart</Label>
                    <Select value={data.payment_method || 'Bar'}
                        onValueChange={v => onChange({ ...data, payment_method: v })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {PAY_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">MwSt.</Label>
                    <Select value={String(data.tax_rate ?? 19)}
                        onValueChange={v => onChange({ ...data, tax_rate: Number(v) })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {TAX_RATES.map(r => <SelectItem key={r} value={r}>{r}%</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                    <Input value={data.description || ''}
                        onChange={e => onChange({ ...data, description: e.target.value })}
                        placeholder="z.B. Metro, Miete…"
                        className="h-10" />
                </div>
            </div>
        </div>
    );
}

// ── Eintrag-Zeile ─────────────────────────────────────────────────────────────
function EntryRow({ entry, onEdit, onDelete }) {
    const style  = TYPE_STYLE[entry.entry_type] || TYPE_STYLE.Sonstiges;
    const Icon   = style.icon;
    const income = isIncome(entry.entry_type);
    const isAuto = entry.source === 'z_abschlag';

    return (
        <div onClick={onEdit}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-card hover:border-border cursor-pointer transition-all group min-h-[52px]">

            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', style.bg)}>
                <Icon className={cn('w-3.5 h-3.5', style.color)} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground truncate">
                        {entry.description || entry.category || entry.entry_type}
                    </p>
                    {isAuto && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded px-1 py-0.5 shrink-0">
                            <Zap className="w-2.5 h-2.5" />Auto
                        </span>
                    )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                    {entry.payment_method && `${entry.payment_method}`}
                    {entry.category && ` · ${entry.category}`}
                </p>
            </div>

            {entry.file_url && (
                <a href={entry.file_url} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-blue-400/60 hover:text-blue-400 p-1 shrink-0 transition-colors">
                    <FileText className="w-3.5 h-3.5" />
                </a>
            )}

            <div className="text-right shrink-0">
                <p className={cn('text-sm font-bold', income ? 'text-green-400' : 'text-red-400')}>
                    {income ? '+' : '−'}{fmt(entry.amount)} €
                </p>
            </div>

            {!isAuto && (
                <button onClick={e => { e.stopPropagation(); onDelete(); }}
                    className="opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 min-w-[28px] min-h-[28px] flex items-center justify-center shrink-0">
                    <Trash2 className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

// ── Haupt-Seite ───────────────────────────────────────────────────────────────
export default function AccountingCashbook() {
    const permissions = usePermissions();
    const queryClient = useQueryClient();

    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [typeFilter,    setTypeFilter]    = useState('alle');
    const [modalOpen,     setModalOpen]     = useState(false);
    const [editOpen,      setEditOpen]      = useState(false);
    const [deleteTarget,  setDeleteTarget]  = useState(null);
    const [selected,      setSelected]      = useState(null);
    const [formData,      setFormData]      = useState(EMPTY_FORM);
    const [editData,      setEditData]      = useState({});

    // ── Query ─────────────────────────────────────────────────────────────────
    const { data: entries = [], isLoading } = useQuery({
        queryKey: ['cashbook-entries'],
        queryFn:  () => base44.entities.CashbookEntry.list('-date', 500),
        staleTime: STALE.MEDIUM,
    });

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: d => base44.entities.CashbookEntry.create(d),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashbook-entries'] });
            setModalOpen(false);
            setFormData(EMPTY_FORM);
            toast.success('Buchung gespeichert');
        },
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.CashbookEntry.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashbook-entries'] });
            setEditOpen(false);
            toast.success('Buchung aktualisiert');
        },
        onError: () => toast.error('Fehler beim Aktualisieren'),
    });

    const deleteMutation = useMutation({
        mutationFn: id => base44.entities.CashbookEntry.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashbook-entries'] });
            setDeleteTarget(null);
            setEditOpen(false);
            toast.success('Buchung gelöscht');
        },
        onError: () => toast.error('Fehler beim Löschen'),
    });

    // ── Berechnungen ──────────────────────────────────────────────────────────
    const monthEntries = useMemo(() =>
        entries
            .filter(e => e.date?.startsWith(selectedMonth))
            .sort((a, b) => b.date.localeCompare(a.date)),
        [entries, selectedMonth]
    );

    const totals = useMemo(() => {
        const income  = monthEntries.filter(e => isIncome(e.entry_type)).reduce((s, e) => s + (e.amount || 0), 0);
        const expense = monthEntries.filter(e => !isIncome(e.entry_type)).reduce((s, e) => s + (e.amount || 0), 0);
        return { income, expense, balance: income - expense };
    }, [monthEntries]);

    // Kassenstand Bar = alle Bar-Einnahmen − alle Bar-Ausgaben des Monats
    const kasssenstandBar = useMemo(() => {
        const barIn  = monthEntries.filter(e => isIncome(e.entry_type) && e.payment_method === 'Bar').reduce((s, e) => s + (e.amount || 0), 0);
        const barOut = monthEntries.filter(e => !isIncome(e.entry_type) && e.payment_method === 'Bar').reduce((s, e) => s + (e.amount || 0), 0);
        return barIn - barOut;
    }, [monthEntries]);

    // Filter
    const filtered = useMemo(() => {
        if (typeFilter === 'einnahmen') return monthEntries.filter(e => isIncome(e.entry_type));
        if (typeFilter === 'ausgaben')  return monthEntries.filter(e => !isIncome(e.entry_type));
        if (typeFilter === 'auto')      return monthEntries.filter(e => e.source === 'z_abschlag');
        return monthEntries;
    }, [monthEntries, typeFilter]);

    // Nach Datum gruppieren
    const groupedByDate = useMemo(() => {
        const map = new Map();
        filtered.forEach(e => {
            if (!map.has(e.date)) map.set(e.date, []);
            map.get(e.date).push(e);
        });
        return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    }, [filtered]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const calcAndCreate = (d) => {
        const gross   = parseFloat(String(d.amount).replace(',', '.')) || 0;
        const taxRate = d.tax_rate || 0;
        const net     = gross / (1 + taxRate / 100);
        const tax     = gross - net;
        return { ...d, amount: gross, amount_net: Math.round(net * 100) / 100, tax_amount: Math.round(tax * 100) / 100 };
    };

    const handleCreate = () => createMutation.mutate(calcAndCreate(formData));
    const handleUpdate = () => {
        if (!selected) return;
        updateMutation.mutate({ id: selected.id, data: calcAndCreate(editData) });
    };

    const openEdit = entry => {
        setSelected(entry);
        setEditData({ ...entry });
        setEditOpen(true);
    };

    if (!permissions.canViewAccountingCashbook) {
        return <PermissionDenied message="Kein Zugriff auf das Kassenbuch." />;
    }

    const FILTERS = [
        { key: 'alle',      label: `Alle (${monthEntries.length})`  },
        { key: 'einnahmen', label: `Einnahmen (${monthEntries.filter(e => isIncome(e.entry_type)).length})` },
        { key: 'ausgaben',  label: `Ausgaben (${monthEntries.filter(e => !isIncome(e.entry_type)).length})` },
        { key: 'auto',      label: `⚡ Z-Abschlag (${monthEntries.filter(e => e.source === 'z_abschlag').length})` },
    ];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Kassenbuch</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">Einnahmen & Ausgaben · DATEV-Vorbereitung</p>
                    </div>
                    <Button onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}
                        className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                        <Plus className="w-4 h-4" /> Buchung
                    </Button>
                </div>

                {/* ── Monatsnavigation ────────────────────────────────────── */}
                <MonthNav value={selectedMonth} onChange={setSelectedMonth} />

                {/* ── Kassenstand Bar ──────────────────────────────────────── */}
                <div className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border',
                    kasssenstandBar >= 0
                        ? 'bg-green-500/6 border-green-500/20'
                        : 'bg-red-500/6 border-red-500/20'
                )}>
                    <Wallet className={cn('w-5 h-5 shrink-0', kasssenstandBar >= 0 ? 'text-green-400' : 'text-red-400')} />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground font-medium">Kassenstand Bar</p>
                        <p className={cn('text-lg font-bold tabular-nums', kasssenstandBar >= 0 ? 'text-green-400' : 'text-red-400')}>
                            {fmt(kasssenstandBar)} €
                        </p>
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                        Monat {format(new Date(selectedMonth + '-01'), 'MMM', { locale: de })}
                    </p>
                </div>

                {/* ── Monats-Summen ────────────────────────────────────────── */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-green-400 font-semibold uppercase tracking-wide">Einnahmen</p>
                        <p className="text-sm font-bold text-green-400 mt-0.5">{fmt(totals.income)} €</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wide">Ausgaben</p>
                        <p className="text-sm font-bold text-red-400 mt-0.5">{fmt(totals.expense)} €</p>
                    </div>
                    <div className={cn('border rounded-xl p-3 text-center',
                        totals.balance >= 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-red-500/10 border-red-500/20'
                    )}>
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Saldo</p>
                        <p className={cn('text-sm font-bold mt-0.5', totals.balance >= 0 ? 'text-blue-400' : 'text-red-400')}>
                            {fmt(totals.balance)} €
                        </p>
                    </div>
                </div>

                {/* ── Filter-Chips ─────────────────────────────────────────── */}
                <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                    {FILTERS.map(f => (
                        <button key={f.key} onClick={() => setTypeFilter(f.key)}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all',
                                typeFilter === f.key
                                    ? 'bg-amber-600 border-amber-600 text-white'
                                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                            )}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* ── Einträge gruppiert nach Datum ────────────────────────── */}
                {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">Lade…</div>
                ) : groupedByDate.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-semibold text-foreground">Keine Buchungen</p>
                        <p className="text-sm mt-1">
                            {typeFilter === 'auto'
                                ? 'Im Tagesabschluss auf „Ins Kassenbuch" tippen'
                                : 'Neue Buchung über den Button oben rechts'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedByDate.map(([date, dayEntries]) => {
                            const dayIncome  = dayEntries.filter(e => isIncome(e.entry_type)).reduce((s, e) => s + (e.amount || 0), 0);
                            const dayExpense = dayEntries.filter(e => !isIncome(e.entry_type)).reduce((s, e) => s + (e.amount || 0), 0);
                            const dayBalance = dayIncome - dayExpense;
                            const dateObj = parseISO(date);

                            return (
                                <div key={date}>
                                    {/* Tages-Trenner */}
                                    <div className="flex items-center justify-between mb-2 px-0.5">
                                        <p className="text-xs font-bold text-muted-foreground">
                                            {format(dateObj, 'EEE, dd. MMM', { locale: de })}
                                        </p>
                                        <p className={cn(
                                            'text-xs font-bold tabular-nums',
                                            dayBalance >= 0 ? 'text-green-400' : 'text-red-400'
                                        )}>
                                            {dayBalance >= 0 ? '+' : ''}{fmt(dayBalance)} €
                                        </p>
                                    </div>
                                    {/* Einträge des Tages */}
                                    <div className="space-y-1.5">
                                        {dayEntries.map(entry => (
                                            <EntryRow
                                                key={entry.id}
                                                entry={entry}
                                                onEdit={() => openEdit(entry)}
                                                onDelete={() => setDeleteTarget(entry.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Neue Buchung Dialog ──────────────────────────────────────── */}
            <Dialog open={modalOpen} onOpenChange={o => !o && setModalOpen(false)}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Neue Buchung</DialogTitle>
                    </DialogHeader>
                    <div className="py-1">
                        <EntryForm data={formData} onChange={setFormData} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Abbrechen</Button>
                        <Button onClick={handleCreate}
                            disabled={createMutation.isPending || !formData.amount}
                            className="bg-amber-600 hover:bg-amber-700 text-white flex-1">
                            {createMutation.isPending ? 'Speichert…' : 'Speichern'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Bearbeiten Dialog ────────────────────────────────────────── */}
            <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {selected?.source === 'z_abschlag' ? 'Buchung ansehen' : 'Buchung bearbeiten'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-1">
                        {selected?.source === 'z_abschlag' ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-blue-400">
                                    <Zap className="w-3.5 h-3.5 shrink-0" />
                                    Automatisch vom Tagesabschluss — nicht bearbeitbar
                                </div>
                                <div className="space-y-0">
                                    {[
                                        ['Datum',       selected?.date],
                                        ['Buchungsart', selected?.entry_type],
                                        ['Betrag',      `${fmt(selected?.amount)} €`],
                                        ['MwSt.',       `${selected?.tax_rate ?? 19}% (${fmt(selected?.tax_amount)} €)`],
                                        ['Kategorie',   selected?.category],
                                        ['Zahlungsart', selected?.payment_method],
                                        ['Beschreibung',selected?.description],
                                    ].filter(([, v]) => v).map(([label, val]) => (
                                        <div key={label} className="flex justify-between py-2.5 border-b border-border/40 last:border-0">
                                            <span className="text-sm text-muted-foreground">{label}</span>
                                            <span className="text-sm font-medium text-foreground">{val}</span>
                                        </div>
                                    ))}
                                    {selected?.file_url && (
                                        <a href={selected.file_url} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs pt-2">
                                            <FileText className="w-3.5 h-3.5" /> Z-Bon PDF öffnen
                                        </a>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <EntryForm data={editData} onChange={setEditData} />
                        )}
                    </div>
                    {selected?.source !== 'z_abschlag' && (
                        <DialogFooter className="gap-2 flex-row">
                            <Button variant="outline" size="sm"
                                onClick={() => setDeleteTarget(selected?.id)}
                                className="text-destructive border-destructive/30 hover:bg-destructive/10 h-9">
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />Löschen
                            </Button>
                            <Button onClick={handleUpdate}
                                disabled={updateMutation.isPending}
                                className="bg-amber-600 hover:bg-amber-700 text-white flex-1 h-9">
                                {updateMutation.isPending ? 'Speichert…' : 'Speichern'}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm ───────────────────────────────────────────── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Buchung löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Diese Buchung wird dauerhaft entfernt.
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