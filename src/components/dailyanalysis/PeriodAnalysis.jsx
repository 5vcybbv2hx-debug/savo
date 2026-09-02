import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, Users, Gift, CalendarDays, BarChart2, Award, AlertTriangle } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, eachDayOfInterval, subWeeks, subMonths, subQuarters, subYears, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';

const isDailyPaid = (emp) => emp?.role === 'Aushilfe' || (emp?.hourly_rate > 0 && emp?.contract_type === 'Minijob');

function StatRow({ label, value, sub, color = 'text-foreground', highlight }) {
    return (
        <div className={cn('flex items-center justify-between py-2.5 border-b border-border/40 last:border-0', highlight && 'bg-amber-500/5 -mx-4 px-4 rounded')}>
            <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
            </div>
            <p className={cn('font-bold text-base', color)}>{value}</p>
        </div>
    );
}

function MiniBar({ label, value, max, color }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-foreground">{value.toFixed(2)} €</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

const PERIODS = [
    { key: 'week', label: 'Woche' },
    { key: 'month', label: 'Monat' },
    { key: 'quarter', label: 'Quartal' },
    { key: 'year', label: 'Jahr' },
];

function getPeriodRange(key, refDate) {
    const d = typeof refDate === 'string' ? parseISO(refDate) : refDate;
    switch (key) {
        case 'week':   return { start: startOfWeek(d, { weekStartsOn: 1 }), end: endOfWeek(d, { weekStartsOn: 1 }) };
        case 'month':  return { start: startOfMonth(d), end: endOfMonth(d) };
        case 'quarter':return { start: startOfQuarter(d), end: endOfQuarter(d) };
        case 'year':   return { start: startOfYear(d), end: endOfYear(d) };
        default:       return { start: d, end: d };
    }
}

function getPrevRange(key, refDate) {
    const d = typeof refDate === 'string' ? parseISO(refDate) : refDate;
    let prev;
    switch (key) {
        case 'week':    prev = subWeeks(d, 1); break;
        case 'month':   prev = subMonths(d, 1); break;
        case 'quarter': prev = subQuarters(d, 1); break;
        case 'year':    prev = subYears(d, 1); break;
        default:        prev = d;
    }
    return getPeriodRange(key, prev);
}

function periodLabel(key, refDate) {
    const d = typeof refDate === 'string' ? parseISO(refDate) : refDate;
    switch (key) {
        case 'week':    return `KW ${format(startOfWeek(d, { weekStartsOn: 1 }), 'w')} · ${format(startOfWeek(d, { weekStartsOn: 1 }), 'dd. MMM', { locale: de })} – ${format(endOfWeek(d, { weekStartsOn: 1 }), 'dd. MMM yyyy', { locale: de })}`;
        case 'month':   return format(d, 'MMMM yyyy', { locale: de });
        case 'quarter': return `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
        case 'year':    return `Jahr ${d.getFullYear()}`;
        default: return '';
    }
}

export default function PeriodAnalysis({ period, selectedDate, dailyRevenues, timeEntries, tipDistributions, employees }) {
    const [showDayBreakdown, setShowDayBreakdown] = useState(false);

    const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

    const { start, end } = getPeriodRange(period, selectedDate);
    const prevRange = getPrevRange(period, selectedDate);

    const inRange = (dateStr, range) => {
        if (!dateStr) return false;
        const d = parseISO(dateStr);
        return isWithinInterval(d, { start: range.start, end: range.end });
    };

    const periodRevenues = dailyRevenues.filter(r => inRange(r.date, { start, end }));
    const prevRevenues = dailyRevenues.filter(r => inRange(r.date, prevRange));

    // Time entries for period — use operation_date if available, else date
    const periodEntries = timeEntries.filter(te => {
        const dateToCheck = te.operation_date || te.date;
        return dateToCheck && inRange(dateToCheck, { start, end });
    });
    const periodTips = tipDistributions.filter(td => inRange(td.date, { start, end }));

    // Revenue aggregates
    const totalRevenue = periodRevenues.reduce((s, r) => s + (r.revenue || 0), 0);
    const prevRevenue = prevRevenues.reduce((s, r) => s + (r.revenue || 0), 0);
    const daysWithRevenue = periodRevenues.filter(r => r.revenue > 0).length;
    const avgDailyRevenue = daysWithRevenue > 0 ? totalRevenue / daysWithRevenue : 0;
    const bestDay = periodRevenues.reduce((best, r) => (!best || r.revenue > best.revenue) ? r : best, null);
    const worstDay = periodRevenues.filter(r => r.revenue > 0).reduce((worst, r) => (!worst || r.revenue < worst.revenue) ? r : worst, null);

    // Labor aggregates
    const enrichedEntries = useMemo(() => periodEntries.map(te => {
        const emp = employeeMap.get(te.employee_id);
        const rate = emp?.hourly_rate || 0;
        // Pause wird bei SAVO bis 45 Min pro Schicht mitbezahlt
        const paidHours = (te.total_hours || 0) + Math.min(te.break_minutes || 0, 45) / 60;
        return { ...te, _isDaily: emp ? isDailyPaid(emp) : false, cost: paidHours * rate };
    }), [periodEntries, employeeMap]);

    const dailyStaffEntries = enrichedEntries.filter(e => e._isDaily);
    const fullTimeEntries = enrichedEntries.filter(e => !e._isDaily);

    // Use manual overrides from DailyRevenue where available
    const totalDailyLabor = periodRevenues.reduce((s, r) => {
        if (r.manual_labor_cost_daily != null) return s + r.manual_labor_cost_daily;
        const dayEntries = dailyStaffEntries.filter(te => (te.operation_date || te.date) === r.date);
        return s + dayEntries.reduce((ds, te) => ds + te.cost, 0);
    }, 0);
    const totalFullTimeLabor = periodRevenues.reduce((s, r) => {
        if (r.manual_labor_cost_fulltime != null) return s + r.manual_labor_cost_fulltime;
        const dayEntries = fullTimeEntries.filter(te => (te.operation_date || te.date) === r.date);
        return s + dayEntries.reduce((ds, te) => ds + te.cost, 0);
    }, 0);
    const totalLaborCost = totalDailyLabor + totalFullTimeLabor;

    // Tips
    const totalTips = periodTips.reduce((s, t) => s + (t.total_tips || 0), 0);

    // Ratios
    const laborRatio = totalRevenue > 0 ? (totalDailyLabor / totalRevenue) * 100 : null;
    const revenueVsPrev = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null;
    const netRevenue = totalRevenue - totalDailyLabor;

    // Per-day breakdown
    const dayBreakdown = useMemo(() => {
        return periodRevenues
            .filter(r => r.revenue > 0)
            .map(r => {
                const dayStaff = dailyStaffEntries.filter(te => (te.operation_date || te.date) === r.date);
                const labor = r.manual_labor_cost_daily != null ? r.manual_labor_cost_daily : dayStaff.reduce((s, e) => s + e.cost, 0);
                const ratio = r.revenue > 0 ? (labor / r.revenue) * 100 : 0;
                return { date: r.date, revenue: r.revenue, labor, ratio };
            })
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [periodRevenues, dailyStaffEntries]);

    const maxRevenue = Math.max(...dayBreakdown.map(d => d.revenue), 1);

    if (daysWithRevenue === 0) {
        return (
            <Card className="bg-card border-border p-8 text-center">
                <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-semibold">Keine Daten für diesen Zeitraum</p>
                <p className="text-sm text-muted-foreground mt-1">{periodLabel(period, selectedDate)}</p>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Period label */}
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">{periodLabel(period, selectedDate)}</p>
                <Badge variant="outline" className="text-xs">{daysWithRevenue} Tage mit Daten</Badge>
            </div>

            {/* Main KPIs */}
            <div className="grid grid-cols-2 gap-3">
                <Card className="bg-card border-border col-span-2">
                    <CardContent className="px-4 py-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-green-400" />Gesamtumsatz
                        </p>
                        <p className="text-3xl font-bold text-green-400">{totalRevenue.toFixed(2)} €</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <p className="text-xs text-muted-foreground">⌀ {avgDailyRevenue.toFixed(2)} € / Tag</p>
                            {revenueVsPrev !== null && (
                                <span className={cn('flex items-center gap-0.5 text-xs font-semibold', revenueVsPrev >= 0 ? 'text-green-400' : 'text-red-400')}>
                                    {revenueVsPrev >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {revenueVsPrev >= 0 ? '+' : ''}{revenueVsPrev.toFixed(1)}% ggü. Vorperiode
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border">
                    <CardContent className="px-4 py-3">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Users className="w-3 h-3 text-amber-400" />Aushilfen</p>
                        <p className="text-xl font-bold text-amber-400">{totalDailyLabor.toFixed(2)} €</p>
                        {laborRatio !== null && <p className="text-xs text-muted-foreground">{laborRatio.toFixed(1)}% Quote</p>}
                    </CardContent>
                </Card>

                <Card className="bg-card border-border">
                    <CardContent className="px-4 py-3">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Users className="w-3 h-3 text-blue-400" />Festangestellte</p>
                        <p className="text-xl font-bold text-blue-400">{totalFullTimeLabor.toFixed(2)} €</p>
                        <p className="text-xs text-muted-foreground">nur Info</p>
                    </CardContent>
                </Card>

                <Card className={cn('border-2 col-span-2', netRevenue >= 0 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5')}>
                    <CardContent className="px-4 py-3 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Umsatz − Aushilfen</p>
                            <p className="text-xs text-muted-foreground">⌀ {(netRevenue / Math.max(daysWithRevenue, 1)).toFixed(2)} € / Tag</p>
                        </div>
                        <p className={cn('text-2xl font-bold shrink-0', netRevenue >= 0 ? 'text-green-400' : 'text-red-400')}>{netRevenue.toFixed(2)} €</p>
                    </CardContent>
                </Card>

                {totalTips > 0 && (
                    <Card className="bg-card border-border">
                        <CardContent className="px-4 py-3">
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Gift className="w-3 h-3 text-purple-400" />Trinkgeld</p>
                            <p className="text-xl font-bold text-purple-400">{totalTips.toFixed(2)} €</p>
                            <p className="text-xs text-muted-foreground">⌀ {(totalTips / Math.max(daysWithRevenue, 1)).toFixed(2)} €/Tag</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Best / Worst */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5" />Highlights
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-0">
                    {bestDay && <StatRow label="Bester Tag" value={`${bestDay.revenue.toFixed(2)} €`} sub={format(parseISO(bestDay.date), 'EEE, dd. MMM yyyy', { locale: de })} color="text-green-400" />}
                    {worstDay && worstDay.date !== bestDay?.date && <StatRow label="Schwächster Tag" value={`${worstDay.revenue.toFixed(2)} €`} sub={format(parseISO(worstDay.date), 'EEE, dd. MMM yyyy', { locale: de })} color="text-amber-400" />}
                    <StatRow label="Gesamtpersonal (inkl. Fest)" value={`${totalLaborCost.toFixed(2)} €`} sub={totalRevenue > 0 ? `${((totalLaborCost / totalRevenue) * 100).toFixed(1)}% des Umsatzes` : undefined} color="text-foreground" />
                    {daysWithRevenue > 1 && <StatRow label="Tage analysiert" value={daysWithRevenue} />}
                </CardContent>
            </Card>

            {/* Day-by-day breakdown */}
            <Card className="bg-card border-border">
                <button className="w-full px-4 pt-4 pb-4 flex items-center justify-between" onClick={() => setShowDayBreakdown(s => !s)}>
                    <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-amber-400" />
                        Tage im Überblick
                    </span>
                    <span className="text-xs text-muted-foreground">{showDayBreakdown ? 'Ausblenden' : 'Anzeigen'}</span>
                </button>
                {showDayBreakdown && (
                    <CardContent className="px-4 pb-4 pt-0 space-y-4">
                        {dayBreakdown.map(d => (
                            <div key={d.date} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-foreground font-medium">{format(parseISO(d.date), 'EEE, dd. MMM', { locale: de })}</span>
                                    <span className={cn('font-semibold', d.ratio > 30 ? 'text-amber-400' : 'text-muted-foreground')}>
                                        {d.ratio > 0 ? `${d.ratio.toFixed(1)}%` : ''}
                                    </span>
                                </div>
                                <MiniBar label="Umsatz" value={d.revenue} max={maxRevenue} color="bg-green-500" />
                                {d.labor > 0 && <MiniBar label="Aushilfen" value={d.labor} max={maxRevenue} color="bg-amber-500" />}
                            </div>
                        ))}
                    </CardContent>
                )}
            </Card>
        </div>
    );
}