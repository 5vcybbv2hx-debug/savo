import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';

async function pushToEmployees(employeeIds, title, message) {
    if (!employeeIds || employeeIds.length === 0) return;
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY_2');
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_aliases: { external_id: employeeIds.map(String) },
            target_channel: 'push',
            headings: { en: title, de: title },
            contents: { en: message, de: message }
        })
    });
    if (!res.ok) console.error('[OneSignal] pushToEmployees error:', await res.text());
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        // Kein Auth-Guard — Funktion wird von Automation aufgerufen
        const articles = await base44.asServiceRole.entities.Article.filter({ is_active: true });
        const lowStockArticles = articles.filter(a => a.min_stock && a.current_stock <= a.min_stock);

        if (lowStockArticles.length === 0) return Response.json({ message: 'No low stock articles', count: 0 });

        const articleNames = lowStockArticles.slice(0, 3).map(a => a.name).join(', ');
        const moreCount = lowStockArticles.length > 3 ? ` und ${lowStockArticles.length - 3} weitere` : '';
        const title = 'Niedriger Lagerbestand';
        const message = `${lowStockArticles.length} Artikel unter Mindestbestand: ${articleNames}${moreCount}`;

        await base44.asServiceRole.entities.Notification.create({
            type: 'alert', title, message, related_id: null, read_by: [], target_roles: ['Manager']
        });

        // Push to all managers with inventory permissions
        const employees = await base44.asServiceRole.entities.Employee.filter({ is_active: true });
        const managerIds = employees
            .filter(e => e.role === 'Manager' || e.permissions?.canEditShopping)
            .map(e => e.id);

        await pushToEmployees(managerIds, title, message);

        return Response.json({
            success: true,
            message: `Notified about ${lowStockArticles.length} low stock articles`,
            articles: lowStockArticles.map(a => ({ name: a.name, stock: a.current_stock }))
        });
    } catch (error) {
        console.error('[notifyLowStock] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});