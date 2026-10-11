/**
 * ClothingOrderCard — Bestell-Aktion für Arbeitskleidung auf dem Dashboard.
 * Zwei Direkt-Buttons (Z-Shirt / Pulli), die Größe kommt automatisch aus
 * der Personalakte (Employee.tshirt_size / pullover_size). Countdown bis
 * heute 23:00 Uhr; danach blendet sich die Karte für Mitarbeiter selbst ab,
 * Manager sehen die finale Zusammenfassung.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shirt, CheckCircle2, Timer, Users, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ORDER_DEADLINE = new Date('2026-10-11T23:00:00+02:00');
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const ITEMS = [
    { key: 'zshirt', label: 'Z-Shirt', sizeField: 'tshirt_size', emoji: '👕' },
    { key: 'pulli', label: 'Pulli', sizeField: 'pullover_size', emoji: '🧥' },
];

function useCountdown(deadline) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(t);
    }, []);
    const remaining = deadline.getTime() - now.getTime();
    return {
        expired: remaining <= 0,
        hours: Math.max(0, Math.floor(remaining / (1000 * 60 * 60))),
        minutes: Math.max(0, Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))),
    };
}

export default function ClothingOrderCard({ currentEmployee, isManager }) {
    const queryClient = useQueryClient();
    const { expired, hours, minutes } = useCountdown(ORDER_DEADLINE);
    const [pickers, setPickers] = useState({});

    const { data: allOrders = [] } = useQuery({
        queryKey: ['clothingOrders'],
        queryFn: () => base44.entities.ClothingOrder.filter({}),
        refetchInterval: 60000,
    });

    const myOrders = allOrders.filter(o => o.employee_id === currentEmployee?.id);
    const myOrderFor = (item) => myOrders.find(o => o.item === item);

    const orderMutation = useMutation({
        mutationFn: async ({ item, size, existingId }) => {
            if (existingId) return base44.entities.ClothingOrder.update(existingId, { size });
            return base44.entities.ClothingOrder.create({
                employee_id: currentEmployee.id,
                employee_name: currentEmployee.short_name || currentEmployee.first_name || '',
                item,
                size,
            });
        },
        onSuccess: (data, vars) => {
            queryClient.invalidateQueries({ queryKey: ['clothingOrders'] });
            setPickers(p => ({ ...p, [vars.item]: false }));
            toast.success(vars.existingId ? 'Bestellung aktualisiert' : `${ITEMS.find(i => i.key === vars.item)?.label || 'Bestellung'} in Größe ${vars.size} bestellt 🎉`);
        },
        onError: (error) => toast.error('Bestellung fehlgeschlagen: ' + error.message),
    });

    if (expired && !isManager) return null;
    if (!currentEmployee) return null;

    if (expired && isManager) {
        return (
            <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Shirt className="w-4 h-4 text-primary" />
                        <p className="text-sm font-semibold text-foreground">Klamotten-Bestellung — abgeschlossen</p>
                    </div>
                    {ITEMS.map(({ key, label }) => {
                        const ofItem = allOrders.filter(o => o.item === key);
                        const bySize = {};
                        ofItem.forEach(o => { bySize[o.size] = (bySize[o.size] || 0) + 1; });
                        return (
                            <div key={key} className="mb-1.5 last:mb-0">
                                <p className="text-sm text-foreground">{label}: {ofItem.length === 0 ? 'keine Bestellungen' : ofItem.length + '×'}</p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {SIZES.filter(s => bySize[s]).map(s => (
                                        <span key={s} className="px-2 py-0.5 rounded-full bg-primary/10 text-xs font-medium text-primary">{s} × {bySize[s]}</span>
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
                    <div className={cn('flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full', hours < 2 ? 'bg-red-500/15 text-red-500' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400')}>
                        <Timer className="w-3.5 h-3.5" />
                        noch {countdownText}
                    </div>
                </div>

                {ITEMS.map(({ key, label, sizeField, emoji }) => {
                    const existing = myOrderFor(key);
                    const profileSize = currentEmployee?.[sizeField];
                    const effectiveSize = existing?.size || profileSize;
                    const pickerOpen = pickers[key];

                    return (
                        <div key={key} className="flex items-center gap-3 p-2.5 rounded-lg bg-card/60 border border-border/60">
                            <span className="text-xl shrink-0">{emoji}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{label}</p>
                                {existing ? (
                                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> bestellt{existing.size ? ` — Größe ${existing.size}` : ''}
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
                            ) : (
                                <div className="shrink-0 space-y-1.5">
                                    {(profileSize || existing) && !pickerOpen ? (
                                        <Button
                                            size="sm"
                                            onClick={() => orderMutation.mutate({ item: key, size: effectiveSize, existingId: existing?.id })}
                                            disabled={orderMutation.isPending || !effectiveSize}
                                        >
                                            {orderMutation.isPending ? '…' : `${label} bestellen`}
                                        </Button>
                                    ) : (
                                        <div className="flex flex-wrap gap-1 justify-end">
                                            {SIZES.map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => orderMutation.mutate({ item: key, size: s, existingId: existing?.id })}
                                                    className={cn('px-2 py-1 rounded-md text-xs font-semibold border transition-colors', existing?.size === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:bg-accent')}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                            {pickerOpen && (
                                                <button onClick={() => setPickers(p => ({ ...p, [key]: false }))} className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground">
                                                    abbrechen
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {isManager && allOrders.length > 0 && (
                    <div className="pt-2 border-t border-border/60 flex items-start gap-2 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                            {ITEMS.map(({ key, label }) => {
                                const names = allOrders.filter(o => o.item === key).map(o => `${o.employee_name || '?'} (${o.size})`);
                                return names.length ? `${label}: ${names.join(', ')}` : null;
                            }).filter(Boolean).join(' · ')}
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}