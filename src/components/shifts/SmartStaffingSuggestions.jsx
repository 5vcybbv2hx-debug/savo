/**
 * SmartStaffingSuggestions — KI-gestützte Personalvorschläge
 * 
 * Analysiert historische Daten (DailyRevenue + Shifts) für denselben
 * Wochentag im gleichen Monatszeitraum und gibt konkrete Empfehlungen:
 * 
 * "Letztes Jahr am 1. Juni-Samstag: 6 Personen, 24°C, 1800€ Umsatz,
 *  Personalquote 28% → dieses Jahr: 5 planen"
 *
 * Wird aktiv, sobald genügend historische Daten vorhanden sind (≥30 Tage).
 */
import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, subDays, startOfWeek, endOfWeek, getDay, isSameDay, parseISO, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { Brain, TrendingUp, TrendingDown, Users, Cloud, Sun, CloudRain, Calendar, AlertCircle, Lightbulb, ChevronDown, ChevronUp, History } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isHoliday, isHolidayEve, isBridgeDay, getHolidayName, getSeason, getHolidayEveInfo } from '@/lib/germanHolidays';
import useStaffingFactors, {
    getEventStaffBoost, getReservationsForDate, getReservationGuests,
    getUnavailableEmployeeIds,
} from '@/hooks/useStaffingFactors';
import { getSchoolVacation } from '@/lib/schoolVacations';

// Tunable Konstanten für Event-/Reservierungs-Boost (leicht anpassbar)
const EVENT_BOOST = {
    SMALL_MAX: 40,    // < 40 Gäste → +1
    MEDIUM_MAX: 100,  // 40–100 Gäste → +2
    // > 100 Gäste → +3
};
const RESERVATION_BOOST_THRESHOLD = 30; // ab 30 Reservierungs-Personen → +1

