/**
 * useClockInOut — zentrale Stempel-Logik für SmartDashboard, mobilen Header und DesktopQuickBar.
 *
 * Erhält: frischen Server-Check auf aktive Session VOR create() (Marco-Doppelstempel-Fix),
 * Optimistic UI, Invalidierung von ['clock-entries'], WLAN-Aussetzer-Fehlerbehandlung,
 * Pausen-Vorschlag beim Ausstempeln.
 */
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';
import { queueMutation } from '@/components/utils/offlineSync';
import { isActiveEntry, formatDuration, calcWorkMinutes } from '@/lib/nightUtils';
import { calcTotalBreakMinutes, calcLegalBreak } from '@/lib/timeTrackingHelpers';

export function useClockInOut(currentEmployee) {
    const queryClient = useQueryClient();
    const [elapsed, setElapsed] = useState('');
    const [shiftSummary, setShiftSummary] = useState(null);

    const { data: clockEntries = [] } = useQuery({
        queryKey: ['clock-entries', currentEmployee?.id],
        queryFn: () => base44.entities.ClockEntry.filter({ employee_id: currentEmployee.id }, '-clock_in', 10),
        enabled: !!currentEmployee?.id,
        refetchInterval: 60000,
        staleTime: 45000,
    });

    const active = clockEntries.find(e => isActiveEntry(e));

    useEffect(() => {
        if (!active) { setElapsed(''); return; }
        const tick = () => setElapsed(formatDuration(calcWorkMinutes(active.clock_in, new Date())));
        tick();
        const id = setInterval(tick, 60000);
        return () => clearInterval(id);
    }, [active?.clock_in]);

    const clockInMutation = useMutation({
        mutationFn: async () => {
            // ⚠️ Frischer Check: aktive Session aus dem Cache prüfen VOR create()
            // (Marco-Doppelstempel-Fix — verhindert doppeltes Einstempeln bei schnellem Tippen).
            if (clockEntries.find(e => isActiveEntry(e))) return { skipped: true };
            const payload = {
                employee_id:   currentEmployee.id,
                employee_name: currentEmployee.name,
                clock_in:      new Date().toISOString(),
                status:        'clocked_in',
            };
            // ⚠️ Einstempeln darf nie an einem WLAN-Aussetzer scheitern.
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'ClockEntry', type: 'create', data: payload });
                return { entry: { ...payload, id: `offline-${Date.now()}`, _offline: true }, offline: true };
            }
            try {
                const created = await base44.entities.ClockEntry.create(payload);
                return { entry: created, offline: false };
            } catch (err) {
                await queueMutation({ entityName: 'ClockEntry', type: 'create', data: payload });
                return { entry: { ...payload, id: `offline-${Date.now()}`, _offline: true }, offline: true };
            }
        },
        onSuccess: (result) => {
            if (!result || result.skipped) return;
            if (result.offline) {
                queryClient.setQueryData(['clock-entries', currentEmployee?.id], (old = []) => [...old, result.entry]);
                toast.success('Eingestempelt (offline) ⚡ — wird synchronisiert sobald wieder online');
            } else {
                queryClient.invalidateQueries({ queryKey: ['clock-entries'] });
            }
        },
    });

    const clockOutMutation = useMutation({
        mutationFn: async (entryId) => {
            const entry = clockEntries.find(e => e.id === entryId);
            if (!entry) throw new Error('ClockEntry nicht gefunden');
            const now = new Date();
            const totalMinutes = calcWorkMinutes(entry.clock_in, now);
            const actualBreakMinutes = calcTotalBreakMinutes(entry?.breaks || []);
            const legalBreak = calcLegalBreak(totalMinutes);
            const breakMinutes = Math.max(actualBreakMinutes, legalBreak);
            const workedHours = Math.round(((totalMinutes - breakMinutes) / 60) * 100) / 100;
            // paidHours = Nettostunden + Pause (max. 45 Min pro Schicht mitbezahlt).
            const paidHours = Math.round((workedHours + Math.min(breakMinutes, 45) / 60) * 100) / 100;
            const hourlyRate = currentEmployee?.hourly_rate;
            const earned = hourlyRate ? (paidHours * hourlyRate).toFixed(2) : null;

            const clockEntryUpdate = {
                clock_out: now.toISOString(), break_minutes: breakMinutes,
                total_hours: workedHours, status: 'clocked_out',
                breaks: entry.breaks || [],
            };
            const timeEntryPayload = {
                employee_id: entry.employee_id, employee_name: entry.employee_name,
                date:       format(new Date(entry.clock_in), 'yyyy-MM-dd'),
                start_time: format(new Date(entry.clock_in), 'HH:mm'),
                end_time:   format(now, 'HH:mm'),
                break_minutes: breakMinutes, total_hours: workedHours,
                notes: `Automatisch · Stempeluhr${breakMinutes > 0 ? ` · ${breakMinutes} Min. Pause` : ''}`,
                status: 'eingereicht', employee_confirmed: true,
                employee_confirmed_at: now.toISOString(),
            };

            // ⚠️ Ausstempeln ist lohnrelevant — bei WLAN-Ausfall in die Sync-Queue.
            let offline = !navigator.onLine;
            if (!offline) {
                try {
                    await base44.entities.ClockEntry.update(entryId, clockEntryUpdate);
                    await base44.entities.TimeEntry.create(timeEntryPayload);
                } catch (err) {
                    offline = true;
                }
            }
            if (offline) {
                await queueMutation({ entityName: 'ClockEntry', type: 'update', id: entryId, data: clockEntryUpdate });
                await queueMutation({ entityName: 'TimeEntry', type: 'create', data: timeEntryPayload });
            }

            const breakDetails = (entry.breaks || []).map(b => ({
                start: format(new Date(b.start), 'HH:mm'),
                end: b.end ? format(new Date(b.end), 'HH:mm') : null,
                minutes: b.end
                    ? differenceInMinutes(new Date(b.end), new Date(b.start))
                    : differenceInMinutes(now, new Date(b.start)),
            }));

            return {
                entryId, clockEntryUpdate, offline,
                summary: {
                    workedHours, paidHours, breakMinutes, earned, hourlyRate,
                    clockIn: format(new Date(entry.clock_in), 'HH:mm'),
                    clockOut: format(now, 'HH:mm'),
                    breakDetails,
                },
            };
        },
        onSuccess: (result) => {
            if (!result) return;
            const { entryId, clockEntryUpdate, offline, summary } = result;
            if (offline) {
                queryClient.setQueryData(['clock-entries', currentEmployee?.id], (old = []) => old.map(e => e.id === entryId ? { ...e, ...clockEntryUpdate } : e));
                toast.success('Ausgestempelt (offline) ⚡ — wird synchronisiert sobald wieder online');
            } else {
                queryClient.invalidateQueries({ queryKey: ['clock-entries'] });
                queryClient.invalidateQueries({ queryKey: ['time-entries'] });
                queryClient.invalidateQueries({ queryKey: ['time-entries-dashboard'] });
            }
            setShiftSummary(summary);
        },
    });

    return {
        active,
        clockIn: () => clockInMutation.mutate(),
        clockOut: (entryId) => clockOutMutation.mutate(entryId),
        isClockingIn: clockInMutation.isPending,
        isClockingOut: clockOutMutation.isPending,
        elapsed,
        shiftSummary,
        setShiftSummary,
    };
}