import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';
const URL_HOME = 'https://bar-shift-pro-fc3522b9.base44.app/';

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

function truncate(str, max) {
    const s = String(str || '');
    return s.length > max ? s.slice(0, max) + '…' : s;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const data = body?.args?.data || body?.data || body?.args || body || {};

        // Manager-interne Notizen nicht pushen
        if (data.is_manager_only === true) return Response.json({ message: 'TeamNote is manager-only — no push' });

        const author = data.author_name || 'Ein Teammitglied';
        const title = '📝 Neue Notiz ans Management';
        const message = `${author}: ${truncate(data.message, 80)}`;
        const managerIds = await getManagerIds(base44);

        await pushToEmployees(managerIds, title, message, URL_HOME);

        return Response.json({ success: true, notified: managerIds.length });
    } catch (error) {
        console.error('[onTeamNoteCreated] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});