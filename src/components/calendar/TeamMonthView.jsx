/**
 * TeamMonthView — Monatsübersicht aller Schichten, Urlaube & Feiertage.
 * Extrahiert aus TeamCalendar.jsx, wiederverwendet in Calendar (Monat-Brille).
 * Alle Sub-Komponenten (UnifiedCalendarView, DayDetailDrawer, EventDetailsModal,
 * ShiftSwapRequestModal, TeamCalendarExport, getHolidaysBW) bleiben unverändert.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { Calendar } from 'lucide-react';
import UnifiedCalendarView from '@/components/calendar/UnifiedCalendarView';
import EventDetailsModal from '@/components/calendar/EventDetailsModal';
import ShiftSwapRequestModal from '@/components/shifts/ShiftSwapRequestModal';
import TeamCalendarExport from '@/components/calendar/TeamCalendarExport';
import { getHolidaysBW } from '@/components/shifts/getHolidays';
import DayDetailDrawer from '@/components/calendar/DayDetailDrawer';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';

export default function TeamMonthView() {
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [selectedRoles,     setSelectedRoles]     = useState([]);
    const [searchQuery,       setSearchQuery]       = useState('');
    const [selectedEvent,     setSelectedEvent]     = useState(null);
    const [showEventModal,    setShowEventModal]    = useState(false);
    const [shiftSwapData,     setShiftSwapData]     = useState(null);
    const [selectedDay,       setSelectedDay]       = useState(null);
    const [showDayDrawer,     setShowDayDrawer]     = useState(false);
    const [viewMonth,         setViewMonth]         = useState(new Date());

    // Datumsbereich: einen Monat vor/nach dem sichtbaren Monat
    const shiftFrom = format(subMonths(startOfMonth(viewMonth), 1), 'yyyy-MM-dd');
    const shiftTo   = format(addMonths(endOfMonth(viewMonth),   1), 'yyyy-MM-dd');

    const { data: allShifts = [] } = useQuery({
        queryKey: ['shifts-calendar'],
        queryFn:  () => base44.entities.Shift.list('date', 3000),
        staleTime: STALE.SHORT,
    });
    const shifts = allShifts.filter(s => s.date >= shiftFrom && s.date <= shiftTo);

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn:  () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: STALE.SLOW,
    });
    const { data: vacations = [] } = useQuery({
        queryKey: ['vacations'],
        queryFn:  () => base44.entities.VacationRequest.filter({ status: 'genehmigt' }),
        staleTime: STALE.MEDIUM,
    });
    const { data: maintenanceTasks = [] } = useQuery({
        queryKey: ['maintenance-tasks'],
        queryFn:  () => base44.entities.MaintenanceTask.filter({ is_active: true }),
        staleTime: STALE.SLOW,
    });
    const { data: events = [] } = useQuery({
        queryKey: ['events'],
        queryFn:  () => base44.entities.Event.list('-date', 200),
        staleTime: STALE.MEDIUM,
    });
    const { data: reservations = [] } = useQuery({
        queryKey: ['reservations'],
        queryFn:  () => base44.entities.Reservation.filter({ is_archived: false }),
        staleTime: STALE.MEDIUM,
    });

    const currentYear = new Date().getFullYear();
    const holidays = [...getHolidaysBW(currentYear), ...getHolidaysBW(currentYear + 1)];

    const handleEventClick = event => { setSelectedEvent(event); setShowEventModal(true); };
    const handleDayClick   = day   => { setSelectedDay(day);     setShowDayDrawer(true);  };

    return (
        <div className="space-y-4">
            {/* Kompakter Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <Calendar className="w-5 h-5 text-primary shrink-0" />
                    <div>
                        <h2 className="text-xl font-bold text-foreground leading-none">Teamkalender</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Schichten · Urlaube · Feiertage</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <TeamCalendarExport
                        shifts={shifts}
                        vacations={vacations}
                        holidays={holidays}
                        employees={employees}
                    />
                </div>
            </div>

            {/* Kalender */}
            <UnifiedCalendarView
                onDayClick={handleDayClick}
                shifts={shifts}
                vacations={vacations}
                holidays={holidays}
                employees={employees}
                maintenanceTasks={maintenanceTasks}
                events={events}
                reservations={reservations}
                onEventClick={handleEventClick}
                selectedEmployees={selectedEmployees}
                onEmployeeToggle={setSelectedEmployees}
                onRoleToggle={setSelectedRoles}
                selectedRoles={selectedRoles}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onNavigate={date => setViewMonth(date)}
            />

            {/* Modals */}
            <EventDetailsModal
                event={selectedEvent}
                open={showEventModal}
                onClose={() => { setShowEventModal(false); setSelectedEvent(null); }}
                onShiftSwap={shift => setShiftSwapData(shift)}
            />
            <DayDetailDrawer
                open={showDayDrawer}
                onClose={() => setShowDayDrawer(false)}
                day={selectedDay}
                shifts={shifts}
                vacations={vacations}
                holidays={holidays}
                employees={employees}
                maintenanceTasks={maintenanceTasks}
                reservations={reservations}
            />
            {shiftSwapData && (
                <ShiftSwapRequestModal
                    shift={shiftSwapData}
                    open={!!shiftSwapData}
                    onClose={() => setShiftSwapData(null)}
                />
            )}
        </div>
    );
}