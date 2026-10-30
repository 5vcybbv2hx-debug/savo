/**
 * TeamMonthView — Monatsübersicht aller Schichten, Urlaube & Feiertage.
 * Extrahiert aus TeamCalendar.jsx, wiederverwendet in Calendar (Monat-Brille).
 * Alle Sub-Komponenten (UnifiedCalendarView, DayDetailDrawer, EventDetailsModal,
 * ShiftSwapRequestModal, TeamCalendarExport, getHolidaysBW) bleiben unverändert.
 */
import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePermissions } from '@/components/auth/usePermissions';
import WishShiftSheet from '@/components/provisional/WishShiftSheet';
import UnifiedCalendarView from '@/components/calendar/UnifiedCalendarView';
import EventDetailsModal from '@/components/calendar/EventDetailsModal';
import ShiftSwapRequestModal from '@/components/shifts/ShiftSwapRequestModal';
import TeamCalendarExport from '@/components/calendar/TeamCalendarExport';
import { getHolidaysBW } from '@/components/shifts/getHolidays';
import DayDetailDrawer from '@/components/calendar/DayDetailDrawer';
import { haptics } from '@/components/utils/haptics';
import { isWishWeekday } from '@/lib/wishShiftRules';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

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
    const [wishDate,          setWishDate]          = useState(null);
    const [showWishSheet,     setShowWishSheet]     = useState(false);
    const [wishDetail,        setWishDetail]        = useState(null);

    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const isManager = permissions.isManager || permissions.isAdmin;
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // ── Wunschschichten: eigenes Eingabefenster + eigene Wünsche ──────────────
    const { data: myAccesses = [] } = useQuery({
        queryKey: ['my-provisional-access', permissions.employeeId],
        queryFn:  () => base44.entities.ProvisionalShiftAccess.filter({ employee_id: permissions.employeeId, is_active: true }),
        enabled:  !!permissions.employeeId,
        staleTime: STALE.MEDIUM,
    });
    const { data: myRequests = [] } = useQuery({
        queryKey: ['my-provisional-requests', permissions.employeeId],
        queryFn:  () => base44.entities.ProvisionalShiftRequest.filter({ employee_id: permissions.employeeId }),
        enabled:  !!permissions.employeeId,
        staleTime: STALE.MEDIUM,
    });
    const activeAccess = myAccesses.find(a => a.start_date <= todayStr && a.end_date >= todayStr) || null;
    // Wunsch-Eingabe gilt für alle mit verknüpftem Mitarbeiter-Profil (auch Manager)
    const wishMode = !!permissions.employee && !!activeAccess;

    const deleteWish = useMutation({
        mutationFn: (id) => base44.entities.ProvisionalShiftRequest.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-provisional-requests', permissions.employeeId] });
            queryClient.invalidateQueries({ queryKey: ['provisional-shift-requests'] });
            queryClient.invalidateQueries({ queryKey: ['all-provisional-requests'] });
            setWishDetail(null);
            toast.success('Wunsch entfernt');
        },
    });

    // ── Touch: horizontaler Swipe blättert durch die Monate ──────────────────
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const handleSwipeStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };
    const handleSwipeEnd = (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
            haptics.selection();
            setViewMonth(prev => dx < 0 ? addMonths(prev, 1) : subMonths(prev, 1));
        }
    };

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
    // Kann an diesem Tag ein Wunsch eingetragen werden? (Fenster aktiv + Wunschtag)
    const canWishOn = day => {
        if (!day || !wishMode) return false;
        const dayStr = format(day, 'yyyy-MM-dd');
        return isWishWeekday(day) && dayStr >= todayStr
            && dayStr >= activeAccess.start_date && dayStr <= activeAccess.end_date;
    };

    const handleDayClick   = day   => {
        // Manager behalten das Tagesdetail — der Wunsch-Button steckt dort im Drawer
        if (!isManager && canWishOn(day)) {
            haptics.selection();
            setWishDate(day);
            setShowWishSheet(true);
            return;
        }
        setSelectedDay(day);
        setShowDayDrawer(true);
    };

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
            <div
                onTouchStart={handleSwipeStart}
                onTouchEnd={handleSwipeEnd}
            >
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
                myWishes={myRequests}
                wishMode={wishMode && !isManager}
                onWishClick={setWishDetail}
                wishRange={wishMode && !isManager ? { start: activeAccess.start_date, end: activeAccess.end_date } : null}
            />
            </div>

            {/* Modals */}
            <EventDetailsModal
                event={selectedEvent}
                open={showEventModal}
                onClose={() => { setShowEventModal(false); setSelectedEvent(null); }}
                onShiftSwap={shift => setShiftSwapData(shift)}
            />
            {/* Tap-Hinweis im Kalender nur für Nicht-Manager — eigene Wunsch-Chips sehen alle */}
            <DayDetailDrawer
                open={showDayDrawer}
                onClose={() => setShowDayDrawer(false)}
                day={selectedDay}
                wishAvailable={canWishOn(selectedDay)}
                onWish={() => {
                    setShowDayDrawer(false);
                    setWishDate(selectedDay);
                    setShowWishSheet(true);
                }}
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

            {/* Wunschschicht eintragen — direkt aus dem Kalender */}
            <WishShiftSheet
                open={showWishSheet}
                onOpenChange={setShowWishSheet}
                date={wishDate}
                employee={permissions.employee}
                access={activeAccess}
            />

            {/* Eigenen Wunsch ansehen / entfernen */}
            <Dialog open={!!wishDetail} onOpenChange={open => !open && setWishDetail(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Wunsch entfernen?</DialogTitle>
                    </DialogHeader>
                    {wishDetail && (
                        <div className="space-y-4">
                            <div className="rounded-xl bg-secondary/50 border border-border p-3">
                                <p className="font-semibold text-foreground">
                                    {format(parseISO(wishDetail.date), 'EEEE, dd.MM.yyyy', { locale: de })}
                                </p>
                                <p className="text-sm text-muted-foreground font-mono">
                                    {wishDetail.start_time} – {wishDetail.end_time}
                                    {wishDetail.shift_type ? ` · ${wishDetail.shift_type}` : ''}
                                </p>
                            </div>
                            {wishDetail.status === 'ausstehend' ? (
                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1" onClick={() => setWishDetail(null)}>
                                        Behalten
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="flex-1"
                                        disabled={deleteWish.isPending}
                                        onClick={() => deleteWish.mutate(wishDetail.id)}
                                    >
                                        Entfernen
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    {wishDetail.status === 'bestätigt'
                                        ? 'Dieser Wunsch wurde bereits bestätigt und kann nicht mehr entfernt werden.'
                                        : 'Dieser Wunsch wurde abgelehnt.'}
                                </p>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}