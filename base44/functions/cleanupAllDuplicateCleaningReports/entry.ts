// cleanupAllDuplicateCleaningReports.ts
// Einmaliger Cleanup: Gruppiert ALLE CleaningReport-Einträge nach week_start.
// Behält pro Tag nur den Eintrag mit den meisten completed_tasks (aussagekräftigster Snapshot),
// bei Gleichstand den mit dem spätesten created_date. Löscht alle übrigen Duplikate.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const db = base44.asServiceRole.entities;

    // Alle Reports laden (paginiert, falls nötig)
    let allReports: any[] = [];
    let skip = 0;
    const pageSize = 200;
    while (true) {
      const batch = await db.CleaningReport.list('-created_date', pageSize, skip);
      if (!batch || batch.length === 0) break;
      allReports = allReports.concat(batch);
      if (batch.length < pageSize) break;
      skip += pageSize;
      if (skip > 5000) break; // Sicherheitslimit
    }

    // Nach week_start gruppieren
    const groups: Record<string, any[]> = {};
    for (const rep of allReports) {
      const key = rep.week_start || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(rep);
    }

    let deletedCount = 0;
    let keptCount = 0;
    const dayResults: any[] = [];

    for (const [day, reports] of Object.entries(groups)) {
      if (reports.length <= 1) {
        keptCount += reports.length;
        continue;
      }
      // Sortieren: höchste completed_tasks zuerst, bei Gleichstand spätestes created_date
      const sorted = [...reports].sort((a, b) => {
        const ca = a.completed_tasks ?? 0;
        const cb = b.completed_tasks ?? 0;
        if (cb !== ca) return cb - ca;
        return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
      });
      const keep = sorted[0];
      const toDelete = sorted.slice(1);
      for (const rep of toDelete) {
        await db.CleaningReport.delete(rep.id);
        deletedCount++;
      }
      keptCount++;
      dayResults.push({ day, total_found: reports.length, kept_id: keep.id, deleted: toDelete.length });
    }

    return Response.json({
      success: true,
      total_reports_before: allReports.length,
      total_days: Object.keys(groups).length,
      kept_count: keptCount,
      deleted_count: deletedCount,
      details: dayResults,
    });
  } catch (err) {
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
});