const BUSYNESS_LABELS = {
    1: { label: 'Ruhig', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    2: { label: 'Entspannt', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    3: { label: 'Normal', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    4: { label: 'Lebhaft', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    5: { label: 'Stark', color: 'text-red-400', bg: 'bg-red-500/10' },
};

function getWeatherIcon(code) {
    if (code == null) return Cloud;
    if (code === 0) return Sun;
    if (code >= 51 && code <= 82) return CloudRain;
    return Cloud;
}

function getDayName(dayOfWeek) {
    return ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][dayOfWeek];
}

/**
 * Prüft, ob ein LocalEvent (inkl. jährlicher Wiederholung) auf ein Datum fällt.
 * Berücksichtigt: einmalige Events, mehrtägige Events, annual_fixed (festes Datum),
 * annual_floating (z.B. "2. Freitag im Juli").
 */
function localEventMatchesDate(event, dateStr) {
    if (!event || event.is_active === false) return false;
    const target = parseISO(dateStr + 'T12:00:00');

    // Einmaliges oder mehrtägiges Event (direkter Datums-Treffer)
    if (event.event_date === dateStr) return true;
    if (event.event_end_date && event.event_date <= dateStr && event.event_end_date >= dateStr) return true;

    // Jährliche Wiederholung
    const pattern = event.recurrence_pattern;
    if (pattern === 'none' || !pattern) return false;

    const baseDate = parseISO(event.event_date + 'T12:00:00');
    if (target < baseDate) return false; // nur ab erstem Vorkommen

    if (pattern === 'annual_fixed') {
        // Gleicher Monat/Tag in jedem Jahr
        return baseDate.getMonth() === target.getMonth() && baseDate.getDate() === target.getDate();
    }

    if (pattern === 'annual_floating') {
        // Gleicher Wochentag in gleicher Woche des Monats
        const month = event.recurrence_base_month;
        const week = event.recurrence_week;      // 'first','second','third','fourth','last'
        const weekday = event.recurrence_weekday; // 0=So..6=Sa
        if (month == null || !week || weekday == null) return false;
        if (target.getMonth() !== month - 1) return false;
        if (target.getDay() !== weekday) return false;
        // Prüfe, ob target in der richtigen Woche des Monats liegt
        const dayOfMonth = target.getDate();
        const weekOfMonth = Math.ceil(dayOfMonth / 7);
        if (week === 'last') {
            // Letzte Woche: prüfen, ob im nächsten Monat kein gleicher Wochentag mehr folgt
            const nextWeek = new Date(target);
            nextWeek.setDate(dayOfMonth + 7);
            return nextWeek.getMonth() !== target.getMonth();
        }
        const weekMap = { first: 1, second: 2, third: 3, fourth: 4 };
        return weekMap[week] === weekOfMonth;
    }

    return false;
}

export default function SmartStaffingSuggestions({ weekStart, employees }) {
    const [expanded, setExpanded] = useState(false);

    // 4 Faktoren: Events, Reservierungen, Urlaub, Unverfügbarkeit (zentraler Hook)
    const { events: confirmedEvents, reservations, vacations, unavailabilities } = useStaffingFactors();
    const totalEmployees = employees?.length || 0;

    // Fetch all DailyRevenue + Shifts (cached for 10min)
    const { data: revenues = [] } = useQuery({
        queryKey: ['daily-revenues-all'],
        queryFn: () => base44.entities.DailyRevenue.list('-date', 500),
        staleTime: 10 * 60 * 1000,
        retry: 1,
    });

    const { data: allShifts = [] } = useQuery({
        queryKey: ['shifts-all-historical'],
        queryFn: () => base44.entities.Shift.list('date', 2000),
        staleTime: 10 * 60 * 1000,
        retry: 1,
    });

    const { data: localEvents = [] } = useQuery({
        queryKey: ['local-events-all'],
        queryFn: () => base44.entities.LocalEvent.list('event_date', 500),
        staleTime: 10 * 60 * 1000,
        retry: 1,
    });

    // Compute suggestions for the current week
    const suggestions = useMemo(() => {
        if (!revenues.length || !weekStart) return [];

        const weekEnd = addDays(weekStart, 6);
        const today = new Date();
        const days = [];

        for (let d = new Date(weekStart); d <= weekEnd; d = addDays(d, 1)) {
            const dateStr = format(d, 'yyyy-MM-dd');
            const dow = getDay(d);
            const dayName = getDayName(dow);
            const monthDay = format(d, 'MM-dd');
            
            // Find historical data for same weekday within ±14 days of same month-day in previous years
            const historicalMatches = revenues.filter(r => {
                if (!r.date) return false;
                const rDate = parseISO(r.date + 'T12:00:00');
                const rDow = getDay(rDate);
                // Same day of week
                if (rDow !== dow) return false;
                // Within ±14 days of same calendar date (different year)
                const rMonthDay = format(rDate, 'MM-dd');
                const dayDiff = Math.abs(
                    parseInt(rMonthDay.slice(0,2)) * 31 + parseInt(rMonthDay.slice(3,5)) -
                    parseInt(monthDay.slice(0,2)) * 31 + parseInt(monthDay.slice(3,5))
                );
                return dayDiff <= 14 && rDate < today;
            });

            // Also find same weekday in last 8 weeks for recent patterns
            const recentMatches = revenues.filter(r => {
                if (!r.date) return false;
                const rDate = parseISO(r.date + 'T12:00:00');
                const rDow = getDay(rDate);
                if (rDow !== dow) return false;
                const diff = differenceInCalendarDays(today, rDate);
                return diff >= 7 && diff <= 56; // 1-8 weeks ago
            });

            // Current planned shifts for this day
            const plannedShifts = allShifts.filter(s => s.date === dateStr);
            const plannedCount = plannedShifts.length;

            // Calculate avg revenue, busyness, staff from historical matches
            const allMatches = [...historicalMatches, ...recentMatches];
            const uniqueMatches = [...new Map(allMatches.map(m => [m.id, m])).values()];

            const holidayName = getHolidayName(dateStr);
            const holidayEveInfo = getHolidayEveInfo(dateStr);
            const holidayEve = holidayEveInfo != null;
            const bridgeDay = isBridgeDay(dateStr);
            const season = getSeason(dateStr);
            const schoolVacation = getSchoolVacation(dateStr);

            // Local Events für dieses Datum (inkl. jährlicher Wiederholung)
            const matchingEvents = localEvents.filter(e => localEventMatchesDate(e, dateStr));
            const totalEventStaffAdj = matchingEvents.reduce((sum, e) => sum + (e.staff_adjustment || 0), 0);
            const eventNames = matchingEvents.map(e => e.event_name).join(', ');

            // ── 1. Eigene bestätigte Events (Event-Entity) ──
            const dayEvents = confirmedEvents.filter(e => e.date === dateStr);
            const ownEventBoost = getEventStaffBoost(confirmedEvents, dateStr);
            const ownEventBadges = dayEvents.map(e => {
                const guests = e.expected_guests || 0;
                const boost = guests < EVENT_BOOST.SMALL_MAX ? 1 : guests <= EVENT_BOOST.MEDIUM_MAX ? 2 : 3;
                return `🎤 ${e.title}${e.start_time ? ` ab ${e.start_time}` : ''}, ~${guests} Gäste → +${boost}`;
            });

            // ── 2. Reservierungen als Frühindikator ──
            const dayReservations = getReservationsForDate(reservations, dateStr);
            const reservationGuests = getReservationGuests(reservations, dateStr);
            const reservationBoost = reservationGuests >= RESERVATION_BOOST_THRESHOLD ? 1 : 0;
            const reservationBadge = dayReservations.length > 0
                ? `🍽️ ${dayReservations.length} Reservierungen (${reservationGuests} Personen)`
                : '';

            // ── 3. Verfügbarkeit als Grenze ──
            const unavailableIds = getUnavailableEmployeeIds(vacations, unavailabilities, dateStr);
            const availableCount = Math.max(0, totalEmployees - unavailableIds.size);

            if (uniqueMatches.length === 0) {
                // Auch ohne historische Daten: Event-basierte Empfehlung
                let eventRec = null;
                let eventReason = '';
                if (matchingEvents.length > 0 && totalEventStaffAdj !== 0) {
                    eventRec = Math.max(2, 3 + totalEventStaffAdj);
                    const eventEmoji = matchingEvents.some(e => e.impact_level === 'large') ? '🔴'
                        : matchingEvents.some(e => e.impact_level === 'medium') ? '🟡' : '🟢';
                    eventReason = `${eventEmoji} ${eventNames} (${totalEventStaffAdj > 0 ? '+' : ''}${totalEventStaffAdj} Personal)`;
                }
                // Auch ohne historische Daten: Event-/Reservierungs-/Schulferien-Badge
                let baseRec = eventRec;
                let baseReason = eventReason;
                if (ownEventBoost > 0) {
                    baseRec = Math.max(2, Math.round((baseRec || 3) + ownEventBoost));
                    baseReason = `${ownEventBadges.join(' · ')}. ${baseReason}`;
                }
                if (reservationBoost > 0) {
                    baseRec = Math.round((baseRec || 3) + 1);
                    baseReason = `${reservationBadge} → +1. ${baseReason}`;
                }
                if (schoolVacation) {
                    baseReason = `🏫 ${schoolVacation.name}. ${baseReason}`;
                }
                const baseShortage = (baseRec != null && availableCount < baseRec)
                    ? `Nur ${availableCount} verfügbar, Empfehlung ist ${baseRec}` : '';

                days.push({
                    date: dateStr,
                    dateObj: new Date(d),
                    dayName,
                    dow,
                    hasData: false,
                    plannedCount,
                    holidayName,
                    holidayEve,
                    holidayEveInfo,
                    bridgeDay,
                    season,
                    localEvents: matchingEvents,
                    ownEvents: dayEvents,
                    ownEventBoost,
                    reservationCount: dayReservations.length,
                    reservationGuests,
                    reservationBoost,
                    availableCount,
                    unavailableCount: unavailableIds.size,
                    shortageWarning: baseShortage,
                    schoolVacation,
                    recommendation: baseRec,
                    reasonText: baseReason,
                });
                continue;
            }

            // Historical stats
            const avgRevenue = uniqueMatches.reduce((s, r) => s + (r.revenue || 0), 0) / uniqueMatches.length;
            const avgBusyness = uniqueMatches.filter(r => r.busyness_level).length > 0
                ? uniqueMatches.reduce((s, r) => s + (r.busyness_level || 3), 0) / uniqueMatches.filter(r => r.busyness_level).length
                : null;
            
            // Historical staff count from shifts
            const historicalStaffCounts = uniqueMatches.map(r => {
                const shiftsOnDay = allShifts.filter(s => s.date === r.date);
                return shiftsOnDay.length;
            }).filter(c => c > 0);
            const avgStaffCount = historicalStaffCounts.length > 0
                ? historicalStaffCounts.reduce((s, c) => s + c, 0) / historicalStaffCounts.length
                : null;

            // Weather
            const avgTemp = uniqueMatches.filter(r => r.weather_temp_max != null).length > 0
                ? uniqueMatches.reduce((s, r) => s + (r.weather_temp_max || 20), 0) / uniqueMatches.filter(r => r.weather_temp_max != null).length
                : null;
            const avgRain = uniqueMatches.filter(r => r.weather_precipitation != null).length > 0
                ? uniqueMatches.reduce((s, r) => s + (r.weather_precipitation || 0), 0) / uniqueMatches.filter(r => r.weather_precipitation != null).length
                : null;

            // Personnel ratio
            const ratioData = uniqueMatches.filter(r => r.revenue > 0 && (r.labor_cost_total || r.manual_labor_cost_daily));
            const avgRatio = ratioData.length > 0
                ? ratioData.reduce((s, r) => {
                    const cost = r.labor_cost_total || (r.manual_labor_cost_daily || 0) + (r.manual_labor_cost_fulltime || 0);
                    return s + (cost / r.revenue) * 100;
                }, 0) / ratioData.length
                : null;

            // Recommendation logic
            let recommendation = null;
            let reasonText = '';

            if (avgStaffCount && avgRevenue > 0) {
                if (avgRatio != null && avgRatio > 35) {
                    // Overstaffed historically — suggest fewer
                    recommendation = Math.max(2, Math.round(avgStaffCount - 1));
                    reasonText = `Historisch Überbesetzung (${avgRatio.toFixed(0)}% Personalquote). Ø ${avgStaffCount.toFixed(1)} Personen, Ø ${avgRevenue.toFixed(0)}€ Umsatz.`;
                } else if (avgRatio != null && avgRatio < 15) {
                    // Understaffed — suggest more
                    recommendation = Math.round(avgStaffCount + 1);
                    reasonText = `Historisch Unterbesetzung (${avgRatio.toFixed(0)}% Personalquote). Ø ${avgStaffCount.toFixed(1)} Personen bei ${avgRevenue.toFixed(0)}€ Umsatz.`;
                } else if (avgBusyness && avgBusyness >= 4) {
                    // Busy days — maintain or slightly increase
                    recommendation = plannedCount > 0 ? Math.max(plannedCount, Math.round(avgStaffCount)) : Math.round(avgStaffCount);
                    reasonText = `Starker Tag (Ø Betriebsamkeit ${avgBusyness.toFixed(1)}/5). Ø ${avgStaffCount.toFixed(1)} Personen.`;
                } else if (avgBusyness && avgBusyness <= 2) {
                    // Quiet day — reduce
                    recommendation = Math.max(2, Math.round(avgStaffCount - 1));
                    reasonText = `Ruhiger Tag (Ø Betriebsamkeit ${avgBusyness.toFixed(1)}/5). Ø ${avgStaffCount.toFixed(1)} Personen.`;
                } else {
                    // Normal — match historical
                    recommendation = Math.round(avgStaffCount);
                    reasonText = `Ø ${avgStaffCount.toFixed(1)} Personen an vergleichbaren ${dayName}en. Ø ${avgRevenue.toFixed(0)}€ Umsatz.`;
                }
            }

            // Adjust for weather forecast (if rainy and outdoor-heavy, reduce slightly)
            // We don't have forecast here but the WeatherForecastWidget handles that

            // Holiday/season adjustments to recommendation
            let adjustedRecommendation = recommendation;
            let adjustedReason = reasonText;
            
            // DATA-DRIVEN HOLIDAY ANALYSIS
            // Instead of hardcoding levels, compare holiday eve revenue to normal days
            if (holidayEveInfo) {
                // Find all historical entries that are the SAME holiday eve
                const sameHolidayEveRevenue = revenues.filter(r => 
                    r.is_holiday_eve === true && r.revenue > 0
                );
                
                // Compare holiday eve revenue to normal day-of-week revenue
                const normalDayRevenue = revenues
                    .filter(r => !r.is_holiday && !r.is_holiday_eve && r.revenue > 0)
                    .map(r => r.revenue);
                const avgNormalRevenue = normalDayRevenue.length > 0
                    ? normalDayRevenue.reduce((a, b) => a + b, 0) / normalDayRevenue.length
                    : 0;
                    
                const holidayEveRevenue = sameHolidayEveRevenue.map(r => r.revenue);
                const avgHolidayEveRevenue = holidayEveRevenue.length > 0
                    ? holidayEveRevenue.reduce((a, b) => a + b, 0) / holidayEveRevenue.length
                    : 0;
                
                let staffBoost = holidayEveInfo.staffBoost; // Default from hardcoded level
                let eveLabel = holidayEveInfo.emoji + ' ' + holidayEveInfo.label;
                let dataTag = '';
                
                if (avgNormalRevenue > 0 && avgHolidayEveRevenue > 0) {
                    // We have real data — use it!
                    const ratio = avgHolidayEveRevenue / avgNormalRevenue;
                    
                    if (ratio >= 1.8) {
                        staffBoost = 3;
                        eveLabel = '🔥 Mega-Abend';
                        dataTag = ` (Umsatz ${ratio.toFixed(1)}x höher als normal)`;
                    } else if (ratio >= 1.3) {
                        staffBoost = 2;
                        eveLabel = '🔥 Partyabend';
                        dataTag = ` (Umsatz ${ratio.toFixed(1)}x höher)`;
                    } else if (ratio >= 1.05) {
                        staffBoost = 1;
                        eveLabel = '👌 Ganz ok';
                        dataTag = ` (Umsatz ${ratio.toFixed(1)}x normal)`;
                    } else {
                        staffBoost = 0;
                        eveLabel = '😴 Ruhig';
                        dataTag = ` (Umsatz nur ${(ratio * 100).toFixed(0)}% vom Normal)`;
                    }
                }
                
                adjustedRecommendation = Math.round((recommendation || avgStaffCount || 4) + staffBoost);
                adjustedReason = `${eveLabel} vor ${holidayEveInfo.holidayName}${dataTag}. ${reasonText}`;
            } else if (holidayName) {
                // Holiday itself — use data if available
                const holidayRevenue = revenues
                    .filter(r => r.is_holiday === true && r.revenue > 0)
                    .map(r => r.revenue);
                const normalRevenue = revenues
                    .filter(r => !r.is_holiday && !r.is_holiday_eve && r.revenue > 0)
                    .map(r => r.revenue);
                
                if (holidayRevenue.length > 0 && normalRevenue.length > 0) {
                    const avgHoliday = holidayRevenue.reduce((a, b) => a + b, 0) / holidayRevenue.length;
                    const avgNormal = normalRevenue.reduce((a, b) => a + b, 0) / normalRevenue.length;
                    const ratio = avgHoliday / avgNormal;
                    
                    if (ratio < 0.7) {
                        adjustedRecommendation = Math.max(2, Math.round((recommendation || avgStaffCount || 3) - 1));
                        adjustedReason = `🎉 Feiertag (${holidayName}), nur ${(ratio * 100).toFixed(0)}% Umsatz. ${reasonText}`;
                    } else {
                        adjustedReason = `🎉 Feiertag (${holidayName}). ${reasonText}`;
                    }
                } else {
                    adjustedRecommendation = Math.max(2, Math.round((recommendation || avgStaffCount || 3) - 1));
                    adjustedReason = `🎉 Feiertag (${holidayName}). ${reasonText}`;
                }
            } else if (bridgeDay) {
                adjustedReason = `🔗 Brückentag. ${reasonText}`;
            }
            
            // Local Events wurden weiter oben berechnet (matchingEvents, totalEventStaffAdj, eventNames)
            if (matchingEvents.length > 0) {
                if (totalEventStaffAdj !== 0) {
                    adjustedRecommendation = Math.max(2, Math.round((adjustedRecommendation || avgStaffCount || 4) + totalEventStaffAdj));
                }
                const eventEmoji = matchingEvents.some(e => e.impact_level === 'large') ? '🔴'
                    : matchingEvents.some(e => e.impact_level === 'medium') ? '🟡' : '🟢';
                adjustedReason = `${eventEmoji} ${eventNames}${totalEventStaffAdj !== 0 ? ` (${totalEventStaffAdj > 0 ? '+' : ''}${totalEventStaffAdj} Personal)` : ''}. ${adjustedReason}`;
            }

            // ── 1. Eigene bestätigte Events → Personal-Boost ──
            if (ownEventBoost > 0) {
                adjustedRecommendation = Math.max(2, Math.round((adjustedRecommendation || avgStaffCount || 4) + ownEventBoost));
                adjustedReason = `${ownEventBadges.join(' · ')}. ${adjustedReason}`;
            }

            // ── 2. Reservierungen → ab Schwelle +1 ──
            if (reservationBoost > 0 && reservationGuests > 0) {
                adjustedRecommendation = Math.round((adjustedRecommendation || avgStaffCount || 4) + 1);
                adjustedReason = `${reservationBadge} → +1. ${adjustedReason}`;
            } else if (reservationBadge) {
                adjustedReason = `${reservationBadge} (unter Schwelle). ${adjustedReason}`;
            }

            // Schulferien-Badge (KEIN Boost — nur Anzeige)
            if (schoolVacation) {
                adjustedReason = `🏫 ${schoolVacation.name}. ${adjustedReason}`;
            }

            // Verfügbarkeits-Warnung: wenn weniger verfügbar als Empfehlung
            const shortageWarning = (adjustedRecommendation != null && availableCount < adjustedRecommendation)
                ? `Nur ${availableCount} verfügbar, Empfehlung ist ${adjustedRecommendation}`
                : '';
            
            // Seasonal adjustment
            if (season === 'summer' && avgTemp && avgTemp >= 25) {
                adjustedRecommendation = Math.round((adjustedRecommendation || avgStaffCount || 4) + 1);
                adjustedReason = `☀️ ${avgTemp.toFixed(0)}°C Biergarten-Wetter. ${adjustedReason}`;
            }

            days.push({
                date: dateStr,
                dateObj: new Date(d),
                dayName,
                dow,
                hasData: true,
                sampleSize: uniqueMatches.length,
                avgRevenue,
                avgBusyness,
                avgStaffCount,
                avgTemp,
                avgRain,
                avgRatio,
                recommendation: adjustedRecommendation,
                reasonText: adjustedReason,
                plannedCount,
                isPast: d < today,
                isToday: isSameDay(d, today),
                holidayName,
                holidayEve,
                holidayEveInfo,
                bridgeDay,
                season,
                localEvents: matchingEvents || [],
                ownEvents: dayEvents,
                ownEventBoost,
                reservationCount: dayReservations.length,
                reservationGuests,
                reservationBoost,
                availableCount,
                unavailableCount: unavailableIds.size,
                shortageWarning,
                schoolVacation,
            });
        }

        return days;
    }, [revenues, allShifts, localEvents, weekStart, confirmedEvents, reservations, vacations, unavailabilities, totalEmployees]);

    // Only show if we have enough data
    const daysWithData = suggestions.filter(s => s.hasData);
    const hasEnoughData = revenues.length >= 14;

    if (!hasEnoughData || daysWithData.length === 0) {
        return null;
    }

    const upcomingDays = suggestions.filter(s => !s.isPast);

    return (
        <Card className="border-border bg-card">
            <CardContent className="p-3">
                {/* Header */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                            <Brain className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">
                            Personal-Vorschläge
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            KI · {revenues.length} Tage Daten
                        </span>
                    </div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {/* Compact preview — always visible */}
                {!expanded && (
                    <div className="flex gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
                        {upcomingDays.slice(0, 7).map(day => (
                            <div
                                key={day.date}
                                className={cn(
                                    'flex-shrink-0 w-[58px] rounded-lg py-1.5 px-1 text-center',
                                    day.isToday && 'bg-primary/10 ring-1 ring-primary/30'
                                )}
                            >
                                <p className="text-[9px] text-muted-foreground font-medium">
                                    {format(day.dateObj, 'EEEEE', { locale: de })}
                                </p>
                                {day.recommendation != null ? (
                                    <>
                                        <p className={cn(
                                            'text-sm font-bold leading-none mt-0.5',
                                            day.holidayEveInfo?.level === 3 ? 'text-purple-400' :
                                            day.holidayEveInfo?.level === 2 ? 'text-blue-400' :
                                            day.plannedCount > day.recommendation ? 'text-red-400' :
                                            day.plannedCount > 0 && day.plannedCount === day.recommendation ? 'text-emerald-400' :
                                            'text-amber-400'
                                        )}>
                                            {day.holidayEveInfo ? day.holidayEveInfo.emoji : day.recommendation}
                                        </p>
                                        <p className="text-[8px] text-muted-foreground leading-none mt-0.5">
                                            {day.plannedCount > 0 ? `${day.plannedCount} geplant` : 'nicht geplant'}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">—</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Expanded view — detailed per-day analysis */}
                {expanded && (
                    <div className="mt-3 space-y-2">
                        {upcomingDays.map(day => {
                            if (!day.hasData) {
                                return (
                                    <div key={day.date} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/30">
                                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground flex-1">
                                            {day.dayName}, {format(day.dateObj, 'dd.MM.')}
                                        </span>
                                        {day.recommendation != null ? (
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-6 h-6 rounded bg-primary/15 flex items-center justify-center">
                                                    <span className="text-[11px] font-bold text-foreground">{day.recommendation}</span>
                                                </div>
                                                <span className="text-[9px] text-muted-foreground max-w-[120px] leading-tight">{day.reasonText}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground/50">Keine historischen Daten</span>
                                        )}
                                    </div>
                                );
                            }

                            const WeatherIcon = getWeatherIcon(day.avgRain > 0 ? 61 : 0);
                            const busynessInfo = day.avgBusyness ? BUSYNESS_LABELS[Math.round(day.avgBusyness)] : null;
                            const overstaffed = day.plannedCount > day.recommendation;
                            const understaffed = day.plannedCount > 0 && day.plannedCount < day.recommendation;
                            const perfect = day.plannedCount > 0 && day.plannedCount === day.recommendation;

                            return (
                                <div key={day.date} className={cn(
                                    'rounded-lg border p-2.5',
                                    overstaffed ? 'border-red-500/20 bg-red-500/5' :
                                    understaffed ? 'border-amber-500/20 bg-amber-500/5' :
                                    perfect ? 'border-emerald-500/20 bg-emerald-500/5' :
                                    'border-border bg-card'
                                )}>
                                    {/* Day header */}
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-semibold text-foreground">
                                                {day.dayName}, {format(day.dateObj, 'dd.MM.', { locale: de })}
                                            </span>
                                            {day.holidayEveInfo && day.holidayEveInfo.level >= 2 && (
                                                <span className={cn(
                                                    'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                                                    day.holidayEveInfo.level === 3 ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'
                                                )}>
                                                    {day.holidayEveInfo.emoji} {day.holidayEveInfo.label}
                                                </span>
                                            )}
                                            {day.holidayName && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">
                                                    {day.holidayName}
                                                </span>
                                            )}
                                            {day.bridgeDay && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
                                                    🔗 Brückentag
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px]">
                                            {/* Weather */}
                                            {day.avgTemp != null && (
                                                <span className="flex items-center gap-0.5 text-muted-foreground">
                                                    <WeatherIcon className="w-3 h-3" />
                                                    {day.avgTemp.toFixed(0)}°
                                                    {day.avgRain > 0 && ` · ${day.avgRain.toFixed(1)}mm`}
                                                </span>
                                            )}
                                            {/* Busyness */}
                                            {busynessInfo && (
                                                <span className={cn('font-medium', busynessInfo.color)}>
                                                    {busynessInfo.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-1.5">
                                        {day.avgRevenue > 0 && (
                                            <span>Ø {day.avgRevenue.toFixed(0)}€</span>
                                        )}
                                        {day.avgStaffCount != null && (
                                            <span>Ø {day.avgStaffCount.toFixed(1)} Personal</span>
                                        )}
                                        {day.avgRatio != null && (
                                            <span>Ø {day.avgRatio.toFixed(0)}% Quote</span>
                                        )}
                                        <span className="text-muted-foreground/50">n={day.sampleSize}</span>
                                    </div>

                                    {/* Recommendation */}
                                    {day.recommendation != null && (
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                                overstaffed ? 'bg-red-500/15' :
                                                understaffed ? 'bg-amber-500/15' :
                                                perfect ? 'bg-emerald-500/15' :
                                                'bg-primary/15'
                                            )}>
                                                <span className="text-sm font-bold text-foreground">
                                                    {day.recommendation}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] text-muted-foreground leading-tight">
                                                    {day.reasonText}
                                                </p>
                                            </div>
                                            {day.plannedCount > 0 && (
                                                <div className={cn(
                                                    'text-[10px] font-semibold px-2 py-0.5 rounded',
                                                    overstaffed ? 'text-red-400 bg-red-500/10' :
                                                    understaffed ? 'text-amber-400 bg-amber-500/10' :
                                                    'text-emerald-400 bg-emerald-500/10'
                                                )}>
                                                    {day.plannedCount} geplant
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Legend */}
                        <div className="flex items-center gap-3 pt-2 border-t border-border/50 text-[9px] text-muted-foreground">
                            <span className="flex items-center gap-1"><History className="w-2.5 h-2.5" />Vergleich auf Basis historischer Daten</span>
                            <span>n = Stichprobengröße</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}