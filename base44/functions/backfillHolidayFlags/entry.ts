import base44 from "@base44/base44";

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getBWHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  holidays.add(`${year}-01-01`);
  holidays.add(`${year}-01-06`);
  holidays.add(`${year}-05-01`);
  holidays.add(`${year}-10-03`);
  holidays.add(`${year}-11-01`);
  holidays.add(`${year}-12-25`);
  holidays.add(`${year}-12-26`);
  const easter = getEasterSunday(year);
  const dayMs = 24 * 60 * 60 * 1000;
  holidays.add(new Date(easter.getTime() - 2 * dayMs).toISOString().slice(0, 10));
  holidays.add(new Date(easter.getTime() + 1 * dayMs).toISOString().slice(0, 10));
  holidays.add(new Date(easter.getTime() + 39 * dayMs).toISOString().slice(0, 10));
  holidays.add(new Date(easter.getTime() + 50 * dayMs).toISOString().slice(0, 10));
  holidays.add(new Date(easter.getTime() + 60 * dayMs).toISOString().slice(0, 10));
  return holidays;
}

function getSeason(dateStr: string): string {
  const month = parseInt(dateStr.slice(5, 7));
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export default async function handler(req: any, res: any) {
  try {
    const allHolidays = new Set<string>();
    for (const y of [2025, 2026, 2027]) {
      for (const h of getBWHolidays(y)) allHolidays.add(h);
    }
    const revenues = await base44.asServiceRole.entities.DailyRevenue.list("-date", 500);
    let updated = 0;
    const errors: string[] = [];
    for (const rev of revenues) {
      if (!rev.date) continue;
      const dateStr = rev.date as string;
      const date = new Date(dateStr + "T12:00:00");
      const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      const prevDay = new Date(date.getTime() - 24 * 60 * 60 * 1000);
      const nextDayStr = nextDay.toISOString().slice(0, 10);
      const prevDayStr = prevDay.toISOString().slice(0, 10);
      const dow = date.getDay();
      const isHoliday = allHolidays.has(dateStr);
      const isHolidayEve = allHolidays.has(nextDayStr);
      const isBridgeDay = (dow === 1 && allHolidays.has(nextDayStr)) || (dow === 5 && allHolidays.has(prevDayStr));
      const season = getSeason(dateStr);
      if (rev.is_holiday !== isHoliday || rev.is_holiday_eve !== isHolidayEve || rev.is_bridge_day !== isBridgeDay || rev.season !== season) {
        try {
          await base44.asServiceRole.entities.DailyRevenue.update(rev.id, {
            is_holiday: isHoliday,
            is_holiday_eve: isHolidayEve,
            is_bridge_day: isBridgeDay,
            season: season,
          });
          updated++;
        } catch (e: any) {
          errors.push(`${dateStr}: ${e.message}`);
        }
      }
    }
    res.json({ success: true, updated, total: revenues.length, errors });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
