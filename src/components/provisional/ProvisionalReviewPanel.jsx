import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    CheckCircle2, XCircle, Pencil, Clock, ChevronRight, ChevronLeft,
    Zap, ListFilter, CalendarDays, User, CheckCheck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatHours, statsByEmployee } from '@/lib/provisionalShiftHours';
import WunschUebersicht from '@/components/provisional/WunschUebersicht';

const SHIFT_TYPES = ['Aufmachen', 'Frühschicht', 'Spätschicht', 'Sonderschicht'];

const STATUS_CONFIG = {
    ausstehend: { label: 'Ausstehend', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
    bestätigt:  { label: 'Bestätigt',  color: 'bg-green-500/20 text-green-300 border-green-500/40' },
    abgelehnt:  { label: 'Abgelehnt',  color: 'bg-red-500/20 text-red-300 border-red-500/40' },
};

function formatDate(dateStr) {
    return format(parseISO(dateStr), 'EEEE, dd.MM.', { locale: de });
}

// ── Single request card used in both list & queue mode ──
function RequestCard({ req, onConfirm, onReject, onEdit, compact = false, isProcessing = false, employee, empStats }) {
    const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.ausstehend;
    const isPending = req.status === 'ausstehend';
    const weeklyHours = employee?.weekly_hours ?? null;
    const empLabel = employee?.short_name || employee?.name || req.employee_name;

    return (
        <div className={cn(
            'rounded-2xl border transition-all',
            isPending ? 'bg-card border-yellow-500/20' : 'bg-card/60 border-border/50',
            req.status === 'bestätigt' && 'border-green-500/20',
            req.status === 'abgelehnt' && 'opacity-60 border-red-500/20',
            compact ? 'p-4' : 'p-5'
        )}>
            {/* Header row */}
            <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-400 shrink-0 text-base">
                    {req.employee_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground text-base">{req.employee_name}</span>
                        <Badge className={cn('text-xs border px-2', sc.color)}>{sc.label}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-sm font-semibold text-foreground">
                        <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {formatDate(req.date)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{req.start_time} – {req.end_time}</span>
                        {req.shift_type && <span className="text-amber-400 font-medium">• {req.shift_type}</span>}
                    </div>
                    {(weeklyHours != null || empStats) && (
                        <div className="mt-1 space-y-0.5">
                            {weeklyHours != null && weeklyHours !== '' && (
                                <p className="text-xs text-muted-foreground">Vertrag: {weeklyHours} Std/Woche</p>
                            )}
                            {empStats && (
                                <p className="text-xs text-muted-foreground">
                                    von {empLabel}: {empStats.count} {empStats.count === 1 ? 'Wunsch' : 'Wünsche'} · {formatHours(empStats.hours)} Std gewünscht
                                </p>
                            )}
                        </div>
                    )}
                    {req.comment && (
                        <p className="text-xs text-muted-foreground mt-1.5 italic bg-secondary/50 rounded-lg px-2.5 py-1.5">
                            „{req.comment}"
                        </p>
                    )}
                    {req.manager_note && (
                        <p className="text-xs text-amber-400/80 mt-1">📋 {req.manager_note}</p>
                    )}
                </div>
            </div>

            {/* Action buttons – only for pending */}
            {isPending && (
                <div className="grid grid-cols-3 gap-2 mt-4">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() => onEdit(req)}
                        className="h-11 gap-1.5 text-sm font-medium border-border/60 hover:bg-secondary col-span-1"
                    >
                        <Pencil className="w-4 h-4" />
                        Bearbeiten
                    </Button>
                    <Button
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => onReject(req)}
                        className="h-11 gap-1.5 text-sm font-medium bg-red-600/80 hover:bg-red-600 text-white col-span-1"
                    >
                        <XCircle className="w-4 h-4" />
                        Ablehnen
                    </Button>
                    <Button
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => onConfirm(req)}
                        className="h-11 gap-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white col-span-1"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        OK
                    </Button>
                </div>
            )}
        </div>
    );
}

