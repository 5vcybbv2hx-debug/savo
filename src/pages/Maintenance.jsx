import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { STALE } from '@/lib/queryUtils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Plus, Wrench, CheckCircle2, AlertCircle, Clock, ChevronRight,
    ChevronDown, History, User, X, Save, AlertTriangle
} from "lucide-react";
import MaintenanceModal from "../components/maintenance/MaintenanceModal";
import { usePermissions } from "../components/auth/usePermissions";
import PermissionDenied from "../components/auth/PermissionDenied";
import {
    getTaskStatus, sortTasksByUrgency,
    calculateNextMaintenance, formatRelativeDate,
    STATUS_CONFIG, CATEGORY_ICONS,
} from "@/lib/maintenanceUtils";
import { cn } from "@/lib/utils";
import { haptics } from "@/components/utils/haptics";
import { toast } from "sonner";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getUserDisplayName } from '@/lib/userDisplayName';

// ── "Erledigt"-Modal mit Notiz-Eingabe ───────────────────────────────────────
function CompleteModal({ task, onConfirm, onClose }) {
    const [note, setNote] = useState('');
    const status = getTaskStatus(task);
    const cfg = STATUS_CONFIG[status];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <h2 className="font-bold text-foreground">Wartung erledigt</h2>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="rounded-xl bg-secondary/40 px-4 py-3">
                        <p className="font-semibold text-foreground text-sm">{task.equipment_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{task.task_description}</p>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                            Notiz <span className="font-normal">(optional)</span>
                        </label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="z.B. Filter getauscht, Riemen geprüft…"
                            rows={3}
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary/30 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-green-500/40 placeholder:text-muted-foreground"
                        />
                    </div>
                </div>
                <div className="flex gap-2 px-5 py-4 border-t border-border">
                    <Button variant="outline" onClick={onClose} className="flex-1 h-11">Abbrechen</Button>
                    <Button
                        onClick={() => onConfirm(note.trim())}
                        className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white"
                    >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        Als erledigt markieren
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ count, label, colorClass, icon: Icon, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex-1 rounded-2xl p-3 flex flex-col items-center gap-1 border transition-all",
                active ? "ring-2 ring-offset-2 ring-offset-background scale-105" : "border-border hover:border-primary/40",
                colorClass
            )}
        >
            <Icon className="w-5 h-5" />
            <span className="text-2xl font-bold leading-none">{count}</span>
            <span className="text-xs font-medium leading-tight text-center">{label}</span>
        </button>
    );
}

