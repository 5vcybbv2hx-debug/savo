import React, { useState, useRef, useEffect, useMemo } from 'react';
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/components/auth/usePermissions';
import { haptics } from '@/components/utils/haptics';
import { getHolidaysBW, getHolidayName } from './getHolidays';
import ShiftBottomSheet from './ShiftBottomSheet';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const today = new Date();

function ShiftSkeleton() {
    return (
        <div className="animate-pulse space-y-1.5 p-1">
            {[1, 2].map(i => (
                <div key={i} className="h-12 rounded-lg bg-slate-700/60" />
            ))}
        </div>
    );
}

function SwipeableShiftCard({ shift, onOpen, onDelete, canEdit }) {
    const startX = useRef(null);
    const [offset, setOffset] = useState(0);
    const [swiping, setSwiping] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const DELETE_THRESHOLD = 80;

    const handleTouchStart = (e) => {
        startX.current = e.touches[0].clientX;
        setSwiping(true);
    };
    const handleTouchMove = (e) => {
        if (startX.current === null) return;
        const dx = e.touches[0].clientX - startX.current;
        if (dx < 0) setOffset(Math.max(dx, -120));
    };
    const handleTouchEnd = () => {
        if (offset < -DELETE_THRESHOLD && canEdit) {
            haptics.medium();
            setConfirmOpen(true);
        }
        setOffset(0);
        setSwiping(false);
        startX.current = null;
    };

    return (
        <>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Schicht löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Schicht von {shift.employee_name} wird unwiderruflich gelöscht.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => onDelete(shift.id)}
                        >
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="relative overflow-hidden rounded-lg">
                {/* Delete hint behind card */}
                <div className="absolute inset-y-0 right-0 flex items-center justify-center w-20 bg-red-600 rounded-lg">
                    <Trash2 className="w-4 h-4 text-white" />
                </div>
                {/* Card */}
                <div
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => { haptics.selection(); onOpen(shift); }}
                    className="relative min-h-[52px] rounded-lg px-2 py-1.5 flex flex-col justify-center gap-0.5 cursor-pointer active:brightness-90 select-none"
                    style={{ backgroundColor: shift._color || '#64748b', transform: `translateX(${offset}px)`, transition: swiping ? 'none' : 'transform 0.25s ease' }}
                >
                    <p className="text-[11px] font-bold text-white truncate leading-tight">{shift.employee_name}</p>
                    <p className="text-[10px] text-white/80 font-mono leading-tight">{shift.start_time?.slice(0, 5)}–{shift.end_time?.slice(0, 5)}</p>
                    {shift.shift_type && (
                        <span className="text-[9px] text-white/70 truncate leading-tight">{shift.shift_type}</span>
                    )}
                </div>
            </div>
        </>
    );
}

