import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Importiert historische Tagesumsätze (aus Z-Abschlägen) in die DailyRevenue-Entity.
 * Idempotent: Tage, für die bereits ein DailyRevenue-Eintrag existiert, werden übersprungen —
 * der reguläre Tagesabschluss gewinnt immer gegen den Import.
 *
 * POST { records: [{ date: 'JJJJ-MM-TT', revenue: number, revenue_cash?: number, revenue_ec?: number }], source?: 'zabschlag_import' | 'manual' }
 * Antwort: { success, created, skippedExisting, skippedInvalid, errors }
 */
export default async function handler(req: any) {

// ── Automation-Token: schützt vor externem Missbrauch (nur Agent-Workflows rufen diese Function auf) ──
const AUTOMATION_TOKEN = 'savo-auto-96286932ed7275b4a96e279e4e4fc21f';
if (req.headers?.get?.('x-automation-token') !== AUTOMATION_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const records = body?.records;
    const source = body?.source === 'manual' ? 'manual' : 'zabschlag_import';

    if (!Array.isArray(records) || records.length === 0) {
      return Response.json({ error: 'Keine records übergeben' }, { status: 400 });
    }
    if (records.length > 500) {
      return Response.json({ error: 'Max. 500 records pro Aufruf' }, { status: 400 });
    }

    // Bestehende Tage laden (Dedup)
    const existing = await base44.asServiceRole.entities.DailyRevenue.list('-date', 20000);
    const existingDates = new Set(existing.map((r: any) => (r.date || '').slice(0, 10)));

    const today = new Date().toISOString().slice(0, 10);
    let created = 0, skippedExisting = 0, skippedInvalid = 0;
    const errors: string[] = [];

    for (const rec of records) {
      const date = (rec?.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= today) { skippedInvalid++; continue; }
      if (typeof rec.revenue !== 'number' || rec.revenue < 0 || rec.revenue > 100000) { skippedInvalid++; continue; }
      if (existingDates.has(date)) { skippedExisting++; continue; }
      try {
        await base44.asServiceRole.entities.DailyRevenue.create({
          date,
          revenue: Math.round(rec.revenue * 100) / 100,
          revenue_cash: typeof rec.revenue_cash === 'number' ? Math.round(rec.revenue_cash * 100) / 100 : null,
          revenue_ec: typeof rec.revenue_ec === 'number' ? Math.round(rec.revenue_ec * 100) / 100 : null,
          source,
        });
        existingDates.add(date);
        created++;
      } catch (e: any) {
        errors.push(`${date}: ${e.message}`);
      }
    }

    return Response.json({ success: true, created, skippedExisting, skippedInvalid, total: records.length, errors });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}