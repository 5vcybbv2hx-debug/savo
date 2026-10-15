/**
 * TodayBriefCard — kompakter Tages-Brief fürs Manager-Dashboard.
 * Stellt alles Wichtige für heute aus BESTEHENDEN Daten zusammen:
 * Schichten, Wetter, Events/Feiertage, gestriger Tagesabschluss, offene Aufgaben.
 * Kein Tippen, kein Pflegen — nur Lese-Anzeige.
 *
 * Selbst-contained: holt alle Daten per React Query (placeholderData, nie initialData).
 * Leere Daten werden niemals als Fehler gezeigt.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    CalendarDays, CloudRain, Cloud, Sun, CloudSnow, CloudLightning,
    CloudFog, CloudDrizzle, PartyPopper, Receipt, ClipboardList, Sparkles, AlertTriangle, ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { isHoliday, getHolidayName, getHolidayEveInfo } from '@/lib/germanHolidays';

const TODAY = format(new Date(), 'yyyy-MM-dd');
const YESTERDAY = format(subDays(new Date(), 1), 'yyyy-MM-dd');
const TODAY_WEEKDAY = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][new Date().getDay()];

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

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
function useTodayShifts() {
    return useQuery({
        queryKey: ['today-brief-shifts', TODAY],
        queryFn: async () => {
            const items = await base44.entities.Shift.filter({ date: TODAY });
            return (items || [])
                .slice()
                .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
        },
        staleTime: 60 * 1000,
        placeholderData: [],
    });
}

function useTodayWeather() {
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
        queryKey: ['today-brief-weather', companyInfo?.postal_code, companyInfo?.city],
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
                `&timezone=Europe/Berlin&forecast_days=1`
            );
            if (!wRes.ok) return null;
            const wData = await wRes.json();
            if (!wData.daily?.time?.length) return null;
            const i = wData.daily.time.indexOf(TODAY);
            const idx = i >= 0 ? i : 0;
            return {
                code: wData.daily.weather_code[idx],
                tempMax: Math.round(wData.daily.temperature_2m_max[idx]),
                tempMin: Math.round(wData.daily.temperature_2m_min[idx]),
                precip: wData.daily.precipitation_sum[idx]?.toFixed(1),
            };
        },
        enabled: companyInfo !== undefined,
        staleTime: 30 * 60 * 1000,
        retry: 1,
        placeholderData: null,
    });
}

function useTodayEvents() {
    return useQuery({
        queryKey: ['today-brief-events', TODAY],
        queryFn: async () => {
            const items = await base44.entities.LocalEvent.filter({ is_active: true });
            return (items || []).filter(e => {
                if (e.is_active === false) return false;
                const start = e.event_date;
                const end = e.event_end_date || e.event_date;
                if (!start) return false;
                return TODAY >= start && TODAY <= end;
            });
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: [],
    });
}

function useYesterdayRevenue() {
    return useQuery({
        queryKey: ['today-brief-revenue', YESTERDAY],
        queryFn: async () => {
            const items = await base44.entities.DailyRevenue.filter({ date: YESTERDAY });
            return (items || [])[0] || null;
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: null,
    });
}

function useOpenRestockCount() {
    return useQuery({
        queryKey: ['today-brief-restock', TODAY],
        queryFn: async () => {
            const items = await base44.entities.RestockItem.filter({ date: TODAY });
            return (items || []).filter(r => r.is_completed !== true).length;
        },
        staleTime: 60 * 1000,
        placeholderData: 0,
    });
}

function useCleaningTodayProgress() {
    return useQuery({
        queryKey: ['today-brief-cleaning', TODAY_WEEKDAY],
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

export default function TodayBriefCard() {
    const { data: shifts = [] } = useTodayShifts();
    const { data: weather } = useTodayWeather();
    const { data: events = [] } = useTodayEvents();
    const { data: yesterdayRev } = useYesterdayRevenue();
    const openRestock = useOpenRestockCount().data ?? 0;
    const cleaning = useCleaningTodayProgress().data ?? { done: 0, total: 0 };

    const holidayName = getHolidayName(TODAY);
    const holidayEve = getHolidayEveInfo(TODAY);
    const isTodayHoliday = isHoliday(TODAY);

    // ── Shifts ──────────────────────────────────────────────────────────────
    const shiftsContent = shifts.length === 0
        ? <span className="text-muted-foreground">Keine Schichten geplant</span>
        : (
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

    // ── Events ───────────────────────────────────────────────────────────────
    const eventParts = [];
    if (isTodayHoliday && holidayName) eventParts.push(`🎉 ${holidayName}`);
    if (holidayEve) eventParts.push(`${holidayEve.emoji} ${holidayEve.label} (${holidayEve.holidayName})`);
    events.forEach(e => {
        let label = e.event_name || 'Event';
        if (e.staff_adjustment) label += ` (Personal ${e.staff_adjustment > 0 ? '+' : ''}${e.staff_adjustment})`;
        eventParts.push(label);
    });
    const eventsContent = eventParts.length === 0
        ? <span className="text-muted-foreground">Keine Events</span>
        : <span>{eventParts.join(' · ')}</span>;

    // ── Yesterday ───────────────────────────────────────────────────────────
    const yesterdayContent = !yesterdayRev
        ? <span className="text-amber-400">Tagesabschluss gestern fehlt</span>
        : (
            <span>
                {yesterdayRev.revenue != null ? eur.format(yesterdayRev.revenue) : '—'}
                {yesterdayRev.source === 'tagesabschluss' && <span className="text-emerald-400"> · Tagesabschluss ✓</span>}
                {yesterdayRev.busyness_level != null && (
                    <span className="text-muted-foreground"> · Betriebsamkeit {yesterdayRev.busyness_level}/5</span>
                )}
            </span>
        );

    // ── Open tasks ───────────────────────────────────────────────────────────
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
        <Card className="bg-card border-border shadow-lg">
            <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-bold text-foreground">
                        Heute, {format(new Date(), 'EEEE', { locale: de })}, {format(new Date(), 'dd.MM.')}
                    </h2>
                </div>

                <div className="divide-y divide-border/40">
                    <BriefRow icon={CalendarDays} label="Schichten">{shiftsContent}</BriefRow>
                    {weather && (
                        <BriefRow icon={getWeatherInfo(weather.code).icon} label="Wetter">
                            {weather.tempMax}°C, {getWeatherInfo(weather.code).label}
                            {weather.precip > 0 && <span className="text-blue-400"> · {weather.precip}mm</span>}
                        </BriefRow>
                    )}
                    <BriefRow icon={PartyPopper} label="Events & Feiertage">{eventsContent}</BriefRow>
                    <BriefRow icon={Receipt} label="Gestern">{yesterdayContent}</BriefRow>
                    <BriefRow icon={ClipboardList} label="Offen">{openContent}</BriefRow>
                </div>
            </CardContent>
        </Card>
    );
}