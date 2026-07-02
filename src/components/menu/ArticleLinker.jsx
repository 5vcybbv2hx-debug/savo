import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search, Link } from "lucide-react";
import { fuzzyMatches, articleSearchText } from '@/lib/fuzzySearch';

/**
 * Multi-article linker for menu items.
 * Allows searching and toggling multiple articles from the warehouse.
 */
export default function ArticleLinker({ articles = [], linkedIds = [], onChange }) {
    const [search, setSearch] = useState("");

    const filtered = articles.filter(a => !search || fuzzyMatches(articleSearchText(a), search));

    const toggle = (article) => {
        if (linkedIds.includes(article.id)) {
            onChange(linkedIds.filter(id => id !== article.id));
        } else {
            onChange([...linkedIds, article.id]);
        }
    };

    const linkedArticles = articles.filter(a => linkedIds.includes(a.id));

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
                Mehrere Artikel möglich — z.B. verschiedene Lieferanten oder Varianten.
            </p>

            {/* Selected badges */}
            {linkedArticles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {linkedArticles.map(a => (
                        <span key={a.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary border border-primary/20">
                            {a.name}
                            <button
                                type="button"
                                onClick={() => toggle(a)}
                                className="hover:text-destructive transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Artikel suchen…"
                    className="w-full h-11 pl-9 pr-3 text-sm rounded-xl border border-border/70 bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
            </div>

            {/* Article list */}
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-background divide-y divide-border/30">
                {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground p-4 text-center">Keine Artikel gefunden.</p>
                )}
                {filtered.slice(0, 50).map(article => {
                    const isLinked = linkedIds.includes(article.id);
                    return (
                        <button
                            key={article.id}
                            type="button"
                            onClick={() => toggle(article)}
                            className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-colors ${
                                isLinked ? 'bg-primary/5 font-semibold text-primary' : 'text-foreground hover:bg-muted/50'
                            }`}
                        >
                            <span>
                                {article.name}
                                {article.barcode && <span className="ml-2 text-xs text-muted-foreground">{article.barcode}</span>}
                            </span>
                            {isLinked && <span className="text-xs text-primary font-bold">✓</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}