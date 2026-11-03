import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const NOTE_TEXT = 'Mindestbestand 0 gesetzt – Leerfach-Bereinigung 03.11.2026 (vorher: %OLD%)';

export default async function (req) {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

        const body = await req.json().catch(() => ({}));
        const dryRun = body?.dry_run === true;

        // Alle aktiven Zuordnungen laden (paginiert) und in JS filtern,
        // damit auch quantity === null als "leer" erkannt wird.
        const candidates = [];
        let cursor;
        for (let guard = 0; guard < 20; guard++) {
            const page = await base44.asServiceRole.entities.StorageAssignment.filter(
                { is_active: true },
                { limit: 500, ...(cursor ? { cursor } : {}) }
            );
            const items = page?.items || [];
            for (const a of items) {
                const qty = a.quantity ?? 0;
                const min = a.min_stock ?? 0;
                if (qty === 0 && min > 0) candidates.push(a);
            }
            if (!page?.has_more || !page?.next_cursor) break;
            cursor = page.next_cursor;
        }

        const previous_values = candidates.map((a) => ({
            article_name: a.article_name || '',
            slot_full_name: a.slot_full_name || '',
            old_min_stock: a.min_stock ?? 0,
        }));

        if (dryRun || candidates.length === 0) {
            return Response.json({ updated: 0, previous_values, dry_run: dryRun });
        }

        const updates = candidates.map((a) => {
            const note = NOTE_TEXT.replace('%OLD%', String(a.min_stock));
            const existing = (a.notes || '').trim();
            return {
                id: a.id,
                min_stock: 0,
                notes: existing ? `${existing}\n${note}` : note,
            };
        });

        let updated = 0;
        for (let i = 0; i < updates.length; i += 200) {
            const chunk = updates.slice(i, i + 200);
            await base44.asServiceRole.entities.StorageAssignment.bulkUpdate(chunk);
            updated += chunk.length;
        }

        return Response.json({ updated, previous_values });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}