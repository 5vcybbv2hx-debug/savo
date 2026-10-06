/**
 * MyShifts — Meine Schichten
 * 3 Tabs: Diese Woche · Monat · Team
 * Kalender-Sync im ··· Menü (kein eigener Tab)
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Clock, ChevronLeft, ChevronRight, Users, CalendarDays,
    MoreVertical, Calendar, RepeatIcon
} from 'lucide-react';
import ShiftSwapSection from '@/components/shifts/ShiftSwapSection';
import ShiftSwapRequestModal from '@/components/shifts/ShiftSwapRequestModal';
import {
    format, startOfWeek, endOfWeek, addDays, startOfMonth, endOfMonth,
    isSameDay, parseISO, isAfter, isBefore, addMonths, subMonths
} from 'date-fns';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import MyShiftsCalendarSync from '@/components/calendar/MyShiftsCalendarSync';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function shiftDurationMinutes(start_time, end_time) {
    if (!start_time || !end_time) return 0;
    const [sh, sm] = start_time.split(':').map(Number);
    const [eh, em] = end_time.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
    let startMin = sh * 60 + sm;
    let endMin   = eh * 60 + em;
    if (endMin <= startMin) endMin += 24 * 60;
    return endMin - startMin;
}
function shiftDurationHours(start_time, end_time) {
    return (shiftDurationMinutes(start_time, end_time) / 60).toFixed(1);
}

// ── Nächste Schicht Hero ──────────────────────────────────────────────────────
function NextShiftHero({ shifts }) {
    const today    = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    const next = useMemo(() =>
        [...shifts]
            .filter(s => s.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))[0] || null
    , [shifts, todayStr]);

    if (!next) return (
        <div className="rounded-2xl p-5 border border-border bg-card text-center">
            <p className="text-sm text-muted-foreground">Keine kommenden Schichten</p>
        </div>
    );

    const shiftDate  = parseISO(next.date);
    const isToday    = isSameDay(shiftDate, today);
    const isTomorrow = isSameDay(shiftDate, addDays(today, 1));
    const hours      = shiftDurationHours(next.start_time, next.end_time);
    const label      = isToday ? 'Heute' : isTomorrow ? 'Morgen' : format(shiftDate, 'EEEE, dd. MMM', { locale: de });

    return (
        <div className={cn(
            'rounded-2xl p-5 border',
            isToday ? 'bg-amber-500/10 border-amber-500/40' : 'bg-card border-border'
        )}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                {isToday ? '⚡ Nächste Schicht — Heute' : 'Nächste Schicht'}
            </p>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className={cn('text-2xl font-bold', isToday ? 'text-amber-400' : 'text-foreground')}>
                        {label}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {next.start_time} – {next.end_time}
                        <span className="ml-2 text-xs opacity-60">({hours} Std.)</span>
                    </p>
                    {next.shift_type && (
                        <Badge variant="outline" className="mt-2 text-xs">{next.shift_type}</Badge>
                    )}
                </div>
                <div className={cn(
                    'w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0',
                    isToday ? 'bg-amber-500 text-slate-900' : 'bg-secondary text-foreground'

                )}>
                    <span className="text-[10px] font-semibold">{format(shiftDate, 'MMM', { locale: de })}</span>
                    <span className="text-2xl font-bold leading-none">{format(shiftDate, 'd')}</span>
                </div>
            </div>
        </div>
    );
}

// ── Schicht-Zeile ─────────────────────────────────────────────────────────────
function ShiftRow({ shift, highlight = false, onSwap }) {
    const hours = shiftDurationHours(shift.start_time, shift.end_time);
    return (
        <div className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
            highlight ? 'border-amber-500/30 bg-amber-500/8' : 'border-border bg-card'
        )}>
            <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                highlight ? 'bg-amber-500 text-slate-900' : 'bg-secondary text-muted-foreground'

            )}>
                <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                    {shift.start_time} – {shift.end_time}
                </p>
                <p className="text-xs text-muted-foreground">
                    {hours} Std.{shift.shift_type ? ` · ${shift.shift_type}` : ''}
                    {shift.notes ? ` · ${shift.notes}` : ''}
                </p>
            </div>
            {onSwap && (
                <button
                    onClick={(e) => { e.stopPropagation(); onSwap(shift); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/25 hover:bg-amber-500/25 transition-all text-xs font-semibold shrink-0 min-h-[32px]"
                >
                    <RepeatIcon className="w-3.5 h-3.5" />
                    Tauschen
                </button>
            )}
        </div>
    );
}

// ── Tab: Diese Woche ──────────────────────────────────────────────────────────
function WeekTab({ shifts, onSwap }) {
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const today = new Date();

    const weekDays = useMemo(() =>
        Array.from({ length: 7 }, (_, i) => {
            const date      = addDays(weekStart, i);
            const dayShifts = shifts.filter(s => isSameDay(parseISO(s.date), date));
            return { date, shifts: dayShifts };
        }), [weekStart, shifts]
    );

    const weekHours = weekDays.reduce((sum, { shifts: ds }) =>
        sum + ds.reduce((s, sh) => s + shiftDurationMinutes(sh.start_time, sh.end_time), 0), 0
    );

    return (
        <div className="space-y-3">
            {/* Wochennavigation */}
            <div className="flex items-center justify-between">
                <button onClick={() => setWeekStart(d => addDays(d, -7))}
                    className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-90">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-center">
                    <p className="text-sm font-bold text-foreground">
                        {format(weekStart, 'dd. MMM', { locale: de })} – {format(addDays(weekStart, 6), 'dd. MMM', { locale: de })}
                    </p>
                    {weekHours > 0 && (
                        <p className="text-xs text-muted-foreground">{(weekHours / 60).toFixed(1)} Std. diese Woche</p>
                    )}
                </div>
                <button onClick={() => setWeekStart(d => addDays(d, 7))}
                    className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-90">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Tage */}
            <div className="space-y-1.5">
                {weekDays.map(({ date, shifts: dayShifts }) => {
                    const isToday = isSameDay(date, today);
                    const isFree  = dayShifts.length === 0;

                    return (
                        <div key={date.toISOString()}
                            className={cn(
                                'rounded-xl border overflow-hidden',
                                isToday ? 'border-amber-500/40' : 'border-border/50',
                                isFree && !isToday && 'opacity-40'
                            )}>
                            {/* Tag-Header */}
                            <div className={cn(
                                'flex items-center justify-between px-3 py-2',
                                isToday ? 'bg-amber-500/10' : 'bg-secondary/30'
                            )}>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        'text-sm font-bold',
                                        isToday ? 'text-amber-400' : 'text-foreground'
                                    )}>
                                        {format(date, 'EEE', { locale: de })}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {format(date, 'dd.MM.')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isToday && <Badge className="bg-amber-500 text-slate-900 text-[10px] px-1.5 py-0 h-4">Heute</Badge>}
                                    {isFree && <span className="text-[10px] text-muted-foreground/50">Frei</span>}
                                    {dayShifts.length > 0 && (
                                        <span className="text-[10px] text-muted-foreground">
                                            {dayShifts.reduce((s, sh) => s + shiftDurationMinutes(sh.start_time, sh.end_time), 0) / 60 | 0}h
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Schichten */}
                            {dayShifts.length > 0 && (
                                <div className="p-2 space-y-1.5 bg-background">
                                    {dayShifts.map(shift => (
                                        <ShiftRow key={shift.id} shift={shift} highlight={isToday} onSwap={onSwap} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Tab: Monat ────────────────────────────────────────────────────────────────
function MonthTab({ shifts, onSwap }) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const today = new Date();

    const monthStats = useMemo(() => {
        const start = startOfMonth(selectedDate);
        const end   = endOfMonth(selectedDate);
        const monthShifts = shifts.filter(s => {
            const d = parseISO(s.date);
            return (isAfter(d, start) || isSameDay(d, start)) && (isBefore(d, end) || isSameDay(d, end));
        });
        const totalMinutes = monthShifts.reduce((acc, s) => acc + shiftDurationMinutes(s.start_time, s.end_time), 0);
        return { count: monthShifts.length, hours: (totalMinutes / 60).toFixed(1), shifts: monthShifts };
    }, [shifts, selectedDate]);

    const monthCalendar = useMemo(() => {
        const start     = startOfMonth(selectedDate);
        const end       = endOfMonth(selectedDate);
        const startWeek = startOfWeek(start, { weekStartsOn: 1 });
        const endWeek   = endOfWeek(end, { weekStartsOn: 1 });
        const days      = [];
        let cur         = startWeek;
        while (cur <= endWeek) {
            days.push({
                date:           cur,
                shifts:         shifts.filter(s => isSameDay(parseISO(s.date), cur)),
                isCurrentMonth: cur >= start && cur <= end,
            });
            cur = addDays(cur, 1);
        }
        return days;
    }, [shifts, selectedDate]);

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-foreground">{monthStats.count}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Schichten</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-foreground">{monthStats.hours}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Stunden</p>
                </div>
            </div>

            {/* Monatsnavigation */}
            <div className="flex items-center justify-between">
                <button onClick={() => setSelectedDate(d => subMonths(d, 1))}
                    className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-90">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base font-bold text-foreground">
                    {format(selectedDate, 'MMMM yyyy', { locale: de })}
                </h2>
                <button onClick={() => setSelectedDate(d => addMonths(d, 1))}
                    className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-90">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Kalender-Grid */}
            <div className="bg-card border border-border rounded-2xl p-3">
                <div className="grid grid-cols-7 mb-1">
                    {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
                        <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-1.5">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {monthCalendar.map(({ date, shifts: ds, isCurrentMonth }) => {
                        const isToday   = isSameDay(date, today);
                        const hasShifts = ds.length > 0;
                        return (
                            <div key={date.toISOString()}
                                className={cn(
                                    'aspect-square rounded-lg flex flex-col items-center justify-center relative',
                                    !isCurrentMonth && 'opacity-20',
                                    isToday && 'bg-amber-500',
                                    !isToday && hasShifts && 'bg-amber-500/15 border border-amber-500/30',
                                    !isToday && !hasShifts && 'bg-transparent'
                                )}>
                                <span className={cn(
                                    'text-xs font-semibold',
                                    isToday ? 'text-slate-900' : 'text-foreground'
                                )}>
                                    {format(date, 'd')}
                                </span>
                                {hasShifts && !isToday && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-0.5" />
                                )}
                                {hasShifts && isToday && (
                                    <span className="text-[9px] font-bold text-slate-900/70">{ds.length}×</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Schicht-Liste des Monats */}
            {monthStats.shifts.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-0.5">
                        Schichten im {format(selectedDate, 'MMMM', { locale: de })}
                    </p>
                    {monthStats.shifts
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map(shift => {
                            const d       = parseISO(shift.date);
                            const isToday = isSameDay(d, today);
                            return (
                                <div key={shift.id}
                                    className={cn(
                                        'flex items-center gap-3 p-3 rounded-xl border',
                                        isToday ? 'border-amber-500/30 bg-amber-500/8' : 'border-border bg-card'
                                    )}>
                                    <div className={cn(
                                        'w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0',
                                        isToday ? 'bg-amber-500' : 'bg-secondary'
                                    )}>
                                        <span className={cn('text-[10px] font-semibold', isToday ? 'text-slate-900' : 'text-muted-foreground')}>
                                {format(d, 'EEE', { locale: de })}
                            </span>
                            <span className={cn('text-sm font-bold', isToday ? 'text-slate-900' : 'text-foreground')}>

                                            {format(d, 'd')}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground">
                                            {shift.start_time} – {shift.end_time}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {shiftDurationHours(shift.start_time, shift.end_time)} Std.
                                            {shift.shift_type && ` · ${shift.shift_type}`}
                                        </p>
                                    </div>
                                    {onSwap && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onSwap(shift); }}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/25 hover:bg-amber-500/25 transition-all text-xs font-semibold shrink-0 min-h-[32px]"
                                        >
                                            <RepeatIcon className="w-3.5 h-3.5" />
                                            Tauschen
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}

// ── Tab: Team ─────────────────────────────────────────────────────────────────
function TeamTab({ myEmployeeId }) {
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const today = new Date();

    const from = format(weekStart, 'yyyy-MM-dd');
    const to   = format(addDays(weekStart, 6), 'yyyy-MM-dd');

    const { data: weekTeam = [] } = useQuery({
        queryKey: ['team-week', from, to],
        // ⚠️ War aufsteigend sortiert mit Limit 200 — bei >200 vergangenen
        // Schichten fiel die aktuelle/zukuenftige Woche komplett raus.
        queryFn: () => import('@/lib/adaptiveFetch').then(({ fetchUntilDateCovered }) =>
            fetchUntilDateCovered((limit) => base44.entities.Shift.list('-date', limit), from, to)
        ),
        staleTime: 2 * 60 * 1000,
    });

    const teamDays = useMemo(() =>
        Array.from({ length: 7 }, (_, i) => {
            const date    = addDays(weekStart, i);
            const dateStr = format(date, 'yyyy-MM-dd');
            return { date, dateStr, shifts: weekTeam.filter(s => s.date === dateStr) };
        }), [weekStart, weekTeam]
    );

    return (
        <div className="space-y-3">
            {/* Wochennavigation */}
            <div className="flex items-center justify-between">
                <button onClick={() => setWeekStart(d => addDays(d, -7))}
                    className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-90">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-bold text-foreground">
                    {format(weekStart, 'dd. MMM', { locale: de })} – {format(addDays(weekStart, 6), 'dd. MMM', { locale: de })}
                </p>
                <button onClick={() => setWeekStart(d => addDays(d, 7))}
                    className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-90">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {teamDays.map(({ date, dateStr, shifts: dayShifts }) => {
                const isToday = isSameDay(date, today);
                return (
                    <div key={dateStr}
                        className={cn(
                            'rounded-xl border overflow-hidden',
                            isToday ? 'border-amber-500/40' : 'border-border/50',
                            dayShifts.length === 0 && 'opacity-40'
                        )}>
                        {/* Header */}
                        <div className={cn(
                            'flex items-center justify-between px-3 py-2',
                            isToday ? 'bg-amber-500/10' : 'bg-secondary/30'
                        )}>
                            <div className="flex items-center gap-2">
                                <span className={cn('text-sm font-bold', isToday ? 'text-amber-400' : 'text-foreground')}>
                                    {format(date, 'EEE', { locale: de })}
                                </span>
                                <span className="text-xs text-muted-foreground">{format(date, 'dd.MM.')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {isToday && <Badge className="bg-amber-500 text-slate-900 text-[10px] px-1.5 py-0 h-4">Heute</Badge>}
                                <span className="text-[10px] text-muted-foreground">
                                    {dayShifts.length > 0 ? `${dayShifts.length} Schichten` : 'Niemand'}
                                </span>
                            </div>
                        </div>

                        {/* Team-Einträge */}
                        {dayShifts.length > 0 && (
                            <div className="p-2 space-y-1.5 bg-background">
                                {dayShifts.map(shift => {
                                    const isMe = shift.employee_id === myEmployeeId;
                                    return (
                                        <div key={shift.id}
                                            className={cn(
                                                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg',
                                                isMe ? 'bg-amber-500/10 border border-amber-500/25' : 'bg-secondary/40'
                                            )}>
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
                                                <span className="text-slate-900 font-bold text-[10px]">

                                                    {shift.employee_name?.charAt(0)?.toUpperCase() || '?'}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={cn('text-xs font-semibold truncate', isMe ? 'text-amber-400' : 'text-foreground')}>
                                                    {shift.employee_name}{isMe && ' (Du)'}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {shift.start_time} – {shift.end_time}
                                                    {shift.shift_type && ` · ${shift.shift_type}`}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function MyShiftsPage() {
    const { data: employee } = useCurrentEmployee();
    const [syncOpen, setSyncOpen] = useState(false);
    const [swapShift, setSwapShift] = useState(null);
    const [swapModalOpen, setSwapModalOpen] = useState(false);

    const handleSwapShift = (shift) => {
        setSwapShift(shift);
        setSwapModalOpen(true);
    };

    const { data: shifts = [], isLoading } = useQuery({
        queryKey: ['my-shifts', employee?.id],
        queryFn: async () => {
            if (!employee) return [];
            const all  = await base44.entities.Shift.filter({ employee_id: employee.id }, 'date', 500);
            const from = format(subMonths(new Date(), 2), 'yyyy-MM-dd');
            const to   = format(addMonths(new Date(), 4), 'yyyy-MM-dd');
            return all.filter(s => s.date >= from && s.date <= to);
        },
        enabled: !!employee,
        staleTime: STALE.MEDIUM,
    });

    if (!employee) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-center text-muted-foreground space-y-2">
                <CalendarDays className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm">Kein Mitarbeiterprofil verknüpft</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">

                {/* ── Header ────────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Meine Schichten</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">{employee.name}</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSyncOpen(true)}
                        className="gap-1.5 min-h-[44px] text-xs"
                    >
                        <Calendar className="w-4 h-4 text-amber-500" />
                        <span>Kalender</span>
                    </Button>
                </div>

                {/* ── Nächste Schicht Hero ──────────────────────────────── */}
                {isLoading ? (
                    <div className="rounded-2xl bg-card border border-border p-5 animate-pulse h-24" />
                ) : (
                    <NextShiftHero shifts={shifts} />
                )}

                {/* ── Tabs ──────────────────────────────────────────────── */}
                <Tabs defaultValue="week">
                    <TabsList className="grid grid-cols-3 w-full bg-secondary/50 border border-border/50">
                        <TabsTrigger value="week"
                            className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 text-xs">
                            Diese Woche
                        </TabsTrigger>
                        <TabsTrigger value="month"
                            className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 text-xs">
                            Monat
                        </TabsTrigger>
                        <TabsTrigger value="team"
                            className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 text-xs">
                            Team
                        </TabsTrigger>
                    </TabsList>

                    <div className="mt-4">
                        <TabsContent value="week">
                            <WeekTab shifts={shifts} onSwap={handleSwapShift} />
                        </TabsContent>
                        <TabsContent value="month">
                            <MonthTab shifts={shifts} onSwap={handleSwapShift} />
                        </TabsContent>
                        <TabsContent value="team">
                            <TeamTab myEmployeeId={employee.id} />
                        </TabsContent>
                    </div>
                </Tabs>

                {/* ── Tauschanfragen (aufklappbar) ─────────────────────── */}
                <ShiftSwapSection />
            </div>

            {/* ── Tauschanfrage Modal (von Schicht-Liste aus) ──────────────── */}
            {swapShift && (
                <ShiftSwapRequestModal
                    shift={swapShift}
                    open={swapModalOpen}
                    onOpenChange={setSwapModalOpen}
                    onSuccess={() => {
                        setSwapModalOpen(false);
                        setSwapShift(null);
                    }}
                />
            )}

            {/* ── Kalender-Sync Dialog ──────────────────────────────────── */}
            <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-amber-500" />
                            Kalender-Sync
                        </DialogTitle>
                    </DialogHeader>
                    <MyShiftsCalendarSync
                        employeeId={employee.id}
                        existingToken={employee.calendar_token}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}