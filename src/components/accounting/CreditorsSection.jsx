/**
 * CreditorsSection — Lieferantenrechnungen verwalten
 * Extrahiert aus AccountingCreditors.jsx für die Einbettung in AccountingPayables.
 *
 * Enthält die KOMPLETTE Funktionalität: CreditorInvoice + Supplier,
 * Status-Filter, Bezahlt-Aktion mit Confirm-Dialog (Zahlungsart + Datum),
 * Bearbeiten/Löschen, v2-Verbesserungen.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
    Plus, TrendingDown, Search, AlertTriangle, CheckCircle2,
    Clock, Trash2, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isAfter, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

// ── Konstanten ────────────────────────────────────────────────────────────────
const fmt = n => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TAX_RATES    = ['0', '7', '19'];
const PAY_METHODS  = ['Bar', 'EC', 'Überweisung', 'Sonstiges'];
const CATEGORIES   = ['Getränke', 'Lebensmittel', 'Reinigung', 'Personal', 'Miete', 'Energie', 'GEMA', 'Versicherung', 'Software', 'Büro', 'Marketing', 'Sonstiges'];

const STATUS_CONFIG = {
    offen:       { label: 'Offen',      color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: Clock         },
    teilbezahlt: { label: 'Teilbezahlt',color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  icon: AlertTriangle  },
    überfällig:  { label: 'Überfällig', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    icon: AlertTriangle  },
    bezahlt:     { label: 'Bezahlt',    color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  icon: CheckCircle2   },
};

const EMPTY_FORM = {
    invoice_number: '',
    invoice_date:   format(new Date(), 'yyyy-MM-dd'),
    due_date:       '',
    supplier_name:  '',
    amount_gross:   '',
    tax_rate:       19,
    category:       '',
    payment_status: 'offen',
    notes:          '',
};

// ── Rechnungs-Formular ────────────────────────────────────────────────────────
function InvoiceForm({ data, onChange }) {
    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Lieferant *</Label>
                <Input value={data.supplier_name || ''}
                    onChange={e => onChange({ ...data, supplier_name: e.target.value })}
                    placeholder="z.B. Metro, Edeka, Stadtwerke…"
                    className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Rechnungsdatum *</Label>
                    <Input type="date" value={data.invoice_date || ''}
                        onChange={e => onChange({ ...data, invoice_date: e.target.value })}
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
                    <Label className="text-xs text-muted-foreground">Brutto (€) *</Label>
                    <Input type="number" step="0.01" placeholder="0,00"
                        value={data.amount_gross || ''}
                        onChange={e => onChange({ ...data, amount_gross: e.target.value })}
                        className="h-10" />
                </div>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Rechnungsnr.</Label>
                    <Input value={data.invoice_number || ''}
                        onChange={e => onChange({ ...data, invoice_number: e.target.value })}
                        placeholder="Optional"
                        className="h-10" />
                </div>
            </div>
        </div>
    );
}

// ── Rechnungs-Karte ───────────────────────────────────────────────────────────
function InvoiceCard({ invoice, onEdit, onPay, onDelete }) {
    const sc     = STATUS_CONFIG[invoice.payment_status] || STATUS_CONFIG.offen;
    const Icon   = sc.icon;
    const today  = new Date();
    const daysOverdue = invoice.due_date && invoice.payment_status !== 'bezahlt'
        ? differenceInDays(today, new Date(invoice.due_date))
        : null;

    return (
        <div onClick={onEdit}
            className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border/50 bg-card hover:border-border cursor-pointer transition-all group min-h-[64px]">

            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', sc.bg)}>
                <Icon className={cn('w-4 h-4', sc.color)} />
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                    {invoice.supplier_name || 'Unbekannt'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <p className="text-[11px] text-muted-foreground">
                        {invoice.invoice_date ? format(new Date(invoice.invoice_date), 'dd.MM.yy') : '—'}
                    </p>
                    {invoice.due_date && invoice.payment_status !== 'bezahlt' && (
                        <p className={cn('text-[11px] font-medium',
                            daysOverdue > 0 ? 'text-red-400' : 'text-muted-foreground'
                        )}>
                            · {daysOverdue > 0
                                ? `${daysOverdue}d überfällig`
                                : `fällig ${format(new Date(invoice.due_date), 'dd.MM.')}`
                            }
                        </p>
                    )}
                    {invoice.category && (
                        <p className="text-[11px] text-muted-foreground">· {invoice.category}</p>
                    )}
                </div>
            </div>

            <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <p className="text-sm font-bold text-foreground">{fmt(invoice.amount_gross)} €</p>
                {invoice.payment_status !== 'bezahlt' && (
                    <button onClick={e => { e.stopPropagation(); onPay(); }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-all min-h-[22px]">
                        Bezahlt ✓
                    </button>
                )}
            </div>

            <button onClick={e => { e.stopPropagation(); onDelete(); }}
                className="opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 min-w-[28px] min-h-[28px] flex items-center justify-center shrink-0">
                <Trash2 className="w-3 h-3" />
            </button>
        </div>
    );
}

// ── Sektion ──────────────────────────────────────────────────────────────────
export default function CreditorsSection({ onTotalsChange }) {
    const queryClient = useQueryClient();

    const [statusFilter, setStatusFilter] = useState('offen');
    const [searchOpen,   setSearchOpen]   = useState(false);
    const [search,       setSearch]       = useState('');
    const [modalOpen,    setModalOpen]    = useState(false);
    const [editOpen,     setEditOpen]     = useState(false);
    const [payOpen,      setPayOpen]      = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [selected,     setSelected]     = useState(null);
    const [formData,     setFormData]     = useState(EMPTY_FORM);
    const [editData,     setEditData]     = useState({});
    const [payData,      setPayData]      = useState({ paid_date: format(new Date(), 'yyyy-MM-dd'), payment_method: 'Überweisung' });

    const { data: invoices = [] } = useQuery({
        queryKey: ['creditor-invoices'],
        queryFn:  () => base44.entities.CreditorInvoice.list('-invoice_date', 300),
    });

    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers'],
        queryFn:  () => base44.entities.Supplier.list('name'),
    });

    const createMutation = useMutation({
        mutationFn: d => base44.entities.CreditorInvoice.create(d),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['creditor-invoices'] });
            setModalOpen(false);
            setFormData(EMPTY_FORM);
            toast.success('Rechnung erfasst');
        },
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.CreditorInvoice.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['creditor-invoices'] });
            setEditOpen(false);
            setPayOpen(false);
            toast.success('Gespeichert');
        },
        onError: () => toast.error('Fehler beim Aktualisieren'),
    });

    const deleteMutation = useMutation({
        mutationFn: id => base44.entities.CreditorInvoice.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['creditor-invoices'] });
            setDeleteTarget(null);
            setEditOpen(false);
            toast.success('Rechnung gelöscht');
        },
        onError: () => toast.error('Fehler beim Löschen'),
    });

    const enriched = useMemo(() => invoices.map(inv => {
        const isOverdue = inv.payment_status === 'offen' &&
            inv.due_date && isAfter(new Date(), new Date(inv.due_date));
        return { ...inv, payment_status: isOverdue ? 'überfällig' : inv.payment_status };
    }), [invoices]);

    const filtered = useMemo(() => {
        let list = enriched;
        if (statusFilter !== 'alle') list = list.filter(i => i.payment_status === statusFilter);
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(i =>
                i.supplier_name?.toLowerCase().includes(q) ||
                i.invoice_number?.includes(q)
            );
        }
        return list;
    }, [enriched, statusFilter, search]);

    const totals = useMemo(() => {
        const open    = enriched.filter(i => i.payment_status !== 'bezahlt').reduce((s, i) => s + ((i.amount_gross || 0) - (i.paid_amount || 0)), 0);
        const overdue = enriched.filter(i => i.payment_status === 'überfällig').reduce((s, i) => s + (i.amount_gross || 0), 0);
        const overdueCount = enriched.filter(i => i.payment_status === 'überfällig').length;
        const counts  = { offen: 0, teilbezahlt: 0, überfällig: 0, bezahlt: 0 };
        enriched.forEach(i => { if (counts[i.payment_status] !== undefined) counts[i.payment_status]++; });
        return { open, overdue, overdueCount, counts };
    }, [enriched]);

    useEffect(() => { onTotalsChange?.(totals); }, [totals, onTotalsChange]);

    const handleCreate = () => {
        if (!formData.supplier_name || !formData.invoice_date || !formData.amount_gross) {
            toast.error('Lieferant, Datum und Betrag sind Pflichtfelder');
            return;
        }
        const gross = parseFloat(formData.amount_gross) || 0;
        const rate  = formData.tax_rate || 0;
        const net   = gross / (1 + rate / 100);
        createMutation.mutate({
            ...formData,
            amount_gross: gross,
            amount_net:   Math.round(net * 100) / 100,
            tax_amount:   Math.round((gross - net) * 100) / 100,
        });
    };

    const handleUpdate = () => {
        if (!selected) return;
        const gross = parseFloat(editData.amount_gross) || 0;
        const rate  = editData.tax_rate || 0;
        const net   = gross / (1 + rate / 100);
        updateMutation.mutate({
            id: selected.id,
            data: { ...editData, amount_gross: gross, amount_net: Math.round(net * 100) / 100, tax_amount: Math.round((gross - net) * 100) / 100 },
        });
    };

    const handlePay = () => {
        if (!selected) return;
        updateMutation.mutate({
            id: selected.id,
            data: {
                payment_status:  'bezahlt',
                paid_date:       payData.paid_date,
                payment_method:  payData.payment_method,
            },
        });
    };

    const openEdit = inv => {
        setSelected(inv);
        setEditData({ ...inv });
        setEditOpen(true);
    };

    const openPay = inv => {
        setSelected(inv);
        setPayData({ paid_date: format(new Date(), 'yyyy-MM-dd'), payment_method: 'Überweisung' });
        setPayOpen(true);
    };

    const FILTERS = [
        { key: 'alle',       label: `Alle (${enriched.length})`              },
        { key: 'überfällig', label: `Überfällig (${totals.counts.überfällig})` },
        { key: 'offen',      label: `Offen (${totals.counts.offen})`          },
        { key: 'teilbezahlt',label: `Teilbezahlt (${totals.counts.teilbezahlt})` },
        { key: 'bezahlt',    label: `Bezahlt (${totals.counts.bezahlt})`      },
    ];

    return (
        <div className="space-y-3">
            {/* Sektions-Header */}
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-base font-bold text-foreground">Lieferantenrechnungen</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Eingangsrechnungen · {enriched.length} Einträge</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setSearchOpen(s => !s); if (searchOpen) setSearch(''); }}
                        className={cn(
                            'w-9 h-9 flex items-center justify-center rounded-lg border transition-all',
                            searchOpen
                                ? 'bg-accent border-border text-foreground'
                                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                        )}>
                        {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                    </button>
                    <Button onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}
                        className="h-9 bg-red-600 hover:bg-red-700 text-white gap-1.5">
                        <Plus className="w-4 h-4" /> Rechnung
                    </Button>
                </div>
            </div>

            {searchOpen && (
                <Input autoFocus
                    placeholder="Lieferant oder Rechnungsnr. suchen…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-10" />
            )}

            <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                {FILTERS.map(f => (
                    <button key={f.key} onClick={() => setStatusFilter(f.key)}
                        className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all',
                            statusFilter === f.key
                                ? f.key === 'überfällig'
                                    ? 'bg-red-600 border-red-600 text-white'
                                    : 'bg-amber-600 border-amber-600 text-white'
                                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                        )}>
                        {f.label}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                    <TrendingDown className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="font-semibold text-foreground text-sm">
                        {statusFilter === 'überfällig' ? 'Keine überfälligen Rechnungen' :
                         statusFilter === 'offen' ? 'Keine offenen Rechnungen' :
                         'Keine Rechnungen'}
                    </p>
                    <p className="text-xs mt-1">Neue Rechnung über den Button oben erfassen</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(inv => (
                        <InvoiceCard
                            key={inv.id}
                            invoice={inv}
                            onEdit={() => openEdit(inv)}
                            onPay={() => openPay(inv)}
                            onDelete={() => setDeleteTarget(inv.id)}
                        />
                    ))}
                </div>
            )}

            {/* Neue Rechnung Dialog */}
            <Dialog open={modalOpen} onOpenChange={o => !o && setModalOpen(false)}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Eingangsrechnung erfassen</DialogTitle>
                    </DialogHeader>
                    <div className="py-1">
                        <InvoiceForm data={formData} onChange={setFormData} />
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

            {/* Bearbeiten Dialog */}
            <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Rechnung bearbeiten</DialogTitle>
                    </DialogHeader>
                    <div className="py-1">
                        <InvoiceForm data={editData} onChange={setEditData} />
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

            {/* Bezahlt-Dialog */}
            <Dialog open={payOpen} onOpenChange={o => !o && setPayOpen(false)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Rechnung als bezahlt markieren</DialogTitle>
                    </DialogHeader>
                    <div className="py-1 space-y-3">
                        {selected && (
                            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary/40 border border-border/40">
                                <p className="text-sm font-semibold text-foreground">{selected.supplier_name}</p>
                                <p className="text-sm font-bold text-foreground">{fmt(selected.amount_gross)} €</p>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Zahlungsdatum</Label>
                            <Input type="date" value={payData.paid_date}
                                onChange={e => setPayData({ ...payData, paid_date: e.target.value })}
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPayOpen(false)}>Abbrechen</Button>
                        <Button onClick={handlePay}
                            disabled={updateMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white flex-1">
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            {updateMutation.isPending ? 'Speichert…' : 'Als bezahlt markieren'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm */}
            <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rechnung löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Diese Eingangsrechnung wird dauerhaft entfernt.
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