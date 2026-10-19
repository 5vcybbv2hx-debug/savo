import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';
const URL_HOME = 'https://bar-shift-pro-fc3522b9.base44.app/';

async function pushToEmployee(employeeId, title, message, url) {
    if (!employeeId) return null;
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY_2');
    if (!apiKey) throw new Error('OneSignal API-Key fehlt (ONESIGNAL_REST_API_KEY_2)');
    const payload = {
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [String(employeeId)] },
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

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Aktive ClockEntries: noch eingestempelt oder in Pause
        const activeEntries = await base44.asServiceRole.entities.ClockEntry.filter({
            status: { $in: ['clocked_in', 'on_break'] }
        });

        const title = '😴 Noch eingestempelt!';
        const message = 'Du bist noch eingestempelt — bitte nicht vergessen auszustempeln.';

        let notified = 0;
        for (const entry of activeEntries) {
            if (!entry.employee_id) continue;
            try {
                await pushToEmployee(entry.employee_id, title, message, URL_HOME);
                notified++;
            } catch (e) {
                console.error('[notifyOpenClockSessions] push failed for', entry.employee_id, e.message);
            }
        }

        return Response.json({ checked: activeEntries.length, notified });
    } catch (error) {
        console.error('[notifyOpenClockSessions] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});