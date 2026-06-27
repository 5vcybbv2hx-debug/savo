/**
 * PublicDrinkMenu — Öffentliche Getränkekarte für Gäste
 * v2: Logo statt Emoji, Kategorie-Icons, bessere Preisdarstellung,
 *     kein Zurück-Button, elegante Footer-Karte mit Bar-Infos aus CompanyInfo
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, X, SlidersHorizontal, Phone, MapPin, Clock, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ── Kategorie-Icons ───────────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  'Bier':         '🍺',
  'Biere':        '🍺',
  'Wein':         '🍷',
  'Weine':        '🍷',
  'Sekt':         '🥂',
  'Champagner':   '🥂',
  'Cocktail':     '🍹',
  'Cocktails':    '🍹',
  'Longdrink':    '🥃',
  'Longdrinks':   '🥃',
  'Spirituosen':  '🥃',
  'Whisky':       '🥃',
  'Shot':         '🥃',
  'Shots':        '🥃',
  'Softdrink':    '🥤',
  'Softdrinks':   '🥤',
  'Alkoholfrei':  '🥤',
  'Wasser':       '💧',
  'Kaffee':       '☕',
  'Heißgetränke': '☕',
  'Tee':          '🍵',
  'Saft':         '🍊',
  'Säfte':        '🍊',
  'Sonstiges':    '🍾',
};

function getCategoryIcon(category) {
  if (!category) return '🍾';
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (category.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '🍾';
}

// ── Allergen-Schnellfilter ────────────────────────────────────────────────────
const TIERISCHE_ALLERGENE = ['Milch', 'Laktose', 'Ei', 'Eier', 'Fisch', 'Krebstiere', 'Weichtiere'];

function hasAllergen(item, keyword) {
  const list = item.allergens_list || [];
  if (list.some(a => a.toLowerCase().includes(keyword.toLowerCase()))) return true;
  if (item.allergens?.toLowerCase().includes(keyword.toLowerCase())) return true;
  return false;
}

const ALLERGEN_FILTERS = [
  {
    id: 'glutenfrei',
    label: 'Glutenfrei',
    match: (item) => !hasAllergen(item, 'Gluten') && !hasAllergen(item, 'Weizen') && !hasAllergen(item, 'Gerste') && !hasAllergen(item, 'Roggen'),
  },
  {
    id: 'laktosefrei',
    label: 'Laktosefrei',
    match: (item) => !hasAllergen(item, 'Milch') && !hasAllergen(item, 'Laktose'),
  },
  {
    id: 'vegan',
    label: 'Vegan',
    match: (item) => !TIERISCHE_ALLERGENE.some(a => hasAllergen(item, a)),
  },
  {
    id: 'alkoholfrei',
    label: 'Alkoholfrei',
    match: (item) => !item.alcohol_content || parseFloat(item.alcohol_content) === 0,
  },
];

// ── Getränke-Karte ────────────────────────────────────────────────────────────
function DrinkCard({ item, onClick }) {
  const hasAllergenInfo = item.allergens_list?.length > 0 || item.additives?.length > 0 || item.allergens;
  const isUnavailable   = item.is_available === false;
  const isAlcoholFree   = !item.alcohol_content || parseFloat(item.alcohol_content) === 0;

  return (
    <button
      onClick={() => !isUnavailable && onClick(item)}
      disabled={isUnavailable}
      className={cn(
        'w-full text-left border rounded-2xl p-4 transition-all min-h-[72px]',
        isUnavailable
          ? 'opacity-40 border-border/30 bg-card/30 cursor-not-allowed'
          : 'bg-card border-border/60 active:scale-[0.98] hover:border-primary/30 hover:shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Links: Name + Meta */}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-semibold text-[15px] text-foreground leading-tight">{item.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {item.size && <span>{item.size}</span>}
            {item.size && item.alcohol_content && Number(item.alcohol_content) > 0 && <span>·</span>}
            {item.alcohol_content && Number(item.alcohol_content) > 0 && (
              <span>{item.alcohol_content}% Vol.</span>
            )}
            {isAlcoholFree && (
              <span className="text-green-500 font-medium">Alkoholfrei</span>
            )}
            {isUnavailable && (
              <span className="text-muted-foreground/60">nicht verfügbar</span>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 leading-snug">{item.description}</p>
          )}
          {/* Badges */}
          {(item.is_seasonal || item.is_special) && (
            <div className="flex gap-1.5 flex-wrap pt-0.5">
              {item.is_seasonal && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                  Saisonal
                </span>
              )}
              {item.is_special && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Special
                </span>
              )}
            </div>
          )}
        </div>

        {/* Rechts: Preis + Allergen-Indikator */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {item.price != null && (
            <p className="text-lg font-bold text-foreground">
              €{Number(item.price).toFixed(2)}
            </p>
          )}
          {hasAllergenInfo && !isUnavailable && (
            <Info className="w-3.5 h-3.5 text-muted-foreground/50" />
          )}
        </div>
      </div>
    </button>
  );
}

