/**
 * Wusa.jsx — Wurstsalat-Bestellverwaltung
 * Jeden Dienstag: Vorbestellungen erfassen und Etiketten drucken.
 * Eine Bestellung kann mehrere "Sorten" enthalten (z.B. 4 Personen, jeder anders).
 */
import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, isTuesday, nextTuesday, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Plus, X, Printer, Clock, Phone, Trash2, Edit2, ChevronLeft, ChevronRight,
    Utensils, ShoppingBag, Loader2, Minus, User
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { usePermissions } from '@/components/auth/usePermissions';
import { STALE } from '@/lib/queryUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────

const INGREDIENTS = ['Wurst', 'Käse', 'Schwarzwurst', 'Paprika', 'Gurke', 'Zwiebel'];

function getNextTuesdays(count = 8) {
    const today = startOfDay(new Date());
    let tuesdays = [];
    let d = isTuesday(today) ? today : nextTuesday(today);
    for (let i = 0; i < count; i++) {
        tuesdays.push(d);
        d = addDays(d, 7);
    }
    return tuesdays;
}

function ingsToDisplay(ings) {
    if (!ings || ings === 'Alles') return 'Alles';
    return ings.split(',').join(' · ');
}

function ingsToLabel(ings) {
    if (!ings || ings === 'Alles') return 'Alles';
    return ings.split(',').join(' · ');
}

// ── Salad Line (eine Sorte innerhalb einer Sammelbestellung) ──────────────────

