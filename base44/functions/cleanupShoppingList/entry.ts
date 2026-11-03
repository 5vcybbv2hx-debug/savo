import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const CUTOFF = '2026-10-01T00:00:00.000Z';
const EXCLUDE_ID = '6adc10721d157db1ea923de4';
const NOTE = 'Altauffüllliste geschlossen (03.11.2026)';

async function fetchAll(entity, query, sort, pageSize = 200) {
  const all = [];
  let cursor = null;
  for (let i = 0; i < 50; i++) {
    const page = await entity.filter(query, { sort, limit: pageSize, ...(cursor ? { cursor } : {}) });
    const items = page?.items || [];
    all.push(...items);
    if (!page?.has_more || !page?.next_cursor) break;
    cursor = page.next_cursor;
  }
  return all;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const reconcile = body?.reconcile === true;

    // ── 1) Altauffüllliste schließen ────────────────────────────────────────
    const older = await fetchAll(
      base44.entities.ShoppingList,
      { status: 'offen', created_date: { $lt: CUTOFF } },
      'created_date'
    );

    const skipped = [];
    const toUpdate = [];

    for (const row of older) {
      const hasException =
        row.id === EXCLUDE_ID ||
        (typeof row.delivery_note === 'string' && row.delivery_note.trim() !== '') ||
        Number(row.delivered_quantity) > 0 ||
        Number(row.delivered_units) > 0;

      if (hasException) {
        skipped.push({ id: row.id, item_name: row.item_name, created_date: row.created_date });
        continue;
      }

      const notes = row.notes && String(row.notes).trim() ? `${row.notes} · ${NOTE}` : NOTE;
      toUpdate.push({ ...row, status: 'abgeschlossen', notes });
    }

    const updates = toUpdate.map((r) => ({ id: r.id, status: 'abgeschlossen', notes: r.notes }));
    let updated = 0;
    for (const group of chunk(updates, 100)) {
      const res = await base44.entities.ShoppingList.bulkUpdate(group);
      updated += Array.isArray(res) ? res.length : group.length;
    }

    const remaining_open = await base44.entities.ShoppingList.count({ status: 'offen' });

    const result = {
      updated,
      skipped_exceptions: skipped.length,
      remaining_open,
      skipped_exception_ids: skipped.map((s) => s.id),
    };

    // ── 2) Optionaler Bestandsabgleich ──────────────────────────────────────
    if (reconcile) {
      const articles = await fetchAll(base44.entities.Article, {}, '-created_date');
      const assignments = await fetchAll(base44.entities.StorageAssignment, {}, '-created_date');

      const sums = new Map();
      const assigned = new Set();
      for (const a of assignments) {
        if (a.is_active === false) continue;
        if (!a.article_id) continue;
        assigned.add(a.article_id);
        sums.set(a.article_id, (sums.get(a.article_id) || 0) + (Number(a.quantity) || 0));
      }

      const articleUpdates = [];
      const deviations = [];
      let skippedUnassigned = 0;

      for (const art of articles) {
        const expected = sums.get(art.id) || 0;
        const current = Number(art.current_stock) || 0;
        const diff = expected - current;
        if (Math.abs(diff) <= 0.01) continue;

        // Artikel ohne jede Fachzuordnung nicht auf 0 setzen (Datenverlust vermeiden)
        if (!assigned.has(art.id) && !body.include_unassigned) {
          skippedUnassigned++;
          continue;
        }

        articleUpdates.push({ id: art.id, current_stock: expected });
        deviations.push({
          article_name: art.name,
          old_stock: current,
          new_stock: expected,
          delta: Math.round(diff * 100) / 100,
        });
      }

      let reconciled_count = 0;
      for (const group of chunk(articleUpdates, 100)) {
        const res = await base44.entities.Article.bulkUpdate(group);
        reconciled_count += Array.isArray(res) ? res.length : group.length;
      }

      deviations.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

      result.reconciled_count = reconciled_count;
      result.reconciled_skipped_unassigned = skippedUnassigned;
      result.top_deviations = deviations.slice(0, 10);
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}