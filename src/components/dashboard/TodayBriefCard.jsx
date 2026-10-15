/**
 * TodayBriefCard — 3-Taben-Tagesbrief "Gestern / Heute / Morgen".
 * Kompakter Planer + Rückblick fürs Manager-Dashboard (Mobile-First).
 * Default-Tab: Heute. Morgen-Tab ist der wichtigste (Planer für den nächsten Tag).
 *
 * Selbst-contained: holt alle Daten per React Query (placeholderData, nie initialData).
 * Leere Daten werden niemals als Fehler gezeigt.
 * Wetter heute+morgen aus EINEM Open-Meteo-Call (forecast_days=2).
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, addDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    CalendarDays, CloudRain, Cloud, Sun, CloudSnow, CloudLightning,
    CloudFog, CloudDrizzle, PartyPopper, Receipt, ClipboardList, ChevronRight,
    TrendingUp, Moon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { isHoliday, isHolidayEve, getHolidayName, getHolidayEveInfo } from '@/lib/germanHolidays';

const TODAY = format(new Date(), 'yyyy-MM-dd');
const YESTERDAY = format(subDays(new Date(), 1), 'yyyy-MM-dd');
const TOMORROW = format(addDays(new Date(), 1), 'yyyy-MM-dd');
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const TODAY_WEEKDAY = WEEKDAYS[new Date().getDay()];
const TOMORROW_WEEKDAY = WEEKDAYS[(new Date().getDay() + 1) % 7];
const NINETY_DAYS_AGO = format(subDays(new Date(), 90), 'yyyy-MM-dd');

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const eur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// ── Weather code → icon + label (Open-Meteo WMO codes) ───────────────────────
function getWeatherInfo(code) {
    if (code === 0) return { icon: Sun, label: 'Klar' };
    if (code <= 2) return { icon: Cloud, label: 'Heiter' };
    if (code === 3) return { icon: Cloud, label: 'Bewölkt' };
    if (code >= 45 && code <= 48) return { icon: CloudFog, label: 'Nebel' };
    if (code >= 51 && code <= 57) return { icon: CloudDrizzle, label: 'Niesel' };
    if (code >= 61 && code <= 67) return { icon: CloudRain, label: 'Regen' };
    if (code >= 71 && code <= 77) return { icon: CloudSnow, label: 'Schnee' };
    if (code >= 80 && code <= 82) return { icon: CloudRain, label: 'Schauer' };
    if (code >= 85 && code <= 86) return { icon: CloudSnow, label: 'Schneesch.' };
    if (code >= 95) return { icon: CloudLightning, label: 'Gewitter' };
    return { icon: Cloud, label: '—' };
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Schichten für ein beliebiges Datum (heute oder morgen). */
function useDayShifts(dateStr) {
    return useQuery({
        queryKey: ['brief-shifts', dateStr],
        queryFn: async () => {
            const items = await base44.entities.Shift.filter({ date: dateStr });
            return (items || [])
                .slice()
                .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
        },
        staleTime: 60 * 1000,
        placeholderData: [],
    });
}

/** Wetter heute + morgen aus einem Open-Meteo-Call (forecast_days=2). */
function useWeather() {
    const { data: companyInfoRaw } = useQuery({
        queryKey: ['company-info'],
        queryFn: async () => {
            const list = await base44.entities.CompanyInfo.list();
            return list?.[0];
        },
        staleTime: 30 * 60 * 1000,
        retry: 1,
    });
    const companyInfo = Array.isArray(companyInfoRaw) ? companyInfoRaw[0] : companyInfoRaw;

    return useQuery({
        queryKey: ['brief-weather', companyInfo?.postal_code, companyInfo?.city],
        queryFn: async () => {
            if (!companyInfo?.city && !companyInfo?.postal_code) return null;
            const query = companyInfo.city || companyInfo.postal_code;
            const geoRes = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=de&format=json`
            );
            const geoData = await geoRes.json();
            if (!geoData.results?.length) return null;
            const { latitude, longitude } = geoData.results[0];
            const wRes = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
                `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
                `&timezone=Europe/Berlin&forecast_days=2`
            );
            if (!wRes.ok) return null;
            const wData = await wRes.json();
            if (!wData.daily?.time?.length) return null;
            const pick = (dateStr) => {
                const idx = wData.daily.time.indexOf(dateStr);
                if (idx < 0) return null;
                return {
                    code: wData.daily.weather_code[idx],
                    tempMax: Math.round(wData.daily.temperature_2m_max[idx]),
                    tempMin: Math.round(wData.daily.temperature_2m_min[idx]),
                    precip: wData.daily.precipitation_sum[idx]?.toFixed(1),
                };
            };
            return { today: pick(TODAY), tomorrow: pick(TOMORROW) };
        },
        enabled: companyInfo !== undefined,
        staleTime: 30 * 60 * 1000,
        retry: 1,
        placeholderData: null,
    });
}

