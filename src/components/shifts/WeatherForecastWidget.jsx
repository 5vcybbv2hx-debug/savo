/**
 * WeatherForecastWidget — 7-Tage Wettervorhersage für den Schichtplan.
 * Holt Forecast von Open-Meteo (kostenlos, kein API Key).
 * Liest Location dynamisch aus CompanyInfo.
 * Zeigt Wochentag, Wetter-Icon, Temp, Regen + Auslastungs-Indikator
 * basierend auf historischen Durchschnitten pro Wochentag.
 *
 * Props: { isManager }
 */
import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudDrizzle, Thermometer, Droplets, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ── Weather Code → Icon ──────────────────────────────────────────────────────
const WEATHER_ICONS = {
  clear: Sun, partly: Cloud, cloudy: Cloud, fog: CloudFog,
  drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow,
  thunder: CloudLightning,
};

function getWeatherInfo(code) {
  if (code === 0) return { icon: 'clear', label: 'Klar' };
  if (code <= 2) return { icon: 'partly', label: 'Heiter' };
  if (code === 3) return { icon: 'cloudy', label: 'Bewölkt' };
  if (code >= 45 && code <= 48) return { icon: 'fog', label: 'Nebel' };
  if (code >= 51 && code <= 57) return { icon: 'drizzle', label: 'Niesel' };
  if (code >= 61 && code <= 67) return { icon: 'rain', label: 'Regen' };
  if (code >= 71 && code <= 77) return { icon: 'snow', label: 'Schnee' };
  if (code >= 80 && code <= 82) return { icon: 'rain', label: 'Schauer' };
  if (code >= 85 && code <= 86) return { icon: 'snow', label: 'Schneesch.' };
  if (code >= 95) return { icon: 'thunder', label: 'Gewitter' };
  return { icon: 'cloudy', label: '—' };
}

// ── Historical day-of-week averages ──────────────────────────────────────────
function useDayOfWeekAverages() {
  return useQuery({
    queryKey: ['day-of-week-averages'],
    queryFn: async () => {
      const revenues = await base44.entities.DailyRevenue.list('-date', 90);
      if (!revenues || revenues.length === 0) return {};

      const sums = [0,0,0,0,0,0,0];
      const counts = [0,0,0,0,0,0,0];
      for (const r of revenues) {
        if (!r.date || r.revenue == null) continue;
        const dow = new Date(r.date + 'T12:00:00').getDay();
        sums[dow] += r.revenue;
        counts[dow]++;
      }

      const averages = {};
      const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
      let maxAvg = 0;
      for (let i = 0; i < 7; i++) {
        if (counts[i] > 0) {
          averages[dayNames[i]] = sums[i] / counts[i];
          if (averages[dayNames[i]] > maxAvg) maxAvg = averages[dayNames[i]];
        }
      }
      return { averages, maxAvg, counts };
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

function getBusynessLevel(dow, averages, maxAvg) {
  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const dayName = dayNames[dow];
  const avg = averages?.[dayName];
  if (avg == null || !maxAvg) return null;
  const ratio = avg / maxAvg;
  if (ratio >= 0.75) return { level: 'high', label: 'Stark', icon: TrendingUp, color: 'text-emerald-400' };
  if (ratio >= 0.40) return { level: 'medium', label: 'Mittel', icon: Minus, color: 'text-amber-400' };
  return { level: 'low', label: 'Ruhig', icon: TrendingDown, color: 'text-muted-foreground' };
}

export default function WeatherForecastWidget({ isManager }) {
  const { data: companyInfo } = useQuery({
    queryKey: ['company-info'],
    queryFn: async () => {
      const list = await base44.entities.CompanyInfo.list();
      return list?.[0];
    },
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const { data: dowData } = useDayOfWeekAverages();
  const averages = dowData?.averages || {};
  const maxAvg = dowData?.maxAvg || 0;

  const { data: weather, isLoading } = useQuery({
    queryKey: ['weather-forecast', companyInfo?.postal_code],
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
        `&timezone=Europe/Berlin&forecast_days=7`
      );
      if (!wRes.ok) return null;
      const wData = await wRes.json();
      if (!wData.daily?.time) return null;

      return wData.daily.time.map((date, i) => ({
        date,
        code: wData.daily.weather_code[i],
        tempMax: Math.round(wData.daily.temperature_2m_max[i]),
        tempMin: Math.round(wData.daily.temperature_2m_min[i]),
        precip: wData.daily.precipitation_sum[i]?.toFixed(1),
        dow: new Date(date + 'T12:00:00').getDay(),
      }));
    },
    enabled: !!companyInfo,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card className="border-border bg-card animate-pulse">
        <CardContent className="p-3 h-20" />
      </Card>
    );
  }

  if (!weather || weather.length === 0) return null;

  const days = weather.slice(0, 7);

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Thermometer className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">7-Tage Wetter</span>
            {companyInfo?.city && (
              <span className="text-[10px] text-muted-foreground">· {companyInfo.city}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Droplets className="w-3 h-3" />mm
            </span>
          </div>
        </div>

        {/* Days */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {days.map((day) => {
            const wInfo = getWeatherInfo(day.code);
            const Icon = WEATHER_ICONS[wInfo.icon] || Cloud;
            const isToday = day.date === format(new Date(), 'yyyy-MM-dd');
            const dayName = isToday ? 'Heute' : format(new Date(day.date + 'T12:00:00'), 'EEEEE', { locale: de });
            const busyness = getBusynessLevel(day.dow, averages, maxAvg);
            const BusynessIcon = busyness?.icon;

            return (
              <div
                key={day.date}
                className={cn(
                  'flex-shrink-0 w-[52px] flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-colors',
                  isToday && 'bg-primary/10 ring-1 ring-primary/30'
                )}
              >
                <span className={cn(
                  'text-[10px] font-semibold',
                  isToday ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {dayName}
                </span>

                <Icon className={cn(
                  'w-5 h-5',
                  day.code === 0 ? 'text-amber-400' :
                  day.precip > 0 ? 'text-blue-400' :
                  'text-muted-foreground'
                )} />

                <span className="text-[11px] font-bold text-foreground leading-none">
                  {day.tempMax}°
                </span>
                <span className="text-[9px] text-muted-foreground leading-none">
                  {day.tempMin}°
                </span>

                {day.precip > 0 && (
                  <span className="text-[9px] text-blue-400 leading-none flex items-center gap-0.5">
                    <Droplets className="w-2.5 h-2.5" />{day.precip}
                  </span>
                )}

                {busyness && (
                  <span className={cn('flex items-center gap-0.5 text-[8px] font-medium mt-0.5', busyness.color)}>
                    <BusynessIcon className="w-2.5 h-2.5" />
                    {busyness.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {isManager && averages && Object.keys(averages).length > 0 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
            <span className="text-[9px] text-muted-foreground">
              Auslastung aus Ø-Umsatz pro Wochentag (90 Tage)
            </span>
            <div className="flex gap-2">
              <span className="flex items-center gap-0.5 text-[9px] text-emerald-400">
                <TrendingUp className="w-2.5 h-2.5" />Stark
              </span>
              <span className="flex items-center gap-0.5 text-[9px] text-amber-400">
                <Minus className="w-2.5 h-2.5" />Mittel
              </span>
              <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                <TrendingDown className="w-2.5 h-2.5" />Ruhig
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
