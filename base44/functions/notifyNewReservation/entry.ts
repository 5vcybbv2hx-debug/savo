import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';
const MANAGER_ROLES = ['admin', 'Manager', 'manager'];

function formatDate(dateStr: string) {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

async function sendPush(employeeIds: string[], title: string, message: string) {
    if (!employeeIds || employeeIds.length === 0) return null;
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY_2');
    if (!apiKey) throw new Error('OneSignal API-Key fehlt (ONESIGNAL_REST_API_KEY_2)');

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_aliases: { external_id: employeeIds.map(String) },
            target_channel: 'push',
            headings: { en: title, de: title },
            contents: { en: message, de: message },
            url: 'https://bar-shift-pro-fc3522b9.base44.app/GuestHub',
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`OneSignal API error: ${JSON.stringify(data)}`);
    return data;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        let user = null;
        try {
            user = await base44.auth.me();
        } catch {
            user = null;
        }
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

        const payload = await req.json().catch(() => ({}));
        const reservation = payload?.data || payload?.reservation || null;
        if (!reservation || !reservation.customer_name) {
            return Response.json({ ok: true, message: 'Keine Reservierungsdaten' });
        }

        const employees = await base44.asServiceRole.entities.Employee.list();
        const employeeByEmail = {};
        for (const emp of employees || []) {
            if (emp?.email) employeeByEmail[String(emp.email).toLowerCase()] = emp;
        }

        const creatorEmail = reservation.created_by || payload?.created_by || '';
        const creatorEmployee = creatorEmail ? employeeByEmail[String(creatorEmail).toLowerCase()] : null;
        const creatorName = creatorEmployee?.short_name || creatorEmployee?.name || creatorEmail || 'Unbekannt';

        const guests = Number(reservation.guests) || 0;
        const tables = Array.isArray(reservation.tables) && reservation.tables.length > 0
            ? reservation.tables.filter(Boolean).join(', ')
            : (reservation.table || '—');

        const title = `Neue Reservierung: ${reservation.customer_name}`;
        const baseMessage = `${formatDate(reservation.date)} ${reservation.time || ''}, ${guests} ${guests === 1 ? 'Person' : 'Personen'}, Tisch ${tables} – eingetragen von ${creatorName}`;

        const notification = await base44.asServiceRole.entities.Notification.create({
            type: 'general',
            title,
            message: baseMessage,
            category: 'reservierung',
            related_id: reservation.id || '',
            target_roles: ['admin', 'Manager'],
            read_by: [],
        });

        // Push nur an Manager/Inhaber, die die Kategorie "reservierung" nicht deaktiviert haben.
        const [users, settingsRows] = await Promise.all([
            base44.asServiceRole.entities.User.list(),
            base44.asServiceRole.entities.NotificationSettings.list(),
        ]);

        const settingsByEmail = {};
        for (const row of settingsRows || []) {
            if (row?.user_email) settingsByEmail[String(row.user_email).toLowerCase()] = row;
        }

        const targets = (users || []).filter(u => MANAGER_ROLES.includes(u.role) && u.email);
        const ownIds = [];
        const otherIds = [];

        for (const manager of targets) {
            const emailKey = String(manager.email).toLowerCase();
            const settings = settingsByEmail[emailKey];
            // Kein Einstellungs-Datensatz → Reservierungen sind standardmäßig aktiv.
            const wantsPush = settings ? settings?.categories?.reservierung !== false : true;
            if (!wantsPush) continue;

            const employee = employeeByEmail[emailKey];
            if (!employee?.id) continue;

            if (creatorEmail && emailKey === String(creatorEmail).toLowerCase()) ownIds.push(employee.id);
            else otherIds.push(employee.id);
        }

        let pushed = 0;
        if (otherIds.length > 0) {
            await sendPush(otherIds, title, baseMessage);
            pushed += otherIds.length;
        }
        if (ownIds.length > 0) {
            await sendPush(ownIds, title, `${baseMessage} (von dir eingetragen)`);
            pushed += ownIds.length;
        }

        return Response.json({ ok: true, notification_id: notification?.id, pushed });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});