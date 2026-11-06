import React, { useState } from 'react';
import {
    Check, Calendar, Trash2, Archive, MoreVertical,
    Circle, Loader, CheckCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AttachmentGallery from './AttachmentGallery';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { de } from 'date-fns/locale';

const priorityConfig = {
    niedrig:  { stripe: 'bg-muted',  label: 'Niedrig',  cardBg: '' },
    mittel:   { stripe: 'bg-primary/70',   label: 'Mittel',   cardBg: '' },
    hoch:     { stripe: 'bg-status-warn/70', label: 'Hoch',     cardBg: 'bg-status-warn/5 border-status-warn/20' },
    dringend: { stripe: 'bg-status-danger/70',    label: 'Dringend', cardBg: 'bg-status-danger/8 border-status-danger/25' },
};

const statusCycle = { offen: 'erledigt', erledigt: 'offen', in_bearbeitung: 'erledigt' }; // in_bearbeitung → erledigt als Migration
const statusConfig = {
    offen:          { icon: Circle,      color: 'text-muted-foreground',  label: 'Offen' },
    erledigt:       { icon: CheckCircle, color: 'text-status-ok',  label: 'Erledigt' },
};

function formatDueDate(dateStr) {
    const d = new Date(dateStr);
    if (isToday(d))    return 'Heute';
    if (isTomorrow(d)) return 'Morgen';
    return format(d, 'd. MMM', { locale: de });
}

export default function TodoCard({
    todo, employees,
    onStatusChange, onEdit, onDelete, onArchive, onQuickUpdate,
    showArchiveButton, sortBy, allTodos, idx
}) {
    const [showSubtasks,   setShowSubtasks]   = useState(false);
    const [showAttachments,setShowAttachments] = useState(false);

    const isCompleted  = todo.status === 'erledigt';
    const pCfg        = priorityConfig[todo.priority] || priorityConfig.mittel;
    const StatusIcon  = statusConfig[todo.status]?.icon || Circle;
    const statusColor = statusConfig[todo.status]?.color || 'text-muted-foreground';

    const isOverdue = todo.due_date &&
        isPast(new Date(todo.due_date)) &&
        !isToday(new Date(todo.due_date)) &&
        !isCompleted;
    const isDueToday = todo.due_date && isToday(new Date(todo.due_date)) && !isCompleted;

    const assignees = todo.assigned_to_names?.length > 0
        ? todo.assigned_to_names
        : todo.assigned_to ? [todo.assigned_to] : [];
    const subtasks    = todo.subtasks || [];
    const doneSubtasks = subtasks.filter(s => s.done).length;

    const handleSubtaskToggle = (subId) => {
        const updated = todo.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s);
        onQuickUpdate?.(todo, { subtasks: updated });
    };

    const handleMoveUp = () => {
        if (!allTodos || idx === 0) return;
        const prev = allTodos[idx - 1];
        onQuickUpdate?.(todo, { sort_order: (prev.sort_order ?? idx - 1) - 0.5 });
    };
    const handleMoveDown = () => {
        if (!allTodos || idx === allTodos.length - 1) return;
        const next = allTodos[idx + 1];
        onQuickUpdate?.(todo, { sort_order: (next.sort_order ?? idx + 1) + 0.5 });
    };

    return (
        <Card className={cn(
            'border transition-all overflow-hidden',
            pCfg.cardBg || 'bg-card border-border/50',
            isCompleted && 'opacity-50'
        )}>
            <div className="flex">
                {/* Prioritäts-Stripe */}
                <div className={cn('w-1.5 shrink-0', pCfg.stripe)} />

                <div className="flex gap-3 px-3 py-3.5 flex-1 min-w-0">
                    {/* Status-Toggle */}
                    {onStatusChange && (
                        <button
                            onClick={() => onStatusChange(todo, statusCycle[todo.status])}
                            className={cn('mt-0.5 shrink-0 transition-all active:scale-75', statusColor)}
                            title={`${statusConfig[todo.status]?.label} → weiterklicken`}>
                            <StatusIcon className="w-6 h-6" />
                        </button>
                    )}
                    {!onStatusChange && (
                        <div className={cn('mt-0.5 shrink-0', statusColor)}>
                            <StatusIcon className="w-6 h-6" />
                        </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <h4 className={cn(
                                    'font-semibold text-sm leading-snug',
                                    isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'
                                )}>
                                    {todo.title}
                                    {todo.priority === 'dringend' && !isCompleted && (
                                        <span className="ml-1 text-status-danger font-bold">!</span>
                                    )}
                                </h4>
                                {!isCompleted && todo.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{todo.description}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                                {/* Manuelle Sortier-Pfeile */}
                                {sortBy === 'manual' && allTodos && (
                                    <div className="flex flex-col">
                                        <button onClick={handleMoveUp} disabled={idx === 0}
                                            className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5">
                                            <ChevronUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={handleMoveDown} disabled={idx === allTodos.length - 1}
                                            className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5">
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}

                                {/* ··· Menü — alles drin */}
                                {(onEdit || onDelete || onArchive || onQuickUpdate) && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">

                                            {/* Bearbeiten */}
                                            {onEdit && (
                                                <DropdownMenuItem onClick={() => onEdit(todo)}>
                                                    <span className="w-4 mr-2 text-center">✏️</span>Bearbeiten
                                                </DropdownMenuItem>
                                            )}

                                            {/* Status */}
                                            {onStatusChange && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Status</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => onStatusChange(todo, 'offen')}>
                                                       <Circle className="w-4 h-4 mr-2 text-muted-foreground" />Offen
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onStatusChange(todo, 'erledigt')}>
                                                        <CheckCircle className="w-4 h-4 mr-2 text-status-ok" />Erledigt
                                                    </DropdownMenuItem>
                                                </>
                                            )}

                                            {/* Priorität */}
                                            {onQuickUpdate && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Priorität</DropdownMenuLabel>
                                                    {[
                                                        { p: 'dringend', dot: 'bg-status-danger/70' },
                                                        { p: 'hoch',     dot: 'bg-status-warn/70' },
                                                        { p: 'mittel',   dot: 'bg-primary/70' },
                                                        { p: 'niedrig',  dot: 'bg-muted' },
                                                    ].map(({ p, dot }) => (
                                                        <DropdownMenuItem key={p}
                                                            onClick={() => onQuickUpdate(todo, { priority: p })}
                                                            className={todo.priority === p ? 'font-semibold' : ''}>
                                                            <span className={cn('w-2.5 h-2.5 rounded-full mr-2 shrink-0 inline-block', dot)} />
                                                            {priorityConfig[p].label}
                                                            {todo.priority === p && ' ✓'}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </>
                                            )}

                                            {/* Archivieren / Löschen */}
                                            {(onArchive || onDelete) && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    {onArchive && (
                                                        <DropdownMenuItem onClick={() => onArchive(todo.id)}>
                                                            <Archive className="w-4 h-4 mr-2 text-muted-foreground" />Archivieren
                                                        </DropdownMenuItem>
                                                    )}
                                                    {onDelete && (
                                                        <DropdownMenuItem onClick={() => onDelete(todo.id)}
                                                            className="text-status-danger focus:text-status-danger focus:bg-status-danger/10">
                                                            <Trash2 className="w-4 h-4 mr-2" />Löschen
                                                        </DropdownMenuItem>
                                                    )}
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </div>

                        {/* Meta-Zeile */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                            {todo.category && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                                    {todo.category}
                                </Badge>
                            )}
                            {todo.due_date && (
                                <span className={cn('flex items-center gap-1 text-xs',
                                    isOverdue  ? 'text-status-danger font-semibold' :
                                    isDueToday ? 'text-status-warn font-semibold' :
                                    'text-muted-foreground')}>
                                    <Calendar className="w-3 h-3" />
                                    {isOverdue ? 'Überfällig · ' : ''}{formatDueDate(todo.due_date)}
                                </span>
                            )}
                            {assignees.length > 0 && (
                                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                    → {assignees.map(a => a.split(' ')[0]).join(', ')}
                                </span>
                            )}
                            {subtasks.length > 0 && (
                                <button onClick={() => setShowSubtasks(s => !s)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                    <Check className="w-3 h-3" />
                                    {doneSubtasks}/{subtasks.length}
                                    <ChevronDown className={cn('w-3 h-3 transition-transform', showSubtasks && 'rotate-180')} />
                                </button>
                            )}
                            {todo.attachments?.length > 0 && (
                                <button onClick={() => setShowAttachments(s => !s)}
                                    className="text-xs text-muted-foreground hover:text-foreground">
                                    📎 {todo.attachments.length}
                                </button>
                            )}
                            {isCompleted && todo.completed_by && (
                                <span className="text-[10px] text-muted-foreground">
                                    ✓ {todo.completed_by}
                                </span>
                            )}
                        </div>

                        {/* Subtasks */}
                        {showSubtasks && subtasks.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {subtasks.map(sub => (
                                    <button key={sub.id}
                                        onClick={() => onQuickUpdate && handleSubtaskToggle(sub.id)}
                                        className={cn(
                                            'w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg text-left hover:bg-accent/50 transition-colors',
                                            sub.done ? 'text-muted-foreground line-through' : 'text-foreground'
                                        )}>
                                        <div className={cn(
                                            'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                                            sub.done ? 'bg-status-ok/20 border-status-ok/50' : 'border-border'
                                        )}>
                                            {sub.done && <Check className="w-2.5 h-2.5 text-status-ok" />}
                                        </div>
                                        {sub.title}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Anhänge */}
                        {showAttachments && todo.attachments?.length > 0 && (
                            <div className="mt-2">
                                <AttachmentGallery attachments={todo.attachments} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}