import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Calendar, Clock, ArrowRight, Users,
    AlertTriangle, Umbrella, Wrench
} from 'lucide-react';
import { getTaskStatus } from '@/lib/maintenanceUtils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import HolidayCreditManager from '@/components/dashboard/HolidayCreditManager';
import TodayOverview from '@/components/dashboard/TodayOverview';
import ShiftSwapApprovalCard from '@/components/dashboard/ShiftSwapApprovalCard';
import TodayBriefCard from '@/components/dashboard/TodayBriefCard';
import TeamMeetingReminder from '@/components/dashboard/TeamMeetingReminder';
import LegalStatusPanel from '@/components/legal/LegalStatusPanel';
import TimeApprovalPanel from '@/components/dashboard/TimeApprovalPanel';

export default function ManagerDashboard({ onSwitchToEmployee, currentEmployee, clockEntry, hoursThisWeek, remainingVacationDays, myUpcomingShifts, currentUser, isManager = true, employees = [], shifts = [], events = [], reservations = [], todos = [], timeEntries = [], pendingTimeEntries: pendingTimeEntriesProp, vacationRequests = [], maintenanceTasks = [], shoppingList = [], articles = [], cleaningTasks = [] }) {
    const today = format(new Date(), 'yyyy-MM-dd');

    const todayShifts = shifts.filter(s => s.date === today);
    const todayEvents = events.filter(e => e.date === today && e.status !== 'Abgesagt');
    const todayReservations = reservations.filter(r => r.date === today && r.status !== 'storniert');
    const openTodos = todos.filter(t => t.status !== 'erledigt');
    const urgentTodos = openTodos.filter(t => t.priority === 'dringend' || t.priority === 'hoch');
    const lowStockArticles = articles.filter(a => a.min_stock && a.current_stock <= a.min_stock);
    // War bisher fälschlich = die komplette timeEntries-Liste (bis zu 1000
    // Records, davon fast alle schon 'genehmigt') — dadurch zeigte das
    // Dashboard "653 zu genehmigen" an, obwohl alles längst genehmigt war
    // (653 = Gesamtzahl aller TimeEntry-Records, nicht die offenen).
    // Jetzt: echte, bereits in useDashboardData korrekt gefilterte Liste
    // (status='eingereicht' bzw. employee_confirmed=true UND noch nicht
    // 'genehmigt') verwenden, mit Fallback falls Prop mal fehlt.
    const pendingTimeEntries = pendingTimeEntriesProp ?? timeEntries.filter(e =>
        (e.status === 'eingereicht' || e.employee_confirmed === true) && e.status !== 'genehmigt'
    );
    const pendingVacationRequests = vacationRequests.filter(r => r.status === 'beantragt');
    const urgentMaintenance = maintenanceTasks.filter(t => getTaskStatus(t) === 'überfällig');
    const soonMaintenance   = maintenanceTasks.filter(t => getTaskStatus(t) === 'bald fällig');
    const maintenanceAlert  = urgentMaintenance.length + soonMaintenance.length;


    return (
        <div className="min-h-screen bg-background p-3 sm:p-8 pb-24 md:pb-0">
            <div className="max-w-7xl mx-auto space-y-3">
                <div className="page-header flex-col sm:flex-row sm:items-start">
                    <div>
                        <h1 className="page-title">Dashboard</h1>
                        <p className="page-subtitle">{format(new Date(), "EEEE, d. MMMM", { locale: de })}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={onSwitchToEmployee} className="border-border text-muted-foreground hover:bg-accent">
                            <Users className="w-4 h-4 mr-2" />
                            Mitarbeiter-Ansicht
                        </Button>
                        <HolidayCreditManager />
                    </div>
                </div>

                {/* Persönlicher Bereich */}
                {currentEmployee && (
                    <>
                        <Card className="p-4">
                            <h2 className="text-[13.5px] font-medium text-foreground mb-3 flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" />
                                Mein Bereich
                            </h2>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { icon: Clock,    value: `${hoursThisWeek?.toFixed(1) ?? '0.0'}h`, label: 'Std. diese Woche' },
                                    { icon: Umbrella, value: remainingVacationDays,                     label: 'Urlaubstage übrig' },
                                    { icon: Calendar, value: myUpcomingShifts?.length ?? 0,            label: 'Schichten kommend' },
                                ].map(({ icon: Icon, value, label }) => (
                                    <div key={label} className="rounded-xl bg-surface px-3 py-3 text-center">
                                        <Icon className="w-4 h-4 mx-auto mb-1.5 text-muted-foreground" />
                                        <p className="stat-value">{value}</p>
                                        <p className="stat-label mt-1.5">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>
                        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                    </>
                )}

                {/* Legal Status Panel */}
                <LegalStatusPanel />

                {/* Heute-Brief — kompakter Tages-Brief für den Manager */}
                <TodayBriefCard />

                {/* Team Meeting Reminder */}
                <TeamMeetingReminder />

                <ShiftSwapApprovalCard />

                {/* Alerts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {pendingTimeEntries.length > 0 && (
                        <Link to={createPageUrl('TimeManagement')}>
                            <Card className="bg-status-warn/20 border-status-warn/30 hover:bg-status-warn/30 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Clock className="w-8 h-8 text-status-warn" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground">Zeiterfassungen</p>
                                            <p className="text-xs text-status-warn/25">{pendingTimeEntries.length} zu genehmigen</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-status-warn" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )}
                    {pendingVacationRequests.length > 0 && (
                        <Link to={createPageUrl('MyArea') + '?tab=urlaub'}>
                            <Card className="bg-primary/20 border-primary/30 hover:bg-primary/30 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-8 h-8 text-primary" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground">Urlaubsanträge</p>
                                            <p className="text-xs text-primary/25">{pendingVacationRequests.length} ausstehend</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-primary" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )}
                    {lowStockArticles.length > 0 && (
                        <Link to={createPageUrl('Warehouse')}>
                            <Card className="bg-status-danger/20 border-status-danger/30 hover:bg-status-danger/30 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="w-8 h-8 text-status-danger" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground">Lager niedrig</p>
                                            <p className="text-xs text-status-danger/25">{lowStockArticles.length} Artikel</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-status-danger" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )}
                    {maintenanceAlert > 0 && (
                        <Link to={createPageUrl('Maintenance')}>
                            <Card className={urgentMaintenance.length > 0 ? "bg-status-danger/20 border-status-danger/30 hover:bg-status-danger/30 transition-colors" : "bg-status-warn/20 border-status-warn/30 hover:bg-status-warn/30 transition-colors"}>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Wrench className={`w-8 h-8 ${urgentMaintenance.length > 0 ? 'text-status-danger' : 'text-status-warn'}`} />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground">Wartung</p>
                                            <p className={`text-xs ${urgentMaintenance.length > 0 ? 'text-status-danger/25' : 'text-status-warn/25'}`}>
                                                {urgentMaintenance.length > 0 && `${urgentMaintenance.length} überfällig`}
                                                {urgentMaintenance.length > 0 && soonMaintenance.length > 0 && ' · '}
                                                {soonMaintenance.length > 0 && `${soonMaintenance.length} bald fällig`}
                                            </p>
                                        </div>
                                        <ArrowRight className={`w-5 h-5 ${urgentMaintenance.length > 0 ? 'text-status-danger' : 'text-status-warn'}`} />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )}
                </div>

                {/* Zeiterfassung genehmigen */}
                <div>
                    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-status-warn" />
                        Zeiterfassung genehmigen
                    </h2>
                    <TimeApprovalPanel />
                </div>

                <TodayOverview shifts={todayShifts} events={todayEvents} reservations={todayReservations} employees={employees} maxItems={4} />
            </div>
        </div>
    );
}