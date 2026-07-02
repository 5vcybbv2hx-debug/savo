import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, AlertTriangle, Package } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';

const ALL = '__all__';

export default function StockTab() {
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState(ALL);
  const [filterLow, setFilterLow] = useState(false);

  const { data: areas, isLoading: aL } = useQuery({ queryKey: ['areas'], queryFn: () => base44.entities.Area.list('order', 100) });
  const { data: assignments, isLoading: asL, isError: asE } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => base44.entities.StorageAssignment.filter({ is_active: true }, 'article_name', 1000)
  });

  const isLoading = aL || asL;

  const filtered = useMemo(() => {
    if (!assignments) return [];
    return assignments.filter(a => {
      const q = search.toLowerCase();
      const matchSearch = !search || (a.article_name || '').toLowerCase().includes(q) || (a.storage_slot_name || '').toLowerCase().includes(q);
      const matchArea = filterArea === ALL || a.area_id === filterArea;
      const isLow = a.min_stock != null && a.quantity < a.min_stock;
      return matchSearch && matchArea && (!filterLow || isLow);
    });
  }, [assignments, search, filterArea, filterLow]);

  const lowCount = useMemo(() => (assignments || []).filter(a => a.min_stock != null && a.quantity < a.min_stock).length, [assignments]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : (assignments?.length ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">Zuordnungen gesamt</p>
        </Card>
        <Card className={`p-3 text-center ${!isLoading && lowCount > 0 ? 'border-red-500/50 bg-red-500/5' : ''}`}>
          <p className={`text-2xl font-bold ${!isLoading && lowCount > 0 ? 'text-red-500' : 'text-foreground'}`}>{isLoading ? '—' : lowCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Unter Mindestbestand</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10 h-11" placeholder="Artikel oder Lagerplatz…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Select value={filterArea} onValueChange={setFilterArea} disabled={aL}>
            <SelectTrigger className="h-10 flex-1 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle Bereiche</SelectItem>
              {(areas || []).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <button
            onClick={() => setFilterLow(v => !v)}
            className={`px-3 h-10 rounded-lg border text-xs font-medium transition-all flex items-center gap-1 shrink-0 ${filterLow ? 'bg-red-500 text-white border-red-500' : 'border-border text-muted-foreground hover:bg-accent'}`}
          >
            <AlertTriangle className="w-3 h-3" /> Nur kritisch
          </button>
        </div>
      </div>

      {/* Content */}
      {asE ? <ErrorState text="Bestandsdaten konnten nicht geladen werden." /> :
       isLoading ? <LoadingState text="Lade Bestand…" /> :
       filtered.length === 0 ? (
         <EmptyState text={search || filterArea !== ALL || filterLow ? 'Keine Einträge für diesen Filter.' : 'Noch keine Artikel zugeordnet.'} />
       ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filtered.length} Einträge</p>
          {filtered.map(a => {
            const isLow = a.min_stock != null && a.quantity < a.min_stock;
            return (
              <Card key={a.id} className={`p-3 flex items-center gap-3 ${isLow ? 'border-red-500/40' : ''}`}>
                {a.article_image_url ? (
                  <img src={a.article_image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{a.article_name}</p>
                    {isLow && <Badge variant="destructive" className="text-xs py-0">Kritisch</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{a.storage_slot_name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-sm font-bold ${isLow ? 'text-red-500' : 'text-foreground'}`}>
                      {a.quantity} {a.unit}
                    </span>
                    {a.min_stock != null && <span className="text-xs text-muted-foreground">Min: {a.min_stock}</span>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}