import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';
const URL_MAINTENANCE = 'https://bar-shift-pro-fc3522b9.base44.app/Maintenance';

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

async function getManagerIds(base44) {
    const employees = await base44.asServiceRole.entities.Employee.filter({ is_active: true });
    return employees.filter(e => e.role === 'Manager' || e.role === 'Orga').map(e => e.id);
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Überfällige, aktive Wartungsaufgaben
        const overdueTasks = await base44.asServiceRole.entities.MaintenanceTask.filter({
            status: 'überfällig',
            is_active: true
        });

        if (overdueTasks.length === 0) return Response.json({ overdue: 0, notified: 0 });

        const managerIds = await getManagerIds(base44);
        const firstEquipment = overdueTasks[0]?.equipment_name || 'unbekannt';
        const title = '🔧 Wartung überfällig';
        const message = `${overdueTasks.length} Wartungsaufgabe(n) überfällig, z.B. ${firstEquipment}`;

        await pushToEmployees(managerIds, title, message, URL_MAINTENANCE);

        return Response.json({ overdue: overdueTasks.length, notified: managerIds.length });
    } catch (error) {
        console.error('[notifyOverdueMaintenance] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});