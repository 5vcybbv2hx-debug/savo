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
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const tasks = await base44.asServiceRole.entities.TodoItem.filter({
            status: 'offen',
            due_date: tomorrowStr
        });

        if (tasks.length === 0) return Response.json({ message: 'No tasks due tomorrow', count: 0 });

        const employees = await base44.asServiceRole.entities.Employee.filter({ is_active: true });
        const notifications = [];

        for (const task of tasks) {
            const employee = employees.find(e =>
                e.email === task.assigned_to || e.name === task.assigned_to
            );
            if (!employee) continue;

            const title = 'Aufgabe fällig morgen';
            const message = `Deine Aufgabe "${task.title}" ist morgen fällig.`;

            await base44.asServiceRole.entities.Notification.create({
                type: 'alert', title, message, related_id: task.id, read_by: []
            });

            await pushToEmployee(employee.id, title, message);
            notifications.push(task.title);
        }

        return Response.json({ success: true, message: `Sent ${notifications.length} deadline reminders`, tasks: notifications });
    } catch (error) {
        console.error('[notifyTaskDeadlines] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});