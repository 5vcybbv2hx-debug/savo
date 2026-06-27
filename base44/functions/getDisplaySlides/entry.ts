import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Public display endpoint — use service role so the bar TV can load
    // slides without requiring an authenticated user session.
    const [slides, companyInfoList] = await Promise.all([
      base44.asServiceRole.entities.DisplaySlide.list(),
      base44.asServiceRole.entities.CompanyInfo.list(),
    ]);

    const companyInfo = companyInfoList?.[0] || {};
    const logo_url = companyInfo.logo_url || null;
    const company_name = companyInfo.company_name || null;
    const branding_color = companyInfo.branding_color || null;

    // Only return active slides, sorted by sort_order
    const now = new Date();
    const active = slides
      .filter(s => s.is_active !== false)
      .filter(s => {
        const start = s.show_from ? new Date(s.show_from) : null;
        const end = s.show_until ? new Date(s.show_until) : null;
        if (start && now < start) return false;
        if (end && now > end) return false;
        return true;
      })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    return Response.json({ slides: active, logo_url, company_name, branding_color });
  } catch (error) {
    return Response.json({ slides: [], error: error.message }, { status: 500 });
  }
});
