import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Öffentliche Event-Liste für die Website ─────────────────────────────────
// Wird von der öffentlichen Website (savo-lounge-live.base44.app) aufgerufen,
// um die "Events & Aktionen"-Seite mit Inhalten aus dem TV-Display zu füllen.
//
// Sicherheitsregeln:
//   - Liefert NUR Slides mit public_event === true und is_active === true
//     und slide_type 'event' oder 'countdown'
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
        const slides = await base44.asServiceRole.entities.DisplaySlide.list('-event_date', 500);

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

        const publicSlides = (slides || [])
            .filter((s: any) =>
                s.is_active === true &&
                s.public_event === true &&
                (s.slide_type === 'event' || s.slide_type === 'countdown')
            )
            // Zeitfenster: show_from / show_until (optional)
            .filter((s: any) => {
                if (s.show_from && s.show_from.slice(0, 10) > todayStr) return false;
                if (s.show_until && s.show_until.slice(0, 10) < todayStr) return false;
                return true;
            })
            // Nur kommende Events: event_date (oder event_end_date bei mehrtägigen) >= heute
            .filter((s: any) => {
                const endRef = s.event_end_date || s.event_date;
                if (!endRef) return false;
                return endRef >= todayStr;
            })
            // Nur öffentliche Felder
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
                cta_text: (s.cta_text && !s.cta_text.startsWith('event:')) ? s.cta_text : '',
                price_info: s.price_info || '',
            }))
            // Chronologisch sortiert (aufsteigend nach event_date)
            .sort((a: any, b: any) => {
                const da = a.event_date || '';
                const db = b.event_date || '';
                return da.localeCompare(db);
            });

        return Response.json({ events: publicSlides, count: publicSlides.length }, { headers });
    } catch (error) {
        console.error('getPublicEvents error:', error);
        return Response.json({ events: [], count: 0, error: 'Failed to load events' }, { status: 500, headers });
    }
});