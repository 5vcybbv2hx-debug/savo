import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import UpcomingBirthdaysWidget from '@/components/dashboard/UpcomingBirthdaysWidget';
import TeamNotes from '@/components/dashboard/TeamNotes';
import ManagerDashboard from '@/components/dashboard/ManagerDashboard';
import AlarmPanel from '@/components/dashboard/AlarmPanel';
import ShiftSwapInboxCard from '@/components/shifts/ShiftSwapInboxCard';
import WhatsAppMessageGenerator from '@/components/employees/WhatsAppMessageGenerator';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { queueMutation } from '@/components/utils/offlineSync';
import {
    Clock, ArrowRight, CheckSquare, Check, Sparkles, CalendarCheck,
    Users, Calendar, LogIn, LogOut, Wrench, TrendingDown,
    ShoppingCart, FileText, Package, RefreshCw, AlertTriangle,
    ChevronRight, Timer, ShoppingBasket, Pause, Play, Coffee,
    Euro, Clock3
} from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    isActiveEntry, formatDuration, calcWorkMinutes
} from '@/lib/nightUtils';
import { calcTotalBreakMinutes, calcLegalBreak } from '@/lib/timeTrackingHelpers';
import { useDashboardData } from '@/hooks/useDashboardData';
import { STALE } from '@/lib/queryUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Guten Morgen';
    if (h < 17) return 'Guten Tag';
    if (h < 21) return 'Guten Abend';
    return 'Nachtschicht';
}

function getOperationPhase() {
    const h = new Date().getHours();
    if (h >= 6  && h < 11) return { label: 'Vorbereitung',  color: 'text-amber-400',          bg: 'bg-amber-500/10 border-amber-500/30' };
    if (h >= 11 && h < 15) return { label: 'Mittagsbetrieb',color: 'text-green-400',           bg: 'bg-green-500/10 border-green-500/30' };
    if (h >= 15 && h < 18) return { label: 'Ruhephase',     color: 'text-blue-400',            bg: 'bg-blue-500/10 border-blue-500/30' };
    if (h >= 18 && h < 23) return { label: 'Abendbetrieb',  color: 'text-purple-400',          bg: 'bg-purple-500/10 border-purple-500/30' };
    return                         { label: 'Nachtschicht',  color: 'text-muted-foreground',    bg: 'bg-secondary/50 border-border/50' };
}

// ── Stempeluhr-Karte (erste Priorität) ───────────────────────────────────────

