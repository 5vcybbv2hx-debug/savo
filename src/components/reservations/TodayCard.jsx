/**
 * TodayCard — "Heute"-Karte für den aktuell gewählten Tag.
 * Kopfzeile mit Wochentag/Datum, Zusammenfassung und den Reservierungen
 * des Tages (chronologisch). Zeile antippen → Detailansicht.
 */
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarDays, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReservationRow from './ReservationRow';

function formatDay(dateStr) {
    try { return format(parseISO(dateStr), 'EEE, d. MMMM', { locale: de }); }
    catch { return dateStr; }
}

export default function TodayCard({ date, reservations = [], tables = [], resolveCreator, onOpen, onCreate }) {
    const count = reservations.length;
    const guests = reservations
        .filter(r => r.status !== 'storniert')
        .reduce((sum, r) => sum + (Number(r.guests) || 0), 0);

    const summary = count === 0
        ? 'Keine Reservierungen heute'
        : `${count} ${count === 1 ? 'Reservierung' : 'Reservierungen'} · ${guests} Gäste`;

    return (
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                        <span>Heute</span>
                        <span className="text-muted-foreground font-normal truncate">· {formatDay(date)}</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>
                </div>
                {onCreate && count > 0 && (
                    <Button variant="ghost" size="sm" onClick={onCreate}
                        className="h-8 gap-1 text-xs text-primary shrink-0">
                        <Plus className="w-3.5 h-3.5" />Neu
                    </Button>
                )}
            </div>

            {count === 0 ? (
                <div className="px-4 py-5 flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        Für diesen Tag ist noch nichts eingetragen.
                    </p>
                    {onCreate && (
                        <Button variant="outline" size="sm" onClick={onCreate}
                            className="h-8 gap-1 text-xs shrink-0">
                            <Plus className="w-3.5 h-3.5" />Neu
                        </Button>
                    )}
                </div>
            ) : (
                <div className="p-3 space-y-2">
                    {reservations.map((res, idx) => (
                        <ReservationRow
                            key={res.id}
                            reservation={res}
                            tables={tables}
                            resolveCreator={resolveCreator}
                            onOpen={onOpen}
                            index={idx}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}