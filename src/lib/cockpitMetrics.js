/**
 * cockpitMetrics.js — Zeitraum- und Kennzahlen-Logik für das Finanz-Cockpit.
 *
 * Zeitraum:
 *   week  = aktuelle Kalenderwoche (Mo–So)
 *   month = aktueller Kalendermonat
 *
 * Vorjahresvergleich: exakt dieselbe Zeitspanne ein Jahr zuvor. Läuft die
 * Periode noch (Monat/Woche nicht abgeschlossen), wird auch im Vorjahr nur bis
 * zum gleichen Kalendertag gerechnet — sonst wäre der Vergleich schief.
 *
 * Alle Berechnungen laufen ausschließlich auf bestehenden Entities
 * (DailyRevenue, TimeEntry, Employee, RecurringExpense) — kein Server-Code.
 */

export const SAVO_BLUE = '#0099db';
/** Fallback-Stundensatz, wenn Employee.hourly_rate nicht gepflegt ist. */
export const FALLBACK_HOURLY_RATE = 16;

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
    'August', 'September', 'Oktober', 'November', 'Dezember'];
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const pad = (n) => String(n).padStart(2, '0');

/** Datum → ISO-Datum (yyyy-MM-dd) in lokaler Zeit. */
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

/** Gleicher Kalendertag ein Jahr früher (29.02. → 28.02.). */
const shiftYear = (d) => {
    const y = d.getFullYear() - 1;
    return new Date(y, d.getMonth(), Math.min(d.getDate(), daysInMonth(y, d.getMonth())));
};

/** ISO-8601-Kalenderwoche. */
export function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Liefert die Grenzen des gewählten Zeitraums inkl. Vorjahresfenster.
 * from/to = voller Zeitraum, elapsedTo = Zeitraum bis heute (laufende Periode),
 * prevFrom/prevTo = gleiche Zeitspanne im Vorjahr.
 */
export function getCockpitPeriod(type, today = new Date()) {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let from, to, label;

    if (type === 'week') {
        const monday = new Date(t);
        monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        from = monday;
        to = sunday;
        label = `KW ${isoWeek(monday)}`;
    } else {
        from = new Date(t.getFullYear(), t.getMonth(), 1);
        to = new Date(t.getFullYear(), t.getMonth() + 1, 0);
        label = `${MONTHS[t.getMonth()]} ${t.getFullYear()}`;
    }

    const elapsedTo = to.getTime() > t.getTime() ? t : to;

    return {
        type,
        label,
        from: toISO(from),
        to: toISO(to),
        elapsedTo: toISO(elapsedTo),
        prevFrom: toISO(shiftYear(from)),
        prevTo: toISO(shiftYear(elapsedTo)),
        isRunning: elapsedTo.getTime() < to.getTime(),
    };
}

const inRange = (date, from, to) => {
    const d = (date || '').slice(0, 10);
    return d !== '' && d >= from && d <= to;
};

export const sumRevenue = (rows) => rows.reduce((sum, r) => sum + (r.revenue || 0), 0);

/** Arbeitsstunden eines TimeEntry — total_hours, sonst aus Start/Ende minus Pause. */
export function entryHours(entry) {
    if (typeof entry.total_hours === 'number') return entry.total_hours;

    const [sh, sm] = String(entry.start_time || '').split(':').map(Number);
    const [eh, em] = String(entry.end_time || '').split(':').map(Number);
    if ([sh, sm, eh, em].some(Number.isNaN)) return 0;

    let minutes = eh * 60 + em - (sh * 60 + sm);
    if (minutes < 0) minutes += 24 * 60; // Nachtschicht über Mitternacht
    return Math.max(0, minutes - (entry.break_minutes || 0)) / 60;
}

/**
 * Personalkosten aus erfassten Stunden × Employee.hourly_rate (Fallback 16 €).
 * monthly_salary wird bewusst ignoriert.
 */
export function laborCost(entries, employees) {
    const rateById = new Map(employees.map(e => [
        e.id,
        typeof e.hourly_rate === 'number' && e.hourly_rate > 0 ? e.hourly_rate : FALLBACK_HOURLY_RATE,
    ]));

    let hours = 0;
    let cost = 0;
    for (const entry of entries) {
        const h = entryHours(entry);
        hours += h;
        cost += h * (rateById.get(entry.employee_id) ?? FALLBACK_HOURLY_RATE);
    }
    return { hours, cost };
}

/** Summe der aktiven monatlichen Fixkosten (alle Posten auf Monatsbasis). */
export const monthlyFixedCosts = (expenses) => expenses
    .filter(e => e.active !== false && e.interval === 'monatlich')
    .reduce((sum, e) => sum + (e.amount_gross || 0), 0);

/** Fixkosten-Anteil des Zeitraums: Monat = volle Summe, Woche = × 12/52. */
export const fixedCostsForPeriod = (monthly, type) =>
    type === 'week' ? (monthly * 12) / 52 : monthly;

/** Tageswerte des Zeitraums als Balkenreihe (leere Tage = 0). */
export function dailyRevenueSeries(rows, from, to, type) {
    const byDate = new Map();
    for (const row of rows) {
        const d = (row.date || '').slice(0, 10);
        if (!d) continue;
        byDate.set(d, (byDate.get(d) || 0) + (row.revenue || 0));
    }

    const series = [];
    const cursor = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    while (cursor <= end) {
        const iso = toISO(cursor);
        series.push({
            date: iso,
            label: type === 'week' ? WEEKDAYS[(cursor.getDay() + 6) % 7] : String(cursor.getDate()),
            value: byDate.get(iso) || 0,
        });
        cursor.setDate(cursor.getDate() + 1);
    }
    return series;
}

/** Prozentuale Abweichung; null, wenn kein sinnvoller Vorjahreswert vorliegt. */
export const pctDelta = (current, previous) =>
    previous > 0 ? ((current - previous) / previous) * 100 : null;

export const fmtEUR = (n) => (n ?? 0).toLocaleString('de-DE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});

export const fmtHours = (n) => `${(n ?? 0).toLocaleString('de-DE', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
})} h`;

export { inRange };