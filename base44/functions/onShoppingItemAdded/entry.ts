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
    let base44;
    try {
        base44 = createClientFromRequest(req);
    } catch (authError) {
        // Workflow-Kontext bringt evtl. keine Auth mit — klaren 401 liefern,
        // damit der Run-Log die Ursache zeigt statt eines generischen 500.
        console.error('[onShoppingItemAdded] Auth-Fehler:', authError?.message);
        return Response.json(
            { error: 'AUTH_REQUIRED', message: 'createClientFromRequest konnte keine Auth ermitteln — Aufruf muss authentifiziert sein.' },
            { status: 401 }
        );
    }

    try {
        // Robust gegen beide Aufruf-Shapes:
        //   - Workflow-Aufruf:  { args: { data: {...} } }
        //   - direkter Aufruf:  { data: {...} }  oder  { args: {...} }
        const body = await req.json();
        const data = body?.args?.data || body?.data || body?.args || {};

        const itemName = data?.item_name || 'Unbekannter Artikel';
        const category = data?.category || '';
        const quantity = data?.quantity || '';
        const unit = data?.unit || '';

        // Alle aktiven Manager/Orga-Mitarbeiter finden
        const employees = await base44.asServiceRole.entities.Employee.filter({ is_active: true });
        const managerIds = employees
            .filter(e => e.role === 'Manager' || e.role === 'Orga')
            .map(e => e.id);

        if (managerIds.length === 0) {
            return Response.json({ ok: true, message: 'No managers found' });
        }

        const quantityStr = quantity ? ` • ${quantity}${unit ? ' ' + unit : ''}` : '';
        const categoryStr = category ? ` (${category})` : '';

        await pushToEmployees(
            managerIds,
            '🛒 Neuer Einkaufszettel-Eintrag',
            `${itemName}${quantityStr}${categoryStr}`
        );

        // Keine ShoppingList-Creates hier — nur OneSignal-Push. Kein Loop-Risiko.
        return Response.json({ ok: true, notified: managerIds.length });
    } catch (error) {
        console.error('[onShoppingItemAdded] Fehler:', error?.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});