/**
 * UpcomingReservationsList — Liste "Kommende Reservierungen" (7 Tage ab morgen).
 * Zeile antippen → bestehende Detailansicht (ReservationModal) öffnen.
 */
import ReservationRow from './ReservationRow';

export default function UpcomingReservationsList({ reservations = [], tables = [], resolveCreator, onOpen }) {
    if (reservations.length === 0) {
        return (
            <p className="text-sm text-muted-foreground text-center py-6 rounded-xl border border-dashed border-border">
                Keine Reservierungen ab morgen
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {reservations.map((res, idx) => (
                <ReservationRow
                    key={res.id}
                    reservation={res}
                    tables={tables}
                    resolveCreator={resolveCreator}
                    onOpen={onOpen}
                    showDate
                    index={idx}
                />
            ))}
        </div>
    );
}