import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Layers, ChevronRight, ChevronDown, CheckCircle2, Circle,
    Package, Check, Plus, ClipboardList
} from 'lucide-react';
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

/**
 * Rundgang-Modus für die Auffüllliste.
 * Hierarchie: Bereich (collapsible) → Möbel (collapsible) → Fach (collapsible) → Artikel.
 * Zeigt ALLE Möbeltypen (nicht nur Kühlschränke), aber nur solche mit restock_enabled !== false.
 * Nur Fächer mit restock_enabled !== false.
 */
export default function RundgangMode({ restockItems, articles, createMutation, updateMutation, showToast }) {
    const today = format(new Date(), 'yyyy-MM-dd');

    // ── Queries ──────────────────────────────────────────────────────────────
    const { data: areas = [] } = useQuery({
        queryKey: ['st-areas'],
        queryFn: () => base44.entities.Area.list('name', 100),
        staleTime: STALE.SLOW,
    });

    const { data: furniture = [] } = useQuery({
        queryKey: ['st-furniture'],
        queryFn: () => base44.entities.Furniture.list('sort_order', 500),
        staleTime: STALE.SLOW,
    });

    const { data: slots = [] } = useQuery({
        queryKey: ['slots'],
        queryFn: () => base44.entities.StorageSlot.list('full_name', 1000),
        staleTime: STALE.MEDIUM,
    });

    const { data: assignments = [] } = useQuery({
        queryKey: ['assignments'],
        queryFn: () => base44.entities.StorageAssignment.filter({ is_active: true }, 'article_name', 1000),
        staleTime: STALE.MEDIUM,
    });

    // ── UI State ─────────────────────────────────────────────────────────────
    const [expandedAreas, setExpandedAreas] = useState({});
    const [expandedFurniture, setExpandedFurniture] = useState({});
    const [expandedSlots, setExpandedSlots] = useState({});

    // Restock-Mengen pro Assignment (Input-Feld Werte)
    const [restockQtys, setRestockQtys] = useState({});

    // "Geprüft"-Marker: client-seitig, pro Tag, localStorage
    const CHECKED_KEY = `rundgang_checked_${today}`;
    const [checkedArticles, setCheckedArticles] = useState(() => {
        try { return JSON.parse(localStorage.getItem(CHECKED_KEY) || '{}'); } catch { return {}; }
    });

    const toggleChecked = (assignmentId) => {
        setCheckedArticles(prev => {
            const next = { ...prev, [assignmentId]: !prev[assignmentId] };
            try { localStorage.setItem(CHECKED_KEY, JSON.stringify(next)); } catch {}
            return next;
        });
    };

    // ── Gefilterte Daten ─────────────────────────────────────────────────────
    // Nur Möbel mit restock_enabled !== false und is_active
    const restockFurniture = useMemo(() =>
        furniture.filter(f => f.is_active !== false && f.restock_enabled !== false),
        [furniture]
    );

    // Nur Fächer mit restock_enabled !== false und is_active
    const restockSlots = useMemo(() =>
        slots.filter(s => s.is_active !== false && s.restock_enabled !== false),
        [slots]
    );

    // Lookups
    const furnitureByArea = useMemo(() => {
        const map = {};
        restockFurniture.forEach(f => {
            if (!map[f.area_id]) map[f.area_id] = [];
            map[f.area_id].push(f);
        });
        Object.values(map).forEach(arr =>
            arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.name || '').localeCompare(b.name || ''))
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
            arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.name || '').localeCompare(b.name || ''))
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

    // ── Fortschritts-Logik ───────────────────────────────────────────────────
    // Ein Fach ist "durchgegangen" wenn alle seine Artikel entweder geprüft
    // oder bereits einen heutigen RestockItem-Eintrag haben
    const isSlotDone = (slotId) => {
        const slotAssignments = assignmentsBySlot[slotId];
        if (!slotAssignments?.length) return false;
        return slotAssignments.every(a => {
            const hasRestockItem = restockItems.some(item =>
                item.article_id === a.article_id &&
                item.date === today &&
                !item.is_completed
            );
            return checkedArticles[a.id] || hasRestockItem;
        });
    };

    // ── Restock erstellen/aktualisieren ──────────────────────────────────────
    const handleRestock = async (assignment, area, qty) => {
        const numQty = parseFloat(qty);
        if (!numQty || numQty <= 0) {
            showToast('Bitte eine gültige Menge eingeben', 'error');
            return;
        }

        const article = articles.find(a => a.id === assignment.article_id);
        if (!article) {
            showToast('Artikel nicht gefunden', 'error');
            return;
        }

        const existingItem = restockItems.find(item =>
            item.article_id === article.id &&
            item.date === today &&
            !item.is_completed &&
            item.area_id === area.id
        );

        if (existingItem) {
            updateMutation.mutate({ id: existingItem.id, data: { ...existingItem, quantity: numQty } });
            showToast(`${article.name}: Menge aktualisiert`, 'success');
        } else {
            const user = await base44.auth.me();
            createMutation.mutate({
                article_id: article.id,
                barcode: article.barcode || '',
                article_name: article.name,
                article_image_url: article.image_url || null,
                quantity: numQty,
                area_id: area.id,
                area_name: area.name,
                restocked_by: user?.full_name || user?.email || 'Unbekannt',
                date: today,
                time: format(new Date(), 'HH:mm'),
                is_completed: false,
            });
            showToast(`${article.name} zur Auffüllliste hinzugefügt`, 'success');
        }

        // Input zurücksetzen und als geprüft markieren
        setRestockQtys(prev => { const next = { ...prev }; delete next[assignment.id]; return next; });
        if (!checkedArticles[assignment.id]) {
            setCheckedArticles(prev => {
                const next = { ...prev, [assignment.id]: true };
                try { localStorage.setItem(CHECKED_KEY, JSON.stringify(next)); } catch {}
                return next;
            });
        }
    };

    // ── Nur Bereiche mit restock-fähigen Möbeln/Fächern ──────────────────────
    const areasWithRestock = useMemo(() =>
        areas.filter(a => {
            const areaFurniture = furnitureByArea[a.id] || [];
            return areaFurniture.some(f =>
                (slotsByFurniture[f.id] || []).some(s => assignmentsBySlot[s.id]?.length > 0)
            );
        }),
        [areas, furnitureByArea, slotsByFurniture, assignmentsBySlot]
    );

    if (areasWithRestock.length === 0) {
        return (
            <Card className="p-10 text-center border-border/40">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground font-medium">Keine Fächer für den Rundgang konfiguriert</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                    Aktiviere Möbel und Fächer für den Rundgang unter<br />
                    <span className="font-medium">Waren &amp; Lager → Bereiche</span>
                </p>
            </Card>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-2">
            {areasWithRestock.map(area => {
                const areaFurniture = (furnitureByArea[area.id] || []).filter(f =>
                    (slotsByFurniture[f.id] || []).some(s => assignmentsBySlot[s.id]?.length > 0)
                );
                const areaSlots = areaFurniture.flatMap(f => slotsByFurniture[f.id] || [])
                    .filter(s => assignmentsBySlot[s.id]?.length > 0);
                const areaExpanded = expandedAreas[area.id];
                const doneInArea = areaSlots.filter(s => isSlotDone(s.id)).length;

                return (
                    <Card key={area.id} className="overflow-hidden border-border">
                        {/* Bereich Header */}
                        <button
                            className="w-full flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors"
                            onClick={() => setExpandedAreas(prev => ({ ...prev, [area.id]: !prev[area.id] }))}
                        >
                            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                                <Layers className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                                <p className="font-semibold text-sm text-foreground">{area.name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                    {doneInArea}/{areaSlots.length} Fächer durchgegangen
                                </p>
                            </div>
                            {areaExpanded
                                ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                        </button>

                        {/* Möbel + Fächer */}
                        {areaExpanded && (
                            <div className="border-t border-border/50">
                                {areaFurniture.map(fur => {
                                    const furSlots = (slotsByFurniture[fur.id] || [])
                                        .filter(s => assignmentsBySlot[s.id]?.length > 0);
                                    const furExpanded = expandedFurniture[fur.id];
                                    const doneInFur = furSlots.filter(s => isSlotDone(s.id)).length;
                                    if (furSlots.length === 0) return null;

                                    return (
                                        <div key={fur.id} className="border-b border-border/30 last:border-0">
                                            {/* Möbel Header */}
                                            <button
                                                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/20 transition-colors"
                                                onClick={() => setExpandedFurniture(prev => ({ ...prev, [fur.id]: !prev[fur.id] }))}
                                            >
                                                <span className="text-base w-5 text-center shrink-0">
                                                    {FURNITURE_ICONS[fur.type] || '📦'}
                                                </span>
                                                <div className="flex-1 text-left min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">{fur.name}</p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {fur.type}{fur.type ? ' · ' : ''}{doneInFur}/{furSlots.length} Fächer
                                                    </p>
                                                </div>
                                                {furExpanded
                                                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                            </button>

                                            {/* Fächer */}
                                            {furExpanded && (
                                                <div className="bg-muted/10">
                                                    {furSlots.map(slot => (
                                                        <SlotRestockGroup
                                                            key={slot.id}
                                                            slot={slot}
                                                            area={area}
                                                            expanded={expandedSlots[slot.id]}
                                                            onToggle={() => setExpandedSlots(prev => ({ ...prev, [slot.id]: !prev[slot.id] }))}
                                                            assignments={assignmentsBySlot[slot.id] || []}
                                                            articles={articles}
                                                            restockItems={restockItems}
                                                            today={today}
                                                            isDone={isSlotDone(slot.id)}
                                                            restockQtys={restockQtys}
                                                            setRestockQtys={setRestockQtys}
                                                            checkedArticles={checkedArticles}
                                                            toggleChecked={toggleChecked}
                                                            onRestock={handleRestock}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}

// ── Slot-Gruppe (Fach Header + aufklappbare Artikel-Liste) ────────────────────
function SlotRestockGroup({
    slot, area, expanded, onToggle, assignments, articles, restockItems, today,
    isDone, restockQtys, setRestockQtys, checkedArticles, toggleChecked, onRestock
}) {
    return (
        <div className="border-b border-border/20 last:border-0">
            {/* Fach Header */}
            <button
                className="w-full flex items-center gap-2 px-6 py-2.5 hover:bg-secondary/20 transition-colors"
                onClick={onToggle}
            >
                {isDone
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{slot.name}</p>
                </div>
                {slot.short_code && (
                    <span className="text-[10px] font-mono bg-secondary text-muted-foreground px-1.5 py-0.5 rounded shrink-0">
                        {slot.short_code}
                    </span>
                )}
                {expanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            </button>

            {/* Artikel */}
            {expanded && (
                <div className="bg-muted/20 border-t border-border/20">
                    {assignments.map(assignment => {
                        const article = articles.find(a => a.id === assignment.article_id);
                        const currentStock = article?.current_stock ?? null;
                        const minStock = assignment.min_stock;
                        const hasRestockItem = restockItems.some(item =>
                            item.article_id === assignment.article_id &&
                            item.date === today &&
                            !item.is_completed
                        );
                        const isChecked = checkedArticles[assignment.id] || hasRestockItem;
                        const qtyValue = restockQtys[assignment.id] || '';

                        return (
                            <div key={assignment.id}
                                className="flex items-center gap-3 px-6 py-2.5 border-b border-border/20 last:border-0"
                            >
                                {/* Geprüft-Button */}
                                <button
                                    onClick={() => toggleChecked(assignment.id)}
                                    className={cn(
                                        'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all active:scale-90',
                                        isChecked
                                            ? 'border-green-500 bg-green-500'
                                            : 'border-border hover:border-primary'
                                    )}
                                >
                                    {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                                </button>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className={cn(
                                        'text-sm truncate',
                                        isChecked ? 'text-muted-foreground' : 'text-foreground'
                                    )}>
                                        {assignment.article_name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        Bestand: {currentStock != null ? currentStock : '—'}
                                        {article?.content_unit ? ` ${article.content_unit}` : ''}
                                        {minStock != null && (
                                            <span className="ml-2 text-blue-400">
                                                Soll: {minStock}{assignment.unit ? ` ${assignment.unit}` : ''}
                                            </span>
                                        )}
                                        {hasRestockItem && (
                                            <span className="ml-2 text-primary">
                                                ⬆ in Auffüllliste
                                            </span>
                                        )}
                                    </p>
                                </div>

                                {/* Menge-Eingabe */}
                                <Input
                                    type="number"
                                    inputMode="decimal"
                                    className="h-8 w-16 text-xs px-2"
                                    placeholder="Menge"
                                    value={qtyValue}
                                    onChange={e => setRestockQtys(prev => ({ ...prev, [assignment.id]: e.target.value }))}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && qtyValue) {
                                            onRestock(assignment, area, qtyValue);
                                        }
                                    }}
                                />
                                <Button
                                    size="sm"
                                    className="h-8 px-3 text-xs gap-1 shrink-0"
                                    disabled={!qtyValue}
                                    onClick={() => onRestock(assignment, area, qtyValue)}
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}