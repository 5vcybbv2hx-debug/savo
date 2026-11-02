/**
 * Gemeinsame Logik für die Schicht-Push-Meldungen ("Neue Schicht eingeplant",
 * "Schicht geändert", "Schicht gelöscht") — genutzt von onShiftChanged,
 * onShiftDeleted und flushShiftNotifyWindows.
 *
 * Regeln:
 *  - Empfänger ist AUSSCHLIESSLICH der Mitarbeiter der betroffenen Schicht
 *    (shift.employee_id). Kein Broadcast, keine anderen Mitarbeiter.
 *  - BÜNDELUNG: Pro Mitarbeiter läuft ein Fenster von 60 Sekunden. Die erste
 *    Änderung im Fenster geht sofort als Einzel-Push raus. Alle weiteren
 *    Änderungen desselben Mitarbeiters innerhalb des Fensters lösen KEINE
 *    Einzel-Push mehr aus — nach Ablauf des Fensters kommt EINE Sammelnachricht.
 *  - Der Fensterzustand liegt NICHT im Speicher (serverless), sondern in der
 *    Entity ShiftNotifyWindow (ein Datensatz pro Mitarbeiter).
 *  - UNDO: Wird eine Schicht gelöscht, die vor weniger als 5 Minuten angelegt
 *    wurde, entsteht GAR KEINE Push und kein Fenster-Eintrag.
 *  - Reine Verwaltungs-/Technikfelder (clockin_reminder_sent, created_by_id,
 *    updated_date, color, recurring-Flags …) lösen KEINE Meldung aus.
 */

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';
const SHIFT_URL = 'https://bar-shift-pro-fc3522b9.base44.app/Calendar';

/** Nur diese Felder rechtfertigen eine "Schicht geändert"-Meldung. */
export const RELEVANT_SHIFT_FIELDS = [
    'date', 'start_time', 'end_time', 'shift_type', 'employee_id', 'notes',
];

/** Bündelungsfenster pro Mitarbeiter. */
const WINDOW_MS = 60000;
/** Löschung einer sehr jungen Schicht = Undo → keine Push. */
const UNDO_MS = 5 * 60 * 1000;
/** Zeitfenster, in dem dieselbe Meldung für dieselbe Schicht nur einmal rausgeht. */
const DEDUP_WINDOW_MS = 120000;

const SINGLE_TITLES = {
    create: 'Neue Schicht eingeplant',
    update: 'Schicht geändert',
    delete: 'Schicht gelöscht',
};

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

/** "2026-11-07" → "07.11." (kurz, für Sammelnachrichten). */
function shortDate(dateStr) {
    if (!dateStr) return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr));
    return match ? `${match[3]}.${match[2]}.` : String(dateStr);
}

function dateRangeLabel(firstDate, lastDate) {
    const first = shortDate(firstDate);
    const last = shortDate(lastDate);
    if (!first && !last) return '';
    if (!last || first === last) return ` – am ${first}`;
    return ` – erste am ${first}, letzte am ${last}`;
}