function ClockCard({ currentEmployee }) {
    const queryClient = useQueryClient();
    const [elapsed, setElapsed] = React.useState('');
    const [shiftSummary, setShiftSummary] = useState(null);

    const { data: clockEntries = [] } = useQuery({
        queryKey: ['clock-entries', currentEmployee?.id],
        queryFn: () => base44.entities.ClockEntry.filter({ employee_id: currentEmployee.id }, '-clock_in', 10),
        enabled: !!currentEmployee?.id,
        refetchInterval: 60000,
        staleTime: 45000,
    });

    const active = clockEntries.find(e => isActiveEntry(e));

    React.useEffect(() => {
        if (!active) { setElapsed(''); return; }
        const tick = () => setElapsed(formatDuration(calcWorkMinutes(active.clock_in, new Date())));
        tick();
        const id = setInterval(tick, 60000);
        return () => clearInterval(id);
    }, [active?.clock_in]);

    const clockInMutation = useMutation({
        mutationFn: async () => {
            if (clockEntries.find(e => isActiveEntry(e))) return { skipped: true };
            const payload = {
                employee_id:   currentEmployee.id,
                employee_name: currentEmployee.name,
                clock_in:      new Date().toISOString(),
                status:        'clocked_in',
            };
            // ⚠️ Einstempeln darf nie an einem WLAN-Aussetzer scheitern (gleiche Absicherung wie TimeTracking.jsx).
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'ClockEntry', type: 'create', data: payload });
                return { entry: { ...payload, id: `offline-${Date.now()}`, _offline: true }, offline: true };
            }
            try {
                const created = await base44.entities.ClockEntry.create(payload);
                return { entry: created, offline: false };
            } catch (err) {
                await queueMutation({ entityName: 'ClockEntry', type: 'create', data: payload });
                return { entry: { ...payload, id: `offline-${Date.now()}`, _offline: true }, offline: true };
            }
        },
        onSuccess: (result) => {
            if (!result || result.skipped) return;
            if (result.offline) {
                queryClient.setQueryData(['clock-entries', currentEmployee?.id], (old = []) => [...old, result.entry]);
                toast.success('Eingestempelt (offline) ⚡ — wird synchronisiert sobald wieder online');
            } else {
                queryClient.invalidateQueries({ queryKey: ['clock-entries'] });
            }
        },
    });

    const clockOutMutation = useMutation({
        mutationFn: async (entryId) => {
            const entry = clockEntries.find(e => e.id === entryId);
            if (!entry) throw new Error('ClockEntry nicht gefunden');
            const now = new Date();
            const totalMinutes = calcWorkMinutes(entry.clock_in, now);
            const actualBreakMinutes = calcTotalBreakMinutes(entry?.breaks || []);
            const legalBreak = calcLegalBreak(totalMinutes);
            const breakMinutes = Math.max(actualBreakMinutes, legalBreak);
            const workedHours = Math.round(((totalMinutes - breakMinutes) / 60) * 100) / 100;
            const hourlyRate = currentEmployee?.hourly_rate;
            const earned = hourlyRate ? (workedHours * hourlyRate).toFixed(2) : null;

            const clockEntryUpdate = {
                clock_out: now.toISOString(), break_minutes: breakMinutes,
                total_hours: workedHours, status: 'clocked_out',
                breaks: entry.breaks || [],
            };
            const timeEntryPayload = {
                employee_id: entry.employee_id, employee_name: entry.employee_name,
                date:       format(new Date(entry.clock_in), 'yyyy-MM-dd'),
                start_time: format(new Date(entry.clock_in), 'HH:mm'),
                end_time:   format(now, 'HH:mm'),
                break_minutes: breakMinutes, total_hours: workedHours,
                notes: `Automatisch · Stempeluhr${breakMinutes > 0 ? ` · ${breakMinutes} Min. Pause` : ''}`,
                status: 'eingereicht', employee_confirmed: true,
                employee_confirmed_at: now.toISOString(),
            };

            // ⚠️ Ausstempeln ist lohnrelevant — bei WLAN-Ausfall in die Sync-Queue statt zu verlieren.
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

            const breakDetails = (entry.breaks || []).map(b => ({
                start: format(new Date(b.start), 'HH:mm'),
                end: b.end ? format(new Date(b.end), 'HH:mm') : null,
                minutes: b.end
                    ? differenceInMinutes(new Date(b.end), new Date(b.start))
                    : differenceInMinutes(now, new Date(b.start)),
            }));

            return {
                entryId, clockEntryUpdate, offline,
                summary: {
                    workedHours, breakMinutes, earned, hourlyRate,
                    clockIn: format(new Date(entry.clock_in), 'HH:mm'),
                    clockOut: format(now, 'HH:mm'),
                    breakDetails,
                },
            };
        },
        onSuccess: (result) => {
            if (!result) return;
            const { entryId, clockEntryUpdate, offline, summary } = result;
            if (offline) {
                queryClient.setQueryData(['clock-entries', currentEmployee?.id], (old = []) => old.map(e => e.id === entryId ? { ...e, ...clockEntryUpdate } : e));
                toast.success('Ausgestempelt (offline) ⚡ — wird synchronisiert sobald wieder online');
            } else {
                queryClient.invalidateQueries({ queryKey: ['clock-entries'] });
                queryClient.invalidateQueries({ queryKey: ['time-entries'] });
                queryClient.invalidateQueries({ queryKey: ['time-entries-dashboard'] });
            }
            setShiftSummary(summary);
        },
    });

    if (!currentEmployee) return null;

    const isOnBreak = active?.status === 'on_break';
    const openBreak = isOnBreak ? (active.breaks || []).find(b => b && b.start && !b.end) : null;

    const handleStartBreak = async () => {
        const currentBreaks = active.breaks || [];
        await base44.entities.ClockEntry.update(active.id, {
            status: 'on_break',
            breaks: [...currentBreaks, { start: new Date().toISOString(), end: null }],
        });
        queryClient.invalidateQueries({ queryKey: ['clock-entries'] });
    };

    const handleEndBreak = async () => {
        const updatedBreaks = (active.breaks || []).filter(b => b && b.start).map((b, i, arr) =>
            i === arr.length - 1 && !b.end ? { ...b, end: new Date().toISOString() } : b
        );
        await base44.entities.ClockEntry.update(active.id, {
            status: 'clocked_in',
            breaks: updatedBreaks,
        });
        queryClient.invalidateQueries({ queryKey: ['clock-entries'] });
    };

    const completedBreaks = (active?.breaks || []).filter(b => b && b.start && b.end);
    const totalBreakMin = calcTotalBreakMinutes(active?.breaks);

    return (
        <>
        <Card className={cn(
            'border transition-colors',
            isOnBreak ? 'border-amber-500/40 bg-amber-500/5' : active ? 'border-green-500/40 bg-green-500/5' : 'border-border bg-card'
        )}>
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm"
                        style={{ backgroundColor: currentEmployee.color || '#64748b' }}>
                        {currentEmployee.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                        {active ? (
                            <>
                                <div className="flex items-center gap-1.5">
                                    <span className={cn('w-2 h-2 rounded-full animate-pulse', isOnBreak ? 'bg-amber-400' : 'bg-green-400')} />
                                    <p className={cn('text-sm font-semibold', isOnBreak ? 'text-amber-400' : 'text-green-400')}>
                                        {isOnBreak ? 'Pause' : 'Eingestempelt'}
                                    </p>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {isOnBreak && openBreak
                                        ? `Pause seit ${format(new Date(openBreak.start), 'HH:mm')}`
                                        : `Seit ${format(new Date(active.clock_in), 'HH:mm')}${elapsed ? ` · ${elapsed}` : ''}`}
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-semibold text-foreground">Nicht eingestempelt</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{currentEmployee.name}</p>
                            </>
                        )}
                    </div>
                    {/* Buttons */}
                    {!active ? (
                        <Button size="sm"
                            onClick={() => clockInMutation.mutate()}
                            disabled={clockInMutation.isPending}
                            className="h-10 px-4 bg-green-600 hover:bg-green-700 text-white gap-1.5 shrink-0">
                            <LogIn className="w-4 h-4" />Ein
                        </Button>
                    ) : isOnBreak ? (
                        <Button size="sm"
                            onClick={handleEndBreak}
                            className="h-10 px-4 bg-green-600 hover:bg-green-700 text-white gap-1.5 shrink-0">
                            <Play className="w-4 h-4" />Beenden
                        </Button>
                    ) : (
                        <div className="flex gap-2 shrink-0">
                            <Button size="sm" variant="outline"
                                onClick={handleStartBreak}
                                className="h-10 px-3 border-amber-500/50 text-amber-500 hover:bg-amber-500/10 gap-1.5">
                                <Pause className="w-4 h-4" />Pause
                            </Button>
                            <Button size="sm"
                                onClick={() => clockOutMutation.mutate(active.id)}
                                disabled={clockOutMutation.isPending}
                                className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white gap-1.5">
                                <LogOut className="w-4 h-4" />Aus
                            </Button>
                        </div>
                    )}
                </div>

                {/* Pause-Verlauf */}
                {completedBreaks.length > 0 && (
                    <div className="pt-2 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
                        <Coffee className="w-3 h-3 shrink-0" />
                        <span>{completedBreaks.length} Pause{completedBreaks.length > 1 ? 'n' : ''}</span>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="font-medium">{totalBreakMin} Min gesamt</span>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* Zahltag: Schicht-Zusammenfassung nach dem Ausstempeln — muss sichtbar sein! */}
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
                        {shiftSummary.breakDetails?.length > 0 && (
                            <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
                                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <Coffee className="w-3 h-3" />
                                    Pausen im Detail:
                                </p>
                                {shiftSummary.breakDetails.map((b, i) => (
                                    <div key={i} className="flex justify-between text-xs text-muted-foreground">
                                        <span>{b.start} – {b.end || 'laufend'} Uhr</span>
                                        <span className="font-medium">{b.minutes} Min</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Button className="w-full" onClick={() => setShiftSummary(null)}>Schließen</Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>
        </>
    );
}

// ── Schnell-Kachel ────────────────────────────────────────────────────────────

function QuickTile({ page, icon: Icon, label, badge, badgeVariant = 'primary' }) {
    const variants = {
        primary:     'bg-primary/15 text-primary',
        warning:     'bg-amber-500/15 text-amber-400',
        danger:      'bg-destructive/15 text-destructive',
    };
    return (
        <Link to={createPageUrl(page)}>
            <Card className="bg-card border-border hover:bg-accent/40 active:scale-95 transition-all h-full">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2 relative">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
                    {badge != null && badge > 0 && (
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', variants[badgeVariant])}>
                            {badge}
                        </span>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ label, to, linkLabel = 'Alle' }) {
    return (
        <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
            {to && (
                <Link to={createPageUrl(to)} className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                    {linkLabel} <ChevronRight className="w-3 h-3" />
                </Link>
            )}
        </div>
    );
}

// ── Tab: HEUTE ────────────────────────────────────────────────────────────────


function TodoWidget({ todos }) {
    const queryClient = useQueryClient();
    const [completing, setCompleting] = React.useState(new Set());

    const completeMutation = useMutation({
        mutationFn: ({ id }) => base44.entities.TodoItem.update(id, { status: 'erledigt' }),
        onMutate: async ({ id }) => {
            setCompleting(prev => new Set([...prev, id]));
            // Optimistisch aus der Liste entfernen
            await queryClient.cancelQueries({ queryKey: ['todos'] });
            const prev = queryClient.getQueryData(['todos']);
            queryClient.setQueryData(['todos'], old =>
                old?.map(t => t.id === id ? { ...t, status: 'erledigt' } : t) || old
            );
            return { prev };
        },
        onError: (_, __, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(['todos'], ctx.prev);
        },
        onSettled: (_, __, { id }) => {
            setCompleting(prev => { const n = new Set(prev); n.delete(id); return n; });
            queryClient.invalidateQueries({ queryKey: ['todos'] });
        },
    });

    const visible = todos.slice(0, 5);

    return (
        <div>
            <SectionHeader label={`Meine Aufgaben (${todos.length})`} to="Todos" />
            <div className="space-y-2">
                {visible.map(t => {
                    const done = completing.has(t.id);
                    return (
                        <Card key={t.id} className={`border-border transition-all duration-300 ${done ? 'opacity-40 scale-[0.98]' : 'bg-card hover:bg-accent/20'}`}>
                            <CardContent className="p-3 flex items-center gap-3">
                                {/* Checkbox */}
                                <button
                                    onClick={() => !done && completeMutation.mutate({ id: t.id })}
                                    disabled={done}
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                        done
                                            ? 'bg-primary border-primary'
                                            : 'border-border hover:border-primary hover:bg-primary/10'
                                    }`}
                                    title="Als erledigt markieren"
                                >
                                    {done && <Check className="w-3 h-3 text-primary-foreground" />}
                                </button>
                                {/* Titel */}
                                <p className={`text-sm flex-1 truncate ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {t.title}
                                </p>
                                {/* Badge */}
                                {t.priority === 'dringend' && !done && (
                                    <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] shrink-0">Dringend</Badge>
                                )}
                                {/* Zur Todo-Seite */}
                                <Link to={createPageUrl('Todos')} onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-foreground shrink-0">
                                    <ChevronRight className="w-4 h-4" />
                                </Link>
                            </CardContent>
                        </Card>
                    );
                })}
                {todos.length > 5 && (
                    <Link to={createPageUrl('Todos')} className="flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground">
                        +{todos.length - 5} weitere <ChevronRight className="w-3 h-3" />
                    </Link>
                )}
            </div>
        </div>
    );
}

function TodayTab({ currentUser, currentEmployee, permissions, employees, todayEvents, todayReservations, todayShifts, myTodos, isManager, lowStockCount, openOrdersCount, openQuickListCount, openRestockCount }) {

    const myShift = todayShifts.find(s => s.employee_id === currentEmployee?.id);
    const birthdaysToday = employees.filter(e => e.birthday?.slice(5) === format(new Date(), 'MM-dd'));

    return (
        <div className="space-y-5">

            {/* Unterschrift Banner */}
            {currentEmployee && !currentEmployee.sig_employee && (
                <Link to={createPageUrl('Employees') + `?employee=${currentEmployee.id}`}>
                    <Card className="bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15 transition-colors">
                        <CardContent className="p-3 flex items-center gap-3">
                            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                            <p className="text-sm font-medium text-blue-400 flex-1">Unterschrift erforderlich</p>
                            <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
                        </CardContent>
                    </Card>
                </Link>
            )}

            {/* Stempeluhr — erste Priorität */}
            {currentEmployee && <ClockCard currentEmployee={currentEmployee} />}

            {/* Meine Schicht */}
            {currentEmployee && (
                <div>
                    <SectionHeader label="Meine Schicht heute" to="Calendar" linkLabel="Schichtplan" />
                    {myShift ? (
                        <Card className="border-primary/20 bg-primary/5">
                            <CardContent className="p-3 flex items-center gap-3">
                                <Clock className="w-4 h-4 text-primary shrink-0" />
                                <p className="text-sm font-semibold text-foreground">
                                    {myShift.start_time} – {myShift.end_time} Uhr
                                </p>
                                {myShift.shift_type && (
                                    <Badge className="ml-auto text-[10px] bg-primary/15 text-primary border-primary/30">
                                        {myShift.shift_type}
                                    </Badge>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="bg-card border-border">
                            <CardContent className="p-3 text-center">
                                <p className="text-sm text-muted-foreground">Keine Schicht heute eingetragen</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Schichttausch-Posteingang */}
            {currentEmployee && <ShiftSwapInboxCard currentEmployee={currentEmployee} />}

            {/* Meine Aufgaben */}
            {myTodos.length > 0 && (
                <TodoWidget todos={myTodos} />
            )}

            {/* Schnellzugriff Waren & Lager — nur für Manager/Berechtigung */}
            {(permissions.canViewWarehouse || permissions.canViewShopping || permissions.canViewRestock) && (
                <div>
                    <SectionHeader label="Waren & Lager" to="Warehouse" linkLabel="Übersicht" />
                    <div className="grid grid-cols-3 gap-2">
                        {permissions.canViewRestock && (
                            <QuickTile page="Restock"   icon={RefreshCw}      label="Auffüllen"    badge={openRestockCount}  badgeVariant="warning" />
                        )}
                        {permissions.canViewShopping && (
                            <QuickTile page="Shopping"  icon={ShoppingCart}   label="Bestellungen" badge={openOrdersCount}   badgeVariant="primary" />
                        )}
                        {permissions.canViewShopping && (
                            <QuickTile page="QuickList" icon={ShoppingBasket} label="Einkaufsliste" badge={openQuickListCount} badgeVariant="primary" />
                        )}
                    </div>
                    {lowStockCount > 0 && (
                        <Link to={createPageUrl('Articles')}>
                            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg border border-amber-500/25 bg-amber-500/5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <p className="text-xs text-amber-400">{lowStockCount} Artikel unter Mindestbestand</p>
                                <ChevronRight className="w-3 h-3 text-amber-400 ml-auto shrink-0" />
                            </div>
                        </Link>
                    )}
                </div>
            )}

            {/* Geburtstage */}
            {employees.some(e => { if (!e.birthday) return false; const [,m,d] = e.birthday.split('-'); const next = new Date(new Date().getFullYear(), parseInt(m)-1, parseInt(d)); if (next < new Date(new Date().setHours(0,0,0,0))) next.setFullYear(next.getFullYear()+1); return Math.round((next - new Date(new Date().setHours(0,0,0,0))) / 86400000) <= 7; }) && (
                <UpcomingBirthdaysWidget employees={employees} />
            )}

            {/* Events heute */}
            {todayEvents.length > 0 && (
                <div>
                    <SectionHeader label="Events heute" to="Events" />
                    {todayEvents.map(e => (
                        <Card key={e.id} className="border-purple-500/30 bg-purple-500/5 mb-2">
                            <CardContent className="p-3">
                                <p className="text-sm font-semibold text-foreground">{e.title}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    {e.start_time && <span>{e.start_time}</span>}
                                    {e.expected_guests && <span>{e.expected_guests} Gäste</span>}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Reservierungen */}
            {todayReservations.length > 0 && (
                <div>
                    <SectionHeader label={`Reservierungen (${todayReservations.length})`} to="GuestHub" linkLabel="GuestHub" />
                    <div className="space-y-2">
                        {todayReservations.slice(0, 3).map(r => (
                            <Card key={r.id} className="bg-card border-border">
                                <CardContent className="p-3 flex items-center gap-3">
                                    <CalendarCheck className="w-4 h-4 text-green-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{r.customer_name}</p>
                                        <p className="text-xs text-muted-foreground">{r.time} · {r.guests} Gäste</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Team heute */}
            <div>
                <SectionHeader label={`Team heute (${todayShifts.length})`} to="Calendar" linkLabel="Schichtplan" />
                {todayShifts.length === 0 ? (
                    <Card className="bg-card border-border">
                        <CardContent className="p-3 text-center">
                            <p className="text-sm text-muted-foreground">Keine Schichten heute</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {todayShifts.map(s => {
                            const emp = employees.find(e => e.id === s.employee_id);
                            const isMe = s.employee_id === currentEmployee?.id;
                            return (
                                <Card key={s.id} className={cn('border', isMe ? 'border-primary/30 bg-primary/5' : 'bg-card border-border')}>
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                                style={{ backgroundColor: s.color || emp?.color || '#64748b' }}>
                                                {s.employee_name?.charAt(0)}
                                            </div>
                                            <p className="text-xs font-medium text-foreground truncate">{s.employee_name}</p>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">{s.start_time}–{s.end_time}</p>
                                        {s.shift_type && <p className="text-[10px] text-primary mt-0.5">{s.shift_type}</p>}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Tab: TEAM ─────────────────────────────────────────────────────────────────

function TeamTab({ employees, todayShifts, currentUser, isManager }) {
    return (
        <div className="space-y-5">
            <TeamNotes isManager={isManager} currentUser={currentUser} />
            <div>
                <SectionHeader label={`Team heute (${todayShifts.length} Schichten)`} to="Calendar" />
                {todayShifts.length === 0 ? (
                    <Card className="p-4 text-center bg-card border-border">
                        <p className="text-sm text-muted-foreground">Keine Schichten heute</p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {todayShifts.map(s => {
                            const emp = employees.find(e => e.id === s.employee_id);
                            return (
                                <Card key={s.id} className="bg-card border-border">
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                                style={{ backgroundColor: s.color || emp?.color || '#64748b' }}>
                                                {s.employee_name?.charAt(0)}
                                            </div>
                                            <p className="text-xs font-medium text-foreground truncate">{s.employee_name}</p>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">{s.start_time}–{s.end_time}</p>
                                        {s.shift_type && <p className="text-[10px] text-primary mt-0.5">{s.shift_type}</p>}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

export default function SmartDashboard({ currentUser, currentEmployee, isManager, permissions }) {
    const [activeTab, setActiveTab] = useState('heute');
    const today = format(new Date(), 'yyyy-MM-dd');
    const phase = getOperationPhase();

    const {
        shifts, events, reservations, todos, employees, articles, shopping,
        maintenanceTasks, timeEntries, pendingTimeEntries, vacationRequests,
        todayShifts, todayEvents, todayReservations,
        openTodos, myTodos, myUpcomingShifts,
        hoursThisWeek, remainingVacationDays,
        lowStockArticles, pendingVacationRequests, urgentMaintenance,
    } = useDashboardData({ isManager, currentEmployee });

    // Waren & Lager Live-Badges
    const { data: openOrders = [] } = useQuery({
        queryKey: ['dashboard-orders'],
        queryFn: async () => {
            const [a, b] = await Promise.all([
                base44.entities.ShoppingList.filter({ status: 'offen' }),
                base44.entities.ShoppingList.filter({ status: 'bestellt' }),
            ]);
            return [...a, ...b];
        },
        staleTime: STALE.MEDIUM,
        refetchInterval: false,
        enabled: permissions.canViewShopping,
    });

    const { data: openQuickList = [] } = useQuery({
        queryKey: ['dashboard-quicklist', today],
        queryFn: () => base44.entities.QuickListItem.filter({ date: today, is_completed: false }),
        staleTime: STALE.MEDIUM,
        refetchInterval: false,
        enabled: permissions.canViewShopping,
    });

    const { data: openRestock = [] } = useQuery({
        queryKey: ['dashboard-restock', today],
        queryFn: () => base44.entities.RestockItem.filter({ date: today, is_completed: false }),
        staleTime: STALE.MEDIUM,
        refetchInterval: false,
        enabled: permissions.canViewRestock,
    });

    // Business calendar
    const { data: businessCalendarDays = [] } = useQuery({
        queryKey: ['business-calendar-today'],
        queryFn: () => base44.entities.BusinessCalendarDay.list('-date', 60),
        staleTime: 600000,
        refetchInterval: false,
        enabled: isManager,
    });
    const todayCalendarEntry = businessCalendarDays.find(d => d.date === today);
    const isTodayClosed = todayCalendarEntry?.is_closed === true ||
        ['geschlossen', 'geschlossen_mit_reinigung', 'betriebsferien'].includes(todayCalendarEntry?.day_type);

    // Alerts für Pill-Row
    const alerts = useMemo(() => {
        const list = [];
        if (urgentMaintenance.length > 0)
            list.push({ icon: Wrench, label: `${urgentMaintenance.length} Wartung überfällig`, to: 'Maintenance', color: 'text-red-300', bg: 'bg-red-500/10 border-red-500/30' });
        if (lowStockArticles.length > 0)
            list.push({ icon: TrendingDown, label: `${lowStockArticles.length} Artikel niedrig`, to: 'Articles', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' });
        if (pendingVacationRequests.length > 0)
            list.push({ icon: Calendar, label: `${pendingVacationRequests.length} Urlaubsantrag`, to: 'Vacation', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' });
        return list;
    }, [urgentMaintenance, lowStockArticles, pendingVacationRequests]);

    const tabs = [
        { id: 'heute',   label: 'Heute' },
        { id: 'team',    label: 'Team' },
        ...(isManager ? [{ id: 'manager', label: 'Manager', badge: pendingTimeEntries.length }] : []),
    ];

    const lowStockCount    = lowStockArticles.length;
    const openOrdersCount  = openOrders.length;
    const openQuickCount   = openQuickList.length;
    const openRestockCount = openRestock.length;

    return (
        <div className="min-h-screen bg-background pb-28 md:pb-8">
            <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                                {getGreeting()}{currentEmployee ? `, ${currentEmployee.name.split(' ')[0]}` : ''}!
                            </h1>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {isManager && <WhatsAppMessageGenerator employees={employees} />}
                            <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold', phase.bg, phase.color)}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {phase.label}
                            </div>
                        </div>
                    </div>

                    {/* Alert Pills */}
                    {isManager && (alerts.length > 0 || todayEvents.length > 0) && (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {todayEvents.length > 0 && (
                                <Link to={createPageUrl('Events')}>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap bg-purple-500/10 border-purple-500/30 text-purple-300">
                                        <Sparkles className="w-3 h-3" />
                                        {todayEvents.length} Event{todayEvents.length > 1 ? 's' : ''} heute
                                    </div>
                                </Link>
                            )}
                            {alerts.map((a, i) => (
                                <Link key={i} to={createPageUrl(a.to)}>
                                    <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap', a.bg, a.color)}>
                                        <a.icon className="w-3 h-3" />{a.label}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Personal Stats — nur wenn Employee verknüpft */}
                    {currentEmployee && (
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: 'Stunden', value: `${hoursThisWeek.toFixed(1)}h`, sub: 'diese Woche' },
                                { label: 'Urlaub',  value: remainingVacationDays,          sub: 'Tage übrig' },
                                { label: 'Schichten', value: myUpcomingShifts.length,      sub: 'kommend' },
                            ].map(s => (
                                <Card key={s.label} className="bg-card border-border">
                                    <CardContent className="p-3 text-center">
                                        <p className="text-lg font-bold text-foreground leading-none">{s.value}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">{s.sub}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Tabs ───────────────────────────────────────────────── */}
                <div className="flex gap-1 p-1 bg-card border border-border rounded-xl sticky top-[calc(4rem+env(safe-area-inset-top))] md:top-2 z-10">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex-1 py-2.5 px-2 rounded-lg text-sm font-semibold transition-all relative',
                                activeTab === tab.id
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {tab.label}
                            {tab.badge > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Tab Content ────────────────────────────────────────── */}
                {activeTab === 'heute' && (
                    <TodayTab
                        currentUser={currentUser}
                        currentEmployee={currentEmployee}
                        permissions={permissions}
                        employees={employees}
                        todayEvents={todayEvents}
                        todayReservations={todayReservations}
                        todayShifts={todayShifts}
                        myTodos={myTodos}
                        isManager={isManager}
                        lowStockCount={lowStockCount}
                        openOrdersCount={openOrdersCount}
                        openQuickListCount={openQuickCount}
                        openRestockCount={openRestockCount}
                    />
                )}

                {activeTab === 'team' && (
                    <TeamTab
                        employees={employees}
                        todayShifts={todayShifts}
                        currentUser={currentUser}
                        isManager={isManager}
                    />
                )}

                {activeTab === 'manager' && isManager && (
                    <ManagerDashboard
                        onSwitchToEmployee={() => setActiveTab('heute')}
                        currentEmployee={currentEmployee}
                        clockEntry={null}
                        hoursThisWeek={hoursThisWeek}
                        remainingVacationDays={remainingVacationDays}
                        myUpcomingShifts={myUpcomingShifts}
                        currentUser={currentUser}
                        isManager={isManager}
                        employees={employees}
                        shifts={shifts}
                        events={events}
                        reservations={reservations}
                        todos={todos}
                        timeEntries={timeEntries}
                        vacationRequests={vacationRequests}
                        maintenanceTasks={maintenanceTasks}
                        shoppingList={shopping}
                        articles={articles}
                        cleaningTasks={[]}
                        pendingTimeEntries={pendingTimeEntries}
                        todayShifts={todayShifts}
                        todayEvents={todayEvents}
                        isTodayClosed={isTodayClosed}
                        todayCalendarEntry={todayCalendarEntry}
                        alerts={alerts}
                    />
                )}
            </div>
        </div>
    );
}