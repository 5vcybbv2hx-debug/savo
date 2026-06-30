import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';

async function pushToEmployees(employeeIds, title, message) {
    if (!employeeIds || employeeIds.length === 0) return;
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY_2');
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${apiKey}`
        },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_aliases: { external_id: employeeIds.map(String) },
            target_channel: 'push',
            headings: { en: title, de: title },
            contents: { en: message, de: message }
        })
    });
    const data = await res.json();
    if (!res.ok) console.error('[OneSignal] API error:', JSON.stringify(data));
    return data;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        const { data, old_data } = payload;
        const employeeName = data?.name || old_data?.name || 'Unbekannt';

        // Alle aktiven Manager/Orga-Mitarbeiter finden
        const employees = await base44.asServiceRole.entities.Employee.filter({ is_active: true });
        const managerIds = employees
            .filter(e => e.role === 'Manager' || e.role === 'Orga')
            .map(e => e.id);

        if (managerIds.length === 0) {
            return Response.json({ ok: true, message: 'No managers found' });
        }

        await pushToEmployees(
            managerIds,
            '📋 Mitarbeiterdaten geändert',
            `${employeeName} hat seine Stammdaten aktualisiert.`
        );

        return Response.json({ ok: true, notified: managerIds.length });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});