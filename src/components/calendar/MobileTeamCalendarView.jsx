import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isWeekend } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import WishCapacityBadge from '@/components/calendar/WishCapacityBadge';
import { buildWishUsage, capacityFor, usageFor } from '@/lib/wishShiftCapacity';

export default function MobileTeamCalendarView({ 
    shifts = [], 
    vacations = [], 
    holidays = [],
    employees = [],
    onEventClick,
    selectedEmployees = [],
    // Wünsche des Zeitraums (Warteliste + Auslastung)
    wishes = [],
    shiftTypes = []
}) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState(null);

    const wishUsage = useMemo(() => buildWishUsage(wishes), [wishes]);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const getEventsForDay = (day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const events = [];

        // Schichten
        shifts
            .filter(shift => shift.date === dayStr)
            .filter(shift => selectedEmployees.length === 0 || selectedEmployees.includes(shift.employee_id))
            .forEach(shift => {
                const employee = employees.find(e => e.id === shift.employee_id);
                events.push({
                    type: 'shift',
                    data: shift,
                    employee: employee,
                    color: employee?.color || '#64748b',
                    label: `${shift.employee_name} (${shift.start_time}-${shift.end_time})`
                });
            });

        // Warteliste für Wunschschichten — gestrichelt, mit "W"
        wishes
            .filter(wish => wish.date === dayStr && wish.status === 'warteliste')
            .filter(wish => selectedEmployees.length === 0 || selectedEmployees.includes(wish.employee_id))
            .forEach(wish => {
                events.push({
                    type: 'warteliste',
                    data: wish,
                    color: '#f59e0b',
                    label: `W ${wish.employee_name} (${wish.start_time}-${wish.end_time})`
                });
            });

        // Urlaube
        vacations
            .filter(vacation => {
                const start = new Date(vacation.start_date);
                const end = new Date(vacation.end_date);
                return day >= start && day <= end;
            })
            .filter(vacation => selectedEmployees.length === 0 || selectedEmployees.includes(vacation.employee_id))
            .forEach(vacation => {
                events.push({
                    type: 'vacation',
                    data: vacation,
                    color: '#8b5cf6',
                    label: `🏖️ ${vacation.employee_name}`
                });
            });

        // Feiertage
        holidays
            .filter(holiday => isSameDay(holiday.date, day))
            .forEach(holiday => {
                events.push({
                    type: 'holiday',
                    data: holiday,
                    color: '#ef4444',
                    label: `🎉 ${holiday.name}`
                });
            });

        return events;
    };

    const dayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

    // Auslastung der Wunschplätze für den gewählten Tag
    const dayCapacity = selectedDay
        ? shiftTypes
            .filter(type => typeof type.wish_capacity === 'number' && type.wish_capacity > 0)
            .map(type => {
                const usage = usageFor(wishUsage, format(selectedDay, 'yyyy-MM-dd'), type.name);
                return {
                    name: type.name,
                    label: type.start_time ? type.start_time.slice(0, 5) : type.name,
                    taken: usage.taken,
                    capacity: capacityFor(type),
                    waiting: usage.waitlist.length,
                };
            })
            .filter(row => row.taken > 0 || row.waiting > 0)
        : [];

    return (
        <>
            {/* Calendar Grid */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-status-warn" />
                        {format(currentDate, 'MMMM yyyy', { locale: de })}
                    </h2>
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                            className="border-border/70 text-foreground/75 h-8 w-8 p-0"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentDate(new Date())}
                            className="border-border/70 text-foreground/75 h-8 px-2 text-xs"
                        >
                            Heute
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                            className="border-border/70 text-foreground/75 h-8 w-8 p-0"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-0 bg-background/50">
                    {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                        <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-0">
                    {days.map(day => {
                        const events = getEventsForDay(day);
                        const isToday = isSameDay(day, new Date());
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isWeekendDay = isWeekend(day);
                        const isSelected = selectedDay && isSameDay(day, selectedDay);

                        return (
                            <button
                                key={day.toString()}
                                onClick={() => setSelectedDay(day)}
                                className={cn(
                                    "aspect-square flex flex-col items-center justify-center p-2 border-b border-r border-border transition-all active:scale-95",
                                    "text-xs md:text-sm font-medium",
                                    isCurrentMonth ? "bg-background" : "bg-background/50",
                                    isWeekendDay && "bg-card/50",
                                    isToday && "ring-inset ring-2 ring-status-warn/70",
                                    isSelected && "ring-inset ring-2 ring-primary/70 bg-card",
                                    isToday && !isSelected ? "text-status-warn" : isCurrentMonth ? "text-foreground" : "text-foreground0"
                                )}
                            >
                                <div>{format(day, 'd')}</div>
                                {events.length > 0 && (
                                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                                        {events.slice(0, 3).map((event, idx) => (
                                            <div
                                                key={idx}
                                                className="w-1.5 h-1.5 rounded-full"
                                                style={{ backgroundColor: event.color }}
                                            />
                                        ))}
                                        {events.length > 3 && (
                                            <div className="w-1 h-1 rounded-full bg-secondary" />
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-3 p-3 border-t border-border text-xs bg-background/50">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded" style={{ backgroundColor: '#64748b' }}></div>
                        <span className="text-muted-foreground">Schicht</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded bg-primary"></div>
                        <span className="text-muted-foreground">Urlaub</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded bg-status-danger/70"></div>
                        <span className="text-muted-foreground">Feiertag</span>
                    </div>
                </div>
            </div>

            {/* Day Details Modal */}
            <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
                <DialogContent className="bg-card border-border max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">
                            {selectedDay && format(selectedDay, 'EEEE, d. MMMM yyyy', { locale: de })}
                        </DialogTitle>
                    </DialogHeader>

                    {dayCapacity.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {dayCapacity.map(row => (
                                <WishCapacityBadge
                                    key={row.name}
                                    label={`${row.name} ${row.label}`}
                                    taken={row.taken}
                                    capacity={row.capacity}
                                />
                            ))}
                        </div>
                    )}

                    {dayEvents.length > 0 ? (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                            {dayEvents.map((event, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        onEventClick?.(event);
                                        setSelectedDay(null);
                                    }}
                                    className={cn(
                                        'w-full p-4 rounded-lg text-left transition-all active:scale-95 hover:opacity-90',
                                        event.type === 'warteliste' && 'border border-dashed border-status-warn/70'
                                    )}
                                    style={event.type === 'warteliste'
                                        ? { backgroundColor: 'rgba(245, 158, 11, 0.08)' }
                                        : { backgroundColor: event.color + '20', borderLeft: `4px solid ${event.color}` }}
                                >
                                    <div className="font-semibold text-foreground">{event.label}</div>
                                    {event.type === 'shift' && (
                                        <div className="text-xs text-foreground/75 mt-1">
                                            {event.data.start_time} - {event.data.end_time}
                                        </div>
                                    )}
                                    {event.data.notes && (
                                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {event.data.notes}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center text-muted-foreground">
                            <p className="text-sm">Keine Einträge für diesen Tag</p>
                        </div>
                    )}

                    <Button
                        onClick={() => setSelectedDay(null)}
                        variant="outline"
                        className="w-full border-border/70 text-foreground/75"
                    >
                        Schließen
                    </Button>
                </DialogContent>
            </Dialog>
        </>
    );
}