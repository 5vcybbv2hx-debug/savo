import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';
const URL_SHIFT_SWAPS = 'https://bar-shift-pro-fc3522b9.base44.app/ShiftSwaps';

async function pushToEmployees(employeeIds, title, message, url) {
    if (!employeeIds || employeeIds.length === 0) return null;
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY_2');
    if (!apiKey) throw new Error('OneSignal API-Key fehlt (ONESIGNAL_REST_API_KEY_2)');
    const payload = {
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: employeeIds.map(String) },
        target_channel: 'push',
        headings: { en: title, de: title },
        contents: { en: message, de: message }
    };
    if (url) payload.url = url;
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
        const errStr = JSON.stringify(data);
        if (/invalid_aliases/i.test(errStr)) return { skipped: true, reason: 'invalid_aliases' };
        throw new Error(`OneSignal API error: ${errStr}`);
    }
    return data;
}

async function pushToEmployee(employeeId, title, message, url) {
    if (!employeeId) return null;
    return pushToEmployees([employeeId], title, message, url);
}

async function getManagerIds(base44) {
    const employees = await base44.asServiceRole.entities.Employee.filter({ is_active: true });
    return employees.filter(e => e.role === 'Manager' || e.role === 'Orga').map(e => e.id);
}

async function getAllActiveEmployeeIds(base44, excludeId) {
    const employees = await base44.asServiceRole.entities.Employee.filter({ is_active: true });
    return employees.filter(e => e.id !== excludeId).map(e => e.id);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = String(dateStr).split('-');
    if (!y || !m || !d) return String(dateStr);
    return `${d}.${m}.${y}`;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const { event, data, old_data } = body;

        if (!event || !data) return Response.json({ message: 'Invalid payload' }, { status: 400 });

        const isCreate = event.type === 'create';
        const isUpdate = event.type === 'update';

        if (isCreate) {
            const requesterName = data.requesting_employee_name || 'Ein Kollege';
            const requesterId = data.requesting_employee_id;
            const shiftDate = formatDate(data.shift_date || data.date);
            const targetEmployeeId = data.target_employee_id;
            const targetName = data.target_employee_name || 'seinem Kollegen';
            const managerIds = await getManagerIds(base44);

            if (!targetEmployeeId) {
                // Offenes Tauschmarkt-Angebot → ALLE aktiven Mitarbeiter (außer Anfrager) + Manager-Notification
                const title = '🔄 Schicht im Tauschmarkt';
                const message = `${requesterName} bietet die Schicht${shiftDate ? ` am ${shiftDate}` : ''} zur Übernahme an — schau im Tauschmarkt vorbei.`;
                await base44.asServiceRole.entities.Notification.create({
                    type: 'general', category: 'schicht', title, message,
                    related_id: data.id, target_roles: ['Manager'], read_by: []
                });
                const allIds = await getAllActiveEmployeeIds(base44, requesterId);
                await pushToEmployees(allIds, title, message, URL_SHIFT_SWAPS);
                return Response.json({ success: true, action: 'marketplace_notified_all_employees', notified: allIds.length });
            }

            // Direkter Tausch → Ziel-Mitarbeiter + Manager/Orga benachrichtigen
            const targetTitle = 'Schichttausch-Anfrage 🔄';
            const targetMsg = `${requesterName} möchte mit dir die Schicht${shiftDate ? ` am ${shiftDate}` : ''} tauschen.`;
            await base44.asServiceRole.entities.Notification.create({
                type: 'general', category: 'schicht', title: targetTitle, message: targetMsg,
                related_id: data.id, recipient_id: targetEmployeeId, read_by: []
            });
            await pushToEmployee(targetEmployeeId, targetTitle, targetMsg, URL_SHIFT_SWAPS);

            const mgrTitle = '🔄 Direkter Schichttausch';
            const mgrMsg = `${requesterName} hat ${targetName} zum direkten Schichttausch${shiftDate ? ` am ${shiftDate}` : ''} gebeten.`;
            await base44.asServiceRole.entities.Notification.create({
                type: 'general', category: 'schicht', title: mgrTitle, message: mgrMsg,
                related_id: data.id, target_roles: ['Manager'], read_by: []
            });
            await pushToEmployees(managerIds, mgrTitle, mgrMsg, URL_SHIFT_SWAPS);

            return Response.json({ success: true, action: 'direct_notified_target_and_managers' });
        }

        if (isUpdate) {
            const newStatus = data.status;
            const oldStatus = old_data?.status;
            if (!newStatus || newStatus === oldStatus) return Response.json({ message: 'Status unchanged' });

            const requesterName = data.requesting_employee_name || 'Ein Kollege';
            const targetName = data.target_employee_name || 'sein Kollege';
            const shiftDate = formatDate(data.shift_date || data.date);
            const managerIds = await getManagerIds(base44);
            const actions = [];

            // B hat bestätigt → Manager muss genehmigen.
            // 'angenommen' = Ziel hat den Direkttausch bestätigt (Frontend erstellt
            // dabei bereits eine Manager-Notification — daher hier NUR Push, keine
            // Duplikat-Notification). 'in_prüfung' = manueller Status → Notification + Push.
            if (['angenommen', 'in_prüfung'].includes(newStatus)) {
                const title = '⏳ Tausch wartet auf Genehmigung';
                const message = `${requesterName} ↔ ${targetName}${shiftDate ? ` am ${shiftDate}` : ''} — bitte in der Schichtwechsel-Inbox genehmigen.`;
                if (newStatus === 'in_prüfung') {
                    await base44.asServiceRole.entities.Notification.create({
                        type: 'general', category: 'schicht', title, message,
                        related_id: data.id, target_roles: ['Manager'], read_by: []
                    });
                }
                await pushToEmployees(managerIds, title, message, URL_SHIFT_SWAPS);
                actions.push('notified_managers_approval');
            }

            // Bestehend: angenommen/abgelehnt → Requester benachrichtigen
            if (['angenommen', 'abgelehnt'].includes(newStatus)) {
                const requestingEmployeeId = data.requesting_employee_id;
                if (requestingEmployeeId) {
                    const accepted = newStatus === 'angenommen';
                    const title = accepted ? 'Tausch angenommen ✅' : 'Tausch abgelehnt ❌';
                    const message = accepted
                        ? `${targetName} hat deinen Schichttausch angenommen.`
                        : `${targetName} hat deinen Schichttausch abgelehnt.`;
                    await base44.asServiceRole.entities.Notification.create({
                        type: 'general', category: 'schicht', title, message,
                        related_id: data.id, recipient_id: requestingEmployeeId, read_by: []
                    });
                    await pushToEmployee(requestingEmployeeId, title, message, URL_SHIFT_SWAPS);
                    actions.push('notified_requester');
                }
            }

            if (actions.length === 0) return Response.json({ message: 'No notification needed' });
            return Response.json({ success: true, actions });
        }

        return Response.json({ message: 'Unhandled event type' });
    } catch (error) {
        console.error('[onShiftSwapEvent] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});