// ── Detail-Dialog ─────────────────────────────────────────────────────────────
function DrinkDetail({ item, open, onClose }) {
  if (!item) return null;
  const isAlcoholFree = !item.alcohol_content || parseFloat(item.alcohol_content) === 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl leading-snug">{item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {item.image_url && (
            <img src={item.image_url} alt={item.name}
              className="w-full h-48 object-cover rounded-xl" />
          )}

          {/* Preis + Eigenschaften */}
          <div className="flex items-center justify-between">
            {item.price != null && (
              <p className="text-3xl font-bold text-foreground">
                €{Number(item.price).toFixed(2)}
              </p>
            )}
            <div className="flex gap-2 flex-wrap justify-end">
              {item.size && (
                <span className="text-xs border border-border rounded-full px-2.5 py-1 text-muted-foreground">
                  {item.size}
                </span>
              )}
              {item.alcohol_content && Number(item.alcohol_content) > 0 && (
                <span className="text-xs border border-border rounded-full px-2.5 py-1 text-muted-foreground">
                  {item.alcohol_content}% Vol.
                </span>
              )}
              {isAlcoholFree && (
                <span className="text-xs border border-green-500/30 rounded-full px-2.5 py-1 text-green-500 bg-green-500/8">
                  Alkoholfrei
                </span>
              )}
            </div>
          </div>

          {/* Beschreibung */}
          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          )}

          {/* Allergene & Zusatzstoffe */}
          {(item.allergens_list?.length > 0 || item.additives?.length > 0 || item.allergens) && (
            <div className="bg-muted/40 rounded-xl p-3.5 space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Allergene & Zusatzstoffe
              </p>
              {item.allergens_list?.length > 0 && (
                <div>
                  <p className="text-[10px] text-destructive font-semibold mb-1">Allergene</p>
                  <div className="flex flex-wrap gap-1">
                    {item.allergens_list.map(a => (
                      <span key={a} className="px-2 py-0.5 rounded text-xs bg-destructive/10 border border-destructive/20 text-destructive">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {item.additives?.length > 0 && (
                <div>
                  <p className="text-[10px] text-blue-500 font-semibold mb-1">Zusatzstoffe</p>
                  <div className="flex flex-wrap gap-1">
                    {item.additives.map(d => (
                      <span key={d} className="px-2 py-0.5 rounded text-xs bg-blue-500/10 border border-blue-500/20 text-blue-500">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!item.allergens_list?.length && !item.additives?.length && item.allergens && (
                <p className="text-xs text-muted-foreground">{item.allergens}</p>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/50 text-center">
            Alle Angaben ohne Gewähr · Bei Unverträglichkeiten bitte Personal ansprechen.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function PublicDrinkMenu() {
  const [searchTerm,            setSearchTerm]           = useState('');
  const [selectedCategory,      setSelectedCategory]     = useState('Alle');
  const [activeAllergenFilters, setActiveAllergenFilters] = useState([]);
  const [detailItem,            setDetailItem]           = useState(null);
  const [showFilters,           setShowFilters]          = useState(false);

  const { data: items = [], isLoading: itemsLoading, error: itemsError } = useQuery({
    queryKey: ['public-menu-items'],
    queryFn: () => base44.entities.MenuItem.filter({ is_available: true }, 'category', 1000),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const { data: companyList = [] } = useQuery({
    queryKey: ['public-company'],
    queryFn: () => base44.entities.CompanyInfo.list('created_date', 1),
    staleTime: 10 * 60 * 1000,
  });

  const { data: specials = [] } = useQuery({
    queryKey: ['public-specials'],
    queryFn: () => base44.entities.WeeklySpecial.filter({ is_active: true }),
    staleTime: 5 * 60 * 1000,
  });

  const companyInfo   = companyList[0] || {};
  const barName       = companyInfo.company_name || 'Getränkekarte';
  const activeSpecial = specials[0] || null;

  // Kategorien
  const categories = useMemo(() => {
    const cats = new Set(items.map(i => i.category || 'Sonstiges').filter(Boolean));
    return ['Alle', ...Array.from(cats)];
  }, [items]);

  // Gefilterte Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const cat = item.category || 'Sonstiges';
      if (selectedCategory !== 'Alle' && cat !== selectedCategory) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!item.name?.toLowerCase().includes(q) &&
            !(item.description?.toLowerCase() || '').includes(q) &&
            !(item.category?.toLowerCase() || '').includes(q)) return false;
      }
      for (const filterId of activeAllergenFilters) {
        const f = ALLERGEN_FILTERS.find(af => af.id === filterId);
        if (f && !f.match(item)) return false;
      }
      return true;
    });
  }, [items, selectedCategory, searchTerm, activeAllergenFilters]);

  // Gruppiert nach Kategorie
  const groupedItems = useMemo(() => {
    const map = {};
    filteredItems.forEach(item => {
      const cat = item.category || 'Sonstiges';
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    Object.values(map).forEach(arr =>
      arr.sort((a, b) => (a.order_position || 999) - (b.order_position || 999))
    );
    return map;
  }, [filteredItems]);

  const toggleAllergenFilter = (id) =>
    setActiveAllergenFilters(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );

  const activeFilterCount = activeAllergenFilters.length + (selectedCategory !== 'Alle' ? 1 : 0);
  const resetFilters = () => {
    setActiveAllergenFilters([]);
    setSelectedCategory('Alle');
    setSearchTerm('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* ── Sticky Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background/95 border-b border-border/60 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2.5">

          {/* Brand-Zeile */}
          <div className="flex items-center gap-3 min-h-[44px]">
            {companyInfo.logo_url ? (
              <img
                src={companyInfo.logo_url}
                alt={barName}
                className="w-10 h-10 rounded-xl object-contain bg-card border border-border/40 p-1 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
                {barName.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-foreground truncate">{barName}</h1>
              <p className="text-[11px] text-muted-foreground">
                {itemsLoading ? 'Lädt…' : `${items.length} Getränke`}
              </p>
            </div>
          </div>

          {/* Suche + Filter-Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Getränk suchen…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-11 text-base rounded-full bg-muted/40 border-transparent focus:border-border focus:bg-background"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={cn(
                'h-11 px-3.5 rounded-full border font-semibold transition-all text-sm shrink-0 relative flex items-center gap-1.5',
                showFilters || activeFilterCount > 0
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground bg-card'
              )}>
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Allergen-Filter Panel */}
          {showFilters && (
            <div className="pb-1 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Filtern nach
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALLERGEN_FILTERS.map(f => (
                  <button key={f.id} onClick={() => toggleAllergenFilter(f.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all min-h-[36px]',
                      activeAllergenFilters.includes(f.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground bg-card hover:text-foreground'
                    )}>
                    {f.label}
                  </button>
                ))}
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border text-muted-foreground bg-card hover:text-destructive hover:border-destructive/40 transition-all min-h-[36px]">
                    Zurücksetzen
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Kategorie-Chips mit Icons */}
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1.5 pb-1">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-all min-h-[36px] flex items-center gap-1.5',
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground shadow shadow-primary/20'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}>
                  {cat !== 'Alle' && <span>{getCategoryIcon(cat)}</span>}
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 py-5 space-y-6 pb-16">

        {/* Weekly Special Banner */}
        {activeSpecial && (
          <section className="bg-primary/8 border border-primary/20 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
              ✨ Wochen-Special
            </p>
            <p className="font-bold text-foreground">{activeSpecial.title}</p>
            {activeSpecial.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{activeSpecial.description}</p>
            )}
            {activeSpecial.special_price && (
              <p className="text-xl font-bold text-primary mt-2">
                €{Number(activeSpecial.special_price).toFixed(2)}
              </p>
            )}
          </section>
        )}

        {/* Loading */}
        {itemsLoading && (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {itemsError && (
          <div className="text-center py-16 text-muted-foreground space-y-3">
            <p className="text-base font-semibold">Karte konnte nicht geladen werden</p>
            <button onClick={() => window.location.reload()}
              className="text-sm text-primary underline hover:opacity-80 font-medium">
              Neu laden
            </button>
          </div>
        )}

        {/* Empty State */}
        {!itemsLoading && !itemsError && Object.keys(groupedItems).length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-base font-semibold">Keine Getränke gefunden</p>
            <p className="text-sm mt-1">Andere Filter oder Suchbegriff versuchen.</p>
            {activeFilterCount > 0 && (
              <button onClick={resetFilters}
                className="mt-4 text-sm text-primary underline hover:opacity-80 font-medium">
                Filter zurücksetzen
              </button>
            )}
          </div>
        )}

        {/* Kategorien + Karten */}
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <section key={category} className="space-y-2">
            <div className="flex items-center gap-3 pt-1">
              <span className="text-lg">{getCategoryIcon(category)}</span>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                {category}
              </h2>
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[10px] text-muted-foreground">{categoryItems.length}</span>
            </div>
            <div className="space-y-2">
              {categoryItems.map(item => (
                <DrinkCard key={item.id} item={item} onClick={setDetailItem} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mt-8 px-4 pb-10">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">

            {/* Brand-Header */}
            <div className="px-5 pt-5 pb-4 flex items-center gap-3 border-b border-border/40">
              {companyInfo.logo_url ? (
                <img src={companyInfo.logo_url} alt={barName}
                  className="w-11 h-11 rounded-xl object-contain bg-background border border-border/40 p-1 shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
                  {barName.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-bold text-foreground text-sm leading-tight">{barName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Getränkekarte</p>
              </div>
            </div>

            {/* Kontakt-Infos als Kacheln */}
            {(companyInfo.address || companyInfo.phone || companyInfo.opening_hours) && (
              <div className="divide-y divide-border/40">
                {companyInfo.address && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(companyInfo.address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-muted/40 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <MapPin className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Adresse</p>
                      <p className="text-sm text-foreground truncate">{companyInfo.address}</p>
                    </div>
                  </a>
                )}
                {companyInfo.phone && (
                  <a href={`tel:${companyInfo.phone}`}
                    className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-muted/40 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <Phone className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Telefon</p>
                      <p className="text-sm text-foreground">{companyInfo.phone}</p>
                    </div>
                  </a>
                )}
                {companyInfo.opening_hours && (
                  <div className="flex items-start gap-3.5 px-5 py-3.5">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Öffnungszeiten</p>
                      <p className="text-sm text-foreground whitespace-pre-line">{companyInfo.opening_hours}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Legal */}
            <div className="px-5 py-3 bg-muted/20 border-t border-border/40">
              <p className="text-[10px] text-muted-foreground/50 text-center">
                Preise inkl. MwSt. · Bei Allergien bitte Personal ansprechen.
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Detail Dialog */}
      <DrinkDetail item={detailItem} open={!!detailItem} onClose={() => setDetailItem(null)} />
    </div>
  );
}
