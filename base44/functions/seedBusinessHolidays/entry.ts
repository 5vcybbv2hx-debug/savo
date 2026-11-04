// seedBusinessHolidays.ts
// Einmal-Befüllung: alle baden-württembergischen Feiertage 2026 + 2027 als
// BusinessCalendarDay anlegen (day_type "feiertag"), sofern für das Datum noch
// kein Datensatz existiert. Default = geschlossen; offene Feiertage entscheidet
// der Betrieb anschließend im Betriebskalender.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const HOLIDAYS: { date: string; name: string }[] = [
  // 2026
  { date: '2026-01-01', name: 'Neujahr' },
  { date: '2026-01-06', name: 'Heilige Drei Könige' },
  { date: '2026-04-03', name: 'Karfreitag' },
  { date: '2026-04-05', name: 'Ostersonntag' },
  { date: '2026-04-06', name: 'Ostermontag' },
  { date: '2026-05-01', name: 'Tag der Arbeit' },
  { date: '2026-05-14', name: 'Christi Himmelfahrt' },
  { date: '2026-05-24', name: 'Pfingstsonntag' },
  { date: '2026-05-25', name: 'Pfingstmontag' },
  { date: '2026-06-04', name: 'Fronleichnam' },
  { date: '2026-10-03', name: 'Tag der Deutschen Einheit' },
  { date: '2026-11-01', name: 'Allerheiligen' },
  { date: '2026-12-25', name: '1. Weihnachtstag' },
  { date: '2026-12-26', name: '2. Weihnachtstag' },
  // 2027
  { date: '2027-01-01', name: 'Neujahr' },
  { date: '2027-01-06', name: 'Heilige Drei Könige' },
  { date: '2027-03-26', name: 'Karfreitag' },
  { date: '2027-03-28', name: 'Ostersonntag' },
  { date: '2027-03-29', name: 'Ostermontag' },
  { date: '2027-05-01', name: 'Tag der Arbeit' },
  { date: '2027-05-06', name: 'Christi Himmelfahrt' },
  { date: '2027-05-16', name: 'Pfingstsonntag' },
  { date: '2027-05-17', name: 'Pfingstmontag' },
  { date: '2027-05-27', name: 'Fronleichnam' },
  { date: '2027-10-03', name: 'Tag der Deutschen Einheit' },
  { date: '2027-11-01', name: 'Allerheiligen' },
  { date: '2027-12-25', name: '1. Weihnachtstag' },
  { date: '2027-12-26', name: '2. Weihnachtstag' },
];

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** Wochentag eines YYYY-MM-DD ohne Zeitzonen-Verschiebung. */
function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
    }

    const db = base44.asServiceRole.entities;
    const existing = await db.BusinessCalendarDay.list('date', 2000);
    const byDate = new Map<string, any>((existing || []).map((d: any) => [d.date, d]));

    const created: any[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const holiday of HOLIDAYS) {
      const current = byDate.get(holiday.date);

      // Datum existiert bereits als Feiertag → unangetastet lassen
      if (current?.is_holiday === true) {
        skipped.push(holiday.date);
        continue;
      }

      const weekday = weekdayOf(holiday.date);
      const isRestDay = weekday === 0 || weekday === 1; // Sonntag / Montag

      // Datum existiert als anderer Tag (z. B. Auto-Fill "Regulär geschlossen")
      // → als Feiertag kennzeichnen, Öffnungsstatus bleibt geschlossen
      if (current) {
        try {
          const placeholderTitle = !current.title || String(current.title).startsWith('Regulär geschlossen');
          await db.BusinessCalendarDay.update(current.id, {
            day_type: 'feiertag',
            is_holiday: true,
            is_closed: true,
            is_special_opening: false,
            ...(placeholderTitle ? { title: holiday.name } : {}),
            description: 'Automatisch angelegt, bitte öffnen/geschlossen prüfen',
            notes: isRestDay ? 'fällt auf Ruhetag' : (current.notes || ''),
          });
          updated.push(holiday.date);
        } catch (e) {
          errors.push(`${holiday.date} ${holiday.name}: ${String(e)}`);
        }
        continue;
      }

      try {
        await db.BusinessCalendarDay.create({
          date: holiday.date,
          day_type: 'feiertag',
          is_holiday: true,
          title: holiday.name,
          description: 'Automatisch angelegt, bitte öffnen/geschlossen prüfen',
          is_closed: true,
          is_special_opening: false,
          notes: isRestDay ? 'fällt auf Ruhetag' : '',
        });
        created.push({
          date: holiday.date,
          title: holiday.name,
          weekday: WEEKDAYS[weekday],
          is_rest_day: isRestDay,
        });
      } catch (e) {
        errors.push(`${holiday.date} ${holiday.name}: ${String(e)}`);
      }
    }

    return Response.json({
      success: true,
      total_holidays: HOLIDAYS.length,
      created_count: created.length,
      updated_count: updated.length,
      skipped_count: skipped.length,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (err) {
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
});