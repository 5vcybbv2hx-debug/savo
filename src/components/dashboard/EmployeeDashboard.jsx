import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isFuture, isToday, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Calendar, Clock, CheckSquare, CheckCircle2, Users, Sparkles, BookOpen, Wine,
    LogIn, LogOut, Umbrella, GraduationCap, AlertCircle, Pause, MapPin, Briefcase,
    Clock3, Coffee, Euro
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from 'sonner';
import { queueMutation } from '@/components/utils/offlineSync';
import { calcTotalBreakMinutes, calcLegalBreak } from '@/lib/timeTrackingHelpers';
import TodayOverview from '@/components/dashboard/TodayOverview';
import FirstStepsTour from '@/components/onboarding/FirstStepsTour';
import { InteractiveTour, useTour } from '@/components/onboarding/InteractiveTour';
import ShiftSwapMarketplaceCard from '@/components/shifts/ShiftSwapMarketplaceCard';
import TimeTrackingWidget from '@/components/dashboard/TimeTrackingWidget';
import PendingSwapRequestsCard from '@/components/shifts/PendingSwapRequestsCard';

export default function EmployeeDashboard({ currentEmployee, isManager, onSwitchToManager }) {
    const queryClient = useQueryClient();
    const [showOnboardingTour, setShowOnboardingTour] = useState(false);
    const [shiftSummary, setShiftSummary] = useState(null);
    const { showTour, completeTour, skipTour } = useTour();
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: shifts = [] } = useQuery({
        queryKey: ['shifts'],
        queryFn: () => base44.entities.Shift.filter(
            { employee_id: currentEmployee.id },
            'date', 100
        ),
        enabled: !!currentEmployee?.id,
        staleTime: STALE.SLOW,
    });
    const { data: timeEntries = [] } = useQuery({
        queryKey: ['time-entries', currentEmployee?.id],
        queryFn: () => base44.entities.TimeEntry.filter({ employee_id: currentEmployee.id }, '-date', 100),
        enabled: !!currentEmployee?.id,
        staleTime: STALE.SLOW
    });
    const { data: clockEntries = [] } = useQuery({
        queryKey: ['clock-entries', currentEmployee?.id],
        queryFn: () => base44.entities.ClockEntry.filter({ employee_id: currentEmployee.id }, '-clock_in', 50),
        enabled: !!currentEmployee?.id,
        staleTime: STALE.FAST
    });
    const { data: events = [] } = useQuery({
        queryKey: ['events'],
        queryFn: () => base44.entities.Event.list('-date', 30),
        staleTime: STALE.SLOW,
    });
    const { data: reservations = [] } = useQuery({
        queryKey: ['reservations', 'active'],
        queryFn: () => base44.entities.Reservation.filter({ is_archived: false }, '-date', 100),
        staleTime: STALE.MEDIUM,
    });
    const { data: todos = [] } = useQuery({
        queryKey: ['todos'],
        queryFn: () => base44.entities.TodoItem.filter({ is_archived: false }, '-created_date', 100),
        staleTime: STALE.SLOW,
    });
    const { data: cleaningTasks = [] } = useQuery({
        queryKey: ['cleaning-tasks'],
        queryFn: () => base44.entities.CleaningTask.filter({ is_active: true }, 'area', 100),
        staleTime: STALE.SLOW,
    });
    const { data: vacationRequests = [] } = useQuery({
        queryKey: ['vacation-requests'],
        queryFn: () => base44.entities.VacationRequest.list('-created_date', 50),
        staleTime: STALE.SLOW,
    });
    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: STALE.SLOW,
    });
    const { data: onboardingItems = [] } = useQuery({
        queryKey: ['onboarding-items', currentEmployee?.id],
        queryFn: () => base44.entities.OnboardingChecklistItem.filter({ employee_id: currentEmployee.id }),
        enabled: !!currentEmployee?.id,
        initialData: []
    });

    // ⚠️ Stempeluhr MUSS auch bei WLAN-Ausfall im Laden funktionieren —
    // Ein-/Ausstempeln darf nie an einem Netzwerk-Haenger scheitern. Diese
    // Mutationen sind bewusst 1:1 mit TimeTracking.jsx synchron gehalten
    // (gleiche Pausen-Array-Logik, gleiche Verdienst-Berechnung), damit es
    // keinen Unterschied macht, ob ein Mitarbeiter hier auf dem Dashboard
    // oder auf der TimeTracking-Seite stempelt.
    const applyClockEntryUpdate = async (entryId, data) => {
        if (!navigator.onLine) {
            await queueMutation({ entityName: 'ClockEntry', type: 'update', id: entryId, data });
        } else {
            try {
                await base44.entities.ClockEntry.update(entryId, data);
            } catch (err) {
                await queueMutation({ entityName: 'ClockEntry', type: 'update', id: entryId, data });
            }
        }
        queryClient.setQueryData(['clock-entries', currentEmployee?.id], (old = []) =>
            old.map(e => e.id === entryId ? { ...e, ...data } : e)
        );
    };

    const clockInMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                employee_id: currentEmployee.id,
                employee_name: currentEmployee.name,
                clock_in: new Date().toISOString(),
                status: 'clocked_in',
                breaks: [],
            };
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'ClockEntry', type: 'create', data: payload });
                return { offline: true };
            }
            try {
                await base44.entities.ClockEntry.create(payload);
                return { offline: false };
            } catch (err) {
                await queueMutation({ entityName: 'ClockEntry', type: 'create', data: payload });
                return { offline: true };
            }
        },
        onSuccess: ({ offline }) => {
            queryClient.invalidateQueries({ queryKey: ['clock-entries'] });
            if (offline) toast.success('Eingestempelt (offline) ⚡ — wird synchronisiert sobald wieder online');
        }
    });

    const pauseMutation = useMutation({
        mutationFn: async (entryId) => {
            const entry = clockEntries.find(e => e.id === entryId);
            const currentBreaks = entry.breaks || [];
            const onBreak = entry.status === 'on_break';
            const updatedBreaks = onBreak
                ? currentBreaks.map((b, i, arr) => (i === arr.length - 1 && !b.end) ? { ...b, end: new Date().toISOString() } : b)
                : [...currentBreaks, { start: new Date().toISOString(), end: null }];
            await applyClockEntryUpdate(entryId, {
                status: onBreak ? 'clocked_in' : 'on_break',
                breaks: updatedBreaks,
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clock-entries'] })
    });

    const clockOutMutation = useMutation({
        mutationFn: async (entryId) => {
            const entry = clockEntries.find(e => e.id === entryId);
            if (!entry) return null;
            const clockOutTime = new Date();
            const totalMinutes = differenceInMinutes(clockOutTime, new Date(entry.clock_in));
            const actualBreakMinutes = calcTotalBreakMinutes(entry.breaks);
            const breakMinutes = Math.max(actualBreakMinutes, calcLegalBreak(totalMinutes));
            const workedMinutes = totalMinutes - breakMinutes;
            const workedHours = (workedMinutes / 60).toFixed(2);
            const hourlyRate = currentEmployee?.hourly_rate;
            const earned = hourlyRate ? (workedHours * hourlyRate).toFixed(2) : null;

            const clockEntryUpdate = {
                clock_out: clockOutTime.toISOString(),
                status: 'clocked_out',
                total_minutes: workedMinutes,
                break_minutes: breakMinutes,
                breaks: entry.breaks,
            };
            const timeEntryPayload = {
                employee_id: entry.employee_id,
                employee_name: entry.employee_name,
                date: format(new Date(entry.clock_in), 'yyyy-MM-dd'),
                start_time: format(new Date(entry.clock_in), 'HH:mm'),
                end_time: format(clockOutTime, 'HH:mm'),
                break_minutes: breakMinutes,
                total_hours: parseFloat(workedHours),
                notes: 'Automatisch von Stempeluhr übertragen',
                status: 'eingereicht'
            };

            let offline = !navigator.onLine;
            if (!offline) {
                try {
                    await base44.entities.ClockEntry.update(entryId, clockEntryUpdate);
                    await base44.entities.TimeEntry.create(timeEntryPayload);
                } catch (err) {
                    offline = true;
                }
            }
            if (offline) {
                await queueMutation({ entityName: 'ClockEntry', type: 'update', id: entryId, data: clockEntryUpdate });
                await queueMutation({ entityName: 'TimeEntry', type: 'create', data: timeEntryPayload });
            }

            return { workedHours, breakMinutes, earned, hourlyRate, offline,
                clockIn: format(new Date(entry.clock_in), 'HH:mm'),
                clockOut: format(clockOutTime, 'HH:mm') };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['clock-entries'] });
            queryClient.invalidateQueries({ queryKey: ['time-entries'] });
            if (result) {
                if (result.offline) toast.success('Ausgestempelt (offline) ⚡ — wird synchronisiert sobald wieder online');
                setShiftSummary(result);
            }
        }
    });

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    const todayShifts = shifts.filter(s => s.date === today);
    const todayEvents = events.filter(e => e.date === today && e.status !== 'abgesagt');
    const todayReservations = reservations.filter(r => r.date === today && r.status !== 'storniert');

    const myUpcomingShifts = shifts
        .filter(s => s.employee_id === currentEmployee.id && s.date >= today)
        .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return (a.start_time || '').localeCompare(b.start_time || '');
        })
        .slice(0, 5);

    const weekEntries = timeEntries.filter(e => {
        if (e.employee_id !== currentEmployee.id) return false;
        const d = parseISO(e.date);
        return d >= weekStart && d <= weekEnd;
    });
    const hoursThisWeek = weekEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);

    const monthEntries = timeEntries.filter(e => {
        if (e.employee_id !== currentEmployee.id) return false;
        const d = parseISO(e.date);
        return d >= monthStart && d <= monthEnd;
    });
    const hoursThisMonth = monthEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);

    const approvedVacations = vacationRequests.filter(v => v.employee_id === currentEmployee.id && v.status === 'genehmigt' && v.type === 'Urlaub');
    const usedVacationDays = approvedVacations.reduce((sum, v) => sum + (v.days_count || 0), 0);
    const remainingVacationDays = (currentEmployee.vacation_days_per_year || 0) - usedVacationDays;

    const activeClockEntry = (() => {
        const e = clockEntries.find(e => e.employee_id === currentEmployee.id && (e.status === 'clocked_in' || e.status === 'on_break'));
        // war zuvor nur 'clocked_in' — Mitarbeiter in Pause fielen sonst komplett
        // aus der aktiven Stempelung raus (Buttons verschwanden waehrend der Pause)
        if (!e) return undefined;
        return { ...e, breaks: Array.isArray(e.breaks) ? e.breaks : [] };
    })();

    // Stationsplan
    const { data: todayPlans = [] } = useQuery({
        queryKey: ['stationsplan-today', today],
        queryFn: () => base44.entities.Stationsplan.filter({ date: today })
    });
    const publishedPlan = todayPlans.find(p => p.status === 'published');
    const { data: myStationAssignment } = useQuery({
        queryKey: ['my-station', publishedPlan?.id, currentEmployee.id],
        queryFn: () => base44.entities.StationAssignment.filter({ stationsplan_id: publishedPlan.id, employee_id: currentEmployee.id }),
        enabled: !!publishedPlan?.id,
        select: data => data[0] || null
    });

    const myOpenTodos = todos.filter(
        t => (t.assigned_to === currentEmployee.email || t.assigned_to === currentEmployee.name) && t.status !== 'erledigt'
    );

    const myCleaningTasks = cleaningTasks.filter(t => !t.is_completed && t.is_active);

    const dayOfWeek = new Date().getDay();
    const cycleStart = new Date(2025, 0, 6);
    const weeksDiff = Math.floor((new Date() - cycleStart) / (7 * 24 * 60 * 60 * 1000));
    const biweeklyPattern = (() => {
        const w = weeksDiff % 2;
        if (dayOfWeek === 3) return w === 0 ? 'mi_1' : 'mi_2';
        if (dayOfWeek === 4) return w === 0 ? 'do_1' : 'do_2';
        return null;
    })();
    const biweeklyTasks = biweeklyPattern ? cleaningTasks.filter(t => t.biweekly_pattern === biweeklyPattern && t.is_active) : [];

    const onboardingProgress = onboardingItems.length > 0
        ? Math.round((onboardingItems.filter(i => i.is_completed).length / onboardingItems.length) * 100)
        : 100;

    const getWorkingDuration = (clockIn) => {
        const minutes = differenceInMinutes(new Date(), new Date(clockIn));
        return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    };

    return (
        <div className="min-h-screen bg-background p-3 sm:p-8 pb-24 md:pb-0">
            <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-foreground">Willkommen, {currentEmployee.name}!</h1>
                        <p className="text-muted-foreground text-sm">{format(new Date(), 'EEEE, dd. MMMM yyyy', { locale: de })}</p>
                    </div>
                    <div className="flex gap-2">
                        {isManager && (
                            <Button size="sm" onClick={onSwitchToManager} className="bg-amber-500 hover:bg-amber-600">
                                Manager-Ansicht
                            </Button>
                        )}
                        {onboardingProgress < 100 && (
                            <Button onClick={() => setShowOnboardingTour(true)} size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 gap-2">
                                <GraduationCap className="w-4 h-4" />
                                Erste Schritte
                            </Button>
                        )}
                    </div>
                </div>

                {onboardingProgress < 100 && (
                    <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                                <GraduationCap className="w-6 h-6 text-foreground" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-foreground">Einarbeitung läuft</p>
                                <p className="text-sm text-amber-300">{onboardingProgress}% abgeschlossen</p>
                            </div>
                            <Button onClick={() => setShowOnboardingTour(true)} variant="outline" size="sm" className="border-amber-500 text-amber-400 hover:bg-amber-500/10">
                                Fortsetzen
                            </Button>
                        </div>
                    </Card>
                )}

                {/* Meine Station heute */}
                {publishedPlan && myStationAssignment && (myStationAssignment.area || myStationAssignment.role) && (
                    <Card className="p-5 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                                <MapPin className="w-6 h-6 text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-0.5">Meine Station heute</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    {myStationAssignment.area && (
                                        <Badge className="bg-amber-500/20 text-amber-300 text-sm font-bold">{myStationAssignment.area}</Badge>
                                    )}
                                    {myStationAssignment.role && (
                                        <span className="flex items-center gap-1 text-sm text-foreground">
                                            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                                            {myStationAssignment.role}
                                        </span>
                                    )}
                                    {myStationAssignment.secondary_role && (
                                        <span className="text-xs text-muted-foreground">+ {myStationAssignment.secondary_role}</span>
                                    )}
                                </div>
                                {myStationAssignment.note && (
                                    <p className="text-xs text-muted-foreground mt-1">{myStationAssignment.note}</p>
                                )}
                            </div>
                        </div>
                    </Card>
                )}

                {/* Clock In/Out */}
                <Card className="p-6 bg-card border-border">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center text-foreground font-bold text-2xl"
                            style={{ backgroundColor: currentEmployee.color || '#64748b' }}>
                            {currentEmployee.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            {activeClockEntry ? (
                                activeClockEntry.status === 'on_break' ? (
                                    <>
                                        <p className="text-foreground font-semibold">In Pause</p>
                                        <p className="text-amber-400 text-sm">Seit {format(new Date(activeClockEntry.clock_in), 'HH:mm')} • {getWorkingDuration(activeClockEntry.clock_in)}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-foreground font-semibold">Eingestempelt</p>
                                        <p className="text-green-400 text-sm">Seit {format(new Date(activeClockEntry.clock_in), 'HH:mm')} • {getWorkingDuration(activeClockEntry.clock_in)}</p>
                                    </>
                                )
                            ) : (
                                <>
                                    <p className="text-foreground font-semibold">Nicht eingestempelt</p>
                                    <p className="text-muted-foreground text-sm">Bereit zum Einstempeln</p>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        {activeClockEntry ? (
                            <>
                                <Button onClick={() => pauseMutation.mutate(activeClockEntry.id)} disabled={pauseMutation.isPending} className="bg-amber-600 hover:bg-amber-700 gap-2">
                                    <Pause className="w-4 h-4" /> {activeClockEntry.status === 'on_break' ? 'Pause beenden' : 'Pause'}
                                </Button>
                                <Button onClick={() => clockOutMutation.mutate(activeClockEntry.id)} disabled={clockOutMutation.isPending} className="flex-1 bg-red-600 hover:bg-red-700 gap-2">
                                    <LogOut className="w-4 h-4" /> Ausstempeln
                                </Button>
                            </>
                        ) : (
                            <Button onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700 gap-2">
                                <LogIn className="w-4 h-4" /> Einstempeln
                            </Button>
                        )}
                        <Link to={createPageUrl('TerminalClock')} className="flex-1">
                            <Button variant="outline" className="w-full">Details</Button>
                        </Link>
                    </div>
                </Card>

                {/* Quick Links */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { page: 'Calendar', color: 'bg-blue-600/20', iconColor: 'text-blue-500', icon: Calendar, sub: 'Kalender', label: 'Schichten' },
                        { page: 'Recipes', color: 'bg-pink-600/20', iconColor: 'text-pink-500', icon: Wine, sub: 'Rezepte', label: 'Nachschlagen' },
                        { page: 'Cleaning', color: 'bg-teal-600/20', iconColor: 'text-teal-500', icon: Sparkles, sub: 'Putzen', label: `${myCleaningTasks.length} offen` },
                        { page: 'DrinkMenu', color: 'bg-amber-600/20', iconColor: 'text-amber-500', icon: BookOpen, sub: 'Getränke', label: 'Karte' },
                    ].map(({ page, color, iconColor, icon: Icon, sub, label }) => (
                        <Link key={page + sub} to={createPageUrl(page)}>
                            <Card className="p-4 bg-card border-border hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
                                        <Icon className={`w-6 h-6 ${iconColor}`} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">{sub}</p>
                                        <p className="font-semibold text-foreground">{label}</p>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>

                {/* Stats */}
                <div className="grid sm:grid-cols-3 gap-6">

                    <Card className="p-6 bg-card border-border">
                        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-pink-500" />
                            Spezielle Putzaufgaben heute
                        </h3>
                        <div className="space-y-2">
                            {biweeklyTasks.map(task => (
                                <Link key={task.id} to={createPageUrl('Cleaning')}>
                                    <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg hover:bg-accent/50 transition-colors">
                                        <input type="checkbox" checked={task.is_completed} onChange={() => {}} className="w-4 h-4 rounded" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-foreground font-medium text-sm truncate">{task.title}</p>
                                            <p className="text-xs text-muted-foreground">{task.area}</p>
                                        </div>
                                        {task.is_completed && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </Card>
                </div>

                <PendingSwapRequestsCard currentEmployee={currentEmployee} />

                <TimeTrackingWidget currentEmployee={currentEmployee} />

                <ShiftSwapMarketplaceCard currentEmployee={currentEmployee} />

                <TodayOverview shifts={todayShifts} events={todayEvents} reservations={todayReservations} employees={employees} maxItems={3} />

                {/* Upcoming Shifts & Todos */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-blue-500" />
                                Kommende Schichten
                            </h2>
                            <Link to={createPageUrl('Calendar')}>
                                <Button variant="outline" size="sm" className="border-border text-muted-foreground">Alle</Button>
                            </Link>
                        </div>
                        {myUpcomingShifts.length === 0 ? (
                            <Card className="p-8 text-center bg-card border-border">
                                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground">Keine kommenden Schichten</p>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {myUpcomingShifts.slice(0, 3).map(shift => (
                                    <Card key={shift.id} className="p-4 bg-card border-border">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className="text-center">
                                                    <p className="text-2xl font-bold text-foreground">{format(parseISO(shift.date), 'dd')}</p>
                                                    <p className="text-xs text-muted-foreground uppercase">{format(parseISO(shift.date), 'MMM', { locale: de })}</p>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-semibold text-foreground">{format(parseISO(shift.date), 'EEEE', { locale: de })}</p>
                                                    <p className="text-sm text-muted-foreground">{shift.start_time} - {shift.end_time}</p>
                                                    {shift.notes && <p className="text-xs text-muted-foreground mt-1">{shift.notes}</p>}
                                                    {(() => {
                                                       const colleagues = shifts
                                                           .filter(s => s.date === shift.date && s.employee_id !== currentEmployee.id && s.employee_name)
                                                           .map(s => s.employee_name);
                                                       const unique = [...new Set(colleagues)];
                                                       return unique.length > 0 ? (
                                                           <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                                               <Users className="w-3 h-3 text-muted-foreground shrink-0" />
                                                               <p className="text-xs text-muted-foreground">{unique.join(', ')}</p>
                                                           </div>
                                                       ) : null;
                                                    })()}
                                                    </div>
                                                    </div>
                                                    <Badge className="bg-amber-600/20 text-amber-400">{shift.shift_type || 'Schicht'}</Badge>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <CheckSquare className="w-5 h-5 text-orange-500" />
                                Meine Aufgaben
                            </h2>
                            <Link to={createPageUrl('Todos')}>
                                <Button variant="outline" size="sm" className="border-border text-muted-foreground">Alle</Button>
                            </Link>
                        </div>
                        {myOpenTodos.length === 0 ? (
                            <Card className="p-8 text-center bg-card border-border">
                                <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
                                <p className="text-muted-foreground">Keine offenen Aufgaben</p>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {myOpenTodos.slice(0, 3).map(todo => (
                                    <Card key={todo.id} className="p-4 bg-card border-border">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <p className="font-semibold text-foreground">{todo.title}</p>
                                                {todo.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{todo.description}</p>}
                                                {todo.due_date && <p className="text-xs text-muted-foreground mt-2">Fällig: {format(parseISO(todo.due_date), 'dd.MM.yyyy', { locale: de })}</p>}
                                            </div>
                                            <Badge className={
                                                todo.priority === 'dringend' ? 'bg-red-600/20 text-red-400' :
                                                todo.priority === 'hoch' ? 'bg-orange-600/20 text-orange-400' :
                                                'bg-secondary text-muted-foreground'
                                            }>{todo.priority}</Badge>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Schnellaktionen */}
                <Card className="p-4 bg-card border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Schnellaktionen</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { page: 'Todos', icon: CheckSquare, color: 'text-orange-500', label: 'Neue Aufgabe' },
                            { page: 'Cleaning', icon: Sparkles, color: 'text-teal-500', label: 'Putzen' },
                            { page: 'Recipes', icon: BookOpen, color: 'text-pink-500', label: 'Rezept suchen' },
                            { page: 'Calendar', icon: Calendar, color: 'text-blue-500', label: 'Schichtplan' },
                        ].map(({ page, icon: Icon, color, label }) => (
                            <Link key={label} to={createPageUrl(page)}>
                                <button className="w-full flex flex-col items-center gap-2 p-3 rounded-lg bg-background/50 hover:bg-accent/50 transition-colors">
                                    <Icon className={`w-5 h-5 ${color}`} />
                                    <span className="text-xs font-medium text-foreground">{label}</span>
                                </button>
                            </Link>
                        ))}
                    </div>
                </Card>
            </div>

            {showOnboardingTour && (
                <FirstStepsTour employee={currentEmployee} open={showOnboardingTour} onClose={() => setShowOnboardingTour(false)} />
            )}
            {showTour && (
                <InteractiveTour onComplete={completeTour} onSkip={skipTour} />
            )}

            {/* ── Schicht-Zusammenfassung nach dem Ausstempeln ────────────────── */}
            <Sheet open={!!shiftSummary} onOpenChange={open => { if (!open) setShiftSummary(null); }}>
                <SheetContent side="bottom" className="rounded-t-2xl pb-10 px-6 pt-6">
                    {shiftSummary && (
                        <div className="space-y-5">
                            <div className="text-center space-y-1">
                                <div className="text-4xl">✅</div>
                                <h2 className="text-xl font-bold text-foreground">Schicht beendet</h2>
                                <p className="text-sm text-muted-foreground">{shiftSummary.clockIn} – {shiftSummary.clockOut} Uhr</p>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-muted rounded-xl p-4 text-center space-y-1">
                                    <Clock3 className="w-5 h-5 mx-auto text-blue-500" />
                                    <p className="text-2xl font-bold text-foreground">{shiftSummary.workedHours}h</p>
                                    <p className="text-xs text-muted-foreground">Gearbeitet</p>
                                </div>
                                <div className="bg-muted rounded-xl p-4 text-center space-y-1">
                                    <Coffee className="w-5 h-5 mx-auto text-amber-500" />
                                    <p className="text-2xl font-bold text-foreground">{shiftSummary.breakMinutes} Min</p>
                                    <p className="text-xs text-muted-foreground">Pause</p>
                                </div>
                                {shiftSummary.earned && (
                                    <div className="bg-emerald-500/10 rounded-xl p-4 text-center space-y-1 col-span-2">
                                        <Euro className="w-5 h-5 mx-auto text-emerald-500" />
                                        <p className="text-3xl font-bold text-emerald-500">{shiftSummary.earned} €</p>
                                        <p className="text-xs text-muted-foreground">Verdient ({shiftSummary.hourlyRate} €/h)</p>
                                    </div>
                                )}
                            </div>
                            <Button className="w-full" onClick={() => setShiftSummary(null)}>Schließen</Button>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}