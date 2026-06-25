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

const emptySupplier = () => ({
    supplier_name:  '',
    purchase_price: '',   // Preis pro Bestelleinheit (Gebinde)
    article_number: '',
    packaging_units: '',  // Anzahl Einheiten im Gebinde (z.B. 24)
    packaging_size:  '',  // Typ des Gebindes (z.B. Kiste)
    order_unit:      '',  // Bestelleinheit (z.B. Kiste, Fass)
    notes:           '',
    is_primary:      false,
});

/**
 * Berechnet Preis pro Einzeleinheit aus Gebindepreis.
 * z.B. 24er Kiste für 18,00€ → 0,75€ pro Flasche
 */
function calcUnitPrice(purchasePrice, packagingUnits) {
    const price = parseFloat(purchasePrice);
    const units = parseFloat(packagingUnits);
    if (isNaN(price) || isNaN(units) || units <= 0) return null;
    return price / units;
}

export default function SupplierDetailsEditor({ value = [], onChange, availableSuppliers = [], contentUnit = '' }) {
    const [expandedIdx, setExpandedIdx] = useState(null);
    const [newName, setNewName] = useState('');

    const update = (idx, field, val) => {
        onChange(value.map((s, i) => i === idx ? { ...s, [field]: val } : s));
    };

    const setPrimary = (idx) => {
        onChange(value.map((s, i) => ({ ...s, is_primary: i === idx })));
    };

    const remove = (idx) => {
        onChange(value.filter((_, i) => i !== idx));
        if (expandedIdx === idx) setExpandedIdx(null);
        else if (expandedIdx > idx) setExpandedIdx(expandedIdx - 1);
    };

    const add = (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        if (value.find(s => s.supplier_name.toLowerCase() === trimmed.toLowerCase())) return;
        const isFirst = value.length === 0;
        onChange([...value, { ...emptySupplier(), supplier_name: trimmed, is_primary: isFirst }]);
        setNewName('');
        setExpandedIdx(value.length);
    };

    // Günstigster Preis pro Einheit (nicht Gebindepreis)
    const cheapestUnitPrice = useMemo(() => {
        const prices = value
            .map(s => calcUnitPrice(s.purchase_price, s.packaging_units) ?? parseFloat(s.purchase_price))
            .filter(p => !isNaN(p) && p > 0);
        return prices.length > 1 ? Math.min(...prices) : null;
    }, [value]);

    return (
        <div className="space-y-2">
            {value.map((s, idx) => {
                const unitPrice = calcUnitPrice(s.purchase_price, s.packaging_units);
                const displayPrice = unitPrice ?? parseFloat(s.purchase_price);
                const isCheapest = cheapestUnitPrice !== null && !isNaN(displayPrice) && Math.abs(displayPrice - cheapestUnitPrice) < 0.001;
                const isOpen = expandedIdx === idx;
                const hasPackaging = s.packaging_units && parseFloat(s.packaging_units) > 1;

                return (
                    <div key={idx} className={cn(
                        'rounded-xl border overflow-hidden transition-all',
                        s.is_primary ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                    )}>
                        {/* ── Header ── */}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                            <button
                                type="button"
                                onClick={() => setPrimary(idx)}
                                title="Als Hauptlieferant setzen"
                                className={cn('shrink-0 transition-colors', s.is_primary ? 'text-primary' : 'text-muted-foreground hover:text-primary')}
                            >
                                <Star className={cn('w-4 h-4', s.is_primary && 'fill-primary')} />
                            </button>

                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">{s.supplier_name}</p>
                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                    {/* Gebinde-Info */}
                                    {hasPackaging && s.packaging_size && (
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                            <Package className="w-2.5 h-2.5" />
                                            {s.packaging_units}× {s.packaging_size}
                                        </span>
                                    )}
                                    {/* Gebindepreis */}
                                    {s.purchase_price && (
                                        <span className="text-[10px] text-muted-foreground">
                                            {parseFloat(s.purchase_price).toFixed(2)} €
                                            {hasPackaging ? `/${s.order_unit || s.packaging_size || 'Gebinde'}` : ''}
                                        </span>
                                    )}
                                    {/* Preis pro Einheit — das wichtigste */}
                                    {unitPrice !== null && (
                                        <span className={cn(
                                            'text-xs font-semibold px-1.5 py-0.5 rounded-md',
                                            isCheapest
                                                ? 'bg-green-500/15 text-green-400'
                                                : 'bg-muted text-muted-foreground'
                                        )}>
                                            {isCheapest && '✓ '}
                                            {unitPrice.toFixed(3).replace(/\.?0+$/, '')} €/{contentUnit || 'Stück'}
                                        </span>
                                    )}
                                    {!unitPrice && s.purchase_price && (
                                        <span className={cn(
                                            'text-xs font-semibold px-1.5 py-0.5 rounded-md',
                                            isCheapest ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'
                                        )}>
                                            {isCheapest && '✓ '}
                                            {parseFloat(s.purchase_price).toFixed(2)} €
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

                        {/* ── Expanded Details ── */}
                        {isOpen && (
                            <div className="px-3 pb-4 pt-2 border-t border-border/50 space-y-3">

                                {/* Preis + Art.-Nr. */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">
                                            Einkaufspreis (€)
                                            {hasPackaging && <span className="ml-1 text-muted-foreground/60">pro Gebinde</span>}
                                        </Label>
                                        <Input
                                            type="number" step="0.01"
                                            value={s.purchase_price}
                                            onChange={e => update(idx, 'purchase_price', e.target.value)}
                                            placeholder="z.B. 18.00"
                                            className="h-9 text-sm"
                                        />
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

                                {/* Gebinde — strukturiert */}
                                <div>
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                                        <Package className="w-3 h-3" /> Gebinde / Verpackung
                                    </Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground/70">Anzahl Einheiten</Label>
                                            <Input
                                                type="number" step="1" min="1"
                                                value={s.packaging_units}
                                                onChange={e => update(idx, 'packaging_units', e.target.value)}
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
                                                    {PACKAGING_TYPES.map(t => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
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
                                                    {ORDER_UNITS.map(u => (
                                                        <SelectItem key={u} value={u}>{u}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Live-Kalkulation */}
                                    {unitPrice !== null && s.purchase_price && (
                                        <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
                                            <Calculator className="w-3.5 h-3.5 text-primary shrink-0" />
                                            <p className="text-xs text-muted-foreground">
                                                {parseFloat(s.purchase_price).toFixed(2)} € ÷ {s.packaging_units} =&nbsp;
                                                <span className="font-semibold text-foreground">
                                                    {unitPrice.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} € pro {contentUnit || 'Stück'}
                                                </span>
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Notizen */}
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Lieferanten-Notiz</Label>
                                    <Input
                                        value={s.notes}
                                        onChange={e => update(idx, 'notes', e.target.value)}
                                        placeholder="z.B. nur auf Anfrage, Mindestbestellung 5 Kisten"
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Günstigster Hinweis */}
            {value.filter(s => s.purchase_price).length > 1 && (
                <p className="text-xs text-green-400 flex items-center gap-1 px-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Günstigster Preis pro Einheit ist grün markiert
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
