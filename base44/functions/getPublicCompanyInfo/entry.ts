import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Öffentliche Firmen-/Kontaktdaten für die Website ─────────────────────────
// Wird von der öffentlichen Website (savo-lounge-live.base44.app) aufgerufen,
// um Kontakt- und Impressumsdaten live aus der App zu beziehen.
//
// Liefert NUR öffentlich unbedenkliche Felder aus CompanyInfo:
//   company_name, owner_name, legal_form, street, postal_code, city, country,
//   phone, email, website, tax_id, tax_office
//
// Sicherheitsregeln:
//   - KEINE sensiblen Felder (iban, bic, bank_name, payroll_email,
//     datev_mandantennummer, datev_beraternummer, calendar_feed_token,
//     module_states etc.)
//   - Bei Fehler: 500 mit error-Objekt (wie bestehende public-Functions)
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
        const companies = await base44.asServiceRole.entities.CompanyInfo.list();
        const company = (companies || [])[0] || {};

        return Response.json({
            company_name: company.company_name || '',
            owner_name: company.owner_name || '',
            legal_form: company.legal_form || '',
            street: company.street || '',
            postal_code: company.postal_code || '',
            city: company.city || '',
            country: company.country || '',
            phone: company.phone || '',
            email: company.email || '',
            website: company.website || '',
            tax_id: company.tax_id || '',
            tax_office: company.tax_office || '',
        }, { headers });
    } catch (error) {
        console.error('getPublicCompanyInfo error:', error);
        return Response.json({ error: 'Failed to load company info' }, { status: 500, headers });
    }
});