import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';

async function pushToEmployees(employeeIds, title, message) {
    if (!employeeIds || employeeIds.length === 0) return null;
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY_2');
    if (!apiKey) throw new Error('OneSignal API-Key fehlt (ONESIGNAL_REST_API_KEY_2)');
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_aliases: { external_id: employeeIds.map(String) },
            target_channel: 'push',
            headings: { en: title, de: title },
            contents: { en: message, de: message }
        })
    });
    const data = await res.json();
    if (!res.ok) {
        const errStr = JSON.stringify(data);
        // invalid_aliases = Gerät evtl. nicht registriert → kein Fehler
        if (/invalid_aliases/i.test(errStr)) return { skipped: true, reason: 'invalid_aliases' };
        throw new Error(`OneSignal API error: ${errStr}`);
    }
    return data;
}

async function pushToEmployee(employeeId, title, message) {
    if (!employeeId) return null;
    return pushToEmployees([employeeId], title, message);
}

async function getManagerIds(base44) {
    const employees = await base44.asServiceRole.entities.Employee.filter({ is_active: true });
    return employees.filter(e => e.role === 'Manager' || e.role === 'Orga').map(e => e.id);
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
        // Robust gegen beide Aufruf-Shapes (Workflow vs. direkter Aufruf)
        const data = body?.args?.data || body?.data || body?.args || body || {};

        const swapRequestId = data.swap_request_id;
        const biddingEmployeeName = data.bidding_employee_name || 'Ein Kollege';

        if (!swapRequestId) return Response.json({ message: 'No swap_request_id' });

        // Zugehörige SwapRequest laden (Owner + Datum)
        const swapRequest = await base44.asServiceRole.entities.ShiftSwapRequest.get(swapRequestId);
        if (!swapRequest) return Response.json({ message: 'SwapRequest not found' });

        const ownerName = swapRequest.requesting_employee_name || 'Ein Kollege';
        const ownerId = swapRequest.requesting_employee_id;
        const shiftDate = formatDate(swapRequest.shift_date || data.shift_date);

        const managerIds = await getManagerIds(base44);

        // 1. Push an alle aktiven Manager/Orga
        const mgrTitle = '🔄 Neue Übernahme-Meldung';
        const mgrMsg = `${biddingEmployeeName} hat sich zur Übernahme der Schicht von ${ownerName}${shiftDate ? ` am ${shiftDate}` : ''} gemeldet.`;
        await base44.asServiceRole.entities.Notification.create({
            type: 'general', category: 'schicht', title: mgrTitle, message: mgrMsg,
            related_id: swapRequestId, target_roles: ['Manager'], read_by: []
        });
        await pushToEmployees(managerIds, mgrTitle, mgrMsg);

        // 2. Push an den Anbieter (Requester)
        let ownerNotified = false;
        if (ownerId) {
            const ownerTitle = '🔄 Jemand will deine Schicht!';
            const ownerMsg = `${biddingEmployeeName} möchte deine Schicht${shiftDate ? ` am ${shiftDate}` : ''} übernehmen.`;
            await base44.asServiceRole.entities.Notification.create({
                type: 'general', category: 'schicht', title: ownerTitle, message: ownerMsg,
                related_id: swapRequestId, recipient_id: ownerId, read_by: []
            });
            await pushToEmployee(ownerId, ownerTitle, ownerMsg);
            ownerNotified = true;
        }

        return Response.json({
            success: true,
            notified_managers: managerIds.length,
            notified_owner: ownerNotified
        });
    } catch (error) {
        console.error('[onShiftSwapMarketplace] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});