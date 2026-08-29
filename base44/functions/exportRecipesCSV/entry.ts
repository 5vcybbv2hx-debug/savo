import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const url = new URL(req.url);
        const mode = url.searchParams.get('mode') || 'all'; // 'all' or 'filtered'

        const recipes = await base44.asServiceRole.entities.Recipe.filter({}, '-created_date', 1000);

        const headers = ['Name', 'Kategorie', 'Typ', 'Portionen', 'Glas', 'Garnitur', 'Alkohol (%)', 'Zutaten', 'Zubereitung', 'Notizen'];
        const rows = (recipes || []).map(r => [
            r.name || '',
            r.category || '',
            r.recipe_type || 'standard',
            r.servings ?? '',
            r.glass_type || '',
            r.garnish || '',
            r.alcohol_content ?? '',
            Array.isArray(r.ingredients) ? r.ingredients.map(i => `${i.article_name || ''} ${i.amount ?? ''}${i.unit || ''}`).join('; ') : '',
            (r.preparation || '').replace(/\n/g, ' '),
            (r.notes || '').replace(/\n/g, ' '),
        ]);
        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const bom = '\uFEFF';
        const filename = mode === 'filtered'
            ? `rezepte_gefiltert_${new Date().toISOString().slice(0, 10)}.csv`
            : `rezepte_alle_${new Date().toISOString().slice(0, 10)}.csv`;

        return new Response(bom + csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Access-Control-Allow-Origin': '*',
            }
        });
    } catch (error) {
        console.error('exportRecipesCSV error:', error);
        return Response.json({ error: 'Failed to generate CSV' }, { status: 500 });
    }
});