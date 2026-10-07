import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { useErrorHandler } from '@/components/error/ErrorHandler';
import {
    Plus, CheckSquare, Tag, Search, X, ListChecks, Wrench,
    Trash2, Archive, CheckCheck, Square, FolderInput, ChevronDown, ChevronRight,
    Calendar, User2, CalendarDays, Send, Check
} from 'lucide-react';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import { toast } from 'sonner';
import TodoCategoryManager from '@/components/todos/TodoCategoryManager';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import TodoCard from '@/components/todos/TodoCard';
import TodoModal from '@/components/todos/TodoModal';
import { cn } from '@/lib/utils';
import { getUserDisplayName } from '@/lib/userDisplayName';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import SwipeRow from '@/components/ui/SwipeRow';

const PRIORITY_ORDER = { dringend: 0, hoch: 1, mittel: 2, niedrig: 3 };

const STATUS_TABS = [
    { value: 'offen',    label: 'Offen' },
    { value: 'erledigt', label: 'Erledigt' },
    { value: 'alle',     label: 'Alle' },
    { value: 'wartung',  label: '🔧 Wartung' },
];

const PRIORITY_FILTERS = [
    { value: 'alle',     label: 'Alle',     dot: null },
    { value: 'dringend', label: 'Dringend', dot: 'bg-red-500' },
    { value: 'hoch',     label: 'Hoch',     dot: 'bg-orange-500' },
    { value: 'mittel',   label: 'Mittel',   dot: 'bg-blue-500' },
    { value: 'niedrig',  label: 'Niedrig',  dot: 'bg-muted-foreground' },
];

