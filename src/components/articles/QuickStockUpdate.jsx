import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function QuickStockUpdate({ open, onClose, article, onUpdate }) {
    const [quantity, setQuantity] = useState('');

    if (!article) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const qty = parseFloat(quantity);
        if (qty && qty !== 0) {
            onUpdate(article, qty);
            setQuantity('');
            onClose();
        }
    };

    const quickAdd = (amount) => {
        onUpdate(article, amount);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Bestand aktualisieren</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div className="p-3 bg-card rounded-lg">
                        <p className="font-medium text-foreground">{article.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Aktuell: {article.current_stock || 0} {article.unit}
                        </p>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            onClick={() => quickAdd(1)}
                            className="h-16"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            +1
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => quickAdd(5)}
                            className="h-16"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            +5
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => quickAdd(-1)}
                            className="h-16"
                        >
                            <Minus className="w-4 h-4 mr-2" />
                            -1
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => quickAdd(-5)}
                            className="h-16"
                        >
                            <Minus className="w-4 h-4 mr-2" />
                            -5
                        </Button>
                    </div>

                    {/* Custom Amount */}
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Benutzerdefinierte Menge</label>
                            <Input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="z.B. 10 oder -3"
                                step="any"
                            />
                            <p className="text-xs text-muted-foreground">
                                Positiv zum Hinzufügen, negativ zum Entfernen
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                                Abbrechen
                            </Button>
                            <Button type="submit" className="flex-1 bg-status-warn/70 hover:bg-status-warn/70">
                                Aktualisieren
                            </Button>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}