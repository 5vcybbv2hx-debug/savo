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

        if (!event || !event.type || !data) {
            return Response.json({ message: 'Invalid automation payload' }, { status: 400 });
        }
        if (event.type !== 'create') return Response.json({ message: 'Not a create event' });
        if (!data.assigned_to) return Response.json({ message: 'Task not assigned to anyone' });

        // Find assigned employee by email or name
        const employees = await base44.asServiceRole.entities.Employee.filter({ is_active: true });
        const employee = employees.find(e =>
            e.email === data.assigned_to || e.name === data.assigned_to
        );
        if (!employee) return Response.json({ message: 'Assigned employee not found' });

        const title = 'Neue Aufgabe zugewiesen';
        const message = `Dir wurde die Aufgabe "${data.title}" zugewiesen.`;

        // In-app notification
        await base44.asServiceRole.entities.Notification.create({
            type: 'task', title, message, related_id: data.id, read_by: []
        });

        // OneSignal push
        await pushToEmployee(employee.id, title, message);

        return Response.json({ success: true, message: 'Notification sent' });
    } catch (error) {
        console.error('[notifyNewTask] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});