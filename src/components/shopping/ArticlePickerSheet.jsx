import React, { useState, useMemo, useRef } from 'react';
import { X, Search, Package, AlertTriangle, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ArticlePickerSheet({ open, onClose, articles, suppliers, onAdd }) {
    const [query, setQuery] = useState('');
    const [qty, setQty] = useState({});
    const searchRef = useRef(null);

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q) return articles.filter(a => a.is_active !== false);
        return articles.filter(a =>
            a.is_active !== false && (
                a.name?.toLowerCase().includes(q) ||
                a.category?.toLowerCase().includes(q) ||
                a.barcode?.includes(q)
            )
        );
    }, [articles, query]);

    const getQty = (id) => qty[id] ?? 1;

    const handleAdd = (article) => {
        const primarySupplier = article.supplier_details?.find(s => s.is_primary)?.supplier_name
            || article.suppliers?.[0]
            || suppliers[0]?.name
            || '';

        onAdd({
            article_id: article.id,
            item_name: article.name,
            category: primarySupplier,
            quantity: getQty(article.id),
            unit: article.content_unit || article.unit || 'Stück',
            status: 'offen',
            notes: ''
        });
    };

    const adjustQty = (id, delta) => {
        setQty(prev => ({ ...prev, [id]: Math.max(1, (prev[id] ?? 1) + delta) }));
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col" onClick={(e) => e.target === e.currentTarget && onClose()}>
            {/* Overlay */}
            <div className="flex-1 bg-black/50" onClick={onClose} />

            {/* Sheet */}
            <div className="bg-card rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
                {/* Handle + Header */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h2 className="font-bold text-foreground text-base">Artikel hinzufügen</h2>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-accent text-muted-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
                        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <input
                            ref={searchRef}
                            autoFocus
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Name, Kategorie oder Barcode..."
                            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                        />
                        {query && (
                            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Article list */}
                <div className="flex-1 overflow-y-auto divide-y divide-border">
                    {filtered.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Keine Artikel gefunden</p>
                        </div>
                    ) : (
                        filtered.map(article => {
                            const isLowStock = article.min_stock != null && article.current_stock != null && article.current_stock <= article.min_stock;
                            const q = getQty(article.id);
                            return (
                                <div key={article.id} className="flex items-center gap-3 px-4 py-3 active:bg-accent transition-colors">
                                    {/* Thumbnail */}
                                    <div className="w-12 h-12 rounded-lg bg-secondary flex-shrink-0 overflow-hidden">
                                        {article.image_url ? (
                                            <img src={article.image_url} alt={article.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">{article.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            {article.category && (
                                                <span className="text-[10px] text-muted-foreground">{article.category}</span>
                                            )}
                                            {article.current_stock != null && (
                                                <span className={cn(
                                                    'text-[10px] font-medium',
                                                    isLowStock ? 'text-status-danger' : 'text-status-ok'
                                                )}>
                                                    {isLowStock && <AlertTriangle className="inline w-3 h-3 mr-0.5" />}
                                                    Bestand: {article.current_stock} {article.content_unit || ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Qty + Add */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => adjustQty(article.id, -1)}
                                            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-foreground hover:bg-accent transition-colors"
                                        >
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="w-6 text-center text-sm font-bold text-foreground">{q}</span>
                                        <button
                                            onClick={() => adjustQty(article.id, 1)}
                                            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-foreground hover:bg-accent transition-colors"
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => handleAdd(article)}
                                            className="ml-1 h-9 px-3 rounded-xl bg-status-warn/70 hover:bg-status-warn/70 text-muted-foreground font-bold text-sm transition-colors flex items-center gap-1"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}