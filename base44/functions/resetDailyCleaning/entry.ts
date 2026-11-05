// resetDailyCleaning
// Schließt die gerade beendete Nachtschicht ab und setzt erledigte Putzaufgaben
// nach ihrer Fälligkeit zurück (täglich, am Wochenende, wöchentlich, alle zwei Wochen,
// monatlich, an Sonderöffnungstagen).
// Zählfenster einer Nacht: business_night_date 05:00 bis Folgetag 05:00.
// Ein Bericht entsteht nur an Bedarfsnächten (Freitag, Samstag, Vorfeiertag, Abend vor Feiertag).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  addDays,
  dateInTimeZone,
  demandNightReason,
  dueTasksOn,
  isCompletedInNight,
  isDemandNight,
  nightDateFor,
  nightWindow,
  weekdayName,
} from '../../shared/cleaningSchedule.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const db = base44.asServiceRole.entities;
    const now = new Date();
    const todayStr = dateInTimeZone(now);
    const currentNight = nightDateFor(now);
    const closedNight = addDays(currentNight, -1);
    const closedNightNextDay = addDays(closedNight, 1);

    const tasks = await db.CleaningTask.filter({ is_active: true });
    const calendarDays = await db.BusinessCalendarDay.filter({
      date: { $in: [closedNight, closedNightNextDay, todayStr] },
    });
    const calClosedNight = calendarDays.find((d: any) => d.date === closedNight);
    const calClosedNextDay = calendarDays.find((d: any) => d.date === closedNightNextDay);
    const calToday = calendarDays.find((d: any) => d.date === todayStr);

    // ── 1) Bericht für die gerade beendete Nacht (nur mit Bedarf) ────────────
    const demand = isDemandNight(closedNight, calClosedNight, calClosedNextDay);
    const dueNight = dueTasksOn(tasks, closedNight, calClosedNight);
    const doneNight = dueNight.filter((t: any) => isCompletedInNight(t.completed_at, closedNight));
    const completionRate = dueNight.length > 0
      ? Math.round((doneNight.length / dueNight.length) * 100)
      : 0;

    let reportCreated = false;
    let reportSkipped: string | null = null;

    if (!demand) {
      reportSkipped = 'Nacht ohne Bedarf — kein Bericht erzeugt';
    } else if (dueNight.length === 0) {
      reportSkipped = 'Keine Aufgaben in dieser Nacht fällig';
    } else {
      const existingReports = await db.CleaningReport.filter({ week_start: closedNight });
      if (existingReports.length === 0) {
        await db.CleaningReport.create({
          week_start: closedNight,
          week_end: closedNight,
          business_night_date: closedNight,
          required: true,
          demand_reason: demandNightReason(closedNight, calClosedNight, calClosedNextDay),
          total_tasks: dueNight.length,
          completed_tasks: doneNight.length,
          completion_rate: completionRate,
          report_data: doneNight.map((t: any) => ({
            area: t.area,
            task_title: t.title,
            completed_at: t.completed_at,
            completed_by: t.completed_by,
            frequency: t.frequency,
          })),
        });
        reportCreated = true;
      } else {
        reportSkipped = 'Bericht für diese Nacht existiert bereits';
      }
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
      business_night_date: closedNight,
      night_weekday: weekdayName(closedNight),
      night_window: nightWindow(closedNight),
      night_demand: demand,
      night_demand_reason: demand ? demandNightReason(closedNight, calClosedNight, calClosedNextDay) : 'kein Bedarf',
      night_stats: {
        due_tasks: dueNight.length,
        completed_tasks: doneNight.length,
        completion_rate: completionRate,
      },
      report_created: reportCreated,
      report_skipped: reportSkipped,
      due_today: dueToday.length,
      reset_count: toReset.length,
      reset_by_frequency: resetByFrequency,
      reset_titles: toReset.slice(0, 15).map((t: any) => t.title),
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}