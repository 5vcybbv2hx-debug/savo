// base44/shared/cleaningSchedule.ts
// Gemeinsame Fälligkeits- und Bedarfstagslogik der Putzliste.
// Genutzt von resetDailyCleaning, markCleaningReportDemandDays und notifyCleaningShortfall.

export const TIMEZONE = 'Europe/Berlin';
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

export function weekdayIndex(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

export function weekdayName(dateStr: string): string {
  return WEEKDAYS[weekdayIndex(dateStr)];
}

/**
 * Bedarfstag = Samstag, Sonntag oder ein besonderer Betriebstag
 * (Vorfeiertag, Feiertag, Eventtag). Alle übrigen Tage haben keinen Bedarf.
 */
export function isDemandDay(dateStr: string, calendarDay?: any): boolean {
  const dow = weekdayIndex(dateStr);
  if (dow === 0 || dow === 6) return true;
  if (!calendarDay) return false;
  if (calendarDay.is_pre_holiday === true || calendarDay.is_holiday === true || calendarDay.is_event_day === true) {
    return true;
  }
  return ['vorfeiertag', 'feiertag', 'eventtag'].includes(String(calendarDay.day_type || ''));
}

export function demandReason(dateStr: string, calendarDay?: any): string {
  const dow = weekdayIndex(dateStr);
  if (dow === 6) return 'Samstag';
  if (dow === 0) return 'Sonntag';
  if (!calendarDay) return '';
  if (calendarDay.is_pre_holiday === true || calendarDay.day_type === 'vorfeiertag') return 'Vorfeiertag';
  if (calendarDay.is_holiday === true || calendarDay.day_type === 'feiertag') return 'Feiertag';
  if (calendarDay.is_event_day === true || calendarDay.day_type === 'eventtag') return 'Eventtag';
  return '';
}

/**
 * Ist die Aufgabe an diesem Tag fällig?
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

  if (frequency === 'wöchentlich') {
    if (weekdays.length > 0) return true;
    if (task?.due_date) return weekdayIndex(String(task.due_date).slice(0, 10)) === dow;
    return dow === 1; // Standard: Montag
  }

  if (frequency === 'alle zwei Wochen') {
    const [patternDay, occurrence] = String(task?.biweekly_pattern || '').split('_');
    const targetDow = patternDay === 'mi' ? 3 : patternDay === 'do' ? 4 : -1;
    if (targetDow === -1) return weekdays.length > 0;
    if (dow !== targetDow) return false;
    const occurrenceInMonth = Math.floor((dayOfMonth - 1) / 7) + 1;
    return occurrenceInMonth === Number(occurrence || 1);
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

/** Alle Aufgaben, die an diesem Tag fällig sind. */
export function dueTasksOn(tasks: any[], dateStr: string, calendarDay?: any): any[] {
  return (tasks || []).filter((task) => isTaskDueOn(task, dateStr, calendarDay));
}