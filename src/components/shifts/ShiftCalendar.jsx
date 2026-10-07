import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, isSameDay, isSameMonth, startOfDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Palmtree, CheckCircle2, XCircle, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getHolidaysBW, getHolidayName } from './getHolidays';
import { usePermissions } from '@/components/auth/usePermissions';

export default function ShiftCalendar({ shifts, allShifts, employees, requirements = [], vacationRequests = [], unavailabilityRequests = [], provisionalRequests = [], swapRequests = [], wcMatches = [], onAddShift, onSelectShift, onShiftMove, selectedDate, setSelectedDate, onNavigate }) {
    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState('week');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [draggedShift, setDraggedShift] = useState(null);
    const [provisionalPopup, setProvisionalPopup] = useState(null); // { req, x, y }
    const popupRef = useRef(null);

    // Close popup on outside click
    useEffect(() => {
        if (!provisionalPopup) return;
        const handler = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                setProvisionalPopup(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [provisionalPopup]);

    const provisionalMutation = useMutation({
        mutationFn: async ({ req, action }) => {
            if (action === 'bestätigt') {
                await base44.entities.Shift.create({
                    employee_id: req.employee_id,
                    employee_name: req.employee_name,
                    date: req.date,
                    start_time: req.start_time,
                    end_time: req.end_time,
                    shift_type: req.shift_type,
                    notes: 'Selbsteinplanung bestätigt',
                });
            }
            return base44.entities.ProvisionalShiftRequest.update(req.id, {
                status: action,
                reviewed_by: 'Manager',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['provisional-shift-requests']);
            queryClient.invalidateQueries(['all-provisional-requests']);
            queryClient.invalidateQueries(['shifts']);
            setProvisionalPopup(null);
        }
    });

    // Inform parent when navigation changes the visible month
    useEffect(() => {
        if (onNavigate) onNavigate(currentDate);
    }, [currentDate]);

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    
    // Feiertage für das aktuelle Jahr und das nächste Jahr laden
    const holidays = useMemo(() => {
        const year = currentDate.getFullYear();
        return [...getHolidaysBW(year), ...getHolidaysBW(year + 1)];
    }, [currentDate]);
    
    // Generate calendar days based on view mode
    const calendarDays = viewMode === 'week'
        ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
        : (() => {
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
            const calEnd = addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 6);
            
            const days = [];
            let day = calStart;
            while (day <= calEnd) {
                days.push(day);
                day = addDays(day, 1);
            }
            return days;
        })();
    
    // Birthday check: compare MM-dd
    const getBirthdaysForDay = (date) => {
        const mmdd = format(date, 'MM-dd');
        return employees.filter(emp => {
            if (!emp.birthday) return false;
            try { return format(parseISO(emp.birthday), 'MM-dd') === mmdd; } catch { return false; }
        });
    };

    const getUnavailableForDay = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return unavailabilityRequests.filter(r =>
            r.status !== 'abgelehnt' &&
            dateStr >= r.date &&
            dateStr <= (r.end_date || r.date)
        );
    };

    const getShiftsForDay = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return shifts
            .filter(shift => shift.date === dateStr)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
    };
    
    const getEmployeeColor = (employeeId) => {
        const employee = employees.find(e => e.id === employeeId);
        return employee?.color || '#64748b';
    };

    const getEmployeeFullName = (employeeId, fallback) => {
        const byId = employees.find(e => e.id === employeeId);
        if (byId) return byId.name;
        // Fallback: match by short_name or name fragment (for old records)
        if (fallback) {
            const lower = fallback.toLowerCase().trim();
            const byShortName = employees.find(e => e.short_name?.toLowerCase().trim() === lower);
            if (byShortName) return byShortName.name;
            const byName = employees.find(e => e.name?.toLowerCase().includes(lower) || lower.includes(e.name?.split(' ')[0]?.toLowerCase()));
            if (byName) return byName.name;
        }
        return fallback;
    };

    const getProvisionalForDay = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return provisionalRequests.filter(r => r.date === dateStr);
    };

    const getDayRequirement = (date) => {
        const dayName = format(date, 'EEEE', { locale: de });
        const dayNameGerman = {
            'Monday': 'Montag',
            'Tuesday': 'Dienstag', 
            'Wednesday': 'Mittwoch',
            'Thursday': 'Donnerstag',
            'Friday': 'Freitag',
            'Saturday': 'Samstag',
            'Sunday': 'Sonntag'
        }[dayName] || dayName;
        
        const reqs = requirements.filter(r => r.day_of_week === dayNameGerman);
        if (reqs.length === 0) return null;
        
        const totalRequired = reqs.reduce((sum, r) => sum + r.required_employees, 0);
        return totalRequired;
    };

    const handleNavigation = (direction) => {
        const next = viewMode === 'week'
            ? addWeeks(currentDate, direction)
            : addMonths(currentDate, direction);
        setCurrentDate(next);
        if (onNavigate) onNavigate(next);
    };

    const handleDragStart = (e, shift) => {
        if (!permissions.canEditShifts) {
            e.preventDefault();
            return;
        }
        setDraggedShift(shift);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetDate) => {
        e.preventDefault();
        if (!permissions.canEditShifts) {
            setDraggedShift(null);
            return;
        }
        if (draggedShift && onShiftMove) {
            const currentDate = new Date(draggedShift.date);
            const newDate = startOfDay(targetDate);
            
            if (!isSameDay(currentDate, newDate)) {
                onShiftMove(draggedShift.id, newDate);
            }
        }
        setDraggedShift(null);
    };

    const handleDragEnd = () => {
        setDraggedShift(null);
    };

    return (
        <>
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 bg-background/50 border-b border-border">
                <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleNavigation(-1)}
                    className="hover:bg-secondary text-foreground/75"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3">
                    <h3 className="font-bold text-foreground text-base sm:text-lg">
                        {format(currentDate, 'MMMM yyyy', { locale: de })}
                    </h3>
                    <Button
                        variant={viewMode === 'week' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode(viewMode === 'week' ? 'month' : 'week')}
                        className={cn(
                            "text-xs h-7",
                            viewMode === 'week' && "bg-amber-600 hover:bg-amber-700"
                        )}
                    >
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {viewMode === 'week' ? 'Woche' : 'Monat'}
                    </Button>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleNavigation(1)}
                    className="hover:bg-secondary text-foreground/75"
                >
                    <ChevronRight className="w-5 h-5" />
                </Button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 px-3 py-2 bg-background/40 border-b border-border text-[10px]">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span className="text-muted-foreground">Bestätigt</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded border-2 border-dashed border-yellow-400 bg-yellow-400/20"></div>
                    <span className="text-muted-foreground">Vorläufig</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-secondary opacity-50"></div>
                    <span className="text-muted-foreground">Abgelehnt</span>
                </div>
                {wcMatches.length > 0 && <>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-green-600/80"></div>
                        <span className="text-muted-foreground">⚽ WM</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-orange-500/90"></div>
                        <span className="text-muted-foreground">⭐ Topspiel</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-yellow-400/90"></div>
                        <span className="text-muted-foreground">🇩🇪 Deutschland</span>
                    </div>
                </>}
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-border bg-background/30">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day, idx) => (
                    <div key={idx} className="py-2 text-center border-r border-border last:border-r-0">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{day}</span>
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-700">
                {calendarDays.map((day, idx) => {
                    const dayShifts = getShiftsForDay(day);
                    const dayProvisional = getProvisionalForDay(day);
                    const isToday = isSameDay(day, new Date());
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const required = getDayRequirement(day);
                    const understaffed = required && dayShifts.length < required;
                    const isCurrentMonth = viewMode === 'month' ? isSameMonth(day, currentDate) : true;
                    
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayVacations = vacationRequests.filter(v => 
                        v.status === 'genehmigt' &&
                        dateStr >= v.start_date && 
                        dateStr <= v.end_date
                    );
                    
                    const holidayName = getHolidayName(day, holidays);
                    const birthdays = getBirthdaysForDay(day);
                    const unavailables = getUnavailableForDay(day);
                    const dayWcMatches = wcMatches.filter(m => m.kickoff_time?.slice(0, 10) === dateStr);
                    const daySwapRequests = swapRequests.filter(r =>
                        r.shift_date === dateStr &&
                        (r.status === 'offen' || r.status === 'ausstehend')
                    );
                    
                    return (
                        <div 
                            key={idx} 
                            className={cn(
                                "relative group cursor-pointer transition-all",
                                viewMode === 'week' ? "min-h-[110px]" : "min-h-[80px]",
                                isToday && "bg-amber-500/5 ring-2 ring-inset ring-amber-500/30",
                                isSelected && "bg-amber-600/10 ring-2 ring-inset ring-amber-600",
                                understaffed && "bg-red-500/5",
                                !isCurrentMonth && "opacity-40 bg-background/30"
                            )}
                            onClick={() => setSelectedDate(day)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, day)}
                        >
                            {/* Day Number Badge */}
                            <div className="absolute top-1.5 right-1.5 z-10">
                                <div className={cn(
                                    "flex items-center gap-1 px-1.5 py-0.5 rounded-md",
                                    isToday ? "bg-amber-600 text-foreground" : "bg-background/50 text-foreground/75"
                                )}>
                                    <span className="text-sm font-bold">
                                        {format(day, 'd')}
                                    </span>
                                    {required && (
                                        <Badge 
                                            variant="outline" 
                                            className={cn(
                                                "text-[9px] px-1 h-3.5 border",
                                                understaffed 
                                                    ? "bg-red-500/10 border-red-500 text-red-400" 
                                                    : "bg-green-500/10 border-green-500 text-green-400"
                                            )}
                                        >
                                            {dayShifts.length}/{required}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            
                            {/* Geburtstag Indikator */}
                            {birthdays.length > 0 && (
                                <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-0.5">
                                    {birthdays.map(emp => (
                                        <div key={emp.id}
                                            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-500/80 text-foreground shadow-sm max-w-[90px]">
                                            <span className="text-[9px]">🎂</span>
                                            <span className="text-[9px] font-semibold truncate leading-tight">{emp.name.split(' ')[0]}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Feiertag Banner */}
                            {holidayName && (
                                <div className="absolute top-1.5 left-1.5 right-16 z-10">
                                    <div className="bg-red-600 text-foreground text-[9px] px-1.5 py-0.5 rounded font-semibold truncate shadow-sm">
                                        {holidayName}
                                    </div>
                                </div>
                            )}
                            
                            {/* WM-Spiele Badges */}
                            {dayWcMatches.length > 0 && (
                                <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-0.5 px-1 pb-1">
                                    {dayWcMatches.map(m => (
                                        <div key={m.id} className={cn(
                                            "text-[9px] font-semibold px-1.5 py-0.5 rounded truncate leading-tight",
                                            m.is_germany_game
                                                ? "bg-yellow-400/90 text-black"
                                                : m.is_top_game
                                                ? "bg-orange-500/90 text-foreground"
                                                : "bg-green-600/80 text-foreground"
                                        )}>
                                            {m.is_germany_game ? '🇩🇪' : m.is_top_game ? '⭐' : '⚽'} {m.home_team} – {m.away_team}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Content Area */}
                            <div className={`p-1.5 h-full flex flex-col gap-0.5 overflow-y-auto max-h-[400px] ${(holidayName || birthdays.length > 0) ? 'pt-9' : 'pt-8'} ${dayWcMatches.length > 0 ? 'pb-7' : ''}`}>
                                {/* Confirmed Shifts */}
                                {dayShifts.map((shift) => (
                                    <div
                                        key={shift.id}
                                        draggable={permissions.canEditShifts}
                                        onDragStart={(e) => handleDragStart(e, shift)}
                                        onDragEnd={handleDragEnd}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (permissions.canEditShifts) onSelectShift(shift);
                                        }}
                                        className={cn(
                                            "px-1.5 py-1 rounded text-[10px] font-medium transition-transform flex items-center gap-1 flex-shrink-0",
                                            permissions.canEditShifts ? "cursor-move hover:scale-105" : "cursor-default",
                                            draggedShift?.id === shift.id && "opacity-50 scale-95"
                                        )}
                                        style={{ backgroundColor: getEmployeeColor(shift.employee_id), color: '#fff' }}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] truncate font-semibold leading-tight">{getEmployeeFullName(shift.employee_id, shift.employee_name)}</p>
                                            <p className="text-[9px] opacity-80 leading-tight">{shift.start_time.slice(0,5)}-{shift.end_time.slice(0,5)}</p>
                                        </div>
                                        {shift.shift_type && (
                                            <Badge className="text-[8px] h-3.5 px-1 bg-white/20 border-0 text-foreground">{shift.shift_type.slice(0,3)}</Badge>
                                        )}
                                    </div>
                                ))}

                                {/* Provisional Shift Requests */}
                                {dayProvisional.map((req) => (
                                    <div
                                        key={req.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (permissions.isManager && req.status === 'ausstehend') {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setProvisionalPopup({ req, x: rect.left, y: rect.bottom + 4 });
                                            }
                                        }}
                                        className={cn(
                                            "px-1.5 py-1 rounded text-[10px] font-medium flex items-center gap-1 flex-shrink-0 border-2 border-dashed",
                                            permissions.isManager && req.status === 'ausstehend' ? 'cursor-pointer hover:brightness-125' : 'cursor-default',
                                            req.status === 'abgelehnt'
                                                ? "bg-secondary/40 border-border/50 text-muted-foreground opacity-60"
                                                : req.status === 'bestätigt'
                                                ? "bg-green-600/30 border-green-500 text-green-300"
                                                : "bg-yellow-500/15 border-yellow-400 text-yellow-300"
                                        )}
                                        title={permissions.isManager && req.status === 'ausstehend' ? 'Klicken zum Bestätigen/Ablehnen' : `${req.employee_name} – ${req.status}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] truncate font-semibold leading-tight">{getEmployeeFullName(req.employee_id, req.employee_name)}</p>
                                            <p className="text-[9px] opacity-80 leading-tight">{req.start_time?.slice(0,5)}-{req.end_time?.slice(0,5)}</p>
                                        </div>
                                        <span className="text-[8px] flex-shrink-0">
                                            {req.status === 'abgelehnt' ? '✗' : req.status === 'bestätigt' ? '✓' : '!'}
                                        </span>
                                    </div>
                                ))}

                                {/* Unavailability indicators */}
                                {unavailables.length > 0 && (
                                    <div className="px-1.5 py-0.5 bg-orange-500/15 border border-orange-500/30 rounded text-[9px] text-orange-300 flex items-center gap-1 flex-shrink-0">
                                        <span>⚠</span>
                                        <span className="truncate">
                                            {unavailables.length === 1
                                                ? getEmployeeFullName(unavailables[0].employee_id, unavailables[0].employee_name)
                                                : `${unavailables.length} N.verf.`}
                                        </span>
                                    </div>
                                )}

                                {/* Vacations */}
                                {dayVacations.length > 0 && (
                                    <Link
                                        to={createPageUrl('MyArea') + '?tab=urlaub'}
                                        onClick={(e) => e.stopPropagation()}
                                        className="px-1.5 py-0.5 bg-amber-600/20 border border-amber-600/30 rounded text-[9px] text-amber-400 flex items-center gap-1 hover:bg-amber-600/30 transition-colors font-medium flex-shrink-0"
                                    >
                                        <Palmtree className="w-2.5 h-2.5" />
                                        <span className="truncate">
                                            {dayVacations.length === 1 
                                                ? getEmployeeFullName(dayVacations[0].employee_id, dayVacations[0].employee_name)
                                                : `${dayVacations.length}`
                                            }
                                        </span>
                                    </Link>
                                )}

                                {/* Swap Request Badges */}
                                {daySwapRequests.length > 0 && (
                                    <div className="px-1.5 py-0.5 bg-blue-500/15 border border-blue-500/30 rounded text-[9px] text-blue-300 flex items-center gap-1 flex-shrink-0">
                                        <span>🔄</span>
                                        <span className="truncate">
                                            {daySwapRequests.length === 1
                                                ? `${daySwapRequests[0].requesting_employee_name?.split(' ')[0]} tauscht`
                                                : `${daySwapRequests.length} Tausch`}
                                        </span>
                                    </div>
                                )}
                                </div>

                            {/* Hover Add Button */}
                            {permissions.canEditShifts && (
                                <div className="absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full h-6 rounded-none bg-background/90 hover:bg-amber-600 text-muted-foreground hover:text-foreground border-t border-border"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAddShift(day);
                                        }}
                                    >
                                        <Plus className="w-3 h-3 mr-1" />
                                        <span className="text-[10px]">Schicht</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Provisional Quick-Action Popup */}
        {provisionalPopup && (
            <div
                ref={popupRef}
                className="fixed z-50 bg-card border border-yellow-500/40 rounded-xl shadow-2xl p-3 min-w-[220px]"
                style={{ top: Math.min(provisionalPopup.y, window.innerHeight - 160), left: Math.min(provisionalPopup.x, window.innerWidth - 240) }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-2.5">
                    <p className="font-bold text-foreground text-sm">{provisionalPopup.req.employee_name}</p>
                    <p className="text-yellow-300 text-xs">{provisionalPopup.req.date} · {provisionalPopup.req.start_time}–{provisionalPopup.req.end_time}</p>
                    {provisionalPopup.req.shift_type && <p className="text-muted-foreground text-xs">{provisionalPopup.req.shift_type}</p>}
                    {provisionalPopup.req.comment && <p className="text-muted-foreground text-[10px] italic mt-1">"{provisionalPopup.req.comment}"</p>}
                </div>
                <div className="flex gap-2">
                    <button
                        disabled={provisionalMutation.isPending}
                        onClick={() => provisionalMutation.mutate({ req: provisionalPopup.req, action: 'abgelehnt' })}
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-red-600/80 hover:bg-red-600 text-foreground text-xs font-medium transition-colors"
                    >
                        <XCircle className="w-3.5 h-3.5" /> Ablehnen
                    </button>
                    <button
                        disabled={provisionalMutation.isPending}
                        onClick={() => provisionalMutation.mutate({ req: provisionalPopup.req, action: 'bestätigt' })}
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-green-600 hover:bg-green-700 text-foreground text-xs font-medium transition-colors"
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Bestätigen
                    </button>
                </div>
            </div>
        )}
        </>
    );
}