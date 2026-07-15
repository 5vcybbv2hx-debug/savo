import { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { usePermissions } from '@/components/auth/usePermissions';
import {
    Layers, CheckCircle2, Package, X, ChevronRight, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import RegelGrid from '@/components/storage/RegelGrid';

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

/**
 * Kein Kassenanbindung → current_stock nie verlässlich.
 * Workflow: Mitarbeiter schaut ins Fach → tippt IST-Menge ein → App berechnet Bedarf.
 * Sicherheitsregel: IST darf nie > min_stock (Soll) sein.
 */

// Ist eine Assignment für heute schon erledigt?
function isAssignmentSettled(assignment, { restockItems, today }) {
    return restockItems.some(item =>
        item.assignment_id === assignment.id &&
        item.date === today
    );
}

export default function RundgangMode({ restockItems, articles, createMutation, updateMutation, showToast }) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const qc = useQueryClient();

    // ── Queries ────────────────────────────────────────────────────────────────
    const { data: areas = [], isLoading: areasLoading } = useQuery({
        queryKey: ['st-areas'],
        queryFn: async () => {
            const data = await base44.entities.Area.list('sort_order', 100);
            return data.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.name || '').localeCompare(b.name || ''));
        },
        staleTime: STALE.SLOW,
    });

    const { data: furniture = [], isLoading: furnitureLoading } = useQuery({
        queryKey: ['st-furniture'],
        queryFn: () => base44.entities.Furniture.list('sort_order', 500),
        staleTime: STALE.SLOW,
    });

    const { data: slots = [], isLoading: slotsLoading } = useQuery({
        queryKey: ['slots'],
        queryFn: () => base44.entities.StorageSlot.list('sort_order', 1000),
        staleTime: STALE.MEDIUM,
    });

    const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
        queryKey: ['assignments'],
        queryFn: () => base44.entities.StorageAssignment.filter({ is_active: true }, 'article_name', 1000),
        staleTime: STALE.MEDIUM,
    });

    const isInitialLoading = areasLoading || furnitureLoading || slotsLoading || assignmentsLoading;

    // ── IST-Popup State ────────────────────────────────────────────────────────
    const [istPopover, setIstPopover] = useState(null); // { slot, assignments }
    const [istValues, setIstValues] = useState({});     // { [assignmentId]: number }
    const [isSaving, setIsSaving] = useState(false);

    // ── Bereiche aufklappbar ───────────────────────────────────────────────────
    const [expandedAreas, setExpandedAreas] = useState({});

    // ── Abschluss-Sheet ────────────────────────────────────────────────────────
    const [showCompletionSummary, setShowCompletionSummary] = useState(false);
    const completionShownRef = useRef(false);

    // ── Gefilterte Daten ───────────────────────────────────────────────────────
    const restockAreas = useMemo(() =>
        areas.filter(a => a.is_active !== false && a.restock_enabled !== false),
        [areas]
    );
    const restockFurniture = useMemo(() =>
        furniture.filter(f => f.is_active !== false && f.restock_enabled !== false),
        [furniture]
    );
    const restockSlots = useMemo(() =>
        slots.filter(s => s.is_active !== false && s.restock_enabled !== false),
        [slots]
    );

    const furnitureByArea = useMemo(() => {
        const map = {};
        restockFurniture.forEach(f => {
            if (!map[f.area_id]) map[f.area_id] = [];
            map[f.area_id].push(f);
        });
        Object.values(map).forEach(arr =>
            arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        );
        return map;
    }, [restockFurniture]);

    const slotsByFurniture = useMemo(() => {
        const map = {};
        restockSlots.forEach(s => {
            if (!map[s.furniture_id]) map[s.furniture_id] = [];
            map[s.furniture_id].push(s);
        });
        Object.values(map).forEach(arr =>
            arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        );
        return map;
    }, [restockSlots]);

    const assignmentsBySlot = useMemo(() => {
        const map = {};
        assignments.forEach(a => {
            if (!map[a.storage_slot_id]) map[a.storage_slot_id] = [];
            map[a.storage_slot_id].push(a);
        });
        return map;
    }, [assignments]);

    // ── Fortschritts-Logik ─────────────────────────────────────────────────────
    const settledCtx = { restockItems, today };

    const isSlotDone = (slotId) => {
        const slotAssignments = assignmentsBySlot[slotId];
        if (!slotAssignments?.length) return false;
        return slotAssignments.every(a => isAssignmentSettled(a, settledCtx));
    };

    const overallProgress = useMemo(() => {
        let total = 0, done = 0;
        restockAreas.forEach(area => {
            (furnitureByArea[area.id] || []).forEach(fur => {
                (slotsByFurniture[fur.id] || [])
                    .filter(s => (assignmentsBySlot[s.id] || []).length > 0)
                    .forEach(slot => {
                        total++;
                        if (isSlotDone(slot.id)) done++;
                    });
            });
        });
        return { total, done };
    }, [restockAreas, furnitureByArea, slotsByFurniture, assignmentsBySlot, restockItems]);

    // ── Live-Bestandsabgleich (identisch zur bestehenden Logik) ───────────────
    const syncStockOnRestock = async (assignment, article, delta) => {
        if (!delta) return;
        if (article.current_stock != null) {
            const newTotal = Math.max(0, (parseFloat(article.current_stock) || 0) - delta);
            try { await base44.entities.Article.update(article.id, { current_stock: newTotal }); } catch {}
        }
        try {
            let newSlotQty = (assignment.quantity ?? 0) + delta;
            if (assignment.min_stock != null) newSlotQty = Math.min(newSlotQty, assignment.min_stock);
            await base44.entities.StorageAssignment.update(assignment.id, { quantity: Math.max(0, newSlotQty) });
        } catch {}
        try {
            const lagerAssignment = assignments.find(a => {
                if (a.article_id !== assignment.article_id || a.id === assignment.id) return false;
                const slot = slots.find(s => s.id === a.storage_slot_id);
                const slotArea = slot && areas.find(ar => ar.id === slot.area_id);
                return slotArea?.area_type === 'lager';
            });
            if (lagerAssignment) {
                const newQty = Math.max(0, (lagerAssignment.quantity ?? 0) - delta);
                await base44.entities.StorageAssignment.update(lagerAssignment.id, { quantity: newQty });
            }
        } catch {}
        qc.invalidateQueries({ queryKey: ['articles'] });
        qc.invalidateQueries({ queryKey: ['assignments'] });
        qc.invalidateQueries({ queryKey: ['inv-assignments'] });
    };

    // ── Fach-Tap → IST-Popup öffnen ────────────────────────────────────────────
    const handleSlotTap = (slot, slotAssignments) => {
        setIstPopover({ slot, assignments: slotAssignments });
        const vals = {};
        slotAssignments.forEach(a => {
            // Vorausfüllen: IST aus letztem Rundgang-Item von heute, sonst assignment.quantity
            const todayItem = restockItems.find(r => r.assignment_id === a.id && r.date === today);
            vals[a.id] = todayItem ? todayItem.quantity : (a.quantity ?? 0);
        });
        setIstValues(vals);
    };

    // ── IST speichern: RestockItem erstellen/updaten + Stock sync ──────────────
    const handleSaveIst = async () => {
        if (!istPopover || isSaving) return;
        setIsSaving(true);

        const { slot, assignments: popAssignments } = istPopover;
        const user = await base44.auth.me();
        const userName = user?.full_name || user?.email || 'Unbekannt';

        let anyRestock = false;

        for (const a of popAssignments) {
            let ist = parseFloat(istValues[a.id]);
            if (isNaN(ist) || ist < 0) ist = 0;
            // Sicherheitsdeckel: IST nie > Soll
            if (a.min_stock != null && ist > a.min_stock) ist = a.min_stock;

            const needed = a.min_stock != null ? Math.max(0, a.min_stock - ist) : null;

            // Nur wenn tatsächlich Bedarf besteht ODER manuell was eingetragen wurde
            const article = articles.find(art => art.id === a.article_id);

            const existingItem = restockItems.find(r =>
                r.assignment_id === a.id && r.date === today
            );
            const previousQty = existingItem?.quantity ?? 0;
            const delta = ist - (a.quantity ?? 0); // Differenz zum gespeicherten Fach-Bestand

            if (existingItem) {
                updateMutation.mutate({
                    id: existingItem.id,
                    data: {
                        ...existingItem,
                        quantity: ist,
                        needed_quantity: needed,
                        is_completed: false,
                        stock_reduced: false,
                    },
                });
            } else {
                createMutation.mutate({
                    article_id: a.article_id,
                    article_name: a.article_name,
                    article_image_url: null,
                    storage_slot_id: slot.id,
                    slot_name: slot.name || slot.full_name,
                    assignment_id: a.id,
                    quantity: ist,
                    needed_quantity: needed,
                    area_id: slot.area_id || null,
                    restocked_by: userName,
                    date: today,
                    time: format(new Date(), 'HH:mm'),
                    is_completed: false,
                    stock_reduced: false,
                });
                anyRestock = true;
            }

            // Stock sync — delta basiert auf IST vs. gespeichertem Fach-Bestand
            if (article && delta !== 0) {
                await syncStockOnRestock(a, article, -delta); // negativ weil IST = was DA ist, nicht was entnommen wurde
            }
        }

        // Assignments-Cache aktualisieren (neue quantity-Werte)
        qc.invalidateQueries({ queryKey: ['assignments'] });
        qc.invalidateQueries({ queryKey: ['restock-items'] });

        setIsSaving(false);
        setIstPopover(null);
        showToast('Bestand gespeichert ✓', 'success');

        // Abschluss prüfen
        setTimeout(() => {
            qc.invalidateQueries({ queryKey: ['restock-items', today] });
        }, 500);
    };

    // ── Loading ────────────────────────────────────────────────────────────────
    if (isInitialLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
                <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Lade Lagerplätze…</p>
            </div>
        );
    }

    const areasToShow = restockAreas.filter(area => {
        const furs = (furnitureByArea[area.id] || []).filter(f =>
            (slotsByFurniture[f.id] || []).some(s => (assignmentsBySlot[s.id] || []).length > 0)
        );
        return furs.length > 0;
    });

    if (areasToShow.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center px-6">
                <Package className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">Noch keine Lagerplätze konfiguriert.</p>
                <p className="text-xs text-muted-foreground/60">Bereiche, Möbel und Fächer im Lagerplätze-Bereich anlegen.</p>
            </div>
        );
    }

    const allDone = overallProgress.done >= overallProgress.total && overallProgress.total > 0;

    return (
        <div className="space-y-4 pb-32">
            {/* Fortschrittsbalken */}
            <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm border-b border-border/40 px-1 py-2">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">
                        {overallProgress.done}/{overallProgress.total} Fächer geprüft
                    </span>
                    {allDone && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            ✓ Alles erledigt!
                        </span>
                    )}
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: overallProgress.total > 0 ? `${(overallProgress.done / overallProgress.total) * 100}%` : '0%' }}
                    />
                </div>
            </div>

            {/* Bereiche */}
            {areasToShow.map(area => {
                const areaFurniture = (furnitureByArea[area.id] || []).filter(f =>
                    (slotsByFurniture[f.id] || []).some(s => (assignmentsBySlot[s.id] || []).length > 0)
                );
                const isExpanded = expandedAreas[area.id] !== false; // Default: aufgeklappt

                const areaTotal = areaFurniture.reduce((sum, fur) => {
                    return sum + (slotsByFurniture[fur.id] || []).filter(s => (assignmentsBySlot[s.id] || []).length > 0).length;
                }, 0);
                const areaDone = areaFurniture.reduce((sum, fur) => {
                    return sum + (slotsByFurniture[fur.id] || []).filter(s => isSlotDone(s.id)).length;
                }, 0);
                const areaAllDone = areaDone >= areaTotal && areaTotal > 0;

                return (
                    <div key={area.id}>
                        {/* Bereich Header */}
                        <button
                            className="w-full flex items-center gap-2.5 px-1 py-2"
                            onClick={() => setExpandedAreas(prev => ({ ...prev, [area.id]: !isExpanded }))}
                        >
                            <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center shrink-0">
                                <Layers className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                            <span className="text-sm font-semibold text-foreground flex-1 text-left">{area.name}</span>
                            {areaAllDone && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            )}
                            <span className="text-[10px] text-muted-foreground">{areaDone}/{areaTotal}</span>
                            {isExpanded
                                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        </button>

                        {isExpanded && (
                            <div className="space-y-3">
                                {areaFurniture.map(fur => {
                                    const furSlots = (slotsByFurniture[fur.id] || []).filter(s =>
                                        (assignmentsBySlot[s.id] || []).length > 0
                                    );
                                    const hasGrid = fur.grid_rows > 0 && fur.grid_cols > 0;
                                    const hasPlacedSlots = hasGrid && furSlots.some(s => s.grid_row != null && s.grid_col != null);

                                    const furDone = furSlots.filter(s => isSlotDone(s.id)).length;
                                    const furAllDone = furDone >= furSlots.length && furSlots.length > 0;

                                    return (
                                        <Card key={fur.id} className={cn(
                                            'overflow-hidden border-border/60 transition-all',
                                            furAllDone && 'opacity-70'
                                        )}>
                                            {/* Möbel Header */}
                                            <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/30 bg-muted/20">
                                                <span className="text-base w-6 text-center shrink-0">
                                                    {FURNITURE_ICONS[fur.type] || '📦'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-foreground truncate">{fur.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {furDone}/{furSlots.length} Fächer · Fach antippen zum Eintragen
                                                    </p>
                                                </div>
                                                {furAllDone && (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                                )}
                                            </div>

                                            {/* Grid-Ansicht */}
                                            <div className="p-3">
                                                {hasPlacedSlots ? (
                                                    <RegelGrid
                                                        furniture={fur}
                                                        slots={furSlots}
                                                        assignments={assignments}
                                                        restockItems={restockItems}
                                                        activeSlotId={null}
                                                        onSlotTap={handleSlotTap}
                                                        readOnly={false}
                                                        editMode={false}
                                                    />
                                                ) : (
                                                    /* Fallback: Fächer ohne Grid als klickbare Chips */
                                                    <div className="flex flex-wrap gap-2">
                                                        {furSlots.map(slot => {
                                                            const slotAssignments = assignmentsBySlot[slot.id] || [];
                                                            const done = isSlotDone(slot.id);
                                                            return (
                                                                <button
                                                                    key={slot.id}
                                                                    onClick={() => handleSlotTap(slot, slotAssignments)}
                                                                    className={cn(
                                                                        'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all active:scale-95',
                                                                        done
                                                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                                                            : 'bg-card border-border hover:border-primary/50 hover:bg-primary/5 text-foreground'
                                                                    )}
                                                                >
                                                                    {done
                                                                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                                                        : <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                                                    <span className="truncate max-w-[120px]">{slot.name}</span>
                                                                    <span className="text-[10px] text-muted-foreground ml-1">
                                                                        ({slotAssignments.length})
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* IST-Eingabe Popup */}
            {istPopover && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/60 backdrop-blur-sm p-0 sm:p-4"
                    onClick={() => !isSaving && setIstPopover(null)}
                >
                    <div
                        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Popup Header */}
                        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border/40">
                            <div>
                                <h4 className="text-sm font-bold text-foreground">
                                    {istPopover.slot?.name || istPopover.slot?.full_name}
                                </h4>
                                <p className="text-[11px] text-muted-foreground">Wieviel ist gerade im Fach?</p>
                            </div>
                            <button
                                onClick={() => !isSaving && setIstPopover(null)}
                                className="text-muted-foreground hover:text-foreground p-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Artikel */}
                        <div className="px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
                            {istPopover.assignments.map(a => {
                                const val = istValues[a.id] ?? 0;
                                const hasMin = a.min_stock != null && a.min_stock > 0;
                                const needed = hasMin ? Math.max(0, a.min_stock - val) : null;
                                const ratio = hasMin ? val / a.min_stock : 1;

                                let needColor = 'text-emerald-600 dark:text-emerald-400';
                                if (hasMin) {
                                    if (ratio < 0.5) needColor = 'text-destructive';
                                    else if (ratio < 1) needColor = 'text-amber-600 dark:text-amber-400';
                                }

                                return (
                                    <div key={a.id} className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/30">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-bold text-foreground truncate flex-1">{a.article_name}</span>
                                            {hasMin && (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                                    Soll: {a.min_stock}
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Großes IST-Input */}
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min="0"
                                            max={hasMin ? a.min_stock : undefined}
                                            value={val}
                                            onChange={e => {
                                                const parsed = parseInt(e.target.value);
                                                setIstValues(prev => ({
                                                    ...prev,
                                                    [a.id]: isNaN(parsed) ? 0 : Math.max(0, parsed),
                                                }));
                                            }}
                                            className="w-full text-center font-bold text-2xl h-14 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-primary focus:ring-0 transition-colors"
                                            autoFocus={istPopover.assignments.indexOf(a) === 0}
                                        />

                                        {/* Soll / Bedarf */}
                                        {hasMin && (
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-muted-foreground">Soll: {a.min_stock}</span>
                                                <span className={cn('font-semibold', needColor)}>
                                                    {needed === 0
                                                        ? '✓ Voll'
                                                        : `Bedarf: +${needed}`}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Speichern Button */}
                        <div className="px-4 pb-6 pt-3 border-t border-border/40">
                            <Button
                                className="w-full h-12 text-base font-semibold"
                                onClick={handleSaveIst}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                        Speichern…
                                    </span>
                                ) : 'Bestand speichern'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Abschluss-Sheet */}
            <Sheet open={showCompletionSummary} onOpenChange={setShowCompletionSummary}>
                <SheetContent side="bottom" className="rounded-t-2xl pb-8 px-6 pt-6 max-h-[85vh] overflow-y-auto">
                    <div className="space-y-4">
                        <div className="text-center space-y-1">
                            <div className="text-4xl">✅</div>
                            <h2 className="text-xl font-bold text-foreground">Rundgang komplett!</h2>
                            <p className="text-sm text-muted-foreground">
                                Alle {overallProgress.total} Fächer geprüft
                            </p>
                        </div>
                        <Button className="w-full" onClick={() => setShowCompletionSummary(false)}>
                            Schließen
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}