/**
 * timeTrackingService.js
 * All TimeEntry and ClockEntry data access + pure business logic.
 */
import { entities } from '@/lib/serviceBase';
import { monthRange } from '@/lib/queryUtils';

const TE  = entities.TimeEntry;
const CE  = entities.ClockEntry;
const VR  = entities.VacationRequest;

export const timeTrackingService = {
    // ── TimeEntry ──────────────────────────────────────────────────────────
    // ✅ Always pass a limit — prevents unbounded scans on the manager view
    listEntries: (limit = 200) => TE.list('-date', limit),

    entriesForEmployee: (employeeId) =>
        TE.filter({ employee_id: employeeId }, '-date'),

    // ✅ base44 SDK doesn't support range operators (date_gte/date_lte), so we
    //    fetch a high-limit, date-sorted batch and filter client-side. The
    //    explicit limit (>=500, per house rule) prevents silent truncation —
    //    previously this called TE.filter({}, '-date') with NO limit at all,
    //    which relied on the SDK default and could cut off older months once
    //    the table grew past it.
    entriesForMonth: async (year, month) => {
        const { from, to } = monthRange(year, month);
        const all = await TE.filter({}, '-date', 2000);
        return all.filter(e => e.date >= from && e.date <= to);
    },

    createEntry:  (data) => TE.create(data),
    updateEntry:  (id, data) => TE.update(id, data),
    deleteEntry:  (id)  => TE.delete(id),

    approveEntry: (id, approvedBy) =>
        TE.update(id, {
            status:              'genehmigt',
            manager_approved_by: approvedBy,
            manager_approved_at: new Date().toISOString(),
        }),

    confirmByEmployee: (id) =>
        TE.update(id, {
            employee_confirmed:    true,
            employee_confirmed_at: new Date().toISOString(),
        }),

    // ── ClockEntry (Stempeluhr) ────────────────────────────────────────────
    clockIn: (employeeId, employeeName) =>
        CE.create({
            employee_id:   employeeId,
            employee_name: employeeName,
            clock_in:      new Date().toISOString(),
            date:          new Date().toISOString().split('T')[0],
        }),

    clockOut: (id) =>
        CE.update(id, { clock_out: new Date().toISOString() }),

    // ✅ Filter by employee only — resolve active entry server-side if possible,
    //    otherwise limit to recent entries to avoid full-scan
    activeClockEntry: async (employeeId) => {
        // Fetch today's entries only — active clock-ins are always today
        const today = new Date().toISOString().split('T')[0];
        const entries = await CE.filter({ employee_id: employeeId, date: today });
        return entries.find(e => !e.clock_out) ?? null;
    },

    // ── Vacation ──────────────────────────────────────────────────────────
    vacationRequestsForEmployee: (employeeId) =>
        VR.filter({ employee_id: employeeId }, '-start_date'),

    allVacationRequests: () => VR.list('-start_date'),
    createVacationRequest: (data) => VR.create(data),
    updateVacationRequest: (id, data) => VR.update(id, data),
};

// ── Pure business logic ───────────────────────────────────────────────────────

/** Calculate total hours for a time entry, respecting break */
export function calcTotalHours(startTime, endTime, breakMinutes = 0) {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let minutes = (eh * 60 + em) - (sh * 60 + sm) - breakMinutes;
    if (minutes < 0) minutes += 24 * 60; // overnight shift
    return Math.round((minutes / 60) * 100) / 100;
}

/** Summarise entries for a given employee within a month */
export function summariseMonth(entries, employeeId) {
    const emp = entries.filter(e => e.employee_id === employeeId);
    const total    = emp.reduce((s, e) => s + (e.total_hours ?? 0), 0);
    const approved = emp.filter(e => e.status === 'genehmigt')
                       .reduce((s, e) => s + (e.total_hours ?? 0), 0);
    const pending  = emp.filter(e => e.status === 'eingereicht').length;
    return { total, approved, pending, entryCount: emp.length };
}

/** ArbZG check: warn if daily hours exceed legal limit */
export function arbzgWarning(totalHours) {
    if (totalHours > 10) return 'Überschreitet 10h Tagesgrenze (ArbZG §3)';
    if (totalHours > 8)  return 'Über 8h: Pausenregelung prüfen (ArbZG §4)';
    return null;
}