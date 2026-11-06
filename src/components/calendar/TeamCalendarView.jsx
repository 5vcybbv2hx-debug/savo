import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isWeekend } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function TeamCalendarView({ 
    shifts = [], 
    vacations = [], 
    holidays = [],
    employees = [],
    onEventClick,
    selectedEmployees = []
}) {
    const [currentDate, setCurrentDate] = useState(new Date());

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

    return (
        <div className="bg-card rounded-xl border border-border">
            {/* Header */}
            <div className="flex flex-col gap-3 p-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <h2 className="text-base md:text-lg font-semibold text-foreground flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 md:w-5 md:h-5 text-amber-400" />
                        <span className="hidden sm:inline">{format(currentDate, 'MMMM yyyy', { locale: de })}</span>
                        <span className="sm:hidden">{format(currentDate, 'MMM yyyy', { locale: de })}</span>
                    </h2>
                    <div className="flex gap-1.5 md:gap-2">
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
            </div>

            {/* Calendar Grid */}
            <div className="p-2 md:p-4">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-0.5 md:gap-2 mb-1 md:mb-2">
                    {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                        <div key={day} className="text-center text-[10px] md:text-xs font-medium text-muted-foreground py-1 md:py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-0.5 md:gap-2">
                    {days.map(day => {
                        const events = getEventsForDay(day);
                        const isToday = isSameDay(day, new Date());
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isWeekendDay = isWeekend(day);

                        return (
                            <div
                                key={day.toString()}
                                className={cn(
                                    "min-h-[60px] md:min-h-[100px] p-1 md:p-2 rounded md:rounded-lg border transition-all",
                                    isCurrentMonth ? "bg-background border-border" : "bg-background/50 border-border",
                                    isWeekendDay && "bg-card/50",
                                    isToday && "ring-1 md:ring-2 ring-amber-500"
                                )}
                            >
                                <div className={cn(
                                    "text-[10px] md:text-sm font-medium mb-1 md:mb-2 text-center md:text-left",
                                    isToday ? "text-amber-400" : isCurrentMonth ? "text-foreground" : "text-foreground0"
                                )}>
                                    {format(day, 'd')}
                                </div>

                                <div className="space-y-0.5 md:space-y-1">
                                    {/* Mobile: Show dots, Desktop: Show full events */}
                                    <div className="md:hidden flex flex-wrap gap-0.5 justify-center">
                                        {events.slice(0, 4).map((event, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => onEventClick?.(event)}
                                                className="w-1.5 h-1.5 rounded-full transition-transform hover:scale-150"
                                                style={{ backgroundColor: event.color }}
                                                title={event.label}
                                            />
                                        ))}
                                        {events.length > 4 && (
                                            <button
                                                onClick={() => onEventClick?.({ type: 'multiple', events, date: day })}
                                                className="w-1.5 h-1.5 rounded-full bg-slate-500"
                                                title={`+${events.length - 4} weitere`}
                                            />
                                        )}
                                    </div>

                                    {/* Desktop: Full event labels */}
                                    <div className="hidden md:block space-y-1">
                                        {events.slice(0, 3).map((event, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => onEventClick?.(event)}
                                                className={cn(
                                                    "w-full text-left px-2 py-1 rounded text-xs truncate transition-all hover:scale-105",
                                                    "text-foreground font-medium cursor-pointer"
                                                )}
                                                style={{ backgroundColor: event.color }}
                                                title={event.label}
                                            >
                                                {event.label}
                                            </button>
                                        ))}
                                        {events.length > 3 && (
                                            <button
                                                onClick={() => onEventClick?.({ type: 'multiple', events, date: day })}
                                                className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
                                            >
                                                +{events.length - 3} weitere
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center md:justify-start gap-3 md:gap-4 p-3 md:p-4 border-t border-border text-[10px] md:text-xs">
                <div className="flex items-center gap-1.5 md:gap-2">
                    <div className="w-2 h-2 md:w-3 md:h-3 rounded" style={{ backgroundColor: '#64748b' }}></div>
                    <span className="text-muted-foreground">Schicht</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                    <div className="w-2 h-2 md:w-3 md:h-3 rounded bg-purple-600"></div>
                    <span className="text-muted-foreground">Urlaub</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                    <div className="w-2 h-2 md:w-3 md:h-3 rounded bg-red-600"></div>
                    <span className="text-muted-foreground">Feiertag</span>
                </div>
            </div>
        </div>
    );
}