import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { QK } from '@/lib/queryKeys';
import { STALE } from '@/lib/queryUtils';
import { usePermissions } from '@/components/auth/usePermissions';

/**
 * Protokoll eines Rundgang-Tages.
 * Genau ein RundgangSession-Datensatz pro Tag: beim ersten Öffnen wird er angelegt,
 * danach wird derselbe Datensatz fortgesetzt.
 */
export function useRundgangSession(slotsTotal = 0) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const qc = useQueryClient();
    const { employeeId } = usePermissions();

    const { data: session, isLoading } = useQuery({
        queryKey: QK.rundgangSessionToday(today),
        queryFn: async () => {
            const page = await base44.entities.RundgangSession.filter({ date: today }, { limit: 1 });
            const existing = page?.items?.[0];
            if (existing) return existing;

            const user = await base44.auth.me().catch(() => null);
            return base44.entities.RundgangSession.create({
                date: today,
                started_by_name: user?.full_name || user?.email || 'Unbekannt',
                started_by_email: user?.email || '',
                employee_id: employeeId || '',
                started_at: new Date().toISOString(),
                completed_at: null,
                is_completed: false,
                slots_total: slotsTotal,
                slots_changed: 0,
                areas_touched: [],
                notes: '',
            });
        },
        staleTime: STALE.FAST,
    });

    // Fächer-Anzahl nachziehen, sobald die Lagerstruktur geladen ist
    useEffect(() => {
        if (!session?.id || slotsTotal <= 0) return;
        if ((session.slots_total ?? 0) === slotsTotal) return;
        base44.entities.RundgangSession.update(session.id, { slots_total: slotsTotal })
            .then(() => qc.invalidateQueries({ queryKey: QK.rundgangSessionToday(today) }));
    }, [session?.id, session?.slots_total, slotsTotal, today, qc]);

    const countedRef = useRef(new Set());   // Slot-IDs, die heute schon gezählt wurden
    const statsRef = useRef(null);          // { changed, areas } — lokal fortgeschrieben

    useEffect(() => {
        if (session && !statsRef.current) {
            statsRef.current = {
                changed: session.slots_changed ?? 0,
                areas: session.areas_touched ?? [],
            };
        }
    }, [session]);

    const recordSlotChange = async (slotId, areaName) => {
        if (!session?.id || !slotId || countedRef.current.has(slotId)) return;
        countedRef.current.add(slotId);

        const stats = statsRef.current || { changed: 0, areas: [] };
        stats.changed += 1;
        if (areaName && !stats.areas.includes(areaName)) stats.areas = [...stats.areas, areaName];
        statsRef.current = stats;

        // Protokoll ist additiv — ein Fehler hier darf das Speichern der IST-Menge nie blockieren
        try {
            await base44.entities.RundgangSession.update(session.id, {
                slots_changed: stats.changed,
                areas_touched: stats.areas,
            });
            qc.invalidateQueries({ queryKey: QK.rundgangSessionToday(today) });
            qc.invalidateQueries({ queryKey: QK.rundgangSessions(14) });
        } catch {}
    };

    const completeSession = async () => {
        if (!session?.id) return;
        await base44.entities.RundgangSession.update(session.id, {
            is_completed: true,
            completed_at: new Date().toISOString(),
        });
        qc.invalidateQueries({ queryKey: QK.rundgangSessionToday(today) });
        qc.invalidateQueries({ queryKey: QK.rundgangSessions(14) });
    };

    return { session, isLoading, recordSlotChange, completeSession };
}