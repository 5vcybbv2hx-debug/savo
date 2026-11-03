import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import { QK } from '@/lib/queryKeys';
import { STALE } from '@/lib/queryUtils';
import { usePermissions } from '@/components/auth/usePermissions';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ClipboardList } from 'lucide-react';

const DAYS = 14;

const STATUS = {
    done: { label: 'abgeschlossen', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    running: { label: 'gestartet, nicht abgeschlossen', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    missing: { label: 'nicht gestartet', className: 'bg-muted text-muted-foreground/60' },
};

function statusOf(session) {
    if (!session) return 'missing';
    return session.is_completed ? 'done' : 'running';
}

/** Rundgang-Protokoll der letzten 14 Tage — nur Manager/Inhaber. */
export default function RundgangProtocol() {
    const { isManager } = usePermissions();
    const from = format(subDays(new Date(), DAYS - 1), 'yyyy-MM-dd');

    const { data: sessions = [], isLoading } = useQuery({
        queryKey: QK.rundgangSessions(DAYS),
        queryFn: async () => {
            const page = await base44.entities.RundgangSession.filter(
                { date: { $gte: from } },
                { sort: '-date', limit: 60 }
            );
            return page?.items || [];
        },
        enabled: isManager,
        staleTime: STALE.MEDIUM,
    });

    const days = useMemo(() => {
        const byDate = new Map(sessions.map(s => [s.date, s]));
        return Array.from({ length: DAYS }, (_, i) => {
            const d = subDays(new Date(), i);
            const key = format(d, 'yyyy-MM-dd');
            return { key, date: d, session: byDate.get(key) || null };
        });
    }, [sessions]);

    if (!isManager) return null;

    const completedCount = days.filter(d => d.session?.is_completed).length;

    return (
        <Card className="overflow-hidden border-border/50">
            <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/40 bg-muted/20">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Rundgang-Protokoll</p>
                    <p className="text-[10px] text-muted-foreground">
                        Letzte {DAYS} Tage · {completedCount} abgeschlossen
                    </p>
                </div>
            </div>

            {isLoading ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">Lade Protokoll…</p>
            ) : (
                <>
                    {/* Mobile: kompakte Liste */}
                    <div className="md:hidden divide-y divide-border/30">
                        {days.map(({ key, date, session }) => {
                            const status = statusOf(session);
                            const meta = STATUS[status];
                            return (
                                <div key={key} className={cn('flex items-center gap-2.5 px-3 py-2', status === 'missing' && 'opacity-50')}>
                                    <div className="w-12 shrink-0">
                                        <p className="text-[11px] font-bold text-foreground leading-tight">{format(date, 'dd.MM.')}</p>
                                        <p className="text-[10px] text-muted-foreground leading-tight">{format(date, 'EE', { locale: de })}</p>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-foreground truncate">
                                            {session ? session.started_by_name || 'Unbekannt' : '–'}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                            {session
                                                ? `${session.slots_changed ?? 0} von ${session.slots_total ?? 0} Fächern geändert`
                                                : 'kein Rundgang erfasst'}
                                        </p>
                                    </div>
                                    <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold', meta.className)}>
                                        {status === 'running' ? 'gestartet' : status === 'done' ? 'abgeschlossen' : 'nicht gestartet'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop: Tabelle */}
                    <table className="hidden md:table w-full text-xs">
                        <thead>
                            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                                <th className="px-3 py-2 font-semibold">Datum</th>
                                <th className="px-3 py-2 font-semibold">Wochentag</th>
                                <th className="px-3 py-2 font-semibold">Gestartet von</th>
                                <th className="px-3 py-2 font-semibold">Fächer geändert</th>
                                <th className="px-3 py-2 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {days.map(({ key, date, session }) => {
                                const status = statusOf(session);
                                const meta = STATUS[status];
                                return (
                                    <tr key={key} className={cn(status === 'missing' && 'opacity-50')}>
                                        <td className="px-3 py-2 font-medium text-foreground">{format(date, 'dd.MM.yyyy')}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{format(date, 'EEEE', { locale: de })}</td>
                                        <td className="px-3 py-2 text-foreground">{session ? session.started_by_name || 'Unbekannt' : '–'}</td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            {session ? `${session.slots_changed ?? 0} von ${session.slots_total ?? 0}` : '–'}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold', meta.className)}>
                                                {meta.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </>
            )}
        </Card>
    );
}