/** Events/Feiertage für ein beliebiges Datum. */
function useDayEvents(dateStr) {
    return useQuery({
        queryKey: ['brief-events', dateStr],
        queryFn: async () => {
            const items = await base44.entities.LocalEvent.filter({ is_active: true });
            return (items || []).filter(e => {
                if (e.is_active === false) return false;
                const start = e.event_date;
                const end = e.event_end_date || e.event_date;
                if (!start) return false;
                return dateStr >= start && dateStr <= end;
            });
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: [],
    });
}

/** Gestriger Tagesabschluss (einzelner Record). */
function useYesterdayRevenue() {
    return useQuery({
        queryKey: ['brief-revenue', YESTERDAY],
        queryFn: async () => {
            const items = await base44.entities.DailyRevenue.filter({ date: YESTERDAY });
            return (items || [])[0] || null;
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: null,
    });
}

/** DailyRevenue der letzten 90 Tage — Basis für die Wochen-Tages-Referenz. */
function useRevenueLast90Days() {
    return useQuery({
        queryKey: ['brief-revenue-90d'],
        queryFn: async () => {
            const items = await base44.entities.DailyRevenue.filter({ date: { $gte: NINETY_DAYS_AGO } });
            return items || [];
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: [],
    });
}

/** Offene Auffüll-Positionen heute. */
function useOpenRestockCount() {
    return useQuery({
        queryKey: ['brief-restock', TODAY],
        queryFn: async () => {
            const items = await base44.entities.RestockItem.filter({ date: TODAY });
            return (items || []).filter(r => r.is_completed !== true).length;
        },
        staleTime: 60 * 1000,
        placeholderData: 0,
    });
}

/** Putzliste-Fortschritt heute. */
function useCleaningTodayProgress() {
    return useQuery({
        queryKey: ['brief-cleaning', TODAY_WEEKDAY],
        queryFn: async () => {
            const items = await base44.entities.CleaningTask.filter({ is_active: true });
            const tasks = (items || []).filter(t => {
                if (t.area === 'Wochentagsaufgaben') return false;
                if (t.is_active === false) return false;
                if (t.due_weekdays && t.due_weekdays.length > 0 && !t.due_weekdays.includes(TODAY_WEEKDAY)) return false;
                return true;
            });
            return {
                done: tasks.filter(t => t.is_completed).length,
                total: tasks.length,
            };
        },
        staleTime: 60 * 1000,
        placeholderData: { done: 0, total: 0 },
    });
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Ø-Umsatz + Ø-Betriebsamkeit für einen Wochentag aus den 90-Tage-Daten. */
function computeWeekdayAverage(records, weekdayName) {
    const matching = records.filter(r => {
        if (!r.date) return false;
        try {
            return WEEKDAYS[parseISO(r.date).getDay()] === weekdayName;
        } catch { return false; }
    });
    if (matching.length < 3) return null;
    const revs = matching.filter(r => r.revenue != null);
    const avgRev = revs.length ? revs.reduce((s, r) => s + r.revenue, 0) / revs.length : null;
    const busy = matching.filter(r => r.busyness_level != null);
    const avgBusy = busy.length ? busy.reduce((s, r) => s + r.busyness_level, 0) / busy.length : null;
    return { avgRev, avgBusy, count: matching.length };
}

// ── Row component ───────────────────────────────────────────────────────────
function BriefRow({ icon: Icon, label, children, accent }) {
    return (
        <div className="flex items-start gap-2.5 py-1.5">
            <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', accent || 'text-muted-foreground')} />
            <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                <div className="text-sm text-foreground leading-snug">{children}</div>
            </div>
        </div>
    );
}

/** Schichten-Block (heute oder morgen identisch). */
function ShiftsRow({ shifts }) {
    if (shifts.length === 0) {
        return <span className="text-muted-foreground">Keine Schichten geplant</span>;
    }
    return (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
            {shifts.map(s => {
                const hasNote = s.notes && s.notes.trim().length > 0;
                return (
                    <span key={s.id} className={cn('inline-flex items-center gap-1', hasNote && 'text-amber-400')}>
                        {s.employee_name || '—'}
                        <span className="text-muted-foreground">
                            {s.start_time || '?'}-{s.end_time || '?'}
                        </span>
                    </span>
                );
            })}
        </div>
    );
}

/** Events-Block für ein Datum (inkl. Feiertag/Vorabend). */
function EventsRowContent({ dateStr, events }) {
    const holidayName = getHolidayName(dateStr);
    const holidayEve = getHolidayEveInfo(dateStr);
    const dayIsHoliday = isHoliday(dateStr);
    const dayIsHolidayEve = isHolidayEve(dateStr);

    const parts = [];
    if (dayIsHoliday && holidayName) parts.push(`🎉 ${holidayName}`);
    if (dayIsHolidayEve && holidayEve) parts.push(`${holidayEve.emoji} ${holidayEve.label} (${holidayEve.holidayName})`);
    events.forEach(e => {
        let label = e.event_name || 'Event';
        if (e.staff_adjustment) label += ` (Personal ${e.staff_adjustment > 0 ? '+' : ''}${e.staff_adjustment})`;
        parts.push(label);
    });
    if (parts.length === 0) return <span className="text-muted-foreground">Keine Events</span>;
    return <span>{parts.join(' · ')}</span>;
}

// ── Hauptkomponente ─────────────────────────────────────────────────────────
export default function TodayBriefCard() {
    const [tab, setTab] = useState('heute'); // 'gestern' | 'heute' | 'morgen'

    // Daten für alle Tabs (Hooks immer aufrufen)
    const todayShifts = useDayShifts(TODAY).data ?? [];
    const tomorrowShifts = useDayShifts(TOMORROW).data ?? [];
    const { data: weather } = useWeather();
    const todayEvents = useDayEvents(TODAY).data ?? [];
    const tomorrowEvents = useDayEvents(TOMORROW).data ?? [];
    const { data: yesterdayRev } = useYesterdayRevenue();
    const revenue90d = useRevenueLast90Days().data ?? [];
    const openRestock = useOpenRestockCount().data ?? 0;
    const cleaning = useCleaningTodayProgress().data ?? { done: 0, total: 0 };

    // Header-Datum je Tab
    const headerDate = tab === 'gestern' ? YESTERDAY : tab === 'morgen' ? TOMORROW : TODAY;
    const headerPrefix = tab === 'gestern' ? 'Gestern' : tab === 'morgen' ? 'Morgen' : 'Heute';
    const headerLabel = `${headerPrefix}, ${format(parseISO(headerDate), 'EEEE', { locale: de })}, ${format(parseISO(headerDate), 'dd.MM.')}`;

    const tomorrowWeather = weather?.tomorrow;
    const todayWeather = weather?.today;
    const weekdayAvg = computeWeekdayAverage(revenue90d, TOMORROW_WEEKDAY);

    // ── Tab-GESTERN ──────────────────────────────────────────────────────────
    const renderGestern = () => (
        <div className="divide-y divide-border/40">
            <BriefRow icon={Receipt} label="Umsatz">
                {!yesterdayRev
                    ? <span className="text-amber-400">Tagesabschluss fehlt</span>
                    : <span>
                        {yesterdayRev.revenue != null ? eur.format(yesterdayRev.revenue) : '—'}
                        {yesterdayRev.source === 'tagesabschluss'
                            && <span className="text-emerald-400"> · Tagesabschluss ✓</span>}
                    </span>}
            </BriefRow>
            {yesterdayRev?.busyness_level != null && (
                <BriefRow icon={TrendingUp} label="Betriebsamkeit">
                    {yesterdayRev.busyness_level}/5
                </BriefRow>
            )}
        </div>
    );

    // ── Tab-HEUTE ────────────────────────────────────────────────────────────
    const renderHeute = () => {
        // Events heute
        const eventsContent = <EventsRowContent dateStr={TODAY} events={todayEvents} />;

        // Offene Aufgaben
        const openParts = [];
        if (openRestock > 0) {
            openParts.push(
                <Link key="restock" to={createPageUrl('Restock')} className="text-primary hover:underline inline-flex items-center gap-0.5">
                    {openRestock} offene Auffüll-Positionen <ChevronRight className="w-3 h-3" />
                </Link>
            );
        }
        if (cleaning.total > 0) {
            openParts.push(
                <Link key="cleaning" to={createPageUrl('Cleaning')} className="hover:underline inline-flex items-center gap-0.5">
                    Putzliste {cleaning.done}/{cleaning.total}
                </Link>
            );
        }
        const openContent = openParts.length === 0
            ? <span className="text-emerald-400">Alles erledigt ✓</span>
            : <span className="flex flex-wrap gap-x-3 gap-y-1">{openParts.map((p, i) => <React.Fragment key={i}>{p}{i < openParts.length - 1 && <span className="text-muted-foreground">·</span>}</React.Fragment>)}</span>;

        return (
            <div className="divide-y divide-border/40">
                <BriefRow icon={CalendarDays} label="Schichten"><ShiftsRow shifts={todayShifts} /></BriefRow>
                {todayWeather && (
                    <BriefRow icon={getWeatherInfo(todayWeather.code).icon} label="Wetter">
                        {todayWeather.tempMax}°C, {getWeatherInfo(todayWeather.code).label}
                        {todayWeather.precip > 0 && <span className="text-blue-400"> · {todayWeather.precip}mm</span>}
                    </BriefRow>
                )}
                <BriefRow icon={PartyPopper} label="Events & Feiertage">{eventsContent}</BriefRow>
                <BriefRow icon={ClipboardList} label="Offen">{openContent}</BriefRow>
            </div>
        );
    };

    // ── Tab-MORGEN ───────────────────────────────────────────────────────────
    const renderMorgen = () => {
        const holidayName = getHolidayName(TOMORROW);
        const isTomorrowHoliday = isHoliday(TOMORROW);
        const isTomorrowHolidayEve = isHolidayEve(TOMORROW);
        const holidayEveInfo = getHolidayEveInfo(TOMORROW);

        return (
            <div className="divide-y divide-border/40">
                <BriefRow icon={CalendarDays} label="Schichten"><ShiftsRow shifts={tomorrowShifts} /></BriefRow>
                {tomorrowWeather && (
                    <BriefRow icon={getWeatherInfo(tomorrowWeather.code).icon} label="Wetter">
                        {tomorrowWeather.tempMax}°C, {getWeatherInfo(tomorrowWeather.code).label}
                        {tomorrowWeather.precip > 0 && <span className="text-blue-400"> · {tomorrowWeather.precip}mm</span>}
                    </BriefRow>
                )}
                {(isTomorrowHoliday || isTomorrowHolidayEve) && (
                    <BriefRow icon={PartyPopper} label="Feiertag" accent="text-amber-400">
                        <div className="flex flex-col gap-0.5">
                            {isTomorrowHoliday && holidayName && (
                                <span className="font-semibold text-amber-400">Feiertag: {holidayName}</span>
                            )}
                            {isTomorrowHolidayEve && holidayEveInfo && (
                                <span className="text-amber-400">
                                    Feiertags-Vorabend → Partyabend-Potenzial ({holidayEveInfo.holidayName})
                                </span>
                            )}
                        </div>
                    </BriefRow>
                )}
                <BriefRow icon={PartyPopper} label="Events">
                    <EventsRowContent dateStr={TOMORROW} events={tomorrowEvents} />
                </BriefRow>
                {weekdayAvg && (
                    <BriefRow icon={TrendingUp} label={`Ø letzter ${TOMORROW_WEEKDAY}`}>
                        {weekdayAvg.avgRev != null ? eur0.format(weekdayAvg.avgRev) : '—'}
                        {weekdayAvg.avgBusy != null && (
                            <span className="text-muted-foreground"> · Betriebsamkeit Ø {weekdayAvg.avgBusy.toFixed(1)}</span>
                        )}
                    </BriefRow>
                )}
            </div>
        );
    };

    const tabs = [
        { key: 'gestern', label: 'Gestern' },
        { key: 'heute', label: 'Heute' },
        { key: 'morgen', label: 'Morgen' },
    ];

    return (
        <Card className="bg-card border-border shadow-lg">
            <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-bold text-foreground">{headerLabel}</h2>
                </div>

                {/* Segmented Control */}
                <div className="flex gap-1 p-0.5 mb-3 rounded-lg bg-secondary/60">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={cn(
                                'flex-1 py-1.5 text-xs font-semibold rounded-md transition-all',
                                tab === t.key
                                    ? 'bg-primary text-primary-foreground shadow'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab-Inhalt */}
                {tab === 'gestern' && renderGestern()}
                {tab === 'heute' && renderHeute()}
                {tab === 'morgen' && renderMorgen()}
            </CardContent>
        </Card>
    );
}