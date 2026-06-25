import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Star, ChevronDown, ChevronUp, Package, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SmartCombobox from '@/components/ui/SmartCombobox';
import { cn } from '@/lib/utils';

const PACKAGING_TYPES = ['Kiste', 'Palette', 'Pack', 'Fass', 'Karton', 'Tray', 'Beutel', 'Kanister', 'Stück'];
const ORDER_UNITS     = ['Kiste', 'Fass', 'Palette', 'Karton', 'Pack', 'Stück', 'Lage'];

// price_mode: 'unit' = Preis pro Einzeleinheit (Standard)
//             'pack' = Preis pro Gebinde

const emptySupplier = () => ({
    supplier_name:  '',
    purchase_price: '',   // immer Preis pro Einzeleinheit (gespeichert)
    article_number: '',
    packaging_units: '',
    packaging_size:  '',
    order_unit:      '',
    notes:           '',
    is_primary:      false,
});

export default function SupplierDetailsEditor({ value = [], onChange, availableSuppliers = [], contentUnit = '' }) {
    const [expandedIdx, setExpandedIdx]   = useState(null);
    const [newName,     setNewName]        = useState('');
    // Pro Lieferant: in welchem Modus wird der Preis eingegeben
    // 'unit' = pro Flasche/Stück, 'pack' = pro Gebinde
    const [priceModes,  setPriceModes]     = useState({});

    const getPriceMode = (idx) => priceModes[idx] ?? 'unit';
    const togglePriceMode = (idx) => {
        setPriceModes(prev => ({ ...prev, [idx]: prev[idx] === 'pack' ? 'unit' : 'pack' }));
    };

    const update = (idx, field, val) => {
        onChange(value.map((s, i) => i === idx ? { ...s, [field]: val } : s));
    };

    // Wenn der User den Preis eingibt, immer in Einzelpreis umrechnen und speichern
    const handlePriceInput = (idx, rawValue) => {
        const mode  = getPriceMode(idx);
        const units = parseFloat(value[idx]?.packaging_units);

        // Beide Felder in EINEM update-Call setzen — verhindert Closure-Bug
        if (mode === 'pack' && !isNaN(units) && units > 0) {
            const packPrice = parseFloat(rawValue);
            const unitPrice = !isNaN(packPrice) ? String((packPrice / units).toFixed(4)) : rawValue;
            onChange(value.map((s, i) => i === idx
                ? { ...s, purchase_price: unitPrice, _pack_price_input: rawValue }
                : s
            ));
        } else {
            onChange(value.map((s, i) => i === idx
                ? { ...s, purchase_price: rawValue, _pack_price_input: '' }
                : s
            ));
        }
    };

    // Anzeige-Wert im Input — je nach Modus
    const getDisplayPrice = (s, idx) => {
        const mode = getPriceMode(idx);
        if (mode === 'pack') {
            // Wenn _pack_price_input gesetzt → zeige das, sonst zurückrechnen
            if (s._pack_price_input) return s._pack_price_input;
            const units = parseFloat(s.packaging_units);
            const unitPrice = parseFloat(s.purchase_price);
            if (!isNaN(units) && units > 0 && !isNaN(unitPrice)) {
                return (unitPrice * units).toFixed(2);
            }
            return s.purchase_price;
        }
        return s.purchase_price;
    };

    const setPrimary = (idx) => {
        onChange(value.map((s, i) => ({ ...s, is_primary: i === idx })));
    };

    const remove = (idx) => {
        onChange(value.filter((_, i) => i !== idx));
        if (expandedIdx === idx) setExpandedIdx(null);
        else if (expandedIdx > idx) setExpandedIdx(expandedIdx - 1);
        setPriceModes(prev => {
            const next = {};
            Object.entries(prev).forEach(([k, v]) => {
                const ki = parseInt(k);
                if (ki < idx) next[ki] = v;
                else if (ki > idx) next[ki - 1] = v;
            });
            return next;
        });
    };

    const add = (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        if (value.find(s => s.supplier_name.toLowerCase() === trimmed.toLowerCase())) return;
        onChange([...value, { ...emptySupplier(), supplier_name: trimmed, is_primary: value.length === 0 }]);
        setNewName('');
        setExpandedIdx(value.length);
    };

    // Preisvergleich immer auf Einzelpreis-Basis
    const cheapestUnitPrice = useMemo(() => {
        const prices = value
            .map(s => parseFloat(s.purchase_price))
            .filter(p => !isNaN(p) && p > 0);
        return prices.length > 1 ? Math.min(...prices) : null;
    }, [value]);

    const unitLabel = contentUnit || 'Stück';

    return (
        <div className="space-y-2">
            {value.map((s, idx) => {
                const unitPrice  = parseFloat(s.purchase_price);
                const packUnits  = parseFloat(s.packaging_units);
                const hasUnits   = !isNaN(packUnits) && packUnits > 1;
                const packPrice  = hasUnits && !isNaN(unitPrice) ? unitPrice * packUnits : null;
                const isCheapest = cheapestUnitPrice !== null && !isNaN(unitPrice) && Math.abs(unitPrice - cheapestUnitPrice) < 0.0001;
                const isOpen     = expandedIdx === idx;
                const mode       = getPriceMode(idx);

                return (
                    <div key={idx} className={cn(
                        'rounded-xl border overflow-hidden transition-all',
                        s.is_primary ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                    )}>
                        {/* Header */}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                            <button type="button" onClick={() => setPrimary(idx)} title="Als Hauptlieferant"
                                className={cn('shrink-0 transition-colors', s.is_primary ? 'text-primary' : 'text-muted-foreground hover:text-primary')}>
                                <Star className={cn('w-4 h-4', s.is_primary && 'fill-primary')} />
                            </button>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">{s.supplier_name}</p>
                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                    {hasUnits && s.packaging_size && (
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                            <Package className="w-2.5 h-2.5" />
                                            {s.packaging_units}× {s.packaging_size}
                                        </span>
                                    )}
                                    {!isNaN(unitPrice) && unitPrice > 0 && (
                                        <span className={cn(
                                            'text-xs font-semibold px-1.5 py-0.5 rounded-md',
                                            isCheapest ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'
                                        )}>
                                            {isCheapest && '✓ '}
                                            {unitPrice.toFixed(2)} €/{unitLabel}
                                        </span>
                                    )}
                                    {packPrice !== null && (
                                        <span className="text-[10px] text-muted-foreground">
                                            ({packPrice.toFixed(2)} €/{s.packaging_size || 'Gebinde'})
                                        </span>
                                    )}
                                    {s.article_number && (
                                        <span className="text-[10px] text-muted-foreground font-mono">#{s.article_number}</span>
                                    )}
                                </div>
                            </div>
                            <button type="button" onClick={() => setExpandedIdx(isOpen ? null : idx)}
                                className="text-muted-foreground hover:text-foreground p-1 min-w-[28px] min-h-[28px] flex items-center justify-center">
                                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button type="button" onClick={() => remove(idx)}
                                className="text-muted-foreground hover:text-destructive p-1 min-w-[28px] min-h-[28px] flex items-center justify-center">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Expanded */}
                        {isOpen && (
                            <div className="px-3 pb-4 pt-2 border-t border-border/50 space-y-3">

                                {/* Preis-Eingabe mit Toggle */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        {/* Toggle: Einzelpreis ↔ Gebindepreis */}
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs text-muted-foreground">
                                                {mode === 'unit'
                                                    ? `Preis pro ${unitLabel}`
                                                    : `Preis pro ${s.packaging_size || 'Gebinde'}`}
                                            </Label>
                                            <button
                                                type="button"
                                                onClick={() => togglePriceMode(idx)}
                                                className="text-[10px] text-primary hover:text-primary/80 transition-colors underline underline-offset-2"
                                            >
                                                {mode === 'unit' ? '↔ Gebindepreis?' : `↔ Preis/${unitLabel}?`}
                                            </button>
                                        </div>
                                        <Input
                                            type="number" step="0.01"
                                            value={getDisplayPrice(s, idx)}
                                            onChange={e => handlePriceInput(idx, e.target.value)}
                                            placeholder={mode === 'unit' ? 'z.B. 0.75' : 'z.B. 18.00'}
                                            className="h-9 text-sm"
                                        />
                                        {/* Live-Gegenrechnung */}
                                        {mode === 'unit' && hasUnits && !isNaN(unitPrice) && unitPrice > 0 && (
                                            <p className="text-[10px] text-muted-foreground px-1">
                                                = {(unitPrice * packUnits).toFixed(2)} € pro {s.packaging_size || 'Gebinde'}
                                            </p>
                                        )}
                                        {mode === 'pack' && hasUnits && (
                                            <p className="text-[10px] text-muted-foreground px-1">
                                                {(() => {
                                                    const pp = parseFloat(getDisplayPrice(s, idx));
                                                    if (!isNaN(pp) && pp > 0)
                                                        return `= ${(pp / packUnits).toFixed(4).replace(/\.?0+$/, '')} € pro ${unitLabel}`;
                                                    return `÷ ${s.packaging_units} = Preis pro ${unitLabel}`;
                                                })()}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Art.-Nr. beim Lieferanten</Label>
                                        <Input
                                            value={s.article_number}
                                            onChange={e => update(idx, 'article_number', e.target.value)}
                                            placeholder="optional"
                                            className="h-9 text-sm font-mono"
                                        />
                                    </div>
                                </div>

                                {/* Gebinde */}
                                <div>
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                                        <Package className="w-3 h-3" /> Gebinde / Verpackung
                                    </Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground/70">Anzahl</Label>
                                            <Input
                                                type="number" step="1" min="1"
                                                value={s.packaging_units}
                                                onChange={e => {
                                                    onChange(value.map((s, i) => i === idx
                                                        ? { ...s, packaging_units: e.target.value, _pack_price_input: '' }
                                                        : s
                                                    ));
                                                }}
                                                placeholder="24"
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground/70">Gebinde-Typ</Label>
                                            <Select value={s.packaging_size || ''} onValueChange={v => update(idx, 'packaging_size', v)}>
                                                <SelectTrigger className="h-9 text-sm">
                                                    <SelectValue placeholder="Typ" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PACKAGING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground/70">Bestelleinheit</Label>
                                            <Select value={s.order_unit || ''} onValueChange={v => update(idx, 'order_unit', v)}>
                                                <SelectTrigger className="h-9 text-sm">
                                                    <SelectValue placeholder="Einheit" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ORDER_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Notizen */}
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Lieferanten-Notiz</Label>
                                    <Input
                                        value={s.notes}
                                        onChange={e => update(idx, 'notes', e.target.value)}
                                        placeholder="z.B. Mindestbestellung 5 Kisten, nur auf Anfrage"
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Preisvergleich Hinweis */}
            {value.filter(s => s.purchase_price).length > 1 && (
                <p className="text-xs text-green-400 flex items-center gap-1 px-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    Günstigster Preis pro {unitLabel} ist grün markiert
                </p>
            )}

            {/* Neuen Lieferanten hinzufügen */}
            <SmartCombobox
                value={newName}
                onChange={(val) => {
                    if (availableSuppliers.includes(val)) { add(val); setNewName(''); }
                    else setNewName(val);
                }}
                options={availableSuppliers.filter(s => !value.find(v => v.supplier_name === s))}
                placeholder="Lieferant hinzufügen…"
                allowCreate={true}
            />
            {newName.trim() && (
                <Button type="button" variant="outline" size="sm" onClick={() => add(newName)} className="w-full h-9">
                    <Plus className="w-4 h-4 mr-2" />
                    „{newName.trim()}" hinzufügen
                </Button>
            )}
        </div>
    );
}
