import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TeamNotes from '@/components/dashboard/TeamNotes';
import ManagerDashboard from '@/components/dashboard/ManagerDashboard';
import ActiveStaffPanel from '@/components/dashboard/ActiveStaffPanel';
import UpcomingBirthdaysWidget from '@/components/dashboard/UpcomingBirthdaysWidget';
import TimeApprovalPanel from '@/components/dashboard/TimeApprovalPanel';
import TimeEntryReview from '@/components/dashboard/TimeEntryReview';
import AlarmPanel from '@/components/dashboard/AlarmPanel';
import ShiftSwapApprovalCard from '@/components/dashboard/ShiftSwapApprovalCard';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Clock, ArrowRight, CheckSquare, Zap, Circle, Sparkles, CalendarCheck,
    Users, Calendar, Lightbulb, LogIn, LogOut, Wrench, TrendingDown, ShoppingCart, FileText
} from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { isActiveEntry, getTodayOperationDate, formatDuration, calcWorkMinutes, buildTimeEntryFromClock } from '@/lib/nightUtils';
import { useDashboardData } from '@/hooks/useDashboardData';
import PersonalizedQuickLinks from '@/components/dashboard/PersonalizedQuickLinks';
import WeeklyHoursChart from '@/components/dashboard/WeeklyHoursChart';
import WhatsAppMessageGenerator from '@/components/employees/WhatsAppMessageGenerator';
import MyTimeWidget from '@/components/dashboard/MyTimeWidget';
import ShiftSwapInboxCard from '@/components/shifts/ShiftSwapInboxCard';

// ─── helpers ────────────────────────────────────────────────────────────────

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Guten Morgen';
    if (h < 17) return 'Guten Tag';
    if (h < 21) return 'Guten Abend';
    return 'Nachtschicht';
}

