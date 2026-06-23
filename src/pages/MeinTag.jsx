/**
 * MeinTag.jsx — Mitarbeiter-Tagesansicht (Mobile-First)
 * 
 * Zeigt jedem Mitarbeiter genau das, was heute relevant ist:
 * - Stempeluhr (Ein/Aus)
 * - Heutige Schicht
 * - Offene Aufgaben
 * - Reinigungsliste
 * - Auffüllliste
 * - Opening/Closing
 * - Eigene Dokumente
 */

import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInMinutes, parseISO, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { STALE } from '@/lib/queryUtils';
import { 
    LogIn, LogOut, Clock, CheckSquare, Brush, RefreshCw, 
    Calendar, ChevronRight, Play, Pause, Circle, CheckCircle2,
    Sun, Moon, Zap, AlertTriangle, User, FileText, ArrowRight, ListChecks
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/components/auth/usePermissions';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { isActiveEntry, calcWorkMinutes, formatDuration } from '@/lib/nightUtils';
import { getCalendarDayForDate, getSpecialDayLabel, getSpecialDayColor } from '@/lib/businessCalendarUtils';

// ── Live-Uhr Hook ──────────────────────────────────────────────────────────

function useLiveClock(intervalMs = 10000) {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return { text: 'Guten Morgen', icon: Sun };
    if (h < 18) return { text: 'Guten Tag', icon: Sun };
    return { text: 'Guten Abend', icon: Moon };
}

// ── Stempeluhr Widget ─────────────────────────────────────────────────────

function ClockWidget({ employee, clockEntries, onRefresh }) {
    const queryClient = useQueryClient();
    const now = useLiveClock(10000);
    const activeEntry = clockEntries.find(e => e.employee_id === employee?.id && isActiveEntry(e));
    const onBreak = activeEntry?.status === 'on_break';
    const [earningsData, setEarningsData] = React.useState(null);

    const clockInMutation = useMutation({
        mutationFn: () => {
            if (activeEntry) return Promise.resolve(activeEntry);
            return base44.entities.ClockEntry.create({
                employee_id: employee.id,
                employee_name: employee.name,
                clock_in: new Date().toISOString(),
                status: 'clocked_in',
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meinTag-clock'] }),
    });

    const clockOutMutation = useMutation({
        mutationFn: async () => {
            const now = new Date(); // fresh timestamp at click moment
            const totalMinutes = calcWorkMinutes(activeEntry.clock_in, now);
            const breakMinutes = totalMinutes > 9 * 60 ? 45 : totalMinutes > 6 * 60 ? 30 : 0;
            const workedMinutes = totalMinutes - breakMinutes;
            const totalHours = Math.round((workedMinutes / 60) * 100) / 100;
            const entryDate = format(new Date(activeEntry.clock_in), 'yyyy-MM-dd');
            const startTime = format(new Date(activeEntry.clock_in), 'HH:mm');

            await base44.entities.ClockEntry.update(activeEntry.id, {
                clock_out: now.toISOString(),
                break_minutes: breakMinutes,
                total_hours: totalHours,
                status: 'clocked_out',
            });
            await base44.entities.TimeEntry.create({
                employee_id: activeEntry.employee_id,
                employee_name: activeEntry.employee_name,
                date: entryDate,
                start_time: startTime,
                end_time: format(now, 'HH:mm'),
                break_minutes: breakMinutes,
                total_hours: totalHours,
                notes: `Stempeluhr — automatisch`,
                status: 'eingereicht',
                employee_confirmed: true,
                employee_confirmed_at: now.toISOString(),
            });

            // Verdienst Modal: nur bei Stundenlohn (nicht bei Monatsgehalt)
            const hasMonthly = employee?.monthly_salary && parseFloat(employee.monthly_salary) > 0;
            if (employee?.hourly_rate && !hasMonthly) {
                const earnings = Math.round(totalHours * employee.hourly_rate * 100) / 100;
                return {
                    name: employee.name,
                    hours: totalHours,
                    hourlyRate: employee.hourly_rate,
                    earnings,
                    breakMinutes,
                    clockIn: startTime,
                    clockOut: format(now, 'HH:mm'),
                };
            }
            return null;
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['meinTag-clock'] });
            queryClient.invalidateQueries({ queryKey: ['time-entries'] });
            if (result?.earnings != null) {
                setEarningsData(result);
            }
        },
    });

    const breakMutation = useMutation({
        mutationFn: () => base44.entities.ClockEntry.update(activeEntry.id, {
            status: onBreak ? 'clocked_in' : 'on_break',
            ...(onBreak ? { pause_end: new Date().toISOString() } : { pause_start: new Date().toISOString() }),
        }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meinTag-clock'] }),
    });

    const duration = activeEntry ? formatDuration(calcWorkMinutes(activeEntry.clock_in, now)) : null;

    return (
        <>
        <Card className={cn(
            'border-2 transition-all',
            activeEntry
                ? onBreak ? 'border-amber-500/50 bg-amber-500/5' : 'border-green-500/50 bg-green-500/5'
                : 'border-border bg-card'
        )}>
            <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                'w-3 h-3 rounded-full',
                                activeEntry ? onBreak ? 'bg-amber-400 animate-pulse' : 'bg-green-400 animate-pulse' : 'bg-muted-foreground'
                            )} />
                            <span className="font-semibold text-foreground">
                                {activeEntry ? onBreak ? 'Pause' : 'Eingestempelt' : 'Nicht eingestempelt'}
                            </span>
                        </div>
                        {activeEntry && (
                            <p className="text-sm text-muted-foreground mt-1">
                                Seit {format(new Date(activeEntry.clock_in), 'HH:mm')} · {duration}
                            </p>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-foreground tabular-nums">
                            {format(now, 'HH:mm')}
                        </p>
                        <p className="text-xs text-muted-foreground">{format(now, 'EEE, dd. MMM', { locale: de })}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {!activeEntry ? (
                        <Button
                            onClick={() => clockInMutation.mutate()}
                            disabled={clockInMutation.isPending}
                            className="flex-1 h-14 text-base gap-2 bg-green-600 hover:bg-green-700"
                        >
                            <LogIn className="w-5 h-5" />
                            Einstempeln
                        </Button>
                    ) : (
                        <>
                            <Button
                                onClick={() => breakMutation.mutate()}
                                disabled={breakMutation.isPending}
                                variant="outline"
                                className={cn('flex-1 h-14 text-base gap-2', onBreak ? 'border-green-500 text-green-400' : 'border-amber-500 text-amber-400')}
                            >
                                {onBreak ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                                {onBreak ? 'Weiter' : 'Pause'}
                            </Button>
                            <Button
                                onClick={() => clockOutMutation.mutate()}
                                disabled={clockOutMutation.isPending}
                                className="flex-1 h-14 text-base gap-2 bg-red-600 hover:bg-red-700"
                            >
                                <LogOut className="w-5 h-5" />
                                Ausstempeln
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>

        {/* Verdienst-Modal */}
        <Dialog open={!!earningsData} onOpenChange={(open) => { if (!open) setEarningsData(null); }}>
            <DialogContent className="sm:max-w-sm bg-card border-border text-foreground">
                <div className="space-y-5 pt-2">
                    <div className="text-center">
                        <p className="text-3xl mb-1">🎉</p>
                        <h2 className="text-xl font-bold text-foreground">Gut gemacht!</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {earningsData?.clockIn} – {earningsData?.clockOut} Uhr
                        </p>
                    </div>

                    {earningsData?.earnings != null && (
                        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-green-700 p-6 text-center">
                            <p className="text-5xl font-bold text-white mb-1">
                                {earningsData.earnings.toFixed(2)} €
                            </p>
                            <p className="text-green-100 text-sm">
                                {earningsData.hours.toFixed(2)}h × {earningsData.hourlyRate.toFixed(2)} €/h
                            </p>
                            {earningsData.breakMinutes > 0 && (
                                <p className="text-green-200 text-xs mt-1">
                                    inkl. {earningsData.breakMinutes} Min. Pause abgezogen
                                </p>
                            )}
                        </div>
                    )}

                    <p className="text-center text-sm text-muted-foreground">
                        Vielen Dank für deine Arbeit heute! 💪
                    </p>

                    <button
                        onClick={() => setEarningsData(null)}
                        className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors"
                    >
                        Okay, verstanden
                    </button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}

// ── Schicht Widget ────────────────────────────────────────────────────────

function ShiftWidget({ employee, shifts }) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const myShift = shifts.find(s => s.employee_id === employee?.id && s.date === today);

    if (!myShift) return (
        <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                    <p className="text-sm font-medium text-foreground">Keine Schicht heute</p>
                    <p className="text-xs text-muted-foreground">Du bist heute nicht eingeplant</p>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Deine Schicht heute</p>
                    <p className="text-base font-bold text-blue-400">{myShift.start_time} – {myShift.end_time}</p>
                    {myShift.shift_type && <p className="text-xs text-muted-foreground">{myShift.shift_type}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

// ── Aufgaben Widget ───────────────────────────────────────────────────────

function TodosWidget({ employee }) {
    const queryClient = useQueryClient();
    const empName = employee?.name || '';

    const { data: todos = [] } = useQuery({
        queryKey: ['meinTag-todos', empName],
        queryFn: () => base44.entities.TodoItem.filter({ status: 'offen' }),
        enabled: !!employee,
    });

    const myTodos = todos.filter(t =>
        !t.is_archived &&
        (t.assigned_to === empName || (t.assigned_to_names || []).includes(empName))
    ).slice(0, 5);

    const doneMutation = useMutation({
        mutationFn: (id) => base44.entities.TodoItem.update(id, {
            status: 'erledigt',
            completed_by: empName,
            completed_at: new Date().toISOString(),
        }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meinTag-todos'] }),
    });

    if (myTodos.length === 0) return null;

    return (
        <section>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-orange-400" />
                    Meine Aufgaben ({myTodos.length})
                </h3>
                <Link to={createPageUrl('Todos')} className="text-xs text-muted-foreground flex items-center gap-1">
                    Alle <ArrowRight className="w-3 h-3" />
                </Link>
            </div>
            <div className="space-y-2">
                {myTodos.map((t, tIdx) => (
                    <Card key={t.id} style={{ '--delay': `${tIdx * 40}ms` }} className={cn(
                        'border transition-all animate-stagger',
                        t.priority === 'dringend' ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-card'
                    )}>
                        <CardContent className="p-3 flex items-center gap-3">
                            <button
                                onClick={() => doneMutation.mutate(t.id)}
                                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full border-2 border-muted-foreground hover:border-green-500 hover:bg-green-500/10 transition-all"
                            >
                                <Circle className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                                {t.priority === 'dringend' && (
                                    <p className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                                        <Zap className="w-3 h-3" /> Dringend
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    );
}

// ── Reinigung Widget ──────────────────────────────────────────────────────

function CleaningWidget({ employee }) {
    const queryClient = useQueryClient();
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: tasks = [] } = useQuery({
        queryKey: ['meinTag-cleaning'],
        queryFn: () => base44.entities.CleaningTask.filter({ is_active: true }),
        enabled: !!employee,
    });

    const todayTasks = tasks.filter(t =>
        !t.is_completed ||
        (t.last_reset && t.last_reset !== today)
    ).filter(t => {
        if (t.frequency === 'täglich') return true;
        const weekday = format(new Date(), 'EEEE', { locale: de });
        if (t.due_weekdays && t.due_weekdays.length > 0) return t.due_weekdays.includes(weekday);
        return false;
    }).slice(0, 6);

    const doneMutation = useMutation({
        mutationFn: (id) => base44.entities.CleaningTask.update(id, {
            is_completed: true,
            completed_by: employee?.name,
            completed_at: new Date().toISOString(),
            last_reset: today,
        }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meinTag-cleaning'] }),
    });

    if (todayTasks.length === 0) return null;

    const doneCount = todayTasks.filter(t => t.is_completed && t.last_reset === today).length;

    return (
        <section>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                    <Brush className="w-4 h-4 text-teal-400" />
                    Putzliste ({doneCount}/{todayTasks.length})
                </h3>
                <Link to={createPageUrl('Cleaning')} className="text-xs text-muted-foreground flex items-center gap-1">
                    Alle <ArrowRight className="w-3 h-3" />
                </Link>
            </div>
            <div className="space-y-2">
                {todayTasks.map(t => {
                    const done = t.is_completed && t.last_reset === today;
                    return (
                        <Card key={t.id} className={cn('border', done ? 'border-green-500/20 bg-green-500/5 opacity-60' : 'border-border bg-card')}>
                            <CardContent className="p-3 flex items-center gap-3">
                                <button
                                    onClick={() => !done && doneMutation.mutate(t.id)}
                                    className={cn(
                                        'shrink-0 w-7 h-7 flex items-center justify-center rounded-full border-2 transition-all',
                                        done ? 'border-green-500 bg-green-500/20' : 'border-muted-foreground hover:border-teal-500'
                                    )}
                                >
                                    {done
                                        ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                                        : <Circle className="w-4 h-4 text-muted-foreground" />
                                    }
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className={cn('text-sm font-medium truncate', done ? 'line-through text-muted-foreground' : 'text-foreground')}>
                                        {t.title}
                                    </p>
                                    {t.area && <p className="text-xs text-muted-foreground">{t.area}</p>}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
}

// ── Auffüll Widget ────────────────────────────────────────────────────────

function RestockWidget({ employee }) {
    const { data: items = [] } = useQuery({
        queryKey: ['meinTag-restock'],
        queryFn: () => base44.entities.RestockItem.filter({ status: 'offen' }),
        enabled: !!employee,
    });

    if (items.length === 0) return null;

    return (
        <Link to={createPageUrl('Restock')}>
            <Card className="border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all">
                <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-600/20 flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">Auffüllliste</p>
                        <p className="text-xs text-amber-400">{items.length} offene Positionen</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
            </Card>
        </Link>
    );
}

// ── Zeiterfassung Übersicht ───────────────────────────────────────────────

function TimeOverview({ employee }) {
    const { data: entries = [] } = useQuery({
        queryKey: ['meinTag-time'],
        queryFn: () => base44.entities.TimeEntry.list('-date', 50),
        enabled: !!employee,
    });

    const today = format(new Date(), 'yyyy-MM-dd');
    const myEntries = entries.filter(e => e.employee_id === employee?.id);
    const todayHours = myEntries.filter(e => e.date === today).reduce((s, e) => s + (e.total_hours || 0), 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekHours = myEntries.filter(e => new Date(e.date) >= weekStart).reduce((s, e) => s + (e.total_hours || 0), 0);

    return (
        <Link to={createPageUrl('TimeManagement')}>
            <Card className="border-border bg-card hover:bg-accent/30 transition-all">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-400" />
                            Meine Stunden
                        </p>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-2 bg-secondary/50 rounded-lg">
                            <p className="text-xl font-bold text-foreground">{todayHours.toFixed(1)}h</p>
                            <p className="text-xs text-muted-foreground">Heute</p>
                        </div>
                        <div className="text-center p-2 bg-secondary/50 rounded-lg">
                            <p className="text-xl font-bold text-foreground">{weekHours.toFixed(1)}h</p>
                            <p className="text-xs text-muted-foreground">Diese Woche</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

// ── Schnellzugriffe ───────────────────────────────────────────────────────

function QuickActions({ permissions }) {
    const actions = [
        permissions.canViewShifts && { page: 'Calendar',        icon: Calendar,   label: 'Schichten',  color: 'bg-blue-600'   },
        permissions.canViewTodos  && { page: 'OperativeListen', icon: Zap,        label: 'Listen',     color: 'bg-primary'    },
        permissions.canViewTodos  && { page: 'Todos',           icon: CheckSquare,label: 'Aufgaben',   color: 'bg-orange-600' },
        permissions.canViewCleaning && { page: 'Cleaning',      icon: Brush,      label: 'Putzliste',  color: 'bg-teal-600'   },
    ].filter(Boolean);

    if (actions.length === 0) return null;

    return (
        <div className="grid grid-cols-4 gap-2">
            {actions.map((a, aIdx) => (
                <Link key={a.page} to={createPageUrl(a.page)}>
                    <div style={{ '--delay': `${aIdx * 40}ms` }} className="flex flex-col items-center gap-1.5 p-3 animate-stagger rounded-xl bg-card border border-border hover:bg-accent/30 active:scale-95 transition-all">
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', a.color)}>
                            <a.icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[10px] font-medium text-foreground text-center leading-tight">{a.label}</span>
                    </div>
                </Link>
            ))}
        </div>
    );
}

// ── MAIN ──────────────────────────────────────────────────────────────────

export default function MeinTag() {
    const permissions = usePermissions();
    const greeting = getGreeting();
    const GreetIcon = greeting.icon;

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me(),
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: STALE.SLOW,
    });

    const { data: clockEntries = [] } = useQuery({
        queryKey: ['meinTag-clock'],
        queryFn: () => base44.entities.ClockEntry.list('-clock_in', 100),
        refetchInterval: 60000,
        staleTime: 30000,
    });

    const { data: shifts = [] } = useQuery({
        queryKey: ['meinTag-shifts'],
        queryFn: () => base44.entities.Shift.list('-date', 100),
        staleTime: STALE.SLOW,
    });

    const { data: calendarDays = [] } = useQuery({
        queryKey: ['business-calendar'],
        queryFn: () => base44.entities.BusinessCalendarDay.list('-date', 100),
        staleTime: STALE.SLOW,
    });

    const employee = employees.find(e => e.email === user?.email);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const calendarEntry = getCalendarDayForDate(todayStr, calendarDays);
    const specialLabel = getSpecialDayLabel(calendarEntry);
    const specialColor = calendarEntry ? getSpecialDayColor(calendarEntry.day_type) : '';

    return (
        <div className="min-h-screen bg-background animate-page-enter pb-28 md:pb-8">
            <div className="max-w-xl mx-auto px-3 py-4 space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-muted-foreground mb-0.5">
                            <GreetIcon className="w-4 h-4" />
                            <span className="text-sm">{greeting.text}</span>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">
                            {employee?.name?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'Hey'}!
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {format(new Date(), "EEEE, d. MMMM", { locale: de })}
                        </p>
                    </div>
                    {employee && (
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: employee.color || '#64748b' }}
                        >
                            {employee.name?.charAt(0)}
                        </div>
                    )}
                </div>

                {/* Sondertag-Banner */}
                {calendarEntry && calendarEntry.day_type !== 'normal' && (
                    <Card className="border-amber-500/20 bg-amber-500/5">
                        <CardContent className="p-3 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-amber-300">
                                    Heute: {specialLabel}
                                    {calendarEntry.title ? ` — ${calendarEntry.title}` : ''}
                                </p>
                                {calendarEntry.opening_time_override && (
                                    <p className="text-xs text-amber-400/80">
                                        Öffnung: {calendarEntry.opening_time_override}{calendarEntry.closing_time_override ? ` – ${calendarEntry.closing_time_override}` : ''}
                                    </p>
                                )}
                            </div>
                            {calendarEntry.is_closed && (
                                <Badge className="text-[10px] bg-secondary text-foreground/80 border-0 shrink-0">Geschlossen</Badge>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Kein Mitarbeiterprofil */}
                {!employee && !permissions.isLoading && (
                    <Card className="border-amber-500/30 bg-amber-500/10 p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-amber-300">Kein Mitarbeiterprofil gefunden</p>
                                <p className="text-xs text-amber-400/80 mt-1">Bitte wende dich an deinen Manager, damit ein Profil für dich angelegt wird.</p>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Stempeluhr */}
                {employee && (
                    <ClockWidget employee={employee} clockEntries={clockEntries} />
                )}

                {/* Schicht heute */}
                {employee && <ShiftWidget employee={employee} shifts={shifts} />}

                {/* Schnellzugriffe */}
                <QuickActions permissions={permissions} />

                {/* Aufgaben */}
                {employee && permissions.canViewTodos && <TodosWidget employee={employee} />}

                {/* Putzliste */}
                {employee && permissions.canViewCleaning && <CleaningWidget employee={employee} />}

                {/* Auffüllen */}
                {employee && permissions.canViewRestock && <RestockWidget employee={employee} />}

                {/* Stunden */}
                {employee && permissions.canViewOwnTimeEntries && <TimeOverview employee={employee} />}

                {/* Profil Link */}
                <Link to={createPageUrl('MyArea')}>
                    <Card className="border-border bg-card hover:bg-accent/30 transition-all">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                                <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-foreground">Mein Bereich</p>
                                <p className="text-xs text-muted-foreground">Profil, Urlaub, Schichttausch</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </CardContent>
                    </Card>
                </Link>

            </div>
        </div>
    );
}