/** Wurde die Schicht so kurz vorher angelegt, dass die Löschung ein Undo ist? */
export function isUndoDeletion(shift) {
    const created = shift?.created_date;
    if (!created) return false;
    const ts = Date.parse(created);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < UNDO_MS;
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
            url: url || SHIFT_URL,
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

async function getEmployee(base44, employeeId) {
    if (!employeeId) return null;
    return base44.asServiceRole.entities.Employee
        .get(employeeId)
        .catch((err) => (err?.status === 404 ? null : Promise.reject(err)));
}

/** In-App-Meldung + Push an genau einen Mitarbeiter. */
async function sendToEmployee(base44, { employeeId, title, message, relatedId, employeeName }) {
    const employee = await getEmployee(base44, employeeId);

    const notification = {
        type: 'general',
        category: 'schicht',
        priority: 'info',
        title,
        message,
        related_id: relatedId || '',
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
        recipient_name: employeeName || employee?.name || null,
        push: push?.skipped ? push.reason : 'sent',
    };
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

    const result = await sendToEmployee(base44, {
        employeeId,
        title,
        message,
        relatedId: shift.id,
        employeeName: shift.employee_name,
    });

    return { ...result, recipient_employee_id: employeeId };
}

// ── Bündelungsfenster ────────────────────────────────────────────────────────

async function findWindow(base44, employeeId) {
    const res = await base44.asServiceRole.entities.ShiftNotifyWindow.filter(
        { employee_id: employeeId },
        '-created_date',
        10
    );
    const list = Array.isArray(res) ? res : (res?.items || []);
    const usable = list.filter(Boolean);
    return usable.find(w => w.pending) || usable[0] || null;
}

function isWindowOpen(windowRecord, now) {
    if (!windowRecord?.pending || !windowRecord.window_start) return false;
    const started = Date.parse(windowRecord.window_start);
    if (Number.isNaN(started)) return false;
    return now - started < WINDOW_MS;
}

function earlierDate(a, b) {
    if (!a) return b || '';
    if (!b) return a;
    return a <= b ? a : b;
}

function laterDate(a, b) {
    if (!a) return b || '';
    if (!b) return a;
    return a >= b ? a : b;
}

/** Titel + Text der Sammelnachricht — Titel nach überwiegender Art. */
function summaryMessage(windowRecord) {
    const kinds = String(windowRecord.kinds || '').split(',').filter(Boolean);
    const counts = kinds.reduce((acc, kind) => {
        acc[kind] = (acc[kind] || 0) + 1;
        return acc;
    }, {});
    const dominant = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'update';
    const count = windowRecord.count || kinds.length;
    const range = dateRangeLabel(windowRecord.first_date, windowRecord.last_date);

    if (dominant === 'create') {
        return { title: 'Mehrere Schichten eingeplant', message: `${count} neue Schichten eingeplant${range}` };
    }
    if (dominant === 'delete') {
        return { title: 'Mehrere Schichten gelöscht', message: `${count} Schichten gelöscht${range}` };
    }
    return { title: 'Mehrere Schichten aktualisiert', message: `${count} Schichten geändert${range}` };
}

async function closeWindow(base44, windowRecord) {
    await base44.asServiceRole.entities.ShiftNotifyWindow.update(windowRecord.id, {
        pending: false,
        count: 0,
        kinds: '',
    });
}

/**
 * Fenster abschließen: bei mehr als einer Änderung EINE Sammelnachricht senden,
 * bei genau einer ist die Einzel-Push schon raus.
 */
async function flushWindow(base44, windowRecord) {
    const count = windowRecord.count || 0;
    if (count < 2) {
        await closeWindow(base44, windowRecord);
        return { employee_id: windowRecord.employee_id, count, summary: null };
    }

    const { title, message } = summaryMessage(windowRecord);
    await sendToEmployee(base44, {
        employeeId: windowRecord.employee_id,
        employeeName: windowRecord.employee_name,
        title,
        message,
        relatedId: windowRecord.id,
    });
    await closeWindow(base44, windowRecord);
    return { employee_id: windowRecord.employee_id, count, summary: `${title}: ${message}` };
}

/**
 * Zentrale Eintrittstelle: eine Schicht-Änderung melden.
 * kind = 'create' | 'update' | 'delete'
 */
export async function notifyShiftChange(base44, { shift, kind }) {
    const employeeId = shift?.employee_id;
    if (!employeeId) return { skipped: true, reason: 'no_employee_id' };
    if (!SINGLE_TITLES[kind]) return { skipped: true, reason: 'unknown_kind' };

    // Undo-Fall: junge Schicht wird kurz nach dem Anlegen gelöscht
    if (kind === 'delete' && isUndoDeletion(shift)) {
        return { skipped: true, reason: 'undo_within_5min' };
    }

    const now = Date.now();
    const windowRecord = await findWindow(base44, employeeId);
    const windowOpen = isWindowOpen(windowRecord, now);

    // Abgelaufenes Fenster zuerst abschließen, damit keine Sammelnachricht verloren geht
    if (windowRecord?.pending && !windowOpen) {
        await flushWindow(base44, windowRecord);
    }

    // Innerhalb des Fensters: nur zählen, keine weitere Einzel-Push
    if (windowOpen) {
        const updated = await base44.asServiceRole.entities.ShiftNotifyWindow.update(windowRecord.id, {
            count: (windowRecord.count || 0) + 1,
            kinds: [windowRecord.kinds, kind].filter(Boolean).join(','),
            first_date: earlierDate(windowRecord.first_date, shift.date),
            last_date: laterDate(windowRecord.last_date, shift.date),
        });
        return {
            bundled: true,
            window_start: windowRecord.window_start,
            window_count: updated?.count ?? (windowRecord.count || 0) + 1,
        };
    }

    // Neues Fenster öffnen — die erste Änderung geht sofort als Einzel-Push raus
    const payload = {
        employee_id: employeeId,
        employee_name: shift.employee_name || '',
        window_start: new Date(now).toISOString(),
        count: 1,
        kinds: kind,
        first_date: shift.date || '',
        last_date: shift.date || '',
        pending: true,
    };
    if (windowRecord) {
        await base44.asServiceRole.entities.ShiftNotifyWindow.update(windowRecord.id, payload);
    } else {
        await base44.asServiceRole.entities.ShiftNotifyWindow.create(payload);
    }

    const title = SINGLE_TITLES[kind];
    const result = await notifyShiftEmployee(base44, {
        shift,
        title,
        message: formatShiftMessage(shift),
    });

    return { ...result, window_started: true, window_count: 1 };
}

/**
 * Alle abgelaufenen Fenster abschließen (Aufruf durch den Minutentakt-Workflow).
 */
export async function flushShiftNotifyWindows(base44) {
    const now = Date.now();
    const res = await base44.asServiceRole.entities.ShiftNotifyWindow.filter({ pending: true }, '-window_start', 200);
    const list = (Array.isArray(res) ? res : (res?.items || [])).filter(Boolean);
    const due = list.filter(w => w.window_start && (now - Date.parse(w.window_start)) >= WINDOW_MS);

    const results = [];
    for (const windowRecord of due) {
        results.push(await flushWindow(base44, windowRecord));
    }

    return {
        checked_windows: list.length,
        flushed_windows: results.length,
        summaries_sent: results.filter(r => r.summary).length,
        results,
    };
}