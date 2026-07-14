/**
 * sendShiftReminders — Backend-Function
 * 
 * Sendet OneSignal-Push-Nachrichten für Schichten am nächsten Tag (Vorab-Erinnerung).
 * Wird von der Superagent-Automation "Schicht-Erinnerung WhatsApp" täglich um 16:00 Uhr aufgerufen.
 * 
 * Auth: Kein Auth-Guard nötig — Function läuft nur intern via Superagent-Automation (kein User-Request).
 * Die Function nutzt asServiceRole für alle DB-Zugriffe.
 */

import { createClient } from 'npm:@base44/sdk@0.8.31';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';

async function pushToEmployee(employeeId: string, title: string, message: string) {
    if (!employeeId) return { ok: false, reason: 'no employeeId' };
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY_2');
    if (!apiKey) {
        console.error('[OneSignal] ONESIGNAL_REST_API_KEY_2 nicht gesetzt!');
        return { ok: false, reason: 'missing api key' };
    }
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${apiKey}`,
        },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_aliases: { external_id: [String(employeeId)] },
            target_channel: 'push',
            headings: { en: title, de: title },
            contents: { en: message, de: message },
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        console.error('[OneSignal] Push-Error:', text);
        return { ok: false, reason: text };
    }
    const json = await res.json();
    console.log('[OneSignal] Push gesendet:', json);
    return { ok: true };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }

    try {
        // createClient ohne Request-Auth — rein service-seitig
        const base44 = createClient({ appId: Deno.env.get('APP_ID') || '' });
        const db = base44.asServiceRole.entities;

        // Morgen als YYYY-MM-DD (UTC — passt zu den Shift.date-Werten die ebenfalls UTC-Date-Strings sind)
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().slice(0, 10);

        console.log(`[sendShiftReminders] Prüfe Schichten für ${tomorrowStr}...`);

        // Schichten für morgen laden
        const shifts = await db.Shift.filter({ date: tomorrowStr });
        console.log(`[sendShiftReminders] Gefunden: ${shifts.length} Schichten`);

        if (shifts.length === 0) {
            return Response.json({
                success: true,
                date: tomorrowStr,
                shifts_found: 0,
                notifications_sent: 0,
                message: 'Keine Schichten für morgen gefunden.',
            });
        }

        // Mitarbeiter laden
        const employees = await db.Employee.filter({ is_active: true });
        const employeeMap: Record<string, any> = {};
        employees.forEach((e: any) => { employeeMap[e.id] = e; });

        const results: any[] = [];

        for (const shift of shifts) {
            const employee = employeeMap[shift.employee_id];
            if (!employee) {
                console.warn(`[sendShiftReminders] Mitarbeiter ${shift.employee_id} nicht gefunden für Schicht ${shift.id}`);
                continue;
            }

            const name = employee.short_name || employee.name || 'Du';
            const title = 'Schicht morgen 🔔';
            const message = `${name}, morgen (${tomorrowStr.slice(5).replace('-', '.')}) arbeitest du von ${shift.start_time}${shift.end_time ? ` bis ${shift.end_time}` : ''} Uhr.`;

            // In-App Notification (isoliert, Fehler blockiert nicht den Push)
            try {
                await db.Notification.create({
                    type: 'general',
                    category: 'schicht',
                    title,
                    message,
                    related_id: shift.id,
                    recipient_id: employee.id,
                    read_by: [],
                });
            } catch (notifErr) {
                console.error(`[sendShiftReminders] Notification.create für ${employee.id} fehlgeschlagen:`, notifErr);
            }

            // OneSignal Push
            const pushResult = await pushToEmployee(employee.id, title, message);
            results.push({
                employee_id: employee.id,
                employee_name: employee.name,
                shift_time: shift.start_time,
                date: tomorrowStr,
                push_sent: pushResult.ok,
                push_reason: pushResult.reason,
            });
        }

        const sent = results.filter(r => r.push_sent).length;
        console.log(`[sendShiftReminders] Fertig: ${sent}/${results.length} Pushes erfolgreich`);

        return Response.json({
            success: true,
            date: tomorrowStr,
            shifts_found: shifts.length,
            notifications_sent: sent,
            results,
        });
    } catch (error) {
        console.error('[sendShiftReminders] Unhandled Error:', error);
        return Response.json({ success: false, error: String(error) }, { status: 500 });
    }
});
