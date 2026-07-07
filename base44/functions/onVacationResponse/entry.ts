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
        const { event, data, old_data } = body;

        if (event?.type !== 'update') return Response.json({ message: 'Not an update event' });

        const status = data?.status;
        if (!status || !['genehmigt', 'abgelehnt'].includes(status)) {
            return Response.json({ message: 'Status not a final response' });
        }
        if (old_data && old_data.status === status) return Response.json({ message: 'Status unchanged' });

        const employeeId = data.employee_id;
        if (!employeeId) return Response.json({ message: 'No employee_id' });

        const approved = status === 'genehmigt';
        const title = approved ? 'Urlaub genehmigt ✅' : 'Urlaub abgelehnt ❌';
        const dateFrom = data.start_date || '';
        const dateTo = data.end_date || '';
        const period = dateFrom ? `${dateFrom}${dateTo && dateTo !== dateFrom ? ` – ${dateTo}` : ''}` : '';
        const message = period
            ? `Dein Urlaubsantrag (${period}) wurde ${approved ? 'genehmigt' : 'abgelehnt'}.`
            : `Dein Urlaubsantrag wurde ${approved ? 'genehmigt' : 'abgelehnt'}.`;

        // In-app notification
        // War 'type: vacation_response' (nicht im Notification-Enum erlaubt)
        // + fehlendes Pflichtfeld 'category' + fehlende 'recipient_id' — die
        // create()-Anfrage warf dadurch einen Schema-Fehler OHNE try/catch,
        // wodurch der pushToEmployee-Aufruf danach nie erreicht wurde. Also
        // wurden Urlaubs-Genehmigungen/-Ablehnungen bisher WEDER als
        // In-App-Notification NOCH als Push zugestellt.
        try {
            await base44.asServiceRole.entities.Notification.create({
                type: 'general', category: 'schicht', title, message,
                related_id: data.id, recipient_id: employeeId, read_by: []
            });
        } catch (notifErr) {
            console.error('[onVacationResponse] Notification.create failed:', notifErr);
        }

        // OneSignal push
        await pushToEmployee(employeeId, title, message);

        return Response.json({ success: true });
    } catch (error) {
        console.error('[onVacationResponse] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});