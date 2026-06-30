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
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const today = now.toISOString().split('T')[0];

        const shifts = await base44.asServiceRole.entities.Shift.filter({ date: today });
        const upcomingShifts = shifts.filter(shift => {
            const [hours, minutes] = shift.start_time.split(':');
            const shiftDate = new Date(shift.date);
            shiftDate.setHours(parseInt(hours), parseInt(minutes), 0);
            return shiftDate >= oneHourFromNow && shiftDate <= twoHoursFromNow;
        });

        const employees = await base44.asServiceRole.entities.Employee.filter({ is_active: true });
        const employeeMap = {};
        employees.forEach(e => { employeeMap[e.id] = e; });

        const notifications = [];

        for (const shift of upcomingShifts) {
            const employee = employeeMap[shift.employee_id];
            if (!employee) continue;

            const title = 'Schicht-Erinnerung 🔔';
            const message = `Deine Schicht beginnt um ${shift.start_time} Uhr`;

            await base44.asServiceRole.entities.Notification.create({
                type: 'shift_reminder', title, message, related_id: shift.id, read_by: []
            });

            await pushToEmployee(employee.id, title, message);
            notifications.push({ employee: employee.name, shift_time: shift.start_time, sent: true });
        }

        return Response.json({
            success: true,
            checked_shifts: shifts.length,
            upcoming_shifts: upcomingShifts.length,
            notifications_sent: notifications.filter(n => n.sent).length
        });
    } catch (error) {
        console.error('[sendShiftReminders] Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});