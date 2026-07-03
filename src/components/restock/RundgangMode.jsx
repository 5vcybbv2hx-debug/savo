import { useState, useMemo, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/components/auth/usePermissions';
import {
    Layers, ChevronRight, ChevronDown, CheckCircle2, Circle,
    Package, Check, Plus, ClipboardList, ArrowUp, ArrowDown, ArrowUpCircle
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

// ── Gemeinsame Helfer (Soll/Ist-Logik) ─────────────────────────────────────────
// Wie viel darf laut Soll-Menge maximal noch aufgefüllt werden? null = kein Soll hinterlegt (kein Limit möglich).
function getRemainingToSoll(assignment, article) {
    const currentStock = article?.current_stock;
    const minStock = assignment?.min_stock;
    if (currentStock == null || minStock == null) return null;
    return Math.max(minStock - currentStock, 0);
}

// Ist ein Artikel "erledigt" — bereits geprüft, schon in der Auffüllliste, oder Bestand längst am/über Soll?
function isAssignmentSettled(assignment, { articles, restockItems, today, checkedArticles }) {
    if (checkedArticles[assignment.id]) return true;
    const hasRestockItem = restockItems.some(item =>
        item.article_id === assignment.article_id &&
        item.date === today &&
        !item.is_completed
    );
    if (hasRestockItem) return true;
    const article = articles.find(a => a.id === assignment.article_id);
    const remaining = getRemainingToSoll(assignment, article);
    if (remaining != null && remaining <= 0) return true; // Soll bereits erreicht/überschritten
    return false;
}

/**
 * Rundgang-Modus für die Auffüllliste.
 * Hierarchie: Bereich (collapsible) → Möbel (collapsible) → Fach (collapsible) → Artikel.
 * Zeigt ALLE Möbeltypen (nicht nur Kühlschränke), aber nur solche mit restock_enabled !== false.
 * Nur Fächer mit restock_enabled !== false.
 * Nur Bereiche mit restock_enabled !== false.
 *
 * Vereinfacht (2026-07-03): Nur Artikel, die tatsächlich Handlungsbedarf haben (Bestand < Soll,
 * noch nicht geprüft/aufgefüllt), werden direkt angezeigt. Bereits ausreichend bestückte oder
 * erledigte Artikel klappen sich zu einer kompakten Zeile zusammen. Ebenen mit offenem Bedarf
 * öffnen sich beim ersten Laden automatisch, damit man nicht durch alles klicken muss.
 */
export default function RundgangMode({ restockItems, articles, createMutation, updateMutation, showToast }) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const qc = useQueryClient();
    const permissions = usePermissions();
    const canSort = permissions.isManager || permissions.isAdmin;

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

    // Restock-Mengen pro Assignment (Input-Feld Werte, nur für manuelle Eingabe)
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

    // ── Sortier-Mutationen (gleiche Logik wie StructureTab) ───────────────────
    const swapSortOrder = async (item, direction, siblings, entityName, queryKey) => {
        const idx = siblings.findIndex(s => s.id === item.id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= siblings.length) return;
        const swapItem = siblings[swapIdx];
        const itemOrder = item.sort_order ?? 0;
        const swapOrder = swapItem.sort_order ?? 0;
        if (itemOrder === swapOrder) {
            const newOrder = direction === 'up' ? itemOrder - 1 : itemOrder + 1;
            await base44.entities[entityName].update(item.id, { sort_order: newOrder });
        } else {
            await base44.entities[entityName].update(item.id, { sort_order: swapOrder });
            await base44.entities[entityName].update(swapItem.id, { sort_order: itemOrder });
        }
    };

    const sortFurMut = useMutation({
        mutationFn: ({ fur, direction, siblings }) => swapSortOrder(fur, direction, siblings, 'Furniture', ['st-furniture']),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['st-furniture'] }),
        onError: () => showToast('Sortierung konnte nicht geändert werden', 'error'),
    });

    const sortSlotMut = useMutation({
        mutationFn: ({ slot, direction, siblings }) => swapSortOrder(slot, direction, siblings, 'StorageSlot', ['slots']),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['slots'] }),
        onError: () => showToast('Sortierung konnte nicht geändert werden', 'error'),
    });

    // ── Gefilterte Daten ─────────────────────────────────────────────────────
    // Nur Bereiche mit restock_enabled !== false und is_active
    const restockAreas = useMemo(() =>
        areas.filter(a => a.is_active !== false && a.restock_enabled !== false),
        [areas]
    );

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
    // Ein Fach gilt jetzt auch dann als "durchgegangen", wenn ALLE zugeordneten Artikel
    // bereits ausreichend bestückt sind (Bestand >= Soll) — nicht mehr nur bei manuellem Haken.
    const settledCtx = { articles, restockItems, today, checkedArticles };
    const isSlotDone = (slotId) => {
        const slotAssignments = assignmentsBySlot[slotId];
        if (!slotAssignments?.length) return false;
        return slotAssignments.every(a => isAssignmentSettled(a, settledCtx));
    };

    // ── Restock erstellen/aktualisieren (mit Soll-Deckelung) ──────────────────
    const handleRestock = async (assignment, area, qty) => {
        let numQty = parseFloat(qty);
        if (!numQty || numQty <= 0) {
            showToast('Bitte eine gültige Menge eingeben', 'error');
            return;
        }

        const article = articles.find(a => a.id === assignment.article_id);
        if (!article) {
            showToast('Artikel nicht gefunden', 'error');
            return;
        }

        // Soll-Menge darf nie überschritten werden — Menge notfalls hart kappen.
        const remaining = getRemainingToSoll(assignment, article);
        if (remaining != null) {
            if (remaining <= 0) {
                showToast(`${article.name}: Soll-Menge bereits erreicht`, 'info');
                return;
            }
            if (numQty > remaining) {
                numQty = remaining;
                showToast(`Menge auf Soll-Maximum (${remaining}${assignment.unit ? ` ${assignment.unit}` : ''}) begrenzt`, 'info');
            }
        }

        const existingItem = restockItems.find(item =>
            item.article_id === article.id &&
            item.date === today &&
            !item.is_completed
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
        restockAreas.filter(a => {
            const areaFurniture = furnitureByArea[a.id] || [];
            return areaFurniture.some(f =>
                (slotsByFurniture[f.id] || []).some(s => assignmentsBySlot[s.id]?.length > 0)
            );
        }),
        [restockAreas, furnitureByArea, slotsByFurniture, assignmentsBySlot]
    );

    // ── Auto-Expand: Ebenen mit offenem Handlungsbedarf öffnen sich beim ersten
    // Laden automatisch, damit man nicht durch alles klicken muss. Läuft nur EINMAL
    // pro Seitenaufruf — danach bleibt es dem Nutzer überlassen, was auf/zu ist.
    const autoExpandedRef = useRef(false);
    useEffect(() => {
        if (autoExpandedRef.current || areasWithRestock.length === 0) return;
        const newAreaExp = {};
        const newFurExp = {};
        const newSlotExp = {};

        areasWithRestock.forEach(area => {
            const areaFurniture = (furnitureByArea[area.id] || []).filter(f =>
                (slotsByFurniture[f.id] || []).some(s => assignmentsBySlot[s.id]?.length > 0)
            );
            let areaHasAction = false;
            areaFurniture.forEach(fur => {
                const furSlots = (slotsByFurniture[fur.id] || []).filter(s => assignmentsBySlot[s.id]?.length > 0);
                let furHasAction = false;
                furSlots.forEach(slot => {
                    if (!isSlotDone(slot.id)) {
                        newSlotExp[slot.id] = true;
                        furHasAction = true;
                    }
                });
                if (furHasAction) { newFurExp[fur.id] = true; areaHasAction = true; }
            });
            if (areaHasAction) newAreaExp[area.id] = true;
        });

        setExpandedAreas(prev => ({ ...newAreaExp, ...prev }));
        setExpandedFurniture(prev => ({ ...newFurExp, ...prev }));
        setExpandedSlots(prev => ({ ...newSlotExp, ...prev }));
        autoExpandedRef.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [areasWithRestock, furnitureByArea, slotsByFurniture, assignmentsBySlot]);

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
                const areaAllDone = areaSlots.length > 0 && doneInArea === areaSlots.length;

                return (
                    <Card key={area.id} className="overflow-hidden border-border">
                        {/* Bereich Header */}
                        <button
                            className="w-full flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors"
                            onClick={() => setExpandedAreas(prev => ({ ...prev, [area.id]: !prev[area.id] }))}
                        >
                            <div className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                                areaAllDone ? "bg-green-500/15" : "bg-amber-500/15"
                            )}>
                                {areaAllDone
                                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    : <Layers className="w-4 h-4 text-amber-500" />}
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
                                {areaFurniture.map((fur, furIdx) => {
                                    const furSlots = (slotsByFurniture[fur.id] || [])
                                        .filter(s => assignmentsBySlot[s.id]?.length > 0);
                                    const furExpanded = expandedFurniture[fur.id];
                                    const doneInFur = furSlots.filter(s => isSlotDone(s.id)).length;
                                    const furAllDone = furSlots.length > 0 && doneInFur === furSlots.length;
                                    if (furSlots.length === 0) return null;

                                    return (
                                        <div key={fur.id} className="border-b border-border/30 last:border-0">
                                            {/* Möbel Header */}
                                            <div className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/20 transition-colors">
                                                <button
                                                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                                    onClick={() => setExpandedFurniture(prev => ({ ...prev, [fur.id]: !prev[fur.id] }))}
                                                >
                                                    <span className="text-base w-5 text-center shrink-0">
                                                        {furAllDone ? '✅' : (FURNITURE_ICONS[fur.type] || '📦')}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-foreground truncate">{fur.name}</p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {fur.type}{fur.type ? ' · ' : ''}{doneInFur}/{furSlots.length} Fächer
                                                        </p>
                                                    </div>
                                                    {furExpanded
                                                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                                </button>
                                                {canSort && (
                                                    <div className="flex gap-0.5 shrink-0">
                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                            disabled={furIdx === 0}
                                                            onClick={() => sortFurMut.mutate({ fur, direction: 'up', siblings: areaFurniture })}>
                                                            <ArrowUp className="w-3 h-3" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                            disabled={furIdx === areaFurniture.length - 1}
                                                            onClick={() => sortFurMut.mutate({ fur, direction: 'down', siblings: areaFurniture })}>
                                                            <ArrowDown className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Fächer */}
                                            {furExpanded && (
                                                <div className="bg-muted/10">
                                                    {furSlots.map((slot, slotIdx) => (
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
                                                            canSort={canSort}
                                                            slotIdx={slotIdx}
                                                            totalSlots={furSlots.length}
                                                            siblings={furSlots}
                                                            onMoveSlot={sortSlotMut}
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

// ── Fach-Zeile ─────────────────────────────────────────────────────────────
function SlotArticleRow({ assignment, article, area, isSettled, onRestock, qtyValue, setRestockQtys, toggleChecked, isChecked }) {
    const [manualOpen, setManualOpen] = useState(false);
    const remaining = getRemainingToSoll(assignment, article);
    const currentStock = article?.current_stock ?? null;
    const unit = assignment.unit ? ` ${assignment.unit}` : '';

    return (
        <div className="flex flex-col gap-2 px-6 py-3 border-b border-border/20 last:border-0">
            <div className="flex items-center gap-3">
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
                    <p className="text-sm truncate text-foreground">{assignment.article_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                        Bestand: {currentStock != null ? currentStock : '—'}
                        {article?.content_unit ? ` ${article.content_unit}` : ''}
                        {assignment.min_stock != null && (
                            <span className="ml-2 text-blue-400">
                                Soll: {assignment.min_stock}{unit}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Aktion: 1-Klick auf Soll auffüllen, oder manuelle Menge (auf Soll gedeckelt) */}
            <div className="flex items-center gap-2 pl-9">
                {remaining != null && remaining > 0 && !manualOpen && (
                    <>
                        <Button
                            size="sm"
                            className="h-8 px-3 text-xs gap-1.5"
                            onClick={() => onRestock(assignment, area, remaining)}
                        >
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            Auf Soll auffüllen (+{remaining}{unit})
                        </Button>
                        <button
                            type="button"
                            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                            onClick={() => setManualOpen(true)}
                        >
                            andere Menge
                        </button>
                    </>
                )}

                {(remaining == null || manualOpen) && (
                    <>
                        <Input
                            type="number"
                            inputMode="decimal"
                            max={remaining != null ? remaining : undefined}
                            className="h-8 w-20 text-xs px-2"
                            placeholder="Menge"
                            value={qtyValue}
                            onChange={e => {
                                let v = e.target.value;
                                if (remaining != null && v !== '' && parseFloat(v) > remaining) v = String(remaining);
                                setRestockQtys(prev => ({ ...prev, [assignment.id]: v }));
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && qtyValue) onRestock(assignment, area, qtyValue);
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
                        {remaining != null && (
                            <span className="text-[10px] text-muted-foreground/70">max. {remaining}{unit}</span>
                        )}
                        {manualOpen && (
                            <button
                                type="button"
                                className="text-[11px] text-muted-foreground/70 hover:text-foreground"
                                onClick={() => setManualOpen(false)}
                            >
                                zurück
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── Slot-Gruppe (Fach Header + aufklappbare Artikel-Liste) ────────────────────
function SlotRestockGroup({
    slot, area, expanded, onToggle, assignments, articles, restockItems, today,
    isDone, restockQtys, setRestockQtys, checkedArticles, toggleChecked, onRestock,
    canSort, slotIdx, totalSlots, siblings, onMoveSlot
}) {
    const [showSettled, setShowSettled] = useState(false);
    const settledCtx = { articles, restockItems, today, checkedArticles };

    const openItems = [];
    const settledItems = [];
    assignments.forEach(assignment => {
        const article = articles.find(a => a.id === assignment.article_id);
        const settled = isAssignmentSettled(assignment, settledCtx);
        (settled ? settledItems : openItems).push({ assignment, article, settled });
    });

    return (
        <div className="border-b border-border/20 last:border-0">
            {/* Fach Header */}
            <div className="w-full flex items-center gap-2 px-6 py-2.5 hover:bg-secondary/20 transition-colors">
                <button
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    onClick={onToggle}
                >
                    {isDone
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{slot.name}</p>
                    </div>
                    {!isDone && openItems.length > 0 && (
                        <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded shrink-0">
                            {openItems.length} offen
                        </span>
                    )}
                    {slot.short_code && (
                        <span className="text-[10px] font-mono bg-secondary text-muted-foreground px-1.5 py-0.5 rounded shrink-0">
                            {slot.short_code}
                        </span>
                    )}
                    {expanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                </button>
                {canSort && (
                    <div className="flex gap-0.5 shrink-0">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            disabled={slotIdx === 0}
                            onClick={() => onMoveSlot.mutate({ slot, direction: 'up', siblings })}>
                            <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            disabled={slotIdx === totalSlots - 1}
                            onClick={() => onMoveSlot.mutate({ slot, direction: 'down', siblings })}>
                            <ArrowDown className="w-3 h-3" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Artikel */}
            {expanded && (
                <div className="bg-muted/20 border-t border-border/20">
                    {/* Nur offene Artikel direkt anzeigen — reduziert das Chaos beim Aufklappen */}
                    {openItems.map(({ assignment, article }) => {
                        const hasRestockItem = restockItems.some(item =>
                            item.article_id === assignment.article_id &&
                            item.date === today &&
                            !item.is_completed
                        );
                        return (
                            <SlotArticleRow
                                key={assignment.id}
                                assignment={assignment}
                                article={article}
                                area={area}
                                onRestock={onRestock}
                                qtyValue={restockQtys[assignment.id] || ''}
                                setRestockQtys={setRestockQtys}
                                toggleChecked={toggleChecked}
                                isChecked={checkedArticles[assignment.id] || hasRestockItem}
                            />
                        );
                    })}

                    {openItems.length === 0 && (
                        <p className="px-6 py-3 text-xs text-muted-foreground/70 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            Alles ausreichend bestückt
                        </p>
                    )}

                    {/* Erledigte/ausreichend bestückte Artikel eingeklappt — bei Bedarf anzeigen */}
                    {settledItems.length > 0 && (
                        <div className="border-t border-border/10">
                            <button
                                type="button"
                                className="w-full flex items-center gap-1.5 px-6 py-2 text-[11px] text-muted-foreground hover:text-foreground"
                                onClick={() => setShowSettled(v => !v)}
                            >
                                {showSettled ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                ✓ {settledItems.length} bereits erledigt / ausreichend
                            </button>
                            {showSettled && settledItems.map(({ assignment, article }) => {
                                const currentStock = article?.current_stock ?? null;
                                return (
                                    <div key={assignment.id} className="flex items-center gap-3 px-6 py-2 opacity-60">
                                        <button
                                            onClick={() => toggleChecked(assignment.id)}
                                            className="w-5 h-5 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center shrink-0"
                                        >
                                            <Check className="w-3 h-3 text-white" />
                                        </button>
                                        <p className="text-xs text-muted-foreground truncate flex-1">
                                            {assignment.article_name}
                                            <span className="ml-2 text-[10px]">
                                                ({currentStock != null ? currentStock : '—'}
                                                {assignment.min_stock != null ? ` / Soll ${assignment.min_stock}` : ''})
                                            </span>
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}