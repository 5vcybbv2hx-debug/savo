import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { format, parseISO, startOfWeek, endOfWeek, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, LogIn, LogOut, CheckCircle2, FileText, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const statusConfig = {
    'entwurf':     { label: 'Entwurf',     color: 'bg-slate-700 text-slate-300' },
    'eingereicht': { label: 'Eingereicht', color: 'bg-blue-900/50 text-blue-300' },
    'genehmigt':   { label: 'Genehmigt',   color: 'bg-green-900/50 text-green-300' }
};

function LiveClock({ clockIn }) {
    const [duration, setDuration] = useState('');
    useEffect(() => {
        const update = () => {
            const mins = differenceInMinutes(new Date(), new Date(clockIn));
            setDuration(`${Math.floor(mins / 60)}h ${mins % 60}m`);
        };
        update();
        const t = setInterval(update, 30000);
        return () => clearInterval(t);
    }, [clockIn]);
    return <span>{duration}</span>;
}

export default function TimeTrackingWidget({ currentEmployee }) {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    const { data: recentEntries = [] } = useQuery({
        queryKey: ['time-entries-widget', currentEmployee?.id],
        queryFn: () => base44.entities.TimeEntry.filter(
            { employee_id: currentEmployee.id },
            '-date',
            10
        ),
        enabled: !!currentEmployee?.id,
        staleTime: STALE.MEDIUM,
    });

    const { data: activeClockEntry } = useQuery({
        queryKey: ['clock-entry-active', currentEmployee?.id],
        queryFn: async () => {
            const entries = await base44.entities.ClockEntry.filter(
                { employee_id: currentEmployee.id },
                '-clock_in',
                20
            );
            return entries.find(e => e.status === 'clocked_in' || e.status === 'on_break') || null;
        },
        enabled: !!currentEmployee?.id,
        refetchInterval: 60000,
        staleTime: 30000,
    });

    const last5 = recentEntries.slice(0, 5);

    const weekHours = recentEntries
        .filter(e => {
            try { const d = parseISO(e.date); return d >= weekStart && d <= weekEnd; } catch { return false; }
        })
        .reduce((sum, e) => sum + (e.total_hours || 0), 0);

    if (!currentEmployee) return null;

    return (
        <Card className="p-5 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    Meine Zeiterfassung
                </h3>
                <Link to={createPageUrl('TimeTracking')}>
                    <Button variant="outline" size="sm" className="border-border text-muted-foreground text-xs">
                        Alle anzeigen
                    </Button>
                </Link>
            </div>

            {/* Aktive Stempeluhr */}
            {activeClockEntry && (
                <div className="mb-4 p-3 rounded-lg bg-green-900/20 border border-green-700/30 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-300">
                            Eingestempelt seit {format(new Date(activeClockEntry.clock_in), 'HH:mm')} Uhr
                        </p>
                        <p className="text-xs text-green-400/70">
                            Laufzeit: <LiveClock clockIn={activeClockEntry.clock_in} />
                        </p>
                    </div>
                    {activeClockEntry.status === 'on_break' && (
                        <Badge className="bg-amber-900/50 text-amber-300 text-xs">Pause</Badge>
                    )}
                </div>
            )}

            {/* Diese Woche */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Diese Woche
                </span>
                <span className="text-sm font-bold text-amber-400">{weekHours.toFixed(1)}h</span>
            </div>

            {/* Letzte 5 Einträge */}
            {last5.length === 0 ? (
                <div className="text-center py-4">
                    <Clock className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">Noch keine Zeiteinträge</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {last5.map(entry => {
                        const cfg = statusConfig[entry.status] || statusConfig['entwurf'];
                        return (
                            <div key={entry.id} className="flex items-center justify-between gap-2 py-1.5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground font-medium">
                                        {format(parseISO(entry.date), 'EEE, dd.MM.', { locale: de })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {entry.start_time} – {entry.end_time}
                                        {entry.break_minutes > 0 && ` · ${entry.break_minutes}min Pause`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-sm font-semibold text-amber-400">
                                        {(entry.total_hours || 0).toFixed(1)}h
                                    </span>
                                    <Badge className={cn('text-[10px] px-1.5 py-0', cfg.color)}>
                                        {cfg.label}
                                    </Badge>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}