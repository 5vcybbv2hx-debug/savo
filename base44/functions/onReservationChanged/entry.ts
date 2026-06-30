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

        const { event, data, old_data } = payload;
        const eventType = event?.type; // create | update | delete

        const reservation = data || old_data;
        if (!reservation) {
            return Response.json({ ok: true, message: 'No reservation data' });
        }

        const reservationDate = reservation.date; // Format: YYYY-MM-DD
        if (!reservationDate) {
            return Response.json({ ok: true, message: 'No date on reservation' });
        }

        const guestName = reservation.customer_name || 'Gast';
        const time = reservation.time || '';
        const guests = reservation.guests || '';

        // Alle Shifts am Reservierungsdatum finden
        const shifts = await base44.asServiceRole.entities.Shift.filter({ date: reservationDate });

        if (!shifts || shifts.length === 0) {
            return Response.json({ ok: true, message: 'No shifts on that date' });
        }

        // Employee-IDs aus den Shifts sammeln (dedupliziert)
        const employeeIds = [...new Set(shifts.map(s => s.employee_id).filter(Boolean))];

        if (employeeIds.length === 0) {
            return Response.json({ ok: true, message: 'No employees in shifts' });
        }

        // Titel und Nachricht je nach Event-Typ
        let title, message;
        if (eventType === 'create') {
            title = '📅 Neue Reservierung';
            message = `${guestName} • ${guests} Pers. • ${time} Uhr`;
        } else if (eventType === 'delete') {
            title = '❌ Reservierung storniert';
            message = `${guestName} • ${guests} Pers. • ${time} Uhr wurde storniert`;
        } else {
            // update
            const newStatus = data?.status;
            const oldStatus = old_data?.status;
            if (newStatus === 'storniert' && oldStatus !== 'storniert') {
                title = '❌ Reservierung storniert';
                message = `${guestName} • ${guests} Pers. • ${time} Uhr`;
            } else {
                title = '✏️ Reservierung geändert';
                message = `${guestName} • ${guests} Pers. • ${time} Uhr`;
            }
        }

        await pushToEmployees(employeeIds, title, message);

        return Response.json({ ok: true, notified: employeeIds.length });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});