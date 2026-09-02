import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import {
    CheckCircle2, Circle, Users, RotateCcw, ChevronDown, ChevronRight,
    Trophy, Plus, Pencil, Trash2, GripVertical, BookOpen, X, Check,
    ChevronUp, Settings, Save, AlertCircle, ChevronLeft, PenLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/components/auth/usePermissions';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getUserDisplayName } from '@/lib/userDisplayName';

// ── Farb-Palette für Kategorien ───────────────────────────────────────────────
const COLOR_OPTIONS = [
    { key: 'blue',   label: 'Blau',   ring: 'ring-blue-500',   bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/30' },
    { key: 'amber',  label: 'Amber',  ring: 'ring-amber-500',  bg: 'bg-amber-500/15',  text: 'text-amber-400',  border: 'border-amber-500/30' },
    { key: 'cyan',   label: 'Cyan',   ring: 'ring-cyan-500',   bg: 'bg-cyan-500/15',   text: 'text-cyan-400',   border: 'border-cyan-500/30' },
    { key: 'orange', label: 'Orange', ring: 'ring-orange-500', bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
    { key: 'stone',  label: 'Stone',  ring: 'ring-stone-500',  bg: 'bg-stone-500/15',  text: 'text-stone-400',  border: 'border-stone-500/30' },
    { key: 'purple', label: 'Lila',   ring: 'ring-purple-500', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
    { key: 'green',  label: 'Grün',   ring: 'ring-green-500',  bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-500/30' },
    { key: 'rose',   label: 'Rosa',   ring: 'ring-rose-500',   bg: 'bg-rose-500/15',   text: 'text-rose-400',   border: 'border-rose-500/30' },
];

function getColorCfg(colorKey) {
    return COLOR_OPTIONS.find(c => c.key === colorKey) || COLOR_OPTIONS[0];
}

// ── Vollbild-Ansicht für Anleitungs-Seiten ────────────────────────────────────
function InstructionLightbox({ lightbox, onClose, onNavigate }) {
    const touchStartX = React.useRef(null);
    if (!lightbox?.images?.length) return null;
    const { images, index } = lightbox;

    const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const handleTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 50) onNavigate(delta < 0 ? 1 : -1);
        touchStartX.current = null;
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-sm"
            onClick={onClose}
        >
            {/* Kopfzeile: Seiten-Zähler + Schließen */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
                <span className="text-white/80 text-sm font-medium">{index + 1} / {images.length}</span>
                <button onClick={onClose} className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Bild mit Swipe */}
            <div
                className="flex-1 flex items-center justify-center overflow-auto p-3"
                onClick={onClose}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <img
                    src={images[index]}
                    alt={`Anleitung Seite ${index + 1}`}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                    onClick={e => e.stopPropagation()}
                    onDoubleClick={e => {
                        if (e.target.requestFullscreen) e.target.requestFullscreen().catch(() => {});
                    }}
                />
            </div>

            {/* Blättern */}
            {images.length > 1 && (
                <div className="flex items-center justify-between px-4 pb-6 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => onNavigate(-1)}
                        disabled={index === 0}
                        className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex gap-1.5">
                        {images.length <= 8 && images.map((_, i) => (
                            <span key={i} className={cn('w-1.5 h-1.5 rounded-full transition-all', i === index ? 'bg-amber-500 scale-125' : 'bg-white/30')} />
                        ))}
                    </div>
                    <button
                        onClick={() => onNavigate(1)}
                        disabled={index === images.length - 1}
                        className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Task-Edit Modal ───────────────────────────────────────────────────────────
function TaskEditModal({ task, categories, onSave, onClose }) {
    const [title, setTitle]               = useState(task?.title || '');
    const [description, setDescription]   = useState(task?.description || '');
    const [instructions, setInstructions] = useState(task?.instructions || '');
    const [category, setCategory]         = useState(task?.category || (categories[0]?.name || ''));
    const isNew = !task?.id;

    const canSave = title.trim().length > 0 && category.trim().length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-card border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <h2 className="font-bold text-foreground">{isNew ? 'Neue Aufgabe' : 'Aufgabe bearbeiten'}</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Kategorie */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Kategorie</label>
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/30 text-sm text-foreground"
                        >
                            {categories.map(cat => (
                                <option key={cat.name} value={cat.name}>{cat.icon} {cat.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Titel */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Titel *</label>
                        <Input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="z.B. Kassenabschluss durchführen"
                            className="h-10"
                        />
                    </div>

                    {/* Kurzbeschreibung */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Kurzbeschreibung <span className="font-normal text-muted-foreground">(optional)</span></label>
                        <Input
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Kurze Zusammenfassung was zu tun ist"
                            className="h-10"
                        />
                    </div>

                    {/* Anleitung */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                            Anleitung <span className="font-normal text-muted-foreground">(optional, für Mitarbeiter ausklappbar)</span>
                        </label>
                        <textarea
                            value={instructions}
                            onChange={e => setInstructions(e.target.value)}
                            placeholder={"Schritt-für-Schritt-Anleitung:\n1. ...\n2. ...\n3. ..."}
                            rows={6}
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary/30 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Tipp: Nummerierte Schritte (1. 2. 3.) werden besonders übersichtlich dargestellt.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
                    <Button variant="outline" onClick={onClose} className="flex-1 h-11">Abbrechen</Button>
                    <Button
                        onClick={() => canSave && onSave({ title: title.trim(), description: description.trim(), instructions: instructions.trim(), category })}
                        disabled={!canSave}
                        className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                        <Save className="w-4 h-4 mr-1.5" />
                        Speichern
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Category-Edit Modal ───────────────────────────────────────────────────────
function CategoryEditModal({ category, onSave, onClose }) {
    const [name, setName]   = useState(category?.name || '');
    const [icon, setIcon]   = useState(category?.icon || '📋');
    const [color, setColor] = useState(category?.color || 'blue');
    const isNew = !category?.isExisting;

    const EMOJI_SUGGESTIONS = ['🖥️','🫧','☕','🏚️','📦','🍺','🔧','🧹','📋','🎯','💡','🔑','📱','🍽️','🧊'];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <h2 className="font-bold text-foreground">{isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten'}</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Name *</label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Zapfanlage" className="h-10" />
                    </div>

                    {/* Icon */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Icon</label>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-10 h-10 rounded-xl border border-border bg-secondary/30 flex items-center justify-center text-xl">{icon}</div>
                            <Input value={icon} onChange={e => setIcon(e.target.value)} className="h-10 w-20 text-center text-lg" maxLength={2} />
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                            {EMOJI_SUGGESTIONS.map(e => (
                                <button key={e} onClick={() => setIcon(e)}
                                    className={cn('w-9 h-9 rounded-lg border text-lg transition-all', icon === e ? 'border-primary bg-primary/15' : 'border-border hover:border-primary/40')}>
                                    {e}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Farbe */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Farbe</label>
                        <div className="flex gap-2 flex-wrap">
                            {COLOR_OPTIONS.map(c => (
                                <button key={c.key} onClick={() => setColor(c.key)}
                                    className={cn('w-8 h-8 rounded-full border-2 transition-all', c.bg, color === c.key ? `${c.ring} ring-2 ring-offset-2 ring-offset-card scale-110` : 'border-transparent')}>
                                    <span className="sr-only">{c.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 px-5 py-4 border-t border-border">
                    <Button variant="outline" onClick={onClose} className="flex-1 h-11">Abbrechen</Button>
                    <Button
                        onClick={() => name.trim() && onSave({ name: name.trim(), icon, color })}
                        disabled={!name.trim()}
                        className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                        <Save className="w-4 h-4 mr-1.5" />Speichern
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function Onboarding() {
    const permissions  = usePermissions();
    const queryClient  = useQueryClient();

    const [selectedEmployee,   setSelectedEmployee]   = useState(null);
    const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
    const [openCategories,     setOpenCategories]     = useState(new Set());
    const [openInstructions,   setOpenInstructions]   = useState(new Set());
    const [editMode,           setEditMode]           = useState(false);
    const [taskModal,          setTaskModal]          = useState(null); // null | {task} | {category}
    const [categoryModal,      setCategoryModal]      = useState(null);
    const [deleteConfirm,      setDeleteConfirm]      = useState(null);
    const [myEmployee,         setMyEmployee]         = useState(null);
    const [lightbox,           setLightbox]           = useState(null); // { images: [], index }

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: employees = [] } = useQuery({
        queryKey: ['employees-active'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: STALE.SLOW,
    });

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me(),
        staleTime: STALE.SLOW,
    });

    const { data: tasks = [], isLoading: tasksLoading } = useQuery({
        queryKey: ['onboarding-tasks'],
        queryFn: () => base44.entities.OnboardingTask.filter({ is_active: true }, 'order'),
        staleTime: STALE.MEDIUM,
    });

    const activeEmployeeId = permissions.isManager ? selectedEmployee : myEmployee?.id;

    const { data: progress = [] } = useQuery({
        queryKey: ['onboarding-progress', activeEmployeeId],
        queryFn: () => activeEmployeeId
            ? base44.entities.OnboardingProgress.filter({ employee_id: activeEmployeeId })
            : Promise.resolve([]),
        enabled: !!activeEmployeeId,
        staleTime: 30 * 1000,
    });

    // eigenen Mitarbeiter-Datensatz laden (für nicht-Manager)
    React.useEffect(() => {
        if (!permissions.isManager && user?.email) {
            base44.entities.Employee.filter({ email: user.email, is_active: true }).then(emps => {
                if (emps[0]) setMyEmployee(emps[0]);
            });
        }
    }, [permissions.isManager, user?.email]);

    // ── Kategorien dynamisch aus Tasks ableiten ───────────────────────────────
    const categories = useMemo(() => {
        const map = new Map();
        tasks.forEach(t => {
            if (!map.has(t.category)) {
                map.set(t.category, {
                    name: t.category,
                    icon: t.category_icon || '📋',
                    color: t.category_color || 'blue',
                });
            }
        });
        return Array.from(map.values());
    }, [tasks]);

    // ── Mutations ─────────────────────────────────────────────────────────────
    const toggleMutation = useMutation({
        mutationFn: async ({ taskId, taskTitle, taskCategory, employeeId, employeeName, completedBy }) => {
            const existing = progress.find(p => p.task_id === taskId && p.employee_id === employeeId);
            if (existing) {
                await base44.entities.OnboardingProgress.delete(existing.id);
            } else {
                await base44.entities.OnboardingProgress.create({
                    employee_id: employeeId,
                    employee_name: employeeName,
                    task_id: taskId,
                    task_title: taskTitle,
                    task_category: taskCategory,
                    is_completed: true,
                    completed_at: new Date().toISOString(),
                    completed_by: completedBy,
                });
            }
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-progress', activeEmployeeId] }),
    });

    const resetMutation = useMutation({
        mutationFn: async (employeeId) => {
            const toDelete = progress.filter(p => p.employee_id === employeeId);
            await Promise.all(toDelete.map(p => base44.entities.OnboardingProgress.delete(p.id)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['onboarding-progress', activeEmployeeId] });
            toast.success('Einlernliste zurückgesetzt');
        },
    });

    const saveTaskMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            if (id) return base44.entities.OnboardingTask.update(id, data);
            // Neue Aufgabe: order = max + 1 in dieser Kategorie
            const catTasks = tasks.filter(t => t.category === data.category);
            const maxOrder = catTasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
            return base44.entities.OnboardingTask.create({ ...data, order: maxOrder + 1, is_active: true });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
            setTaskModal(null);
            toast.success('Aufgabe gespeichert');
        },
    });

    const deleteTaskMutation = useMutation({
        mutationFn: (id) => base44.entities.OnboardingTask.update(id, { is_active: false }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
            toast.success('Aufgabe entfernt');
        },
    });

    const reorderMutation = useMutation({
        mutationFn: async ({ taskId, direction, category }) => {
            const catTasks = tasks
                .filter(t => t.category === category)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            const idx = catTasks.findIndex(t => t.id === taskId);
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= catTasks.length) return;
            const a = catTasks[idx];
            const b = catTasks[swapIdx];
            await Promise.all([
                base44.entities.OnboardingTask.update(a.id, { order: b.order || swapIdx }),
                base44.entities.OnboardingTask.update(b.id, { order: a.order || idx }),
            ]);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] }),
    });

    const saveCategoryMutation = useMutation({
        mutationFn: async ({ oldName, data }) => {
            if (!oldName) return; // neue Kategorie — wird beim ersten Task gesetzt
            // Alle Tasks dieser Kategorie updaten
            const catTasks = tasks.filter(t => t.category === oldName);
            await Promise.all(catTasks.map(t => base44.entities.OnboardingTask.update(t.id, {
                category: data.name,
                category_icon: data.icon,
                category_color: data.color,
            })));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
            setCategoryModal(null);
            toast.success('Kategorie gespeichert');
        },
    });

    // ── Helpers ───────────────────────────────────────────────────────────────
    const activeEmployeeName = permissions.isManager
        ? employees.find(e => e.id === selectedEmployee)?.name
        : myEmployee?.name;

    const currentUserName = getUserDisplayName({ employeeName: permissions.employeeName, user });

    const isTaskCompleted = (taskId) =>
        progress.some(p => p.task_id === taskId && p.employee_id === activeEmployeeId && p.is_completed);

    const getTaskProgress = (taskId) =>
        progress.find(p => p.task_id === taskId && p.employee_id === activeEmployeeId);

    const getCategoryProgress = (catName) => {
        const catTasks = tasks.filter(t => t.category === catName);
        return { done: catTasks.filter(t => isTaskCompleted(t.id)).length, total: catTasks.length };
    };

    const toggleCategory = (name) => setOpenCategories(prev => {
        const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next;
    });
    const toggleInstructions = (id) => setOpenInstructions(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });

    const totalDone = tasks.filter(t => isTaskCompleted(t.id)).length;
    const totalAll  = tasks.length;
    const pct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

    const formatDate = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' · ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Einlernliste</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">Einarbeitung neuer Mitarbeiter</p>
                    </div>
                    {permissions.isManager && (
                        <button
                            onClick={() => setEditMode(e => !e)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all min-h-[36px]',
                                editMode
                                    ? 'bg-amber-500 border-amber-500 text-white'
                                    : 'border-border text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Settings className="w-3.5 h-3.5" />
                            {editMode ? 'Fertig' : 'Bearbeiten'}
                        </button>
                    )}
                </div>

                {/* ── Manager: Mitarbeiter-Picker ─────────────────────────── */}
                {permissions.isManager && (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                        {/* Picker-Header — immer sichtbar */}
                        <button
                            onClick={() => setEmployeePickerOpen(o => !o)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[56px] hover:bg-secondary/30 transition-colors"
                        >
                            <Users className="w-4 h-4 text-amber-500 shrink-0" />
                            <div className="flex-1 text-left">
                                <p className="text-sm font-semibold text-foreground">
                                    {selectedEmployee
                                        ? activeEmployeeName
                                        : 'Mitarbeiter auswählen'}
                                </p>
                                {selectedEmployee && (
                                    <p className="text-xs text-muted-foreground">{pct}% abgeschlossen · {totalDone}/{totalAll} Aufgaben</p>
                                )}
                            </div>
                            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', employeePickerOpen && 'rotate-180')} />
                        </button>

                        {/* Ausklappbare Mitarbeiterliste */}
                        {employeePickerOpen && (
                            <div className="border-t border-border p-3">
                                <div className="flex flex-wrap gap-2">
                                    {employees.map(emp => {
                                        const empDone = tasks.filter(t =>
                                            progress.some(p => p.task_id === t.id && p.employee_id === emp.id && p.is_completed)
                                        ).length;
                                        const empPct = totalAll > 0 ? Math.round((empDone / totalAll) * 100) : 0;
                                        const isSelected = selectedEmployee === emp.id;
                                        return (
                                            <button
                                                key={emp.id}
                                                onClick={() => { setSelectedEmployee(emp.id); setEmployeePickerOpen(false); setOpenCategories(new Set()); }}
                                                className={cn(
                                                    'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all min-h-[40px]',
                                                    isSelected
                                                        ? 'bg-amber-500 text-slate-900 border-amber-500'
                                                        : 'bg-secondary/40 border-border text-muted-foreground hover:border-amber-500/50 hover:text-foreground'
                                                )}
                                            >
                                                {emp.name}
                                                <span className={cn(
                                                    'text-xs px-1.5 py-0.5 rounded-full font-bold',
                                                    isSelected ? 'bg-black/20 text-slate-900' : empPct === 100 ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'
                                                )}>
                                                    {empPct}%
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {selectedEmployee && (
                                    <button
                                        onClick={() => {
                                            if (confirm('Einlernliste für diesen Mitarbeiter zurücksetzen?')) {
                                                resetMutation.mutate(selectedEmployee);
                                            }
                                        }}
                                        className="mt-3 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Fortschritt zurücksetzen
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Kein Mitarbeiter / Kein Zugriff ────────────────────── */}
                {permissions.isManager && !selectedEmployee && !editMode && (
                    <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-semibold text-foreground">Mitarbeiter auswählen</p>
                        <p className="text-sm mt-1">Wähle oben einen Mitarbeiter aus, um seine Einlernliste zu sehen.</p>
                    </div>
                )}

                {/* ── Gesamtfortschritt ───────────────────────────────────── */}
                {activeEmployeeId && (
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-xs text-muted-foreground">Gesamtfortschritt</p>
                                {activeEmployeeName && (
                                    <p className="text-base font-bold text-foreground">{activeEmployeeName}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-black text-foreground">{pct}<span className="text-lg text-muted-foreground">%</span></div>
                                <div className="text-xs text-muted-foreground">{totalDone} / {totalAll} Aufgaben</div>
                            </div>
                        </div>
                        <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                            <div
                                className={cn('h-full rounded-full transition-all duration-700', pct === 100 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-orange-500')}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        {pct === 100 && (
                            <div className="flex items-center gap-2 mt-3 text-green-400 text-sm font-semibold">
                                <Trophy className="w-4 h-4" />
                                Einlernliste vollständig abgeschlossen! 🎉
                            </div>
                        )}
                    </div>
                )}

                {/* ── Kategorien ──────────────────────────────────────────── */}
                {(activeEmployeeId || editMode) && (
                    <div className="space-y-2">
                        {categories.map((cat) => {
                            const colorCfg    = getColorCfg(cat.color);
                            const catTasks    = tasks
                                .filter(t => t.category === cat.name)
                                .sort((a, b) => (a.order || 0) - (b.order || 0));
                            const { done, total } = getCategoryProgress(cat.name);
                            const allDone  = done === total && total > 0;
                            const isOpen   = openCategories.has(cat.name);

                            return (
                                <div key={cat.name} className={cn('rounded-2xl border overflow-hidden bg-card transition-all', allDone ? 'border-green-500/40' : colorCfg.border)}>

                                    {/* Kategorie-Header */}
                                    <div className="flex items-center">
                                        <button
                                            onClick={() => toggleCategory(cat.name)}
                                            className="flex-1 flex items-center gap-3 px-4 py-4 text-left hover:bg-secondary/20 transition-colors min-h-[60px]"
                                        >
                                            {/* Icon */}
                                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg border', allDone ? 'bg-green-500/20 border-green-500/40' : colorCfg.bg + ' ' + colorCfg.border)}>
                                                {allDone ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <span>{cat.icon}</span>}
                                            </div>

                                            {/* Name + Progress */}
                                            <div className="flex-1 min-w-0">
                                                <p className={cn('font-semibold text-sm', allDone ? 'text-green-400' : 'text-foreground')}>{cat.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={cn('h-full rounded-full transition-all', allDone ? 'bg-green-500' : colorCfg.text.replace('text-', 'bg-'))}
                                                            style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{done}/{total}</span>
                                                </div>
                                            </div>

                                            <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0', isOpen && 'rotate-90')} />
                                        </button>

                                        {/* Edit-Mode: Kategorie bearbeiten */}
                                        {editMode && (
                                            <button
                                                onClick={() => setCategoryModal({ ...cat, isExisting: true })}
                                                className="px-3 py-4 text-muted-foreground hover:text-amber-500 transition-colors min-h-[60px]"
                                                title="Kategorie bearbeiten"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Aufgaben-Liste */}
                                    {isOpen && (
                                        <div className="border-t border-border divide-y divide-border/40">
                                            {catTasks.length === 0 ? (
                                                <p className="px-5 py-4 text-sm text-muted-foreground italic">Keine Aufgaben in dieser Kategorie.</p>
                                            ) : catTasks.map((task, taskIdx) => {
                                                const completed = isTaskCompleted(task.id);
                                                const taskProgress = getTaskProgress(task.id);
                                                const showInstructions = openInstructions.has(task.id);
                                                const hasImages = Array.isArray(task.instruction_images) && task.instruction_images.length > 0;
                                                const hasInstructions = (task.instructions && task.instructions.trim().length > 0) || hasImages;

                                                return (
                                                    <div key={task.id} className={cn('transition-colors', completed ? 'bg-green-500/5' : '')}>
                                                        <div className="flex items-start gap-3 px-4 py-3.5">
                                                            {/* Checkbox — nur wenn kein Edit-Mode */}
                                                            {!editMode && (
                                                                <button
                                                                    onClick={() => activeEmployeeId && toggleMutation.mutate({
                                                                        taskId: task.id,
                                                                        taskTitle: task.title,
                                                                        taskCategory: task.category,
                                                                        employeeId: activeEmployeeId,
                                                                        employeeName: activeEmployeeName,
                                                                        completedBy: currentUserName,
                                                                    })}
                                                                    className={cn(
                                                                        'mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all min-w-[24px]',
                                                                        completed ? 'bg-green-500 border-green-500' : 'border-border hover:border-green-400'
                                                                    )}
                                                                >
                                                                    {completed && <Check className="w-3.5 h-3.5 text-white" />}
                                                                </button>
                                                            )}

                                                            {/* Edit-Mode: Sortier-Buttons */}
                                                            {editMode && (
                                                                <div className="flex flex-col gap-0.5 mt-0.5 shrink-0">
                                                                    <button
                                                                        onClick={() => reorderMutation.mutate({ taskId: task.id, direction: 'up', category: cat.name })}
                                                                        disabled={taskIdx === 0}
                                                                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                                                                    >
                                                                        <ChevronUp className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => reorderMutation.mutate({ taskId: task.id, direction: 'down', category: cat.name })}
                                                                        disabled={taskIdx === catTasks.length - 1}
                                                                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                                                                    >
                                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* Inhalt */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className={cn('text-sm font-medium leading-snug', completed && !editMode ? 'line-through text-muted-foreground' : 'text-foreground')}>
                                                                            {task.title}
                                                                        </p>
                                                                        {task.description && (
                                                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{task.description}</p>
                                                                        )}
                                                                    </div>

                                                                    {/* Edit-Mode Aktionen */}
                                                                    {editMode && (
                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            <button onClick={() => setTaskModal({ task })}
                                                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-all">
                                                                                <Pencil className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button onClick={() => setDeleteConfirm(task.id)}
                                                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Anleitung-Toggle */}
                                                                {hasInstructions && (
                                                                    <button
                                                                        onClick={() => toggleInstructions(task.id)}
                                                                        className={cn(
                                                                            'mt-2 flex items-center gap-1.5 text-xs font-medium transition-colors',
                                                                            showInstructions ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'
                                                                        )}
                                                                    >
                                                                        <BookOpen className="w-3.5 h-3.5" />
                                                                        {showInstructions ? 'Anleitung schließen' : 'Anleitung anzeigen'}
                                                                        <ChevronDown className={cn('w-3 h-3 transition-transform', showInstructions && 'rotate-180')} />
                                                                    </button>
                                                                )}

                                                                {/* Anleitung Inhalt */}
                                                                {hasInstructions && showInstructions && (
                                                                    <div className="mt-2 space-y-2">
                                                                        {/* Original-Seiten als Karussell */}
                                                                        {hasImages && (
                                                                            <div>
                                                                                <div className="flex gap-2 overflow-x-auto pb-1.5">
                                                                                    {task.instruction_images.map((url, imgIdx) => (
                                                                                        <button
                                                                                            key={imgIdx}
                                                                                            onClick={() => setLightbox({ images: task.instruction_images, index: imgIdx })}
                                                                                            className="shrink-0 relative group"
                                                                                        >
                                                                                            <img
                                                                                                src={url}
                                                                                                alt={`Seite ${imgIdx + 1}`}
                                                                                                className="h-44 w-auto rounded-xl border border-amber-500/30 object-contain bg-secondary/40 shadow-sm group-hover:border-amber-500/60 transition-colors"
                                                                                                loading="lazy"
                                                                                            />
                                                                                            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-[10px] font-bold text-white">
                                                                                                {imgIdx + 1}
                                                                                            </span>
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                                <p className="text-[10px] text-muted-foreground">
                                                                                    Tippen zum Vergrößern · {task.instruction_images.length} {task.instruction_images.length === 1 ? 'Seite' : 'Seiten'}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                        {/* Text-Anleitung */}
                                                                        {task.instructions && task.instructions.trim().length > 0 && (
                                                                            <div className="px-3 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                                                                                {task.instructions}
                                                                            </div>
                                                                        )}
                                                                        {/* Autor-Credit */}
                                                                        {task.author && (
                                                                            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                                <PenLine className="w-3 h-3" />
                                                                                Anleitung von {task.author}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Abgehakt-Info */}
                                                                {completed && taskProgress && !editMode && (
                                                                    <p className="mt-1.5 text-[10px] text-green-500/70">
                                                                        ✓ {formatDate(taskProgress.completed_at)}
                                                                        {taskProgress.completed_by ? ` · ${taskProgress.completed_by}` : ''}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Neue Aufgabe in dieser Kategorie */}
                                            {editMode && (
                                                <button
                                                    onClick={() => setTaskModal({ task: null, defaultCategory: cat.name })}
                                                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-amber-500 hover:bg-amber-500/5 transition-colors"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Aufgabe hinzufügen
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Neue Kategorie */}
                        {editMode && (
                            <button
                                onClick={() => setCategoryModal({})}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-amber-500/50 hover:text-amber-500 transition-all min-h-[52px]"
                            >
                                <Plus className="w-4 h-4" />
                                Neue Kategorie erstellen
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Modals ─────────────────────────────────────────────────── */}
            {taskModal !== null && (
                <TaskEditModal
                    task={taskModal.task ? { ...taskModal.task } : { category: taskModal.defaultCategory }}
                    categories={categories}
                    onSave={(data) => saveTaskMutation.mutate({ id: taskModal.task?.id, data })}
                    onClose={() => setTaskModal(null)}
                />
            )}

            {categoryModal !== null && (
                <CategoryEditModal
                    category={categoryModal}
                    onSave={(data) => {
                        if (categoryModal.isExisting) {
                            saveCategoryMutation.mutate({ oldName: categoryModal.name, data });
                        } else {
                            // Neue Kategorie: erst beim ersten Task aktiv
                            setCategoryModal(null);
                            setTaskModal({ task: null, defaultCategory: data.name, newCategoryData: data });
                            toast.info('Kategorie erstellt — füge jetzt die erste Aufgabe hinzu');
                        }
                    }}
                    onClose={() => setCategoryModal(null)}
                />
            )}

            {/* ── Vollbild-Ansicht ──────────────────────────────────────── */}
            {lightbox && (
                <InstructionLightbox
                    lightbox={lightbox}
                    onClose={() => setLightbox(null)}
                    onNavigate={(dir) => setLightbox(lb => lb
                        ? { ...lb, index: Math.max(0, Math.min(lb.images.length - 1, lb.index + dir)) }
                        : lb
                    )}
                />
            )}

            {/* Delete Confirm */}
            <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Aufgabe entfernen?</AlertDialogTitle>
                        <AlertDialogDescription>Diese Aufgabe wird deaktiviert und nicht mehr in der Einlernliste angezeigt.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { deleteTaskMutation.mutate(deleteConfirm); setDeleteConfirm(null); }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >Entfernen</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
