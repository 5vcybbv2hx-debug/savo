/**
 * GuestHub — "Ein Tag, ein Blick"
 * Eine Seite, eine Datumszeile steuert Reservierungs-Zeitstrahl UND Tischplan.
 * Keine Tabs mehr. Archiv = altes Datum wählen.
 */
import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Plus, Search, Download, X, Settings,
    ChevronLeft, ChevronRight, Users, Clock, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { haptics } from '@/components/utils/haptics';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import ReservationModal from '@/components/reservations/ReservationModal';
import { useReservationLifecycle } from '@/features/reservations/hooks/useReservationLifecycle';
import {
    useReservations, useArchivedReservations,
    useCreateReservation, useUpdateReservation, useDeleteReservation
} from '@/features/reservations/hooks/useReservations';
import { getTableStatus, getReservationTables } from '@/components/seating/QuickReservationSheet';
import QuickReservationSheet from '@/components/seating/QuickReservationSheet';
import TableModal from '@/components/seating/TableModal';
import RoomManager from '@/components/seating/RoomManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingState, EmptyState, ErrorState, ListSkeleton } from '@/components/ui/StateDisplay';
import GuestHubTablesTab from '@/components/seating/GuestHubTablesTab';
import { getTableDisplayName } from '@/components/tables/TableNameDisplay';

// Filter-Chips für den Zeitstrahl (alte Status-Filter-Logik, ohne Archiv-Tab)
const STATUS_FILTERS = [
    { value: 'alle',       label: 'Alle' },
    { value: 'vorgemerkt', label: 'Offen' },
    { value: 'bestätigt',  label: 'Bestätigt' },
    { value: 'erschienen', label: 'Erschienen' },
    { value: 'storniert',  label: 'Storniert' },
];

