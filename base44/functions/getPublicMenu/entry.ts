import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const [items, companyList, specials] = await Promise.all([
            base44.asServiceRole.entities.MenuItem.filter({ is_available: true }, 'category', 1000),
            base44.asServiceRole.entities.CompanyInfo.list('created_date', 1),
            base44.asServiceRole.entities.WeeklySpecial.filter({ is_active: true }),
        ]);

        const companyInfo = companyList?.[0] || {};

        return Response.json({
            items: items || [],
            companyInfo: companyInfo,
            specials: specials || [],
        });
    } catch (error) {
        console.error('getPublicMenu error:', error);
        return Response.json(
            { error: 'Failed to load public menu', items: [], companyInfo: {}, specials: [] },
            { status: 500 }
        );
    }
});
