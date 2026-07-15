import React, { useState, useEffect } from 'react';
import { Truck, Check, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function BulkWareneingangSheet({ open, items, onClose, onConfirm }) {
    const [entries, setEntries] = useState({});

    useEffect(() => {
        if (open && items.length > 0) {
            const initial = {};
            items.forEach(item => {
                initial[item.id] = {
                    checked: true,
                    deliveredQty: String(item.quantity ?? ''),
                    note: item.delivery_note || '',
                };
            });
            setEntries(initial);
        }
    }, [open, items]);

    if (!open) return null;

    const updateEntry = (id, field, value) => {
        setEntries(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    };

    const checkedItems = items.filter(item => entries[item.id]?.checked);

    const handleConfirm = () => {
        const results = checkedItems.map(item => ({
            item,
            deliveredQty: parseFloat(entries[item.id]?.deliveredQty) || 0,
            note: entries[item.id]?.note || '',
        }));
        onConfirm(results);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-amber-500" />
                        Wareneingang ({items.length} Artikel)
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-2 py-2">
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Keine bestellten Artikel</p>
                        </div>
                    ) : (
                        items.map(item => {
                            const entry = entries[item.id];
                            if (!entry) return null;
                            const ordered = parseFloat(item.quantity) || 0;
                            const delivered = parseFloat(entry.deliveredQty) || 0;
                            const diff = delivered - ordered;
                            return (
                                <div key={item.id} className={cn(
                                    'rounded-xl border p-3 transition-all',
                                    entry.checked ? 'border-border bg-card' : 'border-border/40 bg-muted/30 opacity-60'
                                )}>
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            checked={entry.checked}
                                            onCheckedChange={(v) => updateEntry(item.id, 'checked', !!v)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">
                                                {item.item_name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Bestellt: {item.quantity} {item.unit || 'Stück'}
                                                {item.category && <> · {item.category}</>}
                                            </p>
                                        </div>
                                    </div>
                                    {entry.checked && (
                                        <div className="flex items-end gap-2 mt-2 pl-8">
                                            <div className="flex-1">
                                                <Label className="text-[10px] text-muted-foreground">Geliefert</Label>
                                                <Input
                                                    type="number"
                                                    step="0.5"
                                                    min="0"
                                                    value={entry.deliveredQty}
                                                    onChange={e => updateEntry(item.id, 'deliveredQty', e.target.value)}
                                                    className="h-9 text-sm font-semibold"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <Label className="text-[10px] text-muted-foreground">Notiz</Label>
                                                <Input
                                                    value={entry.note}
                                                    onChange={e => updateEntry(item.id, 'note', e.target.value)}
                                                    placeholder="optional"
                                                    className="h-9 text-sm"
                                                />
                                            </div>
                                            {diff !== 0 && (
                                                <span className={cn(
                                                    'text-[10px] font-medium pb-2 shrink-0',
                                                    diff < 0 ? 'text-destructive' : 'text-blue-400'
                                                )}>
                                                    {diff < 0 ? `${Math.abs(diff).toFixed(1)} fehlt` : `+${diff.toFixed(1)}`}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={checkedItems.length === 0}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
                        <Check className="w-4 h-4 mr-1.5" />
                        {checkedItems.length} quittieren
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}