/**
 * BusinessCalendar.jsx — Betriebskalender & Sondertage
 * v2 — Chip-Grid für Tagesart, Inline-Label im Kalender, kein Tab-Wechsel,
 *      Monatsübersicht, Auto-Fill Feedback, Schnell-Löschen
 */

import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO, getDay } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    ChevronLeft, ChevronRight, Plus, Save,
    Palmtree, AlertTriangle, Clock, Info, Trash2, Wand2, Leaf,
    CalendarDays, X, CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/components/auth/usePermissions';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { getHolidaysBW, getHolidayName } from '@/components/shifts/getHolidays';
import { toast } from 'sonner';

// ── Konfiguration ──────────────────────────────────────────────────────────

export const DAY_TYPES = [
    { id: 'normal',                    label: 'Normaler Betrieb',     emoji: '✅', color: 'bg-secondary/80',   textColor: 'text-foreground/70',  dot: 'bg-muted-foreground',   short: ''          },
    { id: 'sonderoeffnung',            label: 'Sonderöffnung',        emoji: '⭐', color: 'bg-amber-600',      textColor: 'text-amber-300',      dot: 'bg-amber-400',          short: 'Sonder'    },
    { id: 'vorfeiertag',               label: 'Vorfeiertag',          emoji: '🌟', color: 'bg-orange-600',     textColor: 'text-orange-300',     dot: 'bg-orange-400',         short: 'Vor-FT'    },
    { id: 'feiertag',                  label: 'Feiertag',             emoji: '🎉', color: 'bg-red-600',        textColor: 'text-red-300',        dot: 'bg-red-400',            short: 'FT'        },
    { id: 'eventtag',                  label: 'Eventtag',             emoji: '🎵', color: 'bg-purple-600',     textColor: 'text-purple-300',     dot: 'bg-purple-400',         short: 'Event'     },
    { id: 'lange_nacht',               label: 'Lange Nacht',          emoji: '🌙', color: 'bg-indigo-600',     textColor: 'text-indigo-300',     dot: 'bg-indigo-400',         short: 'Nacht'     },
    { id: 'inventurtag',               label: 'Inventurtag',          emoji: '📦', color: 'bg-cyan-600',       textColor: 'text-cyan-300',       dot: 'bg-cyan-400',           short: 'Invent.'   },
    { id: 'geschlossen',               label: 'Geschlossen',          emoji: '🔒', color: 'bg-muted',         textColor: 'text-muted-foreground', dot: 'bg-muted-foreground', short: 'Geschl.'   },
    { id: 'geschlossen_mit_reinigung', label: 'Geschl. + Reinigung',  emoji: '🧹', color: 'bg-teal-700',       textColor: 'text-teal-300',       dot: 'bg-teal-400',           short: 'Reinig.'   },
    { id: 'saisonstart',               label: 'Saisonstart',          emoji: '🌿', color: 'bg-green-600',      textColor: 'text-green-300',      dot: 'bg-green-400',          short: 'Saison↑'   },
    { id: 'saisonende',                label: 'Saisonende',           emoji: '🍂', color: 'bg-yellow-700',     textColor: 'text-yellow-300',     dot: 'bg-yellow-400',         short: 'Saison↓'   },
    { id: 'betriebsferien',            label: 'Betriebsferien',       emoji: '🏖️', color: 'bg-pink-700',       textColor: 'text-pink-300',       dot: 'bg-pink-400',           short: 'Ferien'    },
    { id: 'wartungstag',               label: 'Wartungstag',          emoji: '🔧', color: 'bg-muted',         textColor: 'text-foreground/70',  dot: 'bg-muted-foreground',   short: 'Wartung'   },
];

export function getDayTypeConfig(id) {
    return DAY_TYPES.find(d => d.id === id) || DAY_TYPES[0];
}

// ── DayDrawer — kompakt mit Chip-Grid ─────────────────────────────────────

