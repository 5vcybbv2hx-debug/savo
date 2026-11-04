/**
 * ReservationDayList — die EINE Reservierungsliste auf "Gäste & Tische".
 * Startpunkt heute, Zeitraum heute + 13 Tage, chronologisch und nach Tagen
 * gruppiert. Leere Tagesgruppen werden nicht gerendert (Ausnahme: heute).
 */
import { useMemo } from 'react';
import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReservationRow from './ReservationRow';

const DAYS = 14;

function dayHeading(dateKey, todayKey, tomorrowKey) {
    const label = format(parseISO(dateKey), 'EEE, d. MMMM', { locale: de });
    if (dateKey === todayKey) return `Heute · ${label}`;
    if (dateKey === tomorrowKey) return `Morgen · ${label}`;
    return label;
}

export default function ReservationDayList({ reservations = [], tables = [], resolveCreator, onOpen }) {
    const today = startOfDay(new Date());
    const todayKey = format(today, 'yyyy-MM-dd');
    const tomorrowKey = format(addDays(today, 1), 'yyyy-MM-dd');

    const groups = useMemo(() => {
        const byDate = new Map();
        reservations.forEach(r => {
            if (!r.date || r.date < todayKey) return;
            if (!byDate.has(r.date)) byDate.set(r.date, []);
            byDate.get(r.date).push(r);
        });
        // Heute immer zeigen — auch ohne Reservierungen
        if (!byDate.has(todayKey)) byDate.set(todayKey, []);

        return Array.from(byDate.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(0, DAYS)
            .map(([date, items]) => ({
                date,
                items: [...items].sort((a, b) => (a.time || '').localeCompare(b.time || '')),
            }));
    }, [reservations, todayKey]);

    const total = groups.reduce((n, g) => n + g.items.length, 0);
    const todayCount = groups.find(g => g.date === todayKey)?.items.length || 0;

    return (
        <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-primary shrink-0" />Reservierungen
                </h2>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                    Heute {todayCount} · Nächste {DAYS} Tage {total}
                </p>
            </div>

            {groups.map(group => (
                <div key={group.date} className="space-y-2">
                    <h3 className={cn(
                        'text-[11px] font-bold uppercase tracking-wider pt-1',
                        group.date === todayKey ? 'text-primary' : 'text-muted-foreground'
                    )}>
                        {dayHeading(group.date, todayKey, tomorrowKey)}
                    </h3>

                    {group.items.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-3 py-3 rounded-xl border border-dashed border-border">
                            Heute keine Reservierungen
                        </p>
                    ) : (
                        group.items.map((res, idx) => (
                            <ReservationRow
                                key={res.id}
                                reservation={res}
                                tables={tables}
                                resolveCreator={resolveCreator}
                                onOpen={onOpen}
                                index={idx}
                            />
                        ))
                    )}
                </div>
            ))}
        </section>
    );
}