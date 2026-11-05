// resetDailyCleaning
// Setzt erledigte Putzaufgaben nach ihrer Fälligkeit zurück (täglich, am Wochenende,
// wöchentlich, alle zwei Wochen, monatlich, an Sonderöffnungstagen) und schreibt
// vorher den Tagesbericht für gestern — inkl. Kennzeichnung "Bedarfstag" / "kein Bedarf".
// Wird vom Workflow "Putzliste — Reset nach Fälligkeit" aufgerufen.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  dateInTimeZone,
  demandReason,
  dueTasksOn,
  isDemandDay,
  weekdayName,
} from '../../shared/cleaningSchedule.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const db = base44.asServiceRole.entities;
    const todayStr = dateInTimeZone();
    const yesterdayStr = dateInTimeZone(new Date(Date.now() - 86400000));

    const tasks = await db.CleaningTask.filter({ is_active: true });
    const calendarDays = await db.BusinessCalendarDay.filter({ date: { $in: [todayStr, yesterdayStr] } });
    const calToday = calendarDays.find((d: any) => d.date === todayStr);
    const calYesterday = calendarDays.find((d: any) => d.date === yesterdayStr);

    // ── 1) Tagesbericht für gestern ──────────────────────────────────────────
    const dueYesterday = dueTasksOn(tasks, yesterdayStr, calYesterday);
    const doneYesterday = dueYesterday.filter((t: any) => t.is_completed === true);
    const required = isDemandDay(yesterdayStr, calYesterday);
    const completionRate = dueYesterday.length > 0
      ? Math.round((doneYesterday.length / dueYesterday.length) * 100)
      : 0;

    const existingReports = await db.CleaningReport.filter({ week_start: yesterdayStr });
    let reportCreated = false;
    if (existingReports.length === 0 && dueYesterday.length > 0) {
      await db.CleaningReport.create({
        week_start: yesterdayStr,
        week_end: yesterdayStr,
        required,
        demand_reason: required ? demandReason(yesterdayStr, calYesterday) : 'kein Bedarf',
        total_tasks: dueYesterday.length,
        completed_tasks: doneYesterday.length,
        completion_rate: completionRate,
        report_data: doneYesterday.map((t: any) => ({
          area: t.area,
          task_title: t.title,
          completed_at: t.completed_at,
          completed_by: t.completed_by,
          frequency: t.frequency,
        })),
      });
      reportCreated = true;
    }

    // ── 2) Reset nach Fälligkeit ─────────────────────────────────────────────
    // Eine Aufgabe wird zurückgesetzt, wenn sie heute fällig ist, erledigt ist
    // und heute noch nicht zurückgesetzt wurde. Damit greifen auch Wochen-,
    // Zwei-Wochen-, Monats- und Wochenend-Aufgaben (nicht nur "täglich").
    const dueToday = dueTasksOn(tasks, todayStr, calToday);
    const toReset = dueToday.filter((t: any) => t.is_completed === true && t.last_reset !== todayStr);

    if (toReset.length > 0) {
      await db.CleaningTask.bulkUpdate(toReset.map((t: any) => ({
        id: t.id,
        is_completed: false,
        completed_by: null,
        completed_at: null,
        last_reset: todayStr,
      })));
    }

    const resetByFrequency: Record<string, number> = {};
    toReset.forEach((t: any) => {
      const key = String(t.frequency || 'unbekannt');
      resetByFrequency[key] = (resetByFrequency[key] || 0) + 1;
    });

    return Response.json({
      success: true,
      today: todayStr,
      weekday: weekdayName(todayStr),
      is_demand_day: isDemandDay(todayStr, calToday),
      due_today: dueToday.length,
      reset_count: toReset.length,
      reset_by_frequency: resetByFrequency,
      reset_titles: toReset.slice(0, 15).map((t: any) => t.title),
      report_created: reportCreated,
      report_for_date: yesterdayStr,
      report_required: required,
      report_demand_reason: required ? demandReason(yesterdayStr, calYesterday) : 'kein Bedarf',
      report_stats: {
        due_tasks: dueYesterday.length,
        completed_tasks: doneYesterday.length,
        completion_rate: completionRate,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}