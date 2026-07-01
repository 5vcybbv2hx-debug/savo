import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    format, startOfMonth, endOfMonth, parseISO,
    startOfWeek, endOfWeek, differenceInMinutes
} from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Clock, Plus, Pencil, Trash2, Calendar, CheckCircle2,
    FileText, Check, TrendingUp, LogIn, LogOut, Coffee,
    Pause, Play, Filter, X, Clock3, Euro, ChevronLeft,
    ChevronRight, AlertTriangle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePermissions } from '@/components/auth/usePermissions';
import { toast } from 'sonner';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { createNotification } from '@/utils/createNotification';
import TimeEntryModal from '@/components/timetracking/TimeEntryModal';
import MonthlyReportExport from '@/components/timetracking/MonthlyReportExport';
import PayrollReportSender from '@/components/reports/PayrollReportSender';
import { validateArbZG, formatWarnings } from '@/components/timetracking/ArbZGValidator';

const statusConfig = {
    'entwurf':     { label: 'Entwurf',     color: 'bg-slate-500/15 text-muted-foreground/50 dark:text-muted-foreground', icon: FileText },
    'eingereicht': { label: 'Eingereicht', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',                     icon: Clock },
    'ausstehend':  { label: 'Ausstehend',  color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',                  icon: Clock },
    'genehmigt':   { label: 'Genehmigt',   color: 'bg-green-500/15 text-green-600 dark:text-green-400',                  icon: CheckCircle2 },
};

/**
 * Berechnet die gesamte Pausenzeit in Minuten aus einem breaks-Array.
 * Laufende Pausen (end === null) werden bis zur aktuellen Zeit berechnet.
 */
function calcTotalBreakMinutes(breaks) {
    if (!Array.isArray(breaks) || breaks.length === 0) return 0;
    const now = new Date();
    return breaks.reduce((sum, b) => {
        if (!b?.start) return sum;
        const start = new Date(b.start);
        const end = b.end ? new Date(b.end) : now;
        return sum + Math.max(0, differenceInMinutes(end, start));
    }, 0);
}

export default function TimeTracking() {
    const queryClient = useQueryClient();
    const permissions = usePermissions();
    const { data: currentEmployee, isLoading: isLoadingEmployee } = useCurrentEmployee();

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [shiftSummary, setShiftSummary] = useState(null);
    // Bestätigungs-Dialog statt confirm()
    const [clockOutAllDialog, setClockOutAllDialog] = useState(false);

    // ── Queries ────────────────────────────────────────────────────────────────
    const { data: timeEntries = [] } = useQuery({
        queryKey: ['time-entries', format(selectedMonth, 'yyyy-MM'), currentEmployee?.id, permissions.isManager],
        queryFn: async () => {
            const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
            const end   = format(endOfMonth(selectedMonth),   'yyyy-MM-dd');
            if (permissions.isManager) {
                // ⚠️ Limit erhoeht: bei >500 TimeEntries im System fielen aeltere
                // Monate (z.B. Januar) aus dem Top-500-Fenster und wurden nicht
                // angezeigt. 3000 gibt komfortablen Puffer fuer mehrere Jahre.
                const all = await base44.entities.TimeEntry.list('-date', 3000);
                return all.filter(e => e.date >= start && e.date <= end);
            } else {
                if (!currentEmployee?.id) return [];
                const all = await base44.entities.TimeEntry.filter({ employee_id: currentEmployee.id }, '-date', 3000);
                return all.filter(e => e.date >= start && e.date <= end);
            }
        },
        enabled: !isLoadingEmployee && (permissions.isManager || !!currentEmployee?.id),
        staleTime: 2 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const { data: allEmployees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const { data: clockEntries = [] } = useQuery({
        queryKey: ['clockEntries', currentEmployee?.id, permissions.isManager, format(selectedMonth, 'yyyy-MM')],
        queryFn: async () => {
            const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
            const end   = format(endOfMonth(selectedMonth),   'yyyy-MM-dd');
            const all = permissions.isManager
                ? await base44.entities.ClockEntry.list('-clock_in', 500)
                : await base44.entities.ClockEntry.filter({ employee_id: currentEmployee.id }, '-clock_in', 300);
            const monthlyFiltered = all.filter(e => {
                if (!e.clock_in) return false;
                const d = format(new Date(e.clock_in), 'yyyy-MM-dd');
                return d >= start && d <= end;
            });
            const active = all.filter(e => e.status === 'clocked_in' || e.status === 'on_break');
            const seen = new Set(monthlyFiltered.map(e => e.id));
            const extras = active.filter(e => !seen.has(e.id));
            return [...extras, ...monthlyFiltered];
        },
        enabled: !isLoadingEmployee && (permissions.isManager || !!currentEmployee?.id),
        refetchInterval: 60000,
        refetchOnWindowFocus: false,
        staleTime: 30000,
    });

    const invalidateTimeEntries = () =>
        queryClient.invalidateQueries({ queryKey: ['time-entries'], exact: false });

    // ── Mutations ──────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: async (data) => {
            const warnings = validateArbZG(data, timeEntries);
            if (warnings.length > 0) data.arbzg_warning = formatWarnings(warnings);
            await base44.entities.TimeEntry.create(data);
            if (data.status === 'eingereicht' && !permissions.isManager) {
                await createNotification({
                    type: 'general',
                    title: 'Neue Zeiterfassung eingereicht',
                    message: `${data.employee_name} hat eine Zeiterfassung für ${format(new Date(data.date), 'dd.MM.yyyy', { locale: de })} eingereicht (${data.total_hours}h).`,
                    relatedId: data.employee_id,
                });
            }
        },
        onSuccess: () => { invalidateTimeEntries(); setModalOpen(false); setSelectedEntry(null); toast.success('Zeiteintrag erstellt'); },
        onError: (err) => toast.error('Fehler beim Erstellen: ' + err.message),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.TimeEntry.update(id, data),
        onSuccess: () => { invalidateTimeEntries(); setModalOpen(false); setSelectedEntry(null); toast.success('Zeiteintrag gespeichert'); },
        onError: (err) => toast.error('Fehler beim Speichern: ' + err.message),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.TimeEntry.delete(id),
        onSuccess: () => invalidateTimeEntries(),
    });

    const approveMutation = useMutation({
        mutationFn: async (entryIds) => {
            const user = queryClient.getQueryData(['user']) || await base44.auth.me();
            if (!user?.full_name) throw new Error('Benutzer nicht gefunden');
            return Promise.all(entryIds.map(async (id) => {
                const entry = timeEntries.find(e => e.id === id);
                await base44.entities.TimeEntry.update(id, {
                    status: 'genehmigt',
                    manager_approved_by: user.full_name,
                    manager_approved_at: new Date().toISOString(),
                });
                if (entry) {
                    try {
                        await createNotification({
                            type: 'general',
                            category: 'system',
                            title: 'Zeiterfassung genehmigt',
                            message: `Deine Zeiterfassung vom ${format(new Date(entry.date), 'dd.MM.yyyy', { locale: de })} wurde genehmigt (${entry.total_hours}h).`,
                            relatedId: entry.id,
                            targetRoles: [],
                        });
                    } catch (_) { /* Benachrichtigung nicht blockierend */ }
                }
            }));
        },
        onSuccess: () => { invalidateTimeEntries(); toast.success('Zeiterfassung genehmigt'); },
        onError: (err) => toast.error('Genehmigung fehlgeschlagen: ' + (err.message || err)),
    });

    const confirmEntryMutation = useMutation({
        mutationFn: async (entryId) => base44.entities.TimeEntry.update(entryId, {
            employee_confirmed: true,
            employee_confirmed_at: new Date().toISOString(),
        }),
        onSuccess: () => invalidateTimeEntries(),
    });

    const clockInMutation = useMutation({
        mutationFn: async (employeeId) => {
            const alreadyActive = clockEntries.find(
                e => e.employee_id === employeeId && (e.status === 'clocked_in' || e.status === 'on_break')
            );
            if (alreadyActive) return alreadyActive;
            const employee = allEmployees.find(e => e.id === employeeId);
            return base44.entities.ClockEntry.create({
                employee_id: employeeId,
                employee_name: employee.name,
                clock_in: new Date().toISOString(),
                status: 'clocked_in',
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clockEntries'] }),
    });

    const calcLegalBreak = (workMinutes) => {
        const h = workMinutes / 60;
        if (h > 9) return 45;
        if (h > 6) return 30;
        return 0;
    };

    const clockOutMutation = useMutation({
        mutationFn: async (entryId) => {
            const entry = clockEntries.find(e => e.id === entryId);
            if (!entry) return;
            const clockOutTime = new Date();
            const totalMinutes = differenceInMinutes(clockOutTime, new Date(entry.clock_in));
            const actualBreakMinutes = calcTotalBreakMinutes(entry.breaks);
            const breakMinutes = Math.max(actualBreakMinutes, calcLegalBreak(totalMinutes));
            const workedMinutes = totalMinutes - breakMinutes;
            const workedHours = (workedMinutes / 60).toFixed(2);
            const hourlyRate = currentEmployee?.hourly_rate;
            const earned = hourlyRate ? (workedHours * hourlyRate).toFixed(2) : null;
            const tempEntry = {
                date: format(new Date(entry.clock_in), 'yyyy-MM-dd'),
                start_time: format(new Date(entry.clock_in), 'HH:mm'),
                end_time: format(clockOutTime, 'HH:mm'),
                break_minutes: breakMinutes,
                total_hours: workedHours,
                employee_id: entry.employee_id,
            };
            const warnings = validateArbZG(tempEntry, timeEntries);
            await base44.entities.ClockEntry.update(entryId, {
                clock_out: clockOutTime.toISOString(),
                status: 'clocked_out',
                total_minutes: workedMinutes,
                break_minutes: breakMinutes,
                breaks: entry.breaks,
            });
            const employee = allEmployees.find(e => e.id === entry.employee_id);
            await base44.entities.TimeEntry.create({
                employee_id: entry.employee_id,
                employee_name: employee?.name || entry.employee_name,
                date: tempEntry.date,
                start_time: tempEntry.start_time,
                end_time: tempEntry.end_time,
                break_minutes: breakMinutes,
                total_hours: parseFloat(workedHours),
                status: 'eingereicht',
                arbzg_warning: formatWarnings(warnings) || undefined,
            });
            // Pausen-Details für das Summary aufbereiten
            const breakDetails = (entry.breaks || []).map(b => ({
                start: format(new Date(b.start), 'HH:mm'),
                end: b.end ? format(new Date(b.end), 'HH:mm') : null,
                minutes: b.end
                    ? differenceInMinutes(new Date(b.end), new Date(b.start))
                    : differenceInMinutes(clockOutTime, new Date(b.start)),
            }));
            setShiftSummary({
                workedHours, workedMinutes, breakMinutes, earned, hourlyRate,
                clockIn: format(new Date(entry.clock_in), 'HH:mm'),
                clockOut: format(clockOutTime, 'HH:mm'),
                arbzgWarning: formatWarnings(warnings),
                actualBreakMinutes,
                breakDetails,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clockEntries'] });
            invalidateTimeEntries();
        },
    });

    const clockOutAllMutation = useMutation({
        mutationFn: async () => {
            const activeClockedIn = clockEntries.filter(e => e.status === 'clocked_in');
            const clockOutTime = new Date();
            return Promise.all(activeClockedIn.map(async (entry) => {
                const totalMinutes = differenceInMinutes(clockOutTime, new Date(entry.clock_in));
                const actualBreakMinutes = calcTotalBreakMinutes(entry.breaks);
                const breakMinutes = Math.max(actualBreakMinutes, calcLegalBreak(totalMinutes));
                const workedMinutes = totalMinutes - breakMinutes;
                const workedHours = (workedMinutes / 60).toFixed(2);
                await base44.entities.ClockEntry.update(entry.id, {
                    clock_out: clockOutTime.toISOString(),
                    status: 'clocked_out',
                    total_minutes: workedMinutes,
                    break_minutes: breakMinutes,
                    breaks: entry.breaks,
                });
                const employee = allEmployees.find(e => e.id === entry.employee_id);
                await base44.entities.TimeEntry.create({
                    employee_id: entry.employee_id,
                    employee_name: employee?.name || entry.employee_name,
                    date: format(new Date(entry.clock_in), 'yyyy-MM-dd'),
                    start_time: format(new Date(entry.clock_in), 'HH:mm'),
                    end_time: format(clockOutTime, 'HH:mm'),
                    break_minutes: breakMinutes,
                    total_hours: parseFloat(workedHours),
                    status: 'eingereicht',
                });
            }));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clockEntries'] });
            invalidateTimeEntries();
            setClockOutAllDialog(false);
            toast.success('Alle Mitarbeiter ausgestempelt');
        },
    });

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleSave = (data, id) => {
        if (id) updateMutation.mutate({ id, data });
        else createMutation.mutate(data);
    };

    const handleDelete = async (id) => {
        const entry = timeEntries.find(e => e.id === id);
        if (entry) {
            const matching = clockEntries.filter(ce =>
                ce.employee_id === entry.employee_id &&
                ce.clock_in &&
                format(new Date(ce.clock_in), 'yyyy-MM-dd') === entry.date &&
                format(new Date(ce.clock_in), 'HH:mm') === entry.start_time
            );
            for (const ce of matching) await base44.entities.ClockEntry.delete(ce.id);
            queryClient.invalidateQueries({ queryKey: ['clockEntries'] });
        }
        deleteMutation.mutate(id);
    };

    const handleApprove      = (id) => approveMutation.mutate([id]);
    const handleApproveEmployee = (name) => {
        const ids = entriesByEmployee[name]
            ?.filter(e => (e.status === 'eingereicht' || e.employee_confirmed) && e.status !== 'genehmigt')
            .map(e => e.id) || [];
        if (ids.length) approveMutation.mutate(ids);
    };

    const canEdit = (entry) => {
        if (permissions.isManager) return true;
        return entry.employee_id === currentEmployee?.id && entry.status !== 'genehmigt';
    };

    const handleClockIn = () => {
        if (!currentEmployee || activeClockEntry || clockInMutation.isPending) return;
        clockInMutation.mutate(currentEmployee.id);
    };

    const handleClockOut = (entry) => {
        if (clockOutMutation.isPending) return;
        clockOutMutation.mutate(entry.id);
    };

    const handleStartBreak = async () => {
        if (!activeClockEntry) return;
        const currentBreaks = activeClockEntry.breaks || [];
        await base44.entities.ClockEntry.update(activeClockEntry.id, {
            status: 'on_break',
            breaks: [...currentBreaks, { start: new Date().toISOString(), end: null }],
        });
        queryClient.invalidateQueries({ queryKey: ['clockEntries'] });
    };

    const handleEndBreak = async () => {
        if (!activeClockEntry) return;
        const updatedBreaks = (activeClockEntry.breaks || []).map((b, i, arr) =>
            i === arr.length - 1 && !b.end ? { ...b, end: new Date().toISOString() } : b
        );
        await base44.entities.ClockEntry.update(activeClockEntry.id, {
            status: 'clocked_in',
            breaks: updatedBreaks,
        });
        queryClient.invalidateQueries({ queryKey: ['clockEntries'] });
    };

    const getWorkingDuration = (clockIn) => {
        const minutes = differenceInMinutes(new Date(), new Date(clockIn));
        return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    };

    // ── Derived State ──────────────────────────────────────────────────────────
    const activeClockEntry = (() => {
        const e = clockEntries.find(
            e => e.employee_id === currentEmployee?.id && (e.status === 'clocked_in' || e.status === 'on_break')
        );
        if (!e) return undefined;
        return { ...e, breaks: Array.isArray(e.breaks) ? e.breaks : [] };
    })();
    const activeClockEntries = clockEntries.filter(e => !e.clock_out);

    const visibleEntries = permissions.isManager
        ? timeEntries
        : timeEntries.filter(e => e.employee_id === currentEmployee?.id);

    const totalHours    = visibleEntries.reduce((s, e) => s + (e.total_hours || 0), 0);
    const approvedHours = visibleEntries.filter(e => e.status === 'genehmigt').reduce((s, e) => s + (e.total_hours || 0), 0);

    const now       = new Date();
    const todayStr  = format(now, 'yyyy-MM-dd');
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd   = endOfWeek(now,   { weekStartsOn: 1 });

    const myEntries      = timeEntries.filter(e => e.employee_id === currentEmployee?.id);
    const myMonthHours   = myEntries.reduce((s, e) => s + (e.total_hours || 0), 0);
    const myApprovedHours = myEntries.filter(e => e.status === 'genehmigt').reduce((s, e) => s + (e.total_hours || 0), 0);

    const todayHours = visibleEntries.filter(e => e.date === todayStr).reduce((s, e) => s + (e.total_hours || 0), 0);
    const weekHours  = visibleEntries.filter(e => { const d = parseISO(e.date); return d >= weekStart && d <= weekEnd; }).reduce((s, e) => s + (e.total_hours || 0), 0);

    const filteredEntries = visibleEntries.filter(e => {
        const matchEmployee = !filterEmployee || e.employee_name === filterEmployee;
        const matchStatus   = !filterStatus   || e.status === filterStatus;
        const matchDate     = !filterDate     || e.date === filterDate;
        return matchEmployee && matchStatus && matchDate;
    });

    const entriesByEmployee = filteredEntries.reduce((groups, entry) => {
        if (!groups[entry.employee_name]) groups[entry.employee_name] = [];
        groups[entry.employee_name].push(entry);
        return groups;
    }, {});

    const employeeNames = [...new Set(visibleEntries.map(e => e.employee_name))].sort();

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background animate-page-enter">
            <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">

                {/* ── STEMPELUHR HERO ──────────────────────────────────────── */}
                {isLoadingEmployee && (
                    <Card className="p-6 bg-card border-border mb-6 flex items-center gap-3 text-muted-foreground">
                        <div className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Lade Mitarbeiterdaten...</span>
                    </Card>
                )}

                {!isLoadingEmployee && !currentEmployee && !permissions.isManager && (
                    <Card className="p-4 bg-amber-500/10 border-amber-500/30 mb-6">
                        <p className="text-sm text-amber-500">⚠️ Kein Mitarbeiterprofil gefunden. Bitte wende dich an einen Manager.</p>
                    </Card>
                )}

                {currentEmployee && (
                    <Card className="mb-6 overflow-hidden border-border bg-card">
                        {/* Name + Status */}
                        <div className="px-5 pt-5 pb-4 flex items-center gap-4">
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                                style={{ backgroundColor: currentEmployee.color || '#64748b' }}
                            >
                                {currentEmployee.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-foreground text-base leading-tight truncate">{currentEmployee.name}</p>
                                <p className="text-xs text-muted-foreground">{currentEmployee.role}</p>
                                {activeClockEntry && (
                                    <p className="text-xs text-emerald-500 mt-0.5 font-medium">
                                        Seit {format(new Date(activeClockEntry.clock_in), 'HH:mm')} · {getWorkingDuration(activeClockEntry.clock_in)}
                                        {activeClockEntry.status === 'on_break' && <span className="ml-2 text-amber-500">· Pause</span>}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Großer Aktions-Button */}
                        <div className="px-5 pb-5">
                            {!activeClockEntry ? (
                                <button
                                    onClick={handleClockIn}
                                    disabled={clockInMutation.isPending}
                                    className="w-full h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-white font-bold text-lg shadow-lg shadow-emerald-900/30 disabled:opacity-60"
                                >
                                    <LogIn className="w-6 h-6" />
                                    {clockInMutation.isPending ? 'Wird gespeichert...' : 'Einstempeln'}
                                </button>
                            ) : activeClockEntry.status === 'clocked_in' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={handleStartBreak}
                                        className="h-14 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-white font-bold"
                                    >
                                        <Pause className="w-5 h-5" />
                                        Pause
                                    </button>
                                    <button
                                        onClick={() => handleClockOut(activeClockEntry)}
                                        disabled={clockOutMutation.isPending}
                                        className="h-14 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-white font-bold disabled:opacity-60"
                                    >
                                        <LogOut className="w-5 h-5" />
                                        {clockOutMutation.isPending ? '...' : 'Ausstempeln'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Pause läuft Banner */}
                                    {(() => {
                                        const openBreak = (activeClockEntry.breaks || []).find(b => b && b.start && !b.end);
                                        const breakStart = openBreak ? format(new Date(openBreak.start), 'HH:mm') : '--:--';
                                        return (
                                            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                                                <Coffee className="w-4 h-4 shrink-0" />
                                                <span className="text-sm font-medium">Pause läuft — seit {breakStart} Uhr</span>
                                            </div>
                                        );
                                    })()}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={handleEndBreak}
                                            className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-white font-bold"
                                        >
                                            <Play className="w-5 h-5" />
                                            Pause beenden
                                        </button>
                                        <button
                                            disabled
                                            className="h-14 rounded-2xl bg-red-600/40 text-white/50 font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                                        >
                                            <LogOut className="w-5 h-5" />
                                            Ausstempeln
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Pause-Verlauf */}
                            {(activeClockEntry.breaks || []).length > 0 && (
                                <div className="mt-3 p-3 rounded-lg bg-muted/40 space-y-1">
                                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                        <Coffee className="w-3 h-3" />
                                        Pausen heute:
                                    </p>
                                    {(activeClockEntry.breaks || []).filter(b => b && b.start).map((b, i) => {
                                        const startStr = b.start ? format(new Date(b.start), 'HH:mm') : '--:--';
                                        const endStr = b.end ? format(new Date(b.end), 'HH:mm') : 'laufend…';
                                        const mins = b.end && b.start
                                            ? differenceInMinutes(new Date(b.end), new Date(b.start))
                                            : b.start ? differenceInMinutes(new Date(), new Date(b.start)) : 0;
                                        return (
                                            <div key={i} className="text-xs text-muted-foreground flex justify-between">
                                                <span>{startStr} – {endStr} Uhr</span>
                                                <span className="font-medium">{mins} Min</span>
                                            </div>
                                        );
                                    })}
                                    <div className="border-t border-border/50 pt-1 mt-1 text-xs text-muted-foreground flex justify-between font-semibold">
                                        <span>Gesamt:</span>
                                        <span>{calcTotalBreakMinutes(activeClockEntry.breaks)} Min bisher</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                {/* Aktive Stempelungen (Manager-Übersicht) */}
                {activeClockEntries.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Aktive Stempelungen ({activeClockEntries.length})
                            </h3>
                            {permissions.isManager && clockEntries.some(e => e.status === 'clocked_in') && (
                                <Button
                                    onClick={() => setClockOutAllDialog(true)}
                                    size="sm"
                                    variant="outline"
                                    className="border-destructive/50 text-destructive hover:bg-destructive/10 text-xs"
                                >
                                    <LogOut className="w-3 h-3 mr-1" />
                                    Alle ausstempeln
                                </Button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {activeClockEntries.map(entry => (
                                <Card key={entry.id} className="p-3 bg-card border-border flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-sm text-foreground truncate">{entry.employee_name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            seit {format(new Date(entry.clock_in), 'HH:mm')} · {getWorkingDuration(entry.clock_in)}
                                        </p>
                                    </div>
                                    <Badge className={entry.status === 'on_break' ? 'bg-amber-500/15 text-amber-500 text-xs' : 'bg-emerald-500/15 text-emerald-500 text-xs'}>
                                        {entry.status === 'on_break' ? 'Pause' : 'Aktiv'}
                                    </Badge>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* ArbZG Hinweis — nur Manager, aufklappbar */}
                {permissions.isManager && (
                    <details className="mb-5 group">
                        <summary className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none list-none">
                            <span className="w-4 h-4 flex items-center justify-center rounded-full border border-border text-[10px] shrink-0">i</span>
                            ArbZG-Hinweise
                        </summary>
                        <div className="mt-2 px-3 py-2 rounded-xl border border-border bg-secondary/30 text-xs text-muted-foreground leading-relaxed">
                            Max. 10h/Tag (§3) · Mind. 11h Ruhezeit (§5) · Bei &gt;6h: 30 Min Pause, bei &gt;9h: 45 Min (§4) · Einträge 2 Jahre gespeichert
                        </div>
                    </details>
                )}

                {/* ── TRENNLINIE ────────────────────────────────────────────── */}
                <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-1">Zeiterfassung</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* ── STATS ─────────────────────────────────────────────────── */}
                {/* Eigene Stats — immer 2 Karten */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <Card className="p-4 bg-secondary/40 border-border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Monat</p>
                        <p className="text-2xl font-bold text-foreground">{myMonthHours.toFixed(1)}h</p>
                        <p className="text-xs text-emerald-500 mt-0.5">{myApprovedHours.toFixed(1)}h genehmigt</p>
                    </Card>
                    <Card className="p-4 bg-secondary/40 border-border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Offen</p>
                        <p className="text-2xl font-bold text-foreground">
                            {myEntries.filter(e => e.status === 'eingereicht' || e.status === 'entwurf').length}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Einträge ausstehend</p>
                    </Card>
                </div>

                {/* Team Stats — Manager, aufklappbar */}
                {permissions.isManager && (
                    <details className="mb-5">
                        <summary className="text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none list-none flex items-center gap-1.5 mb-2">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Team-Statistiken anzeigen
                        </summary>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            {[
                                { label: 'Heute', value: todayHours },
                                { label: 'Woche', value: weekHours },
                                { label: 'Monat', value: totalHours },
                            ].map(s => (
                                <Card key={s.label} className="p-3 bg-secondary/20 border-border/50 text-center">
                                    <p className="text-[10px] text-muted-foreground mb-0.5">{s.label}</p>
                                    <p className="text-lg font-bold text-foreground">{s.value.toFixed(1)}h</p>
                                </Card>
                            ))}
                        </div>
                    </details>
                )}

                {/* ── MONAT NAVIGATION + AKTIONEN ───────────────────────────── */}
                <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all min-h-[32px]"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-bold text-foreground min-w-[130px] text-center">
                            {format(selectedMonth, 'MMMM yyyy', { locale: de })}
                        </span>
                        <button
                            onClick={() => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all min-h-[32px]"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Manager-Aktionen kompakt */}
                    {permissions.isManager && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                                onClick={() => { setSelectedEntry(null); setModalOpen(true); }}
                                size="sm"
                                className="bg-amber-600 hover:bg-amber-700 text-xs h-8"
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Eintrag
                            </Button>
                            <MonthlyReportExport isVisible />
                            <PayrollReportSender
                                pdfUrl={`/monthly-report-${format(selectedMonth, 'yyyy-MM')}`}
                                year={selectedMonth.getFullYear()}
                                month={selectedMonth.getMonth() + 1}
                            />
                        </div>
                    )}
                </div>

                {/* ── FILTER — nur für Manager ───────────────────────────────── */}
                {permissions.isManager && (
                    <div className="flex flex-wrap gap-2 items-center mb-4 p-3 bg-card border border-border rounded-xl">
                        <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <select
                            value={filterEmployee}
                            onChange={e => setFilterEmployee(e.target.value)}
                            className="text-sm bg-background border border-border rounded-lg px-2 py-1.5 text-foreground flex-1 min-w-[140px] min-h-[36px]"
                        >
                            <option value="">Alle Mitarbeiter</option>
                            {employeeNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            className="text-sm bg-background border border-border rounded-lg px-2 py-1.5 text-foreground flex-1 min-w-[130px] min-h-[36px]"
                        >
                            <option value="">Alle Status</option>
                            <option value="entwurf">Entwurf</option>
                            <option value="eingereicht">Eingereicht</option>
                            <option value="genehmigt">Genehmigt</option>
                        </select>
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            className="text-sm bg-background border border-border rounded-lg px-2 py-1.5 text-foreground flex-1 min-w-[130px] min-h-[36px]"
                        />
                        {(filterEmployee || filterStatus || filterDate) && (
                            <button
                                onClick={() => { setFilterEmployee(''); setFilterStatus(''); setFilterDate(''); }}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-[36px] px-2"
                            >
                                <X className="w-3.5 h-3.5" />
                                Reset
                            </button>
                        )}
                    </div>
                )}

                {/* ── EINTRÄGE nach Mitarbeiter ──────────────────────────────── */}
                <div className="space-y-5">
                    {Object.entries(entriesByEmployee).map(([employeeName, entries]) => {
                        const employeeTotal = entries.reduce((s, e) => s + (e.total_hours || 0), 0);
                        const pendingCount  = entries.filter(e =>
                            (e.status === 'eingereicht' || e.employee_confirmed) && e.status !== 'genehmigt'
                        ).length;
                        return (
                            <div key={employeeName}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-semibold text-foreground">{employeeName}</h2>
                                        <span className="text-xs text-muted-foreground">{employeeTotal.toFixed(2)}h</span>
                                    </div>
                                    {permissions.isManager && pendingCount > 0 && (
                                        <Button
                                            onClick={() => handleApproveEmployee(employeeName)}
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7"
                                        >
                                            <Check className="w-3 h-3 mr-1" />
                                            Alle ({pendingCount})
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {entries
                                        .sort((a, b) => b.date.localeCompare(a.date))
                                        .map(entry => {
                                            const StatusIcon = statusConfig[entry.status]?.icon || FileText;
                                            return (
                                                <Card key={entry.id} className="p-3 sm:p-4 bg-card border-border">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                                                <span className="font-semibold text-foreground text-sm">
                                                                    {format(parseISO(entry.date), 'dd.MM.yyyy', { locale: de })}
                                                                </span>
                                                                <Badge className={cn(statusConfig[entry.status]?.color, "text-[10px]")}>
                                                                    <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                                                                    {statusConfig[entry.status]?.label}
                                                                </Badge>
                                                                {entry.employee_confirmed && (
                                                                    <Badge className="bg-blue-500/15 text-blue-500 text-[10px]">✓ Bestätigt</Badge>
                                                                )}
                                                                {entry.status === 'genehmigt' && (
                                                                    <Badge className="bg-secondary text-foreground/70 text-[10px]">🔒</Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                                                <span>
                                                                    {entry.start_time}–{entry.end_time}
                                                                    {entry.end_time < entry.start_time && ' 🌙'}
                                                                </span>
                                                                {entry.break_minutes > 0 && <span>{entry.break_minutes} Min Pause</span>}
                                                                <span className="font-semibold text-amber-400">{entry.total_hours?.toFixed(2)}h</span>
                                                            </div>
                                                            {entry.arbzg_warning && (
                                                                <div className="mt-1.5 px-2 py-1 bg-destructive/10 border border-destructive/20 rounded text-[10px] text-destructive flex items-center gap-1">
                                                                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                                    {entry.arbzg_warning}
                                                                </div>
                                                            )}
                                                            {entry.notes && (
                                                                <p className="text-[10px] text-muted-foreground mt-1">{entry.notes}</p>
                                                            )}
                                                            {entry.status === 'genehmigt' && entry.manager_approved_by && (
                                                                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                                                    Genehmigt von {entry.manager_approved_by} · {format(parseISO(entry.manager_approved_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-1 flex-shrink-0">
                                                            {!entry.employee_confirmed && entry.employee_id === currentEmployee?.id && entry.status !== 'genehmigt' && (
                                                                <button
                                                                    onClick={() => confirmEntryMutation.mutate(entry.id)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-500 hover:bg-blue-500/10 transition-all min-h-[44px] min-w-[44px]"
                                                                    title="Bestätigen"
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {permissions.isManager && entry.status !== 'genehmigt' && (entry.status === 'eingereicht' || entry.employee_confirmed) && (
                                                                <button
                                                                    onClick={() => handleApprove(entry.id)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-all min-h-[44px] min-w-[44px]"
                                                                    title="Genehmigen"
                                                                >
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {canEdit(entry) && (
                                                                <button
                                                                    onClick={() => { setSelectedEntry(entry); setModalOpen(true); }}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all min-h-[44px] min-w-[44px]"
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {permissions.isManager && (
                                                                <button
                                                                    onClick={() => handleDelete(entry.id)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all min-h-[44px] min-w-[44px]"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredEntries.length === 0 && visibleEntries.length > 0 && (
                    <Card className="p-8 bg-card border-border text-center text-muted-foreground">
                        <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Keine Einträge für diesen Filter</p>
                    </Card>
                )}
                {visibleEntries.length === 0 && (
                    <Card className="p-12 bg-card border-border text-center text-muted-foreground">
                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Noch keine Zeiteinträge für diesen Monat</p>
                        <p className="text-xs mt-1 opacity-60">Stempelzeiten werden automatisch übertragen</p>
                    </Card>
                )}
            </div>

            {/* ── Bestätigungs-Dialog "Alle Ausstempeln" ─────────────────────── */}
            <Dialog open={clockOutAllDialog} onOpenChange={setClockOutAllDialog}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                            Alle ausstempeln?
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {clockEntries.filter(e => e.status === 'clocked_in').length} Mitarbeiter werden jetzt ausgestempelt und ihre Zeiteinträge automatisch erstellt.
                    </p>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setClockOutAllDialog(false)}>Abbrechen</Button>
                        <Button
                            variant="destructive"
                            onClick={() => clockOutAllMutation.mutate()}
                            disabled={clockOutAllMutation.isPending}
                        >
                            {clockOutAllMutation.isPending ? 'Wird ausgeführt...' : 'Alle ausstempeln'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── TimeEntry Modal ─────────────────────────────────────────────── */}
            <TimeEntryModal
                open={modalOpen}
                onClose={() => { setModalOpen(false); setSelectedEntry(null); }}
                entry={selectedEntry}
                currentEmployee={currentEmployee}
                allEmployees={allEmployees}
                isManager={permissions.isManager}
                onSave={handleSave}
            />

            {/* ── Schicht-Zusammenfassung Sheet ───────────────────────────────── */}
            <Sheet open={!!shiftSummary} onOpenChange={open => { if (!open) setShiftSummary(null); }}>
                <SheetContent side="bottom" className="rounded-t-2xl pb-10 px-6 pt-6">
                    {shiftSummary && (
                        <div className="space-y-5">
                            <div className="text-center space-y-1">
                                <div className="text-4xl">✅</div>
                                <h2 className="text-xl font-bold text-foreground">Schicht beendet</h2>
                                <p className="text-sm text-muted-foreground">{shiftSummary.clockIn} – {shiftSummary.clockOut} Uhr</p>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-muted rounded-xl p-4 text-center space-y-1">
                                    <Clock3 className="w-5 h-5 mx-auto text-blue-500" />
                                    <p className="text-2xl font-bold text-foreground">{shiftSummary.workedHours}h</p>
                                    <p className="text-xs text-muted-foreground">Gearbeitet</p>
                                </div>
                                <div className="bg-muted rounded-xl p-4 text-center space-y-1">
                                    <Coffee className="w-5 h-5 mx-auto text-amber-500" />
                                    <p className="text-2xl font-bold text-foreground">{shiftSummary.breakMinutes} Min</p>
                                    <p className="text-xs text-muted-foreground">
                                        {shiftSummary.actualBreakMinutes > 0 && shiftSummary.breakMinutes === shiftSummary.actualBreakMinutes
                                            ? 'Pause (inkl. deiner Pausen)'
                                            : 'Pause'}
                                    </p>
                                </div>
                                {shiftSummary.earned && (
                                    <div className="bg-emerald-500/10 rounded-xl p-4 text-center space-y-1 col-span-2">
                                        <Euro className="w-5 h-5 mx-auto text-emerald-500" />
                                        <p className="text-3xl font-bold text-emerald-500">{shiftSummary.earned} €</p>
                                        <p className="text-xs text-muted-foreground">Verdient ({shiftSummary.hourlyRate} €/h)</p>
                                    </div>
                                )}
                            </div>
                            {shiftSummary.breakDetails && shiftSummary.breakDetails.length > 0 && (
                                <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
                                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                        <Coffee className="w-3 h-3" />
                                        Pausen im Detail:
                                    </p>
                                    {shiftSummary.breakDetails.map((b, i) => (
                                        <div key={i} className="flex justify-between text-xs text-muted-foreground">
                                            <span>{b.start} – {b.end || 'laufend'} Uhr</span>
                                            <span className="font-medium">{b.minutes} Min</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-border/50 pt-1.5 flex justify-between text-xs font-semibold text-foreground">
                                        <span>Gesamtpause:</span>
                                        <span>{shiftSummary.breakMinutes} Min</span>
                                    </div>
                                </div>
                            )}
                            {shiftSummary.arbzgWarning && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-sm text-amber-500 flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    {shiftSummary.arbzgWarning}
                                </div>
                            )}
                            <Separator />
                            <p className="text-center text-sm text-muted-foreground">
                                {shiftSummary.workedMinutes >= 480
                                    ? '💪 Langer Einsatz heute — gut gemacht!'
                                    : shiftSummary.workedMinutes >= 300
                                    ? '👍 Gute Schicht — bis zum nächsten Mal!'
                                    : '☕ Kurze Schicht heute — schönen Feierabend!'}
                            </p>
                            <Button className="w-full" onClick={() => setShiftSummary(null)}>Schließen</Button>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}