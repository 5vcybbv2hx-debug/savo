/**
 * German Holidays — Baden-Württemberg
 * 
 * Berechnet alle gesetzlichen Feiertage in BW für ein gegebenes Jahr.
 * Wird genutzt für: is_holiday, is_holiday_eve (Partyabend), is_bridge_day
 */

// Easter calculation (Gauss algorithm)
function getEasterSunday(year) {
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

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Get all holidays in Baden-Württemberg for a year.
 * Returns a Map of 'YYYY-MM-DD' → holiday name
 */
export function getBWHolidays(year) {
  const holidays = new Map();
  holidays.set(`${year}-01-01`, 'Neujahr');
  holidays.set(`${year}-01-06`, 'Heilige Drei Könige');
  holidays.set(`${year}-05-01`, 'Tag der Arbeit');
  holidays.set(`${year}-10-03`, 'Tag der Deutschen Einheit');
  holidays.set(`${year}-11-01`, 'Allerheiligen');
  holidays.set(`${year}-12-25`, '1. Weihnachtstag');
  holidays.set(`${year}-12-26`, '2. Weihnachtstag');
  
  const easter = getEasterSunday(year);
  const easterMs = easter.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  
  holidays.set(formatDate(new Date(easterMs - 2 * dayMs)), 'Karfreitag');
  holidays.set(formatDate(new Date(easterMs + 1 * dayMs)), 'Ostermontag');
  holidays.set(formatDate(new Date(easterMs + 39 * dayMs)), 'Christi Himmelfahrt');
  holidays.set(formatDate(new Date(easterMs + 50 * dayMs)), 'Pfingstmontag');
  holidays.set(formatDate(new Date(easterMs + 60 * dayMs)), 'Fronleichnam');
  
  return holidays;
}

/**
 * Check if a date is a holiday in BW
 */
export function isHoliday(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const holidays = getBWHolidays(date.getFullYear());
  return holidays.has(dateStr);
}

/**
 * Party-Level für Feiertags-Vorabende
 * 3 = Vollgas (Silvester, Heiligabend, Tanz in den Mai, Einheit, Himmelfahrt, Pfingsten)
 * 2 = Ganz ok (Karfreitag-Vorabend / Gründonnerstag)
 * 1 = Ruhig / egal (Drei Könige, Allerheiligen, Ostermontag, Fronleichnam)
 * 0 = kein Feiertags-Vorabend
 */
const HOLIDAY_EVE_LEVELS = {
  '01-01': 3,  // Silvester → Neujahr = VOLLGAS
  '01-06': 1,  // Vor Heilige Drei Könige = egal
  '12-25': 3,  // Heiligabend → 1. Weihnachtstag = VOLLGAS
  '12-26': 1,  // 1. Weihnachtsfeiertag → 2. Weihnachtstag = ruhig (Familie)
  '05-01': 3,  // Tanz in den Mai → Tag der Arbeit = VOLLGAS
  '10-03': 3,  // Vor Tag der Deutschen Einheit = VOLLGAS
  '11-01': 1,  // Vor Allerheiligen = egal
};

// Variable holidays (by Easter) — need year
function getVariableHolidayEveLevel(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const nextDayStr = formatDate(nextDay);
  const year = nextDay.getFullYear();
  const holidays = getBWHolidays(year);
  
  if (!holidays.has(nextDayStr)) return 0;
  
  // Check which variable holiday it is
  const easter = getEasterSunday(year);
  const dayMs = 24 * 60 * 60 * 1000;
  const karfreitag = formatDate(new Date(easter.getTime() - 2 * dayMs));
  const ostermontag = formatDate(new Date(easter.getTime() + 1 * dayMs));
  const himmelfahrt = formatDate(new Date(easter.getTime() + 39 * dayMs));
  const pfingstmontag = formatDate(new Date(easter.getTime() + 50 * dayMs));
  const fronleichnam = formatDate(new Date(easter.getTime() + 60 * dayMs));
  
  if (nextDayStr === karfreitag) return 2;    // Gründonnerstag → "ganz ok"
  if (nextDayStr === ostermontag) return 1;  // Ostersonntag → eher ruhig
  if (nextDayStr === himmelfahrt) return 3;  // Vor Himmelfahrt = PARTY (langes WE)
  if (nextDayStr === pfingstmontag) return 3; // Vor Pfingsten = PARTY (langes WE)
  if (nextDayStr === fronleichnam) return 1; // Vor Fronleichnam = eher ruhig
  
  return 0;
}

/**
 * Get party level for a date (0-3)
 * 0 = no holiday eve
 * 1 = quiet (Ruhig)
 * 2 = OK (ganz ok)
 * 3 = VOLLGAS (Partyabend)
 */
export function getHolidayEveLevel(dateStr) {
  // Check fixed holidays first
  const monthDay = dateStr.slice(5); // MM-DD
  if (HOLIDAY_EVE_LEVELS[monthDay] != null) return HOLIDAY_EVE_LEVELS[monthDay];
  
  // Check variable holidays
  return getVariableHolidayEveLevel(dateStr);
}

/**
 * Check if a date is the day BEFORE a holiday (any level)
 */
export function isHolidayEve(dateStr) {
  return getHolidayEveLevel(dateStr) > 0;
}

/**
 * Get holiday eve label and emoji
 */
export function getHolidayEveInfo(dateStr) {
  const level = getHolidayEveLevel(dateStr);
  if (level === 0) return null;
  const nextDay = new Date(dateStr + 'T12:00:00');
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = formatDate(nextDay);
  const holidayName = getBWHolidays(nextDay.getFullYear()).get(nextDayStr) || 'Feiertag';
  
  if (level === 3) return { level, label: 'Partyabend', emoji: '🔥', holidayName, staffBoost: 2 };
  if (level === 2) return { level, label: 'Ganz ok', emoji: '👌', holidayName, staffBoost: 1 };
  return { level, label: 'Ruhig', emoji: '😴', holidayName, staffBoost: 0 };
}

/**
 * Check if a date is a bridge day (Brückentag)
 * = Werktag (Mo-Fr) zwischen Feiertag und Wochenende
 * e.g. Friday after Thursday holiday, Monday before Tuesday holiday
 */
export function isBridgeDay(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const dow = date.getDay();
  const holidays = getBWHolidays(date.getFullYear());
  
  if (dow === 1) {
    const nextDay = formatDate(new Date(date.getTime() + 24 * 60 * 60 * 1000));
    return holidays.has(nextDay);
  }
  if (dow === 5) {
    const prevDay = formatDate(new Date(date.getTime() - 24 * 60 * 60 * 1000));
    return holidays.has(prevDay);
  }
  return false;
}

/**
 * Get season for a date
 */
export function getSeason(dateStr) {
  const month = parseInt(dateStr.slice(5, 7));
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/**
 * Get holiday name if date is a holiday
 */
export function getHolidayName(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const holidays = getBWHolidays(date.getFullYear());
  return holidays.get(dateStr) || null;
}
