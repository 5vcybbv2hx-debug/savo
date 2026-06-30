import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function IngredientSelector({ ingredients, onChange, articles }) {
    const [searchTerm, setSearchTerm] = useState('');

    const safeIngredients = Array.isArray(ingredients) ? ingredients : [];
    const safeArticles = Array.isArray(articles) ? articles.filter(a => a && a.name) : [];

    const filteredArticles = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return safeArticles;
        return safeArticles.filter(a =>
            a.name.toLowerCase().includes(term) ||
            (a.manufacturer && a.manufacturer.toLowerCase().includes(term)) ||
            (a.category && a.category.toLowerCase().includes(term))
        );
    }, [safeArticles, searchTerm]);

    const addIngredient = (article) => {
        const newIngredient = {
            article_id: article.id,
            article_name: article.name,
            amount: 0,
            unit: 'ml'
        };
        onChange([...safeIngredients, newIngredient]);
        setSearchTerm('');
    };

    const updateIngredient = (index, field, value) => {
        const updated = safeIngredients.map((ing, i) =>
            i === index ? { ...ing, [field]: value } : ing
        );
        onChange(updated);
    };

    const calculateIngredientCost = (ingredient) => {
        const article = safeArticles.find(a => a.id === ingredient.article_id);
        if (!article?.price_per_liter || !ingredient.amount) return 0;

        const unit = (ingredient.unit || 'ml').toLowerCase();
        let amountInLiters = 0;
        switch (unit) {
            case 'ml':
                amountInLiters = ingredient.amount / 1000;
                break;
            case 'cl':
                amountInLiters = ingredient.amount / 100;
                break;
            case 'l':
                amountInLiters = ingredient.amount;
                break;
            case 'g':
                amountInLiters = ingredient.amount / 1000;
                break;
            case 'kg':
                amountInLiters = ingredient.amount;
                break;
            case 'stk':
            case 'stück':
                return article.purchase_price ? article.purchase_price * ingredient.amount : 0;
            default:
                return 0;
        }

        return amountInLiters * article.price_per_liter;
    };

    const removeIngredient = (index) => {
        onChange(safeIngredients.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-3">
            <Label>Zutaten *</Label>

            {/* Live-Suche */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Artikel suchen — Name, Hersteller oder Kategorie..."
                    className="pl-9 h-9"
                />
            </div>

            {searchTerm && filteredArticles.length > 0 && (
                <div className="max-h-52 overflow-y-auto space-y-1 border border-border rounded-lg bg-card">
                    {filteredArticles.slice(0, 20).map(article => (
                        <button
                            key={article.id}
                            type="button"
                            onClick={() => addIngredient(article)}
                            className="w-full text-left px-3 py-2 rounded hover:bg-accent transition-colors"
                        >
                            <p className="text-sm font-medium text-foreground">{article.name}</p>
                            <p className="text-xs text-muted-foreground">
                                {article.category} {article.content_amount && article.content_unit ? `· ${article.content_amount} ${article.content_unit}` : ''}
                            </p>
                        </button>
                    ))}
                </div>
            )}

            {searchTerm && filteredArticles.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                    Keine Artikel gefunden
                </p>
            )}

            {/* Zutaten Liste */}
            {safeIngredients.length > 0 ? (
                <div className="space-y-2">
                    {safeIngredients.map((ing, index) => {
                        const cost = calculateIngredientCost(ing);

                        return (
                            <div key={index} className="flex gap-2 items-start p-3 bg-secondary/20 rounded-lg border border-border">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <p className="text-sm font-medium text-foreground truncate">{ing.article_name}</p>
                                        {cost > 0 && (
                                            <p className="text-xs font-semibold text-green-500 whitespace-nowrap">
                                                {cost.toFixed(2)} €
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Input
                                    type="number"
                                    value={ing.amount}
                                    onChange={(e) => updateIngredient(index, 'amount', parseFloat(e.target.value) || 0)}
                                    placeholder="Menge"
                                    className="w-20 h-9"
                                    step="0.1"
                                />
                                <select
                                    value={ing.unit || 'ml'}
                                    onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                                    className="h-9 px-2 rounded-md border border-input bg-background text-foreground text-sm w-16"
                                >
                                    <option value="ml">ml</option>
                                    <option value="cl">cl</option>
                                    <option value="l">l</option>
                                    <option value="g">g</option>
                                    <option value="kg">kg</option>
                                    <option value="Stk">Stk</option>
                                </select>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeIngredient(index)}
                                    className="h-9 w-9 p-0 text-destructive hover:text-destructive shrink-0"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        );
                    })}

                    {/* Gesamtkosten */}
                    {(() => {
                        const totalCost = safeIngredients.reduce((sum, ing) => sum + calculateIngredientCost(ing), 0);
                        return totalCost > 0 ? (
                            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-green-500">Gesamtkosten (EK):</span>
                                    <span className="text-lg font-bold text-green-500">{totalCost.toFixed(2)} €</span>
                                </div>
                            </div>
                        ) : null;
                    })()}
                </div>
            ) : (
                <div className="text-center py-6 text-muted-foreground bg-secondary/20 rounded-lg border border-dashed border-border">
                    <p className="text-sm">Noch keine Zutaten hinzugefügt</p>
                    <p className="text-xs mt-1">Klicke auf "Artikel hinzufügen"</p>
                </div>
            )}
        </div>
    );
}