/**
 * WeekContextBar — Verschmolzene Wochen-Zeile aus Wetter + Personal-Übersicht.
 * Zeigt pro Tag einen kompatken Chip (z.B. "Di · ☀️ 21° · 5 Pers.").
 * Tap öffnet den Detail-Dialog mit der vollen SmartStaffingSuggestions-Ansicht
 * (Tages-Analyse, Begründungen, Warum?-Link — alles erhalten).
 *
 * Props: { weekStart, shifts, employees, isManager }
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudDrizzle, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SmartStaffingSuggestions from '@/components/shifts/SmartStaffingSuggestions';

const WEATHER_ICONS = {
    clear: Sun, partly: Cloud, cloudy: Cloud, fog: CloudFog,
    drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow, thunder: CloudLightning,
};

function getWeatherInfo(code) {
    if (code === 0) return { icon: 'clear' };
    if (code <= 2) return { icon: 'partly' };
    if (code === 3) return { icon: 'cloudy' };
    if (code >= 45 && code <= 48) return { icon: 'fog' };
    if (code >= 51 && code <= 57) return { icon: 'drizzle' };
    if (code >= 61 && code <= 67) return { icon: 'rain' };
    if (code >= 71 && code <= 77) return { icon: 'snow' };
    if (code >= 80 && code <= 82) return { icon: 'rain' };
    if (code >= 85 && code <= 86) return { icon: 'snow' };
    if (code >= 95) return { icon: 'thunder' };
    return { icon: 'cloudy' };
}

export default function WeekContextBar({ weekStart, shifts = [], employees, isManager }) {
    const [detailOpen, setDetailOpen] = useState(false);

    // Weather fetch (reuses WeatherForecastWidget's Open-Meteo logic)
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

    const { data: weather = [] } = useQuery({
        queryKey: ['weather-forecast', companyInfo?.postal_code],
        queryFn: async () => {
            if (!companyInfo?.city && !companyInfo?.postal_code) return [];
            const query = companyInfo.city || companyInfo.postal_code;
            const geoRes = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=de&format=json`
            );
            const geoData = await geoRes.json();
            if (!geoData.results?.length) return [];
            const { latitude, longitude } = geoData.results[0];
            const wRes = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
                `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
                `&timezone=Europe/Berlin&forecast_days=7`
            );
            if (!wRes.ok) return [];
            const wData = await wRes.json();
            if (!wData.daily?.time) return [];
            return wData.daily.time.map((date, i) => ({
                date,
                code: wData.daily.weather_code[i],
                tempMax: Math.round(wData.daily.temperature_2m_max[i]),
                precip: wData.daily.precipitation_sum[i]?.toFixed(1),
            }));
        },
        enabled: !!companyInfo,
        staleTime: 30 * 60 * 1000,
        retry: 1,
    });

    // Build 7 chips: merge weather + planned shift count by date
    const chips = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = addDays(weekStart, i);
            const dateStr = format(date, 'yyyy-MM-dd');
            const w = weather.find(d => d.date === dateStr);
            const plannedCount = shifts.filter(s => s.date === dateStr).length;
            days.push({
                dateStr,
                dateObj: date,
                dayLabel: format(date, 'EEEEE', { locale: de }),
                isToday: dateStr === format(new Date(), 'yyyy-MM-dd'),
                weather: w,
                plannedCount,
            });
        }
        return days;
    }, [weekStart, weather, shifts]);

    const hasWeather = weather.length > 0;
    if (!hasWeather && shifts.length === 0) return null;

    return (
        <>
            {/* Kompakte Chip-Zeile */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
                {chips.map(chip => {
                    const wInfo = chip.weather ? getWeatherInfo(chip.weather.code) : null;
                    const WIcon = wInfo ? (WEATHER_ICONS[wInfo.icon] || Cloud) : null;

                    return (
                        <button
                            key={chip.dateStr}
                            onClick={() => setDetailOpen(true)}
                            className={cn(
                                'flex-shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border transition-all min-w-[52px]',
                                chip.isToday
                                    ? 'border-primary/40 bg-primary/10'
                                    : 'border-border bg-card hover:bg-accent/30'
                            )}
                        >
                            <span className={cn('text-[10px] font-semibold', chip.isToday ? 'text-primary' : 'text-muted-foreground')}>
                                {chip.dayLabel}
                            </span>
                            {WIcon && (
                                <WIcon className={cn(
                                    'w-4 h-4',
                                    chip.weather.code === 0 ? 'text-amber-400' :
                                    chip.weather.precip > 0 ? 'text-blue-400' :
                                    'text-muted-foreground'
                                )} />
                            )}
                            {chip.weather && (
                                <span className="text-[10px] font-bold text-foreground leading-none">
                                    {chip.weather.tempMax}°
                                </span>
                            )}
                            <span className={cn(
                                'text-[11px] font-bold leading-none',
                                chip.plannedCount > 0 ? 'text-foreground' : 'text-muted-foreground/50'
                            )}>
                                {chip.plannedCount > 0 ? `${chip.plannedCount} Pers.` : '—'}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Detail-Dialog — volle Smart-Expanded-Ansicht mit Empfehlungen */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Brain className="w-4 h-4 text-primary" />
                            Personal-Vorschläge & Wetter
                        </DialogTitle>
                    </DialogHeader>
                    <SmartStaffingSuggestions
                        weekStart={weekStart}
                        employees={employees}
                        isManager={isManager}
                        defaultExpanded
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}