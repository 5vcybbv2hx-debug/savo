import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Öffentliche Event-Detailseite für Gäste ──────────────────────────────────
// Wird von der öffentlichen EventLanding-Page (/Event/:id) aufgerufen,
// auf die der QR-Code auf dem TV-Display verweist.
//
// Sicherheitsregeln:
//   - Liefert NUR Slides mit public_event === true, is_active === true
//     und slide_type 'event' oder 'countdown'
//   - Gibt ausschließlich öffentlich bestimmte Felder zurück
//     (keine internen Daten wie sort_order, show_from/show_until etc.)
Deno.serve(async (req) => {
    try {
        // Slide-ID aus Body oder Query-Param lesen
        let slideId = null;
        try {
            const body = await req.json();
            slideId = body?.id || body?.slide_id || null;
        } catch {}
        if (!slideId) {
            try {
                const url = new URL(req.url);
                slideId = url.searchParams.get('id');
            } catch {}
        }
        if (!slideId) {
            return Response.json({ found: false, reason: 'no_id' });
        }

        const base44 = createClientFromRequest(req);
        const slide = await base44.asServiceRole.entities.DisplaySlide.get(slideId);

        const isPublicEvent = slide
            && slide.is_active === true
            && slide.public_event === true
            && (slide.slide_type === 'event' || slide.slide_type === 'countdown');

        if (!isPublicEvent) {
            return Response.json({ found: false, reason: 'not_public' });
        }

        // Nur öffentlich bestimmte Felder
        return Response.json({
            found: true,
            event: {
                title: slide.title || '',
                subtitle: slide.subtitle || '',
                description: slide.body_text || '',
                slide_type: slide.slide_type,
                event_date: slide.event_date || null,
                event_end_date: slide.event_end_date || null,
                event_time: slide.event_time || '',
                event_end_time: slide.event_end_time || '',
                location: slide.location || '',
                cta_text: slide.cta_text || '',
                price_info: slide.price_info || '',
            },
        });
    } catch (error) {
        console.error('getPublicEvent error:', error);
        return Response.json({ found: false, error: 'Failed to load event' }, { status: 500 });
    }
});
