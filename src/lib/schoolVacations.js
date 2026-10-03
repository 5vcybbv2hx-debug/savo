/**
 * Schulferien Baden-Württemberg
 *
 * Pflegbare Liste aller Ferienperioden. getSchoolVacation(date) prüft, ob ein
 * Datum in eine Ferienspanne fällt und gibt { name } zurück, sonst null.
 *
 * KEIN Personal-Boost — dient nur als Anzeige in Smart-Engine und Weather-Widget
 * sowie zum automatischen Vorausfüllen von DailyRevenue.is_vacation.
 */

// Format: { name, start, end } — start/end als 'YYYY-MM-DD'
// TODO 2027: offiziell gegen Kultusministerium BW verifizieren
const VACATIONS = [
  // ── 2026 ──
  { name: 'Osterferien',       start: '2026-03-30', end: '2026-04-11' },
  { name: 'Pfingstferien',     start: '2026-05-26', end: '2026-06-05' },
  { name: 'Sommerferien',      start: '2026-07-30', end: '2026-09-12' },
  { name: 'Herbstferien',      start: '2026-10-26', end: '2026-10-31' },
  { name: 'Weihnachtsferien',  start: '2026-12-23', end: '2027-01-09' },

  // ── 2027 (TODO: offiziell gegen Kultusministerium verifizieren) ──
  { name: 'Winterferien',      start: '2027-02-01', end: '2027-02-06' },
  { name: 'Osterferien',       start: '2027-03-22', end: '2027-04-03' },
  { name: 'Pfingstferien',     start: '2027-05-18', end: '2027-05-29' },
  { name: 'Sommerferien',      start: '2027-07-29', end: '2027-09-11' },
  { name: 'Herbstferien',      start: '2027-11-02', end: '2027-11-06' },
  { name: 'Weihnachtsferien',  start: '2027-12-23', end: '2028-01-08' },
];

/**
 * Prüft, ob ein Datum in eine Schulferienspanne (BW) fällt.
 * @param {string|Date} date - 'YYYY-MM-DD' oder Date
 * @returns {{ name: string } | null}
 */
export function getSchoolVacation(date) {
  if (!date) return null;
  const dateStr = typeof date === 'string' ? date : formatDate(date);
  if (!dateStr) return null;

  for (const v of VACATIONS) {
    if (dateStr >= v.start && dateStr <= v.end) {
      return { name: v.name };
    }
  }
  return null;
}

function formatDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}