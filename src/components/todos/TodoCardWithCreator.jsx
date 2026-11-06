import React, { useState } from 'react';
import { Check, Calendar, Pencil, Trash2, Archive, User, MoreVertical, Circle, Loader, CheckCircle, ChevronDown, ChevronUp, Image as ImageIcon, Clock } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AttachmentGallery from './AttachmentGallery';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const priorityConfig = {
  'niedrig': { color: 'bg-surface', label: 'Niedrig', cardBg: '', badge: 'text-muted-foreground' },
  'mittel': { color: 'bg-primary/70', label: 'Mittel', cardBg: '', badge: 'text-primary' },
  'hoch': { color: 'bg-status-warn/70', label: 'Hoch', cardBg: 'bg-status-warn/5 border-status-warn/20', badge: 'text-status-warn' },
  'dringend': { color: 'bg-status-danger/70', label: 'Dringend', cardBg: 'bg-status-danger/10 border-status-danger/30', badge: 'text-status-danger' },
};

const categoryColors = {
  'Einkauf': 'bg-status-ok/15 text-status-ok border-status-ok/20',
  'Reparatur': 'bg-status-warn/15 text-status-warn border-status-warn/20',
  'Event': 'bg-primary/15 text-primary border-primary/20',
  'Sonstiges': 'bg-surface text-muted-foreground border-border',
};

const statusCycle = { 'offen': 'in_bearbeitung', 'in_bearbeitung': 'erledigt', 'erledigt': 'offen' };
const statusConfig = {
  'offen': { icon: Circle, color: 'text-muted-foreground', label: 'Offen' },
  'in_bearbeitung': { icon: Loader, color: 'text-primary', label: 'In Bearbeitung' },
  'erledigt': { icon: CheckCircle, color: 'text-status-ok', label: 'Erledigt' }
};

function formatDueDate(dateStr) {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Heute';
  if (isTomorrow(d)) return 'Morgen';
  return format(d, 'd. MMM', { locale: de });
}

function formatCreatedTime(timeStr) {
  if (!timeStr) return '';
  // Erwartet HH:MM Format
  return timeStr;
}

export default function TodoCardWithCreator({
  todo,
  employees,
  onStatusChange,
  onEdit,
  onDelete,
  onArchive,
  onQuickUpdate,
  showArchiveButton,
  sortBy,
  allTodos,
  idx
}) {
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);

  const isCompleted = todo.status === 'erledigt';
  const isInProgress = todo.status === 'in_bearbeitung';
  const pCfg = priorityConfig[todo.priority] || priorityConfig['mittel'];
  const StatusIcon = statusConfig[todo.status]?.icon || Circle;
  const statusColor = statusConfig[todo.status]?.color || 'text-muted-foreground';

  const isOverdue = todo.due_date && isPast(parseISO(todo.due_date)) && !isToday(parseISO(todo.due_date)) && !isCompleted;
  const isDueToday = todo.due_date && isToday(parseISO(todo.due_date)) && !isCompleted;

  const assignees = todo.assigned_to_names?.length > 0 ? todo.assigned_to_names : todo.assigned_to ? [todo.assigned_to] : [];
  const subtasks = todo.subtasks || [];
  const doneSubtasks = subtasks.filter(s => s.done).length;

  // Creator info
  const createdBy = todo.created_by || 'Unbekannt';
  const createdAtTime = todo.created_at_time ? formatCreatedTime(todo.created_at_time) : '';

  const handleSubtaskToggle = (subId) => {
    const updated = subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s);
    onQuickUpdate(todo, { subtasks: updated });
  };

  const handleMoveUp = () => {
    if (!allTodos || idx === 0) return;
    const prev = allTodos[idx - 1];
    onQuickUpdate(todo, { sort_order: (prev.sort_order ?? idx - 1) - 0.5 });
  };

  const handleMoveDown = () => {
    if (!allTodos || idx === allTodos.length - 1) return;
    const next = allTodos[idx + 1];
    onQuickUpdate(todo, { sort_order: (next.sort_order ?? idx + 1) + 0.5 });
  };

  return (
    <Card className={cn(
      "border transition-all overflow-hidden",
      pCfg.cardBg || "bg-card border-border/50",
      isCompleted && "opacity-50"
    )}>
      <div className="flex flex-col">
        {/* Priority stripe */}
        <div className={cn("h-1.5 w-full shrink-0", pCfg.color)} />

        <div className="flex gap-3 px-3 py-4 flex-1 min-w-0">
          {/* Status toggle */}
          <button
            onClick={() => onStatusChange(todo, statusCycle[todo.status])}
            className={cn("mt-0.5 shrink-0 transition-all active:scale-90", statusColor)}
            title={`${statusConfig[todo.status]?.label} → weiterklicken`}
          >
            <StatusIcon className={cn("w-6 h-6", isInProgress && "animate-spin")} />
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className={cn(
                  "font-semibold text-base leading-snug",
                  isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                )}>
                  {todo.title}
                  {todo.priority === 'dringend' && !isCompleted && (
                    <span className="ml-1.5 text-sm text-status-danger font-bold">❗</span>
                  )}
                </h4>
                {!isCompleted && todo.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{todo.description}</p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Manual sort arrows */}
                {sortBy === 'manual' && allTodos && (
                  <div className="flex flex-col">
                    <button onClick={handleMoveUp} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-1">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button onClick={handleMoveDown} disabled={idx === allTodos.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-1">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Quick edit button */}
                <Button variant="ghost" size="icon" onClick={() => onEdit(todo)}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground">
                  <Pencil className="w-4 h-4" />
                </Button>

                {/* More actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Status</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onStatusChange(todo, 'offen')}>
                      <Circle className="w-4 h-4 mr-2 text-muted-foreground" /> Offen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange(todo, 'in_bearbeitung')}>
                      <Loader className="w-4 h-4 mr-2 text-primary" /> In Bearbeitung
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange(todo, 'erledigt')}>
                      <CheckCircle className="w-4 h-4 mr-2 text-status-ok" /> Erledigt
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Priorität ändern</DropdownMenuLabel>
                    {['dringend', 'hoch', 'mittel', 'niedrig'].map(p => (
                      <DropdownMenuItem key={p} onClick={() => onQuickUpdate(todo, { priority: p })}
                        className={todo.priority === p ? 'font-bold' : ''}>
                        <span className={cn("w-2 h-2 rounded-full mr-2 inline-block", priorityConfig[p].color)} />
                        {priorityConfig[p].label}
                        {todo.priority === p && ' ✓'}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Kategorie</DropdownMenuLabel>
                    {['Einkauf', 'Reparatur', 'Event', 'Sonstiges'].map(cat => (
                      <DropdownMenuItem key={cat} onClick={() => onQuickUpdate(todo, { category: cat })}
                        className={todo.category === cat ? 'font-bold' : ''}>
                        {cat} {todo.category === cat && '✓'}
                      </DropdownMenuItem>
                    ))}
                    {employees?.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Zuweisen an</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onQuickUpdate(todo, { assigned_to: '', assigned_to_names: [] })}>
                          Niemand
                        </DropdownMenuItem>
                        {employees.slice(0, 8).map(emp => (
                          <DropdownMenuItem key={emp.id} onClick={() => onQuickUpdate(todo, { assigned_to: emp.name, assigned_to_names: [emp.name] })}>
                            {emp.name}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    {showArchiveButton && (
                      <DropdownMenuItem onClick={() => onArchive(todo.id)}>
                        <Archive className="w-4 h-4 mr-2 text-status-warn" /> Archivieren
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onDelete(todo.id)} className="text-status-danger focus:text-status-danger">
                      <Trash2 className="w-4 h-4 mr-2" /> Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              {todo.category && (
                <span className={cn("px-2 py-0.5 rounded-md border font-medium", categoryColors[todo.category] || categoryColors['Sonstiges'])}>
                  {todo.category}
                </span>
              )}
              <span className={cn("px-2 py-0.5 rounded-md font-medium", `${pCfg.badge}`)}>
                {pCfg.label}
              </span>
              {todo.due_date && (
                <span className={cn(
                  "flex items-center gap-1 font-medium",
                  isOverdue ? "text-status-danger" : isDueToday ? "text-status-warn" : "text-muted-foreground"
                )}>
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDueDate(todo.due_date)}
                  {isOverdue && ' ⚠️'}
                </span>
              )}
              {assignees.length > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <User className="w-3.5 h-3.5" />
                  {assignees.join(', ')}
                </span>
              )}
              {createdBy && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span className="w-3.5 h-3.5">✏️</span>
                  von {createdBy}
                  {createdAtTime && ` um ${createdAtTime}`}
                </span>
              )}
              {subtasks.length > 0 && (
                <button
                  onClick={() => setShowSubtasks(s => !s)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground py-0.5"
                >
                  ☑ {doneSubtasks}/{subtasks.length}
                  {showSubtasks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
              {todo.completed_by && isCompleted && (
                <span className="text-muted-foreground">✓ {todo.completed_by}</span>
              )}
            </div>

            {/* Attachment count indicator */}
            {todo.attachments && todo.attachments.length > 0 && (
              <button
                onClick={() => setShowAttachments(!showAttachments)}
                className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-secondary/30 border border-border/40 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-all"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {todo.attachments.length} {todo.attachments.length === 1 ? 'Anhang' : 'Anhänge'}
                {showAttachments ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
              </button>
            )}

            {/* Attachments Gallery */}
            {todo.attachments && todo.attachments.length > 0 && showAttachments && (
              <div className="mt-3 pt-3 border-t border-border/40">
                <AttachmentGallery attachments={todo.attachments} readOnly={true} />
              </div>
            )}

            {/* Subtasks */}
            {showSubtasks && subtasks.length > 0 && (
              <div className="mt-3 space-y-2 pl-2 border-l-2 border-border ml-1">
                {subtasks.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => handleSubtaskToggle(sub.id)}
                    className="flex items-center gap-2.5 w-full text-left group py-0.5"
                  >
                    <div className={cn("w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all",
                      sub.done
                        ? "bg-status-ok/70 border-status-ok/70"
                        : "border-border group-hover:border-foreground"
                    )}>
                      {sub.done && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={cn("text-sm", sub.done ? "line-through text-muted-foreground" : "text-foreground")}>
                      {sub.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}