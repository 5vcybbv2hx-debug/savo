// cleanupDuplicateCleaningReports.ts
// Einmaliger Cleanup: Entfernt Duplikat-CleaningReport-Einträge für week_start='2026-06-27',
// behält nur den neuesten (vollständigsten) Report dieses Tages.

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
    const db = base44.asServiceRole.entities;

    const reports = await db.CleaningReport.filter({ week_start: '2026-06-27' });

    // Nach created_date absteigend sortieren — neuester zuerst
    const sorted = [...reports].sort((a: any, b: any) =>
      new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
    );

    const keep = sorted[0];
    const toDelete = sorted.slice(1);

    let deletedCount = 0;
    for (const rep of toDelete) {
      await db.CleaningReport.delete(rep.id);
      deletedCount++;
    }

    return Response.json({
      success: true,
      total_found: reports.length,
      kept_id: keep?.id ?? null,
      kept_stats: keep ? {
        completion_rate: keep.completion_rate,
        completed_tasks: keep.completed_tasks,
        total_tasks: keep.total_tasks,
        created_date: keep.created_date,
      } : null,
      deleted_count: deletedCount,
    });
  } catch (err) {
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
});