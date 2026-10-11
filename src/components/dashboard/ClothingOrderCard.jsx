/**
 * ClothingOrderCard — Wiederverwendbare Bestell-Runden für Arbeitskleidung.
 * Konfiguration kommt aus der ClothingRound-Entity (Deadline, Artikel, Aktiv-Status).
 * Manager starten eine neue Runde direkt in der Karte; Mitarbeiter sehen die aktive
 * Runde mit Countdown. Nach Deadline: Mitarbeiter sehen nichts mehr, Manager sehen
 * die Zusammenfassung und können die Runde abschließen. Bestellungen tragen eine
 * round_id; alte Runden bleiben als Historie erhalten.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shirt, CheckCircle2, Timer, Users, Pencil, Minus, Plus, CalendarClock, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const MAX_QTY = 5;
const ITEM_CATALOG = [
    { key: 'zshirt', label: 'Z-Shirt', sizeField: 'tshirt_size', emoji: '👕' },
    { key: 'pulli', label: 'Pulli', sizeField: 'pullover_size', emoji: '🧥' },
];

function useNow() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(t);
    }, []);
    return now;
}

function parseItems(raw) {
    try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr)
            ? ITEM_CATALOG.filter(i => arr.includes(i.key))
            : null;
    } catch {
        return null;
    }
}

function defaultDeadlineLocal() {
    const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    d.setHours(21, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function QtyStepper({ value, onChange }) {
    return (
        <div className="flex items-center gap-1.5">
            <button
                type="button"
                onClick={() => onChange(Math.max(1, value - 1))}
                disabled={value <= 1}
                className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-accent disabled:opacity-30"
                aria-label="weniger"
            >
                <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="min-w-[1.25rem] text-center text-sm font-semibold text-foreground">{value}</span>
            <button
                type="button"
                onClick={() => onChange(Math.min(MAX_QTY, value + 1))}
                disabled={value >= MAX_QTY}
                className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-accent disabled:opacity-30"
                aria-label="mehr"
            >
                <Plus className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

export default function ClothingOrderCard({ currentEmployee, isManager }) {
    const queryClient = useQueryClient();
    const now = useNow();
    const [pickers, setPickers] = useState({});
    const [quantities, setQuantities] = useState({});
    const [showNewRound, setShowNewRound] = useState(false);
    const [newDeadline, setNewDeadline] = useState(defaultDeadlineLocal());
    const [newName, setNewName] = useState('');
    const [newItems, setNewItems] = useState({ zshirt: true, pulli: true });

    const { data: rounds = [] } = useQuery({
        queryKey: ['clothingRounds'],
        queryFn: () => base44.entities.ClothingRound.filter({}),
        refetchInterval: 60000,
    });
    const activeRound = [...rounds]
        .filter(r => r.is_active)
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0] || null;

    const { data: allOrders = [] } = useQuery({
        queryKey: ['clothingOrders'],
        queryFn: () => base44.entities.ClothingOrder.filter({}),
        refetchInterval: 60000,
    });

    const roundOrders = activeRound
        ? allOrders.filter(o => o.round_id === activeRound.id)
        : [];

    const myOrders = roundOrders.filter(o => o.employee_id === currentEmployee?.id);
    const myOrderFor = (item) => myOrders.find(o => o.item === item);
    const qtyFor = (item, existing) => quantities[item] ?? existing?.quantity ?? 1;

    const orderMutation = useMutation({
        mutationFn: async ({ item, size, quantity, existingId }) => {
            if (existingId) {
                return base44.entities.ClothingOrder.update(existingId, { size, quantity });
            }
            return base44.entities.ClothingOrder.create({
                employee_id: currentEmployee.id,
                employee_name: currentEmployee.short_name || currentEmployee.first_name || '',
                item,
                size,
                quantity,
                round_id: activeRound.id,
            });
        },
        onSuccess: (data, vars) => {
            queryClient.invalidateQueries({ queryKey: ['clothingOrders'] });
            setPickers(p => ({ ...p, [vars.item]: false }));
            toast.success(vars.existingId
                ? 'Bestellung aktualisiert'
                : `${ITEM_CATALOG.find(i => i.key === vars.item)?.label || 'Bestellung'}: ${vars.quantity}× Größe ${vars.size} bestellt 🎉`);
        },
        onError: (error) => toast.error('Bestellung fehlgeschlagen: ' + error.message),
    });

    const startRoundMutation = useMutation({
        mutationFn: async ({ name, deadline, items }) => base44.entities.ClothingRound.create({
            round_name: name || `Bestellung bis ${new Date(deadline).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
            deadline: new Date(deadline).toISOString(),
            is_active: true,
            items: JSON.stringify(items),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clothingRounds'] });
            setShowNewRound(false);
            setNewDeadline(defaultDeadlineLocal());
            setNewName('');
            toast.success('Bestellrunde gestartet 🎽');
        },
        onError: (error) => toast.error('Runde konnte nicht gestartet werden: ' + error.message),
    });

    const closeRoundMutation = useMutation({
        mutationFn: () => base44.entities.ClothingRound.update(activeRound.id, { is_active: false }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clothingRounds'] });
            toast.success('Runde abgeschlossen');
        },
        onError: (error) => toast.error('Abschließen fehlgeschlagen: ' + error.message),
    });

    if (!currentEmployee) return null;
    if (!activeRound && !isManager) return null;

    // Keine aktive Runde: Manager kann neue Runde starten
    if (!activeRound && isManager) {
        return (
            <Card className="border-border/60">
                <CardContent className="pt-4 pb-4">
                    {showNewRound ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Shirt className="w-5 h-5 text-primary shrink-0" />
                                <p className="font-semibold text-foreground">Neue Klamotten-Bestellrunde</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Name (optional)</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="z.B. Frühjahr 2027"
                                    className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Bestell-Deadline (Standard: in 3 Tagen, 21:00 Uhr)</label>
                                <input
                                    type="datetime-local"
                                    value={newDeadline}
                                    onChange={(e) => setNewDeadline(e.target.value)}
                                    className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Artikel</label>
                                <div className="flex gap-2">
                                    {ITEM_CATALOG.map(({ key, label, emoji }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setNewItems(s => ({ ...s, [key]: !s[key] }))}
                                            className={cn(
                                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors',
                                                newItems[key]
                                                    ? 'bg-primary/15 border-primary/50 text-foreground'
                                                    : 'border-border text-muted-foreground'
                                            )}
                                        >
                                            <span>{emoji}</span> {label}
                                            {newItems[key] && <Check className="w-3.5 h-3.5 text-primary" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        const items = ITEM_CATALOG.filter(i => newItems[i.key]).map(i => i.key);
                                        if (items.length === 0) { toast.error('Mindestens einen Artikel auswählen'); return; }
                                        if (!newDeadline) { toast.error('Deadline angeben'); return; }
                                        startRoundMutation.mutate({ name: newName.trim(), deadline: newDeadline, items });
                                    }}
                                    disabled={startRoundMutation.isPending}
                                >
                                    {startRoundMutation.isPending ? '…' : 'Runde starten'}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setShowNewRound(false)}>Abbrechen</Button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowNewRound(true)}
                            className="w-full flex items-center justify-between gap-2 text-left"
                        >
                            <span className="flex items-center gap-2">
                                <Shirt className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Klamotten-Bestellung — keine aktive Runde</span>
                            </span>
                            <span className="text-xs font-medium text-primary flex items-center gap-1">
                                <CalendarClock className="w-3.5 h-3.5" /> Neue Runde starten
                            </span>
                        </button>
                    )}
                </CardContent>
            </Card>
        );
    }

    const deadline = new Date(activeRound.deadline);
    const remaining = deadline.getTime() - now.getTime();
    const expired = remaining <= 0;
    const hours = Math.max(0, Math.floor(remaining / (1000 * 60 * 60)));
    const minutes = Math.max(0, Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)));
    const items = parseItems(activeRound.items) || ITEM_CATALOG;

    if (expired && !isManager) return null;

    if (expired && isManager) {
        return (
            <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Shirt className="w-4 h-4 text-primary" />
                            <p className="text-sm font-semibold text-foreground">
                                {activeRound.round_name || 'Klamotten-Bestellung'} — abgeschlossen
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => closeRoundMutation.mutate()}
                            disabled={closeRoundMutation.isPending}
                        >
                            {closeRoundMutation.isPending ? '…' : 'Runde abschließen'}
                        </Button>
                    </div>
                    {items.map(({ key, label }) => {
                        const ofItem = roundOrders.filter(o => o.item === key);
                        const bySize = {};
                        let total = 0;
                        ofItem.forEach(o => {
                            const q = o.quantity || 1;
                            bySize[o.size] = (bySize[o.size] || 0) + q;
                            total += q;
                        });
                        return (
                            <div key={key} className="mb-1.5 last:mb-0">
                                <p className="text-sm text-foreground">
                                    {label}: {ofItem.length === 0 ? 'keine Bestellungen' : `${total}×`}
                                </p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {SIZES.filter(s => bySize[s]).map(s => (
                                        <span key={s} className="px-2 py-0.5 rounded-full bg-primary/10 text-xs font-medium text-primary">
                                            {s} × {bySize[s]}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        );
    }

    const countdownText = `${hours} Std ${minutes} Min`;

    return (
        <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Shirt className="w-5 h-5 text-primary shrink-0" />
                        <p className="font-semibold text-foreground">Klamotten-Bestellung</p>
                    </div>
                    <div className={cn(
                        'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
                        hours < 2 ? 'bg-red-500/15 text-red-500' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    )}>
                        <Timer className="w-3.5 h-3.5" />
                        noch {countdownText}
                    </div>
                </div>

                {items.map(({ key, label, sizeField, emoji }) => {
                    const existing = myOrderFor(key);
                    const profileSize = currentEmployee?.[sizeField];
                    const effectiveSize = existing?.size || profileSize;
                    const pickerOpen = pickers[key];
                    const qty = qtyFor(key, existing);

                    return (
                        <div key={key} className="p-2.5 rounded-lg bg-card/60 border border-border/60">
                            <div className="flex items-center gap-3">
                                <span className="text-xl shrink-0">{emoji}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{label}</p>
                                    {existing ? (
                                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                            bestellt — {existing.quantity || 1}× Größe {existing.size}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            {profileSize ? `Größe aus Personalakte: ${profileSize}` : 'Keine Größe in der Personalakte hinterlegt'}
                                        </p>
                                    )}
                                </div>

                                {existing && !pickerOpen ? (
                                    <button
                                        onClick={() => setPickers(p => ({ ...p, [key]: true }))}
                                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                    >
                                        <Pencil className="w-3 h-3" /> ändern
                                    </button>
                                ) : (profileSize || existing) && !pickerOpen ? (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <QtyStepper value={qty} onChange={(v) => setQuantities(q => ({ ...q, [key]: v }))} />
                                        <Button
                                            size="sm"
                                            onClick={() => orderMutation.mutate({ item: key, size: effectiveSize, quantity: qty, existingId: existing?.id })}
                                            disabled={orderMutation.isPending || !effectiveSize}
                                        >
                                            {orderMutation.isPending ? '…' : `${label} bestellen`}
                                        </Button>
                                    </div>
                                ) : null}
                            </div>

                            {pickerOpen && (
                                <div className="mt-2.5 pt-2.5 border-t border-border/60 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-muted-foreground">Menge</span>
                                        <QtyStepper value={qty} onChange={(v) => setQuantities(q => ({ ...q, [key]: v }))} />
                                    </div>
                                    <div className="flex flex-wrap gap-1 justify-end">
                                        {SIZES.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => orderMutation.mutate({ item: key, size: s, quantity: qty, existingId: existing?.id })}
                                                disabled={orderMutation.isPending}
                                                className={cn(
                                                    'px-2 py-1 rounded-md text-xs font-semibold border transition-colors',
                                                    existing?.size === s
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'border-border text-foreground hover:bg-accent'
                                                )}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setPickers(p => ({ ...p, [key]: false }))}
                                            className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            abbrechen
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!existing && !profileSize && !pickerOpen && (
                                <button
                                    onClick={() => setPickers(p => ({ ...p, [key]: true }))}
                                    className="mt-2.5 w-full text-xs text-primary font-medium py-1.5 rounded-md hover:bg-primary/10"
                                >
                                    Größe auswählen und bestellen
                                </button>
                            )}
                        </div>
                    );
                })}

                {isManager && roundOrders.length > 0 && (
                    <div className="pt-2 border-t border-border/60 flex items-start gap-2 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                            {items.map(({ key, label }) => {
                                const names = roundOrders.filter(o => o.item === key).map(o => `${o.employee_name || '?'} (${o.quantity || 1}× ${o.size})`);
                                return names.length ? `${label}: ${names.join(', ')}` : null;
                            }).filter(Boolean).join(' · ')}
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}