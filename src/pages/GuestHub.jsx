/**
 * GuestHub — Unified Reservations + Table Plan page.
 * 3 main tabs: Heute / Reservierungen / Tischplan
 * No sub-tabs, no view toggles, all data directly visible.
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { format, subDays, addDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Plus, Search, Download, Clock, Grid2x2, X, Settings,
    ChevronLeft, ChevronRight, Users, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import ReservationModal from '@/components/reservations/ReservationModal';
import { useReservationLifecycle } from '@/features/reservations/hooks/useReservationLifecycle';
import {
    useReservations, useArchivedReservations,
    useCreateReservation, useUpdateReservation, useDeleteReservation,
    RES_KEYS
} from '@/features/reservations/hooks/useReservations';
import { getTableStatus, getReservationTables } from '@/components/seating/QuickReservationSheet';
import QuickReservationSheet from '@/components/seating/QuickReservationSheet';
import TableModal from '@/components/seating/TableModal';
import RoomManager from '@/components/seating/RoomManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingState, EmptyState, ErrorState, ListSkeleton } from '@/components/ui/StateDisplay';
import GuestHubTodayTab from '@/components/reservations/GuestHubTodayTab';
import GuestHubTablesTab from '@/components/seating/GuestHubTablesTab';

const STATUS_FILTERS = [
    { value: 'alle',       label: 'Alle' },
    { value: 'vorgemerkt', label: 'Vorgemerkt' },
    { value: 'bestätigt',  label: 'Bestätigt' },
    { value: 'erschienen', label: 'Erschienen' },
    { value: 'no-show',    label: 'No-Show' },
    { value: 'storniert',  label: 'Storniert' },
    { value: 'archiv',     label: 'Archiv' },
];

function suggestTables(tables, reservations, guestCount, date, time) {
    const available = tables.filter(t => {
        if (t.is_active === false) return false;
        return getTableStatus(t, reservations, date, time) === 'free';
    });
    return available
        .map(t => ({ table: t, score: t.capacity >= guestCount ? t.capacity - guestCount : 999 }))
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map(s => s.table);
}

function addDaysHelper(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

export default function GuestHub() {
    const permissions = usePermissions();

    // Main tab state
    const [tab, setTab] = useState('today');

    // Reservations tab state
    const [statusFilter, setStatusFilter] = useState('alle');
    const [searchTerm, setSearchTerm] = useState('');
    const [resModalOpen, setResModalOpen] = useState(false);
    const [selectedRes, setSelectedRes] = useState(null);

    // Table plan tab state
    const [selectedTable, setSelectedTable] = useState(null);
    const [showTableModal, setShowTableModal] = useState(null);
    const [showRooms, setShowRooms] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [planView, setPlanView] = useState('plan');
    const [guestFilter, setGuestFilter] = useState('');
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterTime, setFilterTime] = useState(() => {
        const n = new Date();
        return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
    });

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

    const { data: rooms = [] } = useQuery({
        queryKey: ['rooms'],
        queryFn: () => base44.entities.Room.list(),
        staleTime: STALE.MEDIUM
    });

    // ── Mutations ────────────────────────────────────────────────────────────
    const createMutation = useCreateReservation();
    const updateMutation = useUpdateReservation();
    const deleteMutation = useDeleteReservation();

    const handleSave = (data, id) => {
        if (id) {
            updateMutation.mutate({ id, data }, { onSuccess: () => { setResModalOpen(false); setSelectedRes(null); } });
        } else {
            createMutation.mutate(data, { onSuccess: () => { setResModalOpen(false); setSelectedRes(null); } });
        }
    };

    const handleDelete = (id) => {
        if (!permissions.canDeleteReservations) return;
        deleteMutation.mutate(id);
        setResModalOpen(false);
    };

    const handleArchive = (id, isArchived) =>
        updateMutation.mutate({ id, data: { is_archived: !isArchived } });

    const handleConfirm = (id) =>
        updateMutation.mutate({ id, data: { status: 'bestätigt' } });

    // Tisch-Klick bei freiem Tisch → neue Reservierung mit vorausgewähltem Tisch
    const handleTableNewReservation = (table) => {
        setSelectedRes({ table: table.table_number, guests: table.capacity });
        setResModalOpen(true);
    };

    const handleCancel = (id) =>
        updateMutation.mutate({ id, data: { status: 'storniert' } });

    // ── Filtered data ────────────────────────────────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0];
    const todayReservations = useMemo(() =>
        activeReservations
            .filter(r => r.date === todayStr && r.status !== 'storniert')
            .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
        [activeReservations, todayStr]
    );

    const { reservations: filteredReservations } = useMemo(() => {
        const search = searchTerm.toLowerCase();
        const isArchiveView = statusFilter === 'archiv';

        const matches = (r) => {
            // Archiv-Tab: nur archivierte Einträge anzeigen
            if (isArchiveView) return r.is_archived === true;
            // Alle anderen Tabs: niemals archivierte anzeigen
            if (r.is_archived) return false;
            // Vergangene Reservierungen (vor heute) ausblenden — gehören ins Archiv
            if (r.date < todayStr) return false;
            // Suchfilter
            if (search && !r.customer_name?.toLowerCase().includes(search) && !r.phone?.toLowerCase().includes(search)) return false;
            // Statusfilter
            if (statusFilter !== 'alle' && r.status !== statusFilter) return false;
            return true;
        };

        const all = allReservations.filter(matches)
            .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));

        return { reservations: all };
    }, [allReservations, searchTerm, statusFilter, todayStr]);

    // Weiterblättern (Prev/Next) im Reservierungs-Modal — folgt der Liste des
    // gerade aktiven Tabs (Heute-Tab: nach Uhrzeit sortiert; sonst: Gesamtliste
    // nach Datum+Uhrzeit sortiert, wie auf dem Bildschirm sichtbar).
    const reservationNavList = tab === 'today' ? todayReservations : filteredReservations;

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

    const filteredTables = useMemo(() => {
        let list = selectedRoom ? tables.filter(t => t.room === selectedRoom) : tables;
        if (guestFilter) list = list.filter(t => t.capacity >= Number(guestFilter));
        return list.sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
    }, [tables, selectedRoom, guestFilter]);

    const tableWithStatus = useMemo(() =>
        filteredTables.map(t => {
            const dayRes = allReservations.filter(r =>
                r.status !== 'storniert' &&
                !r.is_archived &&
                r.date === filterDate &&
                getReservationTables(r).includes(t.table_number)
            ).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

            const reservation = dayRes.find(r => {
                const [rh, rm] = (r.time || '00:00').split(':').map(Number);
                const [fh, fm] = filterTime.split(':').map(Number);
                return Math.abs(rh * 60 + rm - (fh * 60 + fm)) < 90;
            }) || dayRes[0] || null;

            return {
                table: t,
                status: getTableStatus(t, allReservations, filterDate, filterTime),
                reservation,
                dayReservations: dayRes
            };
        }),
        [filteredTables, allReservations, filterDate, filterTime]
    );

    const stats = useMemo(() => ({
        free: tableWithStatus.filter(t => t.status === 'free').length,
        reserved: tableWithStatus.filter(t => t.status === 'reserved').length,
        soon: tableWithStatus.filter(t => t.status === 'soon').length,
    }), [tableWithStatus]);

    const suggested = guestFilter
        ? suggestTables(tables, allReservations, Number(guestFilter), filterDate, filterTime)
        : [];

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

                {/* ── Sticky header ──────────────────────────────────────── */}
                <div className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border">
                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <div>
                            <h1 className="text-lg font-bold text-foreground">Gäste & Tische</h1>
                            <p className="text-xs text-muted-foreground">
                                {todayReservations.length} heute · {stats.free} Tische frei
                            </p>
                        </div>
                        <div className="flex gap-1.5">
                            {tab === 'reservations' && permissions.canEditReservations && (
                                <>
                                    <Button variant="outline" size="icon" onClick={handleExport} className="h-9 w-9">
                                        <Download className="w-4 h-4" />
                                    </Button>
                                    <Button onClick={() => { setSelectedRes(null); setResModalOpen(true); }}
                                        className="h-9 gap-1 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                                        <Plus className="w-4 h-4" />
                                        <span className="hidden sm:inline">Reservierung</span>
                                    </Button>
                                </>
                            )}
                            {tab === 'tables' && permissions.isManager && (
                                <>
                                    <Button variant="outline" size="sm" onClick={() => setShowRooms(true)} className="h-9 gap-1 text-xs">
                                        <Settings className="w-3.5 h-3.5" /><span className="hidden sm:inline">Räume</span>
                                    </Button>
                                    <Button size="sm" onClick={() => setShowTableModal({})} className="h-9 gap-1 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                                        <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Tisch</span>
                                    </Button>
                                </>
                            )}
                            {tab === 'today' && permissions.canEditReservations && (
                                <Button onClick={() => { setSelectedRes(null); setResModalOpen(true); }}
                                    className="h-9 gap-1 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Neu</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Main tabs */}
                    <div className="flex border-t border-border">
                        {[
                            { id: 'today', label: 'Heute', icon: Clock },
                            { id: 'reservations', label: 'Reservierungen', icon: Users },
                            { id: 'tables', label: 'Tischplan', icon: Grid2x2 },
                        ].map(({ id, label, icon: Icon }) => (
                            <button key={id} onClick={() => setTab(id)}
                                className={cn('flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2',
                                    tab === id ? 'text-foreground border-b-foreground' : 'text-muted-foreground hover:text-foreground border-b-transparent')}>
                                <Icon className="w-4 h-4" />
                                <span className="hidden sm:inline">{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Table plan header controls */}
                    {tab === 'tables' && (
                        <div className="border-t border-border/50 space-y-2 px-4 pt-3 pb-3">
                            {/* Date nav row */}
                            <div className="flex items-center gap-2">
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
                                {filterDate !== todayStr && (
                                    <button onClick={() => setFilterDate(todayStr)}
                                        className="h-9 px-3 text-xs rounded-lg border border-input text-muted-foreground hover:text-foreground hover:bg-accent shrink-0">
                                        Heute
                                    </button>
                                )}
                            </div>

                            {/* Time + guests row */}
                            <div className="flex items-center gap-2">
                                <input type="time" value={filterTime} onChange={e => setFilterTime(e.target.value)}
                                    className="h-9 px-3 rounded-lg border border-input bg-transparent text-sm text-foreground focus:outline-none w-24 shrink-0" />
                                <div className="relative shrink-0">
                                    <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                    <input type="number" value={guestFilter} min="1" max="20" onChange={e => setGuestFilter(e.target.value)}
                                        placeholder="Personen" className="h-9 pl-7 pr-3 w-20 rounded-lg border border-input bg-transparent text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                                </div>
                                {guestFilter && (
                                    <button onClick={() => setGuestFilter('')} className="h-9 w-9 rounded-lg border border-input flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent shrink-0">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Room filter row */}
                            {rooms.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
                                    <button onClick={() => setSelectedRoom(null)} 
                                        className={cn('text-xs px-3 py-1.5 rounded-full border shrink-0 h-8 whitespace-nowrap',
                                            !selectedRoom ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
                                        Alle
                                    </button>
                                    {rooms.map(room => (
                                        <button key={room.id} onClick={() => setSelectedRoom(room.name)} 
                                            className={cn('text-xs px-3 py-1.5 rounded-full border shrink-0 h-8 whitespace-nowrap',
                                                selectedRoom === room.name ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
                                            {room.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-4 py-4 space-y-4">

                    {/* ── TODAY TAB ──────────────────────────────────────── */}
                    {tab === 'today' && (
                        <GuestHubTodayTab
                            todayReservations={todayReservations}
                            tables={tables}
                            stats={stats}
                            permissions={permissions}
                            onAddReservation={() => { setSelectedRes(null); setResModalOpen(true); }}
                            onEditReservation={(res) => { setSelectedRes(res); setResModalOpen(true); }}
                        />
                    )}

                    {/* ── RESERVATIONS TAB ───────────────────────────────── */}
                    {tab === 'reservations' && (
                        <div className="space-y-4">
                            {/* Search field */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="Name oder Telefon..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 h-10 bg-card border-border"
                                />
                            </div>

                            {/* Status filter chips */}
                            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
                                {STATUS_FILTERS.map(f => (
                                    <button
                                        key={f.value}
                                        onClick={() => setStatusFilter(f.value)}
                                        className={cn(
                                            'text-xs px-3 py-1.5 rounded-full border shrink-0 h-8 whitespace-nowrap transition-all',
                                            statusFilter === f.value
                                                ? 'bg-foreground text-background border-foreground'
                                                : 'border-border text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {/* Reservations list */}
                            {activeLoading ? (
                                <LoadingState />
                            ) : filteredReservations.length === 0 ? (
                                <EmptyState 
                                    title={searchTerm || statusFilter !== 'alle' ? 'Keine Ergebnisse' : 'Keine Reservierungen'}
                                    description={searchTerm || statusFilter !== 'alle' ? 'Versuchen Sie andere Filter.' : 'Erstellen Sie eine neue Reservierung.'}
                                />
                            ) : (
                                <div className="space-y-3">
                                    {filteredReservations.map((res, idx) => (
                                        <div
                                            key={res.id}
                                            onClick={() => { setSelectedRes(res); setResModalOpen(true); }}
                                            className="p-4 rounded-xl border border-border bg-card hover:bg-accent/50 cursor-pointer transition-all card-pressable animate-stagger"
                                            style={{ '--delay': `${idx * 45}ms` }}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold text-foreground">
                                                            {res.customer_name}
                                                        </span>
                                                        <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                                                            {format(parseISO(res.date), 'dd.MM.')} · {res.time || '–'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {res.guests} Personen{res.table && ` · Tisch ${res.table}`}
                                                    </div>
                                                </div>
                                                <span className={cn(
                                                    'text-xs px-2 py-1 rounded-full font-medium shrink-0',
                                                    res.status === 'vorgemerkt' ? 'bg-blue-500/15 text-blue-400' :
                                                    res.status === 'bestätigt' ? 'bg-yellow-500/15 text-yellow-400' :
                                                    res.status === 'erschienen' ? 'bg-green-500/15 text-green-400' :
                                                    res.status === 'no-show' ? 'bg-red-500/15 text-red-400' :
                                                    'bg-secondary text-muted-foreground'
                                                )}>
                                                    {res.status === 'vorgemerkt' ? '🔵' : 
                                                     res.status === 'bestätigt' ? '🟡' :
                                                     res.status === 'erschienen' ? '🟢' :
                                                     res.status === 'no-show' ? '🔴' : '⚪'}
                                                    {' '}{res.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TABLE PLAN TAB ─────────────────────────────────── */}
                    {tab === 'tables' && (
                        <GuestHubTablesTab
                            tableWithStatus={tableWithStatus}
                            stats={stats}
                            guestFilter={guestFilter}
                            suggested={suggested}
                            permissions={permissions}
                            onTableSelect={setSelectedTable}
                            onCreateTable={(t) => setShowTableModal(t)}
                            onEditTable={(t) => setShowTableModal(t)}
                        />
                    )}
                </div>
            </div>

            {/* Quick Reservation Sheet */}
            {selectedTable && (
                <QuickReservationSheet
                    table={selectedTable}
                    tables={tables}
                    reservations={allReservations}
                    checkDate={filterDate}
                    checkTime={filterTime}
                    isManager={permissions.isManager}
                    onClose={() => setSelectedTable(null)}
                    onEditReservation={(res) => { setSelectedRes(res); setResModalOpen(true); setSelectedTable(null); }}
                />
            )}

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
            />

            {/* Table edit modal */}
            {showTableModal !== null && (
                <TableModal
                    table={showTableModal?.id ? showTableModal : null}
                    open={true}
                    onClose={() => setShowTableModal(null)}
                    reservation={null}
                />
            )}

            {/* Rooms dialog */}
            <Dialog open={showRooms} onOpenChange={setShowRooms}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Räume verwalten</DialogTitle></DialogHeader>
                    <RoomManager rooms={rooms} />
                </DialogContent>
            </Dialog>
        </div>
    );
}