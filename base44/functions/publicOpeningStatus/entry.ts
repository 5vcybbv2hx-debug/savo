// publicOpeningStatus.ts
// Öffentliche, auth-freie Auskunft über Öffnungsstatus: heute + die nächsten
// 7 Tage. Basis: CompanyInfo.opening_hours (JSON) und OpeningHours-Entity;
// BusinessCalendarDay-Overrides (Feiertage, Sonderöffnungen, geschlossene Tage)
// gewinnen immer.
//
// Antwort je Tag: { date, is_open, is_holiday, holiday_name, open_time,
//                   close_time, note }
// Cache: 5 Minuten (Cache-Control).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const WEEKDAY_KEYS = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'];
const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

Deno.serve(async (req: Request) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'public, max-age=300',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    // 1. Standard-Öffnungszeiten: CompanyInfo (JSON) + OpeningHours-Entity
    const [companies, openingRows, calendarDays] = await Promise.all([
      db.CompanyInfo.list(),
      db.OpeningHours.list(),
      db.BusinessCalendarDay.list('date', 500),
    ]);

    const company = (companies || [])[0];
    let companyHours: any = null;
    if (company?.opening_hours) {
      try { companyHours = JSON.parse(company.opening_hours); } catch { companyHours = null; }
    }

    const calendarByDate: Record<string, any> = {};
    (calendarDays || []).forEach((d: any) => {
      if (d?.date) calendarByDate[d.date] = d;
    });

    const today = new Date();
    const days: any[] = [];

    for (let i = 0; i < 8; i++) { // heute + nächste 7 Tage
      const day = addDays(today, i);
      const dateStr = ymd(day);
      const weekday = day.getUTCDay();
      const key = WEEKDAY_KEYS[weekday];
      const dayName = WEEKDAY_NAMES[weekday];

      // Basis aus OpeningHours-Entity (Wochentag), sonst CompanyInfo-JSON
      let is_open = false;
      let open_time: string | null = null;
      let close_time: string | null = null;

      const specialRow = (openingRows || []).find(
        (o: any) => o.is_special_day === true && o.special_date === dateStr
      );
      const weekdayRow = (openingRows || []).find((o: any) => o.day_of_week === dayName);

      if (specialRow) {
        is_open = specialRow.is_closed !== true;
        open_time = specialRow.open_time || null;
        close_time = specialRow.close_time || null;
      } else if (weekdayRow) {
        is_open = weekdayRow.is_closed !== true;
        open_time = weekdayRow.open_time || null;
        close_time = weekdayRow.close_time || null;
      } else if (companyHours?.[key]) {
        const h = companyHours[key];
        is_open = h.open === true && h.from && h.from !== '';
        open_time = h.from || null;
        close_time = h.to || null;
      }

      // Betriebskalender gewinnt
      const entry = calendarByDate[dateStr];
      const is_holiday = entry?.is_holiday === true;
      const holiday_name = is_holiday ? (entry?.title || '') : '';
      let note = '';

      if (entry) {
        if (entry.is_closed === true) {
          is_open = false;
          open_time = null;
          close_time = null;
          note = is_holiday ? 'Geschlossen (Feiertag)' : 'Geschlossen';
        } else if (entry.opening_time_override) {
          is_open = true;
          open_time = entry.opening_time_override;
          close_time = entry.closing_time_override || close_time;
          note = `Sonderzeiten ${open_time}–${close_time || 'offen'}`;
        }
      }

      days.push({
        date: dateStr,
        is_open,
        is_holiday,
        holiday_name,
        open_time: is_open ? open_time : null,
        close_time: is_open ? close_time : null,
        note,
      });
    }

    return Response.json({ today: days[0], days, generated_at: new Date().toISOString() }, { headers });
  } catch (error) {
    console.error('publicOpeningStatus error:', error);
    return Response.json(
      { today: null, days: [], error: 'Failed to load opening status' },
      { status: 500, headers }
    );
  }
});