export default function Todos() {
    const permissions  = usePermissions();
    const queryClient  = useQueryClient();
    const { handleError } = useErrorHandler();

    // Offline sync
    useEffect(() => {
        const handleOnline = () =>
            syncMutations(base44).catch(e => toast.error('Offline-Sync fehlgeschlagen: ' + e.message));
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    // ── UI State ──────────────────────────────────────────────────────────────
    const [modalOpen,          setModalOpen]          = useState(false);
    const [selectedTodo,       setSelectedTodo]       = useState(null);
    const [statusFilter,       setStatusFilter]       = useState('offen');
    const [categoryFilter,     setCategoryFilter]     = useState('alle');
    // ── Quick-Add State ───────────────────────────────────────────────────────
    const [quickTitle,        setQuickTitle]        = useState('');
    const [quickExpanded,     setQuickExpanded]     = useState(false);
    const [quickCategory,     setQuickCategory]     = useState('');
    const [quickDue,          setQuickDue]          = useState('');
    const [quickAssignees,    setQuickAssignees]    = useState([]);
    const [priorityFilter,     setPriorityFilter]     = useState('alle');
    const [personFilter,       setPersonFilter]       = useState('alle');
    const [showArchived,       setShowArchived]       = useState(false);
    const [categoryManagerOpen,setCategoryManagerOpen]= useState(false);
    const [searchQuery,        setSearchQuery]        = useState('');
    const [sortBy,             setSortBy]             = useState('priority');
    const [selectedIds,        setSelectedIds]        = useState(new Set());
    const [selectMode,         setSelectMode]         = useState(false);
    const [bulkCategoryOpen,   setBulkCategoryOpen]   = useState(false);
    const [showFilters,        setShowFilters]        = useState(false);
    const [expandedCategories, setExpandedCategories] = useState(new Set());

    const toggleCategory = (cat) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            next.has(cat) ? next.delete(cat) : next.add(cat);
            return next;
        });
    };

    // Confirm dialogs
    const [archiveConfirm, setArchiveConfirm] = useState(null); // todo id
    const [deleteConfirm,  setDeleteConfirm]  = useState(null); // todo id

    // ── Data ──────────────────────────────────────────────────────────────────
    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: STALE.SLOW,
    });

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me(),
        staleTime: STALE.SLOW,
    });

    const { data: dbCategories = [] } = useQuery({
        queryKey: ['todo-categories'],
        queryFn: () => base44.entities.TodoCategory.list('name'),
        staleTime: STALE.SLOW,
    });
    const DEFAULT_CATEGORIES = ['Einkauf', 'Reparatur', 'Event', 'Bar', 'Lager', 'Küche', 'Sonstiges'];
    const allAvailableCategories = Array.from(new Set([
        ...DEFAULT_CATEGORIES,
        ...dbCategories.map(c => c.name)
    ]));

    const { data: todos = [], isLoading, isError: todosError, error: todosErrorObj } = useQuery({
        queryKey: ['todos'],
        queryFn: () => base44.entities.TodoItem.filter({ is_archived: false }, '-created_date', 300),
        staleTime: 60 * 1000,
    });

    const { data: dbArchivedTodos = [] } = useQuery({
        queryKey: ['todos-archived'],
        queryFn: () => base44.entities.TodoItem.filter({ is_archived: true }, '-created_date', 100),
        enabled: showArchived,
        staleTime: 5 * 60 * 1000,
    });

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.TodoItem.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.TodoItem.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.TodoItem.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['todos'] });
            queryClient.invalidateQueries({ queryKey: ['todos-archived'] });
        },
    });

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSave = (data, id) => {
        if (id) updateMutation.mutate({ id, data });
        else    createMutation.mutate(data);
    };

    const handleQuickUpdate = (todo, changes) =>
        updateMutation.mutate({ id: todo.id, data: changes });

    const handleStatusChange = (todo, newStatus) => {
        const updates = { status: newStatus };
        if (newStatus === 'erledigt') {
            updates.completed_by = getUserDisplayName({ employeeName: permissions.employeeName, user });
            updates.completed_at = new Date().toISOString();
        }
        updateMutation.mutate({ id: todo.id, data: updates });
    };

    const handleArchiveConfirmed = () => {
        if (!archiveConfirm) return;
        updateMutation.mutate({ id: archiveConfirm, data: { is_archived: true } });
        setArchiveConfirm(null);
    };

    const handleDeleteConfirmed = () => {
        if (!deleteConfirm) return;
        deleteMutation.mutate(deleteConfirm);
        setDeleteConfirm(null);
    };

    const handleEdit = (todo) => { setSelectedTodo(todo); setModalOpen(true); };

    // ── Bulk ──────────────────────────────────────────────────────────────────
    const currentUserName = getUserDisplayName({ employeeName: permissions.employeeName, user });
    const isAdmin = permissions.isAdmin || permissions.isManager;

    const toggleSelect = (id) => setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const selectAll = () => setSelectedIds(new Set(filteredTodos.map(t => t.id)));
    const clearSelection = () => { setSelectedIds(new Set()); setSelectMode(false); };

    const handleBulkArchive = async () => {
        await Promise.all([...selectedIds].map(id =>
            base44.entities.TodoItem.update(id, { is_archived: true })
        ));
        queryClient.invalidateQueries({ queryKey: ['todos'] });
        queryClient.invalidateQueries({ queryKey: ['todos-archived'] });
        clearSelection();
    };

    const handleBulkDelete = async () => {
        await Promise.all([...selectedIds].map(id => base44.entities.TodoItem.delete(id)));
        queryClient.invalidateQueries({ queryKey: ['todos'] });
        queryClient.invalidateQueries({ queryKey: ['todos-archived'] });
        clearSelection();
    };

    const handleBulkMoveCategory = async (cat) => {
        await Promise.all([...selectedIds].map(id =>
            base44.entities.TodoItem.update(id, { category: cat })
        ));
        queryClient.invalidateQueries({ queryKey: ['todos'] });
        queryClient.invalidateQueries({ queryKey: ['todos-archived'] });
        setBulkCategoryOpen(false);
        clearSelection();
    };

    const handleBulkDone = async () => {
        await Promise.all([...selectedIds].map(id =>
            base44.entities.TodoItem.update(id, {
                status: 'erledigt',
                completed_by: getUserDisplayName({ employeeName: permissions.employeeName, user }),
                completed_at: new Date().toISOString(),
            })
        ));
        queryClient.invalidateQueries({ queryKey: ['todos'] });
        queryClient.invalidateQueries({ queryKey: ['todos-archived'] });
        clearSelection();
    };

    const resetFilters = () => {
        setSearchQuery('');
        setCategoryFilter('alle');
        setPriorityFilter('alle');
        setPersonFilter('alle');
        setStatusFilter('offen');
    };

    // ── Quick-Add Submit ──────────────────────────────────────────────────────
    const handleQuickAdd = () => {
        const title = quickTitle.trim();
        if (!title) return;
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const resolvedDue = quickDue === 'heute' ? today : quickDue === 'morgen' ? tomorrow : quickDue || null;
        createMutation.mutate({
            title,
            category: quickCategory || 'Sonstiges',
            priority: 'mittel',
            status: 'offen',
            due_date: resolvedDue,
            assigned_to_names: quickAssignees.length > 0 ? quickAssignees : [],
        });
        setQuickTitle('');
        setQuickCategory('');
        setQuickDue('');
        setQuickAssignees([]);
        setQuickExpanded(false);
    };

    // ── Derived data ──────────────────────────────────────────────────────────
    const visibleTodos = useMemo(() => todos.filter(todo => {
        if (todo.category === 'Wartung') return false; // Wartungs-Todos separat
        const assignees = todo.assigned_to_names?.length > 0
            ? todo.assigned_to_names
            : todo.assigned_to ? [todo.assigned_to] : [];
        if (assignees.length === 0 || isAdmin) return true;
        return assignees.includes(currentUserName);
    }), [todos, currentUserName, isAdmin]);

    const maintenanceTodos = useMemo(() => todos.filter(todo =>
        todo.category === 'Wartung' && !todo.is_archived
    ), [todos]);

    const visibleArchivedTodos = useMemo(() => dbArchivedTodos.filter(todo => {
        const assignees = todo.assigned_to_names?.length > 0
            ? todo.assigned_to_names
            : todo.assigned_to ? [todo.assigned_to] : [];
        if (assignees.length === 0 || isAdmin) return true;
        return assignees.includes(currentUserName);
    }), [dbArchivedTodos, currentUserName, isAdmin]);

    const displayTodos = showArchived ? visibleArchivedTodos : visibleTodos;

    const allCategories = Array.from(new Set(todos.map(t => t.category).filter(Boolean))).sort();
    const allAssignees  = Array.from(new Set(
        todos.flatMap(t => t.assigned_to_names?.length > 0 ? t.assigned_to_names : t.assigned_to ? [t.assigned_to] : [])
    )).sort();

    const filteredTodos = useMemo(() => {
        let result = displayTodos.filter(todo => {
            const statusMatch =
                statusFilter === 'alle' ||
                (statusFilter === 'offen' && todo.status === 'offen') ||
                todo.status === statusFilter;
            const categoryMatch = categoryFilter === 'alle' || todo.category === categoryFilter;
            const priorityMatch = priorityFilter === 'alle' || todo.priority === priorityFilter;
            const personMatch   = personFilter === 'alle' || (() => {
                const a = todo.assigned_to_names?.length > 0 ? todo.assigned_to_names : todo.assigned_to ? [todo.assigned_to] : [];
                return a.includes(personFilter);
            })();
            const searchMatch = !searchQuery.trim() || (() => {
                const q = searchQuery.toLowerCase();
                const a = todo.assigned_to_names?.join(' ') || todo.assigned_to || '';
                return (
                    todo.title?.toLowerCase().includes(q) ||
                    todo.description?.toLowerCase().includes(q) ||
                    a.toLowerCase().includes(q)
                );
            })();
            return statusMatch && categoryMatch && priorityMatch && personMatch && searchMatch;
        });

        if (sortBy === 'priority') {
            result = [...result].sort((a, b) => {
                const pa = PRIORITY_ORDER[a.priority] ?? 2;
                const pb = PRIORITY_ORDER[b.priority] ?? 2;
                if (pa !== pb) return pa - pb;
                if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
                if (a.due_date) return -1;
                if (b.due_date) return 1;
                return 0;
            });
        } else if (sortBy === 'date') {
            result = [...result].sort((a, b) => {
                if (!a.due_date && !b.due_date) return 0;
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return a.due_date.localeCompare(b.due_date);
            });
        } else if (sortBy === 'manual') {
            result = [...result].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
        }

        return result;
    }, [displayTodos, statusFilter, categoryFilter, priorityFilter, personFilter, searchQuery, sortBy]);

    // ── Gruppierung nach Kategorie ───────────────────────────────────────────
    const todosByCategory = useMemo(() => {
        const map = new Map();
        filteredTodos.forEach(todo => {
            const cat = todo.category || 'Sonstiges';
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat).push(todo);
        });
        return Array.from(map.entries()).sort(([a], [b]) => {
            if (a === 'Sonstiges') return 1;
            if (b === 'Sonstiges') return -1;
            return a.localeCompare(b);
        });
    }, [filteredTodos]);

    const openCount       = visibleTodos.filter(t => t.status === 'offen').length;
    const inProgressCount = visibleTodos.filter(t => t.status === 'in_bearbeitung').length;
    const doneCount       = visibleTodos.filter(t => t.status === 'erledigt').length;

    const hasActiveFilters = searchQuery || categoryFilter !== 'alle' || priorityFilter !== 'alle' || personFilter !== 'alle';

    // ── Guards ────────────────────────────────────────────────────────────────
    if (!permissions.canViewTodos) return <PermissionDenied message="Du hast keine Berechtigung, Aufgaben zu sehen." />;
    if (todosError) return (
        <div className="min-h-screen bg-background p-4 flex items-center justify-center">
            {handleError({ error: todosErrorObj, title: 'Aufgaben konnten nicht geladen werden', onRetry: () => queryClient.invalidateQueries({ queryKey: ['todos'] }) })}
        </div>
    );

    return (
        <div className="min-h-screen bg-background pb-28 md:pb-8">
            <PullToRefresh onRefresh={async () => {
                await queryClient.invalidateQueries({ queryKey: ['todos'] });
                await queryClient.invalidateQueries({ queryKey: ['todos-archived'] });
                await queryClient.invalidateQueries({ queryKey: ['employees'] });
                await queryClient.invalidateQueries({ queryKey: ['todo-categories'] });
            }}>
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <CheckSquare className="w-5 h-5 text-amber-500" />
                            Aufgaben
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {openCount} offen · {inProgressCount} aktiv · {doneCount} erledigt
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {permissions.canEditTodos && (
                            <>
                                <Button size="sm" variant="outline"
                                    onClick={() => setCategoryManagerOpen(true)}
                                    className="h-9 px-2.5 border-border text-muted-foreground hover:text-foreground"
                                    title="Kategorien verwalten">
                                    <Tag className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline"
                                    onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()); }}
                                    className={cn('h-9 px-2.5',
                                        selectMode
                                            ? 'bg-amber-500 text-primary-foreground border-amber-500'
                                            : 'border-border text-muted-foreground hover:text-foreground'
                                    )}
                                    title="Auswählen">
                                    {selectMode ? <X className="w-4 h-4" /> : <CheckCheck className="w-4 h-4" />}
                                </Button>
                            </>
                        )}
                        <Button
                            size="sm"
                            onClick={() => { setSelectedTodo(null); setModalOpen(true); }}
                            variant="outline"
                            className="h-9 gap-1.5">
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Vollformular</span>
                        </Button>
                    </div>
                </div>

                {/* ── Quick-Add ─────────────────────────────────────────── */}
                {permissions.canCreateTodos !== false && (
                    <div className={cn(
                        'rounded-2xl border bg-card transition-all duration-200',
                        quickExpanded ? 'border-amber-500/50 shadow-sm shadow-amber-500/10' : 'border-border'
                    )}>
                        {/* Eingabezeile */}
                        <div className="flex items-center gap-2 px-3 py-2">
                            <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                            <input
                                type="text"
                                value={quickTitle}
                                onChange={e => { setQuickTitle(e.target.value); if (!quickExpanded && e.target.value) setQuickExpanded(true); }}
                                onFocus={() => setQuickExpanded(true)}
                                onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); if (e.key === 'Escape') { setQuickExpanded(false); setQuickTitle(''); }}}
                                placeholder="Neue Aufgabe…"
                                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-h-[36px]"
                            />
                            {quickTitle.trim() && (
                                <button
                                    onClick={handleQuickAdd}
                                    className="shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors">
                                    <Send className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Erweiterte Optionen — erscheinen beim Tippen */}
                        {quickExpanded && (
                            <div className="px-3 pb-3 space-y-2.5 border-t border-border pt-2.5">

                                {/* Kategorie-Chips */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    {['Einkauf', 'Reparatur', 'Bar', 'Lager', 'Event', 'Sonstiges'].map(cat => (
                                        <button key={cat}
                                            onClick={() => setQuickCategory(quickCategory === cat ? '' : cat)}
                                            className={cn(
                                                'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                                                quickCategory === cat
                                                    ? 'bg-amber-500 border-amber-500 text-white'
                                                    : 'border-border text-muted-foreground hover:text-foreground bg-background'
                                            )}>
                                            {cat}
                                        </button>
                                    ))}
                                </div>

                                {/* Datum-Chips */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    {[
                                        { label: 'Heute', value: 'heute' },
                                        { label: 'Morgen', value: 'morgen' },
                                    ].map(d => (
                                        <button key={d.value}
                                            onClick={() => setQuickDue(quickDue === d.value ? '' : d.value)}
                                            className={cn(
                                                'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                                                quickDue === d.value
                                                    ? 'bg-blue-500 border-blue-500 text-white'
                                                    : 'border-border text-muted-foreground hover:text-foreground bg-background'
                                            )}>
                                            {d.label}
                                        </button>
                                    ))}
                                    <input
                                        type="date"
                                        value={['heute','morgen'].includes(quickDue) ? '' : quickDue}
                                        onChange={e => setQuickDue(e.target.value)}
                                        className={cn(
                                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-all bg-background text-muted-foreground',
                                            quickDue && !['heute','morgen'].includes(quickDue) ? 'border-blue-500 text-blue-500' : 'border-border'
                                        )}
                                    />
                                </div>

                                {/* Personen-Chips */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <User2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    {allAssignees.slice(0, 8).map(name => (
                                        <button key={name}
                                            onClick={() => setQuickAssignees(prev =>
                                                prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
                                            )}
                                            className={cn(
                                                'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                                                quickAssignees.includes(name)
                                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                                    : 'border-border text-muted-foreground hover:text-foreground bg-background'
                                            )}>
                                            {name.split(' ')[0]}
                                        </button>
                                    ))}
                                </div>

                                {/* Details-Link */}
                                <div className="flex justify-between items-center pt-0.5">
                                    <button
                                        onClick={() => { setSelectedTodo(null); setModalOpen(true); setQuickExpanded(false); setQuickTitle(''); }}
                                        className="text-xs text-muted-foreground hover:text-foreground underline">
                                        Mehr Optionen…
                                    </button>
                                    <button onClick={() => { setQuickExpanded(false); setQuickTitle(''); }}
                                        className="text-xs text-muted-foreground hover:text-foreground">
                                        Abbrechen
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Suche ──────────────────────────────────────────────── */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Aufgabe suchen…"
                        className="pl-9 pr-9 h-11"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* ── Aktiv / Archiv ─────────────────────────────────────── */}
                <div className="flex gap-1 p-1 bg-card border border-border rounded-xl">
                    {[
                        { key: false, label: `Aktiv (${visibleTodos.length})` },
                        { key: true,  label: `Archiv (${visibleArchivedTodos.length})` },
                    ].map(({ key, label }) => (
                        <button key={String(key)}
                            onClick={() => { setShowArchived(key); setStatusFilter('offen'); }}
                            className={cn(
                                'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
                                showArchived === key
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* ── Status-Tabs (nur Aktiv) ─────────────────────────────── */}
                {!showArchived && (
                    <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                        {STATUS_TABS.map(({ value, label }) => {
                            const count = value === 'wartung' ? maintenanceTodos.length
                                : value === 'offen' ? openCount
                                : value === 'erledigt' ? doneCount
                                : visibleTodos.length;
                            return (
                                <button key={value}
                                    onClick={() => setStatusFilter(value)}
                                    className={cn(
                                        'shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-all',
                                        statusFilter === value
                                            ? 'bg-amber-500 border-amber-500 text-white'
                                            : 'border-border text-muted-foreground hover:text-foreground bg-card'
                                    )}>
                                    {label}
                                    <span className={cn(
                                        'text-xs px-1.5 py-0.5 rounded-full font-bold',
                                        statusFilter === value ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                                    )}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ── Priorität + Sort + erweiterte Filter ───────────────── */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        {/* Priorität-Chips */}
                        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1">
                            {PRIORITY_FILTERS.map(({ value, label, dot }) => (
                                <button key={value}
                                    onClick={() => setPriorityFilter(value)}
                                    className={cn(
                                        'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                                        priorityFilter === value
                                            ? 'bg-foreground text-background border-foreground'
                                            : 'border-border text-muted-foreground hover:text-foreground bg-card'
                                    )}>
                                    {dot && <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />}
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Weitere Filter + Sort */}
                        <button
                            onClick={() => setShowFilters(f => !f)}
                            className={cn(
                                'shrink-0 flex items-center gap-1 h-8 px-2.5 rounded-lg border text-xs font-medium transition-all',
                                (showFilters || hasActiveFilters)
                                    ? 'bg-amber-500 border-amber-500 text-white'
                                    : 'border-border text-muted-foreground hover:text-foreground bg-card'
                            )}>
                            Filter
                            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                            <ChevronDown className={cn('w-3 h-3 transition-transform', showFilters && 'rotate-180')} />
                        </button>

                        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                            className="shrink-0 h-8 text-xs px-2 rounded-lg border border-border bg-card text-foreground">
                            <option value="priority">Priorität</option>
                            <option value="date">Datum</option>
                            <option value="manual">Manuell</option>
                        </select>
                    </div>

                    {/* Erweiterte Filter */}
                    {showFilters && (
                        <div className="rounded-xl border border-border bg-card p-3 space-y-3 animate-fadeIn">
                            {allCategories.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Kategorie</p>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {['alle', ...allCategories].map(cat => (
                                            <button key={cat}
                                                onClick={() => setCategoryFilter(cat)}
                                                className={cn(
                                                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                                                    categoryFilter === cat
                                                        ? 'bg-blue-500 border-blue-500 text-white'
                                                        : 'border-border text-muted-foreground hover:text-foreground'
                                                )}>
                                                {cat === 'alle' ? 'Alle' : cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {allAssignees.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Person</p>
                                    <div className="flex gap-1.5 flex-wrap">
                                        <button onClick={() => setPersonFilter('alle')}
                                            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                                                personFilter === 'alle' ? 'bg-purple-500 border-purple-500 text-white' : 'border-border text-muted-foreground hover:text-foreground')}>
                                            Alle
                                        </button>
                                        {allAssignees.map(p => (
                                            <button key={p}
                                                onClick={() => setPersonFilter(personFilter === p ? 'alle' : p)}
                                                className={cn(
                                                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                                                    personFilter === p
                                                        ? 'bg-purple-500 border-purple-500 text-white'
                                                        : 'border-border text-muted-foreground hover:text-foreground'
                                                )}>
                                                {p.split(' ')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {hasActiveFilters && (
                                <button onClick={resetFilters}
                                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                                    <X className="w-3.5 h-3.5" />Alle Filter zurücksetzen
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Auswahl-Modus: Alle auswählen */}
                {selectMode && !showArchived && (
                    <button onClick={selectAll}
                        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Alle auswählen ({filteredTodos.length})
                    </button>
                )}

                {/* ── Liste ──────────────────────────────────────────────── */}
                {statusFilter === 'wartung' ? (
                    /* ── Wartungs-Tab ──────────────────────────────────── */
                    maintenanceTodos.length === 0 ? (
                        <div className="text-center py-14 text-muted-foreground">
                            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="font-semibold text-foreground">Keine Wartungserinnerungen</p>
                            <p className="text-sm mt-1">Sobald eine Wartung fällig wird, erscheint sie hier.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {maintenanceTodos.map(todo => (
                                <TodoCard
                                    key={todo.id}
                                    todo={todo}
                                    employees={employees}
                                    onStatusChange={handleStatusChange}
                                    onEdit={handleEdit}
                                    onArchive={(id) => setArchiveConfirm(id)}
                                    onDelete={(id) => setDeleteConfirm(id)}
                                    onQuickUpdate={handleQuickUpdate}
                                />
                            ))}
                        </div>
                    )
                ) : isLoading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : filteredTodos.length === 0 ? (
                    <div className="text-center py-14 text-muted-foreground">
                        <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-semibold text-foreground">Keine Aufgaben</p>
                        <p className="text-sm mt-1">
                            {hasActiveFilters ? 'Keine Einträge entsprechen den Filtern.' : 'Alles erledigt — gut gemacht!'}
                        </p>
                        {hasActiveFilters && (
                            <button onClick={resetFilters} className="mt-3 text-xs text-amber-400 hover:text-amber-300 underline">
                                Filter zurücksetzen
                            </button>
                        )}
                    </div>
                ) : !showArchived ? (
                    /* Aktive Todos — gruppiert nach Kategorie (Akkordeon) */
                    <div className="space-y-2">
                        {todosByCategory.map(([category, categoryTodos]) => {
                            const isOpen = expandedCategories.has(category);
                            const doneCount  = categoryTodos.filter(t => t.status === 'erledigt').length;
                            const totalCount = categoryTodos.length;
                            const allDone    = doneCount === totalCount;
                            const hasDringend = categoryTodos.some(t => t.priority === 'dringend' && t.status !== 'erledigt');

                            return (
                                <div key={category} className="rounded-2xl border border-border bg-card overflow-hidden">
                                    {/* ── Kategorie-Header ──────────────────────────────── */}
                                    <button
                                        onClick={() => toggleCategory(category)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-4 py-3.5 min-h-[56px] transition-colors text-left',
                                            isOpen ? 'bg-secondary/50' : 'hover:bg-secondary/30'
                                        )}
                                    >
                                        {/* Kategorie-Name */}
                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                            <span className="font-semibold text-sm text-foreground truncate">
                                                {category}
                                            </span>
                                            {hasDringend && (
                                                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 font-bold">
                                                    Dringend
                                                </span>
                                            )}
                                        </div>

                                        {/* Fortschritts-Pill */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="flex items-center gap-1.5">
                                                {/* Mini Progress Bar */}
                                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            'h-full rounded-full transition-all duration-500',
                                                            allDone ? 'bg-emerald-500' : 'bg-amber-500'
                                                        )}
                                                        style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : '0%' }}
                                                    />
                                                </div>
                                                <span className={cn(
                                                    'text-xs font-semibold tabular-nums',
                                                    allDone ? 'text-emerald-500' : 'text-muted-foreground'
                                                )}>
                                                    {doneCount}/{totalCount}
                                                </span>
                                            </div>

                                            {/* Pfeil */}
                                            <ChevronRight className={cn(
                                                'w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0',
                                                isOpen && 'rotate-90'
                                            )} />
                                        </div>
                                    </button>

                                    {/* ── Aufgaben-Liste ──────────────────────────────── */}
                                    {isOpen && (
                                        <div className="border-t border-border divide-y divide-border/50">
                                            {categoryTodos.map((todo, todoIdx) => (
                                                <div
                                                    key={todo.id}
                                                    className="flex items-center gap-2 px-3 py-2"
                                                >
                                                    {selectMode && (
                                                        <button onClick={() => toggleSelect(todo.id)}
                                                            className="shrink-0 w-6 h-6 flex items-center justify-center">
                                                            {selectedIds.has(todo.id)
                                                                ? <CheckSquare className="w-5 h-5 text-amber-400" />
                                                                : <Square className="w-5 h-5 text-muted-foreground" />}
                                                        </button>
                                                    )}
                                                    <SwipeRow
                                                        className="flex-1 min-w-0"
                                                        onSwipe={() => handleStatusChange(todo, 'erledigt')}
                                                        onSwipeAlt={() => deleteMutation.mutate(todo.id)}
                                                        revealColor="bg-emerald-600"
                                                        revealIcon={Check}
                                                        revealColorAlt="bg-destructive"
                                                        revealIconAlt={Trash2}
                                                        disabled={selectMode || todo.status === 'erledigt'}
                                                    >
                                                        <TodoCard
                                                            todo={todo}
                                                            employees={employees}
                                                            onStatusChange={selectMode ? null : handleStatusChange}
                                                            onEdit={selectMode ? null : handleEdit}
                                                            onDelete={selectMode ? null : (id) => setDeleteConfirm(id)}
                                                            onArchive={selectMode ? null : (id) => setArchiveConfirm(id)}
                                                            onQuickUpdate={selectMode ? null : handleQuickUpdate}
                                                            showArchiveButton={!selectMode && todo.status === 'erledigt'}
                                                            sortBy={sortBy}
                                                            allTodos={categoryTodos}
                                                            idx={todoIdx}
                                                        />
                                                    </SwipeRow>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Archiv */
                    <div className="space-y-2">
                        {filteredTodos.map((todo, idx) => (
                            <div key={todo.id} className="flex items-center gap-2 animate-stagger" style={{ '--delay': `${idx * 30}ms` }}>
                                {selectMode && (
                                    <button onClick={() => toggleSelect(todo.id)}
                                        className="shrink-0 w-6 h-6 flex items-center justify-center">
                                        {selectedIds.has(todo.id)
                                            ? <CheckSquare className="w-5 h-5 text-amber-400" />
                                            : <Square className="w-5 h-5 text-muted-foreground" />}
                                    </button>
                                )}
                                <div className="flex-1 min-w-0">
                                    <TodoCard
                                        todo={todo}
                                        employees={employees}
                                        onStatusChange={null}
                                        onEdit={selectMode ? null : handleEdit}
                                        onDelete={selectMode ? null : (id) => setDeleteConfirm(id)}
                                        onArchive={null}
                                        onQuickUpdate={null}
                                        showArchiveButton={false}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Bulk-Aktionsleiste ──────────────────────────────────── */}
                {selectMode && selectedIds.size > 0 && (
                    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 px-4 w-full max-w-sm">
                        {bulkCategoryOpen && (
                            <div className="bg-card border border-border rounded-xl shadow-2xl p-2 flex flex-wrap gap-1.5 w-full">
                                {allAvailableCategories.map(cat => (
                                    <button key={cat}
                                        onClick={() => handleBulkMoveCategory(cat)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-accent text-foreground transition-all">
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-2 bg-card border border-border rounded-2xl shadow-2xl px-4 py-3 w-full">
                            <span className="text-sm font-semibold text-foreground mr-1">{selectedIds.size}×</span>
                            <Button size="sm" variant="outline" onClick={handleBulkDone}
                                className="gap-1 h-8 text-xs text-green-400 border-green-500/30 hover:bg-green-500/10">
                                <CheckSquare className="w-3.5 h-3.5" />Erledigt
                            </Button>
                            <Button size="sm" variant="outline"
                                onClick={() => setBulkCategoryOpen(o => !o)}
                                className={cn('gap-1 h-8 text-xs', bulkCategoryOpen ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'text-blue-400 border-blue-500/30 hover:bg-blue-500/10')}>
                                <FolderInput className="w-3.5 h-3.5" />Kategorie
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleBulkArchive}
                                className="gap-1 h-8 text-xs text-muted-foreground">
                                <Archive className="w-3.5 h-3.5" />Archiv
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleBulkDelete}
                                className="gap-1 h-8 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10">
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            <button onClick={clearSelection} className="ml-auto text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Dialogs ────────────────────────────────────────────── */}
                <AlertDialog open={!!archiveConfirm} onOpenChange={o => !o && setArchiveConfirm(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Aufgabe archivieren?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Die Aufgabe wird ins Archiv verschoben und kann dort wiederhergestellt werden.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={handleArchiveConfirmed}>Archivieren</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={!!deleteConfirm} onOpenChange={o => !o && setDeleteConfirm(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Aufgabe löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Diese Aktion kann nicht rückgängig gemacht werden.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteConfirmed}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Löschen
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <TodoCategoryManager
                    open={categoryManagerOpen}
                    onClose={() => setCategoryManagerOpen(false)}
                    todos={todos}
                />

                <TodoModal
                    open={modalOpen}
                    onClose={() => { setModalOpen(false); setSelectedTodo(null); }}
                    todo={selectedTodo}
                    employees={employees}
                    onSave={handleSave}
                    currentUser={user}
                />
            </div>
            </PullToRefresh>
        </div>
    );
}