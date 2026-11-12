/**
 * Liquiditäts- und Tilgungsplan (Soll).
 *
 * Erzeugt wochenweise Planzeilen von KW 46/2026 bis KW 10/2027:
 * Umsatz aus dem Vorjahr (gleiche ISO-KW) × Trend der letzten 6 Wochen,
 * Fixkosten/SV/USt nach festen Fälligkeitstagen, Personal aus TimeEntry der
 * Vorwoche und Tilgungsraten aus den offenen Posten.
 */
import { addDays, startOfISOWeek, getISOWeek, getISOWeekYear } from 'date-fns';

export const PLAN_START = { year: 2026, week: 46 };
export const PLAN_END = { year: 2027, week: 10 };

export const COSTS = {
    pacht: 2570.4,          // am 10. des Monats
    gewerbemiete: 435,      // Monatsanfang
    wohnungsmiete: 440,     // Monatsanfang
    strom: 1270,            // Monatsanfang
    marco1: 1500,           // am 1.
    marco2: 350,            // am 15.
    sv: 1725,               // am 15.
    cardShare: 0.55,        // Kartengutschrift
    cardFee: 0.015,         // Kartengebühr
    cashShare: 0.125,       // Bareinzahlung
    cogsRate: 0.33,         // Wareneinsatz
    vatRate: 0.1597,        // USt-Satz auf den Überschuss
    reserveTaxRate: 0.10,   // Einkommensteuer-Rücklage vom Wochenüberschuss
    minCumForGreen: 2000,   // Ampel: gelb unter diesem kumulierten Stand
};

// Tilgungsraten je Gläubiger (jederzeit anpassbar)
export const DEBT_RATES = [
    { key: /mebold/i, name: 'Mebold', rate: rateForMebold },
    { key: /aok/i, name: 'AOK', rate: () => 200 },
    { key: /eos/i, name: 'EOS KSI', rate: () => 50 },
    { key: /knappschaft/i, name: 'Knappschaft', rate: () => 50 },
];
const OTHER_DEBT_RATE = 50;

function rateForMebold(weekStart) {
    return weekStart <= '2027-03-31' ? 400 : 1000;
}

// ── Formatierung ────────────────────────────────────────────────────────────
export const euro = (n) => `${(Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
export const euro0 = (n) => `${Math.round(Number(n) || 0).toLocaleString('de-DE')} €`;
export const parseDate = (s) => {
    if (!s) return null;
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
};
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dmy = (s) => {
    const d = parseDate(s);
    return d ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}` : '—';
};
export const kwLabel = (row) => `KW ${row.week}/${row.year}`;
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ── Kalenderwochen ──────────────────────────────────────────────────────────
export function isoMonday(year, week) {
    const week1 = startOfISOWeek(new Date(year, 0, 4));
    return addDays(week1, (week - 1) * 7);
}

export function planWeeks() {
    const start = isoMonday(PLAN_START.year, PLAN_START.week);
    const end = isoMonday(PLAN_END.year, PLAN_END.week);
    const out = [];
    for (let d = start; d <= end; d = addDays(d, 7)) {
        out.push({
            year: getISOWeekYear(d),
            week: getISOWeek(d),
            week_start: ymd(d),
            week_end: ymd(addDays(d, 6)),
            monday: d,
        });
    }
    return out;
}

const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
const hasDay = (monday, day) => weekDays(monday).some((d) => d.getDate() === day);
const monthKey = (dateStr) => String(dateStr || '').slice(0, 7);

// ── Personal ────────────────────────────────────────────────────────────────
function staffByWeek(timeEntries, employees, currentWeekStart) {
    const rateById = new Map((employees || []).map((e) => [e.id, e.hourly_rate || 16]));
    const map = new Map();
    for (const te of timeEntries || []) {
        const d = parseDate(te.date);
        // Die laufende Woche ist noch nicht vollständig erfasst — nicht als Planbasis nehmen.
        if (!d || ymd(d) >= currentWeekStart) continue;
        const monday = ymd(startOfISOWeek(d));
        const rate = rateById.get(te.employee_id) ?? 16;
        map.set(monday, (map.get(monday) || 0) + (te.total_hours || 0) * rate);
    }
    return map;
}

// Personal der Vorwoche; fehlt sie (Zukunft), gilt die letzte bekannte Woche.
function previousStaff(map, monday) {
    const limit = ymd(addDays(monday, -7));
    let best = null;
    for (const [key, value] of map) {
        if (key <= limit && value > 0 && (!best || key > best.key)) best = { key, value };
    }
    return best ? best.value : 0;
}

