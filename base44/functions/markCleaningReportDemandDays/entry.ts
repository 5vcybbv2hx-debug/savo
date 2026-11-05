// markCleaningReportDemandDays
// Ergänzt bestehende CleaningReports um business_night_date und markiert
// Null-Berichte an Nächten ohne Bedarf rückwirkend als "kein Bedarf".

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { addDays, demandNightReason, isDemandNight } from '../../shared/cleaningSchedule.ts';

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
    let unchanged = 0;

    for (const report of reports) {
      const nightDate = String(report.business_night_date || report.week_start || '').slice(0, 10);
      if (!nightDate) continue;
      const calNight = calendarByDate.get(nightDate);
      const calNext = calendarByDate.get(addDays(nightDate, 1));
      const demand = isDemandNight(nightDate, calNight, calNext);
      const rate = typeof report.completion_rate === 'number' ? report.completion_rate : 0;

      const patch: any = {};
      if (!report.business_night_date) patch.business_night_date = nightDate;

      if (!demand && rate === 0 && report.required !== false) {
        patch.required = false;
        patch.demand_reason = 'kein Bedarf';
      } else if (demand && report.required === undefined) {
        patch.required = true;
        patch.demand_reason = demandNightReason(nightDate, calNight, calNext) || 'Bedarfsnacht';
      }

      if (Object.keys(patch).length > 0) {
        updates.push({ id: report.id, ...patch });
      } else {
        unchanged++;
      }
    }

    if (updates.length > 0) {
      await db.CleaningReport.bulkUpdate(updates);
    }

    return Response.json({
      success: true,
      checked: reports.length,
      updated: updates.length,
      marked_no_need: updates.filter((u) => u.required === false).length,
      marked_need: updates.filter((u) => u.required === true).length,
      night_date_filled: updates.filter((u) => u.business_night_date).length,
      unchanged,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}