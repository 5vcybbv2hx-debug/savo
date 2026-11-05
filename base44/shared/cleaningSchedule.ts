// base44/shared/cleaningSchedule.ts
// Gemeinsame Fälligkeits-, Nacht- und Bedarfslogik der Putzliste.
// Genutzt von resetDailyCleaning, markCleaningReportDemandDays und notifyCleaningShortfall.

export const TIMEZONE = 'Europe/Berlin';
export const NIGHT_START_HOUR = 5; // Schichtfenster: 05:00 bis 05:00 am Folgetag
export const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** Datum (YYYY-MM-DD) in der Zeitzone des Betriebs. */
export function dateInTimeZone(date: Date = new Date(), timeZone: string = TIMEZONE): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Lokaler Zeitstempel "YYYY-MM-DDTHH:MM" in der Zeitzone des Betriebs. */
export function localStamp(date: Date, timeZone: string = TIMEZONE): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(' ', 'T');
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayIndex(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

export function weekdayName(dateStr: string): string {
  return WEEKDAYS[weekdayIndex(dateStr)];
}

/**
 * Zu welchem Abend gehört ein Zeitpunkt? Alles vor 05:00 zählt noch zum Abend davor,
 * damit ein Haken um 01:30 am Samstag zur Freitags-Schicht gehört.
 */
export function nightDateFor(date: Date = new Date(), timeZone: string = TIMEZONE): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(date));
  const shifted = hour < NIGHT_START_HOUR ? new Date(date.getTime() - 86400000) : date;
  return dateInTimeZone(shifted, timeZone);
}

export function addDaysToNight(nightDate: string, days: number): string {
  return addDays(nightDate, days);
}

/** Zählfenster einer Nacht: [Abend 05:00, Folgetag 05:00). */
export function nightWindow(nightDate: string): { start: string; end: string } {
  return { start: `${nightDate}T05:00`, end: `${addDays(nightDate, 1)}T05:00` };
}

/** Liegt der Zeitpunkt (completed_at) im Schichtfenster dieser Nacht? */
export function isCompletedInNight(completedAt: string | null | undefined, nightDate: string): boolean {
  if (!completedAt) return false;
  const parsed = new Date(completedAt);
  if (Number.isNaN(parsed.getTime())) return false;
  const { start, end } = nightWindow(nightDate);
  const stamp = localStamp(parsed);
  return stamp >= start && stamp < end;
}

/**
 * Bedarfsnacht = Freitag- oder Samstagnacht, Vorfeiertags-Abend
 * oder Abend vor einem Feiertag (Folgetag ist Feiertag).
 */
export function isDemandNight(nightDate: string, calendarOfNight?: any, calendarOfNextDay?: any): boolean {
  const dow = weekdayIndex(nightDate);
  if (dow === 5 || dow === 6) return true;
  if (calendarOfNight && (calendarOfNight.is_pre_holiday === true || calendarOfNight.day_type === 'vorfeiertag')) {
    return true;
  }
  if (calendarOfNextDay && (calendarOfNextDay.is_holiday === true || calendarOfNextDay.day_type === 'feiertag')) {
    return true;
  }
  return false;
}

export function demandNightReason(nightDate: string, calendarOfNight?: any, calendarOfNextDay?: any): string {
  const dow = weekdayIndex(nightDate);
  if (dow === 5) return 'Freitagnacht';
  if (dow === 6) return 'Samstagnacht';
  if (calendarOfNight && (calendarOfNight.is_pre_holiday === true || calendarOfNight.day_type === 'vorfeiertag')) {
    return 'Vorfeiertag';
  }
  if (calendarOfNextDay && (calendarOfNextDay.is_holiday === true || calendarOfNextDay.day_type === 'feiertag')) {
    return 'Vor einem Feiertag';
  }
  return '';
}

/**
 * Ist die Aufgabe an diesem Abend fällig?
 * Berücksichtigt frequency, due_weekdays, due_date und biweekly_pattern.
 * Biweekly: mi_1/do_1 = erste Ausprägung im Monat (Tag 1–7), mi_2/do_2 = zweite (Tag 8–14).
 */
export function isTaskDueOn(task: any, dateStr: string, calendarDay?: any): boolean {
  const dow = weekdayIndex(dateStr);
  const dayName = WEEKDAYS[dow];
  const dayOfMonth = new Date(`${dateStr}T12:00:00Z`).getUTCDate();
  const weekdays: string[] = Array.isArray(task?.due_weekdays) ? task.due_weekdays : [];

  if (weekdays.length > 0 && !weekdays.includes(dayName)) return false;

  const frequency = String(task?.frequency || '');

  if (frequency === 'täglich') return true;

  if (frequency === 'am Wochenende') return dow === 0 || dow === 6;

  // Zweiwochen-Muster greift auch, wenn die Aufgabe als "wöchentlich" angelegt ist
  // (Bestandsdaten, z. B. "Kühlschubladen putzen" mit Muster do_2).
  const biweekly = String(task?.biweekly_pattern || '');
  if ((frequency === 'wöchentlich' || frequency === 'alle zwei Wochen') && biweekly) {
    const [patternDay, occurrence] = biweekly.split('_');
    const targetDow = patternDay === 'mi' ? 3 : patternDay === 'do' ? 4 : -1;
    if (targetDow !== -1) {
      if (dow !== targetDow) return false;
      const occurrenceInMonth = Math.floor((dayOfMonth - 1) / 7) + 1;
      return occurrenceInMonth === Number(occurrence || 1);
    }
  }

  if (frequency === 'wöchentlich') {
    if (weekdays.length > 0) return true;
    if (task?.due_date) return weekdayIndex(String(task.due_date).slice(0, 10)) === dow;
    return dow === 1; // Standard: Montag
  }

  if (frequency === 'alle zwei Wochen') {
    return weekdays.length > 0;
  }

  if (frequency === 'monatlich') {
    if (!task?.due_date) return dayOfMonth === 1;
    return dayOfMonth === Number(String(task.due_date).slice(8, 10));
  }

  if (frequency === 'an Sonderöffnungstagen') {
    return !!calendarDay && (calendarDay.is_special_opening === true || calendarDay.day_type === 'sonderoeffnung');
  }

  return false;
}

/** Alle Aufgaben, die an diesem Abend fällig sind. */
export function dueTasksOn(tasks: any[], dateStr: string, calendarDay?: any): any[] {
  return (tasks || []).filter((task) => isTaskDueOn(task, dateStr, calendarDay));
}