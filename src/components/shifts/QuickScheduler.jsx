/**
 * QuickScheduler — Drag & Drop Schichtplanung
 * Oben: Wochentabelle mit Schichttyp-Slots
 * Unten: Mitarbeiter-Pool → per Drag & Drop auf Schicht-Slot ziehen
 * Bereits eingeplante Mitarbeiter können per Drag & Drop in einen anderen Slot verschoben werden.
 * Vor jeder Zuweisung/Verschiebung wird geprüft, ob die Person am selben Tag bereits
 * in einer anderen Schicht eingeplant ist — in dem Fall gibt es eine Warnung mit Bestätigung.
 */
import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function QuickScheduler({ employees, shiftTypes, shifts, onCreateShift, onDeleteShift, onMoveShift }) {
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const sortedTypesBase = [...(shiftTypes || [])].sort((a, b) => {
        const at = a.start_time || '00:00';
        const bt = b.start_time || '00:00';
        return at.localeCompare(bt);
    });

    const knownTypeNames = new Set(sortedTypesBase.map(t => t.name));
    const weekShifts = shifts.filter(s => {
        const d = new Date(s.date);
        return d >= weekStart && d <= addDays(weekStart, 6);
    });
    const hasOrphanShifts = weekShifts.some(s => !knownTypeNames.has(s.shift_type));
    const sortedTypes = hasOrphanShifts
        ? [...sortedTypesBase, { id: '__other__', name: 'Sonstige', _isOther: true }]
        : sortedTypesBase;

    const getShiftsForSlot = (day, shiftType) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (shiftType._isOther) {
            const knownNames = new Set(sortedTypes.filter(t => !t._isOther).map(t => t.name));
            return shifts.filter(s => s.date === dateStr && !knownNames.has(s.shift_type));
        }
        return shifts.filter(s => s.date === dateStr && s.shift_type === shiftType.name);
    };

    const scheduledThisWeek = new Set(
        shifts
            .filter(s => {
                const d = new Date(s.date);
                return d >= weekStart && d <= addDays(weekStart, 6);
            })
            .map(s => s.employee_id)
    );

    // Mitarbeiter-Pool alphabetisch sortiert (Kurzname, sonst Name) — leichter zu finden
    const sortedEmployees = [...(employees || [])]
        .filter(e => e.is_active !== false && !e.is_system_account)
        .sort((a, b) => (a.short_name || a.name || '').localeCompare(b.short_name || b.name || '', 'de'));

    const formatDateForWarning = (dateStr) => dateStr.split('-').reverse().join('.');

    const handleDragEnd = (result) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const parts = destination.droppableId.split('|');
        if (parts[0] !== 'slot') return;

        const dateStr = parts[1];
        const shiftTypeName = parts[2];
        const shiftType = shiftTypes.find(st => st.name === shiftTypeName);
        if (!shiftType) return;

        const isMovingExistingShift = draggableId.startsWith('shift-');

        if (isMovingExistingShift) {
            const shiftId = draggableId.replace('shift-', '');
            const movingShift = shifts.find(s => s.id === shiftId);
            if (!movingShift) return;
            const employee = employees.find(e => e.id === movingShift.employee_id);
            if (!employee) return;

            if (movingShift.date === dateStr && movingShift.shift_type === shiftTypeName) return;

            const conflict = shifts.find(s =>
                s.id !== shiftId && s.date === dateStr && s.employee_id === employee.id
            );
            if (conflict) {
                const ok = window.confirm(
                    `${employee.name} ist am ${formatDateForWarning(dateStr)} bereits für "${conflict.shift_type}" eingeplant.\n\nTrotzdem verschieben?`
                );
                if (!ok) return;
            }

            onMoveShift?.(shiftId, {
                date: dateStr,
                start_time: shiftType.start_time || '00:00',
                end_time: shiftType.end_time || '00:00',
                shift_type: shiftType.name,
            });
            return;
        }

        const employee = employees.find(e => e.id === draggableId);
        if (!employee) return;

        const existing = shifts.find(s =>
            s.date === dateStr && s.shift_type === shiftTypeName && s.employee_id === draggableId
        );
        if (existing) return;

        const conflict = shifts.find(s => s.date === dateStr && s.employee_id === draggableId);
        if (conflict) {
            const ok = window.confirm(
                `${employee.name} ist am ${formatDateForWarning(dateStr)} bereits für "${conflict.shift_type}" eingeplant.\n\nTrotzdem zusätzlich einplanen?`
            );
            if (!ok) return;
        }

        onCreateShift({
            employee_id: employee.id,
            employee_name: employee.name,
            date: dateStr,
            start_time: shiftType.start_time || '00:00',
            end_time: shiftType.end_time || '00:00',
            shift_type: shiftType.name,
            color: employee.color || null,
        });
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={() => setWeekStart(w => subWeeks(w, 1))}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-semibold text-foreground flex-1 text-center">
                        {format(weekStart, 'd. MMM', { locale: de })} – {format(addDays(weekStart, 6), 'd. MMM yyyy', { locale: de })}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => setWeekStart(w => addWeeks(w, 1))}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                        Heute
                    </Button>
                </div>

                <div className="rounded-xl border border-border overflow-x-auto">
                    <table className="w-full min-w-[700px] border-collapse">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground w-28">Schicht</th>
                                {days.map((day, i) => {
                                    const isToday = isSameDay(day, new Date());
                                    return (
                                        <th key={i} className={cn(
                                            'px-2 py-2 text-xs font-bold text-center min-w-[90px]',
                                            isToday ? 'text-amber-400' : 'text-muted-foreground'
                                        )}>
                                            <div>{DAYS[i]}</div>
                                            <div className={cn(
                                                'text-[11px] font-normal mt-0.5',
                                                isToday && 'text-amber-400 font-bold'
                                            )}>
                                                {format(day, 'd.M.')}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedTypes.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                                        Keine Schichttypen gefunden. Bitte zuerst Schichttypen anlegen.
                                    </td>
                                </tr>
                            ) : sortedTypes.map((shiftType, si) => (
                                <tr key={shiftType.id} className={cn('border-t border-border', si % 2 === 0 ? 'bg-card' : 'bg-muted/20')}>
                                    <td className="px-3 py-2">
                                        <div className={cn("font-semibold text-sm", shiftType._isOther ? "text-muted-foreground italic" : "text-foreground")}>{shiftType.name}</div>
                                        {shiftType.start_time && (
                                            <div className="text-[11px] text-muted-foreground font-mono">
                                                {shiftType.start_time}–{shiftType.end_time}
                                            </div>
                                        )}
                                    </td>
                                    {days.map((day, di) => {
                                       const slotShifts = getShiftsForSlot(day, shiftType);
                                       const droppableId = `slot|${format(day, 'yyyy-MM-dd')}|${shiftType.name}`;
                                       return (
                                           <td key={di} className="px-1 py-1 align-top">
                                               <Droppable droppableId={droppableId} isDropDisabled={!!shiftType._isOther}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                            className={cn(
                                                                'min-h-[52px] rounded-lg p-1 transition-colors',
                                                                snapshot.isDraggingOver
                                                                    ? 'bg-amber-500/20 border border-dashed border-amber-500'
                                                                    : 'border border-transparent'
                                                            )}
                                                        >
                                                            {slotShifts.map((shift, sidx) => {
                                                                const emp = employees.find(e => e.id === shift.employee_id);
                                                                return (
                                                                    <Draggable key={shift.id} draggableId={`shift-${shift.id}`} index={sidx} isDragDisabled={shiftType._isOther}>
                                                                        {(dragProvided, dragSnapshot) => (
                                                                            <div
                                                                                ref={dragProvided.innerRef}
                                                                                {...dragProvided.draggableProps}
                                                                                {...dragProvided.dragHandleProps}
                                                                                className={cn(
                                                                                    "flex items-center gap-1 px-1.5 py-1 rounded-md mb-1 text-white text-xs font-medium group relative",
                                                                                    shiftType._isOther ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                                                                                    dragSnapshot.isDragging && "shadow-lg scale-105 opacity-90 z-50"
                                                                                )}
                                                                                style={{ backgroundColor: emp?.color || '#475569', ...dragProvided.draggableProps.style }}
                                                                                title={shiftType._isOther ? undefined : "Ziehen, um in eine andere Schicht zu verschieben"}
                                                                            >
                                                                                <span className="truncate flex-1">{emp?.short_name || shift.employee_name?.split(' ')[0]}</span>
                                                                                <button
                                                                                    onClick={() => onDeleteShift(shift.id)}
                                                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/20"
                                                                                >
                                                                                    <X className="w-2.5 h-2.5" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </Draggable>
                                                                );
                                                            })}
                                                            {provided.placeholder}
                                                        </div>
                                                    )}
                                                </Droppable>
                                           </td>
                                       );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <CalendarCheck className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-bold text-foreground">Mitarbeiter</h3>
                        <span className="text-xs text-muted-foreground">— auf eine Schicht ziehen zum Einplanen</span>
                    </div>
                    <Droppable droppableId="employee-pool" isDropDisabled={true} direction="horizontal">
                        {(provided) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className="flex flex-wrap gap-2"
                            >
                                {sortedEmployees.map((emp, index) => {
                                    const isScheduled = scheduledThisWeek.has(emp.id);
                                    return (
                                        <Draggable key={emp.id} draggableId={emp.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={cn(
                                                        'flex items-center gap-2 px-3 py-2 rounded-xl border cursor-grab active:cursor-grabbing select-none transition-all',
                                                        snapshot.isDragging
                                                            ? 'shadow-lg scale-105 opacity-90 z-50'
                                                            : 'hover:border-amber-500/50',
                                                        isScheduled
                                                            ? 'border-border bg-muted/40 opacity-60'
                                                            : 'border-border bg-secondary/60'
                                                    )}
                                                >
                                                    <div
                                                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                                        style={{ backgroundColor: emp.color || '#475569' }}
                                                    >
                                                        {emp.name?.charAt(0)}
                                                    </div>
                                                    <span className="text-sm font-medium text-foreground whitespace-nowrap">
                                                        {emp.short_name || emp.name?.split(' ')[0]}
                                                    </span>
                                                    {isScheduled && (
                                                        <Badge className="text-[9px] px-1 py-0 h-4 bg-green-500/20 text-green-400 border-green-500/30">
                                                            ✓
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </Draggable>
                                    );
                                })}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </div>
            </div>
        </DragDropContext>
    );
}