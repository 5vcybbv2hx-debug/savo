/**
 * Regeln für Wunschschichten — welche Schichtarten darf ein Mitarbeiter
 * an welchem Wochentag wünschen?
 *
 * Wochentage nach date-fns getDay(): 0 = Sonntag … 6 = Samstag
 * - Di:                nur 17–22 Uhr (Start und Ende müssen passen)
 * - Mi + Do:           nur 18–22 Uhr (Start und Ende müssen passen)
 * - Fr + Sa:           alle Schichtarten ab 19:00 Uhr
 * - So + Mo:           keine Wunschschichten (Ruhetag)
 */
import { getDay } from 'date-fns';

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

/** Erlaubte Schichtarten für einen Tag, nach Startzeit sortiert. */
export function getWishShiftTypes(shiftTypes = [], date) {
    if (!date) return [];
    const rule = WISH_RULES[getDay(date)];
    if (!rule) return [];

    return [...shiftTypes]
        .filter(type => {
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
        })
        .sort((a, b) => normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));
}

/** Sind an diesem Tag überhaupt Wunschschichten möglich? */
export function isWishWeekday(date) {
    if (!date) return false;
    return !!WISH_RULES[getDay(date)];
}

/** Kurzer Hinweis für das Sheet, z. B. "Dienstag: nur 17–22 Uhr". */
export function wishDayHint(date) {
    if (!date) return null;
    switch (getDay(date)) {
        case 2: return 'Dienstag: nur 17–22 Uhr';
        case 3: return 'Mittwoch: nur 18–22 Uhr';
        case 4: return 'Donnerstag: nur 18–22 Uhr';
        case 5:
        case 6: return 'Freitag & Samstag: alle Schichten ab 19 Uhr';
        default: return null;
    }
}