/**
 * StructureTab — Bereich → Möbel → Fächer (vollständige 3-Ebenen-Hierarchie)
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Layers, ChevronRight, ChevronDown, Loader2, Package, Grid3x3, X, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fuzzySearch } from '@/lib/fuzzySearch';

const FURNITURE_TYPES = ['Regal','Schrank','Kühlschrank','Tiefkühlschrank','Schubladenbox','Tisch','Kiste','Sonstiges'];
const FURNITURE_ICONS = {
  'Kühlschrank':      '🧊',
  'Tiefkühlschrank':  '❄️',
  'Regal':            '📦',
  'Schrank':          '🗄️',
  'Schubladenbox':    '🗃️',
  'Tisch':            '🍽️',
  'Kiste':            '📫',
  'Sonstiges':        '📌',
};
const UNITS = ['Stück', 'Fl.', 'l', 'ml', 'kg', 'g'];

function generateShortCode(areaName, furnitureName, slotName) {
  const initials = (s) => (s || '').replace(/[^a-zA-ZÀ-ž0-9]/g, '').slice(0, 2).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `${initials(areaName)}-${initials(furnitureName)}-${initials(slotName)}${rand}`;
}

// ── Inline Fach-Zeile ─────────────────────────────────────────────────────────
function SlotRow({ slot, canEdit, onEdit, onDelete }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 border-b border-border/20 last:border-0 hover:bg-secondary/10 transition-colors group",
        canEdit && "cursor-pointer"
      )}
      onClick={() => canEdit && onEdit(slot)}
    >
      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0">
        <Grid3x3 className="w-2.5 h-2.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{slot.name}</p>
        {slot.short_code && (
          <p className="text-[10px] font-mono text-muted-foreground">{slot.short_code}</p>
        )}
      </div>
      {slot.capacity && (
        <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground border-border/50">
          {slot.capacity} Pl.
        </Badge>
      )}
      {canEdit && (
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(slot)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function StructureTab({ permissions }) {
  const qc = useQueryClient();
  const canEdit = permissions.isManager;

  const [expandedAreas, setExpandedAreas]   = useState({});
  const [expandedFurs,  setExpandedFurs]    = useState({});

  // Modals
  const [areaModal,  setAreaModal]  = useState({ open: false, data: null });
  const [furModal,   setFurModal]   = useState({ open: false, data: null, areaId: '' });
  const [slotModal,  setSlotModal]  = useState({ open: false, data: null, furnitureId: '', areaId: '' });
  const [areaForm,   setAreaForm]   = useState({ name: '', description: '' });
  const [furForm,    setFurForm]    = useState({ name: '', type: '', area_id: '', notes: '' });
  const [slotForm,   setSlotForm]   = useState({ name: '', capacity: '', notes: '' });

  // Inline Artikel-Zuordnung im Fach-Dialog
  const [assignRows,           setAssignRows]           = useState([]);
  const [deletedAssignmentIds, setDeletedAssignmentIds] = useState([]);
  const [articleSearchOpen,    setArticleSearchOpen]    = useState(false);
  const [articleSearchQuery,   setArticleSearchQuery]   = useState('');

  // Löschen
  const [deleteAreaTarget, setDeleteAreaTarget] = useState(null);
  const [deleteFurTarget,  setDeleteFurTarget]  = useState(null);
  const [deleteSlotTarget, setDeleteSlotTarget] = useState(null);

  // ── Queries ───────────────────────────────────────────────────────────────────
  const { data: areas = [],     isLoading: aL } = useQuery({ queryKey: ['st-areas'],     queryFn: () => base44.entities.Area.list('name', 100),         staleTime: STALE.SLOW });
  const { data: furniture = [], isLoading: fL } = useQuery({ queryKey: ['st-furniture'], queryFn: () => base44.entities.Furniture.list('name', 200),     staleTime: STALE.SLOW });
  const { data: slots = [] }                    = useQuery({ queryKey: ['slots'],         queryFn: () => base44.entities.StorageSlot.list('name', 1000),  staleTime: STALE.MEDIUM });
  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => base44.entities.StorageAssignment.filter({ is_active: true }, 'article_name', 1000),
    staleTime: STALE.MEDIUM,
  });
  const { data: articles = [] } = useQuery({
    queryKey: ['articles'],
    queryFn: () => base44.entities.Article.filter({ is_active: true }, 'name', 1000),
    staleTime: STALE.SLOW,
  });

  const isLoading = aL || fL;

  // Lookups
  const slotsByFurniture = useMemo(() => {
    const map = {};
    slots.forEach(s => {
      if (!map[s.furniture_id]) map[s.furniture_id] = [];
      map[s.furniture_id].push(s);
    });
    return map;
  }, [slots]);

  const slotCountByArea = useMemo(() => {
    const map = {};
    slots.forEach(s => { map[s.area_id] = (map[s.area_id] || 0) + 1; });
    return map;
  }, [slots]);

  const toggleArea = id => setExpandedAreas(e => ({ ...e, [id]: !e[id] }));
  const toggleFur  = id => setExpandedFurs(e  => ({ ...e, [id]: !e[id] }));

  // ── Area CRUD ─────────────────────────────────────────────────────────────────
  const saveAreaMut = useMutation({
    mutationFn: d => areaModal.data?.id
      ? base44.entities.Area.update(areaModal.data.id, d)
      : base44.entities.Area.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['st-areas'] }); setAreaModal({ open: false, data: null }); toast.success('Bereich gespeichert'); },
    onError:   e => toast.error('Fehler: ' + (e?.message || 'Unbekannt')),
  });
  const deleteAreaMut = useMutation({
    mutationFn: id => base44.entities.Area.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['st-areas'] }); toast.success('Bereich gelöscht'); setDeleteAreaTarget(null); },
    onError:   () => { toast.error('Erst alle Möbel in diesem Bereich entfernen'); setDeleteAreaTarget(null); },
  });

  // ── Furniture CRUD ────────────────────────────────────────────────────────────
  const saveFurMut = useMutation({
    mutationFn: d => furModal.data?.id
      ? base44.entities.Furniture.update(furModal.data.id, d)
      : base44.entities.Furniture.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['st-furniture'] }); setFurModal({ open: false, data: null, areaId: '' }); toast.success('Möbel gespeichert'); },
    onError:   e => toast.error('Fehler: ' + (e?.message || 'Unbekannt')),
  });
  const deleteFurMut = useMutation({
    mutationFn: id => base44.entities.Furniture.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['st-furniture'] }); toast.success('Möbel gelöscht'); setDeleteFurTarget(null); },
    onError:   () => { toast.error('Erst alle Fächer in diesem Möbel entfernen'); setDeleteFurTarget(null); },
  });

  // ── Slot CRUD ─────────────────────────────────────────────────────────────────
  // Speichert das Fach (inkl. korrekter Denormalisierung + Short-Code) UND synct inline zugeordnete Artikel
  const saveSlotMut = useMutation({
    mutationFn: async () => {
      if (!slotForm.name.trim()) throw new Error('Name erforderlich');
      const fur  = furniture.find(f => f.id === slotModal.furnitureId);
      const area = areas.find(a => a.id === slotModal.areaId);
      if (!fur || !area) throw new Error('Bereich/Möbel nicht gefunden');

      const trimmedName = slotForm.name.trim();
      const slotData = {
        name:           trimmedName,
        furniture_id:   fur.id,
        furniture_name: fur.name,
        furniture_type: fur.type,
        area_id:        area.id,
        area_name:      area.name,
        full_name:      `${area.name} › ${fur.name} › ${trimmedName}`,
        short_code:     slotModal.data?.short_code || generateShortCode(area.name, fur.name, trimmedName),
        capacity:       slotForm.capacity ? parseInt(slotForm.capacity) : null,
        notes:          slotForm.notes,
        is_active:      true,
      };

      const savedSlot = slotModal.data?.id
        ? await base44.entities.StorageSlot.update(slotModal.data.id, slotData)
        : await base44.entities.StorageSlot.create(slotData);
      const slotId = slotModal.data?.id || savedSlot?.id;

      for (const delId of deletedAssignmentIds) {
        await base44.entities.StorageAssignment.delete(delId);
      }
      for (const row of assignRows) {
        const payload = {
          article_id:      row.article_id,
          article_name:    row.article_name,
          storage_slot_id: slotId,
          slot_full_name:  slotData.full_name,
          quantity:        row.quantity  !== '' && row.quantity  != null ? parseFloat(row.quantity)  : 0,
          min_stock:       row.min_stock !== '' && row.min_stock != null ? parseFloat(row.min_stock) : null,
          unit:            row.unit || 'Stück',
          is_active:       true,
        };
        if (row.id) await base44.entities.StorageAssignment.update(row.id, payload);
        else        await base44.entities.StorageAssignment.create(payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slots'] });
      qc.invalidateQueries({ queryKey: ['assignments'] });
      setSlotModal({ open: false, data: null, furnitureId: '', areaId: '' });
      toast.success('Fach gespeichert');
    },
    onError: e => toast.error('Fehler: ' + (e?.message || 'Unbekannt')),
  });
  const deleteSlotMut = useMutation({
    mutationFn: id => base44.entities.StorageSlot.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['slots'] }); toast.success('Fach gelöscht'); setDeleteSlotTarget(null); },
    onError:   () => { toast.error('Löschen fehlgeschlagen'); setDeleteSlotTarget(null); },
  });

  // ── Modal Opener ──────────────────────────────────────────────────────────────
  const openAddArea  = () => { setAreaForm({ name: '', description: '' }); setAreaModal({ open: true, data: null }); };
  const openEditArea = a  => { setAreaForm({ name: a.name, description: a.description || '' }); setAreaModal({ open: true, data: a }); };
  const openAddFur   = areaId => { setFurForm({ name: '', type: '', area_id: areaId, notes: '' }); setFurModal({ open: true, data: null, areaId }); };
  const openEditFur  = f  => { setFurForm({ name: f.name, type: f.type, area_id: f.area_id, notes: f.notes || '' }); setFurModal({ open: true, data: f, areaId: f.area_id }); };
  const resetAssignState = () => {
    setAssignRows([]);
    setDeletedAssignmentIds([]);
    setArticleSearchOpen(false);
    setArticleSearchQuery('');
  };

  const openAddSlot  = (furnitureId, areaId) => {
    setSlotForm({ name: '', capacity: '', notes: '' });
    resetAssignState();
    setSlotModal({ open: true, data: null, furnitureId, areaId });
  };
  const openEditSlot = s  => {
    setSlotForm({ name: s.name, capacity: s.capacity || '', notes: s.notes || '' });
    const existing = assignments
      .filter(a => a.storage_slot_id === s.id && a.is_active !== false)
      .map(a => ({
        id: a.id, article_id: a.article_id, article_name: a.article_name,
        quantity: a.quantity ?? '', min_stock: a.min_stock ?? '', unit: a.unit || 'Stück',
      }));
    setAssignRows(existing);
    setDeletedAssignmentIds([]);
    setArticleSearchOpen(false);
    setArticleSearchQuery('');
    setSlotModal({ open: true, data: s, furnitureId: s.furniture_id, areaId: s.area_id });
  };

  const updateAssignRow = (idx, patch) =>
    setAssignRows(rows => rows.map((r, i) => i === idx ? { ...r, ...patch } : r));

  const removeAssignRow = idx => {
    const row = assignRows[idx];
    if (row.id) setDeletedAssignmentIds(ids => [...ids, row.id]);
    setAssignRows(rows => rows.filter((_, i) => i !== idx));
  };

  const addArticleAssignment = article => {
    if (assignRows.some(r => r.article_id === article.id)) {
      toast.info('Dieser Artikel ist bereits zugeordnet.');
      return;
    }
    setAssignRows(rows => [...rows, {
      id: null, article_id: article.id, article_name: article.name,
      quantity: '', min_stock: '', unit: 'Stück',
    }]);
    setArticleSearchQuery('');
    setArticleSearchOpen(false);
  };

  const filteredModalArticles = useMemo(() => {
    if (!articleSearchQuery.trim()) return [];
    return fuzzySearch(
      articles, articleSearchQuery,
      a => [a.name || '', a.category || '', a.barcode || '']
    ).slice(0, 8);
  }, [articles, articleSearchQuery]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          {areas.length} Bereiche · {furniture.length} Möbel · {slots.length} Fächer
        </p>
        {canEdit && (
          <Button size="sm" onClick={openAddArea}
            className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />Bereich anlegen
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </div>
      ) : areas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Noch keine Bereiche</p>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={openAddArea} className="mt-3">
              Ersten Bereich anlegen
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {areas.map(area => {
            const areaFurniture = furniture.filter(f => f.area_id === area.id);
            const totalSlots    = slotCountByArea[area.id] || 0;
            const isExpanded    = !!expandedAreas[area.id];

            return (
              <Card key={area.id} className="overflow-hidden border-border/60">
                {/* ── Bereich Header ── */}
                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={() => toggleArea(area.id)}>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{area.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {areaFurniture.length} Möbel · {totalSlots} Fächer
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"
                          onClick={e => { e.stopPropagation(); openEditArea(area); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={e => { e.stopPropagation(); setDeleteAreaTarget(area); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* ── Möbel-Liste ── */}
                {isExpanded && (
                  <div className="border-t border-border/50">
                    {areaFurniture.length === 0 && (
                      <p className="px-4 py-3 text-xs text-muted-foreground/50">Noch keine Möbel in diesem Bereich</p>
                    )}

                    {areaFurniture.map(f => {
                      const furSlots   = slotsByFurniture[f.id] || [];
                      const isFurOpen  = !!expandedFurs[f.id];

                      return (
                        <div key={f.id} className="border-b border-border/30 last:border-0">
                          {/* Möbel-Header */}
                          <div
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/20 transition-colors cursor-pointer"
                            onClick={() => toggleFur(f.id)}
                          >
                            <span className="text-base w-6 text-center shrink-0">{FURNITURE_ICONS[f.type] || '📦'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{f.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {f.type} · {furSlots.length} Fach{furSlots.length !== 1 ? 'er' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-0.5">
                              {canEdit && (
                                <>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                                    onClick={e => { e.stopPropagation(); openEditFur(f); }}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                    onClick={e => { e.stopPropagation(); setDeleteFurTarget(f); }}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                              {isFurOpen
                                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                            </div>
                          </div>

                          {/* ── Fächer ── */}
                          {isFurOpen && (
                            <div className="bg-muted/20 border-t border-border/20">
                              {furSlots.length === 0 && (
                                <p className="px-6 py-2 text-[11px] text-muted-foreground/50">Noch keine Fächer</p>
                              )}
                              {furSlots.map(slot => (
                                <SlotRow
                                  key={slot.id}
                                  slot={slot}
                                  canEdit={canEdit}
                                  onEdit={openEditSlot}
                                  onDelete={setDeleteSlotTarget}
                                />
                              ))}
                              {canEdit && (
                                <button
                                  onClick={() => openAddSlot(f.id, area.id)}
                                  className="w-full flex items-center gap-2 px-6 py-2 text-[11px] text-primary hover:bg-primary/5 transition-colors font-semibold"
                                >
                                  <Plus className="w-3 h-3" /> Fach hinzufügen
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {canEdit && (
                      <button onClick={() => openAddFur(area.id)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-amber-500 hover:bg-amber-500/5 transition-colors font-semibold">
                        <Plus className="w-3.5 h-3.5" />Möbel hinzufügen
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Bereich Modal ───────────────────────────────────────────────────────── */}
      <Dialog open={areaModal.open} onOpenChange={open => !open && setAreaModal({ open: false, data: null })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{areaModal.data ? 'Bereich bearbeiten' : 'Neuer Bereich'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <Input className="h-9" placeholder="z.B. Bar, Keller, Küche…"
                value={areaForm.name} onChange={e => setAreaForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Beschreibung (optional)</Label>
              <Input className="h-9" placeholder="Kurze Beschreibung"
                value={areaForm.description} onChange={e => setAreaForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAreaModal({ open: false, data: null })}>Abbrechen</Button>
            <Button onClick={() => {
              if (!areaForm.name.trim()) { toast.error('Name erforderlich'); return; }
              saveAreaMut.mutate({ name: areaForm.name.trim(), description: areaForm.description, is_active: true });
            }} disabled={saveAreaMut.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
              {saveAreaMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Möbel Modal ─────────────────────────────────────────────────────────── */}
      <Dialog open={furModal.open} onOpenChange={open => !open && setFurModal({ open: false, data: null, areaId: '' })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{furModal.data ? 'Möbel bearbeiten' : 'Neues Möbel'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Typ *</Label>
              <Select value={furForm.type} onValueChange={v => setFurForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Möbeltyp wählen…" /></SelectTrigger>
                <SelectContent>
                  {FURNITURE_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{FURNITURE_ICONS[t] || '📦'} {t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <Input className="h-9" placeholder="z.B. Kühlschrank Bar, Regal Links…"
                value={furForm.name} onChange={e => setFurForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bereich *</Label>
              <Select value={furForm.area_id} onValueChange={v => setFurForm(f => ({ ...f, area_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Bereich wählen…" /></SelectTrigger>
                <SelectContent>
                  {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notizen (optional)</Label>
              <Input className="h-9" placeholder="z.B. Nur Getränke"
                value={furForm.notes} onChange={e => setFurForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFurModal({ open: false, data: null, areaId: '' })}>Abbrechen</Button>
            <Button onClick={() => {
              const area = areas.find(a => a.id === furForm.area_id);
              if (!furForm.name.trim() || !furForm.type || !area) { toast.error('Bitte alle Felder ausfüllen'); return; }
              saveFurMut.mutate({ name: furForm.name.trim(), type: furForm.type, area_id: area.id, area_name: area.name, notes: furForm.notes, is_active: true });
            }} disabled={saveFurMut.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
              {saveFurMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Fach Modal ──────────────────────────────────────────────────────────── */}
      <Dialog open={slotModal.open} onOpenChange={open => !open && setSlotModal({ open: false, data: null, furnitureId: '', areaId: '' })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{slotModal.data ? 'Fach bearbeiten' : 'Neues Fach'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <Input className="h-9" placeholder="z.B. Fach 1, Reihe A, Tür Links…"
                value={slotForm.name} onChange={e => setSlotForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kapazität (optional)</Label>
              <Input className="h-9" type="number" min="1" placeholder="z.B. 24"
                value={slotForm.capacity} onChange={e => setSlotForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notizen (optional)</Label>
              <Input className="h-9" placeholder="z.B. Nur Weißwein"
                value={slotForm.notes} onChange={e => setSlotForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {/* Inline Artikel-Zuordnung — optional, z.B. für Kühlschubladen mit fixem Soll-Bestand */}
            <div className="space-y-1.5 pt-1 border-t border-border/50">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Link2 className="w-3 h-3" />Artikel-Zuordnung (optional)
              </Label>

              {assignRows.length > 0 && (
                <div className="space-y-1.5">
                  {assignRows.map((row, idx) => (
                    <div key={row.id || `new-${idx}`}
                      className="flex items-center gap-1.5 bg-secondary/40 border border-border/50 rounded-lg p-2">
                      <span className="flex-1 text-xs font-medium text-foreground truncate" title={row.article_name}>
                        {row.article_name}
                      </span>
                      <Input type="number" inputMode="decimal" className="h-7 w-14 text-xs px-1.5" placeholder="Menge"
                        value={row.quantity} onChange={e => updateAssignRow(idx, { quantity: e.target.value })} />
                      <Input type="number" inputMode="decimal" className="h-7 w-16 text-xs px-1.5" placeholder="Soll"
                        value={row.min_stock} onChange={e => updateAssignRow(idx, { min_stock: e.target.value })} />
                      <Select value={row.unit} onValueChange={v => updateAssignRow(idx, { unit: v })}>
                        <SelectTrigger className="h-7 w-[4.5rem] text-xs px-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => removeAssignRow(idx)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {articleSearchOpen ? (
                <div className="space-y-1.5">
                  <Input autoFocus className="h-9 text-xs" placeholder="Artikel suchen…"
                    value={articleSearchQuery} onChange={e => setArticleSearchQuery(e.target.value)} />
                  {articleSearchQuery.trim() && (
                    <div className="border border-border rounded-lg max-h-36 overflow-y-auto bg-card">
                      {filteredModalArticles.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground p-2">Keine Treffer</p>
                      ) : filteredModalArticles.map(a => (
                        <button key={a.id} type="button"
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-secondary/50 border-b border-border/30 last:border-0"
                          onClick={() => addArticleAssignment(a)}>
                          {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground"
                    onClick={() => { setArticleSearchOpen(false); setArticleSearchQuery(''); }}>
                    Abbrechen
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-8 text-xs w-full"
                  onClick={() => setArticleSearchOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />Artikel verknüpfen
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground/60">
                Menge = aktueller Bestand hier, Soll = Mindestbestand für Auffüll-Warnung.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSlotModal({ open: false, data: null, furnitureId: '', areaId: '' })}>Abbrechen</Button>
            <Button onClick={() => saveSlotMut.mutate()} disabled={saveSlotMut.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {saveSlotMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirms ──────────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteAreaTarget} onOpenChange={open => !open && setDeleteAreaTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bereich löschen?</AlertDialogTitle>
            <AlertDialogDescription>„{deleteAreaTarget?.name}" wird dauerhaft gelöscht. Erst alle Möbel entfernen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAreaMut.mutate(deleteAreaTarget?.id)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteFurTarget} onOpenChange={open => !open && setDeleteFurTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Möbel löschen?</AlertDialogTitle>
            <AlertDialogDescription>„{deleteFurTarget?.name}" wird dauerhaft gelöscht. Erst alle Fächer entfernen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteFurMut.mutate(deleteFurTarget?.id)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSlotTarget} onOpenChange={open => !open && setDeleteSlotTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fach löschen?</AlertDialogTitle>
            <AlertDialogDescription>„{deleteSlotTarget?.name}" wird dauerhaft gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSlotMut.mutate(deleteSlotTarget?.id)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
