/**
 * Regeln für Wunschschichten — welche Schichtarten darf ein Mitarbeiter
 * an welchem Wochentag wünschen?
 *
 * Wochentage nach date-fns getDay(): 0 = Sonntag … 6 = Samstag
 * - Di:                nur 17–22 Uhr (Start und Ende müssen passen)
 * - Mi + Do:           nur 18–22 Uhr (Start und Ende müssen passen)
 * - Fr + Sa:           alle Schichtarten ab 19:00 Uhr
 * - So + Mo:           keine Wunschschichten (Ruhetag)
 *
 * Betriebskalender (BusinessCalendarDay) hat Vorrang:
 * - is_closed true            → keine Wunschschichten an dem Tag
 * - opening_time_override     → Schichten nur ab dieser Öffnungszeit
 * - offener Feiertag ohne Override → Wochentagsregel wie bisher
 *
 * Die Kalendertage werden als optionale letzte Parameter übergeben
 * (Array von BusinessCalendarDay-Records).
 */
import { getDay, format } from 'date-fns';

export const WISH_RULES = {
    2: { type: 'exact', start: '17:00', end: '22:00' },
    3: { type: 'exact', start: '18:00', end: '22:00' },
    4: { type: 'exact', start: '18:00', end: '22:00' },
    5: { type: 'from', start: '19:00' },
    6: { type: 'from', start: '19:00' },
};

/** "5:00" → "05:00" */
export function normalizeTime(t) {
    if (!t) return '';
    const [h, m] = String(t).split(':');
    return `${String(h || '0').padStart(2, '0')}:${String(m || '00').padStart(2, '0')}`;
}

/** "YYYY-MM-DD" für ein Date oder einen bereits vorhandenen String. */
function dateKey(date) {
    if (!date) return null;
    return typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
}

/** BusinessCalendarDay-Eintrag für ein Datum (oder null). */
export function findBusinessDay(calendarDays, date) {
    const key = dateKey(date);
    if (!key || !Array.isArray(calendarDays)) return null;
    return calendarDays.find(d => d?.date === key) || null;
}

/** Tagesarten, die immer wie "geschlossen" wirken. */
export const CLOSED_DAY_TYPES = ['geschlossen', 'geschlossen_mit_reinigung', 'betriebsferien'];

/** Ist der Tag laut Betriebskalender geschlossen (inkl. Betriebsferien)? */
export function isBusinessClosed(calendarDays, date) {
    return specialFor(calendarDays, date)?.closed === true;
}

/** Anzeige-Label für geschlossene Tage ("Betriebsferien", "Geschlossen (Feiertag)" …). */
export function closedDayLabel(calendarDays, date) {
    const entry = findBusinessDay(calendarDays, date);
    if (!entry) return null;
    if (!(entry.is_closed === true || CLOSED_DAY_TYPES.includes(entry.day_type))) return null;
    if (entry.day_type === 'betriebsferien') return entry.title || 'Betriebsferien';
    return entry.title || (entry.is_holiday === true ? 'Geschlossen (Feiertag)' : 'Betrieb geschlossen');
}

/**
 * Kalender-Sonderfall für ein Datum:
 * { closed: true }                     → Betrieb geschlossen
 * { closed: false, open: "18:00" }     → Sonderöffnung mit Zeiten
 * null                                 → keine Sonderregel
 */
function specialFor(calendarDays, date) {
    const entry = findBusinessDay(calendarDays, date);
    if (!entry) return null;
    if (entry.is_closed === true || CLOSED_DAY_TYPES.includes(entry.day_type)) return { closed: true, entry };
    const open = normalizeTime(entry.opening_time_override);
    if (open) return { closed: false, open, entry };
    return null;
}

/** Erlaubte Schichtarten für einen Tag, nach Startzeit sortiert. */
export function getWishShiftTypes(shiftTypes = [], date, calendarDays = []) {
    if (!date) return [];

    const special = specialFor(calendarDays, date);
    if (special?.closed) return [];

    const sortByStart = list => [...list].sort(
        (a, b) => normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time))
    );

    // Sonderöffnung: nur Schichten, die nicht vor der Öffnung beginnen
    if (special?.open) {
        return sortByStart(shiftTypes.filter(type => {
            const start = normalizeTime(type.start_time);
            return !!start && start >= special.open;
        }));
    }

    const rule = WISH_RULES[getDay(date)];
    if (!rule) return [];

    return sortByStart(shiftTypes.filter(type => {
        const start = normalizeTime(type.start_time);
        if (!start) return false;
        // 'exact': Start UND Ende müssen exakt der Regel entsprechen
        if (rule.type === 'exact') {
            return start === normalizeTime(rule.start)
                && normalizeTime(type.end_time) === normalizeTime(rule.end);
        }
        // 'from': alles ab der Regel-Startzeit
        if (rule.type === 'from') return start >= normalizeTime(rule.start);
        return false;
    }));
}

/** Sind an diesem Tag überhaupt Wunschschichten möglich? */
export function isWishWeekday(date, calendarDays = []) {
    if (!date) return false;

    const special = specialFor(calendarDays, date);
    if (special?.closed) return false;
    if (special?.open) return true;

    return !!WISH_RULES[getDay(date)];
}

/** Kurzer Hinweis für das Sheet, z. B. "Dienstag: nur 17–22 Uhr". */
export function wishDayHint(date, calendarDays = []) {
    if (!date) return null;

    const special = specialFor(calendarDays, date);
    if (special?.closed) {
        return special.entry?.title ? `Geschlossen – ${special.entry.title}` : 'Betrieb geschlossen';
    }
    if (special?.open) {
        const name = special.entry?.title || 'Sonderöffnung';
        return `${name}: Schichten ab ${special.open} Uhr`;
    }

    switch (getDay(date)) {
        case 2: return 'Dienstag: nur 17–22 Uhr';
        case 3: return 'Mittwoch: nur 18–22 Uhr';
        case 4: return 'Donnerstag: nur 18–22 Uhr';
        case 5:
        case 6: return 'Freitag & Samstag: alle Schichten ab 19 Uhr';
        default: return null;
    }
}