import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ExternalLink, Shuffle, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BottomSheetSelect from '@/components/ui/bottom-sheet-select';

export default function WeeklySpecialGenerator({ menuItems = [] }) {
    const queryClient = useQueryClient();
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedCount, setSelectedCount] = useState('3');
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editingItemId, setEditingItemId] = useState(null);
    const [editValues, setEditValues] = useState({ discount_type: 'fixed', discount_value: 0 });

    const { data: activeSpecial = null } = useQuery({
        queryKey: ['active-weekly-special'],
        queryFn: async () => {
            const specials = await base44.entities.WeeklySpecial.filter({ is_active: true });
            return specials[0] || null;
        }
    });

    const { data: specialItems = [] } = useQuery({
        queryKey: ['weekly-special-items', activeSpecial?.id],
        queryFn: () => activeSpecial ? base44.entities.WeeklySpecialItem.filter({ weekly_special_id: activeSpecial.id }) : Promise.resolve([]),
        enabled: !!activeSpecial?.id
    });

    const saveSpecialMutation = useMutation({
        mutationFn: async (specialData) => {
            if (activeSpecial?.id) {
                await base44.entities.WeeklySpecial.update(activeSpecial.id, specialData);
                return activeSpecial.id;
            } else {
                const result = await base44.entities.WeeklySpecial.create({
                    title: 'Wochenspecial',
                    is_active: true,
                    item_count: parseInt(selectedCount),
                    ...specialData
                });
                return result.id;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['active-weekly-special']);
            queryClient.invalidateQueries(['weekly-special-items']);
            toast.success('Wochenspecial gespeichert!');
        }
    });

    const deleteItemMutation = useMutation({
        mutationFn: (itemId) => base44.entities.WeeklySpecialItem.delete(itemId),
        onSuccess: () => {
            queryClient.invalidateQueries(['weekly-special-items']);
        }
    });

    const updateItemMutation = useMutation({
        mutationFn: ({ itemId, data }) => base44.entities.WeeklySpecialItem.update(itemId, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['weekly-special-items']);
            setShowEditDialog(false);
            toast.success('Getränk aktualisiert!');
        }
    });

    const generateRandomSelection = async () => {
        setIsGenerating(true);
        const count = parseInt(selectedCount);
        const activeItems = menuItems.filter(m => m.is_available);

        if (activeItems.length < count) {
            toast.error(`Nur ${activeItems.length} verfügbare Getränke, ${count} benötigt`);
            setIsGenerating(false);
            return;
        }

        const selected = [];
        const available = [...activeItems];

        for (let i = 0; i < count; i++) {
            const idx = Math.floor(Math.random() * available.length);
            selected.push(available.splice(idx, 1)[0]);
        }

        try {
            let specialId = activeSpecial?.id;
            if (!specialId) {
                const result = await base44.entities.WeeklySpecial.create({
                    title: 'Wochenspecial',
                    is_active: true,
                    item_count: count
                });
                specialId = result.id;
            }

            // Lösche alte Items
            for (const item of specialItems) {
                await base44.entities.WeeklySpecialItem.delete(item.id);
            }

            // Erstelle neue Items
             for (let i = 0; i < selected.length; i++) {
                 // Rabatt: ~15% des Preises, auf 10 Cent abgerundet (z.B. 4,80€ → 0,70€ Rabatt → 4,10€)
                 const rawDiscount = selected[i].price * 0.15;
                 const defaultDiscount = Math.round(rawDiscount * 10) / 10; // auf 10ct runden
                 const finalPrice = Math.round((selected[i].price - defaultDiscount) * 10) / 10;
                 await base44.entities.WeeklySpecialItem.create({
                     weekly_special_id: specialId,
                     menu_item_id: selected[i].id,
                     menu_item_name: selected[i].name,
                     original_price: selected[i].price,
                     discount_type: 'fixed',
                     discount_value: defaultDiscount,
                     final_price: finalPrice.toFixed(2),
                     display_order: i
                 });
             }

            queryClient.invalidateQueries(['active-weekly-special']);
            queryClient.invalidateQueries(['weekly-special-items']);
            toast.success(`${count} Getränke zufällig ausgewählt!`);
        } catch (error) {
            toast.error('Fehler beim Generieren');
        } finally {
            setIsGenerating(false);
        }
    };

    const replaceItem = async (itemToReplace) => {
        const usedIds = specialItems.filter(si => si.id !== itemToReplace.id).map(si => si.menu_item_id);
        const available = menuItems.filter(m => m.is_available && !usedIds.includes(m.id));

        if (available.length === 0) {
            toast.error('Keine anderen Getränke verfügbar');
            return;
        }

        const newItem = available[Math.floor(Math.random() * available.length)];
        await updateItemMutation.mutateAsync({
            itemId: itemToReplace.id,
            data: {
                menu_item_id: newItem.id,
                menu_item_name: newItem.name,
                original_price: newItem.price,
                discount_value: itemToReplace.discount_value,
                final_price: calculatePrice(newItem.price, itemToReplace.discount_type, itemToReplace.discount_value)
            }
        });
    };

    const calculatePrice = (original, discountType, discountValue) => {
        if (discountType === 'percent') {
            return (Math.round(original * (1 - discountValue / 100) * 10) / 10).toFixed(2);
        }
        // Fixed discount: Endpreis auf 10ct runden
        return (Math.round((original - discountValue) * 10) / 10).toFixed(2);
    };

    return (
        <Card className="border-blue-600 bg-blue-900/40">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-white">
                        <Sparkles className="w-5 h-5 text-blue-400" />
                        Wochenspecial
                    </CardTitle>
                    <div className="flex gap-2 flex-wrap">
                        <BottomSheetSelect
                            value={selectedCount}
                            onValueChange={setSelectedCount}
                            placeholder="Anzahl"
                            options={[
                                { value: '3', label: '3 Getränke' },
                                { value: '4', label: '4 Getränke' },
                                { value: '5', label: '5 Getränke' },
                            ]}
                            triggerClassName="w-auto min-w-[120px] h-9 bg-slate-800 border-blue-600 text-white"
                        />
                        <Button
                            size="sm"
                            onClick={generateRandomSelection}
                            disabled={isGenerating}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            <Shuffle className="w-4 h-4 mr-2" />
                            {isGenerating ? 'Generiert...' : 'Neu auswählen'}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open('/PublicDrinkMenu', '_blank')}
                            className="border-blue-600 text-blue-400 hover:bg-blue-600/10"
                        >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Display
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {specialItems.length === 0 ? (
                    <p className="text-sm text-slate-300 text-center py-6">
                        Klick auf "Neu auswählen" um Wochenspecials vorzuschlagen
                    </p>
                ) : (
                    <div className="space-y-3">
                        {specialItems
                            .sort((a, b) => a.display_order - b.display_order)
                            .map((item) => (
                                <div key={item.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-white text-sm">{item.menu_item_name}</h3>
                                            <div className="flex gap-2 mt-2 text-xs flex-wrap">
                                                <Badge variant="outline" className="text-slate-300">
                                                    Original: {Number(item.original_price).toFixed(2)}€
                                                </Badge>
                                                <Badge className="bg-blue-600 text-white">
                                                    {item.discount_type === 'percent' ? `${item.discount_value}% Rabatt` : 'Spezialpreis'}
                                                </Badge>
                                                <Badge className="bg-green-600 text-white font-bold">
                                                    {Number(item.final_price).toFixed(2)}€
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => replaceItem(item)}
                                                className="text-blue-400 hover:bg-blue-600/20"
                                            >
                                                <Shuffle className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setEditingItemId(item.id);
                                                    setEditValues({
                                                        discount_type: item.discount_type,
                                                        discount_value: item.discount_value
                                                    });
                                                    setShowEditDialog(true);
                                                }}
                                                className="text-slate-400 hover:bg-slate-700"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => deleteItemMutation.mutate(item.id)}
                                                className="text-red-400 hover:bg-red-600/20"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </CardContent>

            {/* Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Rabatt bearbeiten</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Rabattmodus</label>
                            <BottomSheetSelect
                                value={editValues.discount_type}
                                onValueChange={(v) => setEditValues({ ...editValues, discount_type: v })}
                                placeholder="Rabattmodus"
                                options={[
                                    { value: 'percent', label: 'Prozent (%)' },
                                    { value: 'fixed', label: 'Fester Preis (€)' },
                                ]}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {editValues.discount_type === 'percent' ? 'Rabatt %' : 'Preis €'}
                            </label>
                            <Input
                                type="number"
                                step={editValues.discount_type === 'percent' ? '1' : '0.01'}
                                min="0"
                                value={editValues.discount_value}
                                onChange={(e) => setEditValues({ ...editValues, discount_value: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        <Button
                            onClick={() => {
                                const specialItem = specialItems.find(si => si.id === editingItemId);
                                const newPrice = calculatePrice(specialItem.original_price, editValues.discount_type, editValues.discount_value);
                                updateItemMutation.mutate({
                                    itemId: editingItemId,
                                    data: {
                                        discount_type: editValues.discount_type,
                                        discount_value: editValues.discount_value,
                                        final_price: newPrice
                                    }
                                });
                            }}
                            className="w-full"
                        >
                            Speichern
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}