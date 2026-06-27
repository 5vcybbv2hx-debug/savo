import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req: Request) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);

    const all = await base44.asServiceRole.entities.DisplaySlide.list('sort_order', 200);

    let logo_url = null;
    try {
      const companies = await base44.asServiceRole.entities.CompanyInfo.list('created_date', 1);
      if (companies && companies.length > 0) {
        logo_url = companies[0].logo_url || null;
      }
    } catch (_) {}

    const slides = (all || []).filter((s: any) => s.is_active === true);

    return new Response(JSON.stringify({ slides, logo_url }), { status: 200, headers });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message, slides: [], logo_url: null }),
      { status: 500, headers }
    );
  }
});