// ── Queue / Meeting mode: one card at a time ──
function QueueMode({ pending, onConfirm, onReject, onEdit, isProcessing, employeeMap, employeeStats, overviewRows, overviewTotal }) {
    const [idx, setIdx] = useState(0);
    const total = pending.length;

    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <CheckCheck className="w-14 h-14 text-green-500 opacity-70" />
                <p className="text-lg font-bold text-foreground">Alle erledigt!</p>
                <p className="text-sm text-muted-foreground">Keine ausstehenden Anfragen mehr.</p>
            </div>
        );
    }

    const current = pending[Math.min(idx, total - 1)];

    const advance = () => {
        if (idx < total - 1) setIdx(idx + 1);
        else setIdx(0);
    };

    const handleConfirm = (req) => { onConfirm(req); advance(); };
    const handleReject  = (req) => { onReject(req); advance(); };

    return (
        <div className="space-y-4">
            <WunschUebersicht rows={overviewRows} totalCount={overviewTotal.count} totalHours={overviewTotal.hours} />

            {/* Progress */}
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground font-medium">
                    Anfrage {idx + 1} von {total}
                </span>
                <div className="flex gap-1">
                    {pending.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setIdx(i)}
                            className={cn(
                                'w-2.5 h-2.5 rounded-full transition-all',
                                i === idx ? 'bg-amber-500 scale-125' : 'bg-border hover:bg-muted-foreground'
                            )}
                        />
                    ))}
                </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${((idx + 1) / total) * 100}%` }}
                />
            </div>

            <RequestCard
                req={current}
                onConfirm={handleConfirm}
                onReject={handleReject}
                onEdit={onEdit}
                isProcessing={isProcessing}
                employee={employeeMap[current.employee_id]}
                empStats={employeeStats[current.employee_id]}
            />

            {/* Prev/Next nav */}
            {total > 1 && (
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="flex-1 h-10">
                        <ChevronLeft className="w-4 h-4 mr-1" /> Zurück
                    </Button>
                    <Button variant="outline" onClick={() => setIdx(Math.min(total - 1, idx + 1))} disabled={idx === total - 1} className="flex-1 h-10">
                        Weiter <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
            )}
        </div>
    );
}

// ── List mode: grouped by date ──
function ListView({ filtered, onConfirm, onReject, onEdit, isProcessing, employeeMap, employeeStats }) {
    if (filtered.length === 0) {
        return (
            <Card className="p-8 text-center">
                <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">Keine Einträge</p>
            </Card>
        );
    }

    // Group by date
    const grouped = filtered.reduce((acc, req) => {
        if (!acc[req.date]) acc[req.date] = [];
        acc[req.date].push(req);
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, reqs]) => (
                <div key={date}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <CalendarDays className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-bold text-amber-400">
                            {format(parseISO(date), 'EEEE, dd. MMMM yyyy', { locale: de })}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">({reqs.length})</span>
                    </div>
                    <div className="space-y-2.5 pl-1">
                        {reqs.map(req => (
                            <RequestCard
                                key={req.id}
                                req={req}
                                compact
                                onConfirm={onConfirm}
                                onReject={onReject}
                                onEdit={onEdit}
                                isProcessing={isProcessing}
                                employee={employeeMap[req.employee_id]}
                                empStats={employeeStats[req.employee_id]}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Edit & Confirm modal ──
function EditModal({ req, open, onClose, onConfirm, onReject, isProcessing }) {
    const [form, setForm] = useState({});
    const [note, setNote] = useState('');

    React.useEffect(() => {
        if (req) {
            setForm({ date: req.date, start_time: req.start_time, end_time: req.end_time, shift_type: req.shift_type || '' });
            setNote('');
        }
    }, [req]);

    if (!req) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="w-4 h-4 text-amber-400" />
                        Wunsch prüfen & anpassen
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-1">
                    {/* Employee info */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-400 shrink-0">
                            {req.employee_name?.charAt(0)}
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">{req.employee_name}</p>
                            <p className="text-xs text-muted-foreground">
                                Wunsch: {formatDate(req.date)}, {req.start_time}–{req.end_time}
                            </p>
                            {req.comment && <p className="text-xs italic text-muted-foreground mt-0.5">„{req.comment}"</p>}
                        </div>
                    </div>

                    {/* Editable fields */}
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-sm">Datum</Label>
                            <Input type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="h-12 text-base" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-sm">Von</Label>
                                <Input type="time" value={form.start_time || ''} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="h-12 text-base" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm">Bis</Label>
                                <Input type="time" value={form.end_time || ''} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="h-12 text-base" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Schichttyp</Label>
                            <div className="flex flex-wrap gap-2">
                                {SHIFT_TYPES.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setForm(f => ({ ...f, shift_type: t }))}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                                            form.shift_type === t
                                                ? 'bg-amber-600 border-amber-600 text-white'
                                                : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Manager-Notiz <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Hinweis an den Mitarbeiter..."
                                rows={2}
                                className="text-sm resize-none"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button
                            disabled={isProcessing}
                            onClick={() => onReject(req, note)}
                            className="h-12 bg-red-600/80 hover:bg-red-600 text-white font-medium"
                        >
                            <XCircle className="w-4 h-4 mr-2" /> Ablehnen
                        </Button>
                        <Button
                            disabled={isProcessing}
                            onClick={() => onConfirm(req, form, note)}
                            className="h-12 bg-green-600 hover:bg-green-700 text-white font-medium"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Bestätigen
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Main export ──
export default function ProvisionalReviewPanel() {
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState('liste'); // 'liste' | 'queue'
    const [statusFilter, setStatusFilter] = useState('ausstehend');
    const [editTarget, setEditTarget] = useState(null);

    const { data: requests = [] } = useQuery({
        queryKey: ['all-provisional-requests'],
        queryFn: () => base44.entities.ProvisionalShiftRequest.list('-date', 200)
    });

    // Mitarbeiterdaten (Vertragsstunden) für die Prüfansicht
    const { data: employees = [] } = useQuery({
        queryKey: ['review-employees'],
        queryFn: () => base44.entities.Employee.list()
    });

    const employeeMap = useMemo(() => {
        const map = {};
        employees.forEach(e => { map[e.id] = e; });
        return map;
    }, [employees]);

    // Wünsche + Stunden pro Mitarbeiter über den gesamten geladenen Datensatz
    const employeeStats = useMemo(() => statsByEmployee(requests), [requests]);

    const reviewMutation = useMutation({
        mutationFn: async ({ req, action, note, overrides }) => {
            if (action === 'bestätigt') {
                await base44.entities.Shift.create({
                    employee_id: req.employee_id,
                    employee_name: req.employee_name,
                    date: overrides?.date || req.date,
                    start_time: overrides?.start_time || req.start_time,
                    end_time: overrides?.end_time || req.end_time,
                    shift_type: overrides?.shift_type || req.shift_type,
                    notes: note ? `Selbsteinplanung: ${note}` : 'Selbsteinplanung bestätigt',
                });
            }
            return base44.entities.ProvisionalShiftRequest.update(req.id, {
                status: action,
                manager_note: note || '',
                reviewed_by: 'Manager',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['all-provisional-requests']);
            queryClient.invalidateQueries(['provisional-shift-requests']);
            queryClient.invalidateQueries(['shifts']);
            setEditTarget(null);
        }
    });

    const pending = useMemo(() => requests.filter(r => r.status === 'ausstehend').sort((a, b) => a.date.localeCompare(b.date)), [requests]);
    const filtered = useMemo(() =>
        [...requests]
            .filter(r => statusFilter === 'alle' || r.status === statusFilter)
            .sort((a, b) => a.date.localeCompare(b.date)),
        [requests, statusFilter]
    );

    // Übersicht „Wer hat wie viel" — nur ausstehende Wünsche, absteigend nach Stunden
    const overviewRows = useMemo(() => {
        const map = statsByEmployee(pending);
        return Object.entries(map)
            .map(([key, s]) => ({
                key,
                name: employeeMap[s.employee_id]?.short_name || employeeMap[s.employee_id]?.name || s.employee_name,
                count: s.count,
                hours: s.hours,
                weeklyHours: employeeMap[s.employee_id]?.weekly_hours ?? null,
            }))
            .sort((a, b) => b.hours - a.hours);
    }, [pending, employeeMap]);

    const overviewTotal = useMemo(() => overviewRows.reduce(
        (acc, r) => ({ count: acc.count + r.count, hours: acc.hours + r.hours }),
        { count: 0, hours: 0 }
    ), [overviewRows]);

    const handleConfirm = (req, overrides, note) => {
        reviewMutation.mutate({ req, action: 'bestätigt', note: note || '', overrides: overrides || null });
    };
    const handleReject = (req, note) => {
        reviewMutation.mutate({ req, action: 'abgelehnt', note: note || '' });
    };
    const handleQuickConfirm = (req) => reviewMutation.mutate({ req, action: 'bestätigt', note: '' });
    const handleQuickReject  = (req) => reviewMutation.mutate({ req, action: 'abgelehnt', note: '' });

    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
                        <User className="w-5 h-5 text-amber-400" />
                        Wunschschichten prüfen
                    </h3>
                    {pending.length > 0 ? (
                        <p className="text-sm text-amber-400 mt-0.5 font-medium">
                            {pending.length} ausstehende Anfrage{pending.length !== 1 ? 'n' : ''}
                        </p>
                    ) : (
                        <p className="text-sm text-green-400 mt-0.5">Alle erledigt ✓</p>
                    )}
                </div>

                {/* Mode toggle */}
                <div className="flex bg-secondary rounded-xl p-1 gap-1">
                    <button
                        onClick={() => setViewMode('liste')}
                        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                            viewMode === 'liste' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <ListFilter className="w-3.5 h-3.5" /> Liste
                    </button>
                    <button
                        onClick={() => { setViewMode('queue'); setStatusFilter('ausstehend'); }}
                        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                            viewMode === 'queue' ? 'bg-amber-600 text-white shadow' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Zap className="w-3.5 h-3.5" /> Meeting
                        {pending.length > 0 && viewMode !== 'queue' && (
                            <span className="bg-amber-500 text-slate-900 text-xs rounded-full px-1.5 font-bold">{pending.length}</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Filter tabs – only in list mode */}
            {viewMode === 'liste' && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {['ausstehend', 'bestätigt', 'abgelehnt', 'alle'].map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)}
                            className={cn('px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 border',
                                statusFilter === s
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-secondary text-muted-foreground hover:text-foreground border-transparent'
                            )}>
                            {s === 'alle' ? 'Alle' : STATUS_CONFIG[s]?.label}
                            {s === 'ausstehend' && pending.length > 0 && (
                                <span className="ml-2 bg-amber-400 text-slate-900 rounded-full px-1.5 text-xs font-bold">{pending.length}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            {viewMode === 'queue' ? (
                <QueueMode
                    pending={pending}
                    onConfirm={handleQuickConfirm}
                    onReject={handleQuickReject}
                    onEdit={setEditTarget}
                    isProcessing={reviewMutation.isPending}
                    employeeMap={employeeMap}
                    employeeStats={employeeStats}
                    overviewRows={overviewRows}
                    overviewTotal={overviewTotal}
                />
            ) : (
                <ListView
                    filtered={filtered}
                    onConfirm={handleQuickConfirm}
                    onReject={handleQuickReject}
                    onEdit={setEditTarget}
                    isProcessing={reviewMutation.isPending}
                    employeeMap={employeeMap}
                    employeeStats={employeeStats}
                />
            )}

            {/* Edit modal */}
            <EditModal
                req={editTarget}
                open={!!editTarget}
                onClose={() => setEditTarget(null)}
                onConfirm={handleConfirm}
                onReject={handleReject}
                isProcessing={reviewMutation.isPending}
            />
        </div>
    );
}