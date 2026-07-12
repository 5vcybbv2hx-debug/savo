import { useMemo } from 'react';
import { base44, STALE } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Layers, Grid3x3 } from 'lucide-react';
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

export default function LayoutTab() {
    const qc = useQueryClient();
    const today = format(new Date(), 'yyyy-MM-dd');

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

    // ── Auffüllliste hinzufügen ───────────────────────────────────────────────
    const addToRestockMut = useMutation({
        mutationFn: async ({ slot, assignment }) => {
            // Bereits heute hinzugefügt?
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
        onError: (err) => {
            console.error(err);
            toast.error('Fehler beim Hinzufügen zur Auffüllliste');
        },
    });

    const handleAddToRestock = (slot, assignment) => {
        addToRestockMut.mutate({ slot, assignment });
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
                <p className="text-xs text-muted-foreground/60">Im Tab „Struktur" zuerst Bereiche und Möbel anlegen.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            <p className="text-xs text-muted-foreground/70 px-1">
                Tippe auf einen Artikel um ihn zur Auffüllliste hinzuzufügen. 
                Farbcode: <span className="text-emerald-600 dark:text-emerald-400 font-medium">grün</span> = voll · 
                <span className="text-amber-600 dark:text-amber-400 font-medium"> gelb</span> = knapp · 
                <span className="text-destructive font-medium"> rot</span> = leer
            </p>

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

                        {/* Möbel in diesem Bereich */}
                        <div className="space-y-3 pl-0">
                            {areaFurniture.map(fur => {
                                const furSlots = (slotsByFurniture[fur.id] || []).filter(s => s.is_active !== false);
                                const hasGrid = (fur.grid_rows > 0) && (fur.grid_cols > 0);
                                const configuredSlots = furSlots.filter(s => s.grid_row != null && s.grid_col != null).length;

                                return (
                                    <Card key={fur.id} className="overflow-hidden border-border/60">
                                        {/* Möbel-Header */}
                                        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/40 bg-muted/20">
                                            <span className="text-base w-6 text-center shrink-0">
                                                {FURNITURE_ICONS[fur.type] || '📦'}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{fur.name}</p>
                                                {hasGrid && (
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {fur.grid_rows}×{fur.grid_cols} Regal · {configuredSlots}/{furSlots.length} Fächer platziert
                                                    </p>
                                                )}
                                            </div>
                                            {hasGrid && (
                                                <Badge variant="outline" className="text-[10px] shrink-0">
                                                    {fur.grid_rows}×{fur.grid_cols}
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Grid oder Hinweis */}
                                        <div className="p-3">
                                            {hasGrid ? (
                                                <RegelGrid
                                                    furniture={fur}
                                                    slots={furSlots}
                                                    assignments={assignments}
                                                    activeSlotId={null}
                                                    onAddToRestock={handleAddToRestock}
                                                    readOnly={false}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center gap-1.5 py-5 text-center">
                                                    <Grid3x3 className="w-7 h-7 text-muted-foreground/25" />
                                                    <p className="text-xs text-muted-foreground/60">
                                                        Noch kein Regal-Layout konfiguriert
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground/40">
                                                        Tab „Bereiche" → Möbel bearbeiten → Reihen &amp; Spalten festlegen
                                                    </p>
                                                </div>
                                            )}
                                        </div>
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
