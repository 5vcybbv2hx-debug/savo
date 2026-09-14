/**
 * NewsPanel — News & Heute-Aufgaben über der Stempeluhr.
 * Manager können News/Tasks anlegen, alle sehen sie beim Einstempeln.
 * Tasks können abgehakt werden, wiederkehrende Tasks erscheinen automatisch neu.
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Newspaper, CheckCircle2, Circle, X, Plus, Megaphone,
    ListTodo, AlertCircle, Info, Trash2, Repeat, Pencil, Settings2, RotateCcw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { STALE } from '@/lib/queryUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isItemVisible(item, now = new Date()) {
    if (!item.is_active) return false;
    if (item.is_completed) return false;
    const from = item.show_from ? new Date(item.show_from) : null;
    const until = item.show_until ? new Date(item.show_until) : null;
    if (from && now < from) return false;
    if (until && now > until) return false;
    return true;
}

function getNextOccurrence(item, completedAt = new Date()) {
    const { recurrence_pattern, recurrence_interval } = item;
    if (!recurrence_pattern || recurrence_pattern === 'none') return null;
    const interval = recurrence_interval || 1;
    switch (recurrence_pattern) {
        case 'daily':   return addDays(completedAt, interval);
        case 'weekly':  return addWeeks(completedAt, interval);
        case 'monthly': return addMonths(completedAt, interval);
        default: return null;
    }
}

const PRIORITY_CONFIG = {
    info:      { icon: Info,          color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',     label: 'Info' },
    wichtig:   { icon: AlertCircle,    color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30',  label: 'Wichtig' },
    dringend:  { icon: AlertCircle,    color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',      label: 'Dringend' },
};

// ── Create/Edit Modal ────────────────────────────────────────────────────────

function NewsEditor({ open, onClose, editItem, currentUser, employees }) {
    const queryClient = useQueryClient();
    const [title, setTitle] = useState(editItem?.title || '');
    const [body, setBody] = useState(editItem?.body || '');
    const [type, setType] = useState(editItem?.type || 'news');
    const [priority, setPriority] = useState(editItem?.priority || 'info');
    const [showFrom, setShowFrom] = useState(
        editItem?.show_from ? format(new Date(editItem.show_from), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm")
    );
    const [showUntil, setShowUntil] = useState(
        editItem?.show_until ? format(new Date(editItem.show_until), "yyyy-MM-dd'T'HH:mm") : ''
    );
    const [recurrencePattern, setRecurrencePattern] = useState(editItem?.recurrence_pattern || 'none');
    const [recurrenceInterval, setRecurrenceInterval] = useState(editItem?.recurrence_interval || 1);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                title: title.trim(),
                body: body.trim() || null,
                type,
                priority,
                show_from: showFrom ? new Date(showFrom).toISOString() : null,
                show_until: showUntil ? new Date(showUntil).toISOString() : null,
                recurrence_pattern: recurrencePattern,
                recurrence_interval: recurrencePattern !== 'none' ? recurrenceInterval : null,
                is_active: true,
                is_completed: false,
                created_by_name: currentUser?.full_name || currentUser?.email || 'Manager',
            };
            if (editItem) {
                return base44.entities.NewsItem.update(editItem.id, payload);
            }
            return base44.entities.NewsItem.create(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['news-items'] });
            toast.success(editItem ? 'News aktualisiert' : 'News erstellt');
            onClose();
        },
        onError: (err) => toast.error('Fehler: ' + (err.message || 'Speichern fehlgeschlagen')),
    });

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                        <Newspaper className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-bold text-foreground">
                            {editItem ? 'News bearbeiten' : 'News / Aufgabe erstellen'}
                        </h3>
                        <p className="text-xs text-muted-foreground">{format(new Date(), 'dd.MM.yyyy', { locale: de })}</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto px-5 py-4 space-y-4">
                    {/* Type Toggle */}
                    <div className="flex gap-2">
                        <button onClick={() => setType('news')}
                            className={cn('flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all',
                                type === 'news' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                            <Megaphone className="w-4 h-4 inline mr-1.5" />News
                        </button>
                        <button onClick={() => setType('task')}
                            className={cn('flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all',
                                type === 'task' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                            <ListTodo className="w-4 h-4 inline mr-1.5" />Aufgabe
                        </button>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Titel</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Was gibt's Neues?"
                            className="mt-1 w-full h-11 px-3 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                    </div>

                    {/* Body */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Details (optional)</label>
                        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Zusätzliche Infos…"
                            rows={3}
                            className="mt-1 w-full px-3 py-2 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priorität</label>
                        <div className="mt-1 flex gap-2">
                            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                                <button key={key} onClick={() => setPriority(key)}
                                    className={cn('flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                                        priority === key ? cn(cfg.bg, cfg.color) : 'border-border text-muted-foreground')}>
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Time Window */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sichtbar ab</label>
                            <input type="datetime-local" value={showFrom} onChange={e => setShowFrom(e.target.value)}
                                className="mt-1 w-full h-10 px-2 rounded-xl border border-input bg-transparent text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sichtbar bis (optional)</label>
                            <input type="datetime-local" value={showUntil} onChange={e => setShowUntil(e.target.value)}
                                className="mt-1 w-full h-10 px-2 rounded-xl border border-input bg-transparent text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                    </div>

                    {/* Recurrence */}
                    {type === 'task' && (
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                <Repeat className="w-3 h-3" />Wiederholung
                            </label>
                            <div className="mt-1 flex gap-2">
                                {[
                                    { val: 'none',    label: 'Einmalig' },
                                    { val: 'daily',   label: 'Täglich' },
                                    { val: 'weekly',  label: 'Wöchentlich' },
                                    { val: 'monthly', label: 'Monatlich' },
                                ].map(r => (
                                    <button key={r.val} onClick={() => setRecurrencePattern(r.val)}
                                        className={cn('flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                                            recurrencePattern === r.val ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                            {recurrencePattern !== 'none' && (
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Alle</span>
                                    <input type="number" min="1" max="12" value={recurrenceInterval}
                                        onChange={e => setRecurrenceInterval(Math.max(1, Number(e.target.value) || 1))}
                                        className="w-16 h-9 px-2 rounded-lg border border-input bg-transparent text-foreground text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring" />
                                    <span className="text-xs text-muted-foreground">
                                        {recurrencePattern === 'daily' ? 'Tage' : recurrencePattern === 'weekly' ? 'Wochen' : 'Monate'}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-border shrink-0">
                    <Button onClick={() => saveMutation.mutate()} disabled={!title.trim() || saveMutation.isPending}
                        className="w-full h-11 text-sm font-semibold">
                        {saveMutation.isPending ? 'Speichert…' : editItem ? 'Speichern' : 'Veröffentlichen'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function NewsPanel({ currentUser, currentEmployee, isManager, employees }) {
    const queryClient = useQueryClient();
    const [editorOpen, setEditorOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [manageOpen, setManageOpen] = useState(false);

    const { data: newsItems = [] } = useQuery({
        queryKey: ['news-items'],
        queryFn: () => base44.entities.NewsItem.list('-created_date', 200),
        refetchInterval: 60000,
        staleTime: STALE.FAST,
    });

    const visibleItems = useMemo(() => {
        const now = new Date();
        return newsItems
            .filter(item => isItemVisible(item, now))
            .sort((a, b) => {
                // Dringend first, then wichtig, then info
                const pOrder = { dringend: 0, wichtig: 1, info: 2 };
                const pd = (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
                if (pd !== 0) return pd;
                // Then by sort_order, then by created_date
                return (a.sort_order || 0) - (b.sort_order || 0);
            });
    }, [newsItems]);

    const completeTaskMutation = useMutation({
        mutationFn: async ({ item, completerName }) => {
            const completedAt = new Date();
            const nextDate = getNextOccurrence(item, completedAt);

            if (nextDate) {
                // Recurring task: reset for next occurrence
                return base44.entities.NewsItem.update(item.id, {
                    is_completed: true,
                    completed_by_name: completerName,
                    completed_at: completedAt.toISOString(),
                    show_from: nextDate.toISOString(),
                });
            }
            // One-time task: just mark as completed
            return base44.entities.NewsItem.update(item.id, {
                is_completed: true,
                completed_by_name: completerName,
                completed_at: completedAt.toISOString(),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['news-items'] });
            toast.success('Aufgabe erledigt ✓');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.NewsItem.update(id, { is_active: false }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['news-items'] });
            toast.success('News entfernt');
        },
    });

    const reactivateMutation = useMutation({
        mutationFn: (id) => base44.entities.NewsItem.update(id, { is_active: true, is_completed: false, completed_at: null }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['news-items'] });
            toast.success('Reaktiviert');
        },
    });

    const handleComplete = (item) => {
        const name = currentEmployee?.name || currentUser?.full_name || currentUser?.email || 'Mitarbeiter';
        completeTaskMutation.mutate({ item, completerName: name });
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setEditorOpen(true);
    };

    const handleCreate = () => {
        setEditItem(null);
        setEditorOpen(true);
    };

    const newsCount = visibleItems.filter(i => i.type === 'news').length;
    const taskCount = visibleItems.filter(i => i.type === 'task').length;

    if (visibleItems.length === 0 && !isManager) return null;

    return (
        <>
            <Card className="border-border bg-card">
                <CardContent className="p-3 space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Newspaper className="w-4 h-4 text-primary" />
                            <p className="text-sm font-semibold text-foreground">
                                {newsCount > 0 && `${newsCount} News`}
                                {newsCount > 0 && taskCount > 0 && ' · '}
                                {taskCount > 0 && `${taskCount} Aufgabe${taskCount > 1 ? 'n' : ''}`}
                                {newsCount === 0 && taskCount === 0 && 'News & Aufgaben'}
                            </p>
                        </div>
                        {isManager && (
                            <div className="flex items-center gap-1">
                                <button onClick={() => setManageOpen(true)}
                                    title="Alle verwalten (auch unsichtbare)"
                                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary">
                                    <Settings2 className="w-3.5 h-3.5" />Verwalten
                                </button>
                                <button onClick={handleCreate}
                                    className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/10">
                                    <Plus className="w-3.5 h-3.5" />Neu
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Items */}
                    {visibleItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">
                            Noch keine News. {isManager ? 'Klicke "Neu" um eine zu erstellen.' : ''}
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {visibleItems.map(item => {
                                const cfg = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.info;
                                const isTask = item.type === 'task';
                                const Icon = isTask ? ListTodo : Megaphone;
                                const hasRecurrence = item.recurrence_pattern && item.recurrence_pattern !== 'none';

                                return (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            'rounded-lg border px-3 py-2.5 transition-all',
                                            cfg.bg
                                        )}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            {/* Icon / Check */}
                                            {isTask ? (
                                                <button
                                                    onClick={() => handleComplete(item)}
                                                    className="mt-0.5 shrink-0 min-h-[28px] min-w-[28px] flex items-center justify-center"
                                                >
                                                    <Circle className="w-5 h-5 text-muted-foreground hover:text-green-400 transition-colors" />
                                                </button>
                                            ) : (
                                                <div className={cn('mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center', cfg.bg)}>
                                                    <Icon className={cn('w-4 h-4', cfg.color)} />
                                                </div>
                                            )}

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                                                    {hasRecurrence && (
                                                        <span className="flex items-center gap-0.5 text-[9px] font-semibold text-muted-foreground bg-muted/50 px-1 py-0.5 rounded">
                                                            <Repeat className="w-2.5 h-2.5" />
                                                            {item.recurrence_interval > 1 ? `${item.recurrence_interval}× ` : ''}
                                                            {item.recurrence_pattern === 'daily' ? 'tägl.' : item.recurrence_pattern === 'weekly' ? 'wöch.' : 'monatl.'}
                                                        </span>
                                                    )}
                                                </div>
                                                {item.body && (
                                                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{item.body}</p>
                                                )}
                                                {item.created_by_name && (
                                                    <p className="text-[10px] text-muted-foreground/70 mt-1">von {item.created_by_name}</p>
                                                )}
                                            </div>

                                            {/* Manager Actions */}
                                            {isManager && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button onClick={() => handleEdit(item)}
                        title="Bearbeiten"
                                                        className="text-muted-foreground hover:text-primary p-1 transition-colors">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => deleteMutation.mutate(item.id)}
                                                        className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Verwalten Sheet — alle Items inkl. unsichtbare/erledigte */}
            <Sheet open={manageOpen} onOpenChange={setManageOpen}>
                <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] flex flex-col">
                    <SheetHeader className="border-b border-border pb-3">
                        <SheetTitle className="text-foreground flex items-center gap-2">
                            <Settings2 className="w-4 h-4 text-primary" />
                            Alle News & Aufgaben verwalten
                        </SheetTitle>
                        <p className="text-xs text-muted-foreground">
                            {newsItems.length} Einträge gesamt · {visibleItems.length} sichtbar · {newsItems.length - visibleItems.length} unsichtbar/erledigt
                        </p>
                    </SheetHeader>
                    <div className="overflow-y-auto px-4 py-3 space-y-1.5">
                        {newsItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">Keine Einträge vorhanden</p>
                        ) : (
                            newsItems.map(item => {
                                const now = new Date();
                                const isVisible = isItemVisible(item, now);
                                const isCompleted = !!item.is_completed;
                                const isInactive = !item.is_active;
                                const isFuture = item.show_from && new Date(item.show_from) > now;
                                const cfg = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.info;
                                const isTask = item.type === 'task';
                                const Icon = isTask ? ListTodo : Megaphone;

                                let statusBadge;
                                if (isInactive) statusBadge = <span className="text-[9px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Inaktiv</span>;
                                else if (isCompleted) statusBadge = <span className="text-[9px] font-semibold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">Erledigt</span>;
                                else if (isFuture) statusBadge = <span className="text-[9px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">Geplant</span>;
                                else if (isVisible) statusBadge = <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Sichtbar</span>;

                                return (
                                    <div key={item.id}
                                        className={cn(
                                            'rounded-lg border px-3 py-2.5 flex items-start gap-2.5',
                                            isInactive || isCompleted ? 'opacity-60 border-border bg-muted/30' : cn('border-border', cfg.bg)
                                        )}>
                                        <div className={cn('mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center', cfg.bg)}>
                                            <Icon className={cn('w-4 h-4', cfg.color)} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className={cn('text-sm font-medium', isCompleted && 'line-through text-muted-foreground', !isCompleted && !isInactive && 'text-foreground', isInactive && 'text-muted-foreground')}>
                                                    {item.title}
                                                </p>
                                                {statusBadge}
                                            </div>
                                            {item.body && (
                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.body}</p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                                {item.type === 'task' ? 'Aufgabe' : 'News'}
                                                {item.created_by_name ? ` · von ${item.created_by_name}` : ''}
                                                {item.show_from ? ` · ab ${format(new Date(item.show_from), 'dd.MM.yy HH:mm', { locale: de })}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {(isInactive || isCompleted) && (
                                                <button onClick={() => reactivateMutation.mutate(item.id)}
                                                    title="Reaktivieren"
                                                    className="text-muted-foreground hover:text-green-400 p-1 transition-colors">
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button onClick={() => { setEditItem(item); setEditorOpen(true); setManageOpen(false); }}
                                                title="Bearbeiten"
                                                className="text-muted-foreground hover:text-primary p-1 transition-colors">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => deleteMutation.mutate(item.id)}
                                                title="Entfernen"
                                                className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Editor Modal — key erzwingt Neumont bei Edit-Wechsel */}
            <NewsEditor
                key={editItem?.id || 'new'}
                open={editorOpen}
                onClose={() => { setEditorOpen(false); setEditItem(null); }}
                editItem={editItem}
                currentUser={currentUser}
                employees={employees}
            />
        </>
    );
}