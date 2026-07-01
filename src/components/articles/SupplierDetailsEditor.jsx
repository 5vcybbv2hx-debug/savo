/**
 * SupplierDetailsEditor — Multi-Gebinde-System
 *
 * Logik:
 *   Artikel = die Einzelflasche/-einheit
 *   Lieferant → N Gebinde-Optionen (Karton 6×, Kiste 20×, Palette 24×Kiste …)
 *   Jede Option hat: Anzahl × Typ, Preis/Gebinde → automatisch Preis/Einheit
 *   Standard-Option (★) wird für Bestellvorschlag und Preisvergleich genutzt
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, Star, ChevronDown, ChevronUp, Package, Calculator, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SmartCombobox from '@/components/ui/SmartCombobox';
import { cn } from '@/lib/utils';

// ── Konstanten ────────────────────────────────────────────────────────────────
const PACKAGING_TYPES = [
    'Stück',       // Einzelflasche / Einzelartikel
    'Karton',      // z.B. Karton 6×
    'Kiste',       // z.B. Kiste 20×
    'Palette',     // z.B. Palette 12×Kisten
    'Pack',        // z.B. 4er-Pack
    'Tray',        // flaches Träger-Tray
    'Fass',        // Fass 30L / 50L
    'Kanister',    // Kanister 5L / 10L
    'Beutel',      // Beutel 1kg
];

const DEPOSIT_TYPES = [
    { value: 'kein',             label: 'Kein Pfand' },
    { value: 'einweg',           label: 'Einweg (0,25 €)' },
    { value: 'mehrweg_flasche',  label: 'Mehrweg Flasche (0,15 €)' },
    { value: 'mehrweg_kiste',    label: 'Mehrweg Kiste (1,50 €)' },
];

const DEPOSIT_DEFAULTS = { kein: 0, einweg: 0.25, mehrweg_flasche: 0.15, mehrweg_kiste: 1.50 };

function genId() {
    return Math.random().toString(36).slice(2, 10);
}

function emptyOption() {
    return {
        id:             genId(),
        packaging_type: 'Kiste',
        units_per_pack: '',
        price_per_pack: '',
        price_per_unit: null,
        is_default:     false,
        min_order_qty:  '',
        deposit_per_unit: '',
        deposit_type:   'kein',
    };
}

// ── Berechnungen ──────────────────────────────────────────────────────────────
function calcUnitPrice(opt) {
    const pack  = parseFloat(opt.price_per_pack);
    const units = parseFloat(opt.units_per_pack);
    if (isNaN(pack) || isNaN(units) || units <= 0) return null;
    return pack / units;
}

function optionLabel(opt) {
    const units = parseFloat(opt.units_per_pack);
    if (opt.packaging_type === 'Stück') return 'Einzelstück';
    if (!isNaN(units) && units > 0) return `${opt.packaging_type} ${units}×`;
    return opt.packaging_type || '–';
}

// ── Sub-Komponente: eine Gebinde-Option ──────────────────────────────────────
function PackagingOptionRow({ opt, idx, unitLabel, isDefault, isCheapest, onUpdate, onRemove, onSetDefault }) {
    const [open, setOpen] = useState(false);
    const unitPrice = calcUnitPrice(opt);
    const totalDeposit = (() => {
        const dep = parseFloat(opt.deposit_per_unit);
        const units = parseFloat(opt.units_per_pack);
        if (!isNaN(dep) && dep > 0 && !isNaN(units) && units > 0) return dep * units;
        return null;
    })();

    const handlePackPrice = (val) => {
        const pack  = parseFloat(val);
        // Stück-Typ: units_per_pack ist immer 1
        const effectiveUnits = opt.packaging_type === 'Stück' ? 1 : parseFloat(opt.units_per_pack);
        const up    = (!isNaN(pack) && !isNaN(effectiveUnits) && effectiveUnits > 0) ? pack / effectiveUnits : null;
        onUpdate({
            ...opt,
            price_per_pack: val,
            price_per_unit: up,
            units_per_pack: opt.packaging_type === 'Stück' ? 1 : opt.units_per_pack,
        });
    };

    const handleUnits = (val) => {
        const pack  = parseFloat(opt.price_per_pack);
        const units = parseFloat(val);
        const up    = (!isNaN(pack) && !isNaN(units) && units > 0) ? pack / units : null;
        onUpdate({ ...opt, units_per_pack: val === '' ? '' : val, price_per_unit: up });
    };

    const handleDepositType = (type) => {
        const def = DEPOSIT_DEFAULTS[type] ?? 0;
        onUpdate({ ...opt, deposit_type: type, deposit_per_unit: type === 'kein' ? '' : String(def) });
    };

    return (
        <div className={cn(
            'rounded-lg border overflow-hidden transition-all',
            isDefault ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/50'
        )}>
            {/* Kopfzeile */}
            <div className="flex items-center gap-2 px-3 py-2">
                {/* Default-Stern */}
                <button type="button" onClick={onSetDefault} title="Standard-Gebinde"
                    className={cn('shrink-0 transition-colors', isDefault ? 'text-primary' : 'text-muted-foreground hover:text-primary')}>
                    <Star className={cn('w-3.5 h-3.5', isDefault && 'fill-primary')} />
                </button>

                {/* Typ + Anzahl */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className={cn('text-xs font-semibold', isDefault ? 'text-primary' : 'text-foreground')}>
                        {optionLabel(opt)}
                    </span>
                    {isDefault && (
                        <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded font-medium">Standard</span>
                    )}
                    {isCheapest && !isDefault && (
                        <span className="text-[9px] bg-green-500/20 text-green-400 px-1 py-0.5 rounded font-medium">günstigster/Stück</span>
                    )}
                    {isCheapest && isDefault && (
                        <span className="text-[9px] bg-green-500/20 text-green-400 px-1 py-0.5 rounded font-medium">günstigster/Stück</span>
                    )}
                </div>

                {/* Preise kompakt */}
                <div className="text-right shrink-0">
                    {unitPrice !== null && (
                        <p className={cn('text-xs font-bold tabular-nums', isCheapest ? 'text-green-400' : 'text-foreground')}>
                            {unitPrice.toFixed(4).replace(/\.?0+$/, '').replace(/(\.\d{2})\d+/, '$1')} €/{unitLabel}
                        </p>
                    )}
                    {opt.price_per_pack && (
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                            {parseFloat(opt.price_per_pack).toFixed(2)} €/{opt.packaging_type || 'Gebinde'}
                        </p>
                    )}
                </div>

                <button type="button" onClick={() => setOpen(o => !o)}
                    className="text-muted-foreground hover:text-foreground p-1 shrink-0">
                    {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button type="button" onClick={onRemove}
                    className="text-muted-foreground hover:text-destructive p-1 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Detail-Formular */}
            {open && (
                <div className="px-3 pb-3 pt-2 border-t border-border/50 space-y-3">

                    {/* Zeile 1: Typ + Anzahl + Preis/Gebinde */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Gebinde-Typ</Label>
                            <Select value={opt.packaging_type || ''} onValueChange={v => onUpdate({ ...opt, packaging_type: v })}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Typ" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PACKAGING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">
                                {opt.packaging_type === 'Stück' ? 'Einzeleinheit' : `Stück pro ${opt.packaging_type || 'Gebinde'}`}
                            </Label>
                            <Input
                                type="number" step="1" min="1"
                                value={opt.packaging_type === 'Stück' ? 1 : opt.units_per_pack}
                                disabled={opt.packaging_type === 'Stück'}
                                onChange={e => handleUnits(e.target.value)}
                                placeholder="z.B. 6"
                                className="h-8 text-xs disabled:opacity-50"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">
                                Preis / {opt.packaging_type === 'Stück' ? unitLabel : (opt.packaging_type || 'Gebinde')}
                            </Label>
                            <Input
                                type="number" step="0.01" min="0"
                                value={opt.price_per_pack}
                                onChange={e => handlePackPrice(e.target.value)}
                                placeholder="z.B. 18.90"
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>

                    {/* Live-Kalkulation */}
                    {unitPrice !== null && opt.packaging_type !== 'Stück' && (
                        <div className={cn(
                            'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs',
                            isCheapest ? 'bg-green-500/10 text-green-400' : 'bg-muted/50 text-muted-foreground'
                        )}>
                            <Calculator className="w-3 h-3 shrink-0" />
                            <span>
                                {parseFloat(opt.price_per_pack).toFixed(2)} € ÷ {opt.units_per_pack} Stück
                                = <strong>{unitPrice.toFixed(4).replace(/\.?0+$/, '').replace(/(\.\d{2})\d+/, '$1')} € pro {unitLabel}</strong>
                            </span>
                            {isCheapest && <Check className="w-3 h-3 ml-auto shrink-0" />}
                        </div>
                    )}

                    {/* Zeile 2: Mindestbestellung + Pfand */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Min. Bestellmenge (Gebinde)</Label>
                            <Input
                                type="number" step="1" min="1"
                                value={opt.min_order_qty}
                                onChange={e => onUpdate({ ...opt, min_order_qty: e.target.value })}
                                placeholder="z.B. 1"
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Pfand-Typ</Label>
                            <Select value={opt.deposit_type || 'kein'} onValueChange={handleDepositType}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DEPOSIT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Pfand-Betrag (wenn nicht kein) */}
                    {opt.deposit_type !== 'kein' && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Pfand pro Einheit (€)</Label>
                                <Input
                                    type="number" step="0.01"
                                    value={opt.deposit_per_unit}
                                    onChange={e => onUpdate({ ...opt, deposit_per_unit: e.target.value })}
                                    className="h-8 text-xs"
                                />
                            </div>
                            {totalDeposit !== null && (
                                <div className="flex items-end pb-1">
                                    <p className="text-[10px] text-muted-foreground">
                                        = {totalDeposit.toFixed(2)} € Pfand / {opt.packaging_type || 'Gebinde'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function SupplierDetailsEditor({ value = [], onChange, availableSuppliers = [], contentUnit = '' }) {
    const [expandedIdx,  setExpandedIdx]  = useState(null);
    const [newName,      setNewName]      = useState('');

    const unitLabel = contentUnit || 'Stück';

    // Günstigster Einzelpreis über ALLE Lieferanten + ALLE Gebinde-Optionen
    const globalCheapest = useMemo(() => {
        let min = null;
        value.forEach(s => {
            (s.packaging_options || []).forEach(opt => {
                const up = calcUnitPrice(opt);
                if (up !== null && (min === null || up < min)) min = up;
            });
            // Legacy purchase_price
            const lp = parseFloat(s.purchase_price);
            if (!isNaN(lp) && lp > 0 && (min === null || lp < min)) min = lp;
        });
        return min;
    }, [value]);

    const updateSupplier = useCallback((idx, updated) => {
        onChange(value.map((s, i) => i === idx ? updated : s));
    }, [value, onChange]);

    const updateOption = useCallback((supplierIdx, optIdx, updatedOpt) => {
        const supplier = value[supplierIdx];
        const opts = [...(supplier.packaging_options || [])];
        opts[optIdx] = updatedOpt;
        // Preis des Standard-Gebindes → purchase_price am Lieferanten setzen
        const defaultOpt = opts.find(o => o.is_default) || opts[0];
        const up = defaultOpt ? calcUnitPrice(defaultOpt) : null;
        updateSupplier(supplierIdx, {
            ...supplier,
            packaging_options: opts,
            purchase_price: up !== null ? up : supplier.purchase_price,
        });
    }, [value, updateSupplier]);

    const addOption = useCallback((supplierIdx) => {
        const supplier = value[supplierIdx];
        const opts = supplier.packaging_options || [];
        const newOpt = { ...emptyOption(), is_default: opts.length === 0 };
        updateSupplier(supplierIdx, { ...supplier, packaging_options: [...opts, newOpt] });
    }, [value, updateSupplier]);

    const removeOption = useCallback((supplierIdx, optIdx) => {
        const supplier = value[supplierIdx];
        const opts = (supplier.packaging_options || []).filter((_, i) => i !== optIdx);
        // Wenn die gelöschte die Default war → erste wird Default
        if (opts.length > 0 && !(supplier.packaging_options[optIdx]?.is_default === false)) {
            if (!opts.some(o => o.is_default)) opts[0] = { ...opts[0], is_default: true };
        }
        const defaultOpt = opts.find(o => o.is_default) || opts[0];
        const up = defaultOpt ? calcUnitPrice(defaultOpt) : null;
        updateSupplier(supplierIdx, {
            ...supplier,
            packaging_options: opts,
            purchase_price: up !== null ? up : supplier.purchase_price,
        });
    }, [value, updateSupplier]);

    const setDefaultOption = useCallback((supplierIdx, optIdx) => {
        const supplier = value[supplierIdx];
        const opts = (supplier.packaging_options || []).map((o, i) => ({ ...o, is_default: i === optIdx }));
        const defaultOpt = opts[optIdx];
        const up = calcUnitPrice(defaultOpt);
        updateSupplier(supplierIdx, {
            ...supplier,
            packaging_options: opts,
            purchase_price: up !== null ? up : supplier.purchase_price,
        });
    }, [value, updateSupplier]);

    const setPrimary = useCallback((idx) => {
        onChange(value.map((s, i) => ({ ...s, is_primary: i === idx })));
    }, [value, onChange]);

    const removeSupplier = useCallback((idx) => {
        onChange(value.filter((_, i) => i !== idx));
        if (expandedIdx === idx) setExpandedIdx(null);
        else if (expandedIdx > idx) setExpandedIdx(expandedIdx - 1);
    }, [value, onChange, expandedIdx]);

    const addSupplier = useCallback((name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        if (value.find(s => s.supplier_name.toLowerCase() === trimmed.toLowerCase())) return;
        const newS = {
            supplier_name:      trimmed,
            article_number:     '',
            notes:              '',
            is_primary:         value.length === 0,
            packaging_options:  [],
            purchase_price:     null,
        };
        onChange([...value, newS]);
        setNewName('');
        setExpandedIdx(value.length);
    }, [value, onChange]);

    return (
        <div className="space-y-3">
            {value.map((supplier, idx) => {
                const opts      = supplier.packaging_options || [];
                const isOpen    = expandedIdx === idx;
                // Günstigste Option dieses Lieferanten
                const cheapestHere = opts.reduce((min, o) => {
                    const up = calcUnitPrice(o);
                    return (up !== null && (min === null || up < min)) ? up : min;
                }, null);

                return (
                    <div key={idx} className={cn(
                        'rounded-xl border overflow-hidden transition-all',
                        supplier.is_primary ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                    )}>
                        {/* Lieferant-Header */}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                            <button type="button" onClick={() => setPrimary(idx)} title="Hauptlieferant"
                                className={cn('shrink-0', supplier.is_primary ? 'text-primary' : 'text-muted-foreground hover:text-primary')}>
                                <Star className={cn('w-4 h-4', supplier.is_primary && 'fill-primary')} />
                            </button>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="font-semibold text-sm text-foreground truncate">{supplier.supplier_name}</p>
                                    {supplier.is_primary && (
                                        <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded shrink-0">Hauptlieferant</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {opts.length === 0 && (
                                        <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                                            <AlertCircle className="w-2.5 h-2.5" /> Noch keine Gebinde
                                        </span>
                                    )}
                                    {opts.map(o => {
                                        const up = calcUnitPrice(o);
                                        const isCheap = up !== null && globalCheapest !== null && Math.abs(up - globalCheapest) < 0.0001;
                                        return (
                                            <span key={o.id} className={cn(
                                                'text-[10px] px-1.5 py-0.5 rounded-md border tabular-nums',
                                                o.is_default ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground',
                                                isCheap && 'border-green-500/40 text-green-400 bg-green-500/10'
                                            )}>
                                                {optionLabel(o)}
                                                {up !== null && ` · ${up.toFixed(2)} €/${unitLabel}`}
                                                {isCheap && ' ✓'}
                                            </span>
                                        );
                                    })}
                                    {supplier.article_number && (
                                        <span className="text-[10px] text-muted-foreground font-mono">#{supplier.article_number}</span>
                                    )}
                                </div>
                            </div>

                            <button type="button" onClick={() => setExpandedIdx(isOpen ? null : idx)}
                                className="text-muted-foreground hover:text-foreground p-1 shrink-0">
                                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button type="button" onClick={() => removeSupplier(idx)}
                                className="text-muted-foreground hover:text-destructive p-1 shrink-0">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Lieferant aufgeklappt */}
                        {isOpen && (
                            <div className="border-t border-border/50 px-3 py-3 space-y-3">

                                {/* Art.-Nr. + Notiz */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Art.-Nr. beim Lieferanten</Label>
                                        <Input
                                            value={supplier.article_number || ''}
                                            onChange={e => updateSupplier(idx, { ...supplier, article_number: e.target.value })}
                                            placeholder="optional"
                                            className="h-8 text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Lieferanten-Notiz</Label>
                                        <Input
                                            value={supplier.notes || ''}
                                            onChange={e => updateSupplier(idx, { ...supplier, notes: e.target.value })}
                                            placeholder="z.B. nur Mo-Fr"
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                </div>

                                {/* Gebinde-Optionen */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Package className="w-3 h-3" />
                                            Gebinde-Optionen
                                            <span className="text-[9px] bg-muted px-1 py-0.5 rounded">{opts.length}</span>
                                        </Label>
                                        <Button type="button" variant="ghost" size="sm"
                                            onClick={() => addOption(idx)}
                                            className="h-6 px-2 text-[11px] text-primary hover:text-primary gap-1">
                                            <Plus className="w-3 h-3" /> Gebinde hinzufügen
                                        </Button>
                                    </div>

                                    {opts.length === 0 && (
                                        <div className="border border-dashed border-border rounded-lg px-3 py-4 text-center">
                                            <Package className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                                            <p className="text-xs text-muted-foreground">
                                                Noch keine Gebinde angelegt.
                                            </p>
                                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                                z.B. Kiste 20× oder Karton 6×
                                            </p>
                                        </div>
                                    )}

                                    {opts.map((opt, optIdx) => {
                                        const up = calcUnitPrice(opt);
                                        const isCheap = up !== null && globalCheapest !== null && Math.abs(up - globalCheapest) < 0.0001;
                                        return (
                                            <PackagingOptionRow
                                                key={opt.id || optIdx}
                                                opt={opt}
                                                idx={optIdx}
                                                unitLabel={unitLabel}
                                                isDefault={!!opt.is_default}
                                                isCheapest={isCheap}
                                                onUpdate={(updated) => updateOption(idx, optIdx, updated)}
                                                onRemove={() => removeOption(idx, optIdx)}
                                                onSetDefault={() => setDefaultOption(idx, optIdx)}
                                            />
                                        );
                                    })}
                                </div>

                                {/* Preisvergleich Hinweis */}
                                {opts.length > 1 && (
                                    <p className="text-[10px] text-muted-foreground px-1 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                                        ★ = Standard-Gebinde für Bestellungen · ✓ = günstigster Preis pro {unitLabel}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Lieferanten-übergreifender Preisvergleich */}
            {value.length > 1 && value.some(s => (s.packaging_options || []).length > 0) && (
                <div className="border border-green-500/20 bg-green-500/5 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-green-400 flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 shrink-0" />
                        Günstigster Preis über alle Lieferanten: <strong>{globalCheapest?.toFixed(4).replace(/\.?0+$/, '').replace(/(\.\d{2})\d+/, '$1')} € pro {unitLabel}</strong>
                    </p>
                </div>
            )}

            {/* Neuen Lieferanten hinzufügen */}
            <SmartCombobox
                value={newName}
                onChange={(val) => {
                    if (availableSuppliers.includes(val)) { addSupplier(val); }
                    else setNewName(val);
                }}
                options={availableSuppliers.filter(s => !value.find(v => v.supplier_name === s))}
                placeholder="+ Lieferant hinzufügen…"
                allowCreate={true}
            />
            {newName.trim() && (
                <Button type="button" variant="outline" size="sm" onClick={() => addSupplier(newName)} className="w-full h-9">
                    <Plus className="w-4 h-4 mr-2" />
                    „{newName}" hinzufügen
                </Button>
            )}
        </div>
    );
}