// Status-Badge-Farben für den Zeitstrahl
const STATUS_BADGE = {
    'bestätigt':  'bg-green-500/15 text-green-400 border-green-500/30',
    'vorgemerkt': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    'erschienen': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'no-show':    'bg-muted text-muted-foreground border-border',
    'storniert':  'bg-muted text-muted-foreground border-border',
};

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

    // ── State ──────────────────────────────────────────────────────────────
    const [statusFilter, setStatusFilter] = useState('alle');
    const [searchTerm, setSearchTerm] = useState('');
    const [resModalOpen, setResModalOpen] = useState(false);
    const [selectedRes, setSelectedRes] = useState(null);
    const [highlightedRes, setHighlightedRes] = useState(null);

    // Tischplan
    const [selectedTable, setSelectedTable] = useState(null);
    const [showTableModal, setShowTableModal] = useState(null);
    const [showRooms, setShowRooms] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [planView, setPlanView] = useState('plan');
    const [guestFilter, setGuestFilter] = useState('');

    // Zentrale Datumsquelle — steuert Zeitstrahl UND Tischplan
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterTime, setFilterTime] = useState(() => {
        const n = new Date();
        return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
    });

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

    const handleConfirm = (id) =>
        updateMutation.mutate({ id, data: { status: 'bestätigt' } });

    const handleTableNewReservation = (table) => {
        setSelectedRes({ table: table.table_number, guests: table.capacity });
        setResModalOpen(true);
    };

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

    const filteredReservations = useMemo(() => {
        const search = searchTerm.toLowerCase();
        return dayReservations.filter(r => {
            // Zukünftiges Datum: archivierte Einträge ausblenden
            if (r.is_archived && filterDate >= todayStr) return false;
            if (search && !r.customer_name?.toLowerCase().includes(search) && !r.phone?.toLowerCase().includes(search)) return false;
            if (statusFilter !== 'alle' && r.status !== statusFilter) return false;
            return true;
        });
    }, [dayReservations, searchTerm, statusFilter, filterDate, todayStr]);

    // ── Tischplan-Daten (für filterDate) ─────────────────────────────────────
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

    // KPI-Zeile: X Gäste · Y frei · Z reserviert · N offen
    const kpi = useMemo(() => {
        const active = dayReservations.filter(r => r.status !== 'storniert');
        const guests = active.reduce((s, r) => s + (Number(r.guests) || 0), 0);
        const offen = dayReservations.filter(r => r.status === 'vorgemerkt').length;
        return { guests, frei: stats.free, reserviert: stats.reserved, offen };
    }, [dayReservations, stats]);

    const suggested = guestFilter
        ? suggestTables(tables, allReservations, Number(guestFilter), filterDate, filterTime)
        : [];

    // Hervorgehobene Tische der im Zeitstrahl angetippten Reservierung
    const highlightedTableNumbers = useMemo(
        () => highlightedRes ? getReservationTables(highlightedRes) : [],
        [highlightedRes]
    );

    // ── Navigation im Reservierungs-Modal (folgt dem Zeitstrahl des Tages) ──
    const reservationNavList = filteredReservations;

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

    // Reservierung antippen → Modal öffnen UND Tische im Plan hervorheben
    const openReservation = (res) => {
        setHighlightedRes(res);
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

    const isToday = filterDate === todayStr;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto">

                {/* ── Sticky header: Titel + Neu + Datumszeile ───────────── */}
                <div className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border">
                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <div>
                            <h1 className="text-lg font-bold text-foreground">Gäste & Tische</h1>
                            <p className="text-xs text-muted-foreground">
                                {format(parseISO(filterDate), "EEEE, d. MMMM", { locale: de })}
                            </p>
                        </div>
                        <div className="flex gap-1.5">
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-semibold">
                            <Users className="w-3.5 h-3.5" />{kpi.guests} Gäste
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 font-semibold">
                            {kpi.frei} frei
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 font-semibold">
                            {kpi.reserviert} reserviert
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 font-semibold">
                            {kpi.offen} offen
                        </span>
                    </div>

                    {/* ── Reservierungen als Zeitstrahl ─────────────────────── */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />Reservierungen
                            </h2>
                            <div className="relative flex-1 max-w-[200px]">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="Name oder Telefon…"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-8 h-9 bg-card border-border text-sm"
                                />
                            </div>
                        </div>

                        {/* Filter-Chips */}
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

                        {/* Chronologische Liste */}
                        {filteredReservations.length === 0 ? (
                            <EmptyState
                                title={searchTerm || statusFilter !== 'alle' ? 'Keine Ergebnisse' : 'Keine Reservierungen'}
                                description={searchTerm || statusFilter !== 'alle'
                                    ? 'Versuchen Sie andere Filter.'
                                    : isToday ? 'Erstellen Sie eine neue Reservierung.' : 'Keine Reservierungen an diesem Tag.'}
                            />
                        ) : (
                            <div className="space-y-2">
                                {filteredReservations.map((res, idx) => {
                                    const tbl = tables.find(t => t.id === res.table || t.table_number === res.table);
                                    const isHighlighted = highlightedRes?.id === res.id;
                                    return (
                                        <button
                                            key={res.id}
                                            onClick={() => openReservation(res)}
                                            className={cn(
                                                'w-full flex items-center gap-3 p-3 rounded-xl border bg-card text-left transition-all card-pressable animate-stagger',
                                                isHighlighted
                                                    ? 'border-amber-500/50 ring-1 ring-amber-500/30'
                                                    : 'border-border hover:bg-accent/50'
                                            )}
                                            style={{ '--delay': `${idx * 40}ms` }}
                                        >
                                            <span className="text-sm font-bold tabular-nums shrink-0 w-12 text-foreground">
                                                {res.time || '–'}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{res.customer_name}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-0.5">
                                                        <Users className="w-3 h-3" />{res.guests} Pers.
                                                    </span>
                                                    {tbl ? (
                                                        <span className="flex items-center gap-0.5">
                                                            <MapPin className="w-3 h-3" />{getTableDisplayName(tbl)}
                                                        </span>
                                                    ) : res.table ? (
                                                        <span className="flex items-center gap-0.5">
                                                            <MapPin className="w-3 h-3" />Tisch {res.table}
                                                        </span>
                                                    ) : (
                                                        <span className="text-amber-500">kein Tisch</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={cn(
                                                'text-[11px] px-2 py-1 rounded-full border font-medium shrink-0',
                                                STATUS_BADGE[res.status] || 'bg-muted text-muted-foreground border-border'
                                            )}>
                                                {res.status}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* ── Tischplan ─────────────────────────────────────────── */}
                    <section className="space-y-3 pt-2">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-sm font-semibold text-foreground">Tischplan</h2>
                            {permissions.isManager && (
                                <div className="flex gap-1.5">
                                    <Button variant="outline" size="sm" onClick={() => setShowRooms(true)} className="h-8 gap-1 text-xs">
                                        <Settings className="w-3.5 h-3.5" /><span className="hidden sm:inline">Räume</span>
                                    </Button>
                                    <Button size="sm" onClick={() => setShowTableModal({})} className="h-8 gap-1 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                                        <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Tisch</span>
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Highlight-Hinweis */}
                        {highlightedRes && (
                            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25">
                                <p className="text-xs text-amber-500 truncate">
                                    Tische für <strong>{highlightedRes.customer_name}</strong> ({highlightedRes.time}) hervorgehoben
                                </p>
                                <button onClick={() => setHighlightedRes(null)} className="text-amber-500 hover:text-foreground shrink-0">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Zeit + Personen + Raum-Filter */}
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

                        <GuestHubTablesTab
                            tableWithStatus={tableWithStatus}
                            stats={stats}
                            guestFilter={guestFilter}
                            suggested={suggested}
                            permissions={permissions}
                            planView={planView}
                            setPlanView={setPlanView}
                            highlightedTableNumbers={highlightedTableNumbers}
                            onTableSelect={setSelectedTable}
                            onTableNewReservation={handleTableNewReservation}
                            onCreateTable={(t) => setShowTableModal(t)}
                            onEditTable={(t) => setShowTableModal(t)}
                        />
                    </section>
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