/**
 * BusynessBackfill — Schnell-Bewertungstool für historische Tagesabschlüsse.
 * Swipe durch alte Tage und tippe 1-5. Geht rückwirkend durch alle Einträge
 * die noch kein busyness_level haben.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getDay, parseISO, subDays, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { Activity, ChevronLeft, ChevronRight, Check, SkipForward, Sun, Cloud, CloudRain, Euro } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const BUSYNESS_LEVELS = [
    { level: 1, label: 'Ruhig', color: 'bg-blue-500/15 text-blue-400 border-blue-500/40', emoji: '😴', desc: 'Kaum Gäste, lange Pausen' },
    { level: 2, label: 'Entspannt', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40', emoji: '🙂', desc: 'Locker, normaler Tagesablauf' },
    { level: 3, label: 'Normal', color: 'bg-amber-500/15 text-amber-400 border-amber-500/40', emoji: '😐', desc: 'Üblicher Betrieb' },
    { level: 4, label: 'Lebhaft', color: 'bg-orange-500/15 text-orange-400 border-orange-500/40', emoji: '💪', desc: 'Viel los, alle an den Start' },
    { level: 5, label: 'Stark', color: 'bg-red-500/15 text-red-400 border-red-500/40', emoji: '🔥', desc: 'Grenzbereich, Spitzenlast' },
];

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function getWeatherIcon(code, rain) {
    if (rain > 0) return CloudRain;
    if (code === 0) return Sun;
    return Cloud;
}

export default function BusynessBackfill({ onClose }) {
    const queryClient = useQueryClient();
    const [currentIndex, setCurrentIndex] = useState(0);

    const { data: revenues = [], isLoading } = useQuery({
        queryKey: ['daily-revenues-all-backfill'],
        queryFn: () => base44.entities.DailyRevenue.list('-date', 500),
        staleTime: 5000,
    });

    // Only entries without busyness_level, sorted oldest first (chronological makes more sense)
    const unrated = useMemo(() => {
        return revenues
            .filter(r => !r.busyness_level && r.revenue != null)
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }, [revenues]);

    const totalRated = revenues.length - unrated.length;
    const totalUnrated = unrated.length;

    const rateMutation = useMutation({
        mutationFn: async ({ id, level }) => {
            await base44.entities.DailyRevenue.update(id, { busyness_level: level });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['daily-revenues-all-backfill'] });
            queryClient.invalidateQueries({ queryKey: ['daily-revenues'] });
            queryClient.invalidateQueries({ queryKey: ['daily-revenues-all'] });
        },
    });

    const skipMutation = useMutation({
        mutationFn: async (id) => {
            // Mark as level 3 (normal) to skip
            await base44.entities.DailyRevenue.update(id, { busyness_level: 3 });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['daily-revenues-all-backfill'] });
            queryClient.invalidateQueries({ queryKey: ['daily-revenues'] });
        },
    });

    const handleRate = useCallback((level) => {
        const current = unrated[currentIndex];
        if (!current) return;
        rateMutation.mutate({ id: current.id, level });
        if (currentIndex < unrated.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    }, [unrated, currentIndex, rateMutation]);

    const handleSkip = useCallback(() => {
        const current = unrated[currentIndex];
        if (!current) return;
        skipMutation.mutate(current.id);
        if (currentIndex < unrated.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    }, [unrated, currentIndex, skipMutation]);

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
                <Card className="relative z-10 bg-card border-border p-6">
                    <p className="text-sm text-muted-foreground">Lade Daten…</p>
                </Card>
            </div>
        );
    }

    if (unrated.length === 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
                <Card className="relative z-10 bg-card border-border p-6 text-center max-w-sm">
                    <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-foreground">Alles bewertet!</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {totalRated} Tage mit Betriebsamkeit erfasst.
                    </p>
                    <Button onClick={onClose} className="mt-4 w-full">Schließen</Button>
                </Card>
            </div>
        );
    }

    const current = unrated[currentIndex];
    const dow = current.date ? getDay(parseISO(current.date + 'T12:00:00')) : 0;
    const WeatherIcon = getWeatherIcon(current.weather_code, current.weather_precipitation);

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative z-10 w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">Betriebsamkeit nachtragen</span>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground text-xs">✕</button>
                </div>

                {/* Progress */}
                <div className="px-5 py-2 border-b border-border shrink-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">
                            {currentIndex + 1} von {totalUnrated}
                        </span>
                        <span className="text-[10px] text-emerald-400">
                            {totalRated} bereits erfasst
                        </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${((currentIndex) / totalUnrated) * 100}%` }} />
                    </div>
                </div>

                {/* Day card */}
                <div className="px-5 py-4 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-lg font-bold text-foreground">
                                {DAY_NAMES[dow]}, {current.date && format(parseISO(current.date + 'T12:00:00'), 'dd.MM.yyyy', { locale: de })}
                            </p>
                            {current.weather_description && (
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <WeatherIcon className="w-3 h-3" />
                                        {current.weather_description}
                                        {current.weather_temp_max != null && `, ${current.weather_temp_max.toFixed(0)}°C`}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                            {current.revenue > 0 && (
                                <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                                    <Euro className="w-3 h-3" />
                                    {current.revenue.toFixed(0)}
                                </div>
                            )}
                            {current.weather_precipitation > 0 && (
                                <span className="text-[10px] text-blue-400">
                                    {current.weather_precipitation.toFixed(1)}mm Regen
                                </span>
                            )}
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground mb-3">
                        Wie viel war an diesem Tag los?
                    </p>

                    {/* 5 levels */}
                    <div className="grid grid-cols-5 gap-2">
                        {BUSYNESS_LEVELS.map(({ level, label, color, emoji, desc }) => (
                            <button
                                key={level}
                                onClick={() => handleRate(level)}
                                disabled={rateMutation.isPending}
                                className={cn(
                                    'flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all active:scale-95',
                                    'border-border hover:border-primary/50 hover:bg-primary/5'
                                )}
                            >
                                <span className="text-xl">{emoji}</span>
                                <span className="text-[10px] font-bold text-foreground">{level}</span>
                                <span className="text-[8px] text-muted-foreground text-center leading-tight">{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Descriptions hint */}
                    <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
                        1 = 😴 Ruhig · 3 = 😐 Normal · 5 = 🔥 Stark
                    </p>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-border flex items-center gap-2 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSkip}
                        className="flex-1 text-xs"
                    >
                        <SkipForward className="w-3 h-3 mr-1" />
                        Überspringen (als "Normal")
                    </Button>
                    {currentIndex > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                    )}
                    {currentIndex < unrated.length - 1 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setCurrentIndex(currentIndex + 1)}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
