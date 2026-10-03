/**
 * useStaffingFactors — zentrale Query für die 4 Smart-Engine-Faktoren:
 *   1. Bestätigte Events (Event-Entity)
 *   2. Aktive Reservierungen (Reservation-Entity, nicht archiviert)
 *   3. Genehmigte Urlaubsanträge (VacationRequest, status 'genehmigt')
 *   4. Aktive Unverfügbarkeits-Anfragen (UnavailabilityRequest, status 'genehmigt')
 *
 * Liefert Lookup-Maps pro Datum, damit SmartStaffingSuggestions und
 * WeatherForecastWidget die Daten ohne eigene Queries nutzen können.
 *
 * React Query mit placeholderData (keine initialData-Defaults).
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Tunable Konstanten für Event-Staffing-Boost
export const EVENT_BOOST = {
  SMALL_MAX: 40,    // < 40 Gäste → +1
  MEDIUM_MAX: 100,  // 40–100 Gäste → +2
  // > 100 Gäste → +3
};

// Tunable Schwelle für Reservierungs-Boost
export const RESERVATION_BOOST_THRESHOLD = 30; // ab 30 Personen → +1

export default function useStaffingFactors() {
  // 1. Bestätigte Events
  const { data: events = [] } = useQuery({
    queryKey: ['staffing-events'],
    queryFn: () => base44.entities.Event.filter({ status: 'Bestätigt' }, 'date', 300),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: [],
  });

  // 2. Aktive Reservierungen (nicht archiviert, nicht storniert)
  const { data: reservations = [] } = useQuery({
    queryKey: ['staffing-reservations'],
    queryFn: async () => {
      const all = await base44.entities.Reservation.list('date', 500);
      return all.filter(r => r.is_archived !== true && r.status !== 'storniert');
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: [],
  });

  // 3. Genehmigte Urlaubsanträge
  const { data: vacations = [] } = useQuery({
    queryKey: ['staffing-vacations'],
    queryFn: async () => {
      const all = await base44.entities.VacationRequest.list('start_date', 500);
      return all.filter(v => v.status === 'genehmigt');
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: [],
  });

  // 4. Aktive Unverfügbarkeits-Anfragen (status 'genehmigt')
  const { data: unavailabilities = [] } = useQuery({
    queryKey: ['staffing-unavailabilities'],
    queryFn: async () => {
      const all = await base44.entities.UnavailabilityRequest.list('date', 500);
      return all.filter(u => u.status === 'genehmigt');
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: [],
  });

  return { events, reservations, vacations, unavailabilities };
}

// ── Lookup-Hilfsfunktionen ───────────────────────────────────────────────────

/** Events, die an einem Datum stattfinden */
export function getEventsForDate(events, dateStr) {
  return events.filter(e => e.date === dateStr);
}

/** Event-Staffing-Boost für ein Datum (Summe über alle Events des Tages) */
export function getEventStaffBoost(events, dateStr) {
  const dayEvents = getEventsForDate(events, dateStr);
  if (dayEvents.length === 0) return 0;
  return dayEvents.reduce((sum, e) => {
    const guests = e.expected_guests || 0;
    if (guests < EVENT_BOOST.SMALL_MAX) return sum + 1;
    if (guests <= EVENT_BOOST.MEDIUM_MAX) return sum + 2;
    return sum + 3;
  }, 0);
}

/** Reservierungen an einem Datum (aktiv, nicht archiviert) */
export function getReservationsForDate(reservations, dateStr) {
  return reservations.filter(r => r.date === dateStr);
}

/** Summe der Personen aus Reservierungen an einem Datum */
export function getReservationGuests(reservations, dateStr) {
  return getReservationsForDate(reservations, dateStr)
    .reduce((sum, r) => sum + (r.guests || 0), 0);
}

/** Prüft, ob ein Mitarbeiter an einem Datum genehmigten Urlaub hat */
export function isEmployeeOnVacation(vacations, employeeId, dateStr) {
  return vacations.some(v =>
    v.employee_id === employeeId &&
    v.start_date <= dateStr &&
    v.end_date >= dateStr
  );
}

/** Prüft, ob ein Mitarbeiter an einem Datum eine aktive Unverfügbarkeit hat */
export function isEmployeeUnavailable(unavailabilities, employeeId, dateStr) {
  return unavailabilities.some(u => {
    if (u.employee_id !== employeeId) return false;
    const start = u.date;
    const end = u.end_date || u.date;
    return dateStr >= start && dateStr <= end;
  });
}

/** Sammelt alle nicht verfügbaren Mitarbeiter-IDs für ein Datum */
export function getUnavailableEmployeeIds(vacations, unavailabilities, dateStr) {
  const ids = new Set();
  vacations.forEach(v => {
    if (v.start_date <= dateStr && v.end_date >= dateStr) ids.add(v.employee_id);
  });
  unavailabilities.forEach(u => {
    const start = u.date;
    const end = u.end_date || u.date;
    if (dateStr >= start && dateStr <= end) ids.add(u.employee_id);
  });
  return ids;
}