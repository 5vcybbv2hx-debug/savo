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
        const { event, data } = body;

        if (!event || !data) return Response.json({ message: 'Invalid payload' }, { status: 400 });

        const employeeId = data.employee_id;
        if (!employeeId) return Response.json({ message: 'No employee_id in shift' });

        const isCreate = event.type === 'create';
        const title = isCreate ? 'Neue Schicht eingeplant' : 'Schicht geändert';
        const dateStr = data.date || '';
        const timeStr = data.start_time ? `${data.start_time}–${data.end_time || ''}` : '';
        const typeStr = data.shift_type ? ` (${data.shift_type})` : '';
        const message = `${dateStr} ${timeStr}${typeStr}`.trim();

        // In-app notification
        await base44.asServiceRole.entities.Notification.create({
            type: isCreate ? 'shift_assigned' : 'shift_updated',
            title,
            message,
            related_id: data.id,
            read_by: []
        });

        // OneSignal push
        await pushToEmployee(employeeId, title, message);

        return Response.json({ success: true });
    } catch (error) {
        console.error('[onShiftChanged] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});