/**
 * HolidayReviewPanel — "Feiertage prüfen" im Betriebskalender.
 * Listet alle kommenden Feiertage (aus den BusinessCalendarDay-Datensätzen)
 * mit den drei Zuständen geschlossen / offen wie üblich / offen mit
 * Sonderzeiten.
 */
import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { PartyPopper } from 'lucide-react';
import HolidayReviewRow from './HolidayReviewRow';

export default function HolidayReviewPanel({ days = [], canEdit = false }) {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const holidays = useMemo(
        () => days
            .filter(d => d.is_holiday === true && d.date && d.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date)),
        [days, todayStr]
    );

    const openCount = holidays.filter(d => d.is_closed !== true).length;

    return (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <PartyPopper className="w-4 h-4 text-red-400" />
                        Feiertage prüfen
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {holidays.length === 0
                            ? 'Keine kommenden Feiertage im Kalender'
                            : `${holidays.length} kommende · ${openCount} offen · ${holidays.length - openCount} geschlossen`}
                    </p>
                </div>
            </div>

            {holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                    Feiertage werden automatisch angelegt; offene Tage hier festlegen.
                </p>
            ) : (
                <div className="space-y-2">
                    {holidays.map(day => (
                        <HolidayReviewRow key={day.id} day={day} canEdit={canEdit} />
                    ))}
                </div>
            )}
        </div>
    );
}