function getOperationPhase() {
    const h = new Date().getHours();
    if (h >= 6 && h < 11)  return { label: 'Vorbereitung', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    if (h >= 11 && h < 15) return { label: 'Mittagsbetrieb', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' };
    if (h >= 15 && h < 18) return { label: 'Ruhephase', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' };
    if (h >= 18 && h < 23) return { label: 'Abendbetrieb', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' };
    return { label: 'Nachtschicht', color: 'text-muted-foreground', bg: 'bg-secondary/50 border-500/30' };
}

// ─── mini widgets ────────────────────────────────────────────────────────────

function AlertPill({ icon: Icon, label, color = 'text-red-400', bg = 'bg-red-500/10 border-red-500/30', to }) {
    const inner = (
        <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap', bg, color)}>
            <Icon className="w-3 h-3" />{label}
        </div>
    );
    return to ? <Link to={to}>{inner}</Link> : inner;
}

function QuickLink({ page, icon: Icon, label, sub, color }) {
    return (
        <Link to={createPageUrl(page)}>
            <Card className="bg-card border-border hover:bg-accent/50 active:scale-95 transition-all card-pressable animate-stagger">
                <CardContent className="p-4 text-center">
                    <div className={cn('w-11 h-11 rounded-xl mx-auto mb-2 flex items-center justify-center', color)}>
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
                    {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
                </CardContent>
            </Card>
        </Link>
    );
}

// ─── Tab: HEUTE ─────────────────────────────────────────────────────────────

function TodayTab({ currentUser, currentEmployee, permissions, employees, todayEvents, todayReservations, todayShifts, myTodos }) {
    const today = format(new Date(), 'yyyy-MM-dd');

    // Meine heutige Schicht
    const myTodayShift = todayShifts.find(s => s.employee_id === currentEmployee?.id);

    // Geburtstage heute
    const birthdaysToday = employees.filter(e => {
        if (!e.birthday) return false;
        const bday = e.birthday.slice(5); // MM-DD
        return bday === today.slice(5);
    });

    return (
        <div className="space-y-5">
            {/* Unterschrift erforderlich */}
            {currentEmployee && !currentEmployee.sig_employee && (
                <Link to={createPageUrl('Employees') + `?employee=${currentEmployee.id}`}>
                    <Card className="bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15 transition-colors">
                        <CardContent className="p-4 flex items-center gap-3">
                            <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-blue-400">Unterschrift erforderlich</p>
                                <p className="text-xs text-blue-300 mt-0.5">Bitte unterzeichne deinen Personalbogen</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-blue-300 shrink-0" />
                        </CardContent>
                    </Card>
                </Link>
            )}

            {/* Meine heutige Schicht */}
            {currentEmployee && (
                <section>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide mb-3">
                        <Clock className="w-4 h-4 text-amber-400" />Meine Schicht heute
                    </h3>
                    {myTodayShift ? (
                        <Card className="border-amber-500/30 bg-amber-500/5">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                                    style={{ backgroundColor: currentEmployee.color || '#64748b' }}>
                                    {currentEmployee.name?.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-foreground">{myTodayShift.start_time} – {myTodayShift.end_time} Uhr</p>
                                    {myTodayShift.shift_type && <p className="text-xs text-amber-400 mt-0.5">{myTodayShift.shift_type}</p>}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="bg-card border-border">
                            <CardContent className="p-3 text-center">
                                <p className="text-sm text-muted-foreground">Keine Schicht heute eingetragen</p>
                            </CardContent>
                        </Card>
                    )}
                </section>
            )}

            {/* Stempeluhr */}
            <MyTimeWidget />

            {/* Schichttausch-Posteingang */}
            {currentEmployee && <ShiftSwapInboxCard currentEmployee={currentEmployee} />}

            {/* Team heute */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                        <Users className="w-4 h-4 text-blue-400" />Team heute ({todayShifts.length})
                    </h3>
                    <Link to={createPageUrl('Calendar')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        Schichtplan <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
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
                            return (
                                <Card key={s.id} className="bg-card border-border">
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                                style={{ backgroundColor: s.color || emp?.color || '#64748b' }}>
                                                {s.employee_name?.charAt(0)}
                                            </div>
                                            <p className="text-xs font-medium text-foreground truncate">{s.employee_name}</p>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">{s.start_time}–{s.end_time}</p>
                                        {s.shift_type && <p className="text-[10px] text-blue-400 mt-0.5">{s.shift_type}</p>}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Meine offenen Aufgaben */}
            {myTodos && myTodos.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                            <CheckSquare className="w-4 h-4 text-orange-400" />Meine Aufgaben ({myTodos.length})
                        </h3>
                        <Link to={createPageUrl('Todos')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                            Alle <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {myTodos.slice(0, 3).map(t => (
                            <Card key={t.id} className="bg-card border-border">
                                <CardContent className="p-3 flex items-center gap-3">
                                    <Circle className="w-4 h-4 text-orange-400 shrink-0" />
                                    <p className="text-sm text-foreground truncate flex-1">{t.title}</p>
                                    {t.priority === 'dringend' && <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">Dringend</Badge>}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            {/* Geburtstage heute */}
            {birthdaysToday.length > 0 && (
                <section>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide mb-3">
                        🎂 Geburtstag heute
                    </h3>
                    <div className="space-y-2">
                        {birthdaysToday.map(e => (
                            <Card key={e.id} className="border-pink-500/30 bg-pink-500/5">
                                <CardContent className="p-3 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                        style={{ backgroundColor: e.color || '#64748b' }}>
                                        {e.name?.charAt(0)}
                                    </div>
                                    <p className="text-sm font-medium text-foreground">{e.name}</p>
                                    <span className="ml-auto text-lg">🎉</span>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            {/* Events heute */}
            {todayEvents.length > 0 && (
                <section>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide mb-3">
                        <Sparkles className="w-4 h-4 text-purple-400" />Events heute
                    </h3>
                    <div className="space-y-2">
                        {todayEvents.map(e => (
                            <Card key={e.id} className="border-purple-500/30 bg-purple-500/5">
                                <CardContent className="p-3">
                                    <p className="text-sm font-semibold text-foreground">{e.title}</p>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                        {e.start_time && <span>🕐 {e.start_time}</span>}
                                        {e.expected_guests && <span>👥 {e.expected_guests} Gäste</span>}
                                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]">{e.event_type}</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            {/* Reservierungen kompakt */}
            {todayReservations.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                            <CalendarCheck className="w-4 h-4 text-green-400" />Reservierungen ({todayReservations.length})
                        </h3>
                        <Link to={createPageUrl('Reservations')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                            Alle <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
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
                </section>
            )}

            {/* Personalisierte Schnellzugriffe */}
            <PersonalizedQuickLinks userEmail={currentUser?.email} permissions={permissions} />
        </div>
    );
}

// ─── Tab: TEAM ───────────────────────────────────────────────────────────────

function TeamTab({ employees, todayShifts, currentUser, isManager }) {
    return (
        <div className="space-y-5">
            <TeamNotes isManager={isManager} currentUser={currentUser} />

            <section>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide mb-3">
                    <Users className="w-4 h-4 text-blue-400" />Team heute ({todayShifts.length} Schichten)
                </h3>
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
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                                style={{ backgroundColor: s.color || emp?.color || '#64748b' }}>
                                                {s.employee_name?.charAt(0)}
                                            </div>
                                            <p className="text-xs font-medium text-foreground truncate">{s.employee_name}</p>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">{s.start_time}–{s.end_time}</p>
                                        {s.shift_type && <p className="text-[10px] text-blue-400 mt-0.5">{s.shift_type}</p>}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

// ─── Tab: MANAGER ────────────────────────────────────────────────────────────

function ManagerTab({ stats, alerts, employees, todos, shopping, articles, pendingTimeEntries, maintenanceTasks, todayShifts, todayEvents, isManager, currentUser, activeStaffCount, isTodayClosed, todayCalendarEntry }) {
    const urgentTodos = todos.filter(t => t.priority === 'dringend' || t.priority === 'hoch');
    const lowStock = articles.filter(a => a.min_stock != null && a.current_stock <= a.min_stock);
    const openShopping = shopping.filter(s => s.status === 'offen');
    const needSignatures = employees.filter(e => !e.sig_employer);

    const kpis = [
        { label: 'Mitarbeiter', value: employees.length, icon: Users, color: 'bg-blue-600', to: 'Employees' },
        { label: 'Offene Aufgaben', value: todos.filter(t => t.status !== 'erledigt').length, icon: CheckSquare, color: urgentTodos.length > 0 ? 'bg-red-600' : 'bg-orange-600', to: 'Todos' },
        { label: 'Einkauf offen', value: openShopping.length, icon: ShoppingCart, color: 'bg-amber-600', to: 'Shopping' },
        { label: 'Lager niedrig', value: lowStock.length, icon: TrendingDown, color: lowStock.length > 0 ? 'bg-red-600' : 'bg-teal-600', to: 'Articles' },
    ];

    return (
        <div className="space-y-5">
            {/* Wochenstunden Diagramm */}
            <WeeklyHoursChart employees={employees} />

            {/* Unterschriften erforderlich */}
            {needSignatures.length > 0 && (
                <section>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        Unterschriften erforderlich
                        <span className="ml-auto badge-count animate-pop">
                            {needSignatures.length}
                        </span>
                    </h3>
                    <div className="space-y-2">
                        {needSignatures.slice(0, 5).map((emp, nIdx) => (
                            <Link key={emp.id} to={createPageUrl('Employees') + `?employee=${emp.id}`}>
                                <Card className="bg-card border-border hover:bg-accent/30 transition-colors animate-stagger" style={{ '--delay': `${nIdx * 50}ms` }}>
                                    <CardContent className="p-3 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                            style={{ backgroundColor: emp.color || '#64748b' }}>
                                            {emp.name?.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{emp.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {!emp.sig_employee ? '✗ Arbeitnehmer' : '✓ Arbeitnehmer'} · {!emp.sig_employer ? '✗ Arbeitgeber' : '✓ Arbeitgeber'}
                                            </p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                        {needSignatures.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center py-2">
                                +{needSignatures.length - 5} weitere
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* Schichttausch-Anfragen */}
            <ShiftSwapApprovalCard />

            {/* Aktive Mitarbeiter */}
            <section>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-400" />
                    Aktive Mitarbeiter
                    {activeStaffCount > 0 && (
                        <span className="ml-auto badge-count animate-pop">
                            {activeStaffCount}
                        </span>
                    )}
                </h3>
                <ActiveStaffPanel />
            </section>

            {/* Zeiten genehmigen */}
            <section>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                    Zeiten zur Genehmigung
                    {pendingTimeEntries.length > 0 && (
                        <span className="ml-auto badge-count animate-pop">
                            {pendingTimeEntries.length}
                        </span>
                    )}
                </h3>
                <TimeApprovalPanel />
            </section>

            {/* Alarm-Panel */}
            <AlarmPanel
            pendingTimeEntries={pendingTimeEntries}
            maintenanceTasks={maintenanceTasks}
            todayShifts={todayShifts}
            employees={employees}
            todayEvents={todayEvents}
            isManager={isManager}
            currentUser={currentUser}
            isTodayClosed={isTodayClosed}
            todayCalendarEntry={todayCalendarEntry}
            />

            {/* Wichtige Hinweise */}
            {alerts.length > 0 && (
                <section>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">Wichtige Hinweise</h3>
                    <div className="space-y-2">
                        {alerts.map((a, i) => (
                            <Link key={i} to={createPageUrl(a.to)}>
                                <Card className={cn('border transition-colors hover:opacity-80 animate-stagger', a.cardClass)} style={{ '--delay': `${i * 50}ms` }}>
                                    <CardContent className="p-3 flex items-center gap-3">
                                        <a.icon className={cn('w-5 h-5 shrink-0', a.iconClass)} />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground">{a.title}</p>
                                            <p className={cn('text-xs', a.textClass)}>{a.sub}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Schnellaktionen */}
            <section>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">Schnellaktionen</h3>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { page: 'Employees', icon: Users, label: 'Mitarbeiter', color: 'bg-blue-600' },
                        { page: 'Shifts', icon: Calendar, label: 'Schichten', color: 'bg-purple-600' },
                        { page: 'Events', icon: Sparkles, label: 'Events', color: 'bg-pink-600' },
                        { page: 'Todos', icon: CheckSquare, label: 'Aufgaben', color: 'bg-orange-600' },
                        { page: 'Shopping', icon: ShoppingCart, label: 'Einkauf', color: 'bg-amber-600' },
                        { page: 'Cleaning', icon: Sparkles, label: 'Reinigung', color: 'bg-teal-600' },
                    ].map(({ page, icon: Icon, label, color }, idx) => (
                        <Link key={label} to={createPageUrl(page)}>
                            <Card className="bg-card border-border hover:bg-accent/30 active:scale-95 transition-all animate-stagger" style={{ '--delay': `${idx * 50}ms` }}>
                                <CardContent className="p-3 flex items-center gap-3">
                                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
                                        <Icon className="w-4 h-4 text-white" />
                                    </div>
                                    <p className="text-sm font-medium text-foreground">{label}</p>
                                    <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto" />
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}

// ─── Clock Widget (für Mitarbeiter ohne Manager-Rechte) ──────────────────────

function ClockWidget({ currentEmployee }) {
    const queryClient = useQueryClient();

    const { data: clockEntries = [] } = useQuery({
        queryKey: ['clock-entries', currentEmployee?.id],
        queryFn: () => base44.entities.ClockEntry.filter({ employee_id: currentEmployee.id }, '-clock_in', 50),
        enabled: !!currentEmployee?.id,
        refetchInterval: 60000,
        staleTime: 30000,
    });

    // Night-safe: find active entry by status, not by date
    const activeClockEntry = clockEntries.find(e =>
        e.employee_id === currentEmployee?.id && isActiveEntry(e)
    );

    const clockInMutation = useMutation({
        mutationFn: async () => {
            // Duplikat-Schutz: verhindert mehrfaches Einstempeln
            const alreadyActive = clockEntries.find(e =>
                e.employee_id === currentEmployee.id && isActiveEntry(e)
            );
            if (alreadyActive) return alreadyActive;
            return base44.entities.ClockEntry.create({
                employee_id: currentEmployee.id,
                employee_name: currentEmployee.name,
                clock_in: new Date().toISOString(),
                status: 'clocked_in',
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clock-entries'] }),
    });

    const clockOutMutation = useMutation({
        mutationFn: async (entryId) => {
            const entry = clockEntries.find(e => e.id === entryId);
            const now = new Date();
            const nowISO = now.toISOString();
            const totalMinutes = calcWorkMinutes(entry.clock_in, now);
            const breakMinutes = totalMinutes > 9 * 60 ? 45 : totalMinutes > 6 * 60 ? 30 : 0;
            const totalHours = Math.round(((totalMinutes - breakMinutes) / 60) * 100) / 100;
            const entryDate = format(new Date(entry.clock_in), 'yyyy-MM-dd');
            const startTime = format(new Date(entry.clock_in), 'HH:mm');
            const endTime = format(now, 'HH:mm');

            await base44.entities.ClockEntry.update(entryId, {
                clock_out: nowISO,
                break_minutes: breakMinutes,
                total_hours: totalHours,
                status: 'clocked_out',
            });
            await base44.entities.TimeEntry.create({
                employee_id: entry.employee_id,
                employee_name: entry.employee_name,
                date: entryDate,
                start_time: startTime,
                end_time: endTime,
                break_minutes: breakMinutes,
                total_hours: totalHours,
                notes: `Automatisch von Stempeluhr übertragen${breakMinutes > 0 ? ` | ${breakMinutes} Min. Pause (gesetzl.)` : ''}`,
                status: 'eingereicht',
                employee_confirmed: true,
                employee_confirmed_at: nowISO,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clock-entries'] });
            queryClient.invalidateQueries({ queryKey: ['time-entries'] });
        },
    });

    if (!currentEmployee) return null;

    const getWorkingDuration = (clockIn) => {
        const minutes = calcWorkMinutes(clockIn, new Date());
        return formatDuration(minutes);
    };

    return (
        <Card className={cn('border', activeClockEntry ? 'border-green-500/40 bg-green-500/5' : 'border-border bg-card')}>
            <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: currentEmployee.color || '#64748b' }}>
                    {currentEmployee.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    {activeClockEntry ? (
                        <>
                            <p className="text-sm font-semibold text-green-400">Eingestempelt</p>
                            <p className="text-xs text-muted-foreground">Seit {format(new Date(activeClockEntry.clock_in), 'HH:mm')} · {getWorkingDuration(activeClockEntry.clock_in)}</p>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-semibold text-foreground">Nicht eingestempelt</p>
                            <p className="text-xs text-muted-foreground">{currentEmployee.name}</p>
                        </>
                    )}
                </div>
                <div className="flex gap-2 shrink-0">
                    {activeClockEntry ? (
                        <Button size="sm" onClick={() => clockOutMutation.mutate(activeClockEntry.id)}
                            disabled={clockOutMutation.isPending}
                            className="h-9 bg-red-600 hover:bg-red-700 text-white gap-1 text-xs">
                            <LogOut className="w-3 h-3" />Aus
                        </Button>
                    ) : (
                        <Button size="sm" onClick={() => clockInMutation.mutate()}
                            disabled={clockInMutation.isPending}
                            className="h-9 bg-green-600 hover:bg-green-700 text-white gap-1 text-xs">
                            <LogIn className="w-3 h-3" />Ein
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function SmartDashboard({ currentUser, currentEmployee, isManager, permissions }) {
    const [activeTab, setActiveTab] = useState('heute');
    const today = format(new Date(), 'yyyy-MM-dd');
    const phase = getOperationPhase();

    const {
        shifts,
        events,
        reservations,
        todos,
        employees,
        articles,
        shopping,
        maintenanceTasks,
        timeEntries,
        pendingTimeEntries,
        vacationRequests,
        todayShifts,
        todayEvents,
        todayReservations,
        upcomingEvents,
        openTodos,
        myTodos,
        upcomingShifts,
        hoursThisWeek,
        myUpcomingShifts,
        remainingVacationDays,
        lowStockArticles,
        pendingVacationRequests,
        urgentMaintenance,
    } = useDashboardData({ isManager, currentEmployee });

    const { data: businessCalendarDays = [] } = useQuery({
        queryKey: ['business-calendar-today'],
        queryFn: () => base44.entities.BusinessCalendarDay.list('-date', 60),
        staleTime: 300000,
        enabled: isManager,
    });
    const todayCalendarEntry = businessCalendarDays.find(d => d.date === today);
    const isTodayClosed = todayCalendarEntry?.is_closed === true ||
        ['geschlossen', 'geschlossen_mit_reinigung', 'betriebsferien'].includes(todayCalendarEntry?.day_type);

    // Night-safe today = operation date (not calendar date)
    const todayOperationDate = getTodayOperationDate();







    // Alerts
    const todayEvents_count = todayEvents.length;

    const alerts = useMemo(() => {
        const list = [];
        if (urgentMaintenance.length > 0)
            list.push({ icon: Wrench, title: 'Wartung überfällig', sub: `${urgentMaintenance.length} Aufgaben`, to: 'Maintenance', cardClass: 'border-red-500/30 bg-red-500/5', iconClass: 'text-red-400', textClass: 'text-red-300' });
        if (lowStockArticles.length > 0)
            list.push({ icon: TrendingDown, title: 'Lager niedrig', sub: `${lowStockArticles.length} Artikel`, to: 'Articles', cardClass: 'border-amber-500/30 bg-amber-500/5', iconClass: 'text-amber-400', textClass: 'text-amber-300' });
        if (pendingVacationRequests.length > 0)
            list.push({ icon: Calendar, title: 'Urlaubsanträge', sub: `${pendingVacationRequests.length} ausstehend`, to: 'MyArea', cardClass: 'border-blue-500/30 bg-blue-500/5', iconClass: 'text-blue-400', textClass: 'text-blue-300' });
        return list;
    }, [urgentMaintenance, lowStockArticles, pendingVacationRequests]);

    const tabs = [
        { id: 'heute', label: 'Heute' },
        { id: 'team', label: 'Team' },
        ...(isManager ? [{ id: 'manager', label: 'Manager' }] : [])
    ];

    return (
        <div className="min-h-screen bg-background pb-28 md:pb-8">
            <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">

                {/* ── TOP SECTION ── */}
                <div className="space-y-3">
                    {/* Greeting + date */}
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
                            {todayEvents_count > 0 && (
                                <AlertPill icon={Sparkles} label={`${todayEvents_count} Event${todayEvents_count > 1 ? 's' : ''} heute`}
                                    color="text-purple-300" bg="bg-purple-500/10 border-purple-500/30" to={createPageUrl('Events')} />
                            )}
                            {alerts.map((a, i) => (
                                <AlertPill key={i} icon={a.icon} label={a.sub ? `${a.title}: ${a.sub}` : a.title}
                                    color={a.textClass} bg={a.cardClass} to={createPageUrl(a.to)} />
                            ))}
                        </div>
                    )}

                    {/* Personal stats bar (compact) */}
                    {currentEmployee && (
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: 'Stunden', value: `${hoursThisWeek.toFixed(1)}h`, sub: 'diese Woche' },
                                { label: 'Urlaub', value: remainingVacationDays, sub: 'Tage übrig' },
                                { label: 'Schichten', value: myUpcomingShifts.length, sub: 'kommend' },
                            ].map(s => (
                                <Card key={s.label} className="bg-card border-border">
                                    <CardContent className="p-3 text-center">
                                        <p className="text-lg font-bold text-foreground leading-none num animate-pop">{s.value}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">{s.sub}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Clock widget */}
                    {currentEmployee && <ClockWidget currentEmployee={currentEmployee} />}
                </div>

                {/* ── TABS ── */}
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
                            {tab.id === 'manager' && isManager && pendingTimeEntries.length > 0 && (
                                <span className="absolute -top-1 -right-1 badge-count animate-pop">
                                    {pendingTimeEntries.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── TAB CONTENT ── */}
                <div>
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
                            onSwitchToEmployee={() => {}}
                            currentEmployee={currentEmployee}
                            hoursThisWeek={hoursThisWeek}
                            remainingVacationDays={remainingVacationDays}
                            myUpcomingShifts={myUpcomingShifts}
                            currentUser={currentUser}
                            isManager={isManager}
                            employees={employees}
                            shifts={shifts}
                            events={events}
                            reservations={reservations}
                            todos={openTodos}
                            timeEntries={pendingTimeEntries}
                            vacationRequests={vacationRequests}
                            maintenanceTasks={maintenanceTasks}
                            shoppingList={shopping}
                            articles={articles}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}