import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Package, Trash2, Clock, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LoadingState, ErrorState } from './StorageLoading';
import { fuzzySearch } from '@/lib/fuzzySearch';
import { useLocalPreferences } from '@/lib/useLocalPreferences';

const UNITS = ['Stück', 'l', 'ml', 'kg', 'g'];

export default function AssignTab({ permissions }) {
  const qc = useQueryClient();
  const canEdit = permissions.isManager;
  const prefs = useLocalPreferences('assign');

  const [articleSearch, setArticleSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [slotSearch, setSlotSearch] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ quantity: '', min_stock: '', max_stock: '', unit: 'Stück', notes: '' });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newArticleModal, setNewArticleModal] = useState(false);
  const [newArticleForm, setNewArticleForm] = useState({ name: '', category: '' });

  const { data: articles, isLoading: aL, isError: aE } = useQuery({
    queryKey: ['articles'],
    queryFn: () => base44.entities.Article.filter({ is_active: true }, 'name', 1000)
  });
  const { data: slots, isLoading: sL, isError: sE } = useQuery({
    queryKey: ['slots'],
    queryFn: () => base44.entities.StorageSlot.list('full_name', 1000)
  });
  const { data: assignments, isLoading: asL, isError: asE } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => base44.entities.StorageAssignment.filter({ is_active: true }, '-created_date', 500)
  });

  // Smart default unit from last used
  useEffect(() => {
    const lastUnit = prefs.getLast('unit');
    if (lastUnit) setForm(f => ({ ...f, unit: lastUnit }));
  }, [prefs]);

  // Fuzzy article search with frequency boost
  const filteredArticles = useMemo(() => {
    if (!articleSearch.trim()) return [];
    return fuzzySearch(
      articles || [],
      articleSearch,
      a => [a.name || '', a.category || '', a.barcode || ''],
      a => Math.min(prefs.getFrequency('article', a.id) * 2, 15),
    ).slice(0, 10);
  }, [articles, articleSearch, prefs]);

  // Fuzzy slot search — recent slots boosted
  const filteredSlots = useMemo(() => {
    const all = slots || [];
    if (!slotSearch.trim()) {
      // Show top used slots as quick picks when no search
      return prefs.sortByFrequency(all, s => s.id, 'slot').slice(0, 6);
    }
    return fuzzySearch(
      all,
      slotSearch,
      s => [s.full_name || '', s.short_code || '', s.name || ''],
      s => Math.min(prefs.getFrequency('slot', s.id) * 2, 15),
    ).slice(0, 10);
  }, [slots, slotSearch, prefs]);

  // Recent articles quick picks
  const recentArticleIds = useMemo(() => prefs.getTop('article', 4), [prefs]);
  const recentArticles = useMemo(() => {
    if (!articles || recentArticleIds.length === 0) return [];
    return recentArticleIds.map(id => (articles || []).find(a => a.id === id)).filter(Boolean);
  }, [articles, recentArticleIds]);

  const saveMut = useMutation({
    mutationFn: d => base44.entities.StorageAssignment.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      setSaveSuccess(true);
      setSelectedArticle(null);
      setSelectedSlot(null);
      setArticleSearch('');
      setSlotSearch('');
      setForm(f => ({ quantity: '', min_stock: '', max_stock: '', unit: f.unit, notes: '' }));
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: e => { console.error('Assignment save:', e); alert('Fehler: ' + (e?.message || 'Unbekannt')); }
  });

  const createArticleMut = useMutation({
    mutationFn: d => base44.entities.Article.create(d),
    onSuccess: (newArticle) => {
      qc.invalidateQueries({ queryKey: ['articles'] });
      setSelectedArticle(newArticle);
      setArticleSearch('');
      setNewArticleModal(false);
      setNewArticleForm({ name: '', category: '' });
    },
    onError: e => alert('Fehler: ' + e.message)
  });

  const deleteMut = useMutation({
    mutationFn: id => base44.entities.StorageAssignment.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
    onError: e => { console.error('Assignment delete:', e); alert('Löschen fehlgeschlagen'); }
  });

  const handleSave = () => {
    if (!selectedArticle || !selectedSlot) return;
    prefs.track('article', selectedArticle.id);
    prefs.track('slot', selectedSlot.id);
    prefs.track('unit', form.unit);
    saveMut.mutate({
      article_id: selectedArticle.id,
      article_name: selectedArticle.name || '',
      storage_slot_id: selectedSlot.id,
      slot_full_name: selectedSlot.full_name || selectedSlot.name || '',
      quantity: parseFloat(form.quantity) || 0,
      min_stock: form.min_stock !== '' ? parseFloat(form.min_stock) : null,
      max_stock: form.max_stock !== '' ? parseFloat(form.max_stock) : null,
      unit: form.unit,
      notes: form.notes,
      is_active: true
    });
  };

  return (
    <div className="space-y-5">
      {/* Step 1: Article */}
      <Card className="p-4 space-y-3">
        <p className="font-semibold text-foreground">1. Artikel wählen</p>
        {aE ? <ErrorState text="Artikel konnten nicht geladen werden." /> : selectedArticle ? (
          <div className="flex items-center justify-between bg-status-warn/10 border border-status-warn/30 rounded-lg p-3">
            <div className="flex items-center gap-3">
              {selectedArticle.image_url && <img src={selectedArticle.image_url} alt="" className="w-8 h-8 rounded object-cover" />}
              <div>
                <p className="text-sm font-semibold text-foreground">{selectedArticle.name}</p>
                <p className="text-xs text-muted-foreground">{selectedArticle.category}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setSelectedArticle(null); setArticleSearch(''); }}>Ändern</Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-10 h-11" placeholder={aL ? 'Lädt Artikel…' : 'Artikel suchen…'} value={articleSearch} onChange={e => setArticleSearch(e.target.value)} disabled={aL} />
            </div>
            {aL && <LoadingState text="Lade Artikel…" />}
            {/* Recent picks */}
            {!aL && !articleSearch && recentArticles.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Clock className="w-3 h-3" /> Zuletzt verwendet</p>
                <div className="flex flex-wrap gap-1.5">
                  {recentArticles.map(a => (
                    <button key={a.id} onClick={() => setSelectedArticle(a)}
                      className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-accent/30 min-h-[36px]">
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!aL && articleSearch.length > 0 && (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {filteredArticles.length === 0 ? (
                  <div className="py-2 space-y-2">
                    <p className="text-sm text-muted-foreground">Kein Artikel gefunden</p>
                    <button onClick={() => { setNewArticleForm({ name: articleSearch, category: '' }); setNewArticleModal(true); }}
                      className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-status-warn/50 hover:bg-status-warn/10 text-status-warn text-sm font-medium transition-colors">
                      <Plus className="w-4 h-4" /> "{articleSearch}" neu anlegen
                    </button>
                  </div>
                ) : (
                  <>
                    {filteredArticles.map(a => (
                      <button key={a.id} onClick={() => { setSelectedArticle(a); setArticleSearch(''); }}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left">
                        {a.image_url && <img src={a.image_url} alt="" className="w-7 h-7 rounded object-cover" />}
                        <div>
                          <p className="text-sm font-medium text-foreground">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.category}</p>
                        </div>
                      </button>
                    ))}
                    <button onClick={() => { setNewArticleForm({ name: articleSearch, category: '' }); setNewArticleModal(true); }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg border border-dashed border-border hover:bg-accent/30 text-muted-foreground text-xs transition-colors">
                      <Plus className="w-3 h-3" /> Neuen Artikel anlegen
                    </button>
                  </>
                )}
              </div>
            )}
            {!aL && !articleSearch && (
              <button onClick={() => { setNewArticleForm({ name: '', category: '' }); setNewArticleModal(true); }}
                className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-border hover:bg-accent/30 text-muted-foreground text-xs transition-colors">
                <Plus className="w-3 h-3" /> Neuen Artikel anlegen
              </button>
            )}
          </>
        )}
      </Card>

      {/* Step 2: Slot */}
      <Card className="p-4 space-y-3">
        <p className="font-semibold text-foreground">2. Lagerplatz wählen</p>
        {sE ? <ErrorState text="Lagerplätze konnten nicht geladen werden." /> : selectedSlot ? (
          <div className="flex items-center justify-between bg-status-warn/10 border border-status-warn/30 rounded-lg p-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedSlot.full_name || selectedSlot.name}</p>
              <p className="text-xs text-muted-foreground">{selectedSlot.short_code}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setSelectedSlot(null); setSlotSearch(''); }}>Ändern</Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-10 h-11" placeholder={sL ? 'Lädt Lagerplätze…' : 'Lagerplatz suchen…'} value={slotSearch} onChange={e => setSlotSearch(e.target.value)} disabled={sL} />
            </div>
            {sL && <LoadingState text="Lade Lagerplätze…" />}
            {/* Smart picks: recent or top-used */}
            {!sL && !slotSearch && filteredSlots.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Clock className="w-3 h-3" /> Häufig genutzt</p>
                <div className="flex flex-wrap gap-1.5">
                  {filteredSlots.map(s => (
                    <button key={s.id} onClick={() => setSelectedSlot(s)}
                      className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-accent/30 min-h-[36px] text-left">
                      {s.full_name || s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!sL && slotSearch.length > 0 && (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {filteredSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Kein Lagerplatz gefunden</p>
                ) : filteredSlots.map(s => (
                  <button key={s.id} onClick={() => { setSelectedSlot(s); setSlotSearch(''); }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left">
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.full_name || s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.short_code}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Step 3: Details */}
      {selectedArticle && selectedSlot && (
        <Card className="p-4 space-y-4">
          <p className="font-semibold text-foreground">3. Menge & Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Menge *</Label>
              <Input type="number" min={0} className="h-11" placeholder="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Einheit</Label>
              <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mindestbestand</Label>
              <Input type="number" min={0} className="h-11" placeholder="—" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Maximalbestand</Label>
              <Input type="number" min={0} className="h-11" placeholder="—" value={form.max_stock} onChange={e => setForm(f => ({ ...f, max_stock: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notizen (optional)</Label>
            <Input className="h-11" placeholder="Hinweise zur Lagerung" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          {saveSuccess && (
            <div className="bg-status-ok/10 border border-status-ok/30 rounded-lg p-3 text-sm text-status-ok font-medium">
              ✅ Zuordnung gespeichert!
            </div>
          )}
          <Button onClick={handleSave} disabled={saveMut.isPending || !form.quantity} className="w-full bg-status-warn/70 hover:bg-status-warn/70 text-white h-11">
            {saveMut.isPending ? 'Speichert…' : 'Zuordnung speichern'}
          </Button>
        </Card>
      )}

      {/* New Article Modal */}
      <Dialog open={newArticleModal} onOpenChange={v => !v && setNewArticleModal(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4 text-status-warn" />Neuen Artikel anlegen</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input className="h-11" placeholder="z.B. Vodka Red Bull, Putzmittel…" value={newArticleForm.name}
                onChange={e => setNewArticleForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Kategorie (optional)</Label>
              <Input className="h-11" placeholder="z.B. Spirituosen, Reinigung…" value={newArticleForm.category}
                onChange={e => setNewArticleForm(f => ({ ...f, category: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">Der Artikel wird in der Artikelliste angelegt und direkt hier ausgewählt.</p>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setNewArticleModal(false)} disabled={createArticleMut.isPending}>Abbrechen</Button>
            <Button onClick={() => createArticleMut.mutate({ name: newArticleForm.name.trim(), category: newArticleForm.category.trim() || null, is_active: true })}
              disabled={!newArticleForm.name.trim() || createArticleMut.isPending}
              className="bg-status-warn/70 hover:bg-status-warn/70 text-white">
              {createArticleMut.isPending ? 'Anlegen…' : 'Artikel anlegen & wählen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recent Assignments */}
      {asE ? <ErrorState text="Zuordnungen konnten nicht geladen werden." /> : (
        <div>
          <p className="font-semibold text-foreground mb-3">Aktuelle Zuordnungen</p>
          {asL ? <LoadingState text="Lade Zuordnungen…" /> : !assignments?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">Noch keine Zuordnungen vorhanden.</p>
          ) : (
            <div className="space-y-2">
              {assignments.slice(0, 20).map(a => (
                <Card key={a.id} className="p-3 flex items-center gap-3">
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.article_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.storage_slot_name} · {a.quantity} {a.unit}</p>
                  </div>
                  {canEdit && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => deleteMut.mutate(a.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}