function DayDrawer({ day, existing, open, onClose, onSave, onDelete, canEdit, cleaningTasks = [] }) {
    const initialDate = day ? format(day, 'yyyy-MM-dd') : '';
    const [dateStr, setDateStr] = useState(initialDate);
    const [form, setForm] = useState({
        day_type: existing?.day_type || 'normal',
        title: existing?.title || '',
        description: existing?.description || '',
        opening_time_override: existing?.opening_time_override || '',
        closing_time_override: existing?.closing_time_override || '',
        notes: existing?.notes || '',
    });
    const [selectedTasks, setSelectedTasks] = useState([]);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        setDateStr(day ? format(day, 'yyyy-MM-dd') : '');
        setForm({
            day_type: existing?.day_type || 'normal',
            title: existing?.title || '',
            description: existing?.description || '',
            opening_time_override: existing?.opening_time_override || '',
            closing_time_override: existing?.closing_time_override || '',
            notes: existing?.notes || '',
        });
        setSelectedTasks([]);
        setConfirmDelete(false);
    }, [existing, day]);

    const cfg       = getDayTypeConfig(form.day_type);
    const isClosed  = ['geschlossen', 'geschlossen_mit_reinigung', 'betriebsferien'].includes(form.day_type);
    const isSaison  = ['saisonstart', 'saisonende'].includes(form.day_type);

    const terrassenTasks = cleaningTasks.filter(t =>
        t.area?.toLowerCase().includes('terrasse') || t.area?.toLowerCase().includes('außen')
    );

    const handleSave = () => {
        onSave({
            date: dateStr,
            ...form,
            is_closed: isClosed,
            is_special_opening: form.day_type === 'sonderoeffnung',
            is_pre_holiday: form.day_type === 'vorfeiertag',
            is_holiday: form.day_type === 'feiertag',
            is_event_day: form.day_type === 'eventtag',
            is_long_night: form.day_type === 'lange_nacht',
            is_inventory_day: form.day_type === 'inventurtag',
            is_cleaning_only_day: form.day_type === 'geschlossen_mit_reinigung',
            season_tasks: isSaison ? selectedTasks : [],
        });
    };

    if (!day) return null;

    return (
        <Drawer open={open} onOpenChange={onClose}>
            <DrawerContent className="bg-card border-border max-h-[90vh]">

                {/* Header — Datum + Schnell-Aktionen */}
                <div className={cn('px-4 pt-4 pb-3 border-b border-border flex items-center justify-between', cfg.color)}>
                    <div>
                        <p className="text-xs font-medium text-foreground/70">
                            {day ? format(day, "EEEE", { locale: de }) : ''}
                        </p>
                        <p className="text-lg font-bold text-foreground">
                            {day ? format(day, "d. MMMM yyyy", { locale: de }) : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {canEdit && existing && existing.day_type !== 'normal' && (
                            confirmDelete ? (
                                <button
                                    onClick={() => { onDelete(existing.id); setConfirmDelete(false); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Löschen?
                                </button>
                            ) : (
                                <button
                                    onClick={() => setConfirmDelete(true)}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-foreground/10 hover:bg-foreground/20 text-foreground"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )
                        )}
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-foreground/10 hover:bg-foreground/20 text-foreground">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto p-4 space-y-5 pb-8">

                    {/* Datum */}
                    {canEdit && (
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Datum</p>
                            <input
                                type="date"
                                value={dateStr}
                                onChange={e => setDateStr(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground text-sm"
                            />
                        </div>
                    )}

                    {!canEdit && existing && (
                        <div className={cn('px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2', cfg.color, 'text-foreground')}>
                            <Info className="w-4 h-4" />
                            {cfg.label}{existing.title && ` — ${existing.title}`}
                        </div>
                    )}

                    {canEdit && (
                        <>
                            {/* Tagesart — Chip-Grid */}
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tagesart</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {DAY_TYPES.map(dt => (
                                        <button
                                            key={dt.id}
                                            onClick={() => setForm(f => ({ ...f, day_type: dt.id }))}
                                            className={cn(
                                                'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left min-h-[44px]',
                                                form.day_type === dt.id
                                                    ? `${dt.color} text-white shadow-md scale-[1.02]`
                                                    : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60'
                                            )}
                                        >
                                            <span className="text-base leading-none">{dt.emoji}</span>
                                            <span className="text-xs leading-tight">{dt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Bezeichnung */}
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Bezeichnung <span className="font-normal normal-case">(optional)</span></p>
                                <input
                                    value={form.title}
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="z.B. Silvester-Party"
                                    className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground text-sm placeholder:text-muted-foreground"
                                />
                            </div>

                            {/* Sonderöffnungszeiten */}
                            {!isClosed && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Sonderöffnungszeiten <span className="font-normal normal-case">(optional)</span></p>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <label className="text-xs text-muted-foreground mb-1 block">Von</label>
                                            <input type="time" value={form.opening_time_override}
                                                onChange={e => setForm(f => ({ ...f, opening_time_override: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-sm" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-muted-foreground mb-1 block">Bis</label>
                                            <input type="time" value={form.closing_time_override}
                                                onChange={e => setForm(f => ({ ...f, closing_time_override: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-sm" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">Nachtbetrieb: Schließzeit z.B. 04:00</p>
                                </div>
                            )}

                            {/* Terrassen-Aufgaben */}
                            {isSaison && terrassenTasks.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                                        <Leaf className="w-3.5 h-3.5 text-green-400" />
                                        Terrassen-Aufgaben
                                    </p>
                                    <div className="space-y-1.5">
                                        {terrassenTasks.map(task => (
                                            <label key={task.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 cursor-pointer">
                                                <input type="checkbox" checked={selectedTasks.includes(task.id)}
                                                    onChange={e => setSelectedTasks(prev =>
                                                        e.target.checked ? [...prev, task.id] : prev.filter(id => id !== task.id)
                                                    )} className="rounded" />
                                                <div>
                                                    <p className="text-sm text-foreground">{task.title}</p>
                                                    <p className="text-xs text-muted-foreground">{task.area}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Notiz */}
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Interne Notiz <span className="font-normal normal-case">(optional)</span></p>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="Nur für Manager sichtbar…"
                                    rows={2}
                                    className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground text-sm placeholder:text-muted-foreground resize-none"
                                />
                            </div>

                            {/* Speichern */}
                            <Button onClick={handleSave}
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white min-h-[48px] font-semibold">
                                <Save className="w-4 h-4 mr-2" />
                                {existing ? 'Änderungen speichern' : 'Sondertag anlegen'}
                            </Button>
                        </>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    );
}

// ── Monatskalender ────────────────────────────────────────────────────────

function MonthCalendar({ currentMonth, specialDays, onDayClick, openingHours }) {
    const start  = startOfMonth(currentMonth);
    const end    = endOfMonth(currentMonth);
    const days   = eachDayOfInterval({ start, end });

    // Mo=0..So=6
    const rawOffset = getDay(start);
    const offset    = rawOffset === 0 ? 6 : rawOffset - 1;

    const holidays = getHolidaysBW ? [
        ...getHolidaysBW(currentMonth.getFullYear()),
        ...getHolidaysBW(currentMonth.getFullYear() + 1),
    ] : [];

    const getSpecialDay = (day) =>
        specialDays.find(d => d.date === format(day, 'yyyy-MM-dd'));

    const getHoliday = (day) => {
        const ds = format(day, 'yyyy-MM-dd');
        const h  = holidays.find(h => format(h.date, 'yyyy-MM-dd') === ds);
        return h?.name || null;
    };

    const DE_DAYS = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    const getOpeningHour = (day) => {
        if (!openingHours?.length) return null;
        return openingHours.find(o => o.day_of_week === DE_DAYS[getDay(day)]) || null;
    };

    return (
        <div>
            {/* Wochentag-Header */}
            <div className="grid grid-cols-7 mb-1">
                {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-1">{d}</div>
                ))}
            </div>

            {/* Tage */}
            <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: offset }).map((_, i) => <div key={`e-${i}`} />)}
                {days.map(day => {
                    const special       = getSpecialDay(day);
                    const holiday       = getHoliday(day);
                    const oh            = getOpeningHour(day);
                    const cfg           = special ? getDayTypeConfig(special.day_type) : null;
                    const today         = isToday(day);
                    const isRegularClosed = !special && oh?.is_closed;
                    const isHolidayDay  = !special && !!holiday;
                    const shortLabel    = special ? getDayTypeConfig(special.day_type).short : '';

                    return (
                        <button
                            key={day.toISOString()}
                            onClick={() => onDayClick(day, special)}
                            className={cn(
                                'relative flex flex-col items-center justify-start pt-1 pb-0.5 rounded-xl transition-all active:scale-95 min-h-[52px]',
                                today && !special && !isHolidayDay
                                    ? 'ring-2 ring-amber-500 bg-amber-500/10'
                                    : '',
                                special
                                    ? `${cfg.color} text-white`
                                    : isHolidayDay
                                        ? 'bg-red-500/15 text-red-300'
                                        : isRegularClosed
                                            ? 'bg-secondary/30 text-muted-foreground/60'
                                            : 'hover:bg-accent/50 text-foreground',
                            )}
                        >
                            <span className={cn('text-xs font-bold', today && !special ? 'text-amber-400' : '')}>
                                {format(day, 'd')}
                            </span>
                            {/* Inline-Label */}
                            {shortLabel && (
                                <span className="text-[8px] leading-tight text-foreground/80 px-0.5 text-center truncate w-full">
                                    {shortLabel}
                                </span>
                            )}
                            {/* Feiertag Emoji */}
                            {isHolidayDay && (
                                <span className="text-[10px]">🎉</span>
                            )}
                            {/* Regular closed dot */}
                            {isRegularClosed && !special && (
                                <div className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-0.5" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Monatsübersicht ────────────────────────────────────────────────────────

function MonthSummary({ specialDays, currentMonth }) {
    const monthStr = format(currentMonth, 'yyyy-MM');
    const thisMonth = specialDays.filter(d => d.date.startsWith(monthStr) && d.day_type !== 'normal');

    if (thisMonth.length === 0) return null;

    // Gruppieren
    const byType = thisMonth.reduce((acc, d) => {
        const cfg = getDayTypeConfig(d.day_type);
        if (!acc[d.day_type]) acc[d.day_type] = { cfg, days: [] };
        acc[d.day_type].days.push(d);
        return acc;
    }, {});

    return (
        <div className="mx-0 mt-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
                {format(currentMonth, 'MMMM', { locale: de })} — {thisMonth.length} Sondertag{thisMonth.length !== 1 ? 'e' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
                {Object.entries(byType).map(([type, { cfg, days }]) => (
                    <div key={type} className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white',
                        cfg.color
                    )}>
                        <span>{cfg.emoji}</span>
                        <span>{cfg.label}</span>
                        {days.length > 1 && <span className="bg-white/20 px-1 rounded-full">{days.length}×</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Kommende Sondertage (Scroll-Liste unter Kalender) ─────────────────────

function UpcomingList({ specialDays, onDayClick }) {
    const upcoming = [...specialDays]
        .filter(d => d.day_type !== 'normal' && d.date >= format(new Date(), 'yyyy-MM-dd'))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 8);

    if (upcoming.length === 0) return (
        <div className="text-center py-6 text-muted-foreground text-sm">
            Keine kommenden Sondertage eingetragen
        </div>
    );

    return (
        <div className="space-y-2">
            {upcoming.map(d => {
                const cfg  = getDayTypeConfig(d.day_type);
                const date = parseISO(d.date);
                const daysUntil = Math.round((date - new Date()) / 86400000);
                return (
                    <button key={d.id} onClick={() => onDayClick(date, d)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-amber-500/40 transition-all text-left active:scale-[0.98]">
                        <div className={cn('w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0', cfg.color)}>
                            <span className="text-foreground font-bold text-sm leading-none">{format(date, 'd')}</span>
                            <span className="text-foreground/70 text-[9px]">{format(date, 'MMM', { locale: de })}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <span className="text-base">{cfg.emoji}</span>
                                <span className="text-xs font-semibold text-foreground">{cfg.label}</span>
                            </div>
                            <p className="text-sm text-foreground truncate">
                                {d.title || format(date, "EEEE, d. MMMM", { locale: de })}
                            </p>
                            {d.opening_time_override && (
                                <p className="text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3 inline mr-0.5" />
                                    {d.opening_time_override}{d.closing_time_override ? ` – ${d.closing_time_override}` : ''}
                                </p>
                            )}
                        </div>
                        <div className="text-right shrink-0">
                            <span className={cn(
                                'text-xs font-semibold',
                                daysUntil === 0 ? 'text-amber-400' : daysUntil <= 3 ? 'text-orange-400' : 'text-muted-foreground'
                            )}>
                                {daysUntil === 0 ? 'Heute' : daysUntil === 1 ? 'Morgen' : `in ${daysUntil}d`}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

// ── Feiertage ─────────────────────────────────────────────────────────────

function HolidayList() {
    const today    = format(new Date(), 'yyyy-MM-dd');
    const year     = new Date().getFullYear();
    const holidays = [
        ...getHolidaysBW(year),
        ...getHolidaysBW(year + 1),
    ].filter(h => format(h.date, 'yyyy-MM-dd') >= today).slice(0, 6);

    return (
        <div className="space-y-1.5">
            {holidays.map((h, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-red-500/8 border border-red-500/15">
                    <div className="w-9 h-9 rounded-xl bg-red-500/20 flex flex-col items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-red-300 leading-none">{format(h.date, 'd')}</span>
                        <span className="text-[9px] text-red-300/70">{format(h.date, 'MMM', { locale: de })}</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground">{h.name}</p>
                        <p className="text-xs text-muted-foreground">{format(h.date, "EEEE, d. MMMM yyyy", { locale: de })}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── MAIN ──────────────────────────────────────────────────────────────────

export default function BusinessCalendar() {
    const permissions  = usePermissions();
    const queryClient  = useQueryClient();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDay, setSelectedDay]   = useState(null);
    const [selectedExisting, setSelectedExisting] = useState(null);
    const [drawerOpen, setDrawerOpen]     = useState(false);
    const [autoFilling, setAutoFilling]   = useState(false);

    const canEdit = permissions.isManager || permissions.isAdmin;

    const { data: specialDays = [] } = useQuery({
        queryKey: ['business-calendar'],
        queryFn: () => base44.entities.BusinessCalendarDay.list('-date', 500),
    });

    const { data: openingHours = [] } = useQuery({
        queryKey: ['opening-hours'],
        queryFn: () => base44.entities.OpeningHours.list(),
        enabled: canEdit,
    });

    const { data: cleaningTasks = [] } = useQuery({
        queryKey: ['cleaning-tasks-all'],
        queryFn: () => base44.entities.CleaningTask.list(),
        enabled: canEdit,
    });

    const DE_DAYS = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const existing = specialDays.find(d => d.date === data.date);
            if (existing) return base44.entities.BusinessCalendarDay.update(existing.id, data);
            return base44.entities.BusinessCalendarDay.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['business-calendar'] });
            setDrawerOpen(false);
            toast.success('Gespeichert');
        },
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.BusinessCalendarDay.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['business-calendar'] });
            setDrawerOpen(false);
            toast.success('Sondertag entfernt');
        },
        onError: () => toast.error('Fehler beim Löschen'),
    });

    const handleDayClick = (day, existing) => {
        setSelectedDay(day);
        setSelectedExisting(existing || null);
        setDrawerOpen(true);
    };

    const handleAutoFill = async () => {
        if (openingHours.length === 0) {
            toast.error('Keine Standardöffnungszeiten hinterlegt. Bitte zuerst in Einstellungen eintragen.');
            return;
        }
        setAutoFilling(true);
        const monthDays      = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
        const existingDates  = new Set(specialDays.map(d => d.date));
        let created = 0;

        for (const day of monthDays) {
            const dateStr    = format(day, 'yyyy-MM-dd');
            if (existingDates.has(dateStr)) continue;
            const weekdayName = DE_DAYS[getDay(day)];
            const oh          = openingHours.find(o => o.day_of_week === weekdayName);
            if (oh?.is_closed) {
                await base44.entities.BusinessCalendarDay.create({
                    date: dateStr,
                    day_type: 'geschlossen',
                    title: `Regulär geschlossen (${weekdayName})`,
                    is_closed: true,
                });
                created++;
            }
        }
        queryClient.invalidateQueries({ queryKey: ['business-calendar'] });
        setAutoFilling(false);
        toast.success(created > 0 ? `${created} Tage automatisch befüllt` : 'Keine neuen Einträge — alles bereits vorhanden');
    };

    // Stats für diesen Monat
    const monthStr   = format(currentMonth, 'yyyy-MM');
    const thisMonth  = specialDays.filter(d => d.date.startsWith(monthStr));
    const closedCount  = thisMonth.filter(d => ['geschlossen','geschlossen_mit_reinigung','betriebsferien'].includes(d.day_type)).length;
    const specialCount = thisMonth.filter(d => !['geschlossen','geschlossen_mit_reinigung','betriebsferien','normal'].includes(d.day_type)).length;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">

                {/* ── Header ──────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                            <CalendarDays className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-foreground">Betriebskalender</h1>
                            <p className="text-xs text-muted-foreground">Sondertage & Öffnungszeiten</p>
                        </div>
                    </div>
                    {canEdit && (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleAutoFill} disabled={autoFilling}
                                className="h-9 gap-1.5 text-xs">
                                <Wand2 className="w-3.5 h-3.5" />
                                {autoFilling ? 'Läuft…' : 'Auto-Fill'}
                            </Button>
                            <Button size="sm" onClick={() => handleDayClick(new Date(), null)}
                                className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                                <Plus className="w-4 h-4" />
                                <span className="hidden sm:inline">Sondertag</span>
                            </Button>
                        </div>
                    )}
                </div>

                {/* ── Kalender Card ────────────────────────────────────── */}
                <div className="bg-card border border-border rounded-2xl p-4">
                    {/* Monat Navigation */}
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-accent/50 transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="text-center">
                            <h2 className="text-base font-bold text-foreground">
                                {format(currentMonth, 'MMMM yyyy', { locale: de })}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                {specialCount > 0 && `${specialCount} Event${specialCount > 1 ? 's' : ''}`}
                                {specialCount > 0 && closedCount > 0 && ' · '}
                                {closedCount > 0 && `${closedCount}× geschlossen`}
                            </p>
                        </div>
                        <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-accent/50 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    <MonthCalendar
                        currentMonth={currentMonth}
                        specialDays={specialDays}
                        onDayClick={handleDayClick}
                        openingHours={openingHours}
                    />

                    {/* Monats-Zusammenfassung direkt unter Kalender */}
                    <MonthSummary specialDays={specialDays} currentMonth={currentMonth} />
                </div>

                {/* ── Kommende Sondertage ──────────────────────────────── */}
                <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Nächste Sondertage
                    </p>
                    <UpcomingList specialDays={specialDays} onDayClick={handleDayClick} />
                </div>

                {/* ── Feiertage BW ─────────────────────────────────────── */}
                <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Nächste Feiertage (BW)
                    </p>
                    <HolidayList />
                </div>

                {/* ── Legende kompakt ──────────────────────────────────── */}
                <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Legende</p>
                    <div className="grid grid-cols-2 gap-1">
                        {DAY_TYPES.filter(d => d.id !== 'normal').map(dt => (
                            <div key={dt.id} className="flex items-center gap-2">
                                <span className="text-sm">{dt.emoji}</span>
                                <span className="text-xs text-muted-foreground">{dt.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Info ─────────────────────────────────────────────── */}
                <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/8 border border-blue-500/15">
                    <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300">
                        Zeiterfassung ist unabhängig vom Betriebskalender — Mitarbeiter können immer stempeln, auch an geschlossenen Tagen.
                    </p>
                </div>

            </div>

            {/* ── Drawer ───────────────────────────────────────────────── */}
            <DayDrawer
                day={selectedDay}
                existing={selectedExisting}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onSave={(data) => saveMutation.mutate(data)}
                onDelete={(id) => deleteMutation.mutate(id)}
                canEdit={canEdit}
                cleaningTasks={cleaningTasks}
            />
        </div>
    );
}