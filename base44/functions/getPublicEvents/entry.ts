import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Öffentliche Event-Liste für die Website ─────────────────────────────────
// Liefert alle DisplaySlides mit public_event === true und is_active === true,
// gefiltert nach Zeitfenster (show_from/show_until) und nur kommende Events.
// Chronologisch sortiert, ausschließlich öffentliche Felder.
// (Commit 99a6f73e)
//
// Sicherheitsregeln:
//   - Liefert NUR Slides mit public_event === true, is_active === true
//     und slide_type 'event' oder 'countdown'
//   - Gibt ausschließlich öffentlich bestimmte Felder zurück
//     (keine internen Daten wie sort_order, show_from/show_until etc.)
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const slides = await base44.asServiceRole.entities.DisplaySlide.list('-event_date', 500);

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // yyyy-MM-dd

        const publicSlides = slides
            .filter(s =>
                s.is_active === true &&
                s.public_event === true &&
                (s.slide_type === 'event' || s.slide_type === 'countdown')
            )
            // Zeitfenster: show_from / show_until (optional)
            .filter(s => {
                if (s.show_from) {
                    const from = new Date(s.show_from);
                    if (now < from) return false;
                }
                if (s.show_until) {
                    const until = new Date(s.show_until);
                    if (now > until) return false;
                }
                return true;
            })
            // Nur kommende Events: event_date (oder event_end_date bei mehrtägigen) >= heute
            .filter(s => {
                const endRef = s.event_end_date || s.event_date;
                if (!endRef) return false;
                return endRef >= todayStr;
            })
            // Chronologisch sortiert (aufsteigend nach event_date)
            .sort((a, b) => {
                const da = a.event_date || '';
                const db = b.event_date || '';
                return da.localeCompare(db);
            })
            // Nur öffentliche Felder
            .map(s => ({
                id: s.id,
                title: s.title || '',
                subtitle: s.subtitle || '',
                description: s.body_text || '',
                slide_type: s.slide_type,
                image_url: s.image_url || '',
                accent_color: s.accent_color || '',
                event_date: s.event_date || null,
                event_end_date: s.event_end_date || null,
                event_time: s.event_time || '',
                event_end_time: s.event_end_time || '',
                location: s.location || '',
                cta_text: s.cta_text || '',
                price_info: s.price_info || '',
            }));

        return Response.json({ events: publicSlides });
    } catch (error) {
        console.error('getPublicEvents error:', error);
        return Response.json({ events: [], error: 'Failed to load events' }, { status: 500 });
    }
});