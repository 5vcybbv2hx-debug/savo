/**
 * Wusa.jsx — Wurstsalat-Bestellverwaltung
 * Jeden Dienstag: Vorbestellungen erfassen und Etiketten drucken.
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, isTuesday, nextTuesday, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Plus, X, Printer, Clock, Phone, Trash2, Edit2, ChevronLeft, ChevronRight,
    Utensils, ShoppingBag, Loader2
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

// ── Order Modal ───────────────────────────────────────────────────────────────

function OrderModal({ open, onClose, editItem, orderDate, currentUser, isManager }) {
    const queryClient = useQueryClient();
    const [customerName, setCustomerName] = useState(editItem?.customer_name || '');
    const [phone, setPhone] = useState(editItem?.phone || '');
    const [size, setSize] = useState(editItem?.size || 'gross');
    const [quantity, setQuantity] = useState(editItem?.quantity || 1);
    const [selectedIngredients, setSelectedIngredients] = useState(() => {
        if (editItem?.ingredients === 'Alles') return ['Alles'];
        if (editItem?.ingredients) return editItem.ingredients.split(',').map(s => s.trim());
        return ['Alles'];
    });
    const [pickupType, setPickupType] = useState(editItem?.pickup_type || 'abholung');
    const [pickupTime, setPickupTime] = useState(editItem?.pickup_time || '');
    const [price, setPrice] = useState(editItem?.price ?? '');
    const [notes, setNotes] = useState(editItem?.notes || '');
    const [source, setSource] = useState(editItem?.source || 'persoenlich');

    const toggleIngredient = (ing) => {
        if (ing === 'Alles') {
            setSelectedIngredients(['Alles']);
        } else {
            setSelectedIngredients(prev => {
                const without = prev.filter(i => i !== 'Alles');
                return without.includes(ing)
                    ? without.filter(i => i !== ing)
                    : [...without, ing];
            });
        }
    };

    const ingredientsString = selectedIngredients.includes('Alles')
        ? 'Alles'
        : selectedIngredients.length === 0 ? 'Alles' : selectedIngredients.join(',');

    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                customer_name: customerName.trim(),
                phone: phone.trim() || null,
                size,
                quantity: Math.max(1, quantity || 1),
                ingredients: ingredientsString,
                pickup_type: pickupType,
                pickup_time: pickupTime || null,
                price: price !== '' ? Number(price) : null,
                notes: notes.trim() || null,
                source,
                order_date: orderDate,
                status: 'offen',
                is_active: true,
                created_by_name: editItem?.created_by_name || currentUser?.full_name || currentUser?.email || 'Mitarbeiter',
            };
            if (editItem) {
                return base44.entities.WusaOrder.update(editItem.id, payload);
            }
            return base44.entities.WusaOrder.create(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wusa-orders'] });
            toast.success(editItem ? 'Bestellung aktualisiert' : 'Bestellung hinzugefügt');
            onClose();
        },
        onError: (err) => toast.error('Fehler: ' + (err.message || 'Speichern fehlgeschlagen')),
    });

    if (!open) return null;

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
                        <p className="text-xs text-muted-foreground">Für Dienstag, {format(new Date(orderDate), 'dd.MM.yyyy', { locale: de })}</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto px-5 py-4 space-y-4">
                    {/* Name & Phone */}
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

                    {/* Size & Quantity */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Größe</label>
                            <div className="mt-1 flex gap-2">
                                <button onClick={() => setSize('gross')}
                                    className={cn('flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all',
                                        size === 'gross' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                                    Groß
                                </button>
                                <button onClick={() => setSize('klein')}
                                    className={cn('flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all',
                                        size === 'klein' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                                    Klein
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Anzahl</label>
                            <input type="number" min="1" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                                className="mt-1 w-full h-11 px-3 rounded-xl border border-input bg-transparent text-foreground text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                    </div>

                    {/* Ingredients */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zutaten</label>
                        <div className="mt-1 flex flex-wrap gap-2">
                            <button onClick={() => toggleIngredient('Alles')}
                                className={cn('px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                                    selectedIngredients.includes('Alles') ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground')}>
                                Alles
                            </button>
                            {INGREDIENTS.map(ing => (
                                <button key={ing} onClick={() => toggleIngredient(ing)}
                                    className={cn('px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                                        selectedIngredients.includes(ing) ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground')}>
                                    {ing}
                                </button>
                            ))}
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

                    {/* Price */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preis (€)</label>
                        <input type="number" step="0.50" min="0" value={price} onChange={e => setPrice(e.target.value)}
                            placeholder="z.B. 7.50"
                            className="mt-1 w-full h-11 px-3 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
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
                <div className="px-5 py-4 border-t border-border shrink-0">
                    <Button onClick={() => saveMutation.mutate()} disabled={!customerName.trim() || saveMutation.isPending}
                        className="w-full h-11 text-sm font-semibold">
                        {saveMutation.isPending ? 'Speichert…' : editItem ? 'Speichern' : 'Bestellung hinzufügen'}
                    </Button>
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
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
                    <Printer className="w-5 h-5 text-primary" />
                    <h3 className="text-base font-bold text-foreground flex-1">Etiketten — Abholbestellungen</h3>
                    <span className="text-xs text-muted-foreground">{abholOrders.length} Etikett(en)</span>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Print button */}
                <div className="px-5 py-3 border-b border-border shrink-0">
                    <Button onClick={() => window.print()} className="w-full h-11">
                        <Printer className="w-4 h-4 mr-2" />Alle Etiketten drucken
                    </Button>
                </div>

                {/* Labels */}
                <div className="overflow-y-auto px-5 py-4 space-y-4 print:overflow-visible print:h-auto">
                    <div className="print:hidden text-xs text-muted-foreground text-center pb-2">
                        Tipp: Im Druckdialog "Hintergrundgrafiken deaktivieren" für saubere Etiketten.
                    </div>
                    {abholOrders.map((order, idx) => {
                        const ings = order.ingredients || 'Alles';
                        const ingList = ings === 'Alles' ? 'Alles' : ings.split(',').join(' · ');
                        return (
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
                                            <span>{order.size === 'gross' ? 'Groß' : 'Klein'}{order.quantity > 1 ? ` ×${order.quantity}` : ''}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="font-bold">Zutaten:</span>
                                            <span className="text-right max-w-[60%]">{ingList}</span>
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
                        );
                    })}
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

    // Stats
    const stats = useMemo(() => {
        const gross = orders.filter(o => o.size === 'gross').reduce((sum, o) => sum + (o.quantity || 1), 0);
        const klein = orders.filter(o => o.size === 'klein').reduce((sum, o) => sum + (o.quantity || 1), 0);
        const abholung = orders.filter(o => o.pickup_type === 'abholung').length;
        const vorOrt = orders.filter(o => o.pickup_type === 'vor_ort').length;
        const totalPrice = orders.reduce((sum, o) => sum + (o.price || 0) * (o.quantity || 1), 0);
        return { gross, klein, abholung, vorOrt, totalPrice, total: orders.length };
    }, [orders]);

    const handleEdit = (order) => {
        setEditItem(order);
        setModalOpen(true);
    };

    const handleCreate = () => {
        setEditItem(null);
        setModalOpen(true);
    };

    const sortedOrders = [...orders].sort((a, b) => {
        if (a.pickup_time && b.pickup_time) return a.pickup_time.localeCompare(b.pickup_time);
        if (a.pickup_time) return -1;
        if (b.pickup_time) return 1;
        return a.customer_name.localeCompare(b.customer_name);
    });

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
                    <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setLabelOpen(true)}
                            disabled={orders.filter(o => o.pickup_type === 'abholung').length === 0}>
                            <Printer className="w-4 h-4 mr-1.5" />Etiketten
                        </Button>
                    </div>
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
                                <p className="text-[10px] text-muted-foreground mt-1">Bestellungen</p>
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

                {/* Order List */}
                {isLoading ? (
                    <Card className="bg-card border-border">
                        <CardContent className="p-6 text-center">
                            <Loader2 className="w-5 h-5 text-muted-foreground mx-auto animate-spin" />
                        </CardContent>
                    </Card>
                ) : sortedOrders.length === 0 ? (
                    <Card className="bg-card border-border">
                        <CardContent className="p-6 text-center">
                            <Utensils className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Noch keine Bestellungen für diesen Dienstag.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {sortedOrders.map(order => {
                            const ings = order.ingredients || 'Alles';
                            const ingDisplay = ings === 'Alles' ? 'Alles' : ings.split(',').join(' · ');

                            return (
                                <Card key={order.id} className="border bg-card">
                                    <CardContent className="p-3">
                                        <div className="flex items-start gap-3">
                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-semibold text-foreground">{order.customer_name}</p>
                                                    {order.quantity > 1 && (
                                                        <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                                            ×{order.quantity}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                                                    <span className="font-medium">{order.size === 'gross' ? 'Groß' : 'Klein'}</span>
                                                    <span>·</span>
                                                    <span>{ingDisplay}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                                                    {order.pickup_type === 'abholung' ? (
                                                        <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" />Abholung</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1"><Utensils className="w-3 h-3" />Vor Ort</span>
                                                    )}
                                                    {order.pickup_time && (
                                                        <>
                                                            <span>·</span>
                                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{order.pickup_time}</span>
                                                        </>
                                                    )}
                                                    {order.price != null && (
                                                        <>
                                                            <span>·</span>
                                                            <span className="font-medium text-foreground">{order.price.toFixed(2).replace('.', ',')} €</span>
                                                        </>
                                                    )}
                                                </div>
                                                {order.notes && (
                                                    <p className="text-xs text-amber-400/80 mt-1 italic">📝 {order.notes}</p>
                                                )}
                                                {order.phone && (
                                                    <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                                                        <Phone className="w-2.5 h-2.5" />{order.phone}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-1 shrink-0">
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
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modals */}
            <OrderModal
                open={modalOpen}
                onClose={() => { setModalOpen(false); setEditItem(null); }}
                editItem={editItem}
                orderDate={selectedDate}
                currentUser={null}
                isManager={isManager}
            />
            {labelOpen && <LabelView orders={orders} onClose={() => setLabelOpen(false)} />}
        </div>
    );
}
