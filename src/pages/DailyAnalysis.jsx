import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Input } from '@/components/ui/input';
import { Upload, DollarSign, Users, Gift, Loader2, ChevronLeft, ChevronRight, CalendarDays, RefreshCw, CheckCircle2, TrendingDown, Info, Pencil, Check, X, ChevronDown, ChevronUp, ArrowDownToLine, MoreHorizontal, BookOpen } from 'lucide-react';
import { format, parseISO, addDays, subDays, isToday } from 'date-fns';
import { Activity, History } from 'lucide-react';
import BusynessBackfill from '@/components/dailyanalysis/BusynessBackfill';
import { de } from 'date-fns/locale';
import PDFUploadModal from '@/components/dailyanalysis/PDFUploadModal.jsx';
import TipCalculator from '@/components/dailyanalysis/TipCalculator.jsx';
import DailyRevenueList from '@/components/dailyanalysis/DailyRevenueList.jsx';
import InsightsPanel from '@/components/dailyanalysis/InsightsPanel.jsx';
import PeriodAnalysis from '@/components/dailyanalysis/PeriodAnalysis.jsx';
import { cn } from '@/lib/utils';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

// An employee is "daily-paid" (Aushilfe) if their role is Aushilfe OR they have an hourly_rate but no monthly contract
const isDailyPaid = (employee) => {
    if (!employee) return false;
    return employee.role === 'Aushilfe' || (employee.hourly_rate > 0 && employee.contract_type === 'Minijob');
};

function KpiCard({ icon: Icon, label, value, sub, color = 'text-foreground', highlight = false, children }) {
    return (
        <Card className={cn('bg-card border-border', highlight && 'border-amber-500/50 bg-amber-500/5')}>
            <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {label}
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                <div className={cn('text-2xl font-bold', color)}>{value}</div>
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                {children}
            </CardContent>
        </Card>
    );
}

export default function DailyAnalysis() {
    const permissions = usePermissions();
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [backfillOpen, setBackfillOpen] = useState(false);
    const [tipCalculatorOpen, setTipCalculatorOpen] = useState(false);
    const [reanalyzingAll, setReanalyzingAll] = useState(false);
    const [reanalyzeProgress, setReanalyzeProgress] = useState({ done: 0, total: 0, errors: [] });
    const [reanalyzeOpen, setReanalyzeOpen] = useState(false);
    const [viewMode, setViewMode] = useState('tag'); // 'tag' | 'week' | 'month' | 'quarter' | 'year'
    const [editingManual, setEditingManual] = useState(null); // 'daily' | 'fulltime' | null
    const [manualInput, setManualInput] = useState('');
    const [savingManual, setSavingManual] = useState(false);
    const queryClient = useQueryClient();

    const { data: dailyRevenues = [] } = useQuery({
        queryKey: ['daily-revenues'],
        queryFn: () => base44.entities.DailyRevenue.list('-date', 180),
        staleTime: 2 * 60 * 1000,
    });

    const { data: cashbookEntries = [] } = useQuery({
        queryKey: ['cashbook-entries'],
        queryFn: () => base44.entities.CashbookEntry.list('-date', 90),
        staleTime: 2 * 60 * 1000,
    });

    const { data: timeEntries = [] } = useQuery({
        queryKey: ['time-entries'],
        queryFn: () => base44.entities.TimeEntry.list('-date', 500),
        staleTime: 2 * 60 * 1000,
    });

    // ALL entries for selected date (including non-approved) for manual review
    const allTodayEntries = useMemo(() => {
        return timeEntries.filter(te => {
            const opDate = (() => {
                if (!te.start_time) return te.date;
                const h = parseInt(te.start_time.split(':')[0]);
                if (h < 9) {
                    const d = new Date(te.date);
                    d.setDate(d.getDate() - 1);
                    return d.toISOString().split('T')[0];
                }
                return te.date;
            })();
            return opDate === selectedDate;
        });
    }, [timeEntries, selectedDate]);

    const [showTimeImport, setShowTimeImport] = useState(false);
    const [transferring, setTransferring] = useState(false);
    const [transferred, setTransferred] = useState(null); // date of last transfer

    const approveEntryMutation = useMutation({
        mutationFn: (id) => base44.entities.TimeEntry.update(id, { status: 'genehmigt' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-entries'] }),
    });

    const deleteRevenueMutation = useMutation({
        mutationFn: (id) => base44.entities.DailyRevenue.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['daily-revenues'] }),
    });

    const handleDeleteRevenue = (day) => {
        const rev = dailyRevenues.find(r => r.date === day.date);
        if (rev?.id) deleteRevenueMutation.mutate(rev.id);
    };

    const { data: tipDistributions = [] } = useQuery({
        queryKey: ['tip-distributions'],
        queryFn: () => base44.entities.TipDistribution.list('-date', 180),
        staleTime: 2 * 60 * 1000,
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name'),
        staleTime: 5 * 60 * 1000,
    });

    const { data: salesReports = [] } = useQuery({
        queryKey: ['sales-reports'],
        queryFn: () => base44.entities.SalesReport.list('-report_date', 100),
        staleTime: 2 * 60 * 1000,
    });

    const getOperatingDate = (timeEntry) => {
        const startHour = parseInt(timeEntry.start_time.split(':')[0]);
        if (startHour < 9) {
            const prevDate = new Date(timeEntry.date);
            prevDate.setDate(prevDate.getDate() - 1);
            return prevDate.toISOString().split('T')[0];
        }
        return timeEntry.date;
    };

    const todayRevenue = dailyRevenues.find(dr => dr.date === selectedDate);
    const todayTipDistribution = tipDistributions.find(td => td.date === selectedDate);
    const todaySalesReport = salesReports.find(sr => sr.report_date === selectedDate && sr.processing_status === 'completed');
    const employeeMap = useMemo(() => new Map(employees.map(emp => [emp.id, emp])), [employees]);

    // Build enriched time entries for the day
    const todayTimeEntriesWithRates = useMemo(() => {
        const dayEntries = timeEntries.filter(te => getOperatingDate(te) === selectedDate && te.status === 'genehmigt');

        if (todaySalesReport?.labor_costs_details && Array.isArray(todaySalesReport.labor_costs_details)) {
            return todaySalesReport.labor_costs_details.map((detail, idx) => {
                const emp = employees.find(e => e.id === detail.employee_id) || null;
                return {
                    id: `report-${idx}`,
                    employee_id: detail.employee_id || `unknown-${idx}`,
                    employee_name: detail.employee_name || 'Unbekannt',
                    total_hours: detail.hours || 0,
                    hourly_rate: detail.hourly_rate || 0,
                    cost: detail.cost || 0,
                    date: selectedDate,
                    start_time: '',
                    end_time: '',
                    _isDaily: emp ? isDailyPaid(emp) : (detail.hourly_rate > 0),
                    _contractType: emp?.contract_type || '',
                    _role: emp?.role || '',
                };
            });
        }

        return dayEntries.map(te => {
            const emp = employeeMap.get(te.employee_id);
            const hourlyRate = emp?.hourly_rate || 0;
            // Pause wird bei SAVO mitbezahlt → bezahlte Stunden inkl. Pause
            const paidHours = (te.total_hours || 0) + (te.break_minutes || 0) / 60;
            return {
                ...te,
                hourly_rate: hourlyRate,
                cost: paidHours * hourlyRate,
                _isDaily: emp ? isDailyPaid(emp) : false,
                _contractType: emp?.contract_type || '',
                _role: emp?.role || '',
            };
        });
    }, [timeEntries, selectedDate, todaySalesReport, employees, employeeMap]);

    // Split into daily-paid vs full-time
    const dailyPaidEntries = todayTimeEntriesWithRates.filter(e => e._isDaily);
    const fullTimeEntries = todayTimeEntriesWithRates.filter(e => !e._isDaily);

    const calculatedDailyLaborCost = dailyPaidEntries.reduce((s, e) => s + e.cost, 0);
    const calculatedFullTimeLaborCost = fullTimeEntries.reduce((s, e) => s + e.cost, 0);

    // Use manual values if set, otherwise use calculated
    const dailyLaborCost = todayRevenue?.manual_labor_cost_daily ?? calculatedDailyLaborCost;
    const fullTimeLaborCost = todayRevenue?.manual_labor_cost_fulltime ?? calculatedFullTimeLaborCost;
    const totalLaborCost = dailyLaborCost + fullTimeLaborCost;

    const hasManualdaily = todayRevenue?.manual_labor_cost_daily != null;
    const hasManualFulltime = todayRevenue?.manual_labor_cost_fulltime != null;

    const saveManualCost = async (type) => {
        const val = parseFloat(manualInput.replace(',', '.'));
        if (isNaN(val) || val < 0) return;
        setSavingManual(true);
        const field = type === 'daily' ? 'manual_labor_cost_daily' : 'manual_labor_cost_fulltime';
        if (todayRevenue?.id) {
            await base44.entities.DailyRevenue.update(todayRevenue.id, { [field]: val });
        } else {
            await base44.entities.DailyRevenue.create({ date: selectedDate, revenue: 0, [field]: val });
        }
        queryClient.invalidateQueries({ queryKey: ['daily-revenues'] });
        setSavingManual(false);
        setEditingManual(null);
    };

    const clearManualCost = async (type) => {
        const field = type === 'daily' ? 'manual_labor_cost_daily' : 'manual_labor_cost_fulltime';
        if (todayRevenue?.id) {
            await base44.entities.DailyRevenue.update(todayRevenue.id, { [field]: null });
            queryClient.invalidateQueries({ queryKey: ['daily-revenues'] });
        }
    };

    // ── Kassenbuch-Transfer ──────────────────────────────────────────────────────
    // Prüfen ob für dieses Datum bereits ein Z-Abschlag-Eintrag im Kassenbuch existiert
    const alreadyTransferred = cashbookEntries.some(e =>
        e.date === selectedDate && e.source === 'z_abschlag'
    );

    const handleTransferToCashbook = async () => {
        if (!todayRevenue) return;
        setTransferring(true);
        try {
            const entries = [];
            const dateStr = selectedDate;
            const pdfUrl  = todayRevenue.pdf_url || null;
            const notiz   = `Z-Abschlag ${dateStr}${pdfUrl ? ' (Anhang vorhanden)' : ''}`;

            // Bar-Einnahme
            if (todayRevenue.revenue_cash > 0) {
                entries.push({
                    date:           dateStr,
                    time:           '23:59',
                    entry_type:     'Einnahme',
                    amount:         todayRevenue.revenue_cash,
                    amount_net:     todayRevenue.revenue_cash / 1.19,
                    tax_rate:       19,
                    tax_amount:     todayRevenue.revenue_cash - (todayRevenue.revenue_cash / 1.19),
                    category:       'Umsatz Bar',
                    description:    notiz,
                    payment_method: 'Bar',
                    file_url:       pdfUrl,
                    source:         'z_abschlag',
                    status:         'gebucht',
                });
            }

            // EC-Einnahme
            if (todayRevenue.revenue_ec > 0) {
                entries.push({
                    date:           dateStr,
                    time:           '23:59',
                    entry_type:     'Einnahme',
                    amount:         todayRevenue.revenue_ec,
                    amount_net:     todayRevenue.revenue_ec / 1.19,
                    tax_rate:       19,
                    tax_amount:     todayRevenue.revenue_ec - (todayRevenue.revenue_ec / 1.19),
                    category:       'Umsatz EC',
                    description:    notiz,
                    payment_method: 'EC',
                    file_url:       pdfUrl,
                    source:         'z_abschlag',
                    status:         'gebucht',
                });
            }

            // Fallback: nur Gesamtumsatz wenn Bar/EC nicht getrennt
            if (entries.length === 0 && todayRevenue.revenue > 0) {
                entries.push({
                    date:           dateStr,
                    time:           '23:59',
                    entry_type:     'Einnahme',
                    amount:         todayRevenue.revenue,
                    amount_net:     todayRevenue.revenue / 1.19,
                    tax_rate:       19,
                    tax_amount:     todayRevenue.revenue - (todayRevenue.revenue / 1.19),
                    category:       'Umsatz Gesamt',
                    description:    notiz,
                    payment_method: 'Bar',
                    file_url:       pdfUrl,
                    source:         'z_abschlag',
                    status:         'gebucht',
                });
            }

            for (const entry of entries) {
                await base44.entities.CashbookEntry.create(entry);
            }

            queryClient.invalidateQueries({ queryKey: ['cashbook-entries'] });
            setTransferred(dateStr);
        } catch (e) {
            console.error(e);
        } finally {
            setTransferring(false);
        }
    };
    // ─────────────────────────────────────────────────────────────────────────────

    const revenue = todayRevenue?.revenue || 0;
    const barMinusPersonnel = revenue > 0 ? revenue - dailyLaborCost : null;
    const totalRatio = revenue > 0 ? (totalLaborCost / revenue) * 100 : null;
    const dailyRatio = revenue > 0 ? (dailyLaborCost / revenue) * 100 : null;

    const staffCount = new Set(todayTimeEntriesWithRates.map(te => te.employee_id)).size;

    const handleReanalyzeAll = async () => {
        const withPDF = dailyRevenues.filter(r => r.pdf_url);
        if (withPDF.length === 0) { alert('Keine Einträge mit PDF vorhanden.'); return; }
        setReanalyzingAll(true);
        setReanalyzeProgress({ done: 0, total: withPDF.length, errors: [] });
        setReanalyzeOpen(true);
        const errors = [];
        for (let i = 0; i < withPDF.length; i++) {
            const record = withPDF[i];
            try {
                const result = await base44.integrations.Core.InvokeLLM({
                    prompt: `Analysiere diese Z-Abschlag PDF. Extrahiere: Gesamtumsatz, Bar-Umsatz, EC-Umsatz, MwSt, Eigenbedarf. Gib JSON zurück.`,
                    file_urls: [record.pdf_url],
                    response_json_schema: {
                        type: 'object',
                        properties: {
                            revenue: { type: 'number' }, revenue_cash: { type: 'number' },
                            revenue_ec: { type: 'number' }, vat: { type: 'number' },
                            own_consumption: { type: 'number' },
                        },
                        required: ['revenue']
                    }
                });
                if (result.revenue) {
                    await base44.entities.DailyRevenue.update(record.id, {
                        revenue: result.revenue,
                        revenue_cash: result.revenue_cash ?? record.revenue_cash,
                        revenue_ec: result.revenue_ec ?? record.revenue_ec,
                        vat: result.vat ?? record.vat,
                        own_consumption: result.own_consumption ?? record.own_consumption,
                    });
                } else {
                    errors.push(`${record.date}: Kein Umsatz erkannt`);
                }
            } catch (e) {
                errors.push(`${record.date}: ${e.message}`);
            }
            setReanalyzeProgress({ done: i + 1, total: withPDF.length, errors: [...errors] });
        }
        setReanalyzingAll(false);
        queryClient.invalidateQueries({ queryKey: ['daily-revenues'] });
    };

    if (!permissions.canViewAnalytics && !permissions.isManager) return <PermissionDenied />;

    return (
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 pb-24 md:pb-8">

            {/* Header */}
            <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Tagesabrechnung</h1>
                        <p className="text-sm text-muted-foreground">Z-Abschlag · Personal · Trinkgeld</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="w-9 h-9 min-h-[36px]">
                                    <MoreHorizontal className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem
                                    onClick={handleReanalyzeAll}
                                    disabled={reanalyzingAll || dailyRevenues.filter(r => r.pdf_url).length === 0}
                                >
                                    {reanalyzingAll
                                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        : <RefreshCw className="w-4 h-4 mr-2" />
                                    }
                                    PDFs neu analysieren ({dailyRevenues.filter(r => r.pdf_url).length})
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* View mode tabs */}
                <div className="flex gap-1 p-1 bg-card border border-border rounded-xl">
                    {[{k:'tag',l:'Tag'},{k:'week',l:'Woche'},{k:'month',l:'Monat'},{k:'quarter',l:'Quartal'},{k:'year',l:'Jahr'}].map(({k,l}) => (
                        <button key={k} onClick={() => setViewMode(k)}
                            className={cn('flex-1 py-2 text-xs font-semibold rounded-lg transition-all',
                                viewMode === k ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            )}>{l}</button>
                    ))}
                </div>

                {/* Progress */}
                {reanalyzeOpen && (
                    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">
                                {reanalyzingAll ? `Analysiere... ${reanalyzeProgress.done}/${reanalyzeProgress.total}` : `Fertig ${reanalyzeProgress.done}/${reanalyzeProgress.total}`}
                            </p>
                            {!reanalyzingAll && (
                                <button onClick={() => setReanalyzeOpen(false)} className="text-muted-foreground text-xs">✕</button>
                            )}
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5">
                            <div className="bg-amber-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${reanalyzeProgress.total ? (reanalyzeProgress.done / reanalyzeProgress.total) * 100 : 0}%` }} />
                        </div>
                        {!reanalyzingAll && reanalyzeProgress.errors.length === 0 && (
                            <p className="text-xs text-green-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Alle PDFs erfolgreich analysiert.
                            </p>
                        )}
                        {reanalyzeProgress.errors.map((e, i) => <p key={i} className="text-xs text-red-400">⚠️ {e}</p>)}
                    </div>
                )}

                {/* Date picker */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <label className="relative flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border text-foreground cursor-pointer">
                        <CalendarDays className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-medium text-sm flex-1 text-center">
                            {isToday(parseISO(selectedDate))
                                ? 'Heute'
                                : format(parseISO(selectedDate), 'EEE, dd. MMM yyyy', { locale: de })}
                        </span>
                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full" />
                    </label>

                    <button
                        onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                        disabled={isToday(parseISO(selectedDate))}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>

                    {!isToday(parseISO(selectedDate)) && (
                        <button onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                            className="px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 text-sm whitespace-nowrap">
                            Heute
                        </button>
                    )}
                </div>
            </div>

            {/* Period analysis — shown instead of day view when not 'tag' */}
            {viewMode !== 'tag' && (
                <PeriodAnalysis
                    period={viewMode}
                    selectedDate={selectedDate}
                    dailyRevenues={dailyRevenues}
                    timeEntries={timeEntries}
                    tipDistributions={tipDistributions}
                    employees={employees}
                />
            )}

            {viewMode === 'tag' && <InsightsPanel
                revenue={revenue}
                dailyLaborCost={dailyLaborCost}
                fullTimeLaborCost={fullTimeLaborCost}
                dailyPaidCount={dailyPaidEntries.length}
                fullTimeCount={fullTimeEntries.length}
                totalRatio={totalRatio}
                barMinusPersonnel={barMinusPersonnel}
                staffCount={staffCount}
                dailyTimeEntriesCount={todayTimeEntriesWithRates.length}
                hasRevenue={!!todayRevenue}
            />}

            {viewMode === 'tag' && (
            <div className="space-y-4">

            {/* Empty State — kein Z-Abschlag */}
            {!todayRevenue && (
                <Card className="border-dashed border-border bg-card">
                    <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                            <Upload className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">Kein Z-Abschlag für diesen Tag</p>
                            <p className="text-xs text-muted-foreground mt-0.5">PDF hochladen um Umsatz, Personal und Trinkgeld zu analysieren</p>
                        </div>
                        <Button
                            onClick={() => setUploadModalOpen(true)}
                            className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                        >
                            <Upload className="w-4 h-4" /> Z-Abschlag hochladen
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Revenue */}
                <KpiCard icon={DollarSign} label="Tagesumsatz" value={revenue > 0 ? `${revenue.toFixed(2)} €` : '–'} color="text-green-400"
                    sub={todayRevenue?.revenue_cash ? `Bar: ${todayRevenue.revenue_cash.toFixed(2)} €` : undefined}>
                    <Button size="sm" variant="outline" className="mt-2 w-full h-8 text-xs" onClick={() => setUploadModalOpen(true)}>
                        <Upload className="w-3 h-3 mr-1" /> Z-Abschlag
                    </Button>

                </KpiCard>

                {/* Tip */}
                <KpiCard icon={Gift} label="Trinkgeld" value={todayTipDistribution ? `${todayTipDistribution.total_tips.toFixed(2)} €` : '–'} color="text-purple-400"
                    sub={todayTipDistribution ? `${todayTipDistribution.tip_per_person.toFixed(2)} € / Person` : undefined}>
                    <Button size="sm" variant="outline" className="mt-2 w-full h-8 text-xs"
                        onClick={() => setTipCalculatorOpen(true)}
                        disabled={!todayRevenue || todayTimeEntriesWithRates.length === 0}>
                        <Gift className="w-3 h-3 mr-1" /> Berechnen
                    </Button>
                </KpiCard>

                {/* Daily paid labor */}
                <KpiCard icon={Users} label="Aushilfen Personal"
                    value={`${dailyLaborCost.toFixed(2)} €`}
                    color="text-amber-400"
                    sub={hasManualdaily ? '✎ Manuell eingetragen' : (dailyPaidEntries.length > 0
                        ? `${new Set(dailyPaidEntries.map(e => e.employee_id)).size} Pers. · ${dailyPaidEntries.reduce((s, e) => s + e.total_hours, 0).toFixed(1)}h${dailyRatio !== null ? ` · ${dailyRatio.toFixed(1)}%` : ''}`
                        : 'Keine Zeiteinträge')}>
                    {editingManual === 'daily' ? (
                        <div className="mt-2 flex gap-1">
                            <Input type="number" min={0} step={0.01} autoFocus
                                className="h-8 text-sm flex-1" placeholder="0.00"
                                value={manualInput} onChange={e => setManualInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveManualCost('daily'); if (e.key === 'Escape') setEditingManual(null); }} />
                            <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={() => saveManualCost('daily')} disabled={savingManual}>
                                <Check className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditingManual(null)}>
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    ) : (
                        <div className="mt-2 flex gap-1">
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs"
                                onClick={() => { setEditingManual('daily'); setManualInput(dailyLaborCost > 0 ? dailyLaborCost.toFixed(2) : ''); }}>
                                <Pencil className="w-3 h-3 mr-1" />Manuell
                            </Button>
                            {hasManualdaily && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => clearManualCost('daily')} title="Manuellen Wert löschen">
                                    <X className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    )}
                </KpiCard>

                {/* Full-time labor */}
                <KpiCard icon={Users} label="Festangestellte"
                    value={`${fullTimeLaborCost.toFixed(2)} €`}
                    color="text-blue-400"
                    sub={hasManualFulltime ? '✎ Manuell eingetragen' : (fullTimeEntries.length > 0
                        ? `${new Set(fullTimeEntries.map(e => e.employee_id)).size} Pers. · nur Info`
                        : 'Keine Zeiteinträge')}>
                    {editingManual === 'fulltime' ? (
                        <div className="mt-2 flex gap-1">
                            <Input type="number" min={0} step={0.01} autoFocus
                                className="h-8 text-sm flex-1" placeholder="0.00"
                                value={manualInput} onChange={e => setManualInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveManualCost('fulltime'); if (e.key === 'Escape') setEditingManual(null); }} />
                            <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={() => saveManualCost('fulltime')} disabled={savingManual}>
                                <Check className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditingManual(null)}>
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    ) : (
                        <div className="mt-2 flex gap-1">
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs"
                                onClick={() => { setEditingManual('fulltime'); setManualInput(fullTimeLaborCost > 0 ? fullTimeLaborCost.toFixed(2) : ''); }}>
                                <Pencil className="w-3 h-3 mr-1" />Manuell
                            </Button>
                            {hasManualFulltime && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => clearManualCost('fulltime')} title="Manuellen Wert löschen">
                                    <X className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    )}
                </KpiCard>
            </div>

            {/* Betriebsamkeit — 5 Stufen */}
            <Card className="border-border bg-card">
                <CardContent className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            <p className="text-sm font-semibold text-foreground">Betriebsamkeit</p>
                        </div>
                        <button
                            onClick={() => setBackfillOpen(true)}
                            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                            <History className="w-3 h-3" />
                            Historie nachtragen
                        </button>
                    </div>
                    <div className="flex gap-1.5">
                        {[
                            { level: 1, label: 'Ruhig', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', desc: 'Kaum Gäste' },
                            { level: 2, label: 'Entspannt', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', desc: 'Locker' },
                            { level: 3, label: 'Normal', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', desc: 'Üblich' },
                            { level: 4, label: 'Lebhaft', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', desc: 'Viel los' },
                            { level: 5, label: 'Stark', color: 'bg-red-500/15 text-red-400 border-red-500/30', desc: 'Grenzbereich' },
                        ].map(({ level, label, color, desc }) => {
                            const selected = todayRevenue?.busyness_level === level;
                            return (
                                <button
                                    key={level}
                                    onClick={async () => {
                                        try {
                                            if (todayRevenue?.id) {
                                                await base44.entities.DailyRevenue.update(todayRevenue.id, { busyness_level: level });
                                            } else {
                                                await base44.entities.DailyRevenue.create({ date: selectedDate, revenue: 0, busyness_level: level });
                                            }
                                            queryClient.invalidateQueries({ queryKey: ['daily-revenues'] });
                                        } catch (e) { console.error(e); }
                                    }}
                                    className={cn(
                                        'flex-1 py-2.5 rounded-xl border text-center transition-all',
                                        selected
                                            ? cn(color, 'border-2 scale-105 shadow-sm')
                                            : 'border-border text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <span className="text-lg font-bold block leading-none">{level}</span>
                                    <span className="text-[10px] font-medium block mt-0.5">{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Kassenbuch Transfer — prominent nach KPI-Cards */}
            {todayRevenue && (
                <Card className={cn(
                    'border transition-all',
                    alreadyTransferred
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-blue-500/30 bg-blue-500/5'
                )}>
                    <CardContent className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                    alreadyTransferred ? 'bg-green-500/15' : 'bg-blue-500/15'
                                )}>
                                    {alreadyTransferred
                                        ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                                        : <BookOpen className="w-4 h-4 text-blue-400" />
                                    }
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground">Kassenbuch</p>
                                    <p className="text-xs text-muted-foreground">
                                        {alreadyTransferred
                                            ? 'Umsatz bereits übertragen'
                                            : `${todayRevenue.revenue?.toFixed(2) ?? '–'} € bereit zum Übertragen`
                                        }
                                    </p>
                                </div>
                            </div>
                            {alreadyTransferred ? (
                                <Badge className="bg-green-500/15 text-green-400 border-green-500/30 shrink-0">
                                    ✓ Übertragen
                                </Badge>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={handleTransferToCashbook}
                                    disabled={transferring}
                                    className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shrink-0 min-h-[36px]"
                                >
                                    {transferring
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <ArrowDownToLine className="w-3.5 h-3.5" />
                                    }
                                    {transferring ? 'Übertrage…' : 'Ins Kassenbuch'}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bar minus Personnel */}
            {revenue > 0 && (
                <Card className={cn(
                    'border-2',
                    barMinusPersonnel !== null && barMinusPersonnel >= 0
                        ? 'border-green-500/40 bg-green-500/5'
                        : 'border-red-500/40 bg-red-500/5'
                )}>
                    <CardContent className="px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                    <TrendingDown className="w-3.5 h-3.5" />
                                    Bar minus Aushilfen-Personal
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Umsatz − tägliche Personalkosten (ohne Festangestellte)
                                </p>
                            </div>
                            <div className={cn('text-2xl font-bold shrink-0',
                                barMinusPersonnel !== null && barMinusPersonnel >= 0 ? 'text-green-400' : 'text-red-400'
                            )}>
                                {barMinusPersonnel !== null ? `${barMinusPersonnel.toFixed(2)} €` : '–'}
                            </div>
                        </div>
                        {totalRatio !== null && (
                            <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-muted-foreground text-xs">Gesamtpersonalquote</span>
                                    <p className={cn('font-bold', totalRatio > 35 ? 'text-red-400' : totalRatio > 25 ? 'text-amber-400' : 'text-green-400')}>
                                        {totalRatio.toFixed(1)} %
                                    </p>
                                </div>
                                {dailyRatio !== null && dailyRatio !== totalRatio && (
                                    <div>
                                        <span className="text-muted-foreground text-xs">Quote Aushilfen</span>
                                        <p className={cn('font-bold', dailyRatio > 25 ? 'text-amber-400' : 'text-green-400')}>
                                            {dailyRatio.toFixed(1)} %
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        {fullTimeEntries.length > 0 && (
                            <p className="mt-2 text-xs text-muted-foreground flex items-start gap-1">
                                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                                Festangestellte ({fullTimeLaborCost.toFixed(2)} €) werden nicht abgezogen, da ihre Kosten im Monatsgehalt fixiert sind.
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Revenue breakdown */}
            {todayRevenue && (todayRevenue.revenue_cash || todayRevenue.revenue_ec || todayRevenue.vat || todayRevenue.own_consumption) && (
                <Card className="bg-card border-border">
                    <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Umsatz Aufschlüsselung</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 grid grid-cols-2 gap-2">
                        {todayRevenue.revenue_cash > 0 && (
                            <div className="bg-secondary/50 rounded-lg p-2.5">
                                <p className="text-xs text-muted-foreground">Bar</p>
                                <p className="font-bold text-foreground">{todayRevenue.revenue_cash.toFixed(2)} €</p>
                            </div>
                        )}
                        {todayRevenue.revenue_ec > 0 && (
                            <div className="bg-secondary/50 rounded-lg p-2.5">
                                <p className="text-xs text-muted-foreground">EC / Karte</p>
                                <p className="font-bold text-foreground">{todayRevenue.revenue_ec.toFixed(2)} €</p>
                            </div>
                        )}
                        {todayRevenue.vat > 0 && (
                            <div className="bg-secondary/50 rounded-lg p-2.5">
                                <p className="text-xs text-muted-foreground">MwSt.</p>
                                <p className="font-bold text-foreground">{todayRevenue.vat.toFixed(2)} €</p>
                            </div>
                        )}
                        {todayRevenue.own_consumption > 0 && (
                            <div className="bg-secondary/50 rounded-lg p-2.5">
                                <p className="text-xs text-muted-foreground">Eigenbedarf</p>
                                <p className="font-bold text-foreground">{todayRevenue.own_consumption.toFixed(2)} €</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Manual time entry import */}
            <Card className="bg-card border-border">
                <button
                    className="w-full px-4 pt-4 pb-4 flex items-center justify-between"
                    onClick={() => setShowTimeImport(s => !s)}
                >
                    <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-semibold text-foreground">Zeiteinträge manuell abrufen</span>
                        {allTodayEntries.filter(e => e.status !== 'genehmigt').length > 0 && (
                            <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {allTodayEntries.filter(e => e.status !== 'genehmigt').length}
                            </span>
                        )}
                    </div>
                    {showTimeImport ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {showTimeImport && (
                    <CardContent className="px-4 pb-4 pt-0 space-y-2">
                        {allTodayEntries.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2 text-center">Keine Zeiteinträge für diesen Tag gefunden.</p>
                        ) : (
                            allTodayEntries.map(te => {
                                const emp = employeeMap.get(te.employee_id);
                                const isApproved = te.status === 'genehmigt';
                                return (
                                    <div key={te.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground">{te.employee_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {te.start_time && te.end_time ? `${te.start_time} – ${te.end_time} · ` : ''}
                                                {te.total_hours?.toFixed(2)}h{te.break_minutes ? ` · Pause ${te.break_minutes}m` : ''}
                                                {emp?.hourly_rate ? ` · ${(((te.total_hours || 0) + (te.break_minutes || 0) / 60) * emp.hourly_rate).toFixed(2)} €` : ''}
                                            </p>
                                        </div>
                                        {isApproved ? (
                                            <span className="flex items-center gap-1 text-xs text-green-400 font-semibold shrink-0">
                                                <CheckCircle2 className="w-3.5 h-3.5" />Genehmigt
                                            </span>
                                        ) : (
                                            <Button size="sm"
                                                onClick={() => approveEntryMutation.mutate(te.id)}
                                                disabled={approveEntryMutation.isPending}
                                                className="h-8 bg-green-600 hover:bg-green-700 text-white text-xs gap-1 shrink-0">
                                                <Check className="w-3 h-3" />
                                                Übernehmen
                                            </Button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                )}
            </Card>

            {/* Personnel details */}
            {todayTimeEntriesWithRates.length > 0 && (
                <Card className="bg-card border-border">
                    <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Personalkosten Details</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2">
                        {dailyPaidEntries.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-amber-400 mb-1.5">Aushilfen (fließen in Kalkulation ein)</p>
                                {dailyPaidEntries.map(te => (
                                    <div key={te.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{te.employee_name}</p>
                                            <p className="text-xs text-muted-foreground">{((te.total_hours || 0) + (te.break_minutes || 0) / 60).toFixed(1)}h × {te.hourly_rate.toFixed(2)} € (Pause mitbezahlt)</p>
                                        </div>
                                        <span className="font-bold text-amber-400">{te.cost.toFixed(2)} €</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {fullTimeEntries.length > 0 && (
                            <div className={dailyPaidEntries.length > 0 ? 'pt-2' : ''}>
                                <p className="text-xs font-semibold text-blue-400 mb-1.5">Festangestellte (nur Info, nicht in Tageskalkulation)</p>
                                {fullTimeEntries.map(te => (
                                    <div key={te.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 opacity-70">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{te.employee_name}</p>
                                            <p className="text-xs text-muted-foreground">{te.total_hours.toFixed(1)}h · {te._role || te._contractType}</p>
                                        </div>
                                        <span className="font-bold text-blue-400">{te.cost.toFixed(2)} €</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {todaySalesReport && (
                            <p className="text-xs text-muted-foreground pt-1">✓ Daten aus Verkaufsbericht</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Tip distribution */}
            {todayTipDistribution && (
                <Card className="bg-card border-border">
                    <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <Gift className="w-3.5 h-3.5" /> Trinkgeldverteilung
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2">
                        <Alert className="bg-purple-900/20 border-purple-800 py-2">
                            <AlertDescription className="text-purple-300 text-xs">
                                {todayTipDistribution.tip_percentage}% von {todayTipDistribution.total_revenue.toFixed(2)} €
                                = {todayTipDistribution.total_tips.toFixed(2)} € für {todayTipDistribution.employee_count} Personen
                            </AlertDescription>
                        </Alert>
                        {todayTipDistribution.distribution_details?.map((detail, idx) => (
                            <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                                <span className="text-sm font-medium text-foreground">{detail.employee_name}</span>
                                <span className="font-bold text-purple-400">{detail.tip_amount.toFixed(2)} €</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            </div>
            )}

            {/* History — always visible */}
            <DailyRevenueList
                revenues={dailyRevenues}
                timeEntries={timeEntries}
                tipDistributions={tipDistributions}
                employees={employees}
                onSelectDate={(d) => { setSelectedDate(d); setViewMode('tag'); }}
                selectedDate={selectedDate}
                onDelete={handleDeleteRevenue}
            />

            {/* Modals */}
            <PDFUploadModal
                open={uploadModalOpen}
                onOpenChange={setUploadModalOpen}
                selectedDate={selectedDate}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['daily-revenues'] })}
            />
            <TipCalculator
                open={tipCalculatorOpen}
                onOpenChange={setTipCalculatorOpen}
                date={selectedDate}
                revenue={todayRevenue?.revenue || 0}
                staffCount={staffCount}
                timeEntries={todayTimeEntriesWithRates}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['tip-distributions'] })}
            />

            {backfillOpen && <BusynessBackfill onClose={() => setBackfillOpen(false)} />}
        </div>
    );
}