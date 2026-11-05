// notifyCleaningShortfall
// Kurze Meldung an Manager, wenn in einer Bedarfsnacht unter 80 % der fälligen
// Putzaufgaben erledigt sind. Werktagsnächte und Sonntagnächte bleiben stumm.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  addDays,
  demandNightReason,
  dueTasksOn,
  isCompletedInNight,
  isDemandNight,
  nightDateFor,
  nightWindow,
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
    const now = new Date();
    const nightDate = nightDateFor(now); // laufende Schicht (nach 05:00 = heutiger Abend)

    const calendarDays = await db.BusinessCalendarDay.filter({ date: { $in: [nightDate, addDays(nightDate, 1)] } });
    const calNight = calendarDays.find((d: any) => d.date === nightDate);
    const calNext = calendarDays.find((d: any) => d.date === addDays(nightDate, 1));

    if (!isDemandNight(nightDate, calNight, calNext)) {
      return Response.json({ success: true, skipped: true, reason: 'Nacht ohne Bedarf — bleibt stumm', business_night_date: nightDate });
    }

    const tasks = await db.CleaningTask.filter({ is_active: true });
    const due = dueTasksOn(tasks, nightDate, calNight);
    if (due.length === 0) {
      return Response.json({ success: true, skipped: true, reason: 'Keine Aufgaben in dieser Nacht fällig', business_night_date: nightDate });
    }

    const done = due.filter((t: any) => isCompletedInNight(t.completed_at, nightDate));
    const rate = Math.round((done.length / due.length) * 100);
    if (rate >= THRESHOLD) {
      return Response.json({ success: true, skipped: true, reason: `Quote ${rate}% erreicht`, rate, business_night_date: nightDate });
    }

    const openByArea: Record<string, number> = {};
    due.forEach((t: any) => {
      if (isCompletedInNight(t.completed_at, nightDate)) return;
      openByArea[t.area] = (openByArea[t.area] || 0) + 1;
    });
    const areaSummary = Object.entries(openByArea)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([area, count]) => `${area} (${count})`)
      .join(', ');

    const title = `Putzliste ${weekdayName(nightDate)}nacht: ${rate}% erledigt`;
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
      business_night_date: nightDate,
      night_window: nightWindow(nightDate),
      night_demand_reason: demandNightReason(nightDate, calNight, calNext),
      rate,
      due: due.length,
      done: done.length,
      open: due.length - done.length,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}