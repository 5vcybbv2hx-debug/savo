/**
 * Wunschschicht-Kapazität und Warteliste.
 *
 * Belegt zählen nur ausstehende und bestätigte Wünsche. Wartelisten-Einträge
 * zählen NICHT gegen wish_capacity — sie stehen in der Reihenfolge ihres
 * Eintrags (created_date) innerhalb derselben Schichtart und desselben Tages.
 */

export const BELEGT_STATUS = ['ausstehend', 'bestätigt'];
export const WAITLIST_STATUS = 'warteliste';

/** Standardkapazität, wenn am Schichttyp keine wish_capacity gesetzt ist. */
export function capacityFor(shiftType) {
    const cap = shiftType?.wish_capacity;
    return typeof cap === 'number' && cap > 0 ? cap : 2;
}

/** Ist am Schichttyp eine Kapazität ausdrücklich gesetzt? */
export function hasCapacity(shiftType) {
    return typeof shiftType?.wish_capacity === 'number' && shiftType.wish_capacity > 0;
}

/**
 * Auslastung je Tag + Schichtart aufbauen:
 * { "2026-11-07|Aufmachen": { taken: 3, waitlist: [ …sortiert… ] } }
 */
export function buildWishUsage(requests = []) {
    const map = {};
    for (const req of requests) {
        if (!req?.date || !req?.shift_type) continue;
        const key = `${req.date}|${req.shift_type}`;
        const entry = map[key] || (map[key] = { taken: 0, waitlist: [] });
        if (BELEGT_STATUS.includes(req.status)) entry.taken += 1;
        else if (req.status === WAITLIST_STATUS) entry.waitlist.push(req);
    }
    Object.values(map).forEach(entry => {
        entry.waitlist.sort((a, b) => String(a.created_date || '').localeCompare(String(b.created_date || '')));
    });
    return map;
}

export function usageFor(usageMap, date, shiftTypeName) {
    return usageMap?.[`${date}|${shiftTypeName}`] || { taken: 0, waitlist: [] };
}

/** Position eines Eintrags auf der Warteliste (1-basiert) oder null. */
export function waitlistPosition(usageMap, request) {
    if (!request?.date || !request?.shift_type) return null;
    const entry = usageFor(usageMap, request.date, request.shift_type);
    const index = entry.waitlist.findIndex(item => item.id === request.id);
    return index >= 0 ? index + 1 : null;
}