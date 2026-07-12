import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Layers, Grid3x3, Pencil, Check, Plus, Minus } from 'lucide-react';
import RegelGrid from './RegelGrid';
import { cn } from '@/lib/utils';

const FURNITURE_ICONS = {
    'Kühlschrank': '🧊',
    'Tiefkühlschrank': '❄️',
    'Regal': '📦',
    'Schrank': '🗄️',
    'Schubladenbox': '🗃️',
    'Tisch': '🍽️',
    'Kiste': '📫',
    'Sonstiges': '📌',
};

export default function LayoutTab({ permissions }) {
    const qc = useQueryClient();
    const today = format(new Date(), 'yyyy-MM-dd');
    const canEdit = permissions?.isManager || permissions?.isAdmin;

    // Welche Möbel befinden sich gerade im Edit-Modus
    const [editingFurIds, setEditingFurIds] = useState(new Set());
    // Grid-Größen-Edit pro Möbel (lokaler State vor dem Speichern)
    const [gridSizeEdits, setGridSizeEdits] = useState({}); // furId -> {rows, cols}

    // ── Queries ──────────────────────────────────────────────────────────────
    const { data: areas = [], isLoading: aL } = useQuery({
        queryKey: ['st-areas'],
        queryFn: async () => {
            const d = await base44.entities.Area.list('sort_order', 100);
            return d.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.name || '').localeCompare(b.name || ''));
        },
        staleTime: STALE.SLOW,
    });

    const { data: furniture = [], isLoading: fL } = useQuery({
        queryKey: ['st-furniture'],
        queryFn: async () => {
            const d = await base44.entities.Furniture.list('sort_order', 200);
            return d.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.name || '').localeCompare(b.name || ''));
        },
        staleTime: STALE.SLOW,
    });

    const { data: slots = [], isLoading: sL } = useQuery({
        queryKey: ['slots'],
        queryFn: () => base44.entities.StorageSlot.list('sort_order', 1000),
        staleTime: STALE.MEDIUM,
    });

    const { data: assignments = [], isLoading: asL } = useQuery({
        queryKey: ['assignments'],
        queryFn: async () => {
            const d = await base44.entities.StorageAssignment.filter({ is_active: true }, 'sort_order', 1000);
            return d.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.article_name || '').localeCompare(b.article_name || ''));
        },
        staleTime: STALE.MEDIUM,
    });

    const { data: restockItems = [] } = useQuery({
        queryKey: ['restock-items', today],
        queryFn: () => base44.entities.RestockItem.filter({ date: today }, '-created_date', 500),
        staleTime: STALE.FAST,
    });

    const isLoading = aL || fL || sL || asL;

    // ── Lookups ───────────────────────────────────────────────────────────────
    const furnitureByArea = useMemo(() => {
        const map = {};
        furniture.forEach(f => {
            if (!map[f.area_id]) map[f.area_id] = [];
            map[f.area_id].push(f);
        });
        return map;
    }, [furniture]);

    const slotsByFurniture = useMemo(() => {
        const map = {};
        slots.forEach(s => {
            if (!map[s.furniture_id]) map[s.furniture_id] = [];
            map[s.furniture_id].push(s);
        });
        return map;
    }, [slots]);

    // ── Mutationen ────────────────────────────────────────────────────────────

    // Slot-Position aktualisieren (Drag & Drop)
    const updateSlotMut = useMutation({
        mutationFn: ({ slotId, data }) => base44.entities.StorageSlot.update(slotId, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['slots'] }),
        onError: () => toast.error('Position konnte nicht gespeichert werden'),
    });

    // Möbel-Grid-Größe aktualisieren
    const updateFurnitureMut = useMutation({
        mutationFn: ({ furId, data }) => base44.entities.Furniture.update(furId, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['st-furniture'] });
            toast.success('Regal-Größe gespeichert');
        },
        onError: () => toast.error('Regal-Größe konnte nicht gespeichert werden'),
    });

    // Auffüllliste
    const addToRestockMut = useMutation({
        mutationFn: async ({ slot, assignment }) => {
            const exists = restockItems.find(r =>
                r.assignment_id === assignment.id && r.date === today
            );
            if (exists) {
                toast.info(`${assignment.article_name} ist bereits auf der Auffüllliste`);
                return null;
            }
            const needed = Math.max(0, (assignment.min_stock ?? 0) - (assignment.quantity ?? 0));
            if (needed === 0 && assignment.min_stock != null) {
                toast.info(`${assignment.article_name} — Bestand bereits ausreichend`);
                return null;
            }
            const user = await base44.auth.me();
            await base44.entities.RestockItem.create({
                article_id: assignment.article_id,
                article_name: assignment.article_name,
                article_image_url: null,
                storage_slot_id: slot.id,
                slot_name: slot.name || slot.full_name,
                assignment_id: assignment.id,
                needed_quantity: needed || null,
                quantity: 0,
                area_id: slot.area_id || null,
                area_name: slot.area_name || null,
                restocked_by: user?.full_name || user?.email || 'Unbekannt',
                date: today,
                time: format(new Date(), 'HH:mm'),
                is_completed: false,
                stock_reduced: false,
                added_by: 'layout_viewer',
            });
            toast.success(`${assignment.article_name} zur Auffüllliste hinzugefügt`);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restock-items'] });
            qc.invalidateQueries({ queryKey: ['restock-items', today] });
        },
        onError: () => toast.error('Fehler beim Hinzufügen zur Auffüllliste'),
    });

    const handleAddToRestock = (slot, assignment) => {
        addToRestockMut.mutate({ slot, assignment });
    };

    const handleSlotUpdate = async (slotId, data) => {
        await updateSlotMut.mutateAsync({ slotId, data });
    };

    // Edit-Modus Toggle
    const toggleEditMode = (furId, fur) => {
        setEditingFurIds(prev => {
            const next = new Set(prev);
            if (next.has(furId)) {
                next.delete(furId);
                // Grid-Größe speichern wenn vorhanden
                const edit = gridSizeEdits[furId];
                if (edit) {
                    const newRows = Math.max(1, Math.min(12, edit.rows));
                    const newCols = Math.max(1, Math.min(12, edit.cols));
                    if (newRows !== (fur.grid_rows || 0) || newCols !== (fur.grid_cols || 0)) {
                        updateFurnitureMut.mutate({ furId, data: { grid_rows: newRows, grid_cols: newCols } });
                    }
                    setGridSizeEdits(prev2 => { const n = { ...prev2 }; delete n[furId]; return n; });
                }
            } else {
                next.add(furId);
                setGridSizeEdits(prev2 => ({
                    ...prev2,
                    [furId]: { rows: fur.grid_rows || 3, cols: fur.grid_cols || 4 },
                }));
            }
            return next;
        });
    };

    const adjustGridSize = (furId, field, delta) => {
        setGridSizeEdits(prev => {
            const cur = prev[furId] || { rows: 3, cols: 4 };
            const newVal = Math.max(1, Math.min(12, (cur[field] || 3) + delta));
            return { ...prev, [furId]: { ...cur, [field]: newVal } };
        });
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Lade Regal-Layout…</p>
            </div>
        );
    }

    const activeAreas = areas.filter(a => a.is_active !== false);

    if (activeAreas.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
                <Grid3x3 className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Noch keine Bereiche angelegt.</p>
                <p className="text-xs text-muted-foreground/60">Im Tab „Bereiche" zuerst Bereiche und Möbel anlegen.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Legende */}
            {!canEdit && (
                <p className="text-xs text-muted-foreground/70 px-1">
                    Artikel antippen → zur Auffüllliste hinzufügen.&nbsp;
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Grün</span> = voll ·&nbsp;
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Gelb</span> = knapp ·&nbsp;
                    <span className="text-destructive font-medium">Rot</span> = leer
                </p>
            )}

            {activeAreas.map(area => {
                const areaFurniture = (furnitureByArea[area.id] || []).filter(f => f.is_active !== false);
                if (areaFurniture.length === 0) return null;

                return (
                    <div key={area.id} className="space-y-3">
                        {/* Bereich-Header */}
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                                <Layers className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                            <h3 className="text-sm font-semibold text-foreground">{area.name}</h3>
                        </div>

                        {/* Möbel */}
                        <div className="space-y-3">
                            {areaFurniture.map(fur => {
                                const furSlots = (slotsByFurniture[fur.id] || []).filter(s => s.is_active !== false);
                                const isEditing = editingFurIds.has(fur.id);
                                const sizeEdit = gridSizeEdits[fur.id];
                                // Effektive Grid-Größe (aus localem Edit-State wenn vorhanden)
                                const effectiveRows = isEditing ? (sizeEdit?.rows ?? fur.grid_rows ?? 3) : (fur.grid_rows || 0);
                                const effectiveCols = isEditing ? (sizeEdit?.cols ?? fur.grid_cols ?? 4) : (fur.grid_cols || 0);
                                const hasGrid = effectiveRows > 0 && effectiveCols > 0;
                                const configuredSlots = furSlots.filter(s => s.grid_row != null && s.grid_col != null).length;

                                // Für das Grid ein temporäres furniture-Objekt mit aktuellen Werten
                                const furForGrid = isEditing
                                    ? { ...fur, grid_rows: effectiveRows, grid_cols: effectiveCols }
                                    : fur;

                                return (
                                    <Card key={fur.id} className="overflow-hidden border-border/60">
                                        {/* Möbel-Header */}
                                        <div className={cn(
                                            'flex items-center gap-2.5 px-3 py-2.5 border-b border-border/40',
                                            isEditing ? 'bg-primary/5' : 'bg-muted/20',
                                        )}>
                                            <span className="text-base w-6 text-center shrink-0">
                                                {FURNITURE_ICONS[fur.type] || '📦'}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{fur.name}</p>
                                                {hasGrid && (
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {effectiveRows}×{effectiveCols} Regal · {configuredSlots}/{furSlots.length} Fächer platziert
                                                    </p>
                                                )}
                                            </div>

                                            {/* Grid-Größen-Stepper (nur im Edit-Modus) */}
                                            {isEditing && (
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {/* Spalten */}
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <span className="text-[9px] text-muted-foreground">Sp.</span>
                                                        <div className="flex items-center gap-0.5">
                                                            <button
                                                                className="w-5 h-5 rounded border border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
                                                                onClick={() => adjustGridSize(fur.id, 'cols', -1)}
                                                            ><Minus className="w-2.5 h-2.5" /></button>
                                                            <span className="text-xs font-bold w-4 text-center">{effectiveCols}</span>
                                                            <button
                                                                className="w-5 h-5 rounded border border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
                                                                onClick={() => adjustGridSize(fur.id, 'cols', 1)}
                                                            ><Plus className="w-2.5 h-2.5" /></button>
                                                        </div>
                                                    </div>
                                                    <span className="text-muted-foreground text-xs">×</span>
                                                    {/* Reihen */}
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <span className="text-[9px] text-muted-foreground">Re.</span>
                                                        <div className="flex items-center gap-0.5">
                                                            <button
                                                                className="w-5 h-5 rounded border border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
                                                                onClick={() => adjustGridSize(fur.id, 'rows', -1)}
                                                            ><Minus className="w-2.5 h-2.5" /></button>
                                                            <span className="text-xs font-bold w-4 text-center">{effectiveRows}</span>
                                                            <button
                                                                className="w-5 h-5 rounded border border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
                                                                onClick={() => adjustGridSize(fur.id, 'rows', 1)}
                                                            ><Plus className="w-2.5 h-2.5" /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Edit-Button (nur Manager/Admin) */}
                                            {canEdit && (
                                                <Button
                                                    size="icon"
                                                    variant={isEditing ? 'default' : 'ghost'}
                                                    className={cn('h-7 w-7 shrink-0', isEditing && 'bg-primary text-primary-foreground')}
                                                    onClick={() => toggleEditMode(fur.id, fur)}
                                                    title={isEditing ? 'Fertig' : 'Layout bearbeiten'}
                                                >
                                                    {isEditing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                                                </Button>
                                            )}

                                            {!isEditing && hasGrid && (
                                                <Badge variant="outline" className="text-[10px] shrink-0">
                                                    {effectiveRows}×{effectiveCols}
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Grid-Inhalt */}
                                        <div className="p-3">
                                            {hasGrid ? (
                                                <RegelGrid
                                                    furniture={furForGrid}
                                                    slots={furSlots}
                                                    assignments={assignments}
                                                    activeSlotId={null}
                                                    onAddToRestock={handleAddToRestock}
                                                    readOnly={false}
                                                    editMode={isEditing}
                                                    onSlotUpdate={handleSlotUpdate}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center gap-1.5 py-5 text-center">
                                                    <Grid3x3 className="w-7 h-7 text-muted-foreground/25" />
                                                    {canEdit ? (
                                                        <>
                                                            <p className="text-xs text-muted-foreground/60">Noch kein Regal-Layout konfiguriert</p>
                                                            <p className="text-[11px] text-muted-foreground/40">
                                                                Auf <Pencil className="w-2.5 h-2.5 inline" /> klicken und Spalten/Reihen einstellen
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground/60">Noch kein Regal-Layout konfiguriert</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Edit-Modus Hinweis */}
                                        {isEditing && (
                                            <div className="px-3 pb-3">
                                                <p className="text-[11px] text-primary/70 bg-primary/5 rounded-lg px-3 py-2">
                                                    ✦ Fächer per Drag &amp; Drop platzieren · Fach-Chip ins Raster ziehen · Größe mit ↗ anpassen · Fertig → ✓
                                                </p>
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
