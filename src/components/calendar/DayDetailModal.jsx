import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Umbrella, Star, CalendarCheck, Calendar, AlertCircle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

function Section({ icon: Icon, title, color, children }) {
    return (
        <div>
            <div className={cn('flex items-center gap-2 text-sm font-semibold mb-2', color)}>
                <Icon className="w-4 h-4" />
                {title}
            </div>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

    if (!day) return null;

    const dayStr = format(day, 'yyyy-MM-dd');

    const dayShifts = shifts
        .filter(s => s.date === dayStr)
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

    const dayVacations = vacations.filter(v => {
        const start = new Date(v.start_date);
        const end = new Date(v.end_date);
        return day >= start && day <= end;
    });

    const dayHolidays = holidays.filter(h => h.date === dayStr);

    const dayReservations = reservations
        .filter(r => r.date === dayStr && r.status !== 'storniert')
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    const dayEvents = events.filter(e => e.date === dayStr);

    const hasNothing = dayShifts.length === 0 && dayVacations.length === 0 && dayHolidays.length === 0 && dayReservations.length === 0 && dayEvents.length === 0;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="capitalize text-lg">
                        {format(day, "EEEE, d. MMMM yyyy", { locale: de })}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-2">
                    {/* WM-Spiele */}

                    {/* Feiertage */}
                    {dayHolidays.length > 0 && (
                        <Section icon={Star} title="Feiertage" color="text-rose-400">
                            {dayHolidays.map(h => (
                                <div key={h.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm">
                                    <Star className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                                    <span className="font-medium text-rose-300">{h.name}</span>
                                </div>
                            ))}
                        </Section>
                    )}

                    {/* Events */}
                    {dayEvents.length > 0 && (
                        <Section icon={Calendar} title="Events" color="text-purple-400">
                            {dayEvents.map(ev => (
                                <div key={ev.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm">
                                    <Calendar className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-semibold text-purple-300">{ev.title}</p>
                                        {ev.start_time && <p className="text-xs text-muted-foreground">{ev.start_time} Uhr</p>}
                                        {ev.event_type && <Badge variant="outline" className="text-[10px] mt-1">{ev.event_type}</Badge>}
                                    </div>
                                </div>
                            ))}
                        </Section>
                    )}

                    {/* Schichten */}
                    {dayShifts.length > 0 && (
                        <Section icon={Clock} title={`Schichten (${dayShifts.length})`} color="text-amber-400">
                            {dayShifts.map(shift => {
                                const emp = employees.find(e => e.id === shift.employee_id);
                                return (
                                    <div key={shift.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                                            style={{ backgroundColor: emp?.color || '#64748b' }}
                                        >
                                            {shift.employee_name?.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold">{shift.employee_name}</p>
                                            <p className="text-xs text-muted-foreground font-mono">{shift.start_time} – {shift.end_time}</p>
                                            {shift.shift_type && (
                                                <Badge className="text-[10px] mt-0.5 bg-amber-600/20 text-amber-400 border-amber-600/30">{shift.shift_type}</Badge>
                                            )}
                                            {shift.notes && <p className="text-xs text-muted-foreground italic mt-1 truncate">{shift.notes}</p>}
                                        </div>
                                        {onShiftSwap && (
                                            <button
                                                onClick={() => { onShiftSwap(shift); onClose(); }}
                                                className="text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 px-2 py-1 rounded-md hover:bg-amber-500/10 transition-colors"
                                            >
                                                Tausch
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </Section>
                    )}

                    {/* Urlaube */}
                    {dayVacations.length > 0 && (
                        <Section icon={Umbrella} title={`Urlaub (${dayVacations.length})`} color="text-emerald-400">
                            {dayVacations.map(v => (
                                <div key={v.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center flex-shrink-0">
                                        <Umbrella className="w-4 h-4 text-emerald-300" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">{v.employee_name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(v.start_date), 'd. MMM', { locale: de })} – {format(new Date(v.end_date), 'd. MMM yyyy', { locale: de })}
                                        </p>
                                        {v.vacation_type && <Badge variant="outline" className="text-[10px] mt-0.5">{v.vacation_type}</Badge>}
                                    </div>
                                </div>
                            ))}
                        </Section>
                    )}

                    {/* Reservierungen */}
                    {dayReservations.length > 0 && (
                        <Section icon={CalendarCheck} title={`Reservierungen (${dayReservations.length})`} color="text-blue-400">
                            {dayReservations.map(r => (
                                <div key={r.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                    <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-blue-300" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold">{r.customer_name}</p>
                                        <div className="flex flex-wrap gap-2 mt-0.5">
                                            {r.time && <span className="text-xs text-muted-foreground">{r.time} Uhr</span>}
                                            {r.guests && <span className="text-xs text-muted-foreground">· {r.guests} Personen</span>}
                                            {r.table && <span className="text-xs text-muted-foreground">· Tisch {r.table}</span>}
                                        </div>
                                        {r.notes && <p className="text-xs text-muted-foreground italic mt-1 truncate">{r.notes}</p>}
                                        <Badge className={cn("text-[10px] mt-1", r.status === 'bestätigt' ? 'bg-green-600/20 text-green-400 border-green-600/30' : 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30')}>
                                            {r.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </Section>
                    )}

                    {hasNothing && (
                        <div className="text-center py-10 text-muted-foreground">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Keine Einträge für diesen Tag</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}