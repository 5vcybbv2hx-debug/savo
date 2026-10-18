import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';

async function pushToEmployee(employeeId, title, message) {
    if (!employeeId) return { skipped: true };
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY_2');
    if (!apiKey) throw new Error('OneSignal API-Key fehlt (ONESIGNAL_REST_API_KEY_2)');
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
    const data = await res.json();
    if (!res.ok) {
        const errStr = JSON.stringify(data);
        // invalid_aliases = Gerät evtl. nicht registriert → kein Fehler
        if (/invalid_aliases/i.test(errStr)) return { skipped: true, reason: 'invalid_aliases' };
        throw new Error(`OneSignal API error: ${errStr}`);
    }
    return data;
}

// Heutiges Datum und Uhrzeit in Europe/Berlin (Wall-Clock).
// Intl.DateTimeFormat mit timeZone respektiert DST — toISOString/UTC würde
// abends um Mitternacht das Datum verrutschen lassen.
function getBerlinNow() {
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = {};
    for (const p of fmt.formatToParts(new Date())) {
        if (p.type !== 'literal') parts[p.type] = p.value;
    }
    return {
        dateStr: `${parts.year}-${parts.month}-${parts.day}`,
        hours: parseInt(parts.hour, 10),
        minutes: parseInt(parts.minute, 10)
    };
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const now = getBerlinNow();
        const nowMinutes = now.hours * 60 + now.minutes;
        const todayStr = now.dateStr;

        const shifts = await base44.asServiceRole.entities.Shift.filter({ date: todayStr });

        let sent = 0;
        let skippedAlreadySent = 0;
        let skippedClockedIn = 0;
        let skippedOutOfWindow = 0;
        const details = [];

        for (const shift of shifts) {
            if (!shift.start_time || !shift.employee_id) {
                skippedOutOfWindow++;
                continue;
            }

            // Duplikat-Schutz 1: Reminder für diese Schicht bereits gesendet
            if (shift.clockin_reminder_sent === true) {
                skippedAlreadySent++;
                continue;
            }

            // Fenster: 0 < (start - now) <= 30 Minuten
            const [h, m] = shift.start_time.split(':').map(Number);
            const startMinutes = h * 60 + m;
            const diff = startMinutes - nowMinutes;
            if (diff <= 0 || diff > 30) {
                skippedOutOfWindow++;
                continue;
            }

            // Duplikat-Schutz 2: Mitarbeiter bereits eingestempelt?
            const activeEntries = await base44.asServiceRole.entities.ClockEntry.filter({
                employee_id: shift.employee_id,
                status: { $in: ['clocked_in', 'on_break'] }
            });
            if (activeEntries.length > 0) {
                skippedClockedIn++;
                continue;
            }

            const title = '⏰ Einstempeln nicht vergessen';
            const message = `Deine Schicht beginnt um ${shift.start_time} Uhr — denk ans Einstempeln!`;

            // Notification-Entity anlegen
            await base44.asServiceRole.entities.Notification.create({
                type: 'task',
                title,
                message,
                category: 'schicht',
                related_id: shift.id,
                recipient_id: shift.employee_id,
                read_by: []
            });

            // Push senden (invalid_aliases wird toleriert)
            await pushToEmployee(shift.employee_id, title, message);

            // Shift als erledigt markieren
            await base44.asServiceRole.entities.Shift.update(shift.id, { clockin_reminder_sent: true });

            sent++;
            details.push(`${shift.employee_name || shift.employee_id} - ${shift.start_time}`);
        }

        return Response.json({
            ok: true,
            checked: shifts.length,
            sent,
            skipped_already_sent: skippedAlreadySent,
            skipped_clocked_in: skippedClockedIn,
            skipped_out_of_window: skippedOutOfWindow,
            details
        });
    } catch (error) {
        console.error('[notifyClockInReminders] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});