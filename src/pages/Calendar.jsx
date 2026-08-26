import React, { useState, useCallback } from 'react';
import WeatherForecastWidget from '@/components/shifts/WeatherForecastWidget';
import SmartStaffingSuggestions from '@/components/shifts/SmartStaffingSuggestions';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, Users, Filter, X, Download, Zap, MoreHorizontal, CalendarDays } from 'lucide-react';
import { useErrorHandler } from '@/components/error/ErrorHandler';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ShiftCalendar from '@/components/shifts/ShiftCalendar';
import ShiftModal from '@/components/shifts/ShiftModal';
import MobileWeekView from '@/components/shifts/MobileWeekView';
import CalendarExport from '@/components/shifts/CalendarExport';
import ShiftRequirementsManager from '@/components/shifts/ShiftRequirementsManager';
import MonthlyStaffingCheck from '@/components/shifts/MonthlyStaffingCheck';
import DefaultShiftRulesManager from '@/components/shifts/DefaultShiftRulesManager';
import ProvisionalAccessManager from '@/components/provisional/ProvisionalAccessManager';
import ProvisionalShiftEntry from '@/components/provisional/ProvisionalShiftEntry';
import ShiftSwapManager from '@/components/shifts/ShiftSwapManager';
import QuickScheduler from '@/components/shifts/QuickScheduler';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePermissions } from '@/components/auth/usePermissions';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Calendar() {
    const queryClient = useQueryClient();
    const permissions = usePermissions();
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState('calendar');
    const [activeMobileTab, setActiveMobileTab] = useState('calendar');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [filters, setFilters] = useState({ employee: 'all', shiftType: 'all' });
    const [showFilters, setShowFilters] = useState(false);
    const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
    const [mobileWeekStart, setMobileWeekStart] = useState(
        () => startOfWeek(new Date(), { weekStartsOn: 1 })
    );

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: STALE.SLOW,
    });

    // Einheitliche Schicht-Query für Desktop & Mobile — verhindert, dass Änderungen aus
    // Quick-Einplanung, Schichttausch, Direkttausch o.ä. auf der jeweils anderen Ansicht
    // nicht ankommen (beide Plattformen nutzten vorher unterschiedliche Query-Keys für
    // identische Daten).
    const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
        queryKey: ['shifts'],
        queryFn: () => base44.entities.Shift.list('date', 2000),
        staleTime: 2 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
    const { handleError } = useErrorHandler();

    const { data: reservations = [] } = useQuery({
        queryKey: ['reservations', 'active'],
        queryFn: () => base44.entities.Reservation.filter({ is_archived: false }, '-date', 200),
        staleTime: STALE.MEDIUM,
    });

    const { data: requirements = [] } = useQuery({
        queryKey: ['shift-requirements'],
        queryFn: () => base44.entities.ShiftRequirement.list(),
        staleTime: STALE.SLOW,
    });

    const { data: shiftTypes = [] } = useQuery({
        queryKey: ['shift-types'],
        queryFn: () => base44.entities.ShiftType.filter({ is_active: true }, 'order', 50),
        staleTime: STALE.SLOW,
    });

    const { data: vacationRequests = [] } = useQuery({
        queryKey: ['vacation-requests'],
        queryFn: () => base44.entities.VacationRequest.filter({ status: 'genehmigt' }, '-start_date', 200),
        staleTime: 5 * 60 * 1000,
    });

    const { data: swapRequests = [] } = useQuery({
        queryKey: ['shift-swap-requests-open'],
        queryFn: () => base44.entities.ShiftSwapRequest.list('-created_date', 100),
        staleTime: STALE.MEDIUM,
    });

    const { data: provisionalRequests = [] } = useQuery({
        queryKey: ['provisional-shift-requests'],
        queryFn: () => base44.entities.ProvisionalShiftRequest.list('-date', 200),
        staleTime: STALE.MEDIUM,
    });

    const { data: provisionalAccesses = [] } = useQuery({
        queryKey: ['provisional-accesses'],
        queryFn: () => base44.entities.ProvisionalShiftAccess.list('-created_date', 100),
        staleTime: STALE.MEDIUM,
    });

    const { data: currentUser } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me(),
        staleTime: STALE.SLOW,
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Shift.create(data),
        onSuccess: (newShift) => {
            queryClient.setQueryData(['shifts'], (old) => [newShift, ...(old || [])]);
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
            setModalOpen(false);
            setSelectedShift(null);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Shift.update(id, data),
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries(['shifts']);
            const previous = queryClient.getQueryData(['shifts']);
            queryClient.setQueryData(['shifts'], (old) =>
                (old || []).map(shift => shift.id === id ? { ...shift, ...data } : shift)
            );
            return { previous };
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(['shifts'], context.previous);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
            setModalOpen(false);
            setSelectedShift(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Shift.delete(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries(['shifts']);
            const previous = queryClient.getQueryData(['shifts']);
            queryClient.setQueryData(['shifts'], (old) =>
                (old || []).filter(shift => shift.id !== id)
            );
            return { previous };
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(['shifts'], context.previous);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
            setModalOpen(false);
            setSelectedShift(null);
        }
    });

    const handleAddShift = (date, shift = null) => {
        setSelectedShift(shift || null);
        setSelectedDate(date);
        setModalOpen(true);
    };

    const handleSelectShift = (shift) => {
        setSelectedShift(shift);
        setSelectedDate(null);
        setModalOpen(true);
    };

    const handleSave = (data, id) => {
        if (id) {
            updateMutation.mutate({ id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleDelete = (id) => {
        if (confirm('Schicht wirklich löschen?')) {
            deleteMutation.mutate(id);
        }
    };

    const filteredShifts = shifts.filter(shift => {
        if (filters.employee !== 'all' && shift.employee_id !== filters.employee) return false;
        if (filters.shiftType !== 'all' && shift.shift_type !== filters.shiftType) return false;
        return true;
    });

    const selectedDateShifts = selectedDate
        ? filteredShifts
            .filter(s => s.date === format(selectedDate, 'yyyy-MM-dd'))
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
        : [];

    const handleShiftMove = async (shiftId, newDate) => {
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift) return;
        await updateMutation.mutateAsync({
            id: shiftId,
            data: { ...shift, date: format(newDate, 'yyyy-MM-dd') }
        });
    };

    const handleBackup = async () => {
        try {
            const { data } = await base44.functions.invoke('backupShifts');
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `schichten-backup-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (error) {
            console.error('Backup fehlgeschlagen:', error);
        }
    };

    // ─── Mobile layout ───────────────────────────────────────────────────────
    if (isMobile) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                        {permissions.canEditShifts && (
                            <Button
                                size="sm"
                                onClick={() => handleAddShift(new Date())}
                                className="bg-amber-500 hover:bg-amber-600 text-slate-900 flex-shrink-0 h-9"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Schicht
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveMobileTab('quick')}
                            className="border-amber-600/50 text-amber-500 hover:bg-amber-600/10 flex-shrink-0 h-9"
                        >
                            <Zap className="w-4 h-4 mr-1" />
                            Schnellplanung
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    {activeMobileTab === 'quick' ? (
                        <div className="p-4 overflow-y-auto h-full">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-amber-400" />
                                    Schnellplanung
                                </h2>
                                <button
                                    onClick={() => setActiveMobileTab('calendar')}
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                >
                                    ← Kalender
                                </button>
                            </div>
                            <QuickScheduler
                                employees={employees}
                                shiftTypes={shiftTypes}
                                shifts={shifts}
                                onCreateShift={(data) => createMutation.mutate(data)}
                                onDeleteShift={(id) => {
                                    if (confirm('Schicht entfernen?')) deleteMutation.mutate(id);
                                }}
                                onMoveShift={(id, data) => updateMutation.mutate({ id, data })}
                            />
                        </div>
                    ) : (
                        <>
                        <WeatherForecastWidget isManager={permissions.isManager} />
                        <SmartStaffingSuggestions weekStart={mobileWeekStart} employees={employees} />
                        <MobileWeekView
                            shifts={shifts}
                            employees={employees}
                            isLoading={shiftsLoading}
                            onAddShift={handleAddShift}
                            onSaveShift={handleSave}
                            onDeleteShift={handleDelete}
                            weekStart={mobileWeekStart}
                            onWeekChange={(ws) => setMobileWeekStart(ws)}
                        />
                        </>
                    )}
                </div>

                <ShiftModal
                    open={modalOpen}
                    onClose={() => { setModalOpen(false); setSelectedShift(null); }}
                    shift={selectedShift}
                    employees={employees}
                    selectedDate={selectedDate}
                    existingShifts={shifts}
                    onSave={handleSave}
                    onDelete={handleDelete}
                />
            </div>
        );
    }

    // ─── Desktop layout ──────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
                <div className="flex flex-col gap-3 mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Schichtplan</h1>
                        <p className="text-muted-foreground text-sm mt-1">Verwalte die Arbeitszeiten deines Teams</p>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                        <ShiftSwapManager />

                        <Button
                            variant={showFilters ? "secondary" : "outline"}
                            onClick={() => setShowFilters(!showFilters)}
                            className="border-border text-muted-foreground hover:text-foreground"
                        >
                            <Filter className="w-4 h-4 mr-2" />
                            Filter
                        </Button>

                        {permissions.isManager && (
                            <Button
                                variant="outline"
                                onClick={() => setActiveTab('wünsche')}
                                className="border-amber-600/60 text-amber-500 hover:bg-amber-600/10"
                            >
                                <CalendarDays className="w-4 h-4 mr-2" />
                                Schichtwünsche
                            </Button>
                        )}
                        {permissions.isManager && (
                            <Button
                                variant="outline"
                                onClick={() => setActiveTab('quick')}
                                className="border-amber-600/60 text-amber-500 hover:bg-amber-600/10"
                            >
                                <Zap className="w-4 h-4 mr-2" />
                                Schnellplanung
                            </Button>
                        )}

                        {permissions.canEditShifts && (
                            <Button
                                onClick={() => handleAddShift(new Date())}
                                className="bg-amber-600 hover:bg-amber-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Neue Schicht
                            </Button>
                        )}

                        {(permissions.isManager || permissions.isAdmin) && (
                            <Popover open={exportDropdownOpen} onOpenChange={setExportDropdownOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="border-border text-muted-foreground hover:text-foreground" title="Mehr Optionen">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2 space-y-1" align="end">
                                    <p className="text-xs text-muted-foreground px-2 py-1 font-medium uppercase tracking-wide">Export</p>
                                    <Button variant="ghost" size="sm" onClick={() => { handleBackup(); setExportDropdownOpen(false); }} className="w-full justify-start text-muted-foreground hover:text-foreground">
                                        <Download className="w-4 h-4 mr-2" />
                                        JSON Backup
                                    </Button>
                                    <div onClick={() => setExportDropdownOpen(false)}>
                                        <CalendarExport shifts={shifts} reservations={reservations} />
                                    </div>
                                    {permissions.isAdmin && (
                                        <>
                                            <div className="border-t border-border my-1" />
                                            <p className="text-xs text-muted-foreground px-2 py-1 font-medium uppercase tracking-wide">Admin</p>
                                            <div onClick={() => setExportDropdownOpen(false)}><MonthlyStaffingCheck /></div>
                                            <div onClick={() => setExportDropdownOpen(false)}><ShiftRequirementsManager /></div>
                                            <div onClick={() => setExportDropdownOpen(false)}><DefaultShiftRulesManager /></div>
                                        </>
                                    )}
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                </div>

                {showFilters && (
                    <Card className="p-4 bg-card border-border mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                Filter
                            </h3>
                            {(filters.employee !== 'all' || filters.shiftType !== 'all') && (
                                <Button variant="ghost" size="sm" onClick={() => setFilters({ employee: 'all', shiftType: 'all' })} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4 mr-1" />
                                    Zurücksetzen
                                </Button>
                            )}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-muted-foreground mb-2 block">Mitarbeiter</label>
                                <select
                                    value={filters.employee}
                                    onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
                                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-amber-600"
                                >
                                    <option value="all">Alle Mitarbeiter</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground mb-2 block">Schichttyp</label>
                                <select
                                    value={filters.shiftType}
                                    onChange={(e) => setFilters({ ...filters, shiftType: e.target.value })}
                                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-amber-600"
                                >
                                    <option value="all">Alle Schichttypen</option>
                                    <option value="Aufmachen">Aufmachen</option>
                                    <option value="Frühschicht">Frühschicht</option>
                                    <option value="Spätschicht">Spätschicht</option>
                                    <option value="Sonderschicht">Sonderschicht</option>
                                </select>
                            </div>
                        </div>
                        {(filters.employee !== 'all' || filters.shiftType !== 'all') && (
                            <div className="mt-4 text-sm text-muted-foreground">
                                {filteredShifts.length} Schicht{filteredShifts.length !== 1 ? 'en' : ''} gefunden
                            </div>
                        )}
                    </Card>
                )}

                {activeTab === 'calendar' && (
                    <>
                    <WeatherForecastWidget isManager={permissions.isManager} />
                    <SmartStaffingSuggestions weekStart={startOfWeek(new Date(), { weekStartsOn: 1 })} employees={employees} />
                    <ShiftCalendar
                        shifts={filteredShifts}
                        allShifts={shifts}
                        employees={employees}
                        requirements={requirements}
                        vacationRequests={vacationRequests}
                        swapRequests={swapRequests}
                        provisionalRequests={provisionalRequests}
                        onAddShift={handleAddShift}
                        onSelectShift={handleSelectShift}
                        onShiftMove={handleShiftMove}
                        setSelectedDate={setSelectedDate}
                    />
                    </>
                )}

                {activeTab === 'quick' && permissions.isManager && (
                    <div>
                        <button onClick={() => setActiveTab('calendar')} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
                            ← Zurück zum Kalender
                        </button>
                        <QuickScheduler
                            employees={employees}
                            shiftTypes={shiftTypes}
                            shifts={shifts}
                            onCreateShift={(data) => createMutation.mutate(data)}
                            onDeleteShift={(id) => {
                                if (confirm('Schicht entfernen?')) deleteMutation.mutate(id);
                            }}
                            onMoveShift={(id, data) => updateMutation.mutate({ id, data })}
                        />
                    </div>
                )}

                {activeTab === 'wünsche' && permissions.isManager && (
                    <div>
                        <button onClick={() => setActiveTab('calendar')} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
                            ← Zurück zum Kalender
                        </button>
                        <ProvisionalAccessManager employees={employees} />
                    </div>
                )}

                {activeTab === 'calendar' && selectedDate && (
                    <Card className="mt-6 p-5 bg-card border-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-foreground text-lg">
                                {format(selectedDate, "EEEE, d. MMMM yyyy", { locale: de })}
                            </h3>
                            {permissions.canEditShifts && (
                                <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => handleAddShift(selectedDate)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Schicht hinzufügen
                                </Button>
                            )}
                        </div>

                        {selectedDateShifts.length > 0 ? (
                            <div className="grid gap-2">
                                {selectedDateShifts.map(shift => {
                                    const employee = employees.find(e => e.id === shift.employee_id);
                                    return (
                                        <div
                                            key={shift.id}
                                            onClick={() => permissions.canEditShifts && handleSelectShift(shift)}
                                            className={`flex items-center gap-3 p-3 rounded-lg bg-muted transition-colors border border-border ${permissions.canEditShifts ? 'cursor-pointer hover:bg-accent hover:border-amber-600' : 'cursor-default'}`}
                                        >
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                                                style={{ backgroundColor: employee?.color || '#64748b' }}
                                            >
                                                {shift.employee_name?.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-foreground truncate">{shift.employee_name}</p>
                                                    {shift.shift_type && (
                                                        <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30 text-[10px]">
                                                            {shift.shift_type}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground font-mono">
                                                    {shift.start_time} - {shift.end_time}
                                                </p>
                                                {shift.notes && (
                                                    <p className="text-xs text-muted-foreground mt-1 italic truncate">
                                                        {shift.notes}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                                    <Users className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <p className="text-base mb-2 text-foreground">Keine Schichten geplant</p>
                                <p className="text-sm text-muted-foreground">Klicke oben auf "Schicht hinzufügen"</p>
                            </div>
                        )}
                    </Card>
                )}

                <ShiftModal
                    open={modalOpen}
                    onClose={() => { setModalOpen(false); setSelectedShift(null); }}
                    shift={selectedShift}
                    employees={employees}
                    selectedDate={selectedDate}
                    existingShifts={shifts}
                    onSave={handleSave}
                    onDelete={handleDelete}
                />
            </div>
        </div>
    );
}