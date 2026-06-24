import { useState, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Check, X, Search, Package } from 'lucide-react';

const UNIT_OPTIONS = ['Stück', 'Flaschen', 'Liter', 'ml', 'kg', 'g', 'Kisten', 'Packungen'];

/**
 * Sticky inline input with dual-mode:
 *  1. Search → pick article from DB → inline quantity picker
 *  2. Freetext → Enter to add immediately (qty 1, category "Sonstiges")
 */
export default function QuickInput({ articles = [], onAdd, isAdding = false }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState('Stück');
    const inputRef = useRef(null);

    const matches = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return articles.filter(a =>
            a.name?.toLowerCase().includes(q) ||
            a.category?.toLowerCase().includes(q) ||
            a.barcode?.includes(searchQuery)
        ).slice(0, 6);
    }, [searchQuery, articles]);

    const reset = () => {
        setSearchQuery('');
        setSelectedArticle(null);
        setQuantity(1);
        setUnit('Stück');
    };

    const focusInput = () => {
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleSelectArticle = (article) => {
        setSelectedArticle(article);
        setUnit(article.content_unit || 'Stück');
        setQuantity(1);
        setSearchQuery('');
    };

    const handleFreetextAdd = () => {
        const name = searchQuery.trim();
        if (!name) return;
        onAdd({
            item_name: name,
            article_id: null,
            article_image_url: null,
            quantity: 1,
            unit: 'Stück',
            category: 'Sonstiges',
            notes: null,
        });
        reset();
        focusInput();
    };

    const handleArticleConfirm = () => {
        if (!selectedArticle) return;
        onAdd({
            item_name: selectedArticle.name,
            article_id: selectedArticle.id,
            article_image_url: selectedArticle.image_url || null,
            quantity: Number(quantity) || 1,
            unit: unit || 'Stück',
            category: selectedArticle.category || 'Sonstiges',
            notes: null,
        });
        reset();
        focusInput();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !selectedArticle) {
            e.preventDefault();
            handleFreetextAdd();
        }
        if (e.key === 'Escape') reset();
    };

    // ── Quantity picker mode (article selected) ───────────────────────
    if (selectedArticle) {
        return (
            <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-xl pb-2 -mx-3 px-3 pt-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                    {selectedArticle.image_url ? (
                        <img src={selectedArticle.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{selectedArticle.name}</p>
                        <p className="text-xs text-muted-foreground">{selectedArticle.category || 'Sonstiges'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setQuantity(Math.max(0.5, Number(quantity) - 1))}
                            className="w-8 h-8 rounded-lg bg-muted hover:bg-accent flex items-center justify-center transition-colors"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                            type="number"
                            inputMode="decimal"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-12 h-8 text-center rounded-lg bg-background border border-border/70 text-sm font-semibold"
                        />
                        <button
                            type="button"
                            onClick={() => setQuantity(Number(quantity) + 1)}
                            className="w-8 h-8 rounded-lg bg-muted hover:bg-accent flex items-center justify-center transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="h-8 rounded-lg bg-background border border-border/70 text-xs px-1.5 min-w-[70px]"
                    >
                        {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <Button type="button" size="icon" onClick={handleArticleConfirm} disabled={isAdding} className="h-8 w-8">
                        <Check className="w-4 h-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={reset} className="h-8 w-8">
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        );
    }

    // ── Search mode ───────────────────────────────────────────────────
    return (
        <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-xl pb-2 -mx-3 px-3 pt-2 border-b border-border/30">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                <Input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Artikel suchen oder Freitext…"
                    className="pl-9 pr-11 h-11"
                    autoComplete="off"
                />
                <button
                    type="button"
                    onClick={handleFreetextAdd}
                    disabled={!searchQuery.trim() || isAdding}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 active:scale-90 transition-all"
                >
                    <Plus className="w-4 h-4" />
                </button>
                {matches.length > 0 && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setSearchQuery('')} />
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/70 rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto">
                            {matches.map(article => (
                                <button
                                    key={article.id}
                                    type="button"
                                    onClick={() => handleSelectArticle(article)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 border-b border-border/40 last:border-0 transition-colors text-left min-h-[44px]"
                                >
                                    {article.image_url ? (
                                        <img src={article.image_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                            <Package className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{article.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {article.category || 'Sonstiges'}
                                            {article.content_unit ? ` · ${article.content_unit}` : ''}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}