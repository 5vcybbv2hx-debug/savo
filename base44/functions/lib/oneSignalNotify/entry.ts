/**
 * OneSignal push notification helper for backend functions.
 * Sends push notifications via OneSignal REST API using employeeId as external_id.
 */

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';

async function sendOneSignal(payload) {
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY_2');
    if (!apiKey) throw new Error('OneSignal API-Key fehlt (ONESIGNAL_REST_API_KEY_2)');
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${apiKey}`
        },
        body: JSON.stringify({ app_id: ONESIGNAL_APP_ID, ...payload })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`OneSignal API error: ${JSON.stringify(data)}`);
    return data;
}

export async function pushToEmployee(employeeId, title, message) {
    if (!employeeId) return;
    return sendOneSignal({
        include_aliases: { external_id: [String(employeeId)] },
        target_channel: 'push',
        headings: { en: title, de: title },
        contents: { en: message, de: message }
    });
}

export async function pushToEmployees(employeeIds, title, message) {
    if (!employeeIds || employeeIds.length === 0) return;
    return sendOneSignal({
        include_aliases: { external_id: employeeIds.map(String) },
        target_channel: 'push',
        headings: { en: title, de: title },
        contents: { en: message, de: message }
    });
}

export async function pushBroadcast(title, message) {
    return sendOneSignal({
        included_segments: ['All'],
        headings: { en: title, de: title },
        contents: { en: message, de: message }
    });
}