/**
 * monatsabschluss.js
 * Rechen- und Anzeigehilfen für den Monatsabschluss für den Steuerberater.
 */
import { format, getDaysInMonth, subMonths, startOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';

// Status des Abschlusses — Farben tragen Bedeutung
export const STATUS_META = {
    offen:     { label: 'Offen',     className: 'border-border bg-surface text-muted-foreground' },
    in_arbeit: { label: 'In Arbeit', className: 'border-status-warn/30 bg-status-warn/15 text-status-warn' },
    pruefung:  { label: 'Prüfung',   className: 'border-primary/30 bg-primary/15 text-primary' },
    fertig:    { label: 'Fertig',    className: 'border-status-ok/30 bg-status-ok/15 text-status-ok' },
    versendet: { label: 'Versendet', className: 'border-emerald-800/50 bg-emerald-800/30 text-emerald-300' },
};

export const statusMeta = key => STATUS_META[key] || STATUS_META.offen;

// Die fünf Prüfpunkte eines Monatsabschlusses
export const CHECKS = [
    { key: 'check_kasse',        label: 'Kasse' },
    { key: 'check_belege',       label: 'Belege', hint: 'NAS: Verwaltung/01_Debitoren' },
    { key: 'check_bank',         label: 'Bank',   hint: 'NAS: Verwaltung/04_Bankverkehr' },
    { key: 'check_lohn',         label: 'Lohn' },
    { key: 'check_sonderposten', label: 'Sonderposten' },
];

/** 'yyyy-MM' → 'Oktober 2026' */
export function monthLabel(monthKey) {
    if (!monthKey) return '';
    const [y, m] = monthKey.split('-').map(Number);
    const label = format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: de });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Fälligkeit: 10. des Folgemonats */
export function defaultFaellig(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return format(new Date(y, m, 10), 'yyyy-MM-dd');
}

/** Letzte n Monate als 'yyyy-MM', neuester zuerst */
export function lastMonths(n) {
    const base = startOfMonth(new Date());
    return Array.from({ length: n }, (_, i) => format(subMonths(base, i), 'yyyy-MM'));
}

/** Erster Tag des letzten der n Monate (für Datenabrufe) */
export function lastMonthsStart(n) {
    return `${lastMonths(n)[n - 1]}-01`;
}

/**
 * Kassenstand eines Monats.
 * booked   = Tage mit Tagesabschluss (DailyRevenue)
 * expected = Tage im Monat ohne Montag, nur bis heute gezählt
 */
export function kasseStats(monthKey, bookedDates, todayStr) {
    const [y, m] = monthKey.split('-').map(Number);
    const daysInMonth = getDaysInMonth(new Date(y, m - 1, 1));
    const started = `${monthKey}-01` <= todayStr;

    let expected = 0;
    let booked = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const day = new Date(y, m - 1, d);
        const iso = format(day, 'yyyy-MM-dd');
        if (bookedDates.has(iso)) booked++;
        if (iso > todayStr) continue;            // Zukunft zählt nicht
        if (day.getDay() === 1) continue;        // Montag = Ruhetag
        expected++;
    }

    return {
        booked,
        expected,
        complete: started && expected > 0 && booked >= expected,
    };
}

/** Lohnkennzahlen eines Monats aus TimeEntry */
export function lohnStats(monthKey, entries) {
    const list = entries.filter(e => (e.date || '').startsWith(monthKey));
    const hours = list.reduce((sum, e) => sum + (e.total_hours || 0), 0);
    const employees = new Set(list.map(e => e.employee_id || e.employee_name)).size;
    return { hours, employees };
}

/** 'yyyy-MM-dd' → '10.11.2026' */
export function shortDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
}

/** Vorschlag für „Monat anlegen": Vormonat, sonst aktueller Monat */
export function suggestedCreateMonth(existingMonths) {
    const previous = lastMonths(2)[1];
    return existingMonths.includes(previous) ? lastMonths(1)[0] : previous;
}