/**
 * BulkClockInPanel — Manager-only: Sammelt alle Mitarbeiter, die heute
 * eingeplant sind aber noch nicht eingestempelt wurden, und ermöglicht
 * ein gesammeltes Aufstempeln mit Bestätigung.
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { UserCheck, Clock, AlertTriangle, X, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function BulkClockInPanel({ todayShifts, employees, isManager, currentUser }) {
    const [open, setOpen] = useState(false);
    const [useCurrentTime, setUseCurrentTime] = useState(true);
    const [customTime, setCustomTime] = useState(format(new Date(), 'HH:mm'));
    const [done, setDone] = useState(false);
    const queryClient = useQueryClient();

    // Fetch recent clock entries to determine who's already clocked in
    const { data: clockEntries = [] } = useQuery({
        queryKey: ['clock-entries-today'],
        queryFn: () => base44.entities.ClockEntry.list('-clock_in', 200),
        enabled: isManager,
        staleTime: STALE.FAST
    });

    const alreadyClockedInIds = useMemo(() => {
        // Nachtschicht: laufende Stempel von vor Mitternacht gelten weiter als eingestempelt.
        const windowStart = Date.now() - 24 * 60 * 60 * 1000;
        return new Set(
            clockEntries
                .filter(e => e.status === 'clocked_in' && new Date(e.clock_in).getTime() >= windowStart)
                .map(e => e.employee_id)
        );
    }, [clockEntries]);

    // Employees with shifts today but not yet clocked in
    const missingEmployees = useMemo(() => {
        const scheduledIds = new Set(todayShifts.map(s => s.employee_id));
        return employees.filter(e => scheduledIds.has(e.id) && !alreadyClockedInIds.has(e.id));
    }, [todayShifts, employees, alreadyClockedInIds]);

    const bulkClockInMutation = useMutation({
        mutationFn: async ({ emps, clockTime, managerName }) => {
            const dt = new Date();
            const [h, m] = clockTime.split(':').map(Number);
            dt.setHours(h, m, 0, 0);
            const isoTime = dt.toISOString();

            await Promise.all(emps.map(emp =>
                base44.entities.ClockEntry.create({
                    employee_id: emp.id,
                    employee_name: emp.name,
                    clock_in: isoTime,
                    status: 'clocked_in',
                    notes: `Manuell eingestempelt durch Manager: ${managerName} am ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de })}`
                })
            ));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clock-entries-today'] });
            queryClient.invalidateQueries({ queryKey: ['clock-entries'] });
            setDone(true);
            setOpen(false);
        }
    });

    if (!isManager) return null;
    if (missingEmployees.length === 0 && !done) return null;

    const handleConfirm = () => {
        const clockTime = useCurrentTime ? format(new Date(), 'HH:mm') : customTime;
        bulkClockInMutation.mutate({
            emps: missingEmployees,
            clockTime,
            managerName: currentUser?.full_name || currentUser?.email || 'Manager'
        });
    };

    if (done) {
        return (
            <Card className="border-green-500/40 bg-green-500/8">
                <CardContent className="p-3 flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    <p className="text-sm text-green-300 font-medium">Alle offenen Schichtstarts wurden eingestempelt.</p>
                    <button onClick={() => setDone(false)} className="ml-auto text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            {/* Alarm-Eintrag im Panel */}
            <div className="flex items-center gap-3 rounded-xl border border-orange-500/40 bg-orange-500/8 px-4 py-3 min-h-[56px]">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shrink-0" />
                <UserCheck className="w-4 h-4 text-orange-400 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">
                        {missingEmployees.length} offene Schichtstarts
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Mitarbeiter eingeplant, aber noch nicht eingestempelt
                    </p>
                </div>
                <Button
                    size="sm"
                    onClick={() => setOpen(true)}
                    className="h-9 min-w-[72px] bg-orange-600 hover:bg-orange-700 text-white text-xs shrink-0"
                >
                    Einstempeln
                </Button>
            </div>

            {/* Bottom Sheet / Modal */}
            {open && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

                    {/* Sheet */}
                    <div className="relative z-10 w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                            <div className="w-9 h-9 rounded-xl bg-orange-600/20 flex items-center justify-center shrink-0">
                                <UserCheck className="w-5 h-5 text-orange-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-foreground">Offene Schichtstarts einstempeln</h3>
                                <p className="text-xs text-muted-foreground">Nur für Manager · {format(new Date(), 'dd.MM.yyyy')}</p>
                            </div>
                            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Warning */}
                        <div className="mx-5 mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-300">
                                Diese Aktion stempelt {missingEmployees.length} Mitarbeiter ein. Die Aktion wird mit deinem Namen protokolliert und ist nicht automatisch rückgängig zu machen.
                            </p>
                        </div>

                        {/* Time selector */}
                        <div className="mx-5 mt-4 space-y-2">
                            <p className="text-[12px] font-medium text-muted-foreground">Startzeit</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setUseCurrentTime(true)}
                                    className={cn(
                                        'flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all min-h-[44px]',
                                        useCurrentTime
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border text-muted-foreground hover:border-border/80'
                                    )}
                                >
                                    <Clock className="w-4 h-4 inline mr-1.5" />
                                    Aktuelle Zeit
                                </button>
                                <button
                                    onClick={() => setUseCurrentTime(false)}
                                    className={cn(
                                        'flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all min-h-[44px]',
                                        !useCurrentTime
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border text-muted-foreground hover:border-border/80'
                                    )}
                                >
                                    Uhrzeit wählen
                                </button>
                            </div>
                            {!useCurrentTime && (
                                <input
                                    type="time"
                                    value={customTime}
                                    onChange={e => setCustomTime(e.target.value)}
                                    className="w-full h-11 px-3 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                            )}
                        </div>

                        {/* Employee list */}
                        <div className="mx-5 mt-4 overflow-y-auto flex-1">
                            <p className="text-[12px] font-medium text-muted-foreground mb-2">
                                Betroffene Mitarbeiter ({missingEmployees.length})
                            </p>
                            <div className="space-y-2">
                                {missingEmployees.map(emp => {
                                    const shift = todayShifts.find(s => s.employee_id === emp.id);
                                    return (
                                        <div key={emp.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary/40 min-h-[48px]">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                                                style={{ backgroundColor: emp.color || '#64748b' }}>
                                                {emp.name?.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{emp.name}</p>
                                                {shift && (
                                                    <p className="text-xs text-muted-foreground">{shift.start_time}–{shift.end_time}</p>
                                                )}
                                            </div>
                                            <UserCheck className="w-4 h-4 text-orange-400 shrink-0" />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-5 py-4 border-t border-border flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setOpen(false)}
                                className="flex-1 h-11 text-sm"
                            >
                                Abbrechen
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={bulkClockInMutation.isPending}
                                className="flex-1 h-11 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold gap-2"
                            >
                                {bulkClockInMutation.isPending ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" />Stempelt...</>
                                ) : (
                                    <><UserCheck className="w-4 h-4" />{missingEmployees.length} einstempeln</>
                                    )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}