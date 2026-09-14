/**
 * OfferCalculation — Kalkulations-Panel fuer Angebote (Vollkalkulation).
 * Zeigt pro Position: EK, bereitgestellte Menge, erwarteter Verbrauch, VK,
 * Wareneinsatz, Umsatz erwartet/max, Deckungsbeitrag, Marge.
 * Event-Parameter: Gaeste, Ausschank-Zeiten, Mitarbeiter.
 *
 * Internes Tool — diese Werte werden NICHT auf das Kunden-PDF gedruckt.
 * Das Kunden-PDF zeigt weiterhin quantity x unit_price (= Umsatz erwartet).
 */
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Calculator, TrendingUp, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const eur = n => (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = n => (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const CATS = ['Getraenke', 'Speisen', 'Personal', 'Miete/Equipment', 'Sonstiges'];
const UNITS = ['30-l-Fass', 'Kiste', 'Glas', 'Flasche', 'Std', 'Person', 'kg', 'l', 'Pauschale', 'Einzelpreis'];

const calcPosition = (p) => {
    const consumption = Number(p.quantity) || 0;        // erwarteter Verbrauch = Kundenmenge
    const provided = Number(p.quantity_provided) || 0;   // bereitgestellt
    const ek = Number(p.ek_per_unit) || 0;
    const vk = Number(p.unit_price) || 0;
    return {
        wareneinsatz: consumption * ek,
        revenueExpected: consumption * vk,
        revenueMax: provided * vk,
        db: consumption * vk - consumption * ek,
        marge: consumption * vk > 0 ? (consumption * vk - consumption * ek) / (consumption * vk) : 0,
    };
};

export default function OfferCalculation({ record, setField, setPosition, addPosition, removePosition }) {
    const positions = record.positions || [];

    // Totals aus Positionen
    const calc = positions.reduce((acc, p) => {
        const c = calcPosition(p);
        acc.wareneinsatz += c.wareneinsatz;
        acc.revenueExpected += c.revenueExpected;
        acc.revenueMax += c.revenueMax;
        acc.db += c.db;
        return acc;
    }, { wareneinsatz: 0, revenueExpected: 0, revenueMax: 0, db: 0 });
    const margeTotal = calc.revenueExpected > 0 ? calc.db / calc.revenueExpected : 0;

    return (
        <div className="space-y-3">
            {/* Event-Parameter */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                    <Calculator className="w-3.5 h-3.5" />
                    EVENT-PARAMETER
                </div>
                <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Gaeste</Label>
                        <Input
                            type="number"
                            value={record.guests || ''}
                            onChange={(e) => setField('guests', e.target.value ? Number(e.target.value) : null)}
                            placeholder="70"
                            className="h-8 text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Beginn</Label>
                        <Input
                            type="time"
                            value={record.event_start_time || ''}
                            onChange={(e) => setField('event_start_time', e.target.value)}
                            className="h-8 text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Ende</Label>
                        <Input
                            type="time"
                            value={record.event_end_time || ''}
                            onChange={(e) => setField('event_end_time', e.target.value)}
                            className="h-8 text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">MA extern</Label>
                        <Input
                            type="number"
                            value={record.staff_count || ''}
                            onChange={(e) => setField('staff_count', e.target.value ? Number(e.target.value) : null)}
                            placeholder="2"
                            className="h-8 text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Positionen mit Kalkulation */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Kalkulationspositionen
                    </Label>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={addPosition}>
                        <Plus className="w-3 h-3 mr-1" /> Position
                    </Button>
                </div>

                {positions.map((p, i) => {
                    const c = calcPosition(p);
                    return (
                        <div key={i} className="rounded-lg border border-border/60 bg-secondary/20 p-2.5 space-y-2">
                            {/* Zeile 1: Beschreibung + Kategorie + Einheit */}
                            <div className="flex gap-1.5 items-start">
                                <Input
                                    value={p.description || ''}
                                    onChange={(e) => setPosition(i, 'description', e.target.value)}
                                    placeholder="z.B. Chiemseer Hell"
                                    className="h-8 text-sm flex-1"
                                />
                                <Button type="button" variant="ghost" size="sm" className="w-7 h-8 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removePosition(i)}>
                                    <X className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                            {/* Zeile 2: Mengen + Preise */}
                            <div className="grid grid-cols-4 gap-1.5">
                                <div>
                                    <Label className="text-[9px] text-muted-foreground">Bereitgestellt</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={p.quantity_provided ?? ''}
                                        onChange={(e) => setPosition(i, 'quantity_provided', e.target.value)}
                                        placeholder="0"
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[9px] text-muted-foreground">Verbrauch erw.</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={p.quantity ?? ''}
                                        onChange={(e) => setPosition(i, 'quantity', e.target.value)}
                                        placeholder="0"
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[9px] text-muted-foreground">EK / Einh.</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={p.ek_per_unit ?? ''}
                                        onChange={(e) => setPosition(i, 'ek_per_unit', e.target.value)}
                                        placeholder="0.00"
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[9px] text-muted-foreground">VK / Einh.</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={p.unit_price ?? ''}
                                        onChange={(e) => setPosition(i, 'unit_price', e.target.value)}
                                        placeholder="0.00"
                                        className="h-8 text-sm"
                                    />
                                </div>
                            </div>
                            {/* Zeile 3: Einheit + Kategorie */}
                            <div className="grid grid-cols-2 gap-1.5">
                                <Select value={p.unit || 'none'} onValueChange={(v) => setPosition(i, 'unit', v === 'none' ? '' : v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Einheit" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— Einheit —</SelectItem>
                                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={p.category || 'none'} onValueChange={(v) => setPosition(i, 'category', v === 'none' ? '' : v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Kategorie" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— Kategorie —</SelectItem>
                                        {CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Zeile 4: Kalkulationsergebnis (read-only) */}
                            <div className="grid grid-cols-4 gap-1 text-[10px] rounded bg-background/50 px-1.5 py-1">
                                <div>
                                    <span className="text-muted-foreground">WE: </span>
                                    <span className="font-medium text-foreground">{eur(c.wareneinsatz)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Ums. erw.: </span>
                                    <span className="font-medium text-foreground">{eur(c.revenueExpected)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">DB: </span>
                                    <span className={cn('font-medium', c.db >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                                        {eur(c.db)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Marge: </span>
                                    <span className={cn('font-medium', c.marge >= 0.5 ? 'text-emerald-600 dark:text-emerald-400' : c.marge >= 0.2 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive')}>
                                        {pct(c.marge * 100)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summen */}
            <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground mb-1">
                    <Package className="w-3.5 h-3.5" />
                    KALKULATIONSSUMME
                </div>
                <div className="flex justify-between text-muted-foreground">
                    <span>Wareneinsatz gesamt</span>
                    <span className="font-medium text-foreground">{eur(calc.wareneinsatz)} &euro;</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                    <span>Umsatz erwartet</span>
                    <span className="font-medium text-foreground">{eur(calc.revenueExpected)} &euro;</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                    <span>Umsatz max. (bei Vollverbrauch)</span>
                    <span className="font-medium text-foreground">{eur(calc.revenueMax)} &euro;</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-border/50">
                    <span className="text-foreground">Deckungsbeitrag</span>
                    <span className={calc.db >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                        {eur(calc.db)} &euro;
                    </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                    <span>DB-Marge</span>
                    <span className={cn('font-medium', margeTotal >= 0.5 ? 'text-emerald-600 dark:text-emerald-400' : margeTotal >= 0.2 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive')}>
                        {pct(margeTotal * 100)}%
                    </span>
                </div>
            </div>
        </div>
    );
}