// ── Task Card ────────────────────────────────────────────────────────────────
function MaintenanceCard({ task, onEdit, onComplete, canEdit, employees }) {
    const [historyOpen, setHistoryOpen] = useState(false);
    const status = getTaskStatus(task);
    const cfg    = STATUS_CONFIG[status];
    const nextLabel = formatRelativeDate(task.next_maintenance);
    const history = task.history || [];
    const hasHistory = history.length > 0;

    const overdueDays = useMemo(() => {
        if (status !== 'überfällig' || !task.next_maintenance) return 0;
        const today = new Date(); today.setHours(0,0,0,0);
        const next  = new Date(task.next_maintenance);
        return Math.abs(Math.ceil((next - today) / (1000 * 60 * 60 * 24)));
    }, [status, task.next_maintenance]);

    return (
        <div className={cn("rounded-2xl border bg-card overflow-hidden border-l-4", cfg.border, "border-border/60")}>

            {/* Überfällig-Banner */}
            {status === 'überfällig' && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border-b border-red-500/20">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-sm font-bold text-red-500">
                        Überfällig seit {overdueDays} {overdueDays === 1 ? 'Tag' : 'Tagen'}
                    </p>
                </div>
            )}

            {/* Inhalt */}
            <div className="px-4 pt-4 pb-3">
                <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", cfg.badge)}>
                                {cfg.label}
                            </span>
                            {task.category && (
                                <span className="text-xs text-muted-foreground">{CATEGORY_ICONS[task.category] || '🔧'} {task.category}</span>
                            )}
                        </div>
                        <h3 className="text-base font-bold text-foreground leading-snug">{task.equipment_name}</h3>
                        {task.task_description && (
                            <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{task.task_description}</p>
                        )}
                    </div>
                </div>

                {/* Meta-Grid */}
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nächste Wartung</p>
                        <p className={cn("text-sm font-bold", cfg.text)}>{nextLabel}</p>
                    </div>
                    {task.last_maintenance && (
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Zuletzt</p>
                            <p className="text-sm text-foreground">
                                {new Date(task.last_maintenance).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                    )}
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Intervall</p>
                        <p className="text-sm text-foreground capitalize">{task.frequency}</p>
                    </div>
                    {task.responsible && (
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Zuständig</p>
                            <p className="text-sm text-foreground flex items-center gap-1">
                                <User className="w-3 h-3 shrink-0" />{task.responsible}
                            </p>
                        </div>
                    )}
                    {task.completion_notes && (
                        <div className="col-span-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Letzte Notiz</p>
                            <p className="text-sm text-foreground italic">„{task.completion_notes}"</p>
                        </div>
                    )}
                </div>

                {/* Historie Toggle */}
                {hasHistory && (
                    <button
                        onClick={() => setHistoryOpen(o => !o)}
                        className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <History className="w-3.5 h-3.5" />
                        {historyOpen ? 'Historie schließen' : `${history.length} Einträge`}
                        <ChevronDown className={cn("w-3 h-3 transition-transform", historyOpen && "rotate-180")} />
                    </button>
                )}

                {/* Historie */}
                {historyOpen && (
                    <div className="mt-2 space-y-1.5">
                        {[...history].reverse().slice(0, 10).map((h, i) => (
                            <div key={i} className="flex gap-3 px-3 py-2 rounded-xl bg-secondary/30 text-xs">
                                <div className="w-1 rounded-full bg-green-500/60 shrink-0 self-stretch" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-foreground">
                                        {h.date ? new Date(h.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) : '–'}
                                        {h.done_by && <span className="text-muted-foreground font-normal"> · {h.done_by}</span>}
                                    </p>
                                    {h.note && <p className="text-muted-foreground mt-0.5 italic">„{h.note}"</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            {canEdit && (
                <div className="px-4 pb-4 flex gap-2 border-t border-border/30 pt-3">
                    {status !== 'ok' && (
                        <Button
                            size="sm"
                            onClick={() => { haptics.medium(); onComplete(task); }}
                            className="flex-1 h-10 rounded-xl gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Erledigt
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { haptics.light(); onEdit(task); }}
                        className={cn("h-10 rounded-xl gap-1", status === 'ok' ? 'flex-1' : 'px-4')}
                    >
                        Bearbeiten <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
}

// ── Haupt-Seite ──────────────────────────────────────────────────────────────
export default function MaintenancePage() {
    const permissions  = usePermissions();
    const queryClient  = useQueryClient();

    const [selectedTask,   setSelectedTask]   = useState(null);
    const [showModal,      setShowModal]      = useState(false);
    const [activeFilter,   setActiveFilter]   = useState('alle');
    const [completeTarget, setCompleteTarget] = useState(null); // task zum Erledigen
    const [openCategories, setOpenCategories] = useState(new Set(['Sicherheit','Technik','Hygiene','Elektrik','Sonstiges']));

    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['maintenance-tasks'],
        queryFn:  () => base44.entities.MaintenanceTask.filter({ is_active: true }),
        staleTime: STALE.MEDIUM,
    });

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me(),
        staleTime: STALE.SLOW,
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees-active'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: STALE.SLOW,
    });

    const completeMutation = useMutation({
        mutationFn: async ({ task, note }) => {
            const today    = new Date().toISOString().split('T')[0];
            const nextDate = calculateNextMaintenance(today, task.frequency);
            const doneBy   = getUserDisplayName({ employeeName: permissions.employeeName, user });

            const newHistoryEntry = {
                date:    today,
                done_by: doneBy,
                note:    note || '',
            };
            const updatedHistory = [...(task.history || []), newHistoryEntry];

            return base44.entities.MaintenanceTask.update(task.id, {
                last_maintenance:  today,
                next_maintenance:  nextDate,
                status:            'erledigt',
                completion_notes:  note || '',
                history:           updatedHistory,
            });
        },
        onSuccess: () => {
            haptics.success();
            toast.success('Wartung erledigt ✓');
            queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
            setCompleteTarget(null);
        },
        onError: () => toast.error('Fehler beim Speichern'),
    });

    // ── Derived ───────────────────────────────────────────────────────────────
    const overdueCount  = useMemo(() => tasks.filter(t => getTaskStatus(t) === 'überfällig').length,  [tasks]);
    const dueSoonCount  = useMemo(() => tasks.filter(t => getTaskStatus(t) === 'bald fällig').length, [tasks]);
    const okCount       = useMemo(() => tasks.filter(t => getTaskStatus(t) === 'ok').length,          [tasks]);

    const filteredTasks = useMemo(() => {
        const base = activeFilter === 'alle' ? tasks : tasks.filter(t => getTaskStatus(t) === activeFilter);
        return sortTasksByUrgency(base);
    }, [tasks, activeFilter]);

    // Gruppiert nach Kategorie
    const tasksByCategory = useMemo(() => {
        const CATEGORY_ORDER = ['Sicherheit', 'Technik', 'Hygiene', 'Elektrik', 'Sonstiges'];
        const map = new Map();
        filteredTasks.forEach(t => {
            const cat = t.category || 'Sonstiges';
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat).push(t);
        });
        return Array.from(map.entries()).sort(([a], [b]) => {
            const ia = CATEGORY_ORDER.indexOf(a);
            const ib = CATEGORY_ORDER.indexOf(b);
            if (ia === -1 && ib === -1) return a.localeCompare(b);
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });
    }, [filteredTasks]);

    const toggleCategory = (name) => setOpenCategories(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
    });

    const openModal = (task = null) => { setSelectedTask(task); setShowModal(true); };

    if (permissions.loading) return (
        <div className="flex justify-center items-center p-12">
            <div className="w-8 h-8 border-4 border-border border-t-amber-500 rounded-full animate-spin" />
        </div>
    );
    if (!permissions.isManager) return <PermissionDenied />;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 space-y-4">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="page-title flex items-center gap-2">
                            <Wrench className="w-5 h-5 text-amber-500" />
                            Wartung
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">Wartungsintervalle & Prüfpflichten</p>
                    </div>
                    {permissions.canEditEmployees && (
                        <Button
                            onClick={() => openModal()}
                            className="h-10 rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            Neu
                        </Button>
                    )}
                </div>

                {/* ── Stat Pills (anklickbar als Filter) ─────────────────── */}
                <div className="flex gap-2">
                    <StatPill
                        count={overdueCount}
                        label="Überfällig"
                        colorClass="bg-red-500/10 text-red-500 border-red-500/30"
                        icon={AlertCircle}
                        active={activeFilter === 'überfällig'}
                        onClick={() => setActiveFilter(f => f === 'überfällig' ? 'alle' : 'überfällig')}
                    />
                    <StatPill
                        count={dueSoonCount}
                        label="Bald fällig"
                        colorClass="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                        icon={Clock}
                        active={activeFilter === 'bald fällig'}
                        onClick={() => setActiveFilter(f => f === 'bald fällig' ? 'alle' : 'bald fällig')}
                    />
                    <StatPill
                        count={okCount}
                        label="OK"
                        colorClass="bg-green-500/10 text-green-500 border-green-500/30"
                        icon={CheckCircle2}
                        active={activeFilter === 'ok'}
                        onClick={() => setActiveFilter(f => f === 'ok' ? 'alle' : 'ok')}
                    />
                </div>

                {/* ── Filter aktiv Badge ──────────────────────────────────── */}
                {activeFilter !== 'alle' && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Filter:</span>
                        <button
                            onClick={() => setActiveFilter('alle')}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
                        >
                            {activeFilter} <X className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {/* ── Loading ─────────────────────────────────────────────── */}
                {isLoading && (
                    <div className="space-y-2">
                        {[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}
                    </div>
                )}

                {/* ── Kategorie-Akkordeons ────────────────────────────────── */}
                {!isLoading && tasksByCategory.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                        <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-semibold text-foreground">Keine Wartungsaufgaben</p>
                        <p className="text-sm mt-1">
                            {activeFilter !== 'alle' ? 'Kein Eintrag in dieser Kategorie.' : 'Noch keine Wartungsaufgaben angelegt.'}
                        </p>
                    </div>
                )}

                <div className="space-y-2">
                    {tasksByCategory.map(([category, catTasks]) => {
                        const isOpen = openCategories.has(category);
                        const catOverdue  = catTasks.filter(t => getTaskStatus(t) === 'überfällig').length;
                        const catDueSoon  = catTasks.filter(t => getTaskStatus(t) === 'bald fällig').length;

                        return (
                            <div key={category} className="rounded-2xl border border-border bg-card overflow-hidden">
                                {/* Kategorie-Header */}
                                <button
                                    onClick={() => toggleCategory(category)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3.5 min-h-[56px] text-left transition-colors",
                                        isOpen ? "bg-secondary/40" : "hover:bg-secondary/20"
                                    )}
                                >
                                    <span className="text-xl shrink-0">{CATEGORY_ICONS[category] || '🔧'}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-foreground">{category}</p>
                                        <p className="text-xs text-muted-foreground">{catTasks.length} Einträge</p>
                                    </div>

                                    {/* Status-Badges */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {catOverdue > 0 && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-500">
                                                {catOverdue} ⚠
                                            </span>
                                        )}
                                        {catDueSoon > 0 && catOverdue === 0 && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500">
                                                {catDueSoon} bald
                                            </span>
                                        )}
                                        {catOverdue === 0 && catDueSoon === 0 && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-500">✓</span>
                                        )}
                                        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-90")} />
                                    </div>
                                </button>

                                {/* Task-Karten */}
                                {isOpen && (
                                    <div className="border-t border-border p-3 space-y-2">
                                        {catTasks.map(task => (
                                            <MaintenanceCard
                                                key={task.id}
                                                task={task}
                                                employees={employees}
                                                canEdit={permissions.canEditEmployees}
                                                onEdit={openModal}
                                                onComplete={setCompleteTarget}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Modals ─────────────────────────────────────────────────── */}
            {showModal && (
                <MaintenanceModal
                    task={selectedTask}
                    open={showModal}
                    onClose={() => { setShowModal(false); setSelectedTask(null); }}
                />
            )}

            {completeTarget && (
                <CompleteModal
                    task={completeTarget}
                    onConfirm={(note) => completeMutation.mutate({ task: completeTarget, note })}
                    onClose={() => setCompleteTarget(null)}
                />
            )}
        </div>
    );
}