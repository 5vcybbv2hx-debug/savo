import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, X, ShoppingCart } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

export default function LowStockAlert() {
    const [open, setOpen] = React.useState(false);
    const queryClient = useQueryClient();

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list('name')
    });

    const { data: currentUser } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me()
    });

    const createShoppingMutation = useMutation({
        mutationFn: (data) => base44.entities.ShoppingList.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['shopping-list']);
        }
    });

    const lowStockArticles = articles.filter(
        article => article.min_stock && article.current_stock < article.min_stock
    );

    const addToShopping = async (article) => {
        await createShoppingMutation.mutateAsync({
            item_name: article.name,
            category: article.suppliers?.[0] || 'C+C',
            quantity: parseFloat(article.quantity || 1),
            unit: article.unit || '',
            status: 'offen',
            notes: `Niedrig im Bestand: ${article.current_stock} / ${article.min_stock}`
        });
    };

    const addAllToShopping = async () => {
        for (const article of lowStockArticles) {
            await addToShopping(article);
        }
        setOpen(false);
    };

    if (lowStockArticles.length === 0) return null;

    return (
        <>
            <Button
                variant="outline"
                onClick={() => setOpen(true)}
                className="border-status-danger/70 text-status-danger hover:bg-status-danger/15 relative"
            >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Bestandsalarm
                <Badge className="ml-2 bg-status-danger/70 text-foreground">
                    {lowStockArticles.length}
                </Badge>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-status-danger">
                            <AlertTriangle className="w-5 h-5" />
                            Niedrige Lagerbestände
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">
                                {lowStockArticles.length} Artikel unter Mindestbestand
                            </p>
                            <Button
                                onClick={addAllToShopping}
                                size="sm"
                                className="bg-status-warn/70 hover:bg-status-warn/70"
                            >
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Alle zur Einkaufsliste
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {lowStockArticles.map(article => (
                                <Card key={article.id} className="p-4 bg-status-danger/15 border-status-danger/25">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                {article.image_url && (
                                                    <img 
                                                        src={article.image_url} 
                                                        alt={article.name}
                                                        className="w-10 h-10 object-cover rounded"
                                                    />
                                                )}
                                                <div>
                                                    <h4 className="font-semibold text-muted-foreground">
                                                        {article.name}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        {article.barcode}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-sm">
                                                <div>
                                                    <span className="text-muted-foreground">Aktuell: </span>
                                                    <span className="font-semibold text-status-danger">
                                                        {article.current_stock || 0}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Minimum: </span>
                                                    <span className="font-semibold">
                                                        {article.min_stock}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Fehlend: </span>
                                                    <span className="font-semibold text-status-warn">
                                                        {article.min_stock - (article.current_stock || 0)}
                                                    </span>
                                                </div>
                                            </div>

                                            {article.suppliers?.length > 0 && (
                                                <p className="text-xs text-foreground0 mt-2">
                                                    📦 {article.suppliers.join(', ')}
                                                </p>
                                            )}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => addToShopping(article)}
                                            className="shrink-0"
                                        >
                                            <ShoppingCart className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}