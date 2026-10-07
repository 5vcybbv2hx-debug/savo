import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';
import { LoadingState, ErrorState } from '@/components/ui/StateDisplay';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Plus, Sparkles, FileText, Cloud, CloudOff, CheckCircle2,
    Circle, ChevronRight, RefreshCw, Trash2, Archive, Check
} from 'lucide-react';
import SwipeRow from '@/components/ui/SwipeRow';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import AreasManager from '@/components/cleaning/AreasManager';
import PinVerification from '@/components/terminal/PinVerification';
import { usePermissions } from '@/components/auth/usePermissions';
import { getUserDisplayName } from '@/lib/userDisplayName';
import { toast } from 'sonner';

export default function Cleaning() {
    const queryClient = useQueryClient();
    const permissions = usePermissions();
    const [modalOpen, setModalOpen] = useState(false);
    const [reportsModalOpen, setReportsModalOpen] = useState(false);
    const [endDayDialogOpen, setEndDayDialogOpen] = useState(false);
    const [endDayLoading, setEndDayLoading] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [pinModalOpen, setPinModalOpen] = useState(false);
    const [activeArea, setActiveArea] = useState('all');
    const WEEKDAYS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
    const [formData, setFormData] = useState({
        title: '', area: 'Theke', frequency: 'täglich',
        due_weekdays: [], due_date: '', assigned_to: '', assigned_to_name: '',
    });
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingUpdates, setPendingUpdates] = useState([]);

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

    const todayName = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][new Date().getDay()];
    const currentMonth = new Date().getMonth() + 1;
    const isSeason = currentMonth >= 4 && currentMonth <= 10;
    const areas = allAreas.filter(area => !area.seasonal || isSeason);

    const tasks = allTasks.filter(t => {
        if (t.area === 'Wochentagsaufgaben') return false;
        if (t.due_weekdays && t.due_weekdays.length > 0 && !t.due_weekdays.includes(todayName)) return false;
        return true;
    });

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
    const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

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

    const handleComplete = (task) => {
        if (permissions.isTerminal && !task.is_completed) {
            setSelectedTask(task);
            setPinModalOpen(true);
        } else {
            const displayName = getUserDisplayName({ employeeName: permissions.employeeName, user });
            updateMutation.mutate({
                id: task.id,
                data: {
                    is_completed: !task.is_completed,
                    completed_by: task.is_completed ? null : displayName,
                    completed_at: task.is_completed ? null : new Date().toISOString()
                }
            });
        }
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

    const handlePinVerified = async (pin) => {
        const employee = employees.find(e => e.pin === pin);
        if (!employee) { toast.error('Falsche PIN — bitte nochmal versuchen'); return; }
        const displayName = employee.name.split(' ').reverse().join(', ');
        await updateMutation.mutateAsync({
            id: selectedTask.id,
            data: { is_completed: true, completed_by: displayName, completed_at: new Date().toISOString() }
        });
        setPinModalOpen(false);
        setSelectedTask(null);
    };

    const endDay = async () => {
        setEndDayLoading(true);
        try {
            const today = new Date();
            const completedTasks = tasks.filter(t =>
                t.is_completed && t.completed_at &&
                format(new Date(t.completed_at), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
            );
            const dailyTasksTotal = tasks.filter(t => t.frequency === 'täglich');
            await base44.entities.CleaningReport.create({
                week_start: format(today, 'yyyy-MM-dd'),
                week_end: format(today, 'yyyy-MM-dd'),
                report_data: completedTasks.map(t => ({ task_title: t.title, area: t.area, frequency: t.frequency, completed_by: t.completed_by, completed_at: t.completed_at })),
                total_tasks: dailyTasksTotal.length,
                completed_tasks: completedTasks.length,
                completion_rate: dailyTasksTotal.length > 0 ? Math.round((completedTasks.length / dailyTasksTotal.length) * 100) : 0
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
        <div className="min-h-screen bg-background pb-32 md:pb-8 animate-page-enter">
            <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">

                {/* ── Header ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Putzliste</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            {format(new Date(), "EEEE, d. MMMM", { locale: de })}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isOnline
                            ? <Cloud className="w-4 h-4 text-emerald-500" />
                            : <CloudOff className="w-4 h-4 text-amber-500" />}
                        {(permissions.isManager || permissions.isAdmin) && (
                            <AreasManager />
                        )}
                        {(permissions.isManager || permissions.isAdmin) && (
                            <Button size="sm" variant="outline" onClick={() => setModalOpen(true)} className="h-9 gap-1">
                                <Plus className="w-4 h-4" /> Aufgabe
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Fortschritt ─────────────────────────────────────── */}
                <div className="rounded-xl border bg-card p-4 mb-5 shadow-sm">
                    <div className="flex items-end justify-between mb-2">
                        <div>
                            <span className="text-3xl font-bold text-foreground">{completedCount}</span>
                            <span className="text-lg text-muted-foreground">/{tasks.length}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">Aufgaben erledigt</p>
                        </div>
                        <div className="text-right">
                            <span className={`text-2xl font-bold ${progress === 100 ? 'text-emerald-500' : progress >= 50 ? 'text-primary' : 'text-muted-foreground'}`}>
                                {progress}%
                            </span>
                        </div>
                    </div>
                    <Progress value={progress} className="h-3 rounded-full" />
                    {progress === 100 && (
                        <p className="text-xs text-emerald-500 mt-2 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Alles erledigt — super gemacht!
                        </p>
                    )}
                </div>

                {/* ── Bereich-Tabs ─────────────────────────────────────── */}
                {taskAreas.length > 1 && (
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
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ── Aufgabenliste (nach Bereich gruppiert) ─────────────── */}
                <div className="space-y-4">
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
                                            ? "border-emerald-500 text-emerald-500"
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
                                        onSwipe={() => handleComplete(task)}
                                        revealColor="bg-emerald-600"
                                        revealIcon={Check}
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
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all bg-emerald-500 border-emerald-500">
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
                        <DialogHeader><DialogTitle>Tagesberichte</DialogTitle></DialogHeader>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {reports.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Noch keine Berichte</p>}
                            {reports.map(r => (
                                <div key={r.id} className="rounded-lg border bg-card p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-sm">{format(new Date(r.week_start), "dd. MMM yyyy", { locale: de })}</span>
                                        <Badge variant={r.completion_rate === 100 ? 'default' : 'secondary'}>
                                            {r.completion_rate}%
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{r.completed_tasks}/{r.total_tasks} Aufgaben erledigt</p>
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

                {/* ── PIN Modal ────────────────────────────────────────── */}
                {pinModalOpen && (
                    <PinVerification
                        onVerified={handlePinVerified}
                        onCancel={() => { setPinModalOpen(false); setSelectedTask(null); }}
                        title="PIN eingeben um abzuhaken"
                    />
                )}

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

            {/* ── Fixierter "Tag beenden"-Button ───────────────────────── */}
            {(permissions.isManager || permissions.isAdmin) && (
                <div className="fixed bottom-[6.5rem] md:bottom-6 left-0 right-0 px-4 flex justify-center gap-2 pointer-events-none z-40">
                    <div className="flex items-center gap-2 pointer-events-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 gap-1 shadow-lg bg-card"
                            onClick={() => setReportsModalOpen(true)}
                        >
                            <FileText className="w-4 h-4" /> Berichte
                        </Button>
                        <Button
                            size="default"
                            className="h-12 px-6 gap-2 shadow-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold rounded-2xl"
                            onClick={() => setEndDayDialogOpen(true)}
                        >
                            <Archive className="w-4 h-4" />
                            Tag beenden
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}