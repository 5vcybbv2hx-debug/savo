import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Öffentliche Event-Liste für die Website ──────────────────────────────────
// Wird von der öffentlichen Website (savo-lounge-live.base44.app) aufgerufen,
// um die "Events & Aktionen"-Seite mit Inhalten aus dem TV-Display zu füllen.
//
// Sicherheitsregeln (analog getPublicEvent):
//   - Liefert NUR Slides mit public_event === true und is_active === true
//   - Zeitfenster wird respektiert: show_from/show_until (falls gesetzt)
//   - Vergangene Events (event_date/event_end_date in der Vergangenheit)
//     werden automatisch ausgeblendet
//   - Gibt ausschließlich öffentlich bestimmte Felder zurück
//     (keine internen Daten wie sort_order, duration_seconds etc.)
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

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

        const isWithinWindow = (s: any) => {
            if (s.show_from && s.show_from.slice(0, 10) > todayStr) return false;
            if (s.show_until && s.show_until.slice(0, 10) < todayStr) return false;
            return true;
        };

        const isUpcoming = (s: any) => {
            // Slides ohne Datum: immer anzeigen (Aktionen ohne Termin)
            if (!s.event_date) return true;
            // Enddatum falls vorhanden, sonst Veranstaltungsdatum
            const endDate = s.event_end_date || s.event_date;
            return endDate >= todayStr;
        };

        const publicSlides = (all || [])
            .filter((s: any) => s.is_active === true && s.public_event === true)
            .filter(isWithinWindow)
            .filter(isUpcoming)
            .map((s: any) => ({
                id: s.id,
                title: s.title || '',
                subtitle: s.subtitle || '',
                description: s.body_text || '',
                slide_type: s.slide_type,
                image_url: s.image_url || null,
                accent_color: s.accent_color || 'amber',
                event_date: s.event_date || null,
                event_end_date: s.event_end_date || null,
                event_time: s.event_time || '',
                event_end_time: s.event_end_time || '',
                location: s.location || '',
                cta_text: s.cta_text || '',
                price_info: s.price_info || '',
            }))
            // Events mit Datum chronologisch voran, datumslose danach
            .sort((a: any, b: any) => {
                if (a.event_date && b.event_date) return a.event_date.localeCompare(b.event_date);
                if (a.event_date) return -1;
                if (b.event_date) return 1;
                return 0;
            });

        return Response.json({ events: publicSlides, count: publicSlides.length }, { headers });
    } catch (error) {
        console.error('getPublicEvents error:', error);
        return Response.json({ events: [], count: 0, error: 'Failed to load events' }, { status: 500, headers });
    }
});
