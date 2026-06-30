import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';

async function pushToEmployee(employeeId, title, message) {
    if (!employeeId) return;
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY_2');
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_aliases: { external_id: [String(employeeId)] },
            target_channel: 'push',
            headings: { en: title, de: title },
            contents: { en: message, de: message }
        })
    });
    if (!res.ok) console.error('[OneSignal] pushToEmployee error:', await res.text());
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
            const targetEmployeeId = data.target_employee_id;
            if (!targetEmployeeId) return Response.json({ message: 'No target_employee_id' });

            const requesterName = data.requesting_employee_name || 'Ein Kollege';
            const shiftDate = data.shift_date || data.date || '';
            const title = 'Schichttausch-Anfrage 🔄';
            const message = `${requesterName} möchte mit dir die Schicht${shiftDate ? ` am ${shiftDate}` : ''} tauschen.`;

            await base44.asServiceRole.entities.Notification.create({
                type: 'shift_swap_request', title, message, related_id: data.id, read_by: []
            });
            await pushToEmployee(targetEmployeeId, title, message);

            return Response.json({ success: true, action: 'notified_target' });
        }

        if (isUpdate) {
            const newStatus = data.status;
            const oldStatus = old_data?.status;
            if (!newStatus || newStatus === oldStatus) return Response.json({ message: 'Status unchanged' });
            if (!['angenommen', 'abgelehnt'].includes(newStatus)) return Response.json({ message: 'No notification needed' });

            const requestingEmployeeId = data.requesting_employee_id;
            if (!requestingEmployeeId) return Response.json({ message: 'No requesting_employee_id' });

            const targetName = data.target_employee_name || 'Dein Kollege';
            const accepted = newStatus === 'angenommen';
            const title = accepted ? 'Tausch angenommen ✅' : 'Tausch abgelehnt ❌';
            const message = accepted
                ? `${targetName} hat deinen Schichttausch angenommen.`
                : `${targetName} hat deinen Schichttausch abgelehnt.`;

            await base44.asServiceRole.entities.Notification.create({
                type: 'shift_swap_response', title, message, related_id: data.id, read_by: []
            });
            await pushToEmployee(requestingEmployeeId, title, message);

            return Response.json({ success: true, action: 'notified_requester' });
        }

        return Response.json({ message: 'Unhandled event type' });
    } catch (error) {
        console.error('[onShiftSwapEvent] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});