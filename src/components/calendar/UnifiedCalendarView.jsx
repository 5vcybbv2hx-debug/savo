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
import { haptics } from '@/components/utils/haptics';
import { isWishWeekday } from '@/lib/wishShiftRules';
import WishlistChip from '@/components/calendar/WishlistChip';
import WishCapacityBadge from '@/components/calendar/WishCapacityBadge';
import { buildWishUsage, capacityFor, usageFor, waitlistPosition } from '@/lib/wishShiftCapacity';

// Farben der eigenen Wunschschichten im Kalender
const WISH_STYLES = {
    ausstehend: 'bg-status-warn/15 border-status-warn/40 text-status-warn/25',
    bestätigt: 'bg-status-ok/15 border-status-ok/40 text-status-ok/25',
    abgelehnt: 'bg-primary/10 border-primary/20 text-primary/60 line-through',
    warteliste: 'bg-status-warn/5 border-dashed border-status-warn/60 text-status-warn/25',
};

const EVENT_STYLES = {
    shift: {
        bg: 'bg-status-warn/20 border-l-2 border-status-warn/70 hover:bg-status-warn/30',
        dot: 'bg-status-warn/70',
        text: 'text-status-warn/25',
    },
    vacation: {
        bg: 'bg-status-ok/20 border-l-2 border-status-ok/70 hover:bg-status-ok/30',
        dot: 'bg-status-ok/70',
        text: 'text-status-ok/25',
    },
    holiday: {
        bg: 'bg-primary/20 border-l-2 border-primary hover:bg-primary/30',
        dot: 'bg-primary',
        text: 'text-primary',
    },
    maintenance: {
        bg: 'bg-primary/20 border-l-2 border-primary/70 hover:bg-primary/30',
        dot: 'bg-primary/70',
        text: 'text-primary/25',
    },
    event: {
        bg: 'bg-primary/20 border-l-2 border-primary hover:bg-primary/30',
        dot: 'bg-primary',
        text: 'text-primary',
    },
    birthday: {
        bg: 'bg-primary/20 border-l-2 border-primary hover:bg-primary/30',
        dot: 'bg-primary',
        text: 'text-primary',
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
    onNavigate = null,
    myWishes = [],
    wishMode = false,
    onWishClick = () => {},
    wishRange = null,
    // Manager-Sicht: alle Wünsche des Zeitraums (Warteliste + Auslastung)
    wishRequests = [],
    shiftTypes = [],
    // Betriebskalender-Tage (geschlossene Tage sperren Wunschschichten)
    businessDays = []
}) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showFilterModal, setShowFilterModal] = useState(false);

    const wishUsage = useMemo(() => buildWishUsage(wishRequests), [wishRequests]);

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
                    className={cn('gap-2', activeFilters > 0 && 'bg-status-warn/70 hover:bg-status-warn/70 border-status-warn/70')}
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
                        <Badge key={role} className="bg-status-warn/20 text-status-warn/25 border-status-warn/40 gap-1 pr-1">
                            {role}
                            <button onClick={() => onRoleToggle(selectedRoles.filter(r => r !== role))} className="hover:opacity-70 ml-1">
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    ))}
                    {selectedEmployees.map(empId => {
                        const emp = employees.find(e => e.id === empId);
                        return emp ? (
                            <Badge key={empId} className="bg-primary/20 text-primary/25 border-primary/40 gap-1 pr-1">
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
                        const dayStr = format(day, 'yyyy-MM-dd');
                        const dayWishes = myWishes.filter(w => w.date === dayStr);
                        const dayWaitlist = wishRequests.filter(w => w.date === dayStr && w.status === 'warteliste');
                        const dayCapacity = shiftTypes
                            .filter(t => typeof t.wish_capacity === 'number' && t.wish_capacity > 0)
                            .map(t => {
                                const usage = usageFor(wishUsage, dayStr, t.name);
                                return {
                                    name: t.name,
                                    label: t.start_time ? t.start_time.slice(0, 5) : t.name,
                                    taken: usage.taken,
                                    capacity: capacityFor(t),
                                    waiting: usage.waitlist.length,
                                };
                            })
                            .filter(row => row.taken > 0 || row.waiting > 0);
                        // Wunsch-Modus: nur Tage ab heute innerhalb des Eingabefensters,
                        // und nur an Tagen mit Wunschschicht-Regel (Di–Sa)
                        const inWishRange = wishMode && wishRange?.start && wishRange?.end
                            && dayStr >= wishRange.start && dayStr <= wishRange.end
                            && dayStr >= format(new Date(), 'yyyy-MM-dd')
                            && isWishWeekday(day, businessDays);

                        return (
                            <div
                                key={day.toISOString()}
                                onClick={() => {
                                    if (!isCurrentMonth) return;
                                    if (inWishRange) haptics.light();
                                    onDayClick(day);
                                }}
                                className={cn(
                                    'relative border-r border-b border-border/50 last:border-r-0 transition-colors group',
                                    'min-h-[120px] md:min-h-[130px] p-2',
                                    !isCurrentMonth && 'bg-muted/10 opacity-40',
                                    isWeekendDay && isCurrentMonth && 'bg-secondary/30',
                                    isToday && 'bg-status-warn/5',
                                    isCurrentMonth && 'cursor-pointer hover:bg-accent/30',
                                    inWishRange && 'hover:bg-primary/10',
                                )}
                            >
                                {/* Day Number */}
                                <div className={cn(
                                    'flex items-center justify-center w-8 h-8 md:w-7 md:h-7 rounded-full text-sm font-bold mb-2 transition-all',
                                    isToday
                                        ? 'bg-status-warn/70 text-foreground'
                                        : 'text-foreground group-hover:bg-accent/50'
                                )}>
                                    {format(day, 'd')}
                                </div>

                                {/* Eigene Wunschschichten */}
                                {dayWishes.length > 0 && (
                                    <div className="space-y-0.5 mb-1">
                                        {dayWishes.slice(0, 2).map(wish => (
                                            <div
                                                key={wish.id}
                                                title={`${wish.start_time} – ${wish.end_time}${wish.shift_type ? ` · ${wish.shift_type}` : ''}`}
                                                onClick={e => { e.stopPropagation(); onWishClick(wish); }}
                                                className={cn(
                                                    'text-[10px] px-1 py-0.5 rounded border truncate cursor-pointer',
                                                    WISH_STYLES[wish.status] || WISH_STYLES.ausstehend
                                                )}
                                            >
                                                {wish.status === 'warteliste' ? 'W ' : ''}{wish.start_time}–{wish.end_time}
                                            </div>
                                        ))}
                                        {dayWishes.length > 2 && (
                                            <div className="text-[10px] text-muted-foreground pl-1 font-medium">
                                                +{dayWishes.length - 2}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Warteliste (gestrichelt + W) */}
                                {dayWaitlist.length > 0 && (
                                    <div className="space-y-0.5 mb-1">
                                        {dayWaitlist.slice(0, 2).map(wish => (
                                            <WishlistChip
                                                key={wish.id}
                                                wish={wish}
                                                position={waitlistPosition(wishUsage, wish)}
                                            />
                                        ))}
                                        {dayWaitlist.length > 2 && (
                                            <div className="text-[10px] text-status-warn/80 pl-1 font-medium">
                                                +{dayWaitlist.length - 2} auf Warteliste
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Auslastung der Wunschplätze */}
                                {dayCapacity.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-1">
                                        {dayCapacity.map(row => (
                                            <WishCapacityBadge
                                                key={row.name}
                                                label={row.label}
                                                taken={row.taken}
                                                capacity={row.capacity}
                                            />
                                        ))}
                                    </div>
                                )}

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
                    <div className="w-3 h-3 rounded-sm bg-status-warn/30 border-l-2 border-status-warn/70" />
                    Schicht
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-status-ok/30 border-l-2 border-status-ok/70" />
                    Urlaub
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-primary/30 border-l-2 border-primary" />
                    Feiertag
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-primary/30 border-l-2 border-primary/70" />
                    Wartung
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-primary/30 border-l-2 border-primary" />
                    Event
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-primary/30 border-l-2 border-primary" />
                    Geburtstag
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm border border-dashed border-status-warn/70 text-[8px] font-bold text-status-warn/25 flex items-center justify-center">
                        W
                    </div>
                    Warteliste
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