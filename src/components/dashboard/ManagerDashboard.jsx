import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Calendar, Clock, CheckSquare, AlertCircle, ArrowRight, Users, ShoppingCart,
    Sparkles, Package, AlertTriangle, CalendarCheck, Umbrella, TrendingUp, Wrench, Euro, ReceiptText
} from 'lucide-react';
import { getTaskStatus } from '@/lib/maintenanceUtils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import HolidayCreditManager from '@/components/dashboard/HolidayCreditManager';
import TodayOverview from '@/components/dashboard/TodayOverview';
import ShiftSwapApprovalCard from '@/components/dashboard/ShiftSwapApprovalCard';
import TeamMeetingReminder from '@/components/dashboard/TeamMeetingReminder';
import LegalStatusPanel from '@/components/legal/LegalStatusPanel';
import TeamNotes from '@/components/dashboard/TeamNotes';
import TimeApprovalPanel from '@/components/dashboard/TimeApprovalPanel';

export default function ManagerDashboard({ onSwitchToEmployee, currentEmployee, clockEntry, hoursThisWeek, remainingVacationDays, myUpcomingShifts, currentUser, isManager = true, employees = [], shifts = [], events = [], reservations = [], todos = [], timeEntries = [], pendingTimeEntries: pendingTimeEntriesProp, vacationRequests = [], maintenanceTasks = [], shoppingList = [], articles = [], cleaningTasks = [] }) {
    const today = format(new Date(), 'yyyy-MM-dd');

    const todayShifts = shifts.filter(s => s.date === today);
    const todayEvents = events.filter(e => e.date === today && e.status !== 'Abgesagt');
    const todayReservations = reservations.filter(r => r.date === today && r.status !== 'storniert');
    const openTodos = todos.filter(t => t.status !== 'erledigt');
    const urgentTodos = openTodos.filter(t => t.priority === 'dringend' || t.priority === 'hoch');
    const openShoppingItems = shoppingList.filter(i => i.status === 'offen');
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

    const cleaningProgress = cleaningTasks.length > 0
        ? Math.round((cleaningTasks.filter(t => t.is_completed).length / cleaningTasks.length) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-background p-3 sm:p-8 pb-24 md:pb-0">
            <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
                <div className="flex items-center justify-between gap-2 flex-col sm:flex-row">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
                        <p className="text-muted-foreground text-sm mt-1">{format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}</p>
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
                        <Card className="p-6 bg-card border-border shadow-xl">
                            <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
                                <Users className="w-5 h-5 text-amber-500" />
                                Mein Bereich
                            </h2>
                            <div className="grid sm:grid-cols-3 gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/20">
                                        <Clock className="w-8 h-8 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold text-foreground">{hoursThisWeek?.toFixed(1)}h</p>
                                        <p className="text-sm text-muted-foreground">Diese Woche</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center border border-purple-500/20">
                                        <Umbrella className="w-8 h-8 text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold text-foreground">{remainingVacationDays}</p>
                                        <p className="text-sm text-muted-foreground">Urlaubstage übrig</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center border border-green-500/20">
                                        <Calendar className="w-8 h-8 text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold text-foreground">{myUpcomingShifts?.length}</p>
                                        <p className="text-sm text-muted-foreground">Kommende Schichten</p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                    </>
                )}

                {/* Legal Status Panel */}
                <LegalStatusPanel />

                {/* Team Meeting Reminder */}
                <TeamMeetingReminder />

                <ShiftSwapApprovalCard />

                {/* Alerts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {pendingTimeEntries.length > 0 && (
                        <Link to={createPageUrl('TimeManagement')}>
                            <Card className="bg-amber-900/20 border-amber-800/30 hover:bg-amber-900/30 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Clock className="w-8 h-8 text-amber-400" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground">Zeiterfassungen</p>
                                            <p className="text-xs text-amber-300">{pendingTimeEntries.length} zu genehmigen</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-amber-400" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )}
                    {pendingVacationRequests.length > 0 && (
                        <Link to={createPageUrl('MyArea') + '?tab=urlaub'}>
                            <Card className="bg-blue-900/20 border-blue-800/30 hover:bg-blue-900/30 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-8 h-8 text-blue-400" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground">Urlaubsanträge</p>
                                            <p className="text-xs text-blue-300">{pendingVacationRequests.length} ausstehend</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-blue-400" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )}
                    {lowStockArticles.length > 0 && (
                        <Link to={createPageUrl('Warehouse')}>
                            <Card className="bg-red-900/20 border-red-800/30 hover:bg-red-900/30 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="w-8 h-8 text-red-400" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground">Lager niedrig</p>
                                            <p className="text-xs text-red-300">{lowStockArticles.length} Artikel</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-red-400" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )}
                    {maintenanceAlert > 0 && (
                        <Link to={createPageUrl('Maintenance')}>
                            <Card className={urgentMaintenance.length > 0 ? "bg-red-900/20 border-red-800/30 hover:bg-red-900/30 transition-colors" : "bg-yellow-900/20 border-yellow-800/30 hover:bg-yellow-900/30 transition-colors"}>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Wrench className={`w-8 h-8 ${urgentMaintenance.length > 0 ? 'text-red-400' : 'text-yellow-400'}`} />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground">Wartung</p>
                                            <p className={`text-xs ${urgentMaintenance.length > 0 ? 'text-red-300' : 'text-yellow-300'}`}>
                                                {urgentMaintenance.length > 0 && `${urgentMaintenance.length} überfällig`}
                                                {urgentMaintenance.length > 0 && soonMaintenance.length > 0 && ' · '}
                                                {soonMaintenance.length > 0 && `${soonMaintenance.length} bald fällig`}
                                            </p>
                                        </div>
                                        <ArrowRight className={`w-5 h-5 ${urgentMaintenance.length > 0 ? 'text-red-400' : 'text-yellow-400'}`} />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )}
                </div>

                {/* Quick Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { page: 'Shopping', color: 'bg-orange-600', icon: ShoppingCart, label: 'Einkauf', sub: `${openShoppingItems.length} offen` },
                        { page: 'Cleaning', color: 'bg-pink-600', icon: Sparkles, label: 'Putzen', sub: `${cleaningProgress}% erledigt` },
                        { page: 'AccountingDashboard', color: 'bg-emerald-600', icon: TrendingUp, label: 'Buchhaltung', sub: 'Übersicht' },
                        { page: 'Warehouse', color: 'bg-teal-600', icon: Package, label: 'Lager', sub: `${articles.length} Artikel` },
                    ].map(({ page, color, icon: Icon, label, sub }, idx) => (
                        <Link key={label} to={createPageUrl(page)}>
                            <Card className="bg-card border-border hover:bg-accent/50 transition-colors card-pressable animate-stagger" style={{ '--delay': `${idx * 55}ms` }}>
                                <CardContent className="p-4 text-center">
                                    <div className={`w-12 h-12 rounded-lg ${color} mb-3 mx-auto flex items-center justify-center`}>
                                        <Icon className="w-6 h-6 text-white" />
                                    </div>
                                    <p className="text-sm font-medium text-foreground mb-1">{label}</p>
                                    <p className="text-xs text-muted-foreground">{sub}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                {/* Zeiterfassung genehmigen */}
                <div>
                    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-500" />
                        Zeiterfassung genehmigen
                    </h2>
                    <TimeApprovalPanel />
                </div>

                <TodayOverview shifts={todayShifts} events={todayEvents} reservations={todayReservations} employees={employees} maxItems={4} />

                {/* Team-Notizen */}
                <TeamNotes isManager={isManager} currentUser={currentUser} />
            </div>
        </div>
    );
}