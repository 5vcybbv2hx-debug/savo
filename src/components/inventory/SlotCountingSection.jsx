import { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Layers, ChevronRight, ChevronDown, CheckCircle2, Circle, Package } from 'lucide-react';
import { cn } from "@/lib/utils";
import CountInput from './CountInput';

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
 * Fach-basierte Zählung:
 *   Bereich (collapsible) → Möbel (collapsible) → Fach (collapsible) → Artikel mit Zähl-Input.
 * slotValues sind vorbefüllt mit assignment.quantity (letzte Zählung).
 * touchedAssignments trackt welche Zuordnungen der Nutzer bearbeitet hat (für Fortschritt).
 */
export default function SlotCountingSection({
    areas, slots, assignments, articles, furniture = [],
    slotValues, touchedAssignments,
    onCountChange
}) {
    const [expandedAreas, setExpandedAreas] = useState({});
    const [expandedFurniture, setExpandedFurniture] = useState({});
    const [expandedSlots, setExpandedSlots] = useState({});

    const slotsByArea = useMemo(() => {
        const map = {};
        slots.forEach(s => {
            if (!map[s.area_id]) map[s.area_id] = [];
            map[s.area_id].push(s);
        });
        return map;
    }, [slots]);

    const furnitureByArea = useMemo(() => {
        const map = {};
        furniture
            .filter(f => f.is_active !== false)
            .forEach(f => {
                if (!map[f.area_id]) map[f.area_id] = [];
                map[f.area_id].push(f);
            });
        // Sortiere nach sort_order, dann name
        Object.values(map).forEach(arr =>
            arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.name || '').localeCompare(b.name || ''))
        );
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

    const assignmentsBySlot = useMemo(() => {
        const map = {};
        assignments.forEach(a => {
            if (!map[a.storage_slot_id]) map[a.storage_slot_id] = [];
            map[a.storage_slot_id].push(a);
        });
        return map;
    }, [assignments]);

    const isSlotCounted = (slotId) => {
        const slotAssignments = assignmentsBySlot[slotId];
        if (!slotAssignments?.length) return false;
        return slotAssignments.every(a => touchedAssignments[a.id]);
    };

    // Nur Bereiche zeigen, die mind. ein Fach mit Zuordnungen haben
    const areasWithSlots = areas.filter(a =>
        slotsByArea[a.id]?.some(s => assignmentsBySlot[s.id]?.length > 0)
    );

    if (areasWithSlots.length === 0) {
        return (
            <Card className="p-6 text-center text-muted-foreground bg-card border-border">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Keine Fächer mit Artikel-Zuordnungen vorhanden.</p>
                <p className="text-xs mt-1">Artikel werden unten als „Nicht zugeordnete Artikel" angezeigt.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-2">
            {areasWithSlots.map(area => {
                const areaSlots = (slotsByArea[area.id] || [])
                    .filter(s => assignmentsBySlot[s.id]?.length > 0);
                const areaExpanded = expandedAreas[area.id];
                const countedInArea = areaSlots.filter(s => isSlotCounted(s.id)).length;

                // Möbel in diesem Bereich, die mind. ein Fach mit Zuordnungen haben
                const areaFurniture = (furnitureByArea[area.id] || []).filter(f =>
                    (slotsByFurniture[f.id] || []).some(s => assignmentsBySlot[s.id]?.length > 0)
                );
                // Fallback: Slots ohne furniture_id ODER deren Möbel nicht in den geladenen Daten existiert
                // (verhindert dass Fächer unsichtbar werden wenn Furniture-Query noch lädt/fehlschlägt)
                const slotsWithoutFurniture = areaSlots.filter(s =>
                    !s.furniture_id || !furniture.find(f => f.id === s.furniture_id)
                );

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
                                    {countedInArea}/{areaSlots.length} Fächer gezählt
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
                                    const countedInFur = furSlots.filter(s => isSlotCounted(s.id)).length;
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
                                                        {fur.type}{fur.type ? ' · ' : ''}{countedInFur}/{furSlots.length} Fächer
                                                    </p>
                                                </div>
                                                {furExpanded
                                                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                            </button>

                                            {/* Fächer unter diesem Möbel */}
                                            {furExpanded && (
                                                <div className="bg-muted/10">
                                                    {furSlots.map(slot => (
                                                        <SlotGroup
                                                            key={slot.id}
                                                            slot={slot}
                                                            expanded={expandedSlots[slot.id]}
                                                            onToggle={() => setExpandedSlots(prev => ({ ...prev, [slot.id]: !prev[slot.id] }))}
                                                            assignments={assignmentsBySlot[slot.id] || []}
                                                            isCounted={isSlotCounted(slot.id)}
                                                            slotValues={slotValues}
                                                            touchedAssignments={touchedAssignments}
                                                            onCountChange={onCountChange}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Fallback: Fächer ohne Möbel-Zuordnung */}
                                {slotsWithoutFurniture.length > 0 && (
                                    <div className="border-b border-border/30 last:border-0">
                                        <button
                                            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/20 transition-colors"
                                            onClick={() => setExpandedFurniture(prev => ({ ...prev, ['__no_fur__' + area.id]: !prev['__no_fur__' + area.id] }))}
                                        >
                                            <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-sm font-medium text-foreground">Ohne Möbel</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {slotsWithoutFurniture.filter(s => isSlotCounted(s.id)).length}/{slotsWithoutFurniture.length} Fächer
                                                </p>
                                            </div>
                                            {expandedFurniture['__no_fur__' + area.id]
                                                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                        </button>
                                        {expandedFurniture['__no_fur__' + area.id] && (
                                            <div className="bg-muted/10">
                                                {slotsWithoutFurniture.map(slot => (
                                                    <SlotGroup
                                                        key={slot.id}
                                                        slot={slot}
                                                        expanded={expandedSlots[slot.id]}
                                                        onToggle={() => setExpandedSlots(prev => ({ ...prev, [slot.id]: !prev[slot.id] }))}
                                                        assignments={assignmentsBySlot[slot.id] || []}
                                                        isCounted={isSlotCounted(slot.id)}
                                                        slotValues={slotValues}
                                                        touchedAssignments={touchedAssignments}
                                                        onCountChange={onCountChange}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}

// ── Slot-Gruppe (Fach Header + aufklappbare Artikel-Liste) ────────────────────
function SlotGroup({ slot, expanded, onToggle, assignments, isCounted, slotValues, touchedAssignments, onCountChange }) {
    return (
        <div className="border-b border-border/20 last:border-0">
            {/* Fach Header */}
            <button
                className="w-full flex items-center gap-2 px-6 py-2.5 hover:bg-secondary/20 transition-colors"
                onClick={onToggle}
            >
                {isCounted
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

            {/* Artikel-Zuordnungen */}
            {expanded && (
                <div className="bg-muted/20 border-t border-border/20">
                    {assignments.map(assignment => {
                        const value = slotValues[assignment.id];
                        const isTouched = touchedAssignments[assignment.id];
                        const oldValue = assignment.quantity ?? 0;
                        const hasChanged = isTouched && value !== oldValue;
                        const hasMinStock = assignment.min_stock != null;

                        return (
                            <div key={assignment.id}
                                className="flex items-center gap-3 px-6 py-2.5 border-b border-border/20 last:border-0"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground truncate">
                                        {assignment.article_name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        Letzte: {oldValue}{assignment.unit ? ` ${assignment.unit}` : ''}
                                        {hasMinStock && (
                                            <span className="ml-2 text-blue-400">
                                                Soll: {assignment.min_stock}{assignment.unit ? ` ${assignment.unit}` : ''}
                                            </span>
                                        )}
                                        {hasChanged && value !== undefined && (
                                            <span className={cn(
                                                'ml-2 font-medium',
                                                value > oldValue ? 'text-green-400' : 'text-red-400'
                                            )}>
                                                → {value}
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <CountInput
                                    value={value}
                                    onChange={(v) => onCountChange(assignment.id, v)}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}