export default function MobileWeekView({ shifts = [], employees = [], isLoading, onAddShift, onSelectShift, onSaveShift, onDeleteShift, weekStart: weekStartProp, onWeekChange }) {
    const permissions = usePermissions();
    const [weekStart, setWeekStart] = useState(() => weekStartProp || startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [bottomSheet, setBottomSheet] = useState(null); // shift or null

    // Sync weekStart from parent
    useEffect(() => {
        if (weekStartProp && weekStartProp.getTime() !== weekStart.getTime()) {
            setWeekStart(weekStartProp);
        }
    }, [weekStartProp]);
    const [newShiftDay, setNewShiftDay] = useState(null);
    const touchStartX = useRef(null);
    const containerRef = useRef(null);

    const holidays = useMemo(() => {
        const year = weekStart.getFullYear();
        return [...getHolidaysBW(year), ...getHolidaysBW(year + 1)];
    }, [weekStart]);

    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const getEmployeeColor = (employeeId) => {
        return employees.find(e => e.id === employeeId)?.color || '#64748b';
    };

    const shiftsForDay = (day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        return shifts
            .filter(s => s.date === dateStr)
            .sort((a, b) => a.start_time?.localeCompare(b.start_time))
            .map(s => ({ ...s, _color: getEmployeeColor(s.employee_id) }));
    };

    const navigateWeek = (dir) => {
        haptics.selection();
        const next = dir > 0 ? addWeeks(weekStart, 1) : subWeeks(weekStart, 1);
        setWeekStart(next);
        onWeekChange?.(next);
    };

    // Swipe to change week
    const handleContainerTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };
    const handleContainerTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 60) {
            navigateWeek(dx < 0 ? 1 : -1);
        }
        touchStartX.current = null;
    };

    const weekLabel = `${format(weekStart, 'd. MMM', { locale: de })} – ${format(addDays(weekStart, 6), 'd. MMM yyyy', { locale: de })}`;

    return (
        <div className="flex flex-col h-full">
            {/* Week nav header */}
            <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border sticky top-0 z-20">
                <button
                    onClick={() => navigateWeek(-1)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-accent active:bg-accent transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <div className="text-center">
                    <p className="text-sm font-bold text-foreground">{weekLabel}</p>
                    <button
                        onClick={() => { const ws = startOfWeek(new Date(), { weekStartsOn: 1 }); setWeekStart(ws); onWeekChange?.(ws); }}
                        className="text-[10px] text-primary hover:underline"
                    >
                        Heute
                    </button>
                </div>
                <button
                    onClick={() => navigateWeek(1)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-accent active:bg-accent transition-colors"
                >
                    <ChevronRight className="w-5 h-5 text-foreground" />
                </button>
            </div>

            {/* 7-column grid */}
            <div
                ref={containerRef}
                onTouchStart={handleContainerTouchStart}
                onTouchEnd={handleContainerTouchEnd}
                className="flex flex-1 overflow-x-auto"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {days.map((day, idx) => {
                    const isToday = isSameDay(day, new Date());
                    const dayShifts = shiftsForDay(day);
                    const holidayName = getHolidayName(day, holidays);

                    return (
                        <div
                            key={idx}
                            className={cn(
                                'flex flex-col border-r border-border last:border-r-0 flex-shrink-0',
                                'w-[calc(100vw/7)] min-w-[48px]'
                            )}
                        >
                            {/* Day header */}
                            <div className={cn(
                                'flex flex-col items-center py-1.5 border-b border-border sticky top-[48px] z-10 bg-card',
                                isToday && 'bg-amber-500/10'
                            )}>
                                <span className={cn(
                                    'text-[10px] font-semibold uppercase tracking-wide',
                                    isToday ? 'text-amber-400' : 'text-muted-foreground'
                                )}>
                                    {WEEKDAYS[idx]}
                                </span>
                                <div className={cn(
                                    'w-7 h-7 rounded-full flex items-center justify-center mt-0.5',
                                    isToday && 'bg-amber-500'
                                )}>
                                    <span className={cn(
                                        'text-sm font-bold',
                                        isToday ? 'text-white' : 'text-foreground'
                                    )}>
                                        {format(day, 'd')}
                                    </span>
                                </div>
                                {holidayName && (
                                    <div className="w-full bg-red-600/80 text-white text-[8px] text-center truncate px-0.5 py-0.5 mt-0.5">
                                        {holidayName.slice(0, 6)}
                                    </div>
                                )}
                            </div>

                            {/* Shifts column */}
                            <div className="flex-1 p-1 space-y-1 min-h-[80px]">
                                {isLoading ? (
                                    <ShiftSkeleton />
                                ) : dayShifts.length > 0 ? (
                                    dayShifts.map(shift => (
                                        <SwipeableShiftCard
                                            key={shift.id}
                                            shift={shift}
                                            canEdit={permissions.canEditShifts}
                                            onOpen={(s) => setBottomSheet({ type: 'detail', shift: s })}
                                            onDelete={onDeleteShift}
                                        />
                                    ))
                                ) : permissions.canEditShifts ? (
                                    <button
                                        onClick={() => { haptics.light(); onAddShift(day, null, null); }}
                                        className="w-full h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-accent/50 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <p className="text-[9px] text-muted-foreground/50 text-center pt-2">Frei</p>
                                )}
                            </div>

                            {/* Add button */}
                            {permissions.canEditShifts && (
                                <button
                                    onClick={() => { haptics.light(); onAddShift(day, null, null); }}
                                    className="w-full h-10 flex items-center justify-center border-t border-border text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bottom Sheet */}
            <ShiftBottomSheet
                shift={bottomSheet?.shift}
                open={!!bottomSheet}
                onClose={() => setBottomSheet(null)}
                onEdit={(shift) => { setBottomSheet(null); onSelectShift(shift); }}
                onDelete={(id) => { setBottomSheet(null); onDeleteShift(id); }}
                canEdit={permissions.canEditShifts}
            />
        </div>
    );
}