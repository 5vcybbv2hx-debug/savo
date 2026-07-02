import React, { useState, useMemo } from 'react';
import { Search, X, Plus, Pencil, Check } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function IngredientSelector({ ingredients, onChange, articles, compact = false }) {
    const [searchTerm, setSearchTerm]   = useState('');
    const [showSearch, setShowSearch]   = useState(false);
    const [editingName, setEditingName] = useState(null); // index of ingredient being renamed

    const safeIngredients = Array.isArray(ingredients) ? ingredients : [];
    const safeArticles    = Array.isArray(articles)    ? articles.filter(a => a && a.name) : [];

    const filteredArticles = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return [];
        return safeArticles.filter(a =>
            a.name.toLowerCase().includes(term) ||
            (a.manufacturer && a.manufacturer.toLowerCase().includes(term)) ||
            (a.category && a.category.toLowerCase().includes(term))
        ).slice(0, 100);
    }, [safeArticles, searchTerm]);

    const addIngredient = (article) => {
        onChange([...safeIngredients, {
            article_id:   article.id,
            article_name: article.name,
            display_name: '',          // leer = article_name wird angezeigt
            amount: 0,
            unit: 'ml'
        }]);
        setSearchTerm('');
        setShowSearch(false);
    };

    const updateIngredient = (index, field, value) => {
        onChange(safeIngredients.map((ing, i) => i === index ? { ...ing, [field]: value } : ing));
    };

    const removeIngredient = (index) => {
        onChange(safeIngredients.filter((_, i) => i !== index));
    };

    const calculateIngredientCost = (ingredient) => {
        const article = safeArticles.find(a => a.id === ingredient.article_id);
        if (!article?.price_per_liter || !ingredient.amount) return 0;
        const unit = (ingredient.unit || 'ml').toLowerCase();
        let liters = 0;
        switch (unit) {
            case 'ml':  liters = ingredient.amount / 1000; break;
            case 'cl':  liters = ingredient.amount / 100;  break;
            case 'l':   liters = ingredient.amount;         break;
            case 'g':   liters = ingredient.amount / 1000; break;
            case 'kg':  liters = ingredient.amount;         break;
            case 'stk': case 'stück':
                return article.purchase_price ? article.purchase_price * ingredient.amount : 0;
            default: return 0;
        }
        return liters * article.price_per_liter;
    };

    const totalCost = safeIngredients.reduce((sum, ing) => sum + calculateIngredientCost(ing), 0);

    return (
        <div className={cn("space-y-2", compact ? "" : "space-y-3")}>
            {!compact && <Label>Zutaten *</Label>}

            {/* Zutaten-Liste */}
            {safeIngredients.length > 0 && (
                <div className="space-y-1.5">
                    {safeIngredients.map((ing, index) => {
                        const cost        = calculateIngredientCost(ing);
                        const shownName   = ing.display_name || ing.article_name;
                        const isRenaming  = editingName === index;

                        return (
                            <div key={index} className={cn(
                                "rounded-lg border border-border",
                                compact ? "bg-background" : "bg-secondary/20"
                            )}>
                                {/* Zeile 1: Name + Stift + Menge + Einheit + Löschen */}
                                <div className={cn("flex gap-2 items-center", compact ? "px-2 py-1.5" : "p-2.5")}>
                                    {isRenaming ? (
                                        <Input
                                            autoFocus
                                            value={ing.display_name ?? ''}
                                            onChange={e => updateIngredient(index, 'display_name', e.target.value)}
                                            onKeyDown={e => (e.key === 'Enter' || e.key === 'Escape') && setEditingName(null)}
                                            placeholder={ing.article_name}
                                            className="flex-1 h-7 text-sm"
                                        />
                                    ) : (
                                        <span className={cn(
                                            "flex-1 text-sm font-medium truncate",
                                            ing.display_name ? "text-foreground" : "text-muted-foreground"
                                        )}>
                                            {shownName}
                                            {ing.display_name && (
                                                <span className="ml-1 text-[10px] text-muted-foreground/60 font-normal">({ing.article_name})</span>
                                            )}
                                        </span>
                                    )}

                                    {/* Stift-Button — Anzeigenamen bearbeiten */}
                                    <button type="button"
                                        onClick={() => setEditingName(isRenaming ? null : index)}
                                        title="Anzeigenamen bearbeiten"
                                        className={cn(
                                            "h-7 w-7 flex items-center justify-center rounded transition-colors shrink-0",
                                            isRenaming
                                                ? "text-primary bg-primary/10"
                                                : "text-muted-foreground/40 hover:text-muted-foreground"
                                        )}>
                                        {isRenaming ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3 h-3" />}
                                    </button>

                                    {cost > 0 && !compact && (
                                        <p className="text-xs font-semibold text-emerald-500 whitespace-nowrap">{cost.toFixed(2)} €</p>
                                    )}
                                    <Input
                                        type="number"
                                        value={ing.amount || ''}
                                        onChange={e => updateIngredient(index, 'amount', parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className="w-16 h-8 text-center px-1"
                                        step="0.1"
                                    />
                                    <select
                                        value={ing.unit || 'ml'}
                                        onChange={e => updateIngredient(index, 'unit', e.target.value)}
                                        className="h-8 px-1.5 rounded-md border border-input bg-background text-foreground text-xs w-14"
                                    >
                                        <option value="ml">ml</option>
                                        <option value="cl">cl</option>
                                        <option value="l">l</option>
                                        <option value="g">g</option>
                                        <option value="kg">kg</option>
                                        <option value="Stk">Stk</option>
                                    </select>
                                    <button type="button" onClick={() => removeIngredient(index)}
                                        className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {totalCost > 0 && !compact && (
                        <div className="flex items-center justify-between px-2.5 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                            <span className="text-xs font-semibold text-emerald-500">Gesamt EK:</span>
                            <span className="text-sm font-bold text-emerald-500">{totalCost.toFixed(2)} €</span>
                        </div>
                    )}
                </div>
            )}

            {/* Suche — inline toggle */}
            {showSearch ? (
                <div className="space-y-1">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                            autoFocus
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Escape' && (setShowSearch(false), setSearchTerm(''))}
                            placeholder="Artikel suchen…"
                            className="pl-8 h-8 text-sm"
                        />
                    </div>
                    {filteredArticles.length > 0 && (
                        <div className="max-h-44 overflow-y-auto border border-border rounded-lg bg-card divide-y divide-border/50">
                            {filteredArticles.map(article => (
                                <button key={article.id} type="button" onClick={() => addIngredient(article)}
                                    className="w-full text-left px-3 py-2 hover:bg-accent transition-colors">
                                    <p className="text-sm font-medium text-foreground leading-tight">{article.name}</p>
                                    <p className="text-xs text-muted-foreground">{article.category}{article.content_amount ? ` · ${article.content_amount} ${article.content_unit}` : ''}</p>
                                </button>
                            ))}
                        </div>
                    )}
                    {searchTerm && filteredArticles.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">Kein Artikel gefunden</p>
                    )}
                </div>
            ) : (
                <button type="button" onClick={() => setShowSearch(true)}
                    className={cn(
                        "w-full flex items-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors",
                        compact ? "h-8 px-3 text-xs" : "h-9 px-3 text-sm"
                    )}>
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    {safeIngredients.length === 0 ? "Zutat hinzufügen…" : "Weitere Zutat…"}
                </button>
            )}
        </div>
    );
}