import { useState, useMemo, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { usePermissions } from '@/components/auth/usePermissions';
import {
    Layers, ChevronRight, ChevronDown, CheckCircle2, Circle,
    Package, Check, Plus, ClipboardList, ArrowUp, ArrowDown, Target
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
 * Wichtig: Es gibt KEINE Kassenanbindung, current_stock im System ist daher NIE verlässlich
 * (letzter Zählstand, keine Live-Synchronisation mit tatsächlichem Verkauf). Wir dürfen also
 * niemals automatisch berechnen "wie viel fehlt noch bis Soll" — das muss die Person vor Ort
 * anhand des tatsächlichen Blicks ins Fach selbst eintippen.
 *
 * Die einzige Sicherheitsregel: Die eingetippte Menge darf die Soll-Menge (min_stock) selbst
 * niemals überschreiten — das ist die harte Obergrenze gegen Tippfehler (z.B. 44 statt 14),
 * unabhängig vom (unzuverlässigen) System-Bestand.
 */

// Ist ein Artikel "erledigt" — bereits manuell geprüft ODER schon in der heutigen Auffüllliste?
// (current_stock wird bewusst NICHT herangezogen, da nicht live-synced.)
function isAssignmentSettled(assignment, { restockItems, today, checkedArticles }) {
    if (checkedArticles[assignment.id]) return true;
    const hasRestockItem = restockItems.some(item =>
        item.article_id === assignment.article_id &&
        item.date === today &&
        !item.is_completed
    );
    return hasRestockItem;
}

/**
 * Rundgang-Modus für die Auffüllliste.
 * Hierarchie: Bereich (collapsible) → Möbel (collapsible) → Fach (collapsible) → Artikel.
 * Zeigt ALLE Möbeltypen (nicht nur Kühlschränke), aber nur solche mit restock_enabled !== false.
 * Nur Fächer mit restock_enabled !== false.
 * Nur Bereiche mit restock_enabled !== false.
 *
 * Vereinfacht (2026-07-03): Bereits geprüfte/aufgefüllte Artikel klappen sich zu einer kompakten
 * Zeile zusammen. Ebenen mit noch offenen Artikeln öffnen sich beim ersten Laden automatisch.
 * Sobald ein Fach komplett fertig ist, klappt es sich automatisch zu; ist ein ganzes Möbel fertig,
 * klappt das Möbel zu; ist ein ganzer Bereich fertig, klappt der Bereich zu — das spart beim
 * Rundgang laufend Platz, ohne dass man manuell etwas schließen muss. Eine Fortschrittsleiste
 * oben zeigt auf einen Blick, wie viele Fächer insgesamt noch offen sind.
 */
export default function RundgangMode({ restockItems, articles, createMutation, updateMutation, showToast }) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const qc = useQueryClient();
    const permissions = usePermissions();
    const canSort = permissions.isManager || permissions.isAdmin;

    // ── Queries ──────────────────────────────────────────────────────────────
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
        queryFn: () => base44.entities.StorageSlot.list('full_name', 1000),
        staleTime: STALE.MEDIUM,
    });

    const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
        queryKey: ['assignments'],
        queryFn: () => base44.entities.StorageAssignment.filter({ is_active: true }, 'article_name', 1000),
        staleTime: STALE.MEDIUM,
    });

    const isInitialLoading = areasLoading || furnitureLoading || slotsLoading || assignmentsLoading;

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

    // Schritt-für-Schritt-Fokus-Modus: statt alle offenen Fächer gleichzeitig anzuzeigen
    // (überladen auf Mobile), ist immer nur GENAU EIN Fach aufgeklappt — sobald es fertig
    // ist, klappt es zu und das nächste Fach in der Reihenfolge (Bereich → Möbel → Fach,
    // gemäß sort_order) klappt automatisch auf. Verbindlich für alle — kein Umschalter,
    // ein System für alle.

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

    const sortAreaMut = useMutation({
        mutationFn: ({ area, direction, siblings }) => swapSortOrder(area, direction, siblings, 'Area', ['st-areas']),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['st-areas'] }),
        onError: () => showToast('Sortierung konnte nicht geändert werden', 'error'),
    });

    // ── Gefilterte Daten ─────────────────────────────────────────────────────
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

    // ── Fortschritts-Logik (nur manuell geprüft oder schon in Liste = "durchgegangen") ──────
    const settledCtx = { restockItems, today, checkedArticles };
    const isSlotDone = (slotId) => {
        const slotAssignments = assignmentsBySlot[slotId];
        if (!slotAssignments?.length) return false;
        return slotAssignments.every(a => isAssignmentSettled(a, settledCtx));
    };

    // ── Restock erstellen/aktualisieren (Menge hart auf Soll gedeckelt) ───────
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

        // Sicherheitsnetz gegen Tippfehler (z.B. 44 statt 14): die Soll-Menge selbst ist die
        // absolute Obergrenze — wir kennen den echten aktuellen Bestand ohne Inventur nicht,
        // daher wird NICHT gegen current_stock gerechnet, sondern nur gegen min_stock gedeckelt.
        const maxAllowed = assignment.min_stock;
        if (maxAllowed != null && numQty > maxAllowed) {
            numQty = maxAllowed;
            showToast(`Menge auf Soll-Maximum (${maxAllowed}${assignment.unit ? ` ${assignment.unit}` : ''}) begrenzt`, 'info');
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

    // ── Struktur-Baum einmal pro Render aufbauen (wird von mehreren Effekten/Render genutzt) ──
    const tree = useMemo(() => {
        return areasWithRestock.map(area => {
            const areaFurniture = (furnitureByArea[area.id] || []).filter(f =>
                (slotsByFurniture[f.id] || []).some(s => assignmentsBySlot[s.id]?.length > 0)
            );
            const furnitureList = areaFurniture.map(fur => ({
                fur,
                furSlots: (slotsByFurniture[fur.id] || []).filter(s => assignmentsBySlot[s.id]?.length > 0),
            })).filter(f => f.furSlots.length > 0);
            return { area, furnitureList };
        });
    }, [areasWithRestock, furnitureByArea, slotsByFurniture, assignmentsBySlot]);

    // ── Flache, physisch-begehbare Reihenfolge ALLER Fächer (Bereich → Möbel → Fach,
    // jeweils nach sort_order) — Grundlage für den Schritt-für-Schritt-Fokus-Modus. ────
    const flatSlots = useMemo(() => {
        const list = [];
        tree.forEach(({ area, furnitureList }) => {
            furnitureList.forEach(({ fur, furSlots }) => {
                furSlots.forEach(slot => list.push({ area, fur, slot }));
            });
        });
        return list;
    }, [tree]);

    // ── Das aktuell "dran" befindliche Fach im Fokus-Modus: das erste noch nicht
    // fertige Fach in der physischen Reihenfolge. null = alles erledigt. ────────────
    const activeSlotEntry = useMemo(() => {
        return flatSlots.find(({ slot }) => !isSlotDone(slot.id)) || null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flatSlots, checkedArticles, restockItems]);

    // ── Gesamt-Fortschritt (für die Kopfzeile) ────────────────────────────────
    const overallProgress = useMemo(() => {
        let total = 0, done = 0;
        tree.forEach(({ furnitureList }) => {
            furnitureList.forEach(({ furSlots }) => {
                furSlots.forEach(slot => {
                    total++;
                    if (isSlotDone(slot.id)) done++;
                });
            });
        });
        return { total, done };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tree, checkedArticles, restockItems]);

    // ── Auto-Expand: Ebenen mit offenem Handlungsbedarf öffnen sich beim ersten
    // Laden automatisch, damit man nicht durch alles klicken muss. Läuft nur EINMAL
    // pro Seitenaufruf — danach bleibt es dem Nutzer überlassen, was auf/zu ist.
    const autoExpandedRef = useRef(false);
    useEffect(() => {
        if (autoExpandedRef.current || tree.length === 0) return;

        // Nur den Pfad zum EINEN aktuell dran befindlichen Fach öffnen — alles andere
        // bleibt zu. Der Folge-Effekt unten übernimmt danach das automatische Weiterschalten.
        if (activeSlotEntry) {
            setExpandedAreas(prev => ({ ...prev, [activeSlotEntry.area.id]: true }));
            setExpandedFurniture(prev => ({ ...prev, [activeSlotEntry.fur.id]: true }));
            setExpandedSlots(prev => ({ ...prev, [activeSlotEntry.slot.id]: true }));
        }
        autoExpandedRef.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tree]);

    // ── Fokus-Modus: sobald das aktuell aktive Fach wechselt (weil das vorherige
    // fertig wurde), automatisch zum nächsten Fach in der Reihenfolge weiterspringen —
    // dessen Bereich/Möbel-Pfad öffnen und sanft dorthin scrollen. Das eigentliche
    // Zuklappen des fertigen Fachs übernimmt bereits der Auto-Collapse-Effekt weiter
    // unten (reagiert auf den offen→fertig Übergang), hier kümmern wir uns nur ums
    // Weiterschalten zum NÄCHSTEN Fach. ──────────────────────────────────────────
    const prevActiveSlotIdRef = useRef(null);
    const activeSlotRefEl = useRef(null);
    useEffect(() => {
        const activeId = activeSlotEntry?.slot?.id || null;
        if (activeId && activeId !== prevActiveSlotIdRef.current) {
            const isFirstLoad = prevActiveSlotIdRef.current === null;
            setExpandedAreas(prev => ({ ...prev, [activeSlotEntry.area.id]: true }));
            setExpandedFurniture(prev => ({ ...prev, [activeSlotEntry.fur.id]: true }));
            setExpandedSlots(prev => ({ ...prev, [activeId]: true }));
            prevActiveSlotIdRef.current = activeId;
            // Nur ins Sichtfeld scrollen, wenn wir NICHT ganz am Anfang stehen (sonst
            // springt die Seite beim allerersten Laden unnötig).
            if (!isFirstLoad) {
                setTimeout(() => {
                    activeSlotRefEl.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 150);
            }
        }
    }, [activeSlotEntry]);

    // ── Auto-Collapse: Sobald ein Fach/Möbel/Bereich fertig wird (Übergang offen → fertig),
    // klappt es sich automatisch zu — spart laufend Platz beim Rundgang, ohne dass man
    // irgendwas manuell schließen muss. Reagiert nur auf den ÜBERGANG, nicht auf den
    // bereits-fertigen Ausgangszustand (der ist ohnehin schon zugeklappt, siehe Auto-Expand oben).
    const prevSlotDoneRef = useRef({});
    const prevFurDoneRef = useRef({});
    const prevAreaDoneRef = useRef({});
    useEffect(() => {
        const slotCollapse = {};
        const furCollapse = {};
        const areaCollapse = {};

        tree.forEach(({ area, furnitureList }) => {
            let areaSlotCount = 0, areaDoneCount = 0;

            furnitureList.forEach(({ fur, furSlots }) => {
                let furDoneCount = 0;

                furSlots.forEach(slot => {
                    const done = isSlotDone(slot.id);
                    const prevDone = prevSlotDoneRef.current[slot.id];
                    if (done && prevDone === false) slotCollapse[slot.id] = false; // false = zugeklappt
                    prevSlotDoneRef.current[slot.id] = done;
                    if (done) furDoneCount++;
                });

                const furDone = furSlots.length > 0 && furDoneCount === furSlots.length;
                const prevFurDone = prevFurDoneRef.current[fur.id];
                if (furDone && prevFurDone === false) furCollapse[fur.id] = false;
                prevFurDoneRef.current[fur.id] = furDone;

                areaSlotCount += furSlots.length;
                areaDoneCount += furDoneCount;
            });

            const areaDone = areaSlotCount > 0 && areaDoneCount === areaSlotCount;
            const prevAreaDone = prevAreaDoneRef.current[area.id];
            if (areaDone && prevAreaDone === false) areaCollapse[area.id] = false;
            prevAreaDoneRef.current[area.id] = areaDone;
        });

        if (Object.keys(slotCollapse).length) setExpandedSlots(prev => ({ ...prev, ...slotCollapse }));
        if (Object.keys(furCollapse).length) setExpandedFurniture(prev => ({ ...prev, ...furCollapse }));
        if (Object.keys(areaCollapse).length) setExpandedAreas(prev => ({ ...prev, ...areaCollapse }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tree, checkedArticles, restockItems]);

    // ── Heute aufgefüllte Artikel (für die Abschluss-Zusammenfassung) ────────
    const todaysRestockItems = useMemo(() =>
        restockItems.filter(item => item.date === today && !item.is_completed),
        [restockItems, today]
    );

    // ── Abschluss-Zusammenfassung: wenn der komplette Rundgang fertig wird
    // (Übergang zu "alles erledigt"), kurze Bilanz zeigen — wie beim Ausstempeln.
    const [showCompletionSummary, setShowCompletionSummary] = useState(false);
    const prevAllDoneRef = useRef(false);
    useEffect(() => {
        const nowAllDone = overallProgress.total > 0 && overallProgress.done === overallProgress.total;
        if (nowAllDone && !prevAllDoneRef.current) {
            setShowCompletionSummary(true);
        }
        prevAllDoneRef.current = nowAllDone;
    }, [overallProgress]);

    if (isInitialLoading) {
        return (
            <Card className="p-10 text-center border-border/40">
                <div className="w-6 h-6 mx-auto mb-3 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Lade Rundgang…</p>
            </Card>
        );
    }

    if (tree.length === 0) {
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

    const allDone = overallProgress.total > 0 && overallProgress.done === overallProgress.total;
    const progressPct = overallProgress.total > 0 ? Math.round((overallProgress.done / overallProgress.total) * 100) : 0;

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-2">
            {/* Gesamt-Fortschritt — sticky, damit man beim Scrollen immer den Überblick behält */}
            <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur-sm flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                        className={cn('h-full rounded-full transition-all', allDone ? 'bg-green-500' : 'bg-amber-500')}
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
                <p className="text-[11px] font-medium text-muted-foreground shrink-0">
                    {allDone
                        ? <span className="text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Rundgang komplett</span>
                        : `${overallProgress.done}/${overallProgress.total} Fächer erledigt`}
                </p>
            </div>

            {tree.map(({ area, furnitureList }, areaIdx) => {
                const areaSlots = furnitureList.flatMap(f => f.furSlots);
                const areaExpanded = expandedAreas[area.id];
                const doneInArea = areaSlots.filter(s => isSlotDone(s.id)).length;
                const areaAllDone = areaSlots.length > 0 && doneInArea === areaSlots.length;

                return (
                    <Card key={area.id} className="overflow-hidden border-border">
                        {/* Bereich Header */}
                        <div className="w-full flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors">
                            <button
                                className="flex items-center gap-3 flex-1 min-w-0 text-left"
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
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-foreground">{area.name}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {doneInArea}/{areaSlots.length} Fächer durchgegangen
                                    </p>
                                </div>
                                {areaExpanded
                                    ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                    : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                            </button>
                            {canSort && (
                                <div className="flex gap-0.5 shrink-0">
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        disabled={areaIdx === 0}
                                        onClick={() => sortAreaMut.mutate({ area, direction: 'up', siblings: tree.map(t => t.area) })}>
                                        <ArrowUp className="w-3 h-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        disabled={areaIdx === tree.length - 1}
                                        onClick={() => sortAreaMut.mutate({ area, direction: 'down', siblings: tree.map(t => t.area) })}>
                                        <ArrowDown className="w-3 h-3" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Möbel + Fächer */}
                        {areaExpanded && (
                            <div className="border-t border-border/50">
                                {furnitureList.map(({ fur, furSlots }, furIdx) => {
                                    const furExpanded = expandedFurniture[fur.id];
                                    const doneInFur = furSlots.filter(s => isSlotDone(s.id)).length;
                                    const furAllDone = furSlots.length > 0 && doneInFur === furSlots.length;

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
                                                            onClick={() => sortFurMut.mutate({ fur, direction: 'up', siblings: furnitureList.map(f => f.fur) })}>
                                                            <ArrowUp className="w-3 h-3" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                            disabled={furIdx === furnitureList.length - 1}
                                                            onClick={() => sortFurMut.mutate({ fur, direction: 'down', siblings: furnitureList.map(f => f.fur) })}>
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
                                                            isActive={activeSlotEntry?.slot?.id === slot.id}
                                                            activeRef={activeSlotEntry?.slot?.id === slot.id ? activeSlotRefEl : null}
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

            {/* Abschluss-Zusammenfassung */}
            <Sheet open={showCompletionSummary} onOpenChange={setShowCompletionSummary}>
                <SheetContent side="bottom" className="rounded-t-2xl pb-8 px-6 pt-6 max-h-[85vh] overflow-y-auto">
                    <div className="space-y-4">
                        <div className="text-center space-y-1">
                            <div className="text-4xl">✅</div>
                            <h2 className="text-xl font-bold text-foreground">Rundgang komplett!</h2>
                            <p className="text-sm text-muted-foreground">Alle {overallProgress.total} Fächer durchgegangen</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-muted rounded-xl p-4 text-center space-y-1">
                                <p className="text-2xl font-bold text-foreground">{todaysRestockItems.length}</p>
                                <p className="text-xs text-muted-foreground">Artikel aufgefüllt</p>
                            </div>
                            <div className="bg-muted rounded-xl p-4 text-center space-y-1">
                                <p className="text-2xl font-bold text-foreground">
                                    {todaysRestockItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0)}
                                </p>
                                <p className="text-xs text-muted-foreground">Einheiten gesamt</p>
                            </div>
                        </div>
                        {todaysRestockItems.length > 0 && (
                            <div className="bg-muted/50 rounded-xl p-3 space-y-1.5 max-h-48 overflow-y-auto">
                                <p className="text-xs font-semibold text-muted-foreground">Aufgefüllt heute:</p>
                                {todaysRestockItems.map(item => (
                                    <div key={item.id} className="flex justify-between text-xs text-muted-foreground">
                                        <span className="truncate">{item.article_name}</span>
                                        <span className="font-medium shrink-0 ml-2">{item.quantity}×</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Button className="w-full h-11" onClick={() => setShowCompletionSummary(false)}>
                            Fertig
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}

// ── Fach-Zeile ─────────────────────────────────────────────────────────────
function SlotArticleRow({ assignment, article, area, onRestock, qtyValue, setRestockQtys, toggleChecked, isChecked }) {
    const currentStock = article?.current_stock ?? null;
    const minStock = assignment.min_stock;
    const unit = assignment.unit ? ` ${assignment.unit}` : '';

    return (
        <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border/20 last:border-0">
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
                    Zuletzt gezählt: {currentStock != null ? currentStock : '—'}
                    {article?.content_unit ? ` ${article.content_unit}` : ''}
                    {minStock != null && (
                        <span className="ml-2 text-blue-400 font-medium">
                            Soll: {minStock}{unit}
                        </span>
                    )}
                </p>
            </div>

            {/* Menge-Eingabe — frei eintippbar, aber hart auf Soll gedeckelt */}
            <Input
                type="number"
                inputMode="decimal"
                max={minStock != null ? minStock : undefined}
                className="h-8 w-16 text-xs px-2"
                placeholder="Menge"
                value={qtyValue}
                onChange={e => {
                    let v = e.target.value;
                    if (minStock != null && v !== '' && parseFloat(v) > minStock) v = String(minStock);
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
        </div>
    );
}

// ── Slot-Gruppe (Fach Header + aufklappbare Artikel-Liste) ────────────────────
function SlotRestockGroup({
    slot, area, expanded, onToggle, assignments, articles, restockItems, today,
    isDone, restockQtys, setRestockQtys, checkedArticles, toggleChecked, onRestock,
    canSort, slotIdx, totalSlots, siblings, onMoveSlot, isActive, activeRef
}) {
    const [showSettled, setShowSettled] = useState(false);
    const settledCtx = { restockItems, today, checkedArticles };

    const openItems = [];
    const settledItems = [];
    assignments.forEach(assignment => {
        const article = articles.find(a => a.id === assignment.article_id);
        const settled = isAssignmentSettled(assignment, settledCtx);
        (settled ? settledItems : openItems).push({ assignment, article, settled });
    });

    return (
        <div ref={activeRef} className={cn(
            "border-b border-border/20 last:border-0 transition-all",
            isActive && "ring-2 ring-primary ring-inset bg-primary/5"
        )}>
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
                    {isActive && (
                        <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
                            <Target className="w-2.5 h-2.5" />Jetzt dran
                        </span>
                    )}
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
                    {/* Offene Artikel direkt anzeigen — reduziert das Chaos beim Aufklappen */}
                    {openItems.map(({ assignment, article }) => (
                        <SlotArticleRow
                            key={assignment.id}
                            assignment={assignment}
                            article={article}
                            area={area}
                            onRestock={onRestock}
                            qtyValue={restockQtys[assignment.id] || ''}
                            setRestockQtys={setRestockQtys}
                            toggleChecked={toggleChecked}
                            isChecked={checkedArticles[assignment.id] || false}
                        />
                    ))}

                    {openItems.length === 0 && (
                        <p className="px-6 py-3 text-xs text-muted-foreground/70 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            Alles geprüft
                        </p>
                    )}

                    {/* Bereits geprüfte/aufgefüllte Artikel eingeklappt — bei Bedarf anzeigen */}
                    {settledItems.length > 0 && (
                        <div className="border-t border-border/10">
                            <button
                                type="button"
                                className="w-full flex items-center gap-1.5 px-6 py-2 text-[11px] text-muted-foreground hover:text-foreground"
                                onClick={() => setShowSettled(v => !v)}
                            >
                                {showSettled ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                ✓ {settledItems.length} bereits erledigt
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
                                                (Soll {assignment.min_stock != null ? assignment.min_stock : '—'})
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