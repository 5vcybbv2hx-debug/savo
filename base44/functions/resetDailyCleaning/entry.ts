// resetDailyCleaning.ts
// Setzt alle aktiven täglichen CleaningTask-Einträge zurück (is_completed/completed_by/completed_at)
// und erstellt vorher — falls noch keiner für "gestern" existiert — einen CleaningReport-Snapshot.
// Wird von der Superagent-Automation "Putzliste — Täglicher Reset" per call_base44_backend_function aufgerufen.

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

    const tasks = await db.CleaningTask.filter({ is_active: true, frequency: 'täglich' });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: any) => t.is_completed).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);

    const existingReports = await db.CleaningReport.filter({ week_start: yesterdayStr });

    let reportCreated = false;
    if (existingReports.length === 0 && totalTasks > 0) {
      const reportData = tasks
        .filter((t: any) => t.is_completed)
        .map((t: any) => ({
          area: t.area,
          task_title: t.title,
          completed_at: t.completed_at,
          completed_by: t.completed_by,
          frequency: t.frequency,
        }));

      await db.CleaningReport.create({
        week_start: yesterdayStr,
        week_end: yesterdayStr,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        completion_rate: completionRate,
        report_data: reportData,
      });
      reportCreated = true;
    }

    let resetCount = 0;
    for (const task of tasks) {
      await db.CleaningTask.update(task.id, {
        is_completed: false,
        completed_by: null,
        completed_at: null,
        last_reset: todayStr,
      });
      resetCount++;
    }

    return Response.json({
      success: true,
      reset_count: resetCount,
      report_created: reportCreated,
      report_for_date: yesterdayStr,
      stats_before_reset: { totalTasks, completedTasks, completionRate },
    });
  } catch (err) {
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
});