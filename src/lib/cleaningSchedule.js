// Nacht- und Bedarfslogik der Putzliste (Frontend-Spiegel von base44/shared/cleaningSchedule.ts).
// Eine Nachtschicht läuft von 05:00 bis 05:00 am Folgetag. Ein Haken um 01:30 am Samstag
// gehört damit zur Freitags-Schicht.
// Bedarfsnacht = Freitag, Samstag, Vorfeiertags-Abend oder Abend vor einem Feiertag.

export const NIGHT_START_HOUR = 5;
export const WEEKDAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** ISO-Kalenderwoche (Montag–Sonntag) eines Datums. */
export function isoWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

/** Parität der Kalenderwoche: 1 = ungerade KW, 2 = gerade KW. */
export function weekParity(dateStr) {
  return isoWeek(dateStr) % 2 === 1 ? 1 : 2;
}

export function shiftDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Fälligkeit einer wöchentlichen Aufgabe an einem Tag:
 * due_weekday muss passen, und bei biweekly_pattern entscheidet die
 * KW-Parität (_1 = ungerade KW, _2 = gerade KW).
 */
export function isWeeklyTaskDue(task, dateStr) {
  const dow = new Date(`${dateStr}T12:00:00`).getDay();
  const dayName = WEEKDAYS_DE[dow];
  const weekdays = Array.isArray(task?.due_weekdays) ? task.due_weekdays : [];
  const biweekly = String(task?.biweekly_pattern || '');
  const patternDow = biweekly.startsWith('mi') ? 3 : biweekly.startsWith('do') ? 4 : -1;

  if (weekdays.length > 0) {
    if (!weekdays.includes(dayName)) return false;
  } else if (patternDow !== -1) {
    if (dow !== patternDow) return false;
  } else if (task?.due_date) {
    return String(task.due_date).slice(0, 10) === dateStr;
  } else if (dow !== 1) {
    return false; // Standard: Montag
  }

  if (!biweekly) return true;
  return weekParity(dateStr) === Number(biweekly.split('_')[1] || 1);
}

/** Ist die Aufgabe an diesem Tag überhaupt dran? */
export function isTaskDueToday(task, dateStr) {
  const isWeekly = task?.frequency === 'wöchentlich' || task?.frequency === 'alle zwei Wochen';
  if (isWeekly) return isWeeklyTaskDue(task, dateStr);
  const weekdays = Array.isArray(task?.due_weekdays) ? task.due_weekdays : [];
  if (weekdays.length === 0) return true;
  return weekdays.includes(WEEKDAYS_DE[new Date(`${dateStr}T12:00:00`).getDay()]);
}

export function nextDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Zu welchem Abend gehört "jetzt"? Vor 05:00 noch zum Abend davor. */
export function currentNightDate(date = new Date()) {
  if (date.getHours() < NIGHT_START_HOUR) {
    const d = new Date(date.getTime() - 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Zählfenster einer Nacht: [Abend 05:00, Folgetag 05:00). */
export function nightWindow(nightDate) {
  return { start: `${nightDate}T05:00`, end: `${nextDay(nightDate)}T05:00` };
}

/** Lokaler Zeitstempel "YYYY-MM-DDTHH:MM". */
export function localStamp(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function isCompletedInNight(completedAt, nightDate) {
  if (!completedAt) return false;
  const parsed = new Date(completedAt);
  if (Number.isNaN(parsed.getTime())) return false;
  const { start, end } = nightWindow(nightDate);
  const stamp = localStamp(parsed);
  return stamp >= start && stamp < end;
}

export function isDemandNight(nightDate, calendarOfNight, calendarOfNextDay) {
  const dow = new Date(`${nightDate}T12:00:00`).getDay();
  if (dow === 5 || dow === 6) return true;
  if (calendarOfNight && (calendarOfNight.is_pre_holiday === true || calendarOfNight.day_type === 'vorfeiertag')) return true;
  if (calendarOfNextDay && (calendarOfNextDay.is_holiday === true || calendarOfNextDay.day_type === 'feiertag')) return true;
  return false;
}