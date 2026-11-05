// markCleaningReportDemandDays
// Markiert bestehende CleaningReports rückwirkend als "kein Bedarf",
// wenn sie an einem Werktag (kein Samstag/Sonntag, kein Vorfeiertag/Feiertag/Eventtag)
// mit 0 % Erledigung entstanden sind. So bleibt die Historie unverfälscht.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { demandReason, isDemandDay } from '../../shared/cleaningSchedule.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const db = base44.asServiceRole.entities;
    const reports = await db.CleaningReport.list('-week_start', 500);
    const calendarDays = await db.BusinessCalendarDay.filter({});
    const calendarByDate = new Map(calendarDays.map((d: any) => [d.date, d]));

    const updates: any[] = [];
    let alreadyOk = 0;

    for (const report of reports) {
      const dateStr = String(report.week_start || '').slice(0, 10);
      if (!dateStr) continue;
      const calendarDay = calendarByDate.get(dateStr);
      const required = isDemandDay(dateStr, calendarDay);
      const rate = typeof report.completion_rate === 'number' ? report.completion_rate : 0;

      if (!required && rate === 0) {
        if (report.required === false) { alreadyOk++; continue; }
        updates.push({
          id: report.id,
          required: false,
          demand_reason: 'kein Bedarf',
        });
      } else if (required && report.required === undefined) {
        updates.push({
          id: report.id,
          required: true,
          demand_reason: demandReason(dateStr, calendarDay),
        });
      } else {
        alreadyOk++;
      }
    }

    if (updates.length > 0) {
      await db.CleaningReport.bulkUpdate(updates);
    }

    return Response.json({
      success: true,
      checked: reports.length,
      marked_no_need: updates.filter((u) => u.required === false).length,
      marked_need: updates.filter((u) => u.required === true).length,
      unchanged: alreadyOk,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}