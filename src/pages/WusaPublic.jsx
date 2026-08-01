/**
 * WusaPublic.jsx — Öffentliches Bestellformular für Wurstsalat-Vorbestellungen.
 * Zugriffbar ohne Login über einen geteilten Link.
 * Bestellungen landen direkt in der WusaOrder-Entity mit Status "offen".
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useSearchParams } from 'react-router-dom';
import { format, isTuesday, nextTuesday, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Utensils, ShoppingBag, Check, Clock, Phone, Plus, Minus, ChevronRight, AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const INGREDIENTS = ['Wurst', 'Käse', 'Schwarzwurst', 'Paprika', 'Gurke', 'Zwiebel'];

function getNextTuesdays(count = 4) {
    const today = startOfDay(new Date());
    let tuesdays = [];
    let d = isTuesday(today) ? today : nextTuesday(today);
    for (let i = 0; i < count; i++) {
        tuesdays.push(d);
        d = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    return tuesdays;
}

export default function WusaPublic() {
    const [searchParams] = useSearchParams();
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [customerName, setCustomerName] = useState('');
    const [phone, setPhone] = useState('');
    const [size, setSize] = useState('gross');
    const [quantity, setQuantity] = useState(1);
    const [selectedIngredients, setSelectedIngredients] = useState(['Alles']);
    const [pickupType, setPickupType] = useState('abholung');
    const [pickupTime, setPickupTime] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => format(getNextTuesdays(1)[0], 'yyyy-MM-dd'));

    const tuesdays = useMemo(() => getNextTuesdays(4), []);

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

    const ingredientsString = selectedIngredients.includes('Alles') || selectedIngredients.length === 0
        ? 'Alles'
        : selectedIngredients.join(',');

    const handleSubmit = async () => {
        if (!customerName.trim()) {
            toast.error('Bitte gib deinen Namen ein');
            return;
        }
        setSubmitting(true);
        try {
            await base44.entities.WusaOrder.create({
                customer_name: customerName.trim(),
                phone: phone.trim() || null,
                size,
                quantity: Math.max(1, quantity),
                ingredients: ingredientsString,
                pickup_type: pickupType,
                pickup_time: pickupTime || null,
                notes: notes.trim() || null,
                source: 'online',
                status: 'offen',
                is_active: true,
                order_date: selectedDate,
                created_by_name: customerName.trim(),
            });
            setSubmitted(true);
            toast.success('Bestellung aufgegeben! 🎉');
        } catch (err) {
            toast.error('Fehler: Bestellung konnte nicht gesendet werden. Bitte anrufen.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="max-w-sm w-full bg-card border-green-500/30">
                    <CardContent className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
                            <Check className="w-8 h-8 text-green-400" />
                        </div>
                        <h2 className="text-lg font-bold text-foreground">Bestellung erhalten! 🥗</h2>
                        <p className="text-sm text-muted-foreground">
                            Wir haben deine Vorbestellung für <strong>{format(new Date(selectedDate), 'dd.MM.yyyy', { locale: de })}</strong> notiert.
                        </p>
                        {pickupType === 'abholung' && pickupTime && (
                            <p className="text-sm text-muted-foreground">
                                Abholzeit: <strong>{pickupTime} Uhr</strong>
                            </p>
                        )}
                        <Button onClick={() => {
                            setSubmitted(false);
                            setCustomerName('');
                            setPhone('');
                            setNotes('');
                            setQuantity(1);
                            setSelectedIngredients(['Alles']);
                        }} variant="outline" className="mt-4">
                            Weitere Bestellung aufgeben
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-12">
            <div className="max-w-md mx-auto px-4 py-6 space-y-5">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-foreground">🥗 Wurstsalat</h1>
                    <p className="text-sm text-muted-foreground">Vorbestellung · jeden Dienstag</p>
                </div>

                {/* Date Selection */}
                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wann soll's sein?</label>
                    <div className="mt-2 flex gap-2">
                        {tuesdays.map((d, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedDate(format(d, 'yyyy-MM-dd'))}
                                className={cn(
                                    'flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all',
                                    format(d, 'yyyy-MM-dd') === selectedDate
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border text-muted-foreground'
                                )}
                            >
                                {format(d, 'EEEE', { locale: de })}
                                <br />
                                <span className="text-[10px]">{format(d, 'dd.MM.', { locale: de })}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Name & Phone */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name *</label>
                        <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Dein Name"
                            className="mt-1 w-full h-11 px-3 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Telefon</label>
                        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="für Rückfragen"
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
                        <div className="mt-1 flex items-center gap-2">
                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0">
                                <Minus className="w-4 h-4" />
                            </button>
                            <span className="flex-1 text-center text-lg font-bold text-foreground">{quantity}</span>
                            <button onClick={() => setQuantity(q => q + 1)}
                                className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Ingredients */}
                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zutaten</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => toggleIngredient('Alles')}
                            className={cn('px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                                selectedIngredients.includes('Alles') ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground')}>
                            Alles 🎯
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
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Abholung oder Vor Ort</label>
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
                    {pickupType === 'abholung' && (
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Abholzeit</label>
                            <input type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)}
                                className="mt-1 w-full h-11 px-3 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wünsche / Notiz</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="z.B. ohne Soße, extra scharf…" rows={2}
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                </div>

                {/* Submit */}
                <Button onClick={handleSubmit} disabled={!customerName.trim() || submitting} className="w-full h-12 text-base font-semibold">
                    {submitting ? 'Wird gesendet…' : 'Bestellung abschicken'}
                    {!submitting && <ChevronRight className="w-5 h-5 ml-1" />}
                </Button>

                <p className="text-center text-[11px] text-muted-foreground">
                    Du bekommst keine automatische Bestätigung per E-Mail.<br />
                    Bei Rückfragen rufen wir dich an.
                </p>
            </div>
        </div>
    );
}
