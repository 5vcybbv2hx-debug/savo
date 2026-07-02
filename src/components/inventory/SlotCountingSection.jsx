import { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Layers, ChevronRight, ChevronDown, CheckCircle2, Circle } from 'lucide-react';
import { cn } from "@/lib/utils";
import CountInput from './CountInput';

/**
 * Fach-basierte Zählung: Bereich (collapsible) → Fach (collapsible) → Artikel mit Zähl-Input.
 * slotValues sind vorbefüllt mit assignment.quantity (letzte Zählung).
 * touchedAssignments trackt welche Zuordnungen der Nutzer bearbeitet hat (für Fortschritt).
 */
export default function SlotCountingSection({
    areas, slots, assignments, articles,
    slotValues, touchedAssignments,
    onCountChange
}) {
    const [expandedAreas, setExpandedAreas] = useState({});
    const [expandedSlots, setExpandedSlots] = useState({});

    const slotsByArea = useMemo(() => {
        const map = {};
        slots.forEach(s => {
            if (!map[s.area_id]) map[s.area_id] = [];
            map[s.area_id].push(s);
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

                        {/* Fächer */}
                        {areaExpanded && (
                            <div className="border-t border-border/50">
                                {areaSlots.map(slot => {
                                    const slotAssignments = assignmentsBySlot[slot.id] || [];
                                    const slotExpanded = expandedSlots[slot.id];
                                    const isCounted = isSlotCounted(slot.id);

                                    return (
                                        <div key={slot.id} className="border-b border-border/30 last:border-0">
                                            {/* Fach Header */}
                                            <button
                                                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/20 transition-colors"
                                                onClick={() => setExpandedSlots(prev => ({ ...prev, [slot.id]: !prev[slot.id] }))}
                                            >
                                                {isCounted
                                                    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                                    : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                                                <div className="flex-1 text-left min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">{slot.name}</p>
                                                    <p className="text-[11px] text-muted-foreground truncate">
                                                        {slot.furniture_name}{slot.furniture_type ? ` · ${slot.furniture_type}` : ''}
                                                    </p>
                                                </div>
                                                {slot.short_code && (
                                                    <span className="text-[10px] font-mono bg-secondary text-muted-foreground px-1.5 py-0.5 rounded shrink-0">
                                                        {slot.short_code}
                                                    </span>
                                                )}
                                                {slotExpanded
                                                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                            </button>

                                            {/* Artikel-Zuordnungen */}
                                            {slotExpanded && (
                                                <div className="bg-muted/20 border-t border-border/20">
                                                    {slotAssignments.map(assignment => {
                                                        const value = slotValues[assignment.id];
                                                        const isTouched = touchedAssignments[assignment.id];
                                                        const oldValue = assignment.quantity ?? 0;
                                                        const hasChanged = isTouched && value !== oldValue;

                                                        return (
                                                            <div key={assignment.id}
                                                                className="flex items-center gap-3 px-4 py-2.5 border-b border-border/20 last:border-0"
                                                            >
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm text-foreground truncate">
                                                                        {assignment.article_name}
                                                                    </p>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        Letzte: {oldValue}{assignment.unit ? ` ${assignment.unit}` : ''}
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
                                })}
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}