function SaladLine({ line, onChange, onRemove, canRemove }) {
    const toggleIngredient = (ing) => {
        let newIngs;
        if (ing === 'Alles') {
            newIngs = ['Alles'];
        } else {
            const without = line.ingredients.filter(i => i !== 'Alles');
            newIngs = without.includes(ing)
                ? without.filter(i => i !== ing)
                : [...without, ing];
        }
        onChange({ ...line, ingredients: newIngs });
    };

    return (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Salat {line.index}
                </span>
                {canRemove && (
                    <button onClick={onRemove} className="text-muted-foreground hover:text-destructive p-1">
                        <Minus className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Size */}
            <div className="flex gap-2">
                <button onClick={() => onChange({ ...line, size: 'gross' })}
                    className={cn('flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                        line.size === 'gross' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                    Groß
                </button>
                <button onClick={() => onChange({ ...line, size: 'klein' })}
                    className={cn('flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                        line.size === 'klein' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                    Klein
                </button>
            </div>

            {/* Ingredients */}
            <div className="flex flex-wrap gap-1.5">
                <button onClick={() => toggleIngredient('Alles')}
                    className={cn('px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all',
                        line.ingredients.includes('Alles') ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground')}>
                    Alles
                </button>
                {INGREDIENTS.map(ing => (
                    <button key={ing} onClick={() => toggleIngredient(ing)}
                        className={cn('px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all',
                            line.ingredients.includes(ing) ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground')}>
                        {ing}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Order Modal ───────────────────────────────────────────────────────────────

function OrderModal({ open, onClose, editItem, orderDate, isManager, onSaveAndPrint }) {
    const queryClient = useQueryClient();

    const [customerName, setCustomerName] = useState('');
    const [phone, setPhone] = useState('');
    const [pickupType, setPickupType] = useState('abholung');
    const [pickupTime, setPickupTime] = useState('');
    const [notes, setNotes] = useState('');
    const [source, setSource] = useState('persoenlich');
    // Multiple salad lines
    const [lines, setLines] = useState([{ size: 'gross', ingredients: ['Alles'] }]);
    const [printAfterSave, setPrintAfterSave] = useState(false);

    // Reset when modal opens
    useEffect(() => {
        if (!open) return;
        if (editItem) {
            setCustomerName(editItem.customer_name || '');
            setPhone(editItem.phone || '');
            setPickupType(editItem.pickup_type || 'abholung');
            setPickupTime(editItem.pickup_time || '');
            setNotes(editItem.notes || '');
            setSource(editItem.source || 'persoenlich');
            const ings = editItem.ingredients === 'Alles' || !editItem.ingredients
                ? ['Alles']
                : editItem.ingredients.split(',').map(s => s.trim());
            setLines([{ size: editItem.size || 'gross', ingredients: ings }]);
        } else {
            setCustomerName(''); setPhone(''); setPickupType('abholung');
            setPickupTime(''); setNotes(''); setSource('persoenlich');
            setLines([{ size: 'gross', ingredients: ['Alles'] }]);
        }
    }, [open, editItem]);

    const addLine = () => setLines(prev => [...prev, { size: 'gross', ingredients: ['Alles'] }]);
    const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));
    const updateLine = (idx, line) => setLines(prev => prev.map((l, i) => i === idx ? line : l));

    const ingredientsString = (ings) => {
        if (ings.includes('Alles') || ings.length === 0) return 'Alles';
        return ings.join(',');
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            const basePayload = {
                customer_name: customerName.trim(),
                phone: phone.trim() || null,
                pickup_type: pickupType,
                pickup_time: pickupTime || null,
                notes: notes.trim() || null,
                source,
                order_date: orderDate,
                status: 'offen',
                is_active: true,
                created_by_name: editItem?.created_by_name || 'Mitarbeiter',
            };

            if (editItem && lines.length === 1) {
                // Single edit — update existing record
                return base44.entities.WusaOrder.update(editItem.id, {
                    ...basePayload,
                    size: lines[0].size,
                    quantity: 1,
                    ingredients: ingredientsString(lines[0].ingredients),
                    price: editItem.price ?? null,
                });
            }

            // Multi-line: create one record per line
            // If editing, first delete old record, then create new ones
            const creates = lines.map(line => ({
                ...basePayload,
                size: line.size,
                quantity: 1,
                ingredients: ingredientsString(line.ingredients),
            }));

            if (editItem) {
                await base44.entities.WusaOrder.update(editItem.id, { is_active: false });
            }
            return Promise.all(creates.map(p => base44.entities.WusaOrder.create(p)));
        },
        onSuccess: async (result) => {
            queryClient.invalidateQueries({ queryKey: ['wusa-orders'] });
            toast.success(editItem ? 'Bestellung aktualisiert' : `${lines.length} Bestellung(en) hinzugefügt`);
            if (printAfterSave && onSaveAndPrint) {
                // Refresh orders then open label view for just this order
                const fresh = await base44.entities.WusaOrder.filter({ order_date: orderDate, is_active: true });
                const savedNames = editItem
                    ? [editItem.customer_name]
                    : lines.map(l => customerName.trim());
                const labelOrders = fresh.filter(o => savedNames.includes(o.customer_name));
                onSaveAndPrint(labelOrders);
            }
            setPrintAfterSave(false);
            onClose();
        },
        onError: (err) => toast.error('Fehler: ' + (err.message || 'Speichern fehlgeschlagen')),
    });

    if (!open) return null;

    const handleSaveAndPrint = () => {
        if (!customerName.trim()) return;
        setPrintAfterSave(true);
        saveMutation.mutate();
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                        <Utensils className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-bold text-foreground">
                            {editItem ? 'Bestellung bearbeiten' : 'Neue Vorbestellung'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            Dienstag, {format(new Date(orderDate), 'dd.MM.yyyy', { locale: de })}
                            {lines.length > 1 && ` · ${lines.length} Sorten`}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto px-5 py-4 space-y-4">
                    {/* Customer Name & Phone */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name *</label>
                            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Müller"
                                className="mt-1 w-full h-11 px-3 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Telefon</label>
                            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="optional"
                                className="mt-1 w-full h-11 px-3 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                    </div>

                    {/* Pickup */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Abholung / Vor Ort</label>
                            <div className="mt-1 flex gap-2">
                                <button onClick={() => setPickupType('abholung')}
                                    className={cn('flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all',
                                        pickupType === 'abholung' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                                    <ShoppingBag className="w-3.5 h-3.5 inline mr-1" />Abholung
                                </button>
                                <button onClick={() => setPickupType('vor_ort')}
                                    className={cn('flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all',
                                        pickupType === 'vor_ort' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                                    <Utensils className="w-3.5 h-3.5 inline mr-1" />Vor Ort
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Abholzeit</label>
                            <input type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)}
                                className="mt-1 w-full h-11 px-3 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                    </div>

                    {/* Salad Lines */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sorten</label>
                            <button onClick={addLine} className="text-xs text-primary font-medium flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" />Weitere Sorte
                            </button>
                        </div>
                        <div className="space-y-2.5">
                            {lines.map((line, idx) => (
                                <SaladLine
                                    key={idx}
                                    line={{ ...line, index: idx + 1 }}
                                    onChange={(updated) => updateLine(idx, updated)}
                                    onRemove={() => removeLine(idx)}
                                    canRemove={lines.length > 1}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Source (Manager only) */}
                    {isManager && (
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quelle</label>
                            <div className="mt-1 flex gap-2 flex-wrap">
                                {[
                                    { val: 'persoenlich', label: 'Persönlich' },
                                    { val: 'telefon', label: 'Telefon' },
                                    { val: 'whatsapp', label: 'WhatsApp' },
                                    { val: 'online', label: 'Online' },
                                ].map(s => (
                                    <button key={s.val} onClick={() => setSource(s.val)}
                                        className={cn('px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                                            source === s.val ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notiz</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="z.B. ohne Salatsoße, extra scharf…" rows={2}
                            className="mt-1 w-full px-3 py-2 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
                    <Button onClick={() => saveMutation.mutate()} disabled={!customerName.trim() || saveMutation.isPending}
                        className="w-full h-11 text-sm font-semibold">
                        {saveMutation.isPending ? 'Speichert…' : editItem ? 'Speichern' : `${lines.length} Bestellung(en) speichern`}
                    </Button>
                    {!editItem && (
                        <Button onClick={handleSaveAndPrint} disabled={!customerName.trim() || saveMutation.isPending}
                            variant="outline"
                            className="w-full h-11 text-sm font-semibold gap-2 border-primary/40 text-primary hover:bg-primary/5">
                            <Printer className="w-4 h-4" />
                            {saveMutation.isPending ? 'Speichert…' : 'Speichern & Etikett drucken'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Label View ────────────────────────────────────────────────────────────────

function LabelView({ orders, onClose }) {
    const abholOrders = orders.filter(o => o.pickup_type === 'abholung');

    if (abholOrders.length === 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
                <div className="relative z-10 bg-card border border-border rounded-2xl p-8 text-center max-w-sm">
                    <Printer className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Keine Abhol-Bestellungen zum Drucken.</p>
                    <Button onClick={onClose} variant="outline" className="mt-4">Schließen</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-lg mx-auto my-4 bg-card border border-border rounded-2xl shadow-2xl max-h-[95vh] flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
                    <Printer className="w-5 h-5 text-primary" />
                    <h3 className="text-base font-bold text-foreground flex-1">Etiketten — Abholbestellungen</h3>
                    <span className="text-xs text-muted-foreground">{abholOrders.length} Etikett(en)</span>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="px-5 py-3 border-b border-border shrink-0">
                    <Button onClick={() => window.print()} className="w-full h-11">
                        <Printer className="w-4 h-4 mr-2" />Alle Etiketten drucken
                    </Button>
                </div>
                <div className="overflow-y-auto px-5 py-4 space-y-4 print:overflow-visible print:h-auto">
                    <div className="print:hidden text-xs text-muted-foreground text-center pb-2">
                        Tipp: Im Druckdialog "Hintergrundgrafiken deaktivieren" für saubere Etiketten.
                    </div>
                    {abholOrders.map((order, idx) => (
                        <div key={order.id} className="label-print break-after-page pb-2" style={{ pageBreakAfter: 'always' }}>
                            <div className="border border-black p-3 bg-white text-black rounded" style={{ width: '100%', maxWidth: '62mm', margin: '0 auto' }}>
                                <div className="text-center font-bold text-sm mb-1.5 border-b border-black pb-1">
                                    🥗 Wurstsalat · To-Go
                                </div>
                                <div className="space-y-0.5 text-xs font-mono">
                                    <div className="flex justify-between">
                                        <span className="font-bold">Name:</span>
                                        <span className="text-right">{order.customer_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold">Größe:</span>
                                        <span>{order.size === 'gross' ? 'Groß' : 'Klein'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold">Zutaten:</span>
                                        <span className="text-right max-w-[60%]">{ingsToLabel(order.ingredients)}</span>
                                    </div>
                                    {order.pickup_time && (
                                        <div className="flex justify-between">
                                            <span className="font-bold">Abholzeit:</span>
                                            <span>{order.pickup_time}</span>
                                        </div>
                                    )}
                                    {order.price != null && (
                                        <div className="flex justify-between border-t border-black mt-1 pt-1">
                                            <span className="font-bold">Preis:</span>
                                            <span className="font-bold">{order.price.toFixed(2).replace('.', ',')} €</span>
                                        </div>
                                    )}
                                    {order.notes && (
                                        <div className="text-[10px] mt-1 italic border-t border-black/30 pt-1">
                                            {order.notes}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="print:hidden text-center text-[10px] text-muted-foreground mt-1">
                                Etikett {idx + 1} von {abholOrders.length}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Wusa() {
    const permissions = usePermissions();
    const isManager = permissions.isManager;
    const [selectedDate, setSelectedDate] = useState(() => format(getNextTuesdays(1)[0], 'yyyy-MM-dd'));
    const [modalOpen, setModalOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [labelOpen, setLabelOpen] = useState(false);
    const [labelOrders, setLabelOrders] = useState([]);

    const tuesdays = useMemo(() => getNextTuesdays(8), []);
    const dateIndex = tuesdays.findIndex(d => format(d, 'yyyy-MM-dd') === selectedDate);

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['wusa-orders', selectedDate],
        queryFn: () => base44.entities.WusaOrder.filter({ order_date: selectedDate, is_active: true }),
        refetchInterval: 30000,
        staleTime: STALE.FAST,
    });

    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.WusaOrder.update(id, { is_active: false }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wusa-orders'] });
            toast.success('Bestellung entfernt');
        },
    });

    // Group orders by customer_name for display
    const groupedOrders = useMemo(() => {
        const groups = {};
        orders.forEach(o => {
            const key = o.customer_name || 'Unbekannt';
            if (!groups[key]) groups[key] = [];
            groups[key].push(o);
        });
        // Sort groups by earliest pickup_time
        return Object.entries(groups).sort(([, a], [, b]) => {
            const aTime = a[0]?.pickup_time || 'zzz';
            const bTime = b[0]?.pickup_time || 'zzz';
            return aTime.localeCompare(bTime);
        });
    }, [orders]);

    // Stats
    const stats = useMemo(() => {
        const gross = orders.filter(o => o.size === 'gross').length;
        const klein = orders.filter(o => o.size === 'klein').length;
        const abholung = orders.filter(o => o.pickup_type === 'abholung').length;
        const vorOrt = orders.filter(o => o.pickup_type === 'vor_ort').length;
        return { gross, klein, abholung, vorOrt, total: orders.length, customers: groupedOrders.length };
    }, [orders, groupedOrders]);

    const handleEdit = (order) => {
        setEditItem(order);
        setModalOpen(true);
    };

    const handleCreate = () => {
        setEditItem(null);
        setModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-background pb-28 md:pb-8">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .label-print, .label-print * { visibility: visible; }
                    .label-print { position: relative; page-break-after: always; }
                    .break-after-page { page-break-after: always; }
                    @page { margin: 5mm; }
                }
            `}</style>
            <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                            🥗 Wurstsalat
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Vorbestellungen · jeden Dienstag
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setLabelOrders([]); setLabelOpen(true); }}
                        disabled={orders.filter(o => o.pickup_type === 'abholung').length === 0}>
                        <Printer className="w-4 h-4 mr-1.5" />Etiketten
                    </Button>
                </div>

                {/* Date Selector */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <button
                        onClick={() => dateIndex > 0 && setSelectedDate(format(tuesdays[dateIndex - 1], 'yyyy-MM-dd'))}
                        disabled={dateIndex <= 0}
                        className="shrink-0 p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    {tuesdays.map((d, i) => (
                        <button
                            key={i}
                            onClick={() => setSelectedDate(format(d, 'yyyy-MM-dd'))}
                            className={cn(
                                'shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                                format(d, 'yyyy-MM-dd') === selectedDate
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {format(d, 'dd.MM.', { locale: de })}
                            {i === 0 && ' (heute)'}
                        </button>
                    ))}
                    <button
                        onClick={() => dateIndex < tuesdays.length - 1 && setSelectedDate(format(tuesdays[dateIndex + 1], 'yyyy-MM-dd'))}
                        disabled={dateIndex >= tuesdays.length - 1}
                        className="shrink-0 p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Stats */}
                {stats.total > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                        <Card className="bg-card border-border">
                            <CardContent className="p-2.5 text-center">
                                <p className="text-base font-bold text-foreground leading-none">{stats.total}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Salate</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-border">
                            <CardContent className="p-2.5 text-center">
                                <p className="text-base font-bold text-green-400 leading-none">{stats.gross}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Groß</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-border">
                            <CardContent className="p-2.5 text-center">
                                <p className="text-base font-bold text-blue-400 leading-none">{stats.klein}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Klein</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-border">
                            <CardContent className="p-2.5 text-center">
                                <p className="text-base font-bold text-amber-400 leading-none">{stats.abholung}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Abholung</p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Add Button */}
                <Button onClick={handleCreate} className="w-full h-11">
                    <Plus className="w-4 h-4 mr-2" />Vorbestellung hinzufügen
                </Button>

                {/* Order List — grouped by customer */}
                {isLoading ? (
                    <Card className="bg-card border-border">
                        <CardContent className="p-6 text-center">
                            <Loader2 className="w-5 h-5 text-muted-foreground mx-auto animate-spin" />
                        </CardContent>
                    </Card>
                ) : groupedOrders.length === 0 ? (
                    <Card className="bg-card border-border">
                        <CardContent className="p-6 text-center">
                            <Utensils className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Noch keine Bestellungen für diesen Dienstag.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {groupedOrders.map(([customerName, custOrders]) => {
                            const firstOrder = custOrders[0];
                            const hasMultiple = custOrders.length > 1;
                            return (
                                <Card key={customerName} className="border bg-card overflow-hidden">
                                    {/* Customer header */}
                                    <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 border-b border-border/50">
                                        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <p className="text-sm font-semibold text-foreground flex-1 truncate">{customerName}</p>
                                        {hasMultiple && (
                                            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                                {custOrders.length} Salate
                                            </span>
                                        )}
                                        {firstOrder.pickup_type === 'abholung' ? (
                                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><ShoppingBag className="w-3 h-3" />Abholung</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Utensils className="w-3 h-3" />Vor Ort</span>
                                        )}
                                        {firstOrder.pickup_time && (
                                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="w-3 h-3" />{firstOrder.pickup_time}</span>
                                        )}
                                        {firstOrder.phone && (
                                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70"><Phone className="w-2.5 h-2.5" />{firstOrder.phone}</span>
                                        )}
                                    </div>

                                    {/* Salad lines */}
                                    <div className="divide-y divide-border/50">
                                        {custOrders.map((order, idx) => (
                            <CardContent className="p-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
                                                order.size === 'gross' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400')}>
                                                {order.size === 'gross' ? 'Groß' : 'Klein'}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{ingsToDisplay(order.ingredients)}</span>
                                        </div>
                                        {order.notes && (
                                            <p className="text-xs text-amber-400/80 mt-1 italic">📝 {order.notes}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => handleEdit(order)}
                                            className="text-muted-foreground hover:text-primary p-1 transition-colors">
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => deleteMutation.mutate(order.id)}
                                            className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </CardContent>
                        ))}
                    </div>
                </Card>
            );
        })}
    </div>
            )}

            {/* Modals */}
            <OrderModal
                open={modalOpen}
                onClose={() => { setModalOpen(false); setEditItem(null); }}
                editItem={editItem}
                orderDate={selectedDate}
                isManager={isManager}
                onSaveAndPrint={(savedOrders) => {
                    setLabelOrders(savedOrders);
                    setLabelOpen(true);
                }}
            />
            {labelOpen && <LabelView orders={labelOrders.length > 0 ? labelOrders : orders} onClose={() => { setLabelOpen(false); setLabelOrders([]); }} />}
            </div>
        </div>
    );
}