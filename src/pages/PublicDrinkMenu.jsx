import React, { useState, useMemo, useEffect } from 'react';
import { publicBase44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, X, ChevronDown, ChevronUp, Info, Leaf, Flame, Star, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Allergen-Kürzel (EU-weit standardisiert) ──────────────────────────────────
// Mapping: interner Label (aus allergens_list[]) → Anzeige
// Schlüssel = was in MenuItem.allergens_list[] gespeichert ist
const ALLERGENS = {
    'Glutenhaltiges Getreide': { label: 'Gluten',          short: 'G',  key: 'gluten'      },
    'Krebstiere':              { label: 'Krebstiere',       short: 'Kr', key: 'krebstiere'  },
    'Eier':                    { label: 'Eier',             short: 'Ei', key: 'eier'        },
    'Fisch':                   { label: 'Fisch',            short: 'Fi', key: 'fisch'       },
    'Erdnüsse':                { label: 'Erdnüsse',         short: 'En', key: 'erdnuesse'   },
    'Soja':                    { label: 'Soja',             short: 'So', key: 'soja'        },
    'Milch / Laktose':         { label: 'Milch/Laktose',    short: 'Mi', key: 'milch'       },
    'Schalenfrüchte':          { label: 'Schalenfrüchte',   short: 'Nu', key: 'nuesse'      },
    'Sellerie':                { label: 'Sellerie',         short: 'Se', key: 'sellerie'    },
    'Senf':                    { label: 'Senf',             short: 'Sn', key: 'senf'        },
    'Sesam':                   { label: 'Sesam',            short: 'Ss', key: 'sesam'       },
    'Schwefeldioxid / Sulfite':{ label: 'Sulfite',          short: 'SO', key: 'schwefeldi'  },
    'Lupinen':                 { label: 'Lupinen',          short: 'Lu', key: 'lupinen'     },
    'Weichtiere':              { label: 'Weichtiere',       short: 'We', key: 'weichtiere'  },
};

// ── Kategorie-Icons ───────────────────────────────────────────────────────────
const CAT_ICONS = {
    'Bier': '🍺', 'Biere': '🍺', 'Weizen': '🍺', 'Fassbier': '🍺',
    'Wein': '🍷', 'Weine': '🍷', 'Rotwein': '🍷', 'Weißwein': '🍷',
    'Sekt': '🥂', 'Champagner': '🥂', 'Prosecco': '🥂',
    'Cocktail': '🍹', 'Cocktails': '🍹', 'Longdrink': '🥃', 'Longdrinks': '🥃',
    'Spirituosen': '🥃', 'Whisky': '🥃', 'Rum': '🥃', 'Gin': '🥃', 'Vodka': '🥃',
    'Shot': '🥃', 'Shots': '🥃', 'Moonshiner': '🍹',
    'Softdrink': '🥤', 'Softdrinks': '🥤', 'Alkoholfrei': '🥤',
    'Wasser': '💧', 'Kaffee': '☕', 'Heißgetränke': '☕', 'Tee': '🍵',
    'Saft': '🍊', 'Säfte': '🍊', 'Snack': '🍟', 'Snacks': '🍟',
    'Speisen': '🍽️', 'Essen': '🍽️',
};
const getCatIcon = (cat) => {
    if (!cat) return '🍾';
    for (const [k, v] of Object.entries(CAT_ICONS)) {
        if (cat.toLowerCase().includes(k.toLowerCase())) return v;
    }
    return '🍾';
};

// ── Preis formatieren ─────────────────────────────────────────────────────────
const formatPrice = (p) => {
    if (!p && p !== 0) return null;
    return Number(p).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

// ── Detail-Modal ──────────────────────────────────────────────────────────────
function ItemDetailModal({ item, onClose }) {
    if (!item) return null;
    // Allergen-Liste aus allergens_list[] (Array von Labels) ableiten
    const allergenList = Object.entries(ALLERGENS).filter(([label]) => (item.allergens_list || []).includes(label));

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}>

                {/* Bild oder Farbfläche */}
                {item.image_url ? (
                    <div className="w-full h-52 overflow-hidden">
                        <img src={item.image_url} alt={item.name}
                            className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="w-full h-20 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-5xl">
                        {getCatIcon(item.category)}
                    </div>
                )}

                {/* Close */}
                <button onClick={onClose}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white">
                    <X className="w-4 h-4" />
                </button>

                <div className="p-5 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-foreground leading-tight">{item.name}</h2>
                            {item.size && <p className="text-xs text-muted-foreground mt-0.5">{item.size}</p>}
                        </div>
                        {item.price && (
                            <span className="text-xl font-bold text-primary shrink-0">
                                {formatPrice(item.price)}
                            </span>
                        )}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5">
                        {item.is_special && (
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                                <Star className="w-3 h-3" /> Special
                            </span>
                        )}
                        {item.is_seasonal && (
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                                <Leaf className="w-3 h-3" /> Saisonal
                            </span>
                        )}
                        {item.alcohol_content && (
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">
                                <Flame className="w-3 h-3" /> {item.alcohol_content}% vol.
                            </span>
                        )}
                        {item.recipe_variant_name && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                                {item.recipe_variant_name}
                            </span>
                        )}
                    </div>

                    {/* Beschreibung */}
                    {item.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    )}

                    {/* Allergene */}
                    {allergenList.length > 0 && (
                        <div className="pt-2 border-t border-border">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                <Info className="w-3 h-3" /> Allergene & Unverträglichkeiten
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {allergenList.map(([k, v]) => (
                                    <span key={k}
                                        className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                                        {v.short} · {v.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Allergen-Filter Panel ─────────────────────────────────────────────────────
function AllergenFilterPanel({ active, onToggle, onClear }) {
    return (
        <div className="px-4 py-3 border-t border-border bg-card/50">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground">Allergene ausschließen</p>
                {active.length > 0 && (
                    <button onClick={onClear} className="text-xs text-primary">Zurücksetzen</button>
                )}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {Object.entries(ALLERGENS).map(([k, v]) => (
                    <button key={k}
                        onClick={() => onToggle(k)}
                        className={cn(
                            'text-xs px-2.5 py-1 rounded-full border font-medium transition-all',
                            active.includes(k)
                                ? 'bg-destructive text-destructive-foreground border-destructive'
                                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                        )}>
                        {v.short} {v.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Haupt-Karte ────────────────────────────────────────────────────────────────
export default function PublicDrinkMenu() {
    // Tischnummer aus URL
    const tableNumber = new URLSearchParams(window.location.search).get('table');

    const [searchTerm,       setSearchTerm]       = useState('');
    const [activeCategory,   setActiveCategory]   = useState('Alle');
    const [detailItem,       setDetailItem]       = useState(null);
    const [showAllergens,    setShowAllergens]    = useState(false);
    const [allergenFilters,  setAllergenFilters]  = useState([]);

    // ── Daten laden ────────────────────────────────────────────────────────────
    const { data: menuData = {}, isLoading, error } = useQuery({
        queryKey: ['public-menu-data'],
        queryFn: async () => {
            const res = await publicBase44.functions.invoke('getPublicMenu', {});
            const data = res.data || res;
            if (data.error) {
                throw new Error(data.error);
            }
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const allItems    = menuData.items || [];
    const companyInfo = menuData.companyInfo || {};
    const specials    = menuData.specials || [];

    const barName     = companyInfo.company_name || 'Getränkekarte';
    const logoUrl     = companyInfo.logo_url || null;

    // ── Kategorien ─────────────────────────────────────────────────────────────
    const categories = useMemo(() => {
        const cats = [...new Set(allItems.map(i => i.category || 'Sonstiges'))];
        return ['Alle', ...cats];
    }, [allItems]);

    // ── Gefilterte Items ───────────────────────────────────────────────────────
    const filteredItems = useMemo(() => {
        let items = allItems;
        if (activeCategory !== 'Alle') items = items.filter(i => (i.category || 'Sonstiges') === activeCategory);
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            items = items.filter(i =>
                i.name?.toLowerCase().includes(q) ||
                i.description?.toLowerCase().includes(q) ||
                i.category?.toLowerCase().includes(q)
            );
        }
        if (allergenFilters.length > 0) {
            // allergenFilters enthält Label-Keys aus ALLERGENS (z.B. 'Glutenhaltiges Getreide')
            items = items.filter(i => !allergenFilters.some(a => (i.allergens_list || []).includes(a)));
        }
        return items.sort((a, b) => (a.order_position || 999) - (b.order_position || 999));
    }, [allItems, activeCategory, searchTerm, allergenFilters]);

    // ── Gruppiert nach Kategorie ───────────────────────────────────────────────
    const grouped = useMemo(() => {
        if (activeCategory !== 'Alle') return { [activeCategory]: filteredItems };
        return filteredItems.reduce((acc, item) => {
            const cat = item.category || 'Sonstiges';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {});
    }, [filteredItems, activeCategory]);

    const toggleAllergen = (key) => {
        setAllergenFilters(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    // ── CSV Export (via Backend-Function + SDK Blob Download) ───────────────────
    const exportCSV = async () => {
        try {
            const res = await publicBase44.functions.invoke('exportMenuCSV', {});
            const data = res.data || res;
            if (data.error) throw new Error(data.error);
            // Blob aus CSV-String erstellen und als Download auslösen
            const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = data.filename || 'getraenkekarte.csv';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 200);
        } catch (e) {
            console.error('CSV export failed:', e);
        }
    };

    // ── Loading & Error ────────────────────────────────────────────────────────
    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-3">
                <div className="text-4xl animate-bounce">🍹</div>
                <p className="text-muted-foreground text-sm">Karte wird geladen…</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <div className="text-center space-y-2">
                <p className="text-2xl">😕</p>
                <p className="text-foreground font-semibold">Karte nicht verfügbar</p>
                <p className="text-muted-foreground text-sm">Bitte Personal ansprechen.</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">

                {/* Bar-Name + Tisch */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2.5">
                        {logoUrl && (
                            <img src={logoUrl} alt={barName}
                                className="w-8 h-8 rounded-lg object-cover" />
                        )}
                        <div>
                            <h1 className="text-base font-bold text-foreground leading-tight">{barName}</h1>
                            <p className="text-xs text-muted-foreground">Getränkekarte</p>
                        </div>
                    </div>
                    {tableNumber && (
                        <div className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
                            <span className="text-[10px] text-primary font-medium uppercase tracking-wide">Tisch</span>
                            <span className="text-lg font-bold text-primary leading-none">{tableNumber}</span>
                        </div>
                    )}
                </div>

                {/* Suchleiste + Allergen-Toggle */}
                <div className="px-4 pb-2 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Getränk suchen…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full h-10 pl-9 pr-3 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={exportCSV}
                        disabled={filteredItems.length === 0}
                        className="h-10 px-3 rounded-xl border border-border text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 hover:bg-muted disabled:opacity-40"
                        title="Getränkekarte als CSV exportieren"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">CSV</span>
                    </button>
                    <button
                        onClick={() => setShowAllergens(p => !p)}
                        className={cn(
                            'h-10 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all shrink-0',
                            allergenFilters.length > 0
                                ? 'bg-destructive/10 border-destructive/40 text-destructive'
                                : showAllergens
                                ? 'bg-muted border-border text-foreground'
                                : 'bg-muted border-border text-muted-foreground'
                        )}>
                        <Info className="w-3.5 h-3.5" />
                        Allergene
                        {allergenFilters.length > 0 && (
                            <span className="w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                                {allergenFilters.length}
                            </span>
                        )}
                        {showAllergens ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                </div>

                {/* Allergen Panel */}
                {showAllergens && (
                    <AllergenFilterPanel
                        active={allergenFilters}
                        onToggle={toggleAllergen}
                        onClear={() => setAllergenFilters([])}
                    />
                )}

                {/* Kategorie-Chips */}
                <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
                    {categories.map(cat => (
                        <button key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0',
                                activeCategory === cat
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-muted text-muted-foreground hover:text-foreground'
                            )}>
                            {cat !== 'Alle' && <span>{getCatIcon(cat)}</span>}
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Wochenspecials Banner ────────────────────────────────────── */}
            {specials.length > 0 && activeCategory === 'Alle' && !searchTerm && (
                <div className="mx-4 mt-4 mb-2 p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Star className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Wochenspecials</span>
                    </div>
                    <div className="space-y-1.5">
                        {specials.slice(0, 3).map(s => (
                            <div key={s.id} className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-semibold text-foreground">{s.name}</span>
                                    {s.description && <span className="text-xs text-muted-foreground ml-2">{s.description}</span>}
                                </div>
                                {s.special_price && (
                                    <span className="text-sm font-bold text-amber-400 ml-3 shrink-0">
                                        {formatPrice(s.special_price)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Keine Ergebnisse ─────────────────────────────────────────── */}
            {filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                    <span className="text-4xl mb-3">🔍</span>
                    <p className="text-foreground font-semibold">Nichts gefunden</p>
                    <p className="text-muted-foreground text-sm mt-1">
                        {allergenFilters.length > 0
                            ? 'Probiere weniger Allergen-Filter'
                            : 'Versuche einen anderen Suchbegriff'}
                    </p>
                </div>
            )}

            {/* ── Karten-Liste ─────────────────────────────────────────────── */}
            <div className="px-4 pt-3 pb-24 space-y-6">
                {Object.entries(grouped).map(([category, items]) => (
                    <div key={category}>
                        {/* Kategorie-Header */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">{getCatIcon(category)}</span>
                            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">{category}</h2>
                            <span className="text-xs text-muted-foreground">({items.length})</span>
                            <div className="flex-1 h-px bg-border ml-1" />
                        </div>

                        {/* Items */}
                        <div className="space-y-2">
                            {items.map(item => (
                                <button key={item.id}
                                    onClick={() => setDetailItem(item)}
                                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-card/80 active:scale-[0.98] transition-all">

                                    {/* Bild oder Icon */}
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.name}
                                            className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl shrink-0">
                                            {getCatIcon(item.category)}
                                        </div>
                                    )}

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-semibold text-foreground truncate">{item.name}</span>
                                            {item.is_special && <Star className="w-3 h-3 text-amber-400 shrink-0" />}
                                            {item.is_seasonal && <Leaf className="w-3 h-3 text-green-400 shrink-0" />}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {item.size && <span className="text-xs text-muted-foreground">{item.size}</span>}
                                            {item.alcohol_content && (
                                                <span className="text-xs text-muted-foreground">{item.alcohol_content}% vol.</span>
                                            )}
                                        </div>
                                        {item.description && (
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                                        )}
                                    </div>

                                    {/* Preis */}
                                    {item.price && (
                                        <span className="text-sm font-bold text-foreground shrink-0">
                                            {formatPrice(item.price)}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-border px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground">
                    Preise inkl. MwSt. · Alle Angaben ohne Gewähr
                    {allergenFilters.length > 0 && (
                        <span className="text-destructive ml-2 font-medium">
                            · {allergenFilters.length} Allergen{allergenFilters.length > 1 ? 'e' : ''} ausgeschlossen
                        </span>
                    )}
                </p>
            </div>

            {/* ── Detail Modal ──────────────────────────────────────────────── */}
            {detailItem && (
                <ItemDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
            )}
        </div>
    );
}
