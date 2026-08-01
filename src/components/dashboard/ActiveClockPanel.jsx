/**
 * ActiveClockPanel — Zeigt alle aktuell eingestempelten Mitarbeiter
 * auf dem persönlichen Dashboard. Sichtbar für alle User.
 */
import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, Coffee, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { STALE } from '@/lib/queryUtils';
import { isActiveEntry, formatDuration, calcWorkMinutes } from '@/lib/nightUtils';

export default function ActiveClockPanel({ currentEmployee, employees = [] }) {
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: clockEntries = [] } = useQuery({
        queryKey: ['clock-entries-active-team'],
        queryFn: () => base44.entities.ClockEntry.list('-clock_in', 200),
        refetchInterval: 30000,
        staleTime: 20000,
    });

    const activeEntries = useMemo(() => {
        const todayStart = new Date(today + 'T00:00:00');
        return clockEntries
            .filter(e => isActiveEntry(e) && new Date(e.clock_in) >= todayStart)
            .sort((a, b) => new Date(a.clock_in) - new Date(b.clock_in));
    }, [clockEntries, today]);

    if (activeEntries.length === 0) return null;

    const now = new Date();

    return (
        <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <Users className="w-4 h-4 text-green-400" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                        {activeEntries.length} {activeEntries.length === 1 ? 'Person' : 'Personen'} eingestempelt
                    </p>
                </div>

                <div className="space-y-1.5">
                    {activeEntries.map(entry => {
                        const isMe = entry.employee_id === currentEmployee?.id;
                        const emp = employees.find(e => e.id === entry.employee_id);
                        const isOnBreak = entry.status === 'on_break';
                        const elapsed = formatDuration(calcWorkMinutes(entry.clock_in, now));

                        return (
                            <div
                                key={entry.id}
                                className={cn(
                                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors',
                                    isMe ? 'bg-primary/10 border border-primary/20' : 'bg-card/50'
                                )}
                            >
                                <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                    style={{ backgroundColor: emp?.color || entry.color || '#64748b' }}
                                >
                                    {entry.employee_name?.charAt(0) || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-medium text-foreground truncate">
                                            {entry.employee_name}
                                        </p>
                                        {isMe && (
                                            <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1 py-0.5 rounded">
                                                Du
                                            </span>
                                        )}
                                        {isOnBreak && (
                                            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">
                                                <Coffee className="w-2.5 h-2.5" />
                                                Pause
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <Clock className="w-2.5 h-2.5" />
                                        {format(new Date(entry.clock_in), 'HH:mm')}
                                        <span>·</span>
                                        <span className={cn(isOnBreak && 'text-amber-400')}>
                                            {isOnBreak ? 'Pause' : elapsed}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
