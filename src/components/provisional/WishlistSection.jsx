import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Hourglass, CheckCircle2, XCircle, CalendarDays, Clock, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { capacityFor, usageFor } from '@/lib/wishShiftCapacity';

function formatDate(dateStr) {
    return format(parseISO(dateStr), 'EEEE, dd.MM.', { locale: de });
}

/**
 * Abschnitt "Warteliste" im Prüf-Panel — sortiert nach Position, mit Hinweisen
 * auf frei gewordene Plätze. Keine automatische Beförderung: der Manager
 * bestätigt selbst.
 */
export default function WishlistSection({ entries = [], usageMap = {}, shiftTypes = [], onConfirm, onReject, isProcessing = false }) {
    if (entries.length === 0) return null;

    const sorted = [...entries].sort((a, b) =>
        String(a.date).localeCompare(String(b.date))
        || String(a.shift_type || '').localeCompare(String(b.shift_type || ''))
        || String(a.created_date || '').localeCompare(String(b.created_date || ''))
    );

    // Frei gewordene Plätze: weniger belegt als Kapazität, obwohl jemand wartet
    const hints = [];
    const seen = new Set();
    sorted.forEach(req => {
        const key = `${req.date}|${req.shift_type}`;
        if (seen.has(key)) return;
        seen.add(key);
        const usage = usageFor(usageMap, req.date, req.shift_type);
        const capacity = capacityFor(shiftTypes.find(t => t.name === req.shift_type));
        if (usage.taken < capacity) {
            hints.push({
                key,
                date: req.date,
                shift_type: req.shift_type,
                start_time: req.start_time,
                end_time: req.end_time,
                taken: usage.taken,
                capacity,
                waiting: usage.waitlist.length,
            });
        }
    });

    return (
        <div className="space-y-3">
            {hints.length > 0 && (
                <div className="space-y-2">
                    {hints.map(hint => (
                        <div key={`hint-${hint.key}`} className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-amber-300">
                                    Platz frei bei {hint.start_time} – {hint.waiting} auf der Warteliste
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {formatDate(hint.date)} · {hint.shift_type} · {hint.taken}/{hint.capacity} belegt · bitte selbst bestätigen
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-2 px-1">
                <Hourglass className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-amber-400">Warteliste</span>
                <span className="text-xs text-muted-foreground">({sorted.length})</span>
            </div>

            <div className="space-y-2.5">
                {sorted.map(req => {
                    const usage = usageFor(usageMap, req.date, req.shift_type);
                    const position = usage.waitlist.findIndex(w => w.id === req.id) + 1;

                    return (
                        <div
                            key={req.id}
                            className="rounded-2xl border border-dashed border-amber-500/50 bg-card/60 p-4"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-dashed border-amber-500/60 flex items-center justify-center font-bold text-amber-300 shrink-0">
                                    {position > 0 ? position : 'W'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-foreground text-base">{req.employee_name}</span>
                                        <Badge className="text-xs border px-2 bg-amber-500/15 text-amber-300 border-amber-500/40">
                                            Warteliste{position > 0 ? ` · Platz ${position}` : ''}
                                        </Badge>
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
                                    {req.comment && (
                                        <p className="text-xs text-muted-foreground mt-1.5 italic bg-secondary/50 rounded-lg px-2.5 py-1.5">
                                            „{req.comment}"
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className={cn('grid grid-cols-2 gap-2 mt-3')}>
                                <Button
                                    size="sm"
                                    disabled={isProcessing}
                                    onClick={() => onReject(req)}
                                    className="h-11 gap-1.5 text-sm font-medium bg-red-600/80 hover:bg-red-600 text-white"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Ablehnen
                                </Button>
                                <Button
                                    size="sm"
                                    disabled={isProcessing}
                                    onClick={() => onConfirm(req)}
                                    className="h-11 gap-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Bestätigen
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}