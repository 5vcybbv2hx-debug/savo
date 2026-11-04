/**
 * GuestHub — "Ein Blick"
 * Eine Seite, eine Liste: Reservierungen ab heute (14 Tage), nach Tagen gruppiert.
 * Kein grafischer Tischplan. Keine Tabs.
 */
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import ReservationModal from '@/components/reservations/ReservationModal';
import { useReservationLifecycle } from '@/features/reservations/hooks/useReservationLifecycle';
import {
    useReservations, useArchivedReservations,
    useCreateReservation, useUpdateReservation, useDeleteReservation
} from '@/features/reservations/hooks/useReservations';
import { ErrorState, ListSkeleton } from '@/components/ui/StateDisplay';
import ReservationDayList from '@/components/reservations/ReservationDayList';
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

    // Zeitraum der einen Liste: heute + die nächsten 13 Tage
    const todayStr = new Date().toISOString().split('T')[0];

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

    // ── Eine Liste: heute + nächste 13 Tage, chronologisch ───────────────────
    const timelineReservations = useMemo(() => {
        const to = addDaysHelper(todayStr, 13);
        return allReservations
            .filter(r => !r.is_archived && r.date && r.date >= todayStr && r.date <= to)
            .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));
    }, [allReservations, todayStr]);

    // ── Navigation im Reservierungs-Modal (folgt der einen Liste) ────────────
    const reservationNavList = timelineReservations;

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
        <div className="min-h-screen bg-background pb-24 md:pb-8 px-4 pt-4 space-y-3">
            <ListSkeleton count={1} height="h-14" />
            <ListSkeleton count={4} height="h-24" />
        </div>
    );

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto">

                {/* ── Sticky header: Titel + Neu + Datumszeile ───────────── */}
                <div className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border">
                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <div>
                            <h1 className="text-lg font-bold text-foreground">Gäste & Tische</h1>
                            <p className="text-xs text-muted-foreground">
                                {format(new Date(), "EEEE, d. MMMM", { locale: de })}
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
                                    className="h-9 gap-1 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Neu</span>
                                </Button>
                            )}
                        </div>
                    </div>

                </div>

                <div className="px-4 py-4">
                    {/* ── Die eine Liste: Reservierungen ─────────────────────── */}
                    <ReservationDayList
                        reservations={timelineReservations}
                        tables={tables}
                        resolveCreator={resolveCreator}
                        onOpen={openReservation}
                    />
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
                defaultDate={todayStr}
                creatorName={selectedRes ? resolveCreator(selectedRes.created_by) : ''}
            />

        </div>
    );
}