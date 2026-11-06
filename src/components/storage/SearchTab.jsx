import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Package, ChevronRight, ArrowLeft, X, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { LoadingState } from '@/components/ui/StateDisplay';
import { fuzzySearch, highlightMatch } from '@/lib/fuzzySearch';
import { useLocalPreferences } from '@/lib/useLocalPreferences';

// ── Highlight component ──────────────────────────────────────────────────────
function Highlight({ text, query }) {
  const { before, match, after } = highlightMatch(text || '', query || '');
  if (!match) return <span>{text}</span>;
  return <span>{before}<strong className="text-status-warn">{match}</strong>{after}</span>;
}

// ── Slot Detail View ─────────────────────────────────────────────────────────
function SlotDetail({ slot, assignments, onBack }) {
  const slotAssignments = assignments.filter(a => a.storage_slot_id === slot.id);
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> Zurück zur Suche
      </button>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-status-warn/10 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-status-warn" />
          </div>
          <div>
            <p className="font-bold text-foreground">{slot.full_name || slot.name}</p>
            <Badge variant="outline" className="mt-1 text-xs font-mono">{slot.short_code}</Badge>
          </div>
        </div>
      </Card>

      <div>
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Inhalt ({slotAssignments.length} Artikel)
        </p>
        {slotAssignments.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">Dieses Fach ist leer</Card>
        ) : (
          <div className="space-y-2">
            {slotAssignments.map(a => {
              const isLow = a.min_stock != null && a.quantity < a.min_stock;
              return (
                <Card key={a.id} className={`p-4 flex items-center gap-3 ${isLow ? 'border-status-danger/40' : ''}`}>
                  {a.article_image_url ? (
                    <img src={a.article_image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{a.article_name}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className={`text-sm font-bold ${isLow ? 'text-status-danger' : 'text-foreground'}`}>
                        {a.quantity} {a.unit}
                      </span>
                      {a.min_stock != null && <span className="text-xs text-muted-foreground">Min: {a.min_stock}</span>}
                      {isLow && (
                        <Badge variant="destructive" className="text-xs py-0 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Kritisch
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Article Result Card ───────────────────────────────────────────────────────
function ArticleResult({ article, articleAssignments, slots, onSelectSlot, query, frequency }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-3 p-4 hover:bg-accent/30 transition-colors">
        {article.image_url ? (
          <img src={article.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <Package className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-foreground"><Highlight text={article.name} query={query} /></p>
            {frequency > 3 && <TrendingUp className="w-3 h-3 text-status-warn shrink-0" title="Häufig gesucht" />}
          </div>
          <p className="text-xs text-muted-foreground">{articleAssignments.length} Lagerplatz{articleAssignments.length !== 1 ? 'e' : ''}</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-border">
          {articleAssignments.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Kein Lagerplatz zugeordnet</p>
          ) : (
            articleAssignments.map((a, i) => {
              const slot = slots.find(s => s.id === a.storage_slot_id);
              const isLow = a.min_stock != null && a.quantity < a.min_stock;
              return (
                <button key={a.id} onClick={() => slot && onSelectSlot(slot)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <MapPin className="w-4 h-4 text-status-warn shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {slot?.full_name || a.storage_slot_name || '—'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className={`text-xs font-medium ${isLow ? 'text-status-danger' : 'text-muted-foreground'}`}>
                        {a.quantity} {a.unit}{a.min_stock != null ? ` (Min: ${a.min_stock})` : ''}
                      </span>
                      {slot?.short_code && <span className="text-xs font-mono text-muted-foreground">{slot.short_code}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main SearchTab ────────────────────────────────────────────────────────────
export default function SearchTab() {
  const [search, setSearch] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const prefs = useLocalPreferences('storage_search');

  const { data: articles, isLoading: aL } = useQuery({
    queryKey: ['articles'],
    queryFn: () => base44.entities.Article.filter({ is_active: true }, 'name', 1000)
  });
  const { data: slots, isLoading: sL } = useQuery({
    queryKey: ['slots'],
    queryFn: () => base44.entities.StorageSlot.list('full_name', 1000)
  });
  const { data: assignments, isLoading: asL } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => base44.entities.StorageAssignment.filter({ is_active: true }, 'article_name', 1000)
  });

  const isLoading = aL || sL || asL;

  const assignedArticleIds = useMemo(() => new Set((assignments || []).map(a => a.article_id)), [assignments]);

  // Recently / frequently searched articles for empty state
  const recentArticleIds = useMemo(() => prefs.getTop('article', 5), [prefs]);
  const recentArticles = useMemo(() => {
    if (!articles || recentArticleIds.length === 0) return [];
    return recentArticleIds.map(id => (articles || []).find(a => a.id === id)).filter(Boolean);
  }, [articles, recentArticleIds]);

  // Fuzzy article search with frequency boost
  const matchingArticles = useMemo(() => {
    if (!search.trim() || isLoading) return [];
    const candidates = (articles || []).filter(a => assignedArticleIds.has(a.id));
    return fuzzySearch(
      candidates,
      search,
      a => [a.name || '', a.category || '', a.barcode || ''],
      a => Math.min(prefs.getFrequency('article', a.id) * 2, 15), // boost by usage, capped
    ).slice(0, 15);
  }, [articles, search, assignedArticleIds, isLoading, prefs]);

  // Slot fallback fuzzy search (when no articles match)
  const matchingSlots = useMemo(() => {
    if (!search.trim() || matchingArticles.length > 0 || isLoading) return [];
    return fuzzySearch(
      slots || [],
      search,
      s => [s.full_name || '', s.short_code || '', s.name || ''],
    ).slice(0, 10);
  }, [slots, search, matchingArticles, isLoading]);

  const handleSelectSlot = (slot) => {
    prefs.track('slot', slot.id);
    setSelectedSlot(slot);
  };

  const handleArticleTrack = (article) => {
    prefs.track('article', article.id);
  };

  if (selectedSlot) {
    return <SlotDetail slot={selectedSlot} assignments={assignments || []} onBack={() => setSelectedSlot(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Hero Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
        <Input
          className="pl-12 pr-10 h-14 text-base rounded-xl border-2 focus-visible:border-status-warn/70"
          placeholder="Artikel suchen… z.B. Gin, Wodka, Soda"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Loading */}
      {isLoading && <LoadingState text="Lade Lagerdaten…" />}

      {/* Empty state with recent searches */}
      {!search && !isLoading && (
        <div className="space-y-4">
          <Card className="p-6 text-center">
            <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="font-semibold text-foreground">Wo ist was?</p>
            <p className="text-sm text-muted-foreground mt-1">Gib einen Artikelnamen ein, um den Lagerplatz zu finden.</p>
          </Card>

          {recentArticles.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Zuletzt gesucht
              </p>
              <div className="flex flex-wrap gap-2">
                {recentArticles.map(a => (
                  <button key={a.id} onClick={() => setSearch(a.name)}
                    className="px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground hover:bg-accent/30 transition-colors min-h-[40px]">
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Searching but still loading */}
      {search && isLoading && (
        <p className="text-sm text-muted-foreground text-center py-4">Suche wird geladen…</p>
      )}

      {/* Article results */}
      {!isLoading && matchingArticles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">{matchingArticles.length} Artikel gefunden</p>
          {matchingArticles.map(article => (
            <div key={article.id} onClick={() => handleArticleTrack(article)}>
              <ArticleResult
                article={article}
                articleAssignments={(assignments || []).filter(a => a.article_id === article.id)}
                slots={slots || []}
                onSelectSlot={handleSelectSlot}
                query={search}
                frequency={prefs.getFrequency('article', article.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Slot fallback */}
      {!isLoading && matchingSlots.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Lagerplätze</p>
          {matchingSlots.map(slot => (
            <Card key={slot.id} className="overflow-hidden">
              <button onClick={() => handleSelectSlot(slot)} className="w-full flex items-center gap-3 p-4 hover:bg-accent/30 transition-colors text-left">
                <MapPin className="w-5 h-5 text-status-warn shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    <Highlight text={slot.full_name || slot.name} query={search} />
                  </p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{slot.short_code}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* No results */}
      {search && !isLoading && matchingArticles.length === 0 && matchingSlots.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          <p className="font-medium">Kein Artikel gefunden für „{search}"</p>
          <p className="text-sm mt-1">Prüfe ob der Artikel einem Lagerplatz zugeordnet ist.</p>
        </Card>
      )}
    </div>
  );
}