import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Öffentliche Öffnungszeiten für die Website ──────────────────────────────
// Wird von der öffentlichen Website (savo-lounge-live.base44.app) aufgerufen,
// um die Öffnungszeiten-Sektion live aus der App zu beziehen.
//
// Liefert:
//   - opening_hours: CompanyInfo.opening_hours (JSON-String) geparst als Objekt
//     (Struktur: { mo/di/mi/do/fr/sa/so: { open: boolean, from: "HH:MM", to: "HH:MM" } })
//   - special_days: BusinessCalendarDay-Einträge für heute + nächste 35 Tage,
//     gefiltert auf is_closed === true ODER is_special_opening === true.
//     Pro Eintrag: date, title, is_closed, is_special_opening,
//     opening_time_override, closing_time_override. Aufsteigend nach date.
//
// Sicherheitsregeln:
//   - Nur öffentliche Felder, keine internen Notizen/updated_by etc.
//   - Bei Fehler: 500 mit error-Objekt (wie getPublicEvents)
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

        // 1. CompanyInfo-Singleton → opening_hours (JSON-String)
        const companies = await base44.asServiceRole.entities.CompanyInfo.list();
        const company = (companies || [])[0];
        let opening_hours: any = null;
        if (company?.opening_hours) {
            try {
                opening_hours = JSON.parse(company.opening_hours);
            } catch {
                opening_hours = null;
            }
        }

        // 2. BusinessCalendarDay: heute + nächste 35 Tage
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const end = new Date(now);
        end.setDate(end.getDate() + 35);
        const endStr = end.toISOString().slice(0, 10);

        const calendarDays = await base44.asServiceRole.entities.BusinessCalendarDay.list('date', 500);

        const special_days = (calendarDays || [])
            .filter((d: any) => {
                if (!d.date) return false;
                if (d.date < todayStr || d.date > endStr) return false;
                return d.is_closed === true || d.is_special_opening === true;
            })
            .map((d: any) => ({
                date: d.date,
                title: d.title || '',
                is_closed: d.is_closed === true,
                is_special_opening: d.is_special_opening === true,
                opening_time_override: d.opening_time_override || null,
                closing_time_override: d.closing_time_override || null,
            }))
            .sort((a: any, b: any) => a.date.localeCompare(b.date));

        return Response.json({ opening_hours, special_days }, { headers });
    } catch (error) {
        console.error('getPublicOpeningHours error:', error);
        return Response.json({ opening_hours: null, special_days: [], error: 'Failed to load opening hours' }, { status: 500, headers });
    }
});