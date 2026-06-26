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
import { Plus, Pencil, Trash2, Layers, ChevronRight, ChevronDown, Loader2, Package, Grid3x3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

// ── Inline Fach-Zeile ─────────────────────────────────────────────────────────
function SlotRow({ slot, canEdit, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20 last:border-0 hover:bg-secondary/10 transition-colors group">
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
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground"
            onClick={() => onEdit(slot)}>
            <Pencil className="w-3 h-3" />
          </Button>
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

  // Löschen
  const [deleteAreaTarget, setDeleteAreaTarget] = useState(null);
  const [deleteFurTarget,  setDeleteFurTarget]  = useState(null);
  const [deleteSlotTarget, setDeleteSlotTarget] = useState(null);

  // ── Queries ───────────────────────────────────────────────────────────────────
  const { data: areas = [],     isLoading: aL } = useQuery({ queryKey: ['st-areas'],     queryFn: () => base44.entities.Area.list('name', 100),         staleTime: STALE.SLOW });
  const { data: furniture = [], isLoading: fL } = useQuery({ queryKey: ['st-furniture'], queryFn: () => base44.entities.Furniture.list('name', 200),     staleTime: STALE.SLOW });
  const { data: slots = [] }                    = useQuery({ queryKey: ['slots'],         queryFn: () => base44.entities.StorageSlot.list('name', 1000),  staleTime: STALE.MEDIUM });

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
  const saveSlotMut = useMutation({
    mutationFn: d => slotModal.data?.id
      ? base44.entities.StorageSlot.update(slotModal.data.id, d)
      : base44.entities.StorageSlot.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['slots'] }); setSlotModal({ open: false, data: null, furnitureId: '', areaId: '' }); toast.success('Fach gespeichert'); },
    onError:   e => toast.error('Fehler: ' + (e?.message || 'Unbekannt')),
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
  const openAddSlot  = (furnitureId, areaId) => { setSlotForm({ name: '', capacity: '', notes: '' }); setSlotModal({ open: true, data: null, furnitureId, areaId }); };
  const openEditSlot = s  => { setSlotForm({ name: s.name, capacity: s.capacity || '', notes: s.notes || '' }); setSlotModal({ open: true, data: s, furnitureId: s.furniture_id, areaId: s.area_id }); };

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
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSlotModal({ open: false, data: null, furnitureId: '', areaId: '' })}>Abbrechen</Button>
            <Button onClick={() => {
              if (!slotForm.name.trim()) { toast.error('Name erforderlich'); return; }
              const fur = furniture.find(f => f.id === slotModal.furnitureId);
              saveSlotMut.mutate({
                name:         slotForm.name.trim(),
                furniture_id: slotModal.furnitureId,
                area_id:      slotModal.areaId,
                area_name:    fur?.area_name || '',
                capacity:     slotForm.capacity ? parseInt(slotForm.capacity) : null,
                notes:        slotForm.notes,
                is_active:    true,
              });
            }} disabled={saveSlotMut.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
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
