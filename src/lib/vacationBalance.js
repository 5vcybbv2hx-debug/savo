/**
 * vacationBalance.js — Urlaubskonto (Resturlaub) für Festangestellte.
 *
 * Regeln:
 *  - Urlaubskonto nur für die Rollen "Vollzeit" und "Manager" (nicht Aushilfe).
 *  - Ein Urlaubstag = 8 Stunden.
 *  - Urlaubstage zählen nur an Tagen, an denen das Lokal geöffnet hat
 *    (Öffnungszeiten aus OpeningHours, Fallback CompanyInfo.opening_hours).
 *  - Ansprüche liegen pro Jahr in VacationEntitlement, damit Änderungen
 *    alte Jahre nicht rückwirkend verändern.
 *  - Halbe Tage: ist an einem VacationRequest `days_count` gesetzt, gilt dieser
 *    Wert; sonst werden die Öffnungstage des Zeitraums gezählt.
 */
import { base44 } from '@/api/base44Client';
import { eachDayOfInterval, format, parseISO } from 'date-fns';

export const HOURS_PER_VACATION_DAY = 8;

const WEEKDAY_INDEX = {
    Sonntag: 0, Montag: 1, Dienstag: 2, Mittwoch: 3, Donnerstag: 4, Freitag: 5, Samstag: 6,
};
const SHORT_KEY_INDEX = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
const LONG_KEY_INDEX = {
    sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6,
};
// Ohne gepflegte Öffnungszeiten: Montag–Samstag geöffnet, Sonntag Ruhetag.
const DEFAULT_WEEKDAYS = { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const isTime = (v) => typeof v === 'string' && /\d{1,2}[:.]\d{2}/.test(v);

/** Urlaubsanspruch gibt es nur für Vollzeit und Manager. */
export function isVacationEligible(employee) {
    return ['Vollzeit', 'Manager'].includes(employee?.role);
}

/**
 * Öffnungszeiten in Wochentags-Maske (0 = Sonntag) + Sonderöffnungstage umrechnen.
 * Akzeptiert OpeningHours-Datensätze oder das JSON aus CompanyInfo.opening_hours.
 */
export function normalizeOpeningHours(source) {
    // Bereits normalisiert?
    if (source && source.weekdays && source.specialDays) return source;

    const weekdays = { ...DEFAULT_WEEKDAYS };
    const specialDays = {};
    let hasWeekdayData = false;

    if (Array.isArray(source)) {
        source.forEach((rec) => {
            if (!rec) return;
            const closed = rec.is_closed === true;
            if (rec.is_special_day) {
                if (rec.special_date) specialDays[rec.special_date] = !closed;
                return; // Sondertage überschreiben keinen regulären Wochentag
            }
            const idx = WEEKDAY_INDEX[rec.day_of_week];
            if (idx === undefined) return;
            weekdays[idx] = !closed && (isTime(rec.open_time) || !rec.open_time);
            hasWeekdayData = true;
        });
    } else if (source && typeof source === 'object') {
        // Pro Wochentag den aussagekräftigsten Eintrag wählen:
        // kurze Schlüssel (mo…so) mit Boolean sind eindeutig, lange deutsche
        // Schlüssel tragen Uhrzeiten.
        const best = {};
        const consider = (idx, open, priority) => {
            if (idx === undefined) return;
            if (best[idx] && best[idx].priority >= priority) return;
            best[idx] = { open, priority };
        };
        Object.entries(source).forEach(([key, val]) => {
            if (!val || typeof val !== 'object') return;
            const lower = key.toLowerCase();
            const shortIdx = SHORT_KEY_INDEX[lower];
            const longIdx = LONG_KEY_INDEX[lower];
            if (shortIdx === undefined && longIdx === undefined) return;
            const booleanFlag = typeof val.open === 'boolean';
            const open = booleanFlag
                ? val.open
                : (isTime(val.open) || isTime(val.from));
            consider(shortIdx ?? longIdx, open, booleanFlag ? 2 : 1);
        });
        Object.entries(best).forEach(([idx, entry]) => {
            weekdays[idx] = entry.open;
            hasWeekdayData = true;
        });
    }

    return { weekdays, specialDays, hasWeekdayData };
}

/** Öffnungszeiten laden: OpeningHours-Entity, sonst CompanyInfo.opening_hours. */
export async function loadOpeningHours() {
    const page = await base44.entities.OpeningHours.list({ limit: 100 });
    const rows = page.items ?? page ?? [];
    const normalized = normalizeOpeningHours(rows);
    if (rows.length && normalized.hasWeekdayData) return normalized;

    const infoPage = await base44.entities.CompanyInfo.list({ limit: 1 });
    const company = (infoPage.items ?? infoPage)?.[0];
    if (company?.opening_hours) {
        try {
            const parsed = typeof company.opening_hours === 'string'
                ? JSON.parse(company.opening_hours)
                : company.opening_hours;
            const fromCompany = normalizeOpeningHours(parsed);
            if (fromCompany.hasWeekdayData || rows.length === 0) return fromCompany;
        } catch {
            // ungültiges JSON → Standard-Maske behalten
        }
    }
    return normalized;
}

/**
 * Urlaubstage eines Zeitraums: nur Öffnungstage zählen,
 * Ruhetage und Sonderschließungen nicht.
 */
export function getVacationDaysForRange(startDate, endDate, openingHours) {
    if (!startDate || !endDate) return 0;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

    const { weekdays, specialDays } = normalizeOpeningHours(openingHours);
    let days = 0;
    eachDayOfInterval({ start, end }).forEach((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const special = specialDays[key];
        const isOpen = special !== undefined ? special : weekdays[day.getDay()];
        if (isOpen) days += 1;
    });
    return days;
}

/** Tage eines Antrags: gesetztes days_count (halbe Tage) gewinnt. */
export function getRequestDays(request, openingHours) {
    const explicit = request?.days_count;
    if (explicit !== null && explicit !== undefined && explicit !== '' && Number.isFinite(Number(explicit))) {
        return Number(explicit);
    }
    return getVacationDaysForRange(request?.start_date, request?.end_date, openingHours);
}

/**
 * Saldo aus bereits geladenen Daten berechnen (rein, ohne API-Calls).
 */
export function computeVacationBalance({ employeeId, employee, requests = [], entitlements = [], year, openingHours }) {
    const id = employeeId || employee?.id;
    const record = entitlements.find(
        (e) => e.employee_id === id && Number(e.year) === Number(year) && e.is_active !== false,
    );

    const entitlement = round1(record?.days_entitlement ?? employee?.vacation_days_per_year ?? 0);
    const carryover = round1(record?.days_carryover ?? 0);

    const yearPrefix = String(year);
    const yearRequests = requests.filter(
        (r) => r.employee_id === id && r.type === 'Urlaub' && String(r.start_date || '').startsWith(yearPrefix),
    );

    const sumFor = (status) => round1(
        yearRequests.filter((r) => r.status === status)
            .reduce((sum, r) => sum + getRequestDays(r, openingHours), 0),
    );

    const used = sumFor('genehmigt');
    const pending = sumFor('beantragt');
    const available = round1(entitlement + carryover - used - pending);

    return {
        year: Number(year),
        entitlement,
        carryover,
        used,
        pending,
        available,
        available_hours: round1(available * HOURS_PER_VACATION_DAY),
        hasEntitlement: !!record,
    };
}

/** Alle Daten für Urlaubskonten in einem Rutsch laden. */
async function loadVacationData() {
    const [employeePage, requestPage, entitlementPage, openingHours] = await Promise.all([
        base44.entities.Employee.list({ limit: 500 }),
        base44.entities.VacationRequest.list('-created_date', 1000),
        base44.entities.VacationEntitlement.list('-created_date', 500),
        loadOpeningHours(),
    ]);

    return {
        employees: employeePage.items ?? employeePage ?? [],
        requests: requestPage.items ?? requestPage ?? [],
        entitlements: entitlementPage.items ?? entitlementPage ?? [],
        openingHours,
    };
}

/**
 * Urlaubskonto eines Mitarbeiters für ein Jahr laden.
 * Anspruch: VacationEntitlement des Jahres, Fallback Employee.vacation_days_per_year.
 * Übertrag: VacationEntitlement.days_carryover des Jahres, sonst 0.
 */
export async function getVacationBalance(employee_id, year) {
    const { employees, requests, entitlements, openingHours } = await loadVacationData();
    const employee = employees.find((e) => e.id === employee_id) || null;

    return computeVacationBalance({
        employeeId: employee_id,
        employee,
        requests,
        entitlements,
        year,
        openingHours,
    });
}

/** Kontostände mehrerer Mitarbeiter aus einem gemeinsamen Datenstand. */
export async function getVacationBalances(employeeIds, year) {
    const { employees, requests, entitlements, openingHours } = await loadVacationData();
    const map = {};
    (employeeIds || []).forEach((id) => {
        const employee = employees.find((e) => e.id === id) || null;
        map[id] = computeVacationBalance({
            employeeId: id,
            employee,
            requests,
            entitlements,
            year,
            openingHours,
        });
    });
    return map;
}