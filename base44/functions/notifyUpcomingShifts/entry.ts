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
        // Kein Auth-Guard — Funktion wird von Automation (kein User-Kontext) aufgerufen
        const now = new Date();
        const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        const todayStr = now.toISOString().split('T')[0];

        const shifts = await base44.asServiceRole.entities.Shift.filter({ date: todayStr });
        if (shifts.length === 0) return Response.json({ message: 'No shifts today', count: 0 });

        const employees = await base44.asServiceRole.entities.Employee.filter({ is_active: true });
        const employeeMap = {};
        employees.forEach(e => { employeeMap[e.id] = e; });

        const notifications = [];

        for (const shift of shifts) {
            const [hours, minutes] = shift.start_time.split(':');
            const shiftStart = new Date(todayStr);
            shiftStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            if (shiftStart > now && shiftStart <= fourHoursLater) {
                const employee = employeeMap[shift.employee_id];
                if (!employee) continue;

                const title = 'Schicht beginnt bald';
                const message = `Deine Schicht beginnt um ${shift.start_time} Uhr.`;

                await base44.asServiceRole.entities.Notification.create({
                    type: 'general', title, message, related_id: shift.id, read_by: []
                });

                await pushToEmployee(employee.id, title, message);
                notifications.push(`${employee.name} - ${shift.start_time}`);
            }
        }

        return Response.json({ success: true, message: `Sent ${notifications.length} shift reminders`, shifts: notifications });
    } catch (error) {
        console.error('[notifyUpcomingShifts] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});