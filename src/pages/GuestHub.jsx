/**
 * GuestHub — "Ein Tag, ein Blick"
 * Eine Seite: Tages-Kennzahlen + Liste der kommenden Reservierungen (7 Tage).
 * Kein grafischer Tischplan. Keine Tabs. Archiv = altes Datum wählen.
 */
import React, { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Plus, Download, Printer,
    ChevronLeft, ChevronRight, Users, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { haptics } from '@/components/utils/haptics';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import ReservationModal from '@/components/reservations/ReservationModal';
import { useReservationLifecycle } from '@/features/reservations/hooks/useReservationLifecycle';
import {
    useReservations, useArchivedReservations,
    useCreateReservation, useUpdateReservation, useDeleteReservation
} from '@/features/reservations/hooks/useReservations';
import { ErrorState, ListSkeleton } from '@/components/ui/StateDisplay';
import UpcomingReservationsList from '@/components/reservations/UpcomingReservationsList';
import TodayCard from '@/components/reservations/TodayCard';
import { resolveCreatorName } from '@/lib/reservationCreator';

function addDaysHelper(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

export default function GuestHub() {
    const permissions = usePermissions();

    // ── State ──────────────────────────────────────────────────────────────
    const [resModalOpen, setResModalOpen] = useState(false);
    const [selectedRes, setSelectedRes] = useState(null);

    // Zentrale Datumsquelle
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

    // ── Touch: horizontaler Swipe blättert durchs zentrale Datum ──────────────
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const handleSwipeStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };
    const handleSwipeEnd = (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        // Nur bei eindeutig horizontaler Dominanz auslösen — schützt Tischplan & Vertikal-Scroll
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
            haptics.selection();
            setFilterDate(addDaysHelper(filterDate, dx < 0 ? 1 : -1));
        }
    };

    // ── Data queries ─────────────────────────────────────────────────────────
    const { data: activeReservations = [], isLoading: activeLoading, isError: reservationsError } = useReservations();
    const { data: archivedReservations = [] } = useArchivedReservations();
    const allReservations = useMemo(() => [...activeReservations, ...archivedReservations], [activeReservations, archivedReservations]);

    useReservationLifecycle(activeReservations);

    const { data: tables = [] } = useQuery({
        queryKey: ['tables'],
        queryFn: () => base44.entities.Table.list(),
        staleTime: STALE.MEDIUM
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.list(),
        staleTime: STALE.MEDIUM
    });

    const resolveCreator = (email) => resolveCreatorName(employees, email);

    // ── Mutations ────────────────────────────────────────────────────────────
    const createMutation = useCreateReservation();
    const updateMutation = useUpdateReservation();
    const deleteMutation = useDeleteReservation();

    const handleSave = (data, id, keepOpen = false) => {
        const onSuccess = () => {
            if (keepOpen) return;
            setResModalOpen(false);
            setSelectedRes(null);
        };
        if (id) {
            updateMutation.mutate({ id, data }, { onSuccess });
        } else {
            createMutation.mutate(data, { onSuccess });
        }
    };

    const handleDelete = (id) => {
        if (!permissions.canDeleteReservations) return;
        deleteMutation.mutate(id);
        setResModalOpen(false);
    };

    const handleConfirm = (id) =>
        updateMutation.mutate({ id, data: { status: 'bestätigt' } });

    const handleCancel = (id) =>
        updateMutation.mutate({ id, data: { status: 'storniert' } });

    // ── Reservierungen des gewählten Tages (chronologisch) ───────────────────
    const todayStr = new Date().toISOString().split('T')[0];

    const dayReservations = useMemo(() =>
        allReservations
            .filter(r => r.date === filterDate)
            .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
        [allReservations, filterDate]
    );

    // Kommende Reservierungen: 7 Tage ab morgen — der gewählte Tag steht in der "Heute"-Karte
    const upcomingReservations = useMemo(() => {
        const from = addDaysHelper(todayStr, 1);
        const to = addDaysHelper(todayStr, 7);
        return allReservations
            .filter(r =>
                !r.is_archived &&
                r.date &&
                r.date >= from &&
                r.date <= to &&
                r.date !== filterDate
            )
            .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));
    }, [allReservations, todayStr, filterDate]);

    // KPI-Zeile: X Gäste · N offen (für den gewählten Tag)
    const kpi = useMemo(() => {
        const active = dayReservations.filter(r => r.status !== 'storniert');
        const guests = active.reduce((s, r) => s + (Number(r.guests) || 0), 0);
        const offen = dayReservations.filter(r => r.status === 'vorgemerkt').length;
        return { guests, offen };
    }, [dayReservations]);

    // ── Navigation im Reservierungs-Modal (folgt der Liste der kommenden Reservierungen) ──
    const reservationNavList = upcomingReservations;

    const handleNavigateReservation = (direction) => {
        if (!selectedRes?.id) return;
        const idx = reservationNavList.findIndex(r => r.id === selectedRes.id);
        if (idx === -1) return;
        const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= reservationNavList.length) return;
        setSelectedRes(reservationNavList[nextIdx]);
    };

    const reservationNavPosition = (() => {
        if (!selectedRes?.id) return null;
        const idx = reservationNavList.findIndex(r => r.id === selectedRes.id);
        if (idx === -1) return null;
        return { index: idx, total: reservationNavList.length, hasPrev: idx > 0, hasNext: idx < reservationNavList.length - 1 };
    })();

    // Reservierung antippen → Detailansicht öffnen
    const openReservation = (res) => {
        setSelectedRes(res);
        setResModalOpen(true);
    };

    const handleExport = () => {
        const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Bar Manager//Reservierungen//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Bar Reservierungen','X-WR-TIMEZONE:Europe/Berlin'];
        activeReservations.filter(r => r.status !== 'storniert').forEach(res => {
            const d = res.date.replace(/-/g,'');
            const t = (res.time ?? '19:00').replace(':','') + '00';
            const eh = String((parseInt((res.time ?? '19:00').split(':')[0]) + 2) % 24).padStart(2,'0');
            const et = eh + (res.time ?? '19:00').split(':')[1] + '00';
            lines.push('BEGIN:VEVENT',`UID:res-${res.id}@barmanager.app`,`DTSTAMP:${format(new Date(),"yyyyMMdd'T'HHmmss'Z'")}`,`DTSTART:${d}T${t}`,`DTEND:${d}T${et}`,`SUMMARY:${res.customer_name} (${res.guests} P.)`,`DESCRIPTION:${res.guests} Personen${res.phone ? '\\nTel: ' + res.phone : ''}`,'STATUS:CONFIRMED','END:VEVENT');
        });
        lines.push('END:VCALENDAR');
        const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `reservierungen-${format(new Date(),'yyyy-MM-dd')}.ics` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    if (!permissions.canViewReservations) return <PermissionDenied message="Keine Berechtigung." />;

    if (reservationsError) return (
        <div className="min-h-screen bg-background px-4 py-6">
            <ErrorState text="Reservierungen konnten nicht geladen werden." retry={() => window.location.reload()} />
        </div>
    );

    if (activeLoading) return (
        <div className="min-h-screen bg-background pb-24 md:pb-8 px-5 pt-4 space-y-3">
            <ListSkeleton count={1} height="h-14" />
            <ListSkeleton count={4} height="h-24" />
        </div>
    );

    const isToday = filterDate === todayStr;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto">

                {/* ── Sticky header: Titel + Neu + Datumszeile ───────────── */}
                <div className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border">
                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <div>
                            <h1 className="page-title">Gäste & Tische</h1>
                            <p className="text-xs text-muted-foreground">
                                {format(parseISO(filterDate), "EEEE, d. MMMM", { locale: de })}
                            </p>
                        </div>
                        <div className="flex gap-1.5">
                            <Button asChild variant="outline" className="h-9 gap-1 text-sm" aria-label="Reserviert-Schilder drucken">
                                <Link to="/ReserviertSchilder">
                                    <Printer className="w-4 h-4" />
                                    <span className="hidden sm:inline">Reserviert-Schilder</span>
                                </Link>
                            </Button>
                            {permissions.canEditReservations && (
                                <Button variant="outline" size="icon" onClick={handleExport} className="h-9 w-9">
                                    <Download className="w-4 h-4" />
                                </Button>
                            )}
                            {permissions.canEditReservations && (
                                <Button onClick={() => { setSelectedRes(null); setResModalOpen(true); }}
                                    className="h-9 gap-1 text-sm font-semibold bg-gradient-to-r from-status-warn to-status-warn hover:from-status-warn hover:to-status-warn">
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Neu</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Zentrale Datumszeile — steuert alle Sektionen */}
                    <div className="flex items-center gap-2 px-4 pb-3">
                        <button onClick={() => setFilterDate(addDaysHelper(filterDate, -1))}
                            className="h-9 w-9 rounded-lg border border-input flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent shrink-0">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                            className="h-9 px-3 rounded-lg border border-input bg-transparent text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-center flex-1" />
                        <button onClick={() => setFilterDate(addDaysHelper(filterDate, 1))}
                            className="h-9 w-9 rounded-lg border border-input flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent shrink-0">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        {!isToday && (
                            <button onClick={() => setFilterDate(todayStr)}
                                className="h-9 px-3 text-xs rounded-lg border border-input text-muted-foreground hover:text-foreground hover:bg-accent shrink-0">
                                Heute
                            </button>
                        )}
                    </div>
                </div>

                <div
                    className="px-4 py-4 space-y-5"
                    onTouchStart={handleSwipeStart}
                    onTouchEnd={handleSwipeEnd}
                >

                    {/* ── KPI-Zeile ──────────────────────────────────────────── */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-status-warn/10 border border-status-warn/20 text-status-warn font-semibold">
                            <Users className="w-3.5 h-3.5" />{kpi.guests} Gäste
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-status-warn/10 border border-status-warn/20 text-status-warn font-semibold">
                            {kpi.offen} offen
                        </span>
                    </div>

                    {/* ── Heute: Reservierungen des gewählten Tages ─────────── */}
                    <TodayCard
                        date={filterDate}
                        reservations={dayReservations}
                        tables={tables}
                        resolveCreator={resolveCreator}
                        onOpen={openReservation}
                        onCreate={() => { setSelectedRes(null); setResModalOpen(true); }}
                    />

                    {/* ── Kommende Reservierungen (7 Tage ab morgen) ────────── */}
                    <section className="space-y-3 pt-2">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />Kommende Reservierungen
                        </h2>
                        <UpcomingReservationsList
                            reservations={upcomingReservations}
                            tables={tables}
                            resolveCreator={resolveCreator}
                            onOpen={openReservation}
                        />
                    </section>
                </div>
            </div>

            {/* Reservation Modal */}
            <ReservationModal
                open={resModalOpen}
                onClose={() => { setResModalOpen(false); setSelectedRes(null); }}
                reservation={selectedRes}
                onSave={handleSave}
                onDelete={handleDelete}
                canDelete={permissions.canDeleteReservations}
                isManager={permissions.isManager}
                onNavigate={handleNavigateReservation}
                navPosition={reservationNavPosition}
                defaultDate={filterDate}
                creatorName={selectedRes ? resolveCreator(selectedRes.created_by) : ''}
            />

        </div>
    );
}