// ── Umsatzprognose ──────────────────────────────────────────────────────────
function revenueTrend(revByDate, currentMonday) {
    let actual = 0;
    let lastYear = 0;
    for (let i = 1; i <= 6; i++) {
        const monday = addDays(currentMonday, -7 * i);
        for (const day of weekDays(monday)) {
            actual += revByDate.get(ymd(day)) || 0;
            lastYear += revByDate.get(ymd(addDays(day, -364))) || 0;
        }
    }
    if (actual <= 0 || lastYear <= 0) return 1;
    return Math.min(1.8, Math.max(0.5, actual / lastYear));
}

function lastYearWeekRevenue(revByDate, monday) {
    let sum = 0;
    for (const day of weekDays(monday)) sum += revByDate.get(ymd(addDays(day, -364))) || 0;
    return sum;
}

function recentAverageWeek(revByDate, currentMonday) {
    let sum = 0;
    let weeks = 0;
    for (let i = 1; i <= 8; i++) {
        const monday = addDays(currentMonday, -7 * i);
        let weekSum = 0;
        for (const day of weekDays(monday)) weekSum += revByDate.get(ymd(day)) || 0;
        if (weekSum > 0) { sum += weekSum; weeks++; }
    }
    return weeks > 0 ? sum / weeks : 0;
}

// ── Tilgungen ───────────────────────────────────────────────────────────────
const statusRank = { kritisch: 0, hoch: 1, mittel: 2, niedrig: 3 };

function invoiceRef(item) {
    const fromTitle = String(item.titel || '').match(/\d{4,}/);
    if (fromTitle) return fromTitle[0];
    if (item.brief_nr) return String(item.brief_nr);
    return String(item.titel || 'Posten').slice(0, 28);
}

function buildDebtQueues(openItems) {
    const items = (openItems || [])
        .filter((p) => (p.status === 'offen' || p.status === 'geplant') && (p.betrag || 0) > 0)
        .sort((a, b) => (statusRank[a.prioritaet] ?? 9) - (statusRank[b.prioritaet] ?? 9) || (b.betrag || 0) - (a.betrag || 0));

    const queues = DEBT_RATES.map((cfg) => ({
        name: cfg.name,
        rate: cfg.rate,
        invoices: items
            .filter((p) => cfg.key.test(`${p.glaeubiger || ''} ${p.titel || ''}`))
            .map((p) => ({ rechnung: invoiceRef(p), name: p.glaeubiger || cfg.name, rest: p.betrag || 0 })),
    }));

    const assigned = new Set(queues.flatMap((q) => q.invoices.map((i) => i.rechnung)));
    queues.push({
        name: 'Sonstige',
        rate: () => OTHER_DEBT_RATE,
        invoices: items
            .filter((p) => !assigned.has(invoiceRef(p)))
            .map((p) => ({ rechnung: invoiceRef(p), name: p.glaeubiger || 'Sonstiges', rest: p.betrag || 0 })),
    });

    return queues.filter((q) => q.invoices.length > 0);
}

/** Verteilt die Wochenrate auf die offenen Rechnungen und liefert die Einzelposten. */
function consumeDebt(queue, rate) {
    const payments = [];
    let left = rate;
    while (left > 0.004 && queue.invoices.length > 0) {
        const inv = queue.invoices[0];
        const pay = Math.min(left, inv.rest);
        payments.push({ glaeubiger: queue.name, betrag: round2(pay), rechnung: inv.rechnung });
        inv.rest = round2(inv.rest - pay);
        left = round2(left - pay);
        if (inv.rest <= 0.004) queue.invoices.shift();
    }
    return payments;
}

// ── Plan bauen ──────────────────────────────────────────────────────────────
export function buildPlan({ revenues, timeEntries, employees, openItems, openingBalance }) {
    const revByDate = new Map((revenues || []).map((r) => [r.date, r.revenue || 0]));
    const currentMonday = startOfISOWeek(new Date());
    const trend = revenueTrend(revByDate, currentMonday);
    const fallbackRevenue = recentAverageWeek(revByDate, currentMonday);
    const staffMap = staffByWeek(timeEntries, employees, ymd(currentMonday));
    const queues = buildDebtQueues(openItems);
    const opening = round2(openingBalance || 0);

    // 1. Grundwerte je Woche (ohne USt, Tilgung, Saldo)
    const rows = planWeeks().map((w) => {
        const lastYear = lastYearWeekRevenue(revByDate, w.monday);
        const revenuePlan = round2((lastYear > 0 ? lastYear : fallbackRevenue) * trend);
        const fixedStart = COSTS.gewerbemiete + COSTS.wohnungsmiete + COSTS.strom;

        const costFixed = round2(
            (hasDay(w.monday, 1) ? fixedStart : 0) + (hasDay(w.monday, 10) ? COSTS.pacht : 0)
        );
        const costStaff = round2(
            previousStaff(staffMap, w.monday)
            + (hasDay(w.monday, 1) ? COSTS.marco1 : 0)
            + (hasDay(w.monday, 15) ? COSTS.marco2 : 0)
        );

        return {
            year: w.year,
            week: w.week,
            week_start: w.week_start,
            week_end: w.week_end,
            revenue_plan: revenuePlan,
            inflow_card: round2(revenuePlan * COSTS.cardShare * (1 - COSTS.cardFee)),
            inflow_cash: round2(revenuePlan * COSTS.cashShare),
            cost_fixed: costFixed,
            cost_staff: costStaff,
            cost_sv: hasDay(w.monday, 15) ? COSTS.sv : 0,
            cost_vat: 0,
            reserve_vat: 0,
            reserve_tax: 0,
            reserve_aok: 0,
            debt_rate: 0,
            debt_payments: [],
            balance_end: 0,
            balance_cum: 0,
            opening_balance: opening,
            traffic_light: 'gruen',
            notes: '',
            is_locked: false,
        };
    });

    // 2. Umsatzsteuer: Voranmeldung am 10. für den Vormonat
    const months = new Map();
    for (const r of rows) {
        const key = monthKey(r.week_start);
        const m = months.get(key) || { revenue: 0, fixed: 0, staff: 0 };
        m.revenue += r.revenue_plan;
        m.fixed += r.cost_fixed;
        m.staff += r.cost_staff;
        months.set(key, m);
    }
    const vatForMonth = (key) => {
        const m = months.get(key);
        if (!m) return 0;
        const base = m.revenue - m.revenue * COSTS.cogsRate - m.fixed - m.staff;
        return base > 0 ? round2(base * COSTS.vatRate) : 0;
    };

    for (const r of rows) {
        const monday = parseDate(r.week_start);
        const dutyDay = weekDays(monday).find((d) => d.getDate() === 10);
        if (dutyDay) {
            const prev = new Date(dutyDay.getFullYear(), dutyDay.getMonth() - 1, 1);
            r.cost_vat = vatForMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
        }
        r.reserve_vat = r.cost_vat;
        r.reserve_aok = r.cost_sv;
    }

    // 3. Tilgungen, Rücklage Einkommensteuer, Saldo und Kumulation
    let cumulative = opening;
    for (const r of rows) {
        const payments = [];
        for (const queue of queues) {
            payments.push(...consumeDebt(queue, queue.rate(r.week_start)));
        }
        r.debt_payments = payments;
        r.debt_rate = round2(payments.reduce((s, p) => s + p.betrag, 0));

        const surplus = round2(
            r.inflow_card + r.inflow_cash - r.cost_fixed - r.cost_staff - r.cost_sv - r.cost_vat - r.debt_rate
        );
        r.reserve_tax = surplus > 0 ? round2(surplus * COSTS.reserveTaxRate) : 0;
        r.balance_end = round2(surplus - r.reserve_tax);
        cumulative = round2(cumulative + r.balance_end);
        r.balance_cum = cumulative;
        r.traffic_light = cumulative < 0 ? 'rot' : cumulative < COSTS.minCumForGreen ? 'gelb' : 'gruen';
    }

    return rows;
}

/** Kennzahlen für die Kopfzeile. */
export function planKpis(rows, openItems, openingBalance) {
    const list = rows || [];
    const lowest = list.reduce((min, r) => Math.min(min, r.balance_cum), openingBalance || 0);
    const turningPoint = list.find((r) => r.balance_cum > 0) || null;
    const restDebt = (openItems || [])
        .filter((p) => (p.status === 'offen' || p.status === 'geplant') && (p.betrag || 0) > 0)
        .reduce((s, p) => s + (p.betrag || 0), 0);
    return { openingBalance: round2(openingBalance || 0), lowest: round2(lowest), turningPoint, restDebt: round2(restDebt) };
}