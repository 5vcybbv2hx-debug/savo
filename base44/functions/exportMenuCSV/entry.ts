import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const [items, companyList] = await Promise.all([
            base44.asServiceRole.entities.MenuItem.filter({ is_available: true }, 'category', 1000),
            base44.asServiceRole.entities.CompanyInfo.list('created_date', 1),
        ]);

        const companyInfo = companyList?.[0] || {};
        const barName = companyInfo.company_name || 'Getraenkekarte';

        const headers = ['Kategorie', 'Name', 'Beschreibung', 'Preis', 'Alkoholgehalt (%)', 'Inhalt', 'Allergene', 'Verfuegbar'];
        const escapeCSV = (val: any) => {
            if (val == null) return '';
            const s = String(val);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        };
        const rows = (items || []).map(item => [
            escapeCSV(item.category || 'Sonstiges'),
            escapeCSV(item.name),
            escapeCSV(item.description),
            escapeCSV(item.price),
            escapeCSV(item.alcohol_content),
            escapeCSV(item.size || item.volume_ml),
            escapeCSV((item.allergens_list || item.allergens || []).join('; ')),
            escapeCSV(item.is_available ? 'Ja' : 'Nein')
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const bom = '\uFEFF';
        const csvContent = bom + csv;

        const filename = `getraenkekarte-${new Date().toISOString().slice(0, 10)}.csv`;

        return new Response(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Access-Control-Allow-Origin': '*',
            }
        });
    } catch (error) {
        console.error('exportMenuCSV error:', error);
        return Response.json(
            { error: 'Failed to generate CSV' },
            { status: 500 }
        );
    }
});
