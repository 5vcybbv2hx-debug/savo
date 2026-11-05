// notifyCleaningShortfall
// Kurze Meldung an Manager, wenn an einem Bedarfstag unter 80 % der fälligen
// Putzaufgaben erledigt sind. Sonntag und Werktage bleiben stumm.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  dateInTimeZone,
  demandReason,
  dueTasksOn,
  isDemandDay,
  weekdayIndex,
  weekdayName,
} from '../../shared/cleaningSchedule.ts';

const THRESHOLD = 80;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const db = base44.asServiceRole.entities;
    const todayStr = dateInTimeZone();

    if (weekdayIndex(todayStr) === 0) {
      return Response.json({ success: true, skipped: true, reason: 'Sonntag — keine Warnung', date: todayStr });
    }

    const calendarDays = await db.BusinessCalendarDay.filter({ date: todayStr });
    const calendarDay = calendarDays[0];
    if (!isDemandDay(todayStr, calendarDay)) {
      return Response.json({ success: true, skipped: true, reason: 'Werktag ohne Bedarf — bleibt stumm', date: todayStr });
    }

    const tasks = await db.CleaningTask.filter({ is_active: true });
    const due = dueTasksOn(tasks, todayStr, calendarDay);
    if (due.length === 0) {
      return Response.json({ success: true, skipped: true, reason: 'Keine Aufgaben fällig', date: todayStr });
    }

    const done = due.filter((t: any) => t.is_completed === true);
    const rate = Math.round((done.length / due.length) * 100);
    if (rate >= THRESHOLD) {
      return Response.json({ success: true, skipped: true, reason: `Quote ${rate}% erreicht`, rate, date: todayStr });
    }

    const openByArea: Record<string, number> = {};
    due.filter((t: any) => t.is_completed !== true).forEach((t: any) => {
      openByArea[t.area] = (openByArea[t.area] || 0) + 1;
    });
    const areaSummary = Object.entries(openByArea)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([area, count]) => `${area} (${count})`)
      .join(', ');

    const title = `Putzliste ${weekdayName(todayStr)}: ${rate}% erledigt`;
    const message = `${done.length} von ${due.length} Aufgaben erledigt, ${due.length - done.length} offen${areaSummary ? ` — ${areaSummary}` : ''}.`;

    await db.Notification.create({
      type: 'alert',
      title,
      message,
      category: 'aufgabe',
      priority: 'wichtig',
      target_roles: ['admin', 'Manager'],
      read_by: [],
    });

    return Response.json({
      success: true,
      notified: true,
      date: todayStr,
      demand_reason: demandReason(todayStr, calendarDay),
      rate,
      due: due.length,
      done: done.length,
      open: due.length - done.length,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}