/**
 * ArticleSearchInput — Live-Suche aus der Artikeldatenbank.
 * Zeigt Vorschlaege waehrend der Eingabe und fuellt beim Auswaehlen
 * automatisch den EK-Preis (purchase_price) aus.
 *
 * Props:
 *  value        string   aktuelle Beschreibung
 *  onChange     (val) => void   Beschreibung aendern
 *  onSelect     (article) => void   Artikel ausgewaehlt (optional)
 *  placeholder  string
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { Search, Package } from 'lucide-react';

export default function ArticleSearchInput({ value, onChange, onSelect, placeholder = 'Artikel suchen…' }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    const { data: articles = [] } = useQuery({
        queryKey: ['articles-for-search'],
        queryFn: () => base44.entities.Article.list('-updated_date', 500),
        staleTime: 60_000,
    });

    // Wenn der Nutzer nicht tippt, zeigen wir die Top-Artikel
    const suggestions = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return articles.filter(a => a.is_active !== false).slice(0, 8);
        const exact = articles.filter(a =>
            a.is_active !== false && a.name?.toLowerCase().includes(q)
        );
        return exact.slice(0, 10);
    }, [articles, query]);

    // Schliessen bei Klick ausserhalb
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, []);

    const handleSelect = (article) => {
        onChange(article.name);
        if (onSelect) onSelect(article);
        setQuery('');
        setOpen(false);
    };

    const displayValue = query || value;

    return (
        <div ref={containerRef} className="relative flex-1">
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        onChange(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className="w-full h-8 pl-8 pr-3 text-sm rounded-md border border-input bg-transparent shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    autoComplete="off"
                />
            </div>

            {open && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                    <div className="max-h-56 overflow-y-auto">
                        {suggestions.map(a => (
                            <button
                                key={a.id}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); handleSelect(a); }}
                                onTouchEnd={(e) => { e.preventDefault(); handleSelect(a); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent active:bg-accent/80 transition-colors text-left min-h-[40px]"
                            >
                                <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate flex-1">{a.name}</span>
                                {a.purchase_price != null && (
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        EK {a.purchase_price.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}