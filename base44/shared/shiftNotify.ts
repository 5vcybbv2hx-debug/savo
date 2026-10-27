/**
 * Gemeinsame Logik für die Schicht-Push-Meldungen ("Neue Schicht eingeplant",
 * "Schicht geändert", "Schicht gelöscht") — genutzt von onShiftChanged und
 * onShiftDeleted.
 *
 * Regeln:
 *  - Empfänger ist AUSSCHLIESSLICH der Mitarbeiter der betroffenen Schicht
 *    (shift.employee_id). Kein Broadcast, keine anderen Mitarbeiter.
 *  - Es geht maximal EINE Meldung pro Schicht und Titel innerhalb des
 *    Dedup-Fensters raus (Schutz gegen Mehrfach-Trigger).
 *  - Reine Verwaltungs-/Technikfelder (clockin_reminder_sent, is_sample,
 *    created_by_id, updated_date, color, recurring-Flags …) lösen KEINE
 *    Meldung aus — sonst feuert jeder automatische Feld-Write (z.B. das
 *    Setzen von clockin_reminder_sent durch die Einstempel-Erinnerung)
 *    eine überflüssige "Schicht geändert"-Meldung.
 */

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';
const SHIFT_URL = 'https://bar-shift-pro-fc3522b9.base44.app/Calendar';

/** Nur diese Felder rechtfertigen eine "Schicht geändert"-Meldung. */
export const RELEVANT_SHIFT_FIELDS = [
    'date', 'start_time', 'end_time', 'shift_type', 'employee_id', 'notes',
];

/** Zeitfenster, in dem dieselbe Meldung für dieselbe Schicht nur einmal rausgeht. */
const DEDUP_WINDOW_MS = 120000;

/**
 * Trigger-Payload normalisieren.
 * Workflow-Trigger liefert { trigger_type, event_type, data, old_data, changed_fields },
 * die migrierte Automation liefert { event: { type }, data, old_data }.
 */
export function parseShiftPayload(body) {
    return {
        eventType: body?.event?.type || body?.event_type || null,
        data: body?.data || body?.old_data || null,
        oldData: body?.old_data || null,
        changedFields: Array.isArray(body?.changed_fields) ? body.changed_fields : null,
    };
}

function norm(value) {
    return value === undefined || value === null ? '' : String(value);
}

/**
 * Prüft, ob überhaupt eine planrelevante Änderung vorliegt.
 * Reihenfolge: changed_fields (präzise) → Vergleich data/old_data → im Zweifel melden.
 */
export function isRelevantShiftChange(eventType, data, oldData, changedFields) {
    if (eventType === 'create' || eventType === 'delete') return true;
    if (changedFields) return changedFields.some(field => RELEVANT_SHIFT_FIELDS.includes(field));
    if (!oldData) return true;
    return RELEVANT_SHIFT_FIELDS.some(field => norm(data?.[field]) !== norm(oldData?.[field]));
}

export function formatShiftMessage(shift) {
    const dateStr = shift?.date || '';
    const timeStr = shift?.start_time ? `${shift.start_time}–${shift.end_time || ''}` : '';
    const typeStr = shift?.shift_type ? ` (${shift.shift_type})` : '';
    return `${dateStr} ${timeStr}${typeStr}`.trim();
}

/** OneSignal-Push an genau eine Employee-Entity-ID. */
export async function pushToEmployee(employeeId, title, message, url) {
    if (!employeeId) return { skipped: true, reason: 'no_employee_id' };
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY_2');
    if (!apiKey) throw new Error('OneSignal API-Key fehlt (ONESIGNAL_REST_API_KEY_2)');

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_aliases: { external_id: [String(employeeId)] },
            target_channel: 'push',
            headings: { en: title, de: title },
            contents: { en: message, de: message },
            url,
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const errStr = JSON.stringify(data);
        // Gerät nicht registriert → kein Fehler, nur keine Push
        if (/invalid_aliases/i.test(errStr)) return { skipped: true, reason: 'invalid_aliases' };
        throw new Error(`OneSignal API error: ${errStr}`);
    }
    return data;
}

/** Wurde dieselbe Meldung für diese Schicht gerade eben schon verschickt? */
async function alreadySent(base44, shiftId, title) {
    if (!shiftId) return false;
    const res = await base44.asServiceRole.entities.Notification.filter(
        { related_id: shiftId, category: 'schicht', title },
        '-created_date',
        5
    );
    const list = Array.isArray(res) ? res : (res?.items || []);
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    return list.some(n => n?.created_date && new Date(n.created_date).getTime() >= cutoff);
}

/**
 * Meldung + Push an den Mitarbeiter der Schicht.
 * Pro Schicht + Titel maximal eine Meldung im Dedup-Fenster.
 */
export async function notifyShiftEmployee(base44, { shift, title, message }) {
    const employeeId = shift?.employee_id;
    if (!employeeId) return { skipped: true, reason: 'no_employee_id' };

    if (await alreadySent(base44, shift.id, title)) {
        return { skipped: true, reason: 'duplicate_within_window' };
    }

    const employee = await base44.asServiceRole.entities.Employee
        .get(employeeId)
        .catch((err) => (err?.status === 404 ? null : Promise.reject(err)));

    const notification = {
        type: 'general',
        category: 'schicht',
        priority: 'info',
        title,
        message,
        related_id: shift.id,
        // Empfänger = ausschließlich dieser Mitarbeiter (leer = globale Meldung!)
        recipient_id: employeeId,
        read_by: [],
    };
    if (employee?.email) notification.recipient_email = employee.email;

    await base44.asServiceRole.entities.Notification.create(notification);

    const push = await pushToEmployee(employeeId, title, message, SHIFT_URL);

    return {
        sent: true,
        recipient_employee_id: employeeId,
        recipient_name: shift.employee_name || employee?.name || null,
        push: push?.skipped ? push.reason : 'sent',
    };
}