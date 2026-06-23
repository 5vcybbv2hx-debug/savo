import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, parseISO, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, LogIn, LogOut, Timer } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';

const statusColors = {
    entwurf: 'bg-slate-600 text-slate-200',
    eingereicht: 'bg-blue-600 text-white',
    genehmigt: 'bg-green-600 text-white',
};

function LiveClock({ clockIn }) {
    const [elapsed, setElapsed] = useState('');

    useEffect(() => {
        const update = () => {
            const mins = differenceInMinutes(new Date(), new Date(clockIn));
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            setElapsed(`${h}h ${m}m`);
        };
        update();
        const t = setInterval(update, 30000);
        return () => clearInterval(t);
    }, [clockIn]);

    return <span className="text-green-400 font-mono text-sm">{elapsed}</span>;
}

export default function MyTimeWidget() {
    const { data: currentEmployee } = useCurrentEmployee();

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    // Active clock entry
    const { data: clockEntries = [] } = useQuery({
        queryKey: ['clock-entries', currentEmployee?.id],
        queryFn: () => base44.entities.ClockEntry.filter({ employee_id: currentEmployee.id }, '-clock_in', 20),
        enabled: !!currentEmployee?.id,
        staleTime: 30000,
    });

    const activeEntry = clockEntries.find(e => e.status === 'clocked_in' || e.status === 'on_break');

    // Recent time entries
    const { data: timeEntries = [] } = useQuery({
        queryKey: ['time-entries-widget', currentEmployee?.id],
        queryFn: () => base44.entities.TimeEntry.filter({ employee_id: currentEmployee.id }, '-date', 20),
        enabled: !!currentEmployee?.id,
        staleTime: 2 * 60 * 1000,
    });

    const weekEntries = timeEntries.filter(e => {
        const d = parseISO(e.date);
        return d >= weekStart && d <= weekEnd;
    });
    const weekHours = weekEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
    const recentEntries = [...timeEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    if (!currentEmployee) return null;

    return (
        <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-foreground">Meine Zeiten diese Woche</h3>
                <span className="ml-auto text-xl font-bold text-amber-400">{weekHours.toFixed(1)}h</span>
            </div>

            {/* Live-Stempeluhr wenn aktiv */}
            {activeEntry && (
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-green-900/20 border border-green-700/30">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <LogIn className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-xs text-green-300">
                        Seit {format(new Date(activeEntry.clock_in), 'HH:mm')}
                    </span>
                    <Timer className="w-3.5 h-3.5 text-green-400 ml-auto" />
                    <LiveClock clockIn={activeEntry.clock_in} />
                </div>
            )}

            {/* Letzte 5 Einträge */}
            {recentEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Keine Einträge vorhanden</p>
            ) : (
                <div className="space-y-1.5">
                    {recentEntries.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground w-20 shrink-0">
                                {format(parseISO(entry.date), 'EE dd.MM.', { locale: de })}
                            </span>
                            <span className="text-foreground">
                                {entry.start_time}–{entry.end_time}
                            </span>
                            <span className="font-semibold text-amber-400 w-10 text-right">
                                {(entry.total_hours || 0).toFixed(1)}h
                            </span>
                            <Badge className={cn('text-[10px] px-1.5 py-0', statusColors[entry.status] || statusColors.entwurf)}>
                                {entry.status === 'genehmigt' ? '✓' : entry.status === 'eingereicht' ? '⏳' : '✏️'}
                            </Badge>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}