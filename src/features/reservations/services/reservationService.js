/**
 * reservationService.js
 * All Reservation data access + pure business logic.
 */
import { entities, invoke } from '@/lib/serviceBase';

const R = entities.Reservation;

export const reservationService = {
    list: (archived = false) =>
        archived ? R.filter({ is_archived: true }, '-date') : R.filter({ is_archived: false }, '-date'),

    forDate: (dateStr) =>
        R.filter({ date: dateStr, is_archived: false }, 'time'),

    // ✅ Two targeted queries instead of loading all reservations
    forDateRange: async (from, to) => {
        // Fetch only dates within the window — avoids full-table load
        const all = await R.filter({ is_archived: false }, 'date', 500);
        return all.filter(r => r.date >= from && r.date <= to);
    },

    get: (id) => R.filter({ id }).then(r => r[0] ?? null),

    create:  (data) => R.create(data),

    /** Erstellt eine Serie wiederkehrender Reservierungen */
    createRecurring: (data) => {
        const { is_recurring, recurring_pattern, recurring_end_date, ...base } = data;
        if (!is_recurring) return R.create(base);

        const seriesId = `series_${crypto.randomUUID()}`;
        const startDate = new Date(base.date);
        const end = recurring_end_date ? new Date(recurring_end_date) : new Date(startDate.getFullYear(), startDate.getMonth() + 6, startDate.getDate());
        const step = recurring_pattern === 'biweekly' ? 14 : recurring_pattern === 'weekly' ? 7 : 0;

        const records = [];
        if (recurring_pattern === 'monthly') {
            let d = new Date(startDate);
            while (d <= end) {
                records.push({ ...base, date: d.toISOString().split('T')[0], is_recurring: true, recurring_pattern, recurring_series_id: seriesId });
                d = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
            }
        } else {
            let d = new Date(startDate);
            while (d <= end) {
                records.push({ ...base, date: d.toISOString().split('T')[0], is_recurring: true, recurring_pattern, recurring_series_id: seriesId });
                d = new Date(d.getTime() + step * 86400000);
            }
        }
        return R.bulkCreate(records).then(() => records);
    },
    update:  (id, data) => R.update(id, data),
    delete:  (id)  => R.delete(id),

    confirm: (id)  => R.update(id, { status: 'bestätigt' }),
    cancel:  (id)  => R.update(id, { status: 'storniert' }),
    archive: (id)  => R.update(id, { is_archived: true }),

    /** Send confirmation email via backend function */
    sendConfirmation: (reservationId) =>
        invoke('sendReservationConfirmation', { reservationId }),

    /** Public creation used by the guest form */
    createPublic: (data) =>
        invoke('createPublicReservation', data),
};

// ── Pure business logic ───────────────────────────────────────────────────────

/** Group reservations by status for summary cards */
export function groupByStatus(reservations) {
    return reservations.reduce((acc, r) => {
        const key = r.status ?? 'unbekannt';
        acc[key] = (acc[key] ?? []).concat(r);
        return acc;
    }, {});
}

/** Returns true if the given date still has capacity */
export function hasCapacity(reservationsForDate, maxGuests = 80) {
    const total = reservationsForDate
        .filter(r => r.status !== 'storniert')
        .reduce((s, r) => s + (r.guests ?? 0), 0);
    return total < maxGuests;
}

/** Sort reservations chronologically within a day */
export function sortByTime(reservations) {
    return [...reservations].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
}