import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Findet und entfernt doppelte DailyRevenue-Einträge (gleiches Datum, mehrere Records).
 *
 * POST { mode: 'report' | 'clean', keep?: { 'JJJJ-MM-TT': <erwarteter Umsatz laut Z-Abschlag> } }
 *
 * Regeln für Tage mit mehreren Einträgen (clean):
 *  1. Wenn eine keep-Referenz für das Datum übergeben wurde: der Eintrag, dessen Umsatz
 *     damit übereinstimmt (±0,01 €), wird behalten — Kassen-Wahrheit schlägt alles.
 *  2. Sonst: der Eintrag mit dem neuesten updated_date (letzte Korrektur gewinnt).
 * Alle übrigen Einträge des Datums werden gelöscht.
 *
 * mode='report' löscht nichts und listet nur die Duplikate auf.
 */
export default async function handler(req: any) {

// ── Automation-Token: schützt vor externem Missbrauch ──
const AUTOMATION_TOKEN = 'savo-auto-96286932ed7275b4a96e279e4e4fc21f';
if (req.headers?.get?.('x-automation-token') !== AUTOMATION_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === 'clean' ? 'clean' : 'report';
    const keepByDate: Record<string, number> = (body?.keep && typeof body.keep === 'object') ? body.keep : {};

    const all = await base44.asServiceRole.entities.DailyRevenue.list('date', 20000);

    // Nach Datum gruppieren
    const groups = new Map<string, any[]>();
    for (const r of all) {
      const d = (r.date || '').slice(0, 10);
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d).push(r);
    }
    const dups = [...groups.entries()].filter(([, rs]) => rs.length > 1);

    if (mode === 'report') {
      return Response.json({
        success: true,
        totalRecords: all.length,
        duplicateDates: dups.length,
        duplicates: dups.map(([d, rs]) => ({
          date: d,
          records: rs.map((r: any) => ({
            id: r.id, revenue: r.revenue, source: r.source || null,
            created_date: r.created_date, updated_date: r.updated_date
          }))
        }))
      });
    }

    // ── clean ──
    const deleted: any[] = [];
    const kept: any[] = [];
    const errors: string[] = [];

    for (const [d, rs] of dups) {
      try {
        const ref = typeof keepByDate[d] === 'number' ? keepByDate[d] : null;
        let keep: any = null;
        if (ref !== null) {
          keep = rs.find((r: any) => Math.abs((r.revenue || 0) - ref) < 0.011);
        }
        if (!keep) {
          keep = rs.reduce((a: any, b: any) =>
            new Date(b.updated_date || b.created_date || 0) >= new Date(a.updated_date || a.created_date || 0) ? b : a);
        }
        for (const r of rs) {
          if (r.id !== keep.id) {
            await base44.asServiceRole.entities.DailyRevenue.delete(r.id);
            deleted.push({ date: d, id: r.id, revenue: r.revenue, source: r.source || null });
          }
        }
        kept.push({
          date: d, id: keep.id, revenue: keep.revenue,
          matchedRef: ref !== null && Math.abs((keep.revenue || 0) - ref) < 0.011
        });
      } catch (e: any) {
        errors.push(`${d}: ${e.message}`);
      }
    }

    return Response.json({
      success: true, duplicateDates: dups.length,
      deletedCount: deleted.length, deleted,
      keptCount: kept.length, kept, errors
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}