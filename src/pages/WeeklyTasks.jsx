/**
 * WeeklyTasks — Manager Wochenplaner
 * Mobile-first: Tab-Switch zwischen Kalender und Backlog
 */
import { toast } from 'sonner';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    format, addDays, startOfWeek, isSameDay, isToday
} from 'date-fns';
import { de } from 'date-fns/locale';
import {
    ChevronLeft, ChevronRight, Plus, X, Clock, CalendarDays,
    CheckSquare, Trash2, Check, List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';

// ── Konstanten ────────────────────────────────────────────────────────────────
const SLOT_H = 80; // px pro Stunde (20px pro 15min-Slot)

function displayHour(h) {
    return String(h % 24).padStart(2, '0') + ':00';
}

const PRIORITY_STRIPE = {
    dringend: 'bg-red-500',
    hoch:     'bg-orange-500',
    mittel:   'bg-blue-500',
    niedrig:  'bg-slate-400',
};

const APPOINTMENT_COLORS = {
    amber:  { bg: 'bg-amber-500/20',  border: 'border-amber-500/50',  text: 'text-amber-300',  dot: 'bg-amber-500' },
    blue:   { bg: 'bg-blue-500/20',   border: 'border-blue-500/50',   text: 'text-blue-300',   dot: 'bg-blue-500'  },
    green:  { bg: 'bg-green-500/20',  border: 'border-green-500/50',  text: 'text-green-300',  dot: 'bg-green-500' },
    purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-300', dot: 'bg-purple-500'},
    red:    { bg: 'bg-red-500/20',    border: 'border-red-500/50',    text: 'text-red-300',    dot: 'bg-red-500'   },
};

function timeToMinutes(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}
function minutesToTime(m) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
// Rundet Minuten auf nächstes 15-Minuten-Raster
function snapTo15(minutes) {
    return Math.round(minutes / 15) * 15;
}

function minutesToPx(minutes, hourStart) {
    return ((minutes - hourStart * 60) / 60) * SLOT_H;
}
function durationToPx(minutes) {
    return (minutes / 60) * SLOT_H;
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function WeeklyTasks() {
    const permissions  = usePermissions();
    const queryClient  = useQueryClient();
    const [draggedTodo, setDraggedTodo] = useState(null);
    const [draggedItem, setDraggedItem] = useState(null); // { type: 'todo'|'appointment', item }
    const [dragOverSlot, setDragOverSlot] = useState(null); // { dateStr, hour }

    // ── Woche ─────────────────────────────────────────────────────────────────
    const [weekStart, setWeekStart] = useState(() =>
        startOfWeek(new Date(), { weekStartsOn: 1 })
    );

    // ── Zeitachse (konfigurierbar) ────────────────────────────────────────────
    const [hourStart, setHourStart] = useState(10);
    const [hourEnd,   setHourEnd]   = useState(26);
    const hours = Array.from({ length: hourEnd - hourStart }, (_, i) => hourStart + i);
    const totalPx = (hourEnd - hourStart) * SLOT_H;
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekLabel = `${format(weekStart, 'd. MMM')} – ${format(addDays(weekStart, 6), 'd. MMM yyyy', { locale: de })}`;

    // ── Mobile Tab ────────────────────────────────────────────────────────────
    const [mobileTab, setMobileTab] = useState('calendar'); // 'calendar' | 'backlog'

    // ── UI State ──────────────────────────────────────────────────────────────
    const [slotPopover,    setSlotPopover]    = useState(null);
    const [editItem,       setEditItem]       = useState(null);
    const [newTitle,       setNewTitle]       = useState('');
    const [newTime,        setNewTime]        = useState('');
    const [newDuration,    setNewDuration]    = useState(60);
    const [newColor,       setNewColor]       = useState('blue');
    const [newMode,        setNewMode]        = useState('appointment');
    const [newRecurrence,  setNewRecurrence]  = useState('none');
    // Mobile: welcher Tag ist aktiv
    const [activeDayIdx,   setActiveDayIdx]   = useState(() => {
        const today = new Date();
        const idx = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today, { weekStartsOn: 1 }), i))
            .findIndex(d => isSameDay(d, today));
        return idx >= 0 ? idx : 0;
    });
    // Zeitbereich-Dialog (Mobile)
    const [timeConfigOpen, setTimeConfigOpen] = useState(false);

    const gridRef       = useRef(null);
    const dragOverMinRef  = useRef(null); // speichert snappedMin synchron für Drop
    const resizeRef       = useRef(null); // { apptId, appt, startY, startDuration }
    const resizePreviewRef= useRef(null); // live duration während Resize
    const [resizingId,    setResizingId]    = useState(null);
    const [resizePreview, setResizePreview] = useState(null); // { id, duration }

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: todos = [] } = useQuery({
        queryKey: ['todos'],
        queryFn: () => base44.entities.TodoItem.filter({ is_archived: false }, '-created_date', 300),
        staleTime: 60_000,
    });

    const weekStr    = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

    const { data: appointments = [] } = useQuery({
        queryKey: ['manager-appointments', weekStr],
        queryFn: async () => {
            const from = format(addDays(weekStart, -28), 'yyyy-MM-dd');
            const to   = format(addDays(weekStart,  35), 'yyyy-MM-dd');
            const all  = await base44.entities.ManagerAppointment.list('date', 500);
            return all.filter(a => a.date >= from && a.date <= to);
        },
        staleTime: 30_000,
    });

    // ── Mutations ─────────────────────────────────────────────────────────────
    const updateTodo = useMutation({
        mutationFn: ({ id, data }) => base44.entities.TodoItem.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const createAppointment = useMutation({
        mutationFn: (data) => base44.entities.ManagerAppointment.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager-appointments'] }),
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const updateAppointment = useMutation({
        mutationFn: ({ id, data }) => base44.entities.ManagerAppointment.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager-appointments'] }),
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const deleteAppointment = useMutation({
        mutationFn: (id) => base44.entities.ManagerAppointment.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager-appointments'] }),
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const deleteTodoPlanning = (todo) => {
        updateTodo.mutate({ id: todo.id, data: { planned_date: null, planned_time: null } });
    };

    // ── Drag & Drop Handler ───────────────────────────────────────────────────
    const handleDragStart = (e, todo) => {
        setDraggedTodo(todo);
        setDraggedItem({ type: 'todo', item: todo });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragStartAppointment = (e, appt) => {
        setDraggedItem({ type: 'appointment', item: appt });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragStartPlannedTodo = (e, todo) => {
        setDraggedItem({ type: 'planned-todo', item: todo });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = () => {
        setDraggedTodo(null);
        setDraggedItem(null);
        setDragOverSlot(null);
        dragOverMinRef.current = null;
    };

    // ── Resize-Handle (Dauer per Maus/Touch anpassen) ──────────────────────────
    const startResize = (e, appt) => {
        e.stopPropagation();
        e.preventDefault();
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        resizeRef.current = {
            apptId:        appt.id,
            appt:          { ...appt },
            startY:        clientY,
            startDuration: appt.duration || 60,
        };
        resizePreviewRef.current = appt.duration || 60;
        setResizingId(appt.id);
        setResizePreview({ id: appt.id, duration: appt.duration || 60 });

        const onMove = (ev) => {
            ev.preventDefault();
            const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
            const { startY, startDuration } = resizeRef.current;
            const deltaY    = cy - startY;
            const deltaMins = Math.round((deltaY / SLOT_H) * 60);
            const snapped   = Math.max(15, snapTo15(startDuration + deltaMins));
            resizePreviewRef.current = snapped;
            setResizePreview({ id: resizeRef.current.apptId, duration: snapped });
        };

        const onEnd = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend',  onEnd);
            if (!resizeRef.current) return;
            const a        = resizeRef.current.appt;
            const finalDur = resizePreviewRef.current ?? a.duration ?? 60;
            if (finalDur !== (a.duration ?? 60)) {
                const startMin = timeToMinutes(a.start_time);
                updateAppointment.mutate({
                    id: a.id,
                    data: { duration: finalDur, end_time: minutesToTime(startMin + finalDur) },
                });
            }
            resizeRef.current = null;
            resizePreviewRef.current = null;
            setResizingId(null);
            setResizePreview(null);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend',  onEnd);
    };

    // ── Spalten-weiter DragOver (ein Handler pro Tag-Spalte) ─────────────────
    // Berechnet Minuten aus der absoluten Mausposition relativ zur Spalte.
    // Kein per-Slot-Handler nötig → keine Interferenz mit Kind-Elementen.
    const handleColDragOver = (e, dateStr) => {
        if (!draggedItem && !draggedTodo) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const colRect  = e.currentTarget.getBoundingClientRect();
        const pyInCol  = Math.max(0, e.clientY - colRect.top);
        // pyInCol = pixel ab Spaltenanfang (= hourStart * SLOT_H)
        const rawMin   = hourStart * 60 + Math.floor((pyInCol / SLOT_H) * 60);
        const snapped  = snapTo15(Math.max(hourStart * 60, Math.min((hourEnd) * 60, rawMin)));
        const hour     = Math.floor(snapped / 60);

        dragOverMinRef.current = snapped;
        setDragOverSlot({ dateStr, hour, snappedMin: snapped });
    };

    // Compat-Wrapper (falls noch per-Slot-Handler existieren)
    const handleSlotDragOver = (e, dateStr, hour) => handleColDragOver(e, dateStr);

    // Spalten-weiter Drop
    const handleColDrop = (e, date, dateStr) => {
        e.preventDefault();
        const newDate  = format(date, 'yyyy-MM-dd');
        // Nochmal live berechnen als Fallback falls Ref veraltet
        const colRect  = e.currentTarget.getBoundingClientRect();
        const pyInCol  = Math.max(0, e.clientY - colRect.top);
        const liveMin  = hourStart * 60 + Math.floor((pyInCol / SLOT_H) * 60);
        const liveSn   = snapTo15(Math.max(hourStart * 60, Math.min(hourEnd * 60, liveMin)));
        // Ref nehmen wenn vorhanden und für diese Spalte gültig
        const snapped  = (dragOverMinRef.current !== null && dragOverSlot?.dateStr === dateStr)
            ? dragOverMinRef.current
            : liveSn;
        const newTime  = minutesToTime(snapped);

        if (draggedItem?.type === 'appointment') {
            updateAppointment.mutate({ id: draggedItem.item.id, data: {
                date: newDate, start_time: newTime,
                end_time: minutesToTime(snapped + (draggedItem.item.duration || 60)),
            }});
        } else if (draggedItem?.type === 'planned-todo') {
            updateTodo.mutate({ id: draggedItem.item.id, data: {
                planned_date: newDate, planned_time: newTime,
            }});
        } else if (draggedTodo) {
            updateTodo.mutate({ id: draggedTodo.id, data: {
                planned_date: newDate, planned_time: newTime, planned_duration: 60,
            }});
        }
        setDraggedTodo(null); setDraggedItem(null);
        setDragOverSlot(null); dragOverMinRef.current = null;
    };

    // Compat-Wrapper
    const handleSlotDrop = (e, date, hour) => {
        e.preventDefault();
        const newDate = format(date, 'yyyy-MM-dd');

        // dragOverMinRef wurde im letzten dragover-Event synchron geschrieben.
        const snapped = dragOverMinRef.current ?? snapTo15(hour * 60);
        const newTime = minutesToTime(snapped);

        if (draggedItem?.type === 'appointment') {
            updateAppointment.mutate({
                id: draggedItem.item.id,
                data: {
                    date:       newDate,
                    start_time: newTime,
                    end_time:   minutesToTime(snapped + (draggedItem.item.duration || 60)),
                },
            });
        } else if (draggedItem?.type === 'planned-todo') {
            updateTodo.mutate({
                id: draggedItem.item.id,
                data: {
                    planned_date: newDate,
                    planned_time: newTime,
                },
            });
        } else if (draggedTodo) {
            updateTodo.mutate({
                id: draggedTodo.id,
                data: {
                    planned_date:     newDate,
                    planned_time:     newTime,
                    planned_duration: 60,
                },
            });
        }

        setDraggedTodo(null);
        setDraggedItem(null);
        setDragOverSlot(null);
        dragOverMinRef.current = null;
    };

    const handleSlotDragLeave = () => {
        setDragOverSlot(null);
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const plannedTodos = useMemo(() =>
        todos.filter(t =>
            t.planned_date &&
            t.planned_date >= weekStr &&
            t.planned_date <= weekEndStr
        ), [todos, weekStr, weekEndStr]
    );

    const backlogTodos = useMemo(() =>
        todos.filter(t =>
            t.status !== 'erledigt' &&
            !t.is_archived &&
            (!t.planned_date || t.planned_date < weekStr || t.planned_date > weekEndStr)
        ).sort((a, b) => {
            const po = { dringend: 0, hoch: 1, mittel: 2, niedrig: 3 };
            return (po[a.priority] ?? 2) - (po[b.priority] ?? 2);
        }), [todos, weekStr, weekEndStr]
    );

    const weekAppointments = useMemo(() =>
        appointments.filter(a =>
            a.date >= weekStr && a.date <= weekEndStr
        ), [appointments, weekStr, weekEndStr]
    );

    // ── Handler ───────────────────────────────────────────────────────────────
    const handleSlotClick = (date, clickMinutes) => {
        const snapped = snapTo15(clickMinutes);
        setNewTitle('');
        setNewTime(minutesToTime(snapped));
        setNewDuration(60);
        setNewColor('blue');
        setNewMode('appointment');
        setSlotPopover({ date, hour: Math.floor(snapped / 60) });
    };

    const handleCreateAppointment = () => {
        if (!newTitle.trim() || !slotPopover) return;
        const startMin = timeToMinutes(newTime);
        const endMin   = startMin + newDuration;
        const baseData = {
            title:      newTitle.trim(),
            start_time: newTime,
            end_time:   minutesToTime(endMin),
            duration:   newDuration,
            color:      newColor,
        };
        // Einmalig oder wiederkehrend
        const datesToCreate = [];
        if (newRecurrence === 'none') {
            datesToCreate.push(format(slotPopover.date, 'yyyy-MM-dd'));
        } else {
            const step = newRecurrence === 'biweekly' ? 14 : 7;
            for (let w = 0; w < 8; w++) {
                datesToCreate.push(format(addDays(slotPopover.date, w * step), 'yyyy-MM-dd'));
            }
        }
        datesToCreate.forEach(date => createAppointment.mutate({ ...baseData, date }));
        setSlotPopover(null);
        setNewRecurrence('none');
        if (newRecurrence !== 'none') toast.success(`${datesToCreate.length} Termine angelegt`);
    };

    const handlePlanTodo = (todo, date, time) => {
        updateTodo.mutate({
            id: todo.id,
            data: {
                planned_date:     format(date, 'yyyy-MM-dd'),
                planned_time:     time,
                planned_duration: newDuration,
            },
        });
        setSlotPopover(null);
    };

    // Scroll zu aktueller Zeit
    useEffect(() => {
        if (!gridRef.current) return;
        const now = new Date();
        const px = minutesToPx(now.getHours() * 60 + now.getMinutes(), hourStart);
        gridRef.current.scrollTop = Math.max(0, px - 120);
    }, []);

    // Beim Wochenwechsel: activeDay auf Montag setzen
    useEffect(() => {
        setActiveDayIdx(0);
    }, [weekStart]);

    // ── Guard (nach allen Hooks!) ─────────────────────────────────────────────
    if (!permissions.isManager && !permissions.isAdmin) {
        return <PermissionDenied message="Diese Ansicht ist nur für Manager verfügbar." />;
    }

    const activeDay    = weekDays[activeDayIdx];
    const activeDateStr = format(activeDay, 'yyyy-MM-dd');

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background flex flex-col">

            {/* ── Top-Bar ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-30 gap-2">
                {/* Links: Titel + Wochenlabel */}
                <div className="flex items-center gap-2 min-w-0">
                    <CalendarDays className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                        <h1 className="text-sm font-bold text-foreground leading-none">Wochenplaner</h1>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{weekLabel}</p>
                    </div>
                </div>

                {/* Rechts: Navigation + Heute + Zeitbereich */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline"
                        onClick={() => {
                            setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
                            setActiveDayIdx(Math.max(0, [0,1,2,3,4,5,6].findIndex((_, i) => isSameDay(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), new Date()))));
                        }}
                        className={cn(
                            'h-7 px-2 text-xs transition-all',
                            !isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }))
                                ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                                : ''
                        )}>
                        Heute
                    </Button>
                    <div className="flex border border-border rounded-lg overflow-hidden">
                        <button onClick={() => setWeekStart(d => addDays(d, -7))}
                            className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:bg-accent">
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setWeekStart(d => addDays(d, 7))}
                            className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:bg-accent border-l border-border">
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {/* Zeitbereich — auf Mobile als Button, auf Desktop inline */}
                    <button
                        onClick={() => setTimeConfigOpen(true)}
                        className="md:hidden flex items-center gap-1 h-7 px-2 rounded-lg border border-border bg-card text-xs text-muted-foreground hover:text-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{String(hourStart).padStart(2,'0')}–{hourEnd >= 24 ? String(hourEnd-24).padStart(2,'0')+'+' : String(hourEnd).padStart(2,'0')}</span>
                    </button>
                    {/* Desktop Zeitbereich inline */}
                    <div className="hidden md:flex items-center gap-1 border border-border rounded-lg px-2 h-7 bg-card">
                        <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                        <select value={hourStart} onChange={e => setHourStart(Number(e.target.value))}
                            className="h-full bg-transparent text-xs text-foreground border-none outline-none cursor-pointer pr-1">
                            {Array.from({ length: 24 }, (_, i) => i).map(h => (
                                <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                            ))}
                        </select>
                        <span className="text-muted-foreground text-xs">–</span>
                        <select value={hourEnd} onChange={e => setHourEnd(Number(e.target.value))}
                            className="h-full bg-transparent text-xs text-foreground border-none outline-none cursor-pointer pr-1">
                            {Array.from({ length: 18 }, (_, i) => i + 16).map(h => (
                                <option key={h} value={h}>
                                    {h < 24 ? String(h).padStart(2,'0') : String(h-24).padStart(2,'0')}:00
                                    {h >= 24 ? ' (+1)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Mobile Tab-Leiste ────────────────────────────────────────── */}
            <div className="md:hidden flex border-b border-border bg-card">
                <button
                    onClick={() => setMobileTab('calendar')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors',
                        mobileTab === 'calendar'
                            ? 'border-amber-500 text-amber-500'
                            : 'border-transparent text-muted-foreground'
                    )}>
                    <CalendarDays className="w-3.5 h-3.5" />
                    Kalender
                </button>
                <button
                    onClick={() => setMobileTab('backlog')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors',
                        mobileTab === 'backlog'
                            ? 'border-amber-500 text-amber-500'
                            : 'border-transparent text-muted-foreground'
                    )}>
                    <List className="w-3.5 h-3.5" />
                    Backlog
                    {backlogTodos.length > 0 && (
                        <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            {backlogTodos.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ── Mobile Kalender-Ansicht ──────────────────────────────────── */}
            {mobileTab === 'calendar' && (
                <div className="md:hidden flex flex-col flex-1 overflow-hidden">
                    {/* Tag-Scroller */}
                    <div className="flex border-b border-border bg-card overflow-x-auto scrollbar-hide px-1 gap-1 py-1.5">
                        {weekDays.map((day, i) => {
                            const active = i === activeDayIdx;
                            const now    = isToday(day);
                            return (
                                <button key={i}
                                    onClick={() => setActiveDayIdx(i)}
                                    className={cn(
                                        'flex flex-col items-center px-3 py-1.5 rounded-xl shrink-0 transition-all',
                                        active
                                            ? 'bg-amber-500 text-white'
                                            : now
                                                ? 'bg-amber-500/10 text-amber-500'
                                                : 'text-muted-foreground hover:bg-accent/50'
                                    )}>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                                        {format(day, 'EEE', { locale: de })}
                                    </span>
                                    <span className="text-base font-bold leading-tight">{format(day, 'd')}</span>
                                    {now && !active && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-0.5" />}
                                    {now && active && <span className="w-1.5 h-1.5 rounded-full bg-white/80 mt-0.5" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Zeitachse für aktiven Tag */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="flex" style={{ height: `${totalPx}px` }}>
                            {/* Zeitachse links */}
                            <div className="w-12 shrink-0 relative">
                                {hours.map(h => (
                                    <div key={h}
                                        className="absolute left-0 right-0"
                                        style={{ top: `${(h - hourStart) * SLOT_H}px`, height: `${SLOT_H}px` }}>
                                        <span className="absolute right-1 text-[10px] text-muted-foreground font-mono -mt-2 top-0">
                                            {displayHour(h)}
                                        </span>
                                        {[1,2,3].map(q => (
                                            <span key={q} className="absolute right-1 text-[8px] text-muted-foreground/40 font-mono"
                                                style={{ top: `${(SLOT_H / 4) * q - 6}px` }}>
                                                :{String(q * 15).padStart(2,'0')}
                                            </span>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            {/* Tag-Spalte */}
                            <div className="flex-1 border-l border-border relative"
                                data-col={activeDateStr}
                                onDragOver={e => handleColDragOver(e, activeDateStr)}
                                onDragLeave={handleSlotDragLeave}
                                onDrop={e => handleColDrop(e, activeDay, activeDateStr)}>
                                {/* Stunden-Linien */}
                                {hours.map(h => {
                                   const isDropTarget = dragOverSlot?.dateStr === activeDateStr && dragOverSlot?.hour === h;
                                   return (
                                   <div key={h}
                                       className={cn(
                                           'absolute left-0 right-0 border-t border-border/40 cursor-pointer hover:bg-accent/30 transition-colors group',
                                           isDropTarget && (draggedTodo || draggedItem) && 'bg-amber-500/20 border-amber-500/50'
                                       )}
                                       style={{ top: `${(h - hourStart) * SLOT_H}px`, height: `${SLOT_H}px` }}
                                       onClick={e => {
                                           const rect = e.currentTarget.getBoundingClientRect();
                                           const py = e.clientY - rect.top;
                                           const clickMin = h * 60 + Math.max(0, Math.min(59, Math.floor((py / SLOT_H) * 60)));
                                           handleSlotClick(activeDay, clickMin);
                                       }}>
                                       {/* 15min Subticks */}
                                       <div className="absolute left-0 right-0 border-t border-border/20 pointer-events-none" style={{ top: `${SLOT_H * 0.25}px` }} />
                                       <div className="absolute left-0 right-0 border-t border-border/30 pointer-events-none" style={{ top: `${SLOT_H * 0.5}px` }} />
                                       <div className="absolute left-0 right-0 border-t border-border/20 pointer-events-none" style={{ top: `${SLOT_H * 0.75}px` }} />
                                       {isDropTarget && (draggedTodo || draggedItem) ? (
                                           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                               <span className="text-[11px] text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full">
                                                   {dragOverSlot?.snappedMin !== undefined ? minutesToTime(dragOverSlot.snappedMin) : `${String(h).padStart(2,'0')}:00`} ↓
                                               </span>
                                           </div>
                                       ) : (
                                           <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                               <Plus className="w-4 h-4 text-muted-foreground/50" />
                                           </div>
                                       )}
                                       </div>
                                       );
                                       })}

                                       {/* Jetzt-Linie */}
                                {isToday(activeDay) && (() => {
                                    const now = new Date();
                                    const nowPx = minutesToPx(now.getHours() * 60 + now.getMinutes(), hourStart);
                                    if (nowPx < 0) return null;
                                    return (
                                        <div className="absolute left-0 right-0 z-10 pointer-events-none"
                                            style={{ top: `${nowPx}px` }}>
                                            <div className="flex items-center">
                                                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                                                <div className="flex-1 border-t-2 border-red-500" />
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Eingeplante Todos */}
                                {plannedTodos
                                    .filter(t => t.planned_date === activeDateStr)
                                    .map(todo => {
                                        if (!todo.planned_time) return null;
                                        const startMin = timeToMinutes(todo.planned_time);
                                        if (startMin < hourStart * 60 || startMin >= hourEnd * 60) return null;
                                        const dur = todo.planned_duration || 60;
                                        const top = minutesToPx(startMin, hourStart);
                                        const h   = Math.max(durationToPx(dur), 24);
                                        const pCfg = PRIORITY_STRIPE[todo.priority] || PRIORITY_STRIPE.mittel;
                                        const isDraggingThis = draggedItem?.type === 'planned-todo' && draggedItem.item.id === todo.id;
                                        const isDone = todo.status === 'erledigt';
                                        return (
                                            <div key={todo.id}
                                                draggable
                                                onDragStart={e => { e.stopPropagation(); handleDragStartPlannedTodo(e, todo); }}
                                                onDragEnd={handleDragEnd}
                                                className={cn(
                                                    'absolute left-0.5 right-0.5 z-10 rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing transition-colors flex',
                                                    isDone
                                                        ? 'border-green-500/40 bg-green-500/10 opacity-70'
                                                        : 'border-blue-500/30 bg-blue-500/15 hover:bg-blue-500/25',
                                                    isDraggingThis && 'opacity-40'
                                                )}
                                                style={{ top: `${top}px`, height: `${h}px`, minHeight: '24px' }}
                                                onClick={e => { e.stopPropagation(); setEditItem({ type: 'todo', item: todo }); }}>
                                                <div className={cn('w-1 shrink-0', isDone ? 'bg-green-500' : pCfg)} />
                                                <div className="flex-1 px-1.5 py-1 min-w-0 flex items-center gap-1">
                                                    {isDone && <Check className="w-3 h-3 text-green-400 shrink-0" />}
                                                    <p className={cn('text-[11px] font-semibold truncate leading-tight', isDone ? 'text-green-300 line-through' : 'text-blue-200')}>
                                                        {todo.planned_time} {todo.title}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                        })}

                                        {/* Termine */}
                                        {weekAppointments
                                        .filter(a => a.date === activeDateStr)
                                    .map(appt => {
                                        const startMin = timeToMinutes(appt.start_time);
                                        if (startMin < hourStart * 60 || startMin >= hourEnd * 60) return null;
                                        const dur = appt.duration || 60;
                                        const top = minutesToPx(startMin, hourStart);
                                        const h   = Math.max(durationToPx(dur), 24);
                                        const col = APPOINTMENT_COLORS[appt.color] || APPOINTMENT_COLORS.blue;
                                        const isDraggingThis = draggedItem?.type === 'appointment' && draggedItem.item.id === appt.id;
                                        return (
                                            <div key={appt.id}
                                                draggable
                                                onDragStart={e => { e.stopPropagation(); handleDragStartAppointment(e, appt); }}
                                                onDragEnd={handleDragEnd}
                                                className={cn(
                                                    'absolute left-0.5 right-0.5 z-10 rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing transition-colors',
                                                    col.bg, col.border, isDraggingThis && 'opacity-40'
                                                )}
                                                style={{ top: `${top}px`, height: `${h}px`, minHeight: '24px' }}
                                                onClick={e => { e.stopPropagation(); setEditItem({ type: 'appointment', item: appt }); }}>
                                                <div className="px-1.5 py-1 min-w-0 flex-1">
                                                    <p className={cn('text-[11px] font-semibold truncate leading-tight', col.text)}>
                                                        {appt.start_time} {appt.title}
                                                    </p>
                                                    {appt.attendees?.length > 0 && (
                                                        <p className="text-[9px] text-muted-foreground/60 truncate mt-0.5 flex items-center gap-0.5">
                                                            <Users className="w-2.5 h-2.5 inline shrink-0" />
                                                            {appt.attendees.join(', ')}
                                                        </p>
                                                    )}
                                                    {appt.notes && (
                                                        <p className="text-[9px] text-muted-foreground/50 truncate mt-0.5">{appt.notes}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>

                                {/* Zeitlinie — aktueller Zeitpunkt */}
                                {isToday(activeDay) && (() => {
                                    const now = new Date();
                                    const nowMin = now.getHours() * 60 + now.getMinutes();
                                    const px = minutesToPx(nowMin, hourStart);
                                    if (px < 0 || px > totalPx) return null;
                                    return (
                                        <div className="absolute left-0 right-0 z-20 pointer-events-none"
                                            style={{ top: `${px}px` }}>
                                            <div className="flex items-center">
                                                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                                                <div className="flex-1 border-t-2 border-red-500" />
                                            </div>
                                        </div>
                                    );
                                })()}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Mobile Backlog-Ansicht ───────────────────────────────────── */}
            {mobileTab === 'backlog' && (
                <div className="md:hidden flex-1 overflow-y-auto">
                    <div className="px-3 py-3 border-b border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            {backlogTodos.length} offene Aufgaben
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            Wechsle zum Kalender → Klick auf Slot → Todo einplanen
                        </p>
                    </div>
                    <div className="p-3 space-y-2">
                        {backlogTodos.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Check className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Alles eingeplant!</p>
                            </div>
                        ) : backlogTodos.map(todo => {
                            const stripe = PRIORITY_STRIPE[todo.priority] || PRIORITY_STRIPE.mittel;
                            return (
                                <div key={todo.id}
                                    className="flex gap-2.5 p-3 rounded-xl border border-border bg-card">
                                    <div className={cn('w-1 rounded-full shrink-0', stripe)} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground">{todo.title}</p>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            {todo.category && (
                                                <span className="text-xs text-muted-foreground">{todo.category}</span>
                                            )}
                                            {todo.due_date && (
                                                <span className="text-xs text-amber-400">{todo.due_date}</span>
                                            )}
                                            {todo.priority && (
                                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">{todo.priority}</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Desktop: volle Wochenansicht ─────────────────────────────── */}
            <div className="hidden md:flex flex-1 overflow-hidden">

                {/* ── Ganztags-Banner (Mobile) ──────────────────────────── */}
                {(() => {
                    const allDayAppts = weekAppointments.filter(a => a.date === activeDateStr && a.is_all_day);
                    if (!allDayAppts.length) return null;
                    return (
                        <div className="md:hidden px-3 py-1.5 border-b border-border bg-card/60 flex flex-wrap gap-1.5">
                            {allDayAppts.map(a => {
                                const col = APPOINTMENT_COLORS[a.color] || APPOINTMENT_COLORS.blue;
                                return (
                                    <button key={a.id}
                                        onClick={() => setEditItem({ type: 'appointment', item: a })}
                                        className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', col.bg, col.border, col.text)}>
                                        <CalendarRange className="w-3 h-3" />
                                        {a.title}
                                        {a.attendees?.length > 0 && <span className="opacity-60">· {a.attendees.length}×</span>}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })()}

                {/* Kalender-Hauptbereich — ein Scroll-Container für horizontal + vertikal */}
                <div className="flex-1 overflow-auto" ref={gridRef}>
                    {/* Mindestbreite: Zeitachse + 7 Tage à 120px */}
                    <div style={{ minWidth: '910px' }}>

                        {/* Tages-Header — sticky top, scrollt horizontal mit dem Grid */}
                        <div className="flex border-b border-border bg-card sticky top-0 z-20">
                            <div className="w-14 shrink-0 sticky left-0 z-30 bg-card border-r border-border" />
                            {weekDays.map((day, i) => {
                                const isNow = isToday(day);
                                return (
                                    <div key={i}
                                        className={cn(
                                            'flex-1 text-center py-2 border-l border-border min-w-[120px] relative',
                                            isNow && 'bg-amber-500/10'
                                        )}>
                                        {isNow && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
                                        <p className={cn('text-[11px] font-semibold uppercase tracking-wider',
                                            isNow ? 'text-amber-500' : 'text-muted-foreground')}>
                                            {format(day, 'EEE', { locale: de })}
                                        </p>
                                        <p className={cn('text-lg font-bold leading-tight',
                                            isNow ? 'text-amber-500' : 'text-foreground')}>
                                            {format(day, 'd')}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Grid-Body */}
                        <div className="flex" style={{ height: `${totalPx}px` }}>
                            {/* Zeitachse — sticky links */}
                            <div className="w-14 shrink-0 relative sticky left-0 z-10 bg-background border-r border-border">
                                {hours.map(h => (
                                    <div key={h}
                                        className="absolute left-0 right-0 flex items-start justify-end pr-2"
                                        style={{ top: `${(h - hourStart) * SLOT_H}px`, height: `${SLOT_H}px` }}>
                                        <span className="text-[10px] text-muted-foreground font-mono -mt-2">
                                            {displayHour(h)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {weekDays.map((day, di) => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const isNow   = isToday(day);
                                const now     = new Date();
                                const nowPx   = isNow
                                    ? minutesToPx(now.getHours() * 60 + now.getMinutes(), hourStart)
                                    : null;

                                const dayTodos = plannedTodos.filter(t => t.planned_date === dateStr);
                                const dayAppts = weekAppointments.filter(a => a.date === dateStr);

                                return (
                                    <div key={di}
                                        data-col={dateStr}
                                        className={cn(
                                            'flex-1 border-l border-border relative min-w-[120px]',
                                            isNow && 'bg-amber-500/4'
                                        )}
                                        onDragOver={e => handleColDragOver(e, dateStr)}
                                        onDragLeave={handleSlotDragLeave}
                                        onDrop={e => handleColDrop(e, day, dateStr)}>
                                        {hours.map(h => {
                                            const isDropTarget = dragOverSlot?.dateStr === dateStr && dragOverSlot?.hour === h;
                                            return (
                                            <div key={h}
                                                className={cn(
                                                    'absolute left-0 right-0 border-t border-border/40 cursor-pointer hover:bg-accent/30 transition-colors group',
                                                    isDropTarget && (draggedTodo || draggedItem) && 'bg-amber-500/20 border-amber-500/50'
                                                )}
                                                style={{ top: `${(h - hourStart) * SLOT_H}px`, height: `${SLOT_H}px` }}
                                                onClick={e => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const py = e.clientY - rect.top;
                                                    const clickMin = h * 60 + Math.max(0, Math.min(59, Math.floor((py / SLOT_H) * 60)));
                                                    handleSlotClick(day, clickMin);
                                                }}>
                                                {/* 15min Subticks */}
                                                <div className="absolute left-0 right-0 border-t border-border/20 pointer-events-none" style={{ top: `${SLOT_H * 0.25}px` }} />
                                                <div className="absolute left-0 right-0 border-t border-border/30 pointer-events-none" style={{ top: `${SLOT_H * 0.5}px` }} />
                                                <div className="absolute left-0 right-0 border-t border-border/20 pointer-events-none" style={{ top: `${SLOT_H * 0.75}px` }} />
                                                {isDropTarget && (draggedTodo || draggedItem) ? (
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <span className="text-[11px] text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full">
                                                            {dragOverSlot?.snappedMin !== undefined ? minutesToTime(dragOverSlot.snappedMin) : `${String(h).padStart(2,'0')}:00`} ↓
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Plus className="w-4 h-4 text-muted-foreground/50" />
                                                    </div>
                                                )}
                                            </div>
                                            );
                                        })}

                                        {nowPx !== null && nowPx >= 0 && (
                                            <div className="absolute left-0 right-0 z-10 pointer-events-none"
                                                style={{ top: `${nowPx}px` }}>
                                                <div className="flex items-center">
                                                    <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                                                    <div className="flex-1 border-t-2 border-red-500" />
                                                </div>
                                            </div>
                                        )}

                                        {dayTodos.map(todo => {
                                            if (!todo.planned_time) return null;
                                            const startMin = timeToMinutes(todo.planned_time);
                                            if (startMin < hourStart * 60 || startMin >= hourEnd * 60) return null;
                                            const dur  = todo.planned_duration || 60;
                                            const top  = minutesToPx(startMin, hourStart);
                                            const h    = Math.max(durationToPx(dur), 24);
                                            const pCfg = PRIORITY_STRIPE[todo.priority] || PRIORITY_STRIPE.mittel;
                                            const isDraggingThis = draggedItem?.type === 'planned-todo' && draggedItem.item.id === todo.id;
                                            const isDone = todo.status === 'erledigt';
                                            return (
                                                <div key={todo.id}
                                                    draggable
                                                    onDragStart={e => { e.stopPropagation(); handleDragStartPlannedTodo(e, todo); }}
                                                    onDragEnd={handleDragEnd}
                                                    className={cn(
                                                        'absolute left-0.5 right-0.5 z-10 rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing transition-colors flex',
                                                        isDone
                                                            ? 'border-green-500/40 bg-green-500/10 opacity-70'
                                                            : 'border-blue-500/30 bg-blue-500/15 hover:bg-blue-500/25',
                                                        isDraggingThis && 'opacity-40'
                                                    )}
                                                    style={{ top: `${top}px`, height: `${h}px`, minHeight: '24px' }}
                                                    onClick={e => { e.stopPropagation(); setEditItem({ type: 'todo', item: todo }); }}>
                                                    <div className={cn('w-1 shrink-0', isDone ? 'bg-green-500' : pCfg)} />
                                                    <div className="flex-1 px-1.5 py-1 min-w-0 flex items-center gap-1">
                                                        {isDone && <Check className="w-3 h-3 text-green-400 shrink-0" />}
                                                        <div className="flex-1 min-w-0">
                                                            <p className={cn('text-[11px] font-semibold truncate leading-tight', isDone ? 'text-green-300 line-through' : 'text-blue-200')}>
                                                                {todo.planned_time} {todo.title}
                                                            </p>
                                                            {h > 36 && todo.category && (
                                                                <p className={cn('text-[10px] truncate', isDone ? 'text-green-300/50' : 'text-blue-300/70')}>{todo.category}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {dayAppts.map(appt => {
                                            const startMin = timeToMinutes(appt.start_time);
                                            if (startMin < hourStart * 60 || startMin >= hourEnd * 60) return null;
                                            const dur = appt.duration || 60;
                                            const top = minutesToPx(startMin, hourStart);
                                            const h   = Math.max(durationToPx(dur), 24);
                                            const col = APPOINTMENT_COLORS[appt.color] || APPOINTMENT_COLORS.blue;
                                            const isDraggingThis = draggedItem?.type === 'appointment' && draggedItem.item.id === appt.id;
                                            return (
                                                <div key={appt.id}
                                                    draggable={resizingId !== appt.id}
                                                    onDragStart={e => { e.stopPropagation(); handleDragStartAppointment(e, appt); }}
                                                    onDragEnd={handleDragEnd}
                                                    className={cn(
                                                        'absolute left-0.5 right-0.5 z-10 rounded-lg border cursor-grab active:cursor-grabbing transition-colors select-none',
                                                        col.bg, col.border, isDraggingThis && 'opacity-40',
                                                        resizingId === appt.id && 'ring-2 ring-amber-400'
                                                    )}
                                                    style={{ top: `${top}px`, height: `${resizingId === appt.id && resizePreview ? (resizePreview.duration / 60 * SLOT_H) : h}px`, minHeight: '24px', overflow: 'hidden' }}
                                                    onClick={e => { if (resizingId) return; e.stopPropagation(); setEditItem({ type: 'appointment', item: appt }); }}>
                                                    <div className="px-1.5 py-1 min-w-0">
                                                        <p className={cn('text-[11px] font-semibold truncate leading-tight', col.text)}>
                                                            {appt.start_time} {appt.title}
                                                            {resizingId === appt.id && resizePreview && (
                                                                <span className="ml-1 opacity-70 font-normal">
                                                                    {resizePreview.duration < 60 ? `${resizePreview.duration}min` : `${(resizePreview.duration/60).toFixed(1).replace('.0','')}h`}
                                                                </span>
                                                            )}
                                                        </p>
                                                        {h > 36 && appt.notes && (
                                                            <p className={cn('text-[10px] truncate', col.text, 'opacity-70')}>{appt.notes}</p>
                                                        )}
                                                    </div>
                                                    {/* Resize-Handle */}
                                                    <div
                                                        className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize touch-none group/rh"
                                                        onMouseDown={e => startResize(e, appt, e.currentTarget.closest('[data-col]') || e.currentTarget.parentElement.parentElement.parentElement)}
                                                        onTouchStart={e => startResize(e, appt, e.currentTarget.closest('[data-col]') || e.currentTarget.parentElement.parentElement.parentElement)}>
                                                        <div className={cn('w-6 h-0.5 rounded-full opacity-0 group-hover/rh:opacity-60 transition-opacity', col.text, 'bg-current')} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Desktop Backlog-Panel */}
                <div className="w-64 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
                    <div className="px-3 py-3 border-b border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Backlog · {backlogTodos.length} offen
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Drag → Zeitslot zum Einplanen</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                        {backlogTodos.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Check className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-xs">Alles eingeplant!</p>
                            </div>
                        ) : backlogTodos.map(todo => {
                            const stripe = PRIORITY_STRIPE[todo.priority] || PRIORITY_STRIPE.mittel;
                            const isDragging = draggedTodo?.id === todo.id;
                            return (
                                <div key={todo.id}
                                    draggable
                                    onDragStart={e => handleDragStart(e, todo)}
                                    onDragEnd={handleDragEnd}
                                    className={cn(
                                        'flex gap-2 p-2 rounded-xl border border-border bg-background hover:bg-accent/30 transition-colors cursor-grab active:cursor-grabbing select-none',
                                        isDragging && 'opacity-40 border-amber-500/50'
                                    )}>
                                    <div className={cn('w-1 rounded-full shrink-0', stripe)} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-foreground truncate">{todo.title}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {todo.category && (
                                                <span className="text-[10px] text-muted-foreground">{todo.category}</span>
                                            )}
                                            {todo.due_date && (
                                                <span className="text-[10px] text-amber-400">{todo.due_date}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Mobile Zeitbereich-Dialog ─────────────────────────────────── */}
            <Dialog open={timeConfigOpen} onOpenChange={setTimeConfigOpen}>
                <DialogContent className="max-w-xs">
                    <DialogHeader>
                        <DialogTitle className="text-sm flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            Zeitbereich einstellen
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-2">Startzeit</p>
                            <select value={hourStart} onChange={e => setHourStart(Number(e.target.value))}
                                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground">
                                {Array.from({ length: 24 }, (_, i) => i).map(h => (
                                    <option key={h} value={h}>{String(h).padStart(2,'0')}:00 Uhr</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-2">Endzeit</p>
                            <select value={hourEnd} onChange={e => setHourEnd(Number(e.target.value))}
                                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground">
                                {Array.from({ length: 18 }, (_, i) => i + 16).map(h => (
                                    <option key={h} value={h}>
                                        {h < 24 ? String(h).padStart(2,'0') : String(h-24).padStart(2,'0')}:00 Uhr
                                        {h >= 24 ? ' (nächster Tag)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Button onClick={() => setTimeConfigOpen(false)} className="w-full h-9 bg-amber-600 hover:bg-amber-700 text-white text-sm">
                            Übernehmen
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Slot-Popover: Neuer Eintrag ──────────────────────────────── */}
            {slotPopover && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                    onClick={() => setSlotPopover(null)}>
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-4 space-y-4"
                        onClick={e => e.stopPropagation()}>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-foreground text-sm">
                                    {format(slotPopover.date, 'EEEE, d. MMMM', { locale: de })}
                                </p>
                                <p className="text-xs text-muted-foreground">{newTime} Uhr</p>
                            </div>
                            <button onClick={() => setSlotPopover(null)}
                                className="text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modus-Toggle */}
                        <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl border border-border">
                            {[
                                { key: 'appointment', label: '📅 Neuer Termin' },
                                { key: 'todo-pick',   label: '✅ Todo einplanen' },
                            ].map(({ key, label }) => (
                                <button key={key} onClick={() => setNewMode(key)}
                                    className={cn(
                                        'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                        newMode === key
                                            ? 'bg-card text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Neuer Termin */}
                        {newMode === 'appointment' && (
                            <div className="space-y-3">
                                <Input autoFocus placeholder="Titel des Termins…"
                                    value={newTitle} onChange={e => setNewTitle(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateAppointment()}
                                    className="h-10" />
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <p className="text-[10px] text-muted-foreground mb-1">Startzeit</p>
                                        <input type="time" step="900" value={newTime}
                                            onChange={e => setNewTime(e.target.value)}
                                            className="w-full h-9 px-2 rounded-lg border border-border bg-background text-sm text-foreground" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] text-muted-foreground mb-1">Dauer</p>
                                        <select value={newDuration} onChange={e => setNewDuration(Number(e.target.value))}
                                            className="w-full h-9 px-2 rounded-lg border border-border bg-background text-sm text-foreground">
                                            {[15, 30, 45, 60, 75, 90, 105, 120, 150, 180].map(m => (
                                                <option key={m} value={m}>{m < 60 ? `${m} Min` : `${m / 60} Std`}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground mb-1.5">Farbe</p>
                                    <div className="flex gap-2">
                                        {Object.entries(APPOINTMENT_COLORS).map(([key, col]) => (
                                            <button key={key} onClick={() => setNewColor(key)}
                                                className={cn(
                                                    'w-7 h-7 rounded-full transition-all', col.dot,
                                                    newColor === key ? 'ring-2 ring-offset-2 ring-offset-card ring-white scale-110' : 'opacity-60 hover:opacity-100'
                                                )} />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground mb-1">Wiederholung</p>
                                    <select value={newRecurrence} onChange={e => setNewRecurrence(e.target.value)}
                                        className="w-full h-9 px-2 rounded-lg border border-border bg-background text-sm text-foreground">
                                        <option value="none">Einmalig</option>
                                        <option value="weekly">Wöchentlich (8×)</option>
                                        <option value="biweekly">Alle 2 Wochen (8×)</option>
                                    </select>
                                </div>
                                <Button onClick={handleCreateAppointment} disabled={!newTitle.trim()}
                                    className="w-full h-9 bg-amber-600 hover:bg-amber-700 text-white">
                                    {newRecurrence === 'none' ? 'Termin anlegen' : '8× Termine anlegen'}
                                </Button>
                            </div>
                        )}

                        {/* Todo einplanen */}
                        {newMode === 'todo-pick' && (
                            <div className="space-y-2 max-h-72 overflow-y-auto">
                                {backlogTodos.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-4">
                                        Keine offenen Todos im Backlog
                                    </p>
                                ) : backlogTodos.map(todo => {
                                    const stripe = PRIORITY_STRIPE[todo.priority] || PRIORITY_STRIPE.mittel;
                                    return (
                                        <button key={todo.id}
                                            onClick={() => handlePlanTodo(todo, slotPopover.date, newTime)}
                                            className="w-full flex gap-2 p-2.5 rounded-xl border border-border bg-background hover:bg-accent/50 transition-colors text-left">
                                            <div className={cn('w-1.5 rounded-full shrink-0', stripe)} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{todo.title}</p>
                                                {todo.category && (
                                                    <p className="text-xs text-muted-foreground">{todo.category}</p>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                                <div className="pt-2 border-t border-border">
                                    <p className="text-[10px] text-muted-foreground mb-1.5">Dauer</p>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {[30, 60, 90, 120].map(m => (
                                            <button key={m} onClick={() => setNewDuration(m)}
                                                className={cn(
                                                    'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                                                    newDuration === m
                                                        ? 'bg-amber-500 border-amber-500 text-white'
                                                        : 'border-border text-muted-foreground'
                                                )}>
                                                {m < 60 ? `${m}'` : `${m / 60}h`}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Edit-Dialog ───────────────────────────────────────────────── */}
            <Dialog open={!!editItem} onOpenChange={o => !o && setEditItem(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-base">
                            {editItem?.type === 'appointment' ? '📅 Termin' : '✅ Eingeplantes Todo'}
                        </DialogTitle>
                    </DialogHeader>
                    {editItem?.type === 'appointment' && (
                        <div className="space-y-3">
                            <Input
                                value={editItem.item.title}
                                onChange={e => setEditItem(prev => ({ ...prev, item: { ...prev.item, title: e.target.value } }))}
                                className="h-10" />
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <p className="text-[10px] text-muted-foreground mb-1">Startzeit</p>
                                    <input type="time" value={editItem.item.start_time}
                                        onChange={e => setEditItem(prev => ({ ...prev, item: { ...prev.item, start_time: e.target.value } }))}
                                        className="w-full h-9 px-2 rounded-lg border border-border bg-background text-sm text-foreground" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] text-muted-foreground mb-1">Dauer (Min)</p>
                                    <select value={editItem.item.duration}
                                        onChange={e => setEditItem(prev => ({ ...prev, item: { ...prev.item, duration: Number(e.target.value) } }))}
                                        className="w-full h-9 px-2 rounded-lg border border-border bg-background text-sm text-foreground">
                                        {[15, 30, 45, 60, 90, 120].map(m => (
                                            <option key={m} value={m}>{m < 60 ? `${m} Min` : `${m / 60} Std`}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground mb-1.5">Farbe</p>
                                <div className="flex gap-2">
                                    {Object.entries(APPOINTMENT_COLORS).map(([key, col]) => (
                                        <button key={key}
                                            onClick={() => setEditItem(prev => ({ ...prev, item: { ...prev.item, color: key } }))}
                                            className={cn('w-7 h-7 rounded-full transition-all', col.dot,
                                                (editItem?.item?.color || 'blue') === key ? 'ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110' : 'opacity-50 hover:opacity-100'
                                            )} />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground mb-1">Notiz (optional)</p>
                                <Input
                                    value={editItem?.item?.notes || ''}
                                    onChange={e => setEditItem(prev => ({ ...prev, item: { ...prev.item, notes: e.target.value } }))}
                                    placeholder="z.B. Raum 3, Ansprechpartner…"
                                    className="h-9 text-sm" />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => {
                                        updateAppointment.mutate({
                                            id: editItem.item.id,
                                            data: {
                                                title:      editItem.item.title,
                                                start_time: editItem.item.start_time,
                                                duration:   editItem.item.duration,
                                                end_time:   minutesToTime(timeToMinutes(editItem.item.start_time) + editItem.item.duration),
                                                color:      editItem.item.color || 'blue',
                                                notes:      editItem.item.notes || '',
                                            }
                                        });
                                        setEditItem(null);
                                    }}
                                    className="flex-1 h-9 bg-amber-600 hover:bg-amber-700 text-white text-sm">
                                    Speichern
                                </Button>
                                <Button variant="outline" size="sm"
                                    onClick={() => { deleteAppointment.mutate(editItem.item.id); setEditItem(null); }}
                                    className="h-9 text-red-400 border-red-500/30 hover:bg-red-500/10">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                    {editItem?.type === 'todo' && (
                        <div className="space-y-3">
                            <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                                <p className="font-semibold text-foreground text-sm">{editItem.item.title}</p>
                                {editItem.item.description && (
                                    <p className="text-xs text-muted-foreground mt-1">{editItem.item.description}</p>
                                )}
                                <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                                    {editItem.item.planned_time && (
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />{editItem.item.planned_time} Uhr
                                        </span>
                                    )}
                                    {editItem.item.category && (
                                        <Badge variant="outline" className="text-[10px] h-4">{editItem.item.category}</Badge>
                                    )}
                                </div>
                            </div>
                            {editItem.item.status === 'erledigt' ? (
                                <Button
                                    onClick={() => {
                                        updateTodo.mutate({ id: editItem.item.id, data: { status: 'offen' } });
                                        setEditItem(null);
                                    }}
                                    variant="outline"
                                    className="w-full h-9 text-sm text-green-400 border-green-500/40 hover:bg-green-500/10">
                                    <CheckSquare className="w-4 h-4 mr-1.5" /> Erledigt — rückgängig machen
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => {
                                        updateTodo.mutate({ id: editItem.item.id, data: { status: 'erledigt' } });
                                        setEditItem(null);
                                    }}
                                    className="w-full h-9 text-sm bg-green-600 hover:bg-green-700 text-white">
                                    <Check className="w-4 h-4 mr-1.5" /> Als erledigt markieren
                                </Button>
                            )}
                            <Button variant="outline"
                                onClick={() => { deleteTodoPlanning(editItem.item); setEditItem(null); }}
                                className="w-full h-9 text-sm text-muted-foreground hover:text-foreground">
                             <div>
                                 <p className="text-[10px] text-muted-foreground mb-1">Dauer im Kalender</p>
                                 <select
                                     value={editItem?.item?.planned_duration || 60}
                                     onChange={e => {
                                         const dur = Number(e.target.value);
                                         setEditItem(prev => ({ ...prev, item: { ...prev.item, planned_duration: dur } }));
                                         updateTodo.mutate({ id: editItem.item.id, data: { planned_duration: dur } });
                                     }}
                                     className="w-full h-9 px-2 rounded-lg border border-border bg-background text-sm text-foreground">
                                     {[15, 30, 45, 60, 90, 120, 180].map(m => (
                                         <option key={m} value={m}>{m < 60 ? `${m} Min` : `${m/60} Std`}</option>
                                     ))}
                                 </select>
                             </div>
                                Aus Wochenplan entfernen
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}