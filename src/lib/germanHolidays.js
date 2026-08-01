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
 * Check if a date is the day BEFORE a holiday (Partyabend)
 * e.g. 31.12 (Silvester), 30.04 (vor Tag der Arbeit), 24.12 (Heiligabend)
 */
export function isHolidayEve(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const nextDayStr = formatDate(nextDay);
  const holidays = getBWHolidays(nextDay.getFullYear());
  return holidays.has(nextDayStr);
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
