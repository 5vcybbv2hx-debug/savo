import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit3, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BulkEditModal({ open, onClose, selectedArticles, onClearSelection }) {
    const queryClient = useQueryClient();
    const [editType, setEditType] = useState('price');
    const [priceChange, setPriceChange] = useState({ type: 'fixed', value: '' });
    const [newSupplier, setNewSupplier] = useState('');
    const [stockChange, setStockChange] = useState({ type: 'set', value: '' });

    const bulkUpdateMutation = useMutation({
        mutationFn: async (updates) => {
            for (const article of selectedArticles) {
                await base44.entities.Article.update(article.id, updates(article));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['articles']);
            onClearSelection();
            onClose();
        }
    });

    const handlePriceUpdate = () => {
        const value = parseFloat(priceChange.value);
        if (isNaN(value)) return;

        bulkUpdateMutation.mutate((article) => {
            let newPrice = article.purchase_price || 0;
            if (priceChange.type === 'fixed') {
                newPrice = value;
            } else if (priceChange.type === 'increase') {
                newPrice = newPrice + value;
            } else if (priceChange.type === 'decrease') {
                newPrice = Math.max(0, newPrice - value);
            } else if (priceChange.type === 'percent') {
                newPrice = newPrice * (1 + value / 100);
            }
            return { ...article, purchase_price: newPrice };
        });
    };

    const handleSupplierUpdate = () => {
        if (!newSupplier.trim()) return;

        bulkUpdateMutation.mutate((article) => ({
            ...article,
            suppliers: [...new Set([...(article.suppliers || []), newSupplier.trim()])]
        }));
    };

    const handleStockUpdate = () => {
        const value = parseFloat(stockChange.value);
        if (isNaN(value)) return;

        bulkUpdateMutation.mutate((article) => {
            let newStock = article.current_stock || 0;
            if (stockChange.type === 'set') {
                newStock = value;
            } else if (stockChange.type === 'add') {
                newStock = newStock + value;
            } else if (stockChange.type === 'subtract') {
                newStock = Math.max(0, newStock - value);
            }
            return { ...article, current_stock: newStock };
        });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        Massenbearbeitung ({selectedArticles.length} Artikel)
                    </DialogTitle>
                </DialogHeader>

                {/* Selected Articles */}
                <div className="flex flex-wrap gap-2 p-3 bg-secondary/50 rounded-lg max-h-32 overflow-y-auto">
                    {selectedArticles.map(article => (
                        <Badge key={article.id} variant="secondary">
                            {article.name}
                        </Badge>
                    ))}
                </div>

                <Tabs value={editType} onValueChange={setEditType}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="price">Preis</TabsTrigger>
                        <TabsTrigger value="supplier">Lieferant</TabsTrigger>
                        <TabsTrigger value="stock">Bestand</TabsTrigger>
                    </TabsList>

                    {/* Price Tab */}
                    <TabsContent value="price" className="space-y-4">
                        <div className="space-y-2">
                            <Label>Preisänderung</Label>
                            <Select 
                                value={priceChange.type} 
                                onValueChange={(v) => setPriceChange({ ...priceChange, type: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fixed">Fester Preis</SelectItem>
                                    <SelectItem value="increase">Erhöhen um</SelectItem>
                                    <SelectItem value="decrease">Verringern um</SelectItem>
                                    <SelectItem value="percent">Ändern um %</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>
                                {priceChange.type === 'percent' ? 'Prozent' : 'Betrag (€)'}
                            </Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={priceChange.value}
                                onChange={(e) => setPriceChange({ ...priceChange, value: e.target.value })}
                                placeholder={priceChange.type === 'percent' ? 'z.B. 10' : 'z.B. 5.00'}
                            />
                        </div>

                        <Button 
                            onClick={handlePriceUpdate}
                            className="w-full bg-status-warn/70 hover:bg-status-warn/70"
                            disabled={bulkUpdateMutation.isPending}
                        >
                            Preise aktualisieren
                        </Button>
                    </TabsContent>

                    {/* Supplier Tab */}
                    <TabsContent value="supplier" className="space-y-4">
                        <div className="space-y-2">
                            <Label>Lieferant hinzufügen</Label>
                            <Input
                                value={newSupplier}
                                onChange={(e) => setNewSupplier(e.target.value)}
                                placeholder="z.B. C+C, Metro..."
                            />
                            <p className="text-xs text-muted-foreground">
                                Der Lieferant wird zu allen ausgewählten Artikeln hinzugefügt
                            </p>
                        </div>

                        <Button 
                            onClick={handleSupplierUpdate}
                            className="w-full bg-status-warn/70 hover:bg-status-warn/70"
                            disabled={bulkUpdateMutation.isPending}
                        >
                            Lieferant hinzufügen
                        </Button>
                    </TabsContent>

                    {/* Stock Tab */}
                    <TabsContent value="stock" className="space-y-4">
                        <div className="space-y-2">
                            <Label>Bestandsänderung</Label>
                            <Select 
                                value={stockChange.type} 
                                onValueChange={(v) => setStockChange({ ...stockChange, type: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="set">Setzen auf</SelectItem>
                                    <SelectItem value="add">Hinzufügen</SelectItem>
                                    <SelectItem value="subtract">Abziehen</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Menge</Label>
                            <Input
                                type="number"
                                value={stockChange.value}
                                onChange={(e) => setStockChange({ ...stockChange, value: e.target.value })}
                                placeholder="z.B. 10"
                            />
                        </div>

                        <Button 
                            onClick={handleStockUpdate}
                            className="w-full bg-status-warn/70 hover:bg-status-warn/70"
                            disabled={bulkUpdateMutation.isPending}
                        >
                            Bestand aktualisieren
                        </Button>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}