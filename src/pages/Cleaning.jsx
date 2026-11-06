import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';
import { LoadingState, ErrorState } from '@/components/ui/StateDisplay';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Plus, Sparkles, FileText, MoreVertical, Settings, CheckCircle2,
    Circle, ChevronRight, RefreshCw, Trash2, Archive, Check
} from 'lucide-react';
import SwipeRow from '@/components/ui/SwipeRow';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import AreasManager from '@/components/cleaning/AreasManager';
import OpenTasksToday from '@/components/cleaning/OpenTasksToday';
import { currentNightDate, nextDay, isCompletedInNight, isDemandNight, isTaskDueToday, shiftDays, todayStr } from '@/lib/cleaningSchedule';
import WeekdayTasksSection from '@/components/cleaning/WeekdayTasksSection';
import { usePermissions } from '@/components/auth/usePermissions';
import { getUserDisplayName } from '@/lib/userDisplayName';
import { toast } from 'sonner';
import { useShake } from '@/hooks/useShake';
import { haptics } from '@/components/utils/haptics';

export default function Cleaning() {
    const queryClient = useQueryClient();
    const permissions = usePermissions();
    const [modalOpen, setModalOpen] = useState(false);
    const [reportsModalOpen, setReportsModalOpen] = useState(false);
    const [endDayDialogOpen, setEndDayDialogOpen] = useState(false);
    const [endDayLoading, setEndDayLoading] = useState(false);
    const [activeArea, setActiveArea] = useState('all');
    const [view, setView] = useState('open'); // 'open' = Offene Aufgaben heute (Standard), 'all' = alles inkl. erledigt
    const WEEKDAYS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
    const [formData, setFormData] = useState({
        title: '', area: 'Theke', frequency: 'täglich',
        due_weekdays: [], due_date: '', assigned_to: '', assigned_to_name: '',
    });
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingUpdates, setPendingUpdates] = useState([]);
    const [areasOpen, setAreasOpen] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('cleaning_pending_updates');
        if (saved) setPendingUpdates(JSON.parse(saved));
    }, []);

    useEffect(() => {
        localStorage.setItem('cleaning_pending_updates', JSON.stringify(pendingUpdates));
    }, [pendingUpdates]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            syncMutations(base44).then(() => queryClient.invalidateQueries({ queryKey: ['cleaning'] })).catch(console.error);
        };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
    }, []);

    const { data: user } = useQuery({ queryKey: ['user'], queryFn: () => base44.auth.me() });
    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name')
    });
    const { data: allTasks = [], isLoading, isError: tasksError, error: tasksErrorObj } = useQuery({
        queryKey: ['cleaning'],
        queryFn: () => base44.entities.CleaningTask.filter({ is_active: true }, 'area', 200),
        staleTime: STALE.MEDIUM
    });
    const { data: reports = [] } = useQuery({
        queryKey: ['cleaning-reports'],
        queryFn: () => base44.entities.CleaningReport.list('-created_date', 20),
        staleTime: STALE.MEDIUM
    });
    const { data: allAreas = [] } = useQuery({
        queryKey: ['cleaning-areas'],
        queryFn: () => base44.entities.CleaningArea.list('order'),
        staleTime: STALE.SLOW,
    });
    // Laufende Nachtschicht (05:00–05:00) und ihre Einstufung als Bedarfsnacht
    const nightDate = currentNightDate();
    const nightNextDay = nextDay(nightDate);
    const { data: nightCalendar = [] } = useQuery({
        queryKey: ['business-calendar-night', nightDate],
        queryFn: () => base44.entities.BusinessCalendarDay.filter({ date: { $in: [nightDate, nightNextDay] } }),
        staleTime: STALE.MEDIUM,
    });

    const currentMonth = new Date().getMonth() + 1;
    const isSeason = currentMonth >= 4 && currentMonth <= 10;
    const areas = allAreas.filter(area => !area.seasonal || isSeason);

    // Fälligkeit: wöchentliche Aufgaben nur an ihrem Wochentag, bei
    // biweekly_pattern zusätzlich nur in ihrer KW-Parität (_1 ungerade, _2 gerade).
    const today = todayStr();
    const tasks = allTasks.filter(t => isTaskDueToday(t, today));

    // Wochentagsaufgaben erscheinen in einem eigenen Block — mit Hinweis,
    // welche Aufgaben derselben Wochentage in der anderen Parität dran sind.
    const weekdayTasks = tasks.filter(t => t.area === 'Wochentagsaufgaben');
    const regularTasks = tasks.filter(t => t.area !== 'Wochentagsaufgaben');
    const weekdayTasksNextWeek = allTasks.filter(t =>
        t.area === 'Wochentagsaufgaben' &&
        !isTaskDueToday(t, today) &&
        isTaskDueToday(t, shiftDays(today, 7))
    );

    // Bereiche aus aktiven Aufgaben ableiten
    const taskAreas = useMemo(() => {
        const seen = new Set();
        tasks.forEach(t => seen.add(t.area));
        return Array.from(seen).sort();
    }, [tasks]);

    // Aufgaben nach Bereich filtern + erledigte ans Ende
    const filteredTasks = useMemo(() => {
        const base = activeArea === 'all' ? tasks : tasks.filter(t => t.area === activeArea);
        const open = base.filter(t => !t.is_completed);
        const done = base.filter(t => t.is_completed);
        return [...open, ...done];
    }, [tasks, activeArea]);

    const completedCount = tasks.filter(t => t.is_completed).length;
    const openCount = tasks.length - completedCount;
    const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

    // Nur Bedarfstage fließen in die Durchschnittsquote ein (Werktage = "kein Bedarf")
    const demandReports = reports.filter(r => r.required !== false);
    const averageDemandRate = demandReports.length > 0
        ? Math.round(demandReports.reduce((sum, r) => sum + (r.completion_rate || 0), 0) / demandReports.length)
        : null;

    // Beschriftung der Berichtskarte: "Freitagnacht · 06.11.2026"
    const reportNightLabel = (report) => {
        const dateStr = report.business_night_date || report.week_start;
        const d = new Date(`${dateStr}T12:00:00`);
        return `${format(d, 'EEEE', { locale: de })}nacht · ${format(d, 'dd.MM.yyyy')}`;
    };

    // Aufgaben nach Bereich gruppieren (für Bulk-Button je Bereich)
    const groupedTasks = useMemo(() => {
        const groups = {};
        filteredTasks.forEach(t => {
            if (!groups[t.area]) groups[t.area] = [];
            groups[t.area].push(t);
        });
        return Object.keys(groups).sort().map(area => ({
            area,
            tasks: groups[area],
            open: groups[area].filter(t => !t.is_completed),
            done: groups[area].filter(t => t.is_completed),
        }));
    }, [filteredTasks]);

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'CleaningTask', type: 'update', id, data });
                queryClient.setQueryData(['cleaning'], (old) =>
                    old?.map(task => task.id === id ? { ...task, ...data } : task) || old);
                return { queued: true };
            }
            return base44.entities.CleaningTask.update(id, data);
        },
        onSuccess: (result) => { if (!result?.queued) queryClient.invalidateQueries({ queryKey: ['cleaning'] }); }
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.CleaningTask.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cleaning'] });
            setModalOpen(false);
            setFormData({ title: '', area: 'Theke', frequency: 'täglich', due_weekdays: [], due_date: '', assigned_to: '', assigned_to_name: '' });
            toast.success('Aufgabe erstellt');
        }
    });

    // Shake-to-Undo: letzter abgehakter Putzauftrag (max 1 Eintrag)
    const lastUndoRef = useRef(null);
    const undoLast = useCallback(() => {
        const entry = lastUndoRef.current;
        if (!entry) return;
        updateMutation.mutate({ id: entry.id, data: entry.prevData });
        lastUndoRef.current = null;
        toast.success('Rückgängig gemacht');
        haptics.medium();
    }, [updateMutation]);
    useShake(undoLast);

    const handleComplete = (task) => {
        const displayName = getUserDisplayName({ employeeName: permissions.employeeName, user });
        const willComplete = !task.is_completed;
        if (willComplete) {
            haptics.light();
            lastUndoRef.current = {
                id: task.id,
                prevData: {
                    is_completed: task.is_completed,
                    completed_by: task.completed_by || null,
                    completed_at: task.completed_at || null,
                },
            };
        }
        updateMutation.mutate({
            id: task.id,
            data: {
                is_completed: willComplete,
                completed_by: willComplete ? displayName : null,
                completed_at: willComplete ? new Date().toISOString() : null
            }
        });
    };

    const handleBulkComplete = (areaTasks) => {
        const openTasks = areaTasks.filter(t => !t.is_completed);
        if (openTasks.length === 0) return;
        const displayName = getUserDisplayName({ employeeName: permissions.employeeName, user });
        openTasks.forEach(task => {
            updateMutation.mutate({
                id: task.id,
                data: {
                    is_completed: true,
                    completed_by: displayName,
                    completed_at: new Date().toISOString()
                }
            });
        });
        toast.success(`${openTasks.length} Aufgabe${openTasks.length === 1 ? '' : 'n'} erledigt`);
    };

    const endDay = async () => {
        setEndDayLoading(true);
        try {
            const today = new Date();
            // Zählfenster der Schicht: nightDate 05:00 bis Folgetag 05:00
            const completedTasks = tasks.filter(t => isCompletedInNight(t.completed_at, nightDate));
            const calNight = nightCalendar.find(d => d.date === nightDate);
            const calNext = nightCalendar.find(d => d.date === nightNextDay);
            const isRequired = isDemandNight(nightDate, calNight, calNext);
            const nightWeekday = format(new Date(`${nightDate}T12:00:00`), 'EEEE', { locale: de });
            await base44.entities.CleaningReport.create({
                business_night_date: nightDate,
                week_start: nightDate,
                week_end: nightDate,
                report_data: completedTasks.map(t => ({ task_title: t.title, area: t.area, frequency: t.frequency, completed_by: t.completed_by, completed_at: t.completed_at })),
                total_tasks: tasks.length,
                completed_tasks: completedTasks.length,
                completion_rate: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
                required: isRequired,
                demand_reason: isRequired ? `${nightWeekday}nacht` : 'kein Bedarf'
            });
            const dailyTasks = tasks.filter(t => t.frequency === 'täglich' && t.is_completed);
            for (const task of dailyTasks) {
                await base44.entities.CleaningTask.update(task.id, {
                    is_completed: false, completed_by: null, completed_at: null, last_reset: format(today, 'yyyy-MM-dd')
                });
            }
            queryClient.invalidateQueries({ queryKey: ['cleaning'] });
            queryClient.invalidateQueries({ queryKey: ['cleaning-reports'] });
            toast.success('Tag abgeschlossen & Bericht gespeichert');
        } catch (err) {
            console.error('endDay Fehler:', err);
            toast.error('Fehler beim Tagesabschluss');
        } finally {
            setEndDayLoading(false);
            setEndDayDialogOpen(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        createMutation.mutate(formData);
    };

    if (isLoading) return <LoadingState />;
    if (tasksError) return <ErrorState title="Putzaufgaben konnten nicht geladen werden" onRetry={() => queryClient.invalidateQueries({ queryKey: ['cleaning'] })} />;

    return (
        <div className="min-h-screen bg-background pb-8 animate-page-enter">
            <div className="max-w-2xl mx-auto px-5 py-4 sm:py-6">

                <PageHeader
                    title="Putzliste"
                    subtitle={format(new Date(), "EEEE, d. MMMM", { locale: de })}
                    menu={(permissions.isManager || permissions.isAdmin) ? [
                        { label: 'Aufgabe anlegen', icon: Plus, onClick: () => setModalOpen(true) },
                        { label: 'Bereiche verwalten', icon: Settings, onClick: () => setAreasOpen(true) },
                        { label: 'Berichte', icon: FileText, onClick: () => setReportsModalOpen(true) },
                        { label: 'Tag beenden', icon: Archive, onClick: () => setEndDayDialogOpen(true), destructive: true, separator: true },
                    ] : []}
                />
                <AreasManager open={areasOpen} onOpenChange={setAreasOpen} />

                {/* ── Fortschritt ─────────────────────────────────────── */}
                <div className="rounded-xl border bg-card p-3 mb-4 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-foreground">
                            {completedCount}/{tasks.length} erledigt
                        </span>
                        <span className={`text-sm font-bold ${progress === 100 ? 'text-status-ok' : progress >= 50 ? 'text-primary' : 'text-muted-foreground'}`}>
                            {progress}%
                        </span>
                    </div>
                    <Progress value={progress} className="h-2 rounded-full" />
                    {progress === 100 && (
                        <p className="text-xs text-status-ok mt-1.5 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Alles erledigt — super gemacht!
                        </p>
                    )}
                </div>

                {/* ── Ansicht: Offene Aufgaben heute (Standard) / Alle ───── */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                        onClick={() => setView('open')}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                            view === 'open' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                    >
                        Offene Aufgaben heute ({openCount})
                    </button>
                    <button
                        onClick={() => setView('all')}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                            view === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                    >
                        Alle ({tasks.length})
                    </button>
                </div>

                {view === 'open' && (
                    <>
                        <WeekdayTasksSection
                            tasks={weekdayTasks}
                            nextWeekTasks={weekdayTasksNextWeek}
                            onComplete={handleComplete}
                            disabled={permissions.isTerminal}
                        />
                        <OpenTasksToday
                            tasks={regularTasks}
                            onComplete={handleComplete}
                            onBulkComplete={handleBulkComplete}
                            disabled={permissions.isTerminal}
                        />
                    </>
                )}

                {/* ── Bereich-Tabs ─────────────────────────────────────── */}
                {view === 'all' && taskAreas.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
                        <button
                            onClick={() => setActiveArea('all')}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                activeArea === 'all'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-accent'
                            }`}
                        >
                            Alle ({tasks.length})
                        </button>
                        {taskAreas.map(area => {
                            const areaTotal = tasks.filter(t => t.area === area).length;
                            const areaDone = tasks.filter(t => t.area === area && t.is_completed).length;
                            return (
                                <button
                                    key={area}
                                    onClick={() => setActiveArea(area)}
                                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                                        activeArea === area
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-accent'
                                    }`}
                                >
                                    {area}
                                    {areaDone === areaTotal && areaTotal > 0 && (
                                        <CheckCircle2 className="w-3 h-3 text-status-ok" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ── Aufgabenliste (nach Bereich gruppiert) ─────────────── */}
                <div className={view === 'open' ? 'hidden' : 'space-y-4'}>
                    {filteredTasks.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Keine Aufgaben in diesem Bereich</p>
                        </div>
                    )}
                    {groupedTasks.map(group => (
                        <div key={group.area}>
                            {/* Bereichs-Header mit Bulk-Button */}
                            <div className="flex items-center justify-between mb-2 px-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-sm text-foreground">{group.area}</h3>
                                    <Badge variant="outline" className={cn(
                                        "text-xs",
                                        group.done.length === group.tasks.length
                                            ? "border-status-ok/70 text-status-ok"
                                            : "border-border/70 text-muted-foreground"
                                    )}>
                                        {group.done.length}/{group.tasks.length}
                                    </Badge>
                                </div>
                                {group.open.length > 0 && (
                                    <button
                                        onClick={() => handleBulkComplete(group.tasks)}
                                        className="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/5"
                                        title="Alle offenen Aufgaben dieses Bereichs als erledigt markieren"
                                    >
                                        Alle erledigen
                                    </button>
                                )}
                            </div>

                            {/* Aufgaben-Zeilen */}
                            <div className="space-y-2">
                                {group.open.map(task => (
                                    <SwipeRow
                                        key={task.id}
                                        onSwipeRight={() => handleComplete(task)}
                                        revealColorRight="bg-status-ok/70"
                                        revealIconRight={Check}
                                        disabled={permissions.isTerminal}
                                        contentClassName="rounded-xl"
                                    >
                                        <button
                                            onClick={() => handleComplete(task)}
                                            className="w-full flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-[0.98] text-left bg-card border-border hover:border-primary/40 shadow-sm"
                                        >
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all border-border" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm leading-tight text-foreground">
                                                    {task.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{task.area} · {task.frequency}</p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                        </button>
                                    </SwipeRow>
                                ))}
                                {group.done.map(task => (
                                    <button
                                        key={task.id}
                                        onClick={() => handleComplete(task)}
                                        className="w-full flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-[0.98] text-left bg-muted/50 border-border/50 opacity-60"
                                    >
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all bg-status-ok/70 border-status-ok/70">
                                            <CheckCircle2 className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm leading-tight line-through text-muted-foreground">
                                                {task.title}
                                            </p>
                                            {task.completed_by && (
                                                <p className="text-xs text-muted-foreground mt-0.5">✓ {task.completed_by}</p>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Berichte Modal ───────────────────────────────────── */}
                <Dialog open={reportsModalOpen} onOpenChange={setReportsModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>Nachtberichte</DialogTitle></DialogHeader>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {reports.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Noch keine Berichte</p>}
                            {averageDemandRate !== null && (
                                <p className="text-xs text-muted-foreground px-1">
                                    Ø an Bedarfstagen: <span className="font-semibold text-foreground">{averageDemandRate}%</span> · Werktage zählen nicht mit
                                </p>
                            )}
                            {reports.map(r => (
                                <div key={r.id} className="rounded-lg border bg-card p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-sm">{reportNightLabel(r)}</span>
                                        {r.required === false ? (
                                            <Badge variant="outline" className="text-muted-foreground">kein Bedarf</Badge>
                                        ) : (
                                            <Badge variant={r.completion_rate === 100 ? 'default' : 'secondary'}>
                                                {r.completion_rate ?? 0}%
                                            </Badge>
                                        )}
                                    </div>
                                    {r.required === false ? (
                                        <p className="text-xs text-muted-foreground">Nacht ohne Bedarf — zählt nicht in die Quote</p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            {r.completed_tasks ?? 0}/{r.total_tasks ?? 0} Aufgaben erledigt{r.demand_reason ? ` · ${r.demand_reason}` : ''}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* ── Neue Aufgabe Modal ───────────────────────────────── */}
                <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>Neue Aufgabe</DialogTitle></DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <Input
                                placeholder="Aufgabe (z.B. Theke reinigen)"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                            <Select value={formData.area} onValueChange={v => setFormData({ ...formData, area: v })}>
                                <SelectTrigger><SelectValue placeholder="Bereich" /></SelectTrigger>
                                <SelectContent>
                                    {areas.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                                    {['Theke','Bar','WC','Eingang','Lager'].map(a => (
                                        !areas.find(x => x.name === a) && <SelectItem key={a} value={a}>{a}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={formData.frequency} onValueChange={v => setFormData({ ...formData, frequency: v })}>
                                <SelectTrigger><SelectValue placeholder="Häufigkeit" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="täglich">Täglich</SelectItem>
                                    <SelectItem value="wöchentlich">Wöchentlich</SelectItem>
                                    <SelectItem value="monatlich">Monatlich</SelectItem>
                                    <SelectItem value="einmalig">Einmalig</SelectItem>
                                </SelectContent>
                            </Select>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Abbrechen</Button>
                                <Button type="submit" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Wird gespeichert…' : 'Erstellen'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* ── Tag beenden Dialog ───────────────────────────────── */}
                <Dialog open={endDayDialogOpen} onOpenChange={setEndDayDialogOpen}>
                    <DialogContent className="sm:max-w-sm">
                        <DialogHeader><DialogTitle>Tag abschließen?</DialogTitle></DialogHeader>
                        <p className="text-sm text-muted-foreground">
                            Tagesbericht wird gespeichert und alle täglichen Aufgaben werden zurückgesetzt.
                            Abgeschlossen: <strong>{completedCount}/{tasks.filter(t => t.frequency === 'täglich').length}</strong> tägl. Aufgaben.
                        </p>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setEndDayDialogOpen(false)}>Abbrechen</Button>
                            <Button variant="destructive" onClick={endDay} disabled={endDayLoading}>
                                {endDayLoading ? 'Wird verarbeitet…' : 'Tag abschließen'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

        </div>
    );
}