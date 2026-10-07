import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, isWeekend } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Filter, X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const EVENT_STYLES = {
    shift: {
        bg: 'bg-amber-500/20 border-l-2 border-amber-500 hover:bg-amber-500/30',
        dot: 'bg-amber-400',
        text: 'text-amber-200',
    },
    vacation: {
        bg: 'bg-emerald-500/20 border-l-2 border-emerald-500 hover:bg-emerald-500/30',
        dot: 'bg-emerald-400',
        text: 'text-emerald-200',
    },
    holiday: {
        bg: 'bg-rose-500/20 border-l-2 border-rose-500 hover:bg-rose-500/30',
        dot: 'bg-rose-400',
        text: 'text-rose-200',
    },
    maintenance: {
        bg: 'bg-blue-500/20 border-l-2 border-blue-500 hover:bg-blue-500/30',
        dot: 'bg-blue-400',
        text: 'text-blue-200',
    },
    event: {
        bg: 'bg-pink-500/20 border-l-2 border-pink-500 hover:bg-pink-500/30',
        dot: 'bg-pink-400',
        text: 'text-pink-200',
    },
    birthday: {
        bg: 'bg-purple-500/20 border-l-2 border-purple-500 hover:bg-purple-500/30',
        dot: 'bg-purple-400',
        text: 'text-purple-200',
    },
};

export default function UnifiedCalendarView({
    shifts = [],
    vacations = [],
    holidays = [],
    maintenanceTasks = [],
    employees = [],
    reservations = [],
    events = [],
    onEventClick = () => {},
    onDayClick = () => {},
    selectedEmployees = [],
    onEmployeeToggle = () => {},
    onRoleToggle = () => {},
    selectedRoles = [],
    searchQuery = '',
    onSearchChange = () => {},
    onNavigate = null
}) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showFilterModal, setShowFilterModal] = useState(false);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const getEventsForDay = (day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayEvents = [];

        shifts.forEach(shift => {
            if (shift.date === dayStr) {
                if (selectedEmployees.length === 0 || selectedEmployees.includes(shift.employee_id)) {
                    dayEvents.push({ type: 'shift', id: shift.id, data: shift });
                }
            }
        });

        vacations.forEach(vacation => {
            const vacStart = new Date(vacation.start_date);
            const vacEnd = new Date(vacation.end_date);
            if (day >= vacStart && day <= vacEnd) {
                if (selectedEmployees.length === 0 || selectedEmployees.includes(vacation.employee_id)) {
                    dayEvents.push({ type: 'vacation', id: vacation.id, data: vacation });
                }
            }
        });

        holidays.forEach(holiday => {
            if (holiday.date === dayStr) {
                dayEvents.push({ type: 'holiday', id: holiday.id, data: holiday });
            }
        });

        maintenanceTasks.forEach(task => {
            if (task.next_maintenance === dayStr) {
                dayEvents.push({ type: 'maintenance', id: task.id, data: task });
            }
        });

        // Events
        events.forEach(ev => {
            if (ev.date === dayStr) {
                dayEvents.push({ type: 'event', id: `event-${ev.id}`, data: ev });
            }
        });

        // Geburtstage: Monat+Tag vergleichen (unabhängig vom Jahr)
        // Format: "YYYY-MM-DD" → "MM-DD"
        const dayMD = format(day, 'MM-dd');
        employees.forEach(emp => {
            if (emp.birthday && emp.birthday.length >= 10) {
                try {
                    const bMD = emp.birthday.slice(5, 10); // "YYYY-MM-DD" → "MM-DD"
                    if (bMD === dayMD) {
                        dayEvents.push({ type: 'birthday', id: `birthday-${emp.id}`, data: emp });
                    }
                } catch (e) {
                    // Ungültiges Datumsformat ignorieren
                }
            }
        });

        return dayEvents;
    };

    const availableRoles = useMemo(() => {
        return [...new Set(employees.map(e => e.role))].filter(Boolean);
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(emp.role);
            return matchesSearch && matchesRole;
        });
    }, [employees, searchQuery, selectedRoles]);

    const activeFilters = selectedEmployees.length + selectedRoles.length;

    const prevMonth = () => { const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1); setCurrentDate(d); if (onNavigate) onNavigate(d); };
    const nextMonth = () => { const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1); setCurrentDate(d); if (onNavigate) onNavigate(d); };
    const goToToday = () => { const d = new Date(); setCurrentDate(d); if (onNavigate) onNavigate(d); };

    return (
        <div className="w-full space-y-4">
            {/* Header Bar */}
            <div className="flex items-center justify-between gap-3">
                {/* Month Navigation */}
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={prevMonth} className="h-9 w-9">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="min-w-[160px] text-center">
                        <h2 className="text-lg font-bold text-foreground capitalize">
                            {format(currentDate, 'MMMM yyyy', { locale: de })}
                        </h2>
                    </div>
                    <Button variant="outline" size="icon" onClick={nextMonth} className="h-9 w-9">
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs text-muted-foreground hidden sm:block">
                        Heute
                    </Button>
                </div>

                {/* Filter Button */}
                <Button
                    variant={activeFilters > 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowFilterModal(true)}
                    className={cn('gap-2', activeFilters > 0 && 'bg-amber-600 hover:bg-amber-700 border-amber-600')}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filter
                    {activeFilters > 0 && (
                        <span className="bg-white/20 text-foreground text-xs px-1.5 py-0.5 rounded-full">{activeFilters}</span>
                    )}
                </Button>
            </div>

            {/* Active Filter Chips */}
            {activeFilters > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedRoles.map(role => (
                        <Badge key={role} className="bg-amber-600/20 text-amber-300 border-amber-600/40 gap-1 pr-1">
                            {role}
                            <button onClick={() => onRoleToggle(selectedRoles.filter(r => r !== role))} className="hover:opacity-70 ml-1">
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    ))}
                    {selectedEmployees.map(empId => {
                        const emp = employees.find(e => e.id === empId);
                        return emp ? (
                            <Badge key={empId} className="bg-blue-600/20 text-blue-300 border-blue-600/40 gap-1 pr-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: emp.color || '#64748b' }} />
                                {emp.name}
                                <button onClick={() => onEmployeeToggle(selectedEmployees.filter(id => id !== empId))} className="hover:opacity-70 ml-1">
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        ) : null;
                    })}
                    <button onClick={() => { onEmployeeToggle([]); onRoleToggle([]); }} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                        Alle zurücksetzen
                    </button>
                </div>
            )}

            {/* Calendar Grid */}
            <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 bg-secondary/80">
                    {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day, i) => (
                        <div
                            key={day}
                            className={cn(
                                'py-3 md:py-3 text-center text-[11px] md:text-xs font-semibold uppercase tracking-wider border-r border-border/50 last:border-r-0',
                                i >= 5 ? 'text-muted-foreground/60' : 'text-muted-foreground'
                            )}
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7">
                    {days.map((day, idx) => {
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const isToday = isSameDay(day, new Date());
                        const isWeekendDay = isWeekend(day);
                        const dayEvents = getEventsForDay(day);
                        const MAX_VISIBLE = 3;

                        return (
                            <div
                                key={day.toISOString()}
                                onClick={() => isCurrentMonth && onDayClick(day)}
                                className={cn(
                                    'relative border-r border-b border-border/50 last:border-r-0 transition-colors group',
                                    'min-h-[120px] md:min-h-[130px] p-2',
                                    !isCurrentMonth && 'bg-muted/10 opacity-40',
                                    isWeekendDay && isCurrentMonth && 'bg-secondary/30',
                                    isToday && 'bg-amber-500/5',
                                    isCurrentMonth && 'cursor-pointer hover:bg-accent/30',
                                )}
                            >
                                {/* Day Number */}
                                <div className={cn(
                                    'flex items-center justify-center w-8 h-8 md:w-7 md:h-7 rounded-full text-sm font-bold mb-2 transition-all',
                                    isToday
                                        ? 'bg-amber-500 text-foreground'
                                        : 'text-foreground group-hover:bg-accent/50'
                                )}>
                                    {format(day, 'd')}
                                </div>

                                {/* Events */}
                                <div className="space-y-1">
                                    {dayEvents.slice(0, MAX_VISIBLE).map(event => {
                                        const style = EVENT_STYLES[event.type];
                                        const label = event.type === 'shift'
                                            ? event.data.employee_name
                                            : event.type === 'vacation'
                                            ? `🏖 ${event.data.employee_name}`
                                            : event.type === 'maintenance'
                                            ? `🔧 ${event.data.equipment_name}`
                                            : event.type === 'birthday'
                                            ? `🎂 ${event.data.name}`
                                            : event.type === 'event'
                                            ? `🎉 ${event.data.title}`
                                            : event.data.name;

                                        return (
                                            <div
                                                key={event.id}
                                                onClick={() => onEventClick(event)}
                                                title={label}
                                                className={cn(
                                                    'text-[10px] md:text-xs px-1.5 py-0.5 rounded cursor-pointer truncate transition-all',
                                                    style.bg, style.text
                                                )}
                                            >
                                                {label}
                                            </div>
                                        );
                                    })}
                                    {dayEvents.length > MAX_VISIBLE && (
                                        <div className="text-[10px] text-muted-foreground pl-1 font-medium">
                                            +{dayEvents.length - MAX_VISIBLE} weitere
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 pt-1 pl-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-amber-500/30 border-l-2 border-amber-500" />
                    Schicht
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500/30 border-l-2 border-emerald-500" />
                    Urlaub
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-rose-500/30 border-l-2 border-rose-500" />
                    Feiertag
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-blue-500/30 border-l-2 border-blue-500" />
                    Wartung
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-pink-500/30 border-l-2 border-pink-500" />
                    Event
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-purple-500/30 border-l-2 border-purple-500" />
                    Geburtstag
                </div>
            </div>

            {/* Filter Modal */}
            <Dialog open={showFilterModal} onOpenChange={setShowFilterModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <SlidersHorizontal className="w-4 h-4" />
                                Filter
                            </span>
                            {activeFilters > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => { onEmployeeToggle([]); onRoleToggle([]); onSearchChange(''); }}>
                                    <X className="w-4 h-4 mr-1" /> Zurücksetzen
                                </Button>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 pt-2">
                        {/* Role Filter */}
                        {availableRoles.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Nach Rolle</h4>
                                <div className="space-y-2">
                                    {availableRoles.map(role => (
                                        <div key={role} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                                            <Checkbox
                                                id={`role-${role}`}
                                                checked={selectedRoles.includes(role)}
                                                onCheckedChange={() => {
                                                    const newRoles = selectedRoles.includes(role)
                                                        ? selectedRoles.filter(r => r !== role)
                                                        : [...selectedRoles, role];
                                                    onRoleToggle(newRoles);
                                                }}
                                            />
                                            <label htmlFor={`role-${role}`} className="text-sm cursor-pointer flex-1">{role}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Employee Filter */}
                        <div>
                            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Nach Mitarbeiter</h4>
                            <Input
                                placeholder="Suchen..."
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="mb-3"
                            />
                            <div className="max-h-[240px] overflow-y-auto space-y-1 pr-1">
                                {filteredEmployees.map(emp => (
                                    <div key={emp.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                                        <Checkbox
                                            id={`emp-${emp.id}`}
                                            checked={selectedEmployees.includes(emp.id)}
                                            onCheckedChange={() => {
                                                const newEmployees = selectedEmployees.includes(emp.id)
                                                    ? selectedEmployees.filter(id => id !== emp.id)
                                                    : [...selectedEmployees, emp.id];
                                                onEmployeeToggle(newEmployees);
                                            }}
                                        />
                                        <label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer flex items-center gap-2 flex-1">
                                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: emp.color || '#64748b' }} />
                                            <span className="flex-1">{emp.name}</span>
                                            <Badge variant="outline" className="text-xs">{emp.role}</Badge>
                                        </label>
                                    </div>
                                ))}
                                {filteredEmployees.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">Keine Mitarbeiter gefunden</p>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}