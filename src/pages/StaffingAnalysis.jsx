/**
 * StaffingAnalysis.jsx — Datenbasierte Personalplanungs-Analyse
 * Korreliert Umsatz, Wetter, Events, Personalquote & Saisonalität
 * um Optimierungspotenziale fürs nächste Jahr aufzuzeigen.
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { STALE } from '@/lib/queryUtils';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Link } from 'react-router-dom';
import { format, parseISO, subDays, eachDayOfInterval, isSameDay, getDay, getISOWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Sun, Cloud, CloudRain, Snowflake, CloudFog, CloudSnow, Zap,
    TrendingUp, TrendingDown, Users, Calendar, Thermometer, Droplets,
    Activity, Target, AlertTriangle, ArrowUp, ArrowDown, Minus,
    Loader2, Info, Sparkles, BarChart3
} from 'lucide-react';

// WMO Code → Icon
function weatherIcon(code) {
    if (code == null) return Cloud;
    if (code === 0 || code === 1) return Sun;
    if (code >= 2 && code <= 3) return Cloud;
    if (code >= 45 && code <= 48) return CloudFog;
    if (code >= 51 && code <= 67) return CloudRain;
    if (code >= 71 && code <= 77) return Snowflake;
    if (code >= 80 && code <= 82) return CloudRain;
    if (code >= 85 && code <= 86) return CloudSnow;
    if (code >= 95) return Zap;
    return Cloud;
}

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// ── Sub-Components ────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, trend, accent }) {
    return (
        <Card className="bg-card border-border">
            <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                    <Icon className={cn('w-3.5 h-3.5', accent || 'text-muted-foreground')} />
                </div>
                <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
                {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
            </CardContent>
        </Card>
    );
}

function WeatherRevenueRow({ day }) {
    const WeatherIcon = weatherIcon(day.weather_code);
    return (
        <div className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <WeatherIcon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{day.label}</p>
                <p className="text-[10px] text-muted-foreground">
                    {day.weather_description || '—'} · {day.weather_temp_max != null ? `${day.weather_temp_max.toFixed(0)}°C` : '—'}
                    {day.weather_precipitation > 0 && ` · ${day.weather_precipitation.toFixed(1)}mm`}
                </p>
            </div>
            <div className="text-right shrink-0">
                <p className="text-sm font-bold text-foreground">{day.revenue > 0 ? `${day.revenue.toFixed(0)}€` : '—'}</p>
                <p className="text-[10px] text-muted-foreground">
                    {day.staff_count > 0 ? `${day.staff_count} Pers.` : '—'}
                    {day.labor_ratio != null && ` · ${day.labor_ratio.toFixed(0)}%`}
                </p>
            </div>
        </div>
    );
}

function InsightCard({ icon: Icon, title, text, variant = 'default' }) {
    return (
        <Card className={cn('border', variant === 'warning' ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card')}>
            <CardContent className="p-3 flex gap-3">
                <Icon className={cn('w-4 h-4 shrink-0 mt-0.5',
                    variant === 'warning' ? 'text-amber-500' : 'text-primary')} />
                <div>
                    <p className="text-xs font-semibold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{text}</p>
                </div>
            </CardContent>
        </Card>
    );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function StaffingAnalysis() {
    const permissions = usePermissions();
    const [period, setPeriod] = useState('90d'); // 30d | 90d | 180d | 365d

    const days = period === '30d' ? 30 : period === '90d' ? 90 : period === '180d' ? 180 : 365;
    const startDate = subDays(new Date(), days);

    const { data: revenues = [], isLoading } = useQuery({
        queryKey: ['daily-revenues-analysis', period],
        queryFn: () => base44.entities.DailyRevenue.list('-date', 500),
        staleTime: STALE.LONG,
    });

    const { data: shifts = [] } = useQuery({
        queryKey: ['shifts-analysis', period],
        queryFn: () => base44.entities.Shift.list('date', 2000),
        staleTime: STALE.LONG,
    });

    const { data: localEvents = [] } = useQuery({
        queryKey: ['local-events-analysis'],
        queryFn: () => base44.entities.LocalEvent.list('event_date', 200),
        staleTime: STALE.LONG,
    });

    // ── Data Processing ──────────────────────────────────────────────────────

    const analysisData = useMemo(() => {
        const inRange = revenues.filter(r => {
            const d = new Date(r.date);
            return d >= startDate && r.revenue > 0;
        });

        // Aggregate by day-of-week
        const byDayOfWeek = {};
        for (let i = 0; i < 7; i++) byDayOfWeek[i] = { revenues: [], count: 0 };

        inRange.forEach(rev => {
            const dow = getDay(parseISO(rev.date));
            byDayOfWeek[dow].revenues.push(rev.revenue);
            byDayOfWeek[dow].count++;
        });

        const dayOfWeekStats = Object.entries(byDayOfWeek).map(([day, data]) => {
            const avg = data.revenues.length > 0 ? data.revenues.reduce((a, b) => a + b, 0) / data.revenues.length : 0;
            const max = data.revenues.length > 0 ? Math.max(...data.revenues) : 0;
            const min = data.revenues.length > 0 ? Math.min(...data.revenues) : 0;
            return { day: parseInt(day), avg, max, min, count: data.count };
        }).filter(d => d.count > 0);

        // Weather correlation
        const withWeather = inRange.filter(r => r.weather_temp_max != null);
        const weatherBuckets = {
            'kalt': { revenues: [], temps: [], count: 0, label: '< 10°C', icon: Snowflake },
            'mild': { revenues: [], temps: [], count: 0, label: '10-20°C', icon: Cloud },
            'warm': { revenues: [], temps: [], count: 0, label: '20-25°C', icon: Sun },
            'heiss': { revenues: [], temps: [], count: 0, label: '> 25°C', icon: Sun },
        };
        const rainVsDry = {
            'rain': { revenues: [], count: 0, label: 'Regen (>1mm)' },
            'dry': { revenues: [], count: 0, label: 'Trocken (<1mm)' },
        };

        withWeather.forEach(rev => {
            const t = rev.weather_temp_max;
            const p = rev.weather_precipitation || 0;
            if (t < 10) weatherBuckets.kalt.revenues.push(rev.revenue);
            else if (t < 20) weatherBuckets.mild.revenues.push(rev.revenue);
            else if (t <= 25) weatherBuckets.warm.revenues.push(rev.revenue);
            else weatherBuckets.heiss.revenues.push(rev.revenue);

            if (p > 1) rainVsDry.rain.revenues.push(rev.revenue);
            else rainVsDry.dry.revenues.push(rev.revenue);
        });

        Object.values(weatherBuckets).forEach(b => {
            b.avg = b.revenues.length > 0 ? b.revenues.reduce((a, c) => a + c, 0) / b.revenues.length : 0;
            b.count = b.revenues.length;
        });
        Object.values(rainVsDry).forEach(b => {
            b.avg = b.revenues.length > 0 ? b.revenues.reduce((a, c) => a + c, 0) / b.revenues.length : 0;
            b.count = b.revenues.length;
        });

        // Holiday/vacation impact
        const holidays = inRange.filter(r => r.is_holiday);
        const nonHolidays = inRange.filter(r => !r.is_holiday);
        const holidayAvg = holidays.length > 0 ? holidays.reduce((a, b) => a + b.revenue, 0) / holidays.length : 0;
        const nonHolidayAvg = nonHolidays.length > 0 ? nonHolidays.reduce((a, b) => a + b.revenue, 0) / nonHolidays.length : 0;

        // Event impact
        const eventDays = inRange.filter(r => {
            const events = localEvents.filter(e => e.event_date === r.date || 
                (e.event_end_date && r.date >= e.event_date && r.date <= e.event_end_date));
            return events.length > 0;
        });
        const noEventDays = inRange.filter(r => {
            const events = localEvents.filter(e => e.event_date === r.date ||
                (e.event_end_date && r.date >= e.event_date && r.date <= e.event_end_date));
            return events.length === 0;
        });
        const eventAvg = eventDays.length > 0 ? eventDays.reduce((a, b) => a + b.revenue, 0) / eventDays.length : 0;
        const noEventAvg = noEventDays.length > 0 ? noEventDays.reduce((a, b) => a + b.revenue, 0) / noEventDays.length : 0;

        // Staffing ratio (labor cost / revenue)
        const withStaffing = inRange.filter(r => {
            const dayShifts = shifts.filter(s => s.date === r.date);
            return dayShifts.length > 0;
        }).map(r => {
            const dayShifts = shifts.filter(s => s.date === r.date);
            const laborCost = (r.manual_labor_cost_daily || 0) + (r.manual_labor_cost_fulltime || 0);
            const ratio = r.revenue > 0 ? (laborCost / r.revenue) * 100 : null;
            return { ...r, staff_count: dayShifts.length, labor_cost: laborCost, labor_ratio: ratio };
        });

        // Over/understaffed days
        const avgRatio = withStaffing.length > 0
            ? withStaffing.filter(d => d.labor_ratio != null).reduce((a, b) => a + b.labor_ratio, 0) /
              Math.max(1, withStaffing.filter(d => d.labor_ratio != null).length)
            : 0;

        const overstaffed = withStaffing.filter(d => d.labor_ratio != null && d.labor_ratio > avgRatio * 1.3);
        const understaffed = withStaffing.filter(d => d.labor_ratio != null && d.labor_ratio < avgRatio * 0.7 && d.revenue > 0);

        // Build daily list for display (last 14 days)
        const dailyList = inRange.slice(0, 14).map(r => {
            const dayShifts = shifts.filter(s => s.date === r.date);
            const laborCost = (r.manual_labor_cost_daily || 0) + (r.manual_labor_cost_fulltime || 0);
            const ratio = r.revenue > 0 && laborCost > 0 ? (laborCost / r.revenue) * 100 : null;
            const events = localEvents.filter(e => e.event_date === r.date ||
                (e.event_end_date && r.date >= e.event_date && r.date <= e.event_end_date));
            return {
                ...r,
                label: format(parseISO(r.date), 'EEE dd.MM.', { locale: de }),
                staff_count: dayShifts.length,
                labor_ratio: ratio,
                has_event: events.length > 0,
                event_name: events[0]?.event_name,
            };
        });

        // Monthly seasonality
        const byMonth = {};
        inRange.forEach(r => {
            const m = parseISO(r.date).getMonth();
            if (!byMonth[m]) byMonth[m] = [];
            byMonth[m].push(r.revenue);
        });
        const monthlyStats = Object.entries(byMonth).map(([month, revs]) => ({
            month: parseInt(month),
            avg: revs.reduce((a, b) => a + b, 0) / revs.length,
            count: revs.length,
        })).sort((a, b) => a.month - b.month);

        return {
            totalDays: inRange.length,
            avgRevenue: inRange.length > 0 ? inRange.reduce((a, b) => a + b.revenue, 0) / inRange.length : 0,
            maxRevenue: inRange.length > 0 ? Math.max(...inRange.map(r => r.revenue)) : 0,
            dayOfWeekStats,
            weatherBuckets,
            rainVsDry,
            holidayAvg, nonHolidayAvg,
            eventAvg, noEventAvg,
            withStaffing, avgRatio, overstaffed, understaffed,
            dailyList,
            monthlyStats,
            weatherCoverage: withWeather.length,
        };
    }, [revenues, shifts, localEvents, startDate]);

    if (!permissions.isManager) return <PermissionDenied />;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
        );
    }

    const data = analysisData;

    return (
        <div className="min-h-screen bg-background pb-28 md:pb-8">
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                            Personalplanungs-Analyse
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Datenbasierte Optimierung für nächstes Jahr
                        </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                        <Link to="/Calendar">In den Plan springen</Link>
                    </Button>
                </div>

                {/* Period Selector */}
                <div className="flex gap-2">
                    {[
                        { val: '30d', label: '30 Tage' },
                        { val: '90d', label: '90 Tage' },
                        { val: '180d', label: '6 Monate' },
                        { val: '365d', label: '1 Jahr' },
                    ].map(p => (
                        <button key={p.val} onClick={() => setPeriod(p.val)}
                            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                period === p.val ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground')}>
                            {p.label}
                        </button>
                    ))}
                </div>

                {data.totalDays === 0 ? (
                    <Card className="bg-card border-border">
                        <CardContent className="p-8 text-center">
                            <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Noch nicht genug Tagesabschlüsse in diesem Zeitraum.</p>
                            <p className="text-xs text-muted-foreground mt-1">Mindestens ein Monat Daten für erste Insights.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-3 gap-2">
                            <KpiCard icon={TrendingUp} label="Ø Umsatz/Tag" value={`${data.avgRevenue.toFixed(0)}€`} sub={`${data.totalDays} Tage`} accent="text-green-500" />
                            <KpiCard icon={Target} label="Spitzentag" value={`${data.maxRevenue.toFixed(0)}€`} sub={`Beste Tag-Einnahme`} accent="text-primary" />
                            <KpiCard icon={Thermometer} label="Wetter-Abdeckung" value={`${data.totalDays > 0 ? Math.round(data.weatherCoverage / data.totalDays * 100) : 0}%`} sub={`${data.weatherCoverage} Tage`} accent="text-blue-400" />
                        </div>

                        {/* Insights */}
                        <div className="space-y-2">
                            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-primary" />
                                Erkenntnisse
                            </h2>

                            {/* Weather impact */}
                            {data.weatherBuckets.warm.count > 2 && data.weatherBuckets.kalt.count > 2 && (
                                <InsightCard
                                    icon={Sun}
                                    title="Wetter-Effekt"
                                    text={`An warmen Tagen (20-25°C) liegt der Ø-Umsatz bei ${data.weatherBuckets.warm.avg.toFixed(0)}€, an kalten Tagen (<10°C) bei ${data.weatherBuckets.kalt.avg.toFixed(0)}€ — ${data.weatherBuckets.warm.avg > data.weatherBuckets.kalt.avg ? '+' : ''}${((data.weatherBuckets.warm.avg / Math.max(1, data.weatherBuckets.kalt.avg) - 1) * 100).toFixed(0)}% Differenz.`}
                                />
                            )}

                            {/* Rain impact */}
                            {data.rainVsDry.rain.count > 2 && data.rainVsDry.dry.count > 2 && (
                                <InsightCard
                                    icon={CloudRain}
                                    title="Regen-Effekt"
                                    text={`Regentage: Ø ${data.rainVsDry.rain.avg.toFixed(0)}€ vs. Trockene Tage: Ø ${data.rainVsDry.dry.avg.toFixed(0)}€. ${data.rainVsDry.rain.avg < data.rainVsDry.dry.avg ? 'Regen kostet dich ' + (data.rainVsDry.dry.avg - data.rainVsDry.rain.avg).toFixed(0) + '€ pro Tag.' : 'Regen scheint kein Umsatz-Killer.'}`}
                                />
                            )}

                            {/* Holiday impact */}
                            {data.holidayAvg > 0 && (
                                <InsightCard
                                    icon={Calendar}
                                    title="Feiertag-Effekt"
                                    text={`Feiertage: Ø ${data.holidayAvg.toFixed(0)}€ vs. normale Tage: Ø ${data.nonHolidayAvg.toFixed(0)}€ — ${data.holidayAvg > data.nonHolidayAvg ? '+' : ''}${((data.holidayAvg / Math.max(1, data.nonHolidayAvg) - 1) * 100).toFixed(0)}%.`}
                                />
                            )}

                            {/* Event impact */}
                            {data.eventAvg > 0 && (
                                <InsightCard
                                    icon={Activity}
                                    title="Event-Effekt"
                                    text={`Tage mit lokalen Events: Ø ${data.eventAvg.toFixed(0)}€ vs. ohne: Ø ${data.noEventAvg.toFixed(0)}€ — ${data.eventAvg > data.noEventAvg ? '+' : ''}${((data.eventAvg / Math.max(1, data.noEventAvg) - 1) * 100).toFixed(0)}%.`}
                                />
                            )}

                            {/* Overstaffed */}
                            {data.overstaffed.length > 0 && (
                                <InsightCard
                                    icon={Users}
                                    title="Möglicher Überbesetzung"
                                    text={`${data.overstaffed.length} Tage mit Personalquote >30% über Durchschnitt (${data.avgRatio.toFixed(0)}% Ø). Diese Tage waren unterdurchschnittlich ausgelastet — Personal reduzieren?`}
                                    variant="warning"
                                />
                            )}

                            {/* Understaffed */}
                            {data.understaffed.length > 0 && (
                                <InsightCard
                                    icon={AlertTriangle}
                                    title="Möglicher Unterbesetzung"
                                    text={`${data.understaffed.length} Tage mit Personalquote <30% unter Durchschnitt. Hohes Umsatz-Potenzial — mehr Personal einplanen?`}
                                    variant="warning"
                                />
                            )}
                        </div>

                        {/* Day of Week */}
                        <div>
                            <h2 className="text-sm font-bold text-foreground mb-2">Wochentag-Profil</h2>
                            <Card className="bg-card border-border">
                                <CardContent className="p-3 space-y-2">
                                    {data.dayOfWeekStats.map(d => {
                                        const maxAvg = Math.max(...data.dayOfWeekStats.map(x => x.avg));
                                        const pct = maxAvg > 0 ? (d.avg / maxAvg) * 100 : 0;
                                        return (
                                            <div key={d.day} className="flex items-center gap-3">
                                                <span className="text-xs font-medium text-muted-foreground w-8">{DAY_NAMES[d.day]}</span>
                                                <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden relative">
                                                    <div className="h-full bg-primary/60 rounded-lg" style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="text-xs font-bold text-foreground w-14 text-right">{d.avg.toFixed(0)}€</span>
                                                <span className="text-[10px] text-muted-foreground w-8">{d.count}T</span>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Weather Correlation */}
                        <div>
                            <h2 className="text-sm font-bold text-foreground mb-2">Wetter vs. Umsatz</h2>
                            <Card className="bg-card border-border">
                                <CardContent className="p-3">
                                    <div className="grid grid-cols-4 gap-2">
                                        {Object.entries(data.weatherBuckets).map(([key, b]) => {
                                            const Icon = b.icon;
                                            return (
                                                <div key={key} className="text-center">
                                                    <Icon className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                                                    <p className="text-[10px] text-muted-foreground">{b.label}</p>
                                                    <p className="text-sm font-bold text-foreground mt-0.5">{b.count > 0 ? `${b.avg.toFixed(0)}€` : '—'}</p>
                                                    <p className="text-[9px] text-muted-foreground">{b.count} Tage</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-around text-center">
                                        <div>
                                            <CloudRain className="w-4 h-4 mx-auto text-blue-400 mb-1" />
                                            <p className="text-[10px] text-muted-foreground">Regen Ø</p>
                                            <p className="text-sm font-bold text-foreground">{data.rainVsDry.rain.count > 0 ? `${data.rainVsDry.rain.avg.toFixed(0)}€` : '—'}</p>
                                        </div>
                                        <div>
                                            <Sun className="w-4 h-4 mx-auto text-amber-400 mb-1" />
                                            <p className="text-[10px] text-muted-foreground">Trocken Ø</p>
                                            <p className="text-sm font-bold text-foreground">{data.rainVsDry.dry.count > 0 ? `${data.rainVsDry.dry.avg.toFixed(0)}€` : '—'}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Monthly Seasonality */}
                        {data.monthlyStats.length > 1 && (
                            <div>
                                <h2 className="text-sm font-bold text-foreground mb-2">Saisonalität (Monats-Ø)</h2>
                                <Card className="bg-card border-border">
                                    <CardContent className="p-3 space-y-2">
                                        {data.monthlyStats.map(m => {
                                            const maxAvg = Math.max(...data.monthlyStats.map(x => x.avg));
                                            const pct = maxAvg > 0 ? (m.avg / maxAvg) * 100 : 0;
                                            return (
                                                <div key={m.month} className="flex items-center gap-3">
                                                    <span className="text-xs font-medium text-muted-foreground w-8">{format(new Date(2026, m.month, 1), 'MMM', { locale: de })}</span>
                                                    <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden">
                                                        <div className="h-full bg-primary/40 rounded-lg" style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-foreground w-14 text-right">{m.avg.toFixed(0)}€</span>
                                                </div>
                                            );
                                        })}
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Recent Days List */}
                        <div>
                            <h2 className="text-sm font-bold text-foreground mb-2">Letzte 14 Tage</h2>
                            <Card className="bg-card border-border">
                                <CardContent className="p-3">
                                    {data.dailyList.map(day => (
                                        <WeatherRevenueRow key={day.id || day.date} day={day} />
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Weather Data Status */}
                        {data.weatherCoverage < data.totalDays && (
                            <Card className="border-amber-500/40 bg-amber-500/5">
                                <CardContent className="p-3 flex gap-3 items-start">
                                    <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-foreground">Wetterdaten unvollständig</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {data.weatherCoverage} von {data.totalDays} Tagen haben Wetterdaten.
                                            Die Backend-Function "fetchWeatherData" kann fehlende Daten nachziehen.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}