// Bedarfstags-Logik der Putzliste (Frontend-Spiegel von base44/shared/cleaningSchedule.ts).
// Bedarfstag = Samstag, Sonntag oder besonderer Betriebstag (Vorfeiertag, Feiertag, Eventtag).
// An allen anderen Tagen gilt "kein Bedarf" — dort entstehen keine Quoten und keine Warnungen.

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function weekdayIndexOf(dateStr) {
  return new Date(`${dateStr}T12:00:00`).getDay();
}

export function isDemandDay(dateStr, calendarDay) {
  const dow = weekdayIndexOf(dateStr);
  if (dow === 0 || dow === 6) return true;
  if (!calendarDay) return false;
  if (calendarDay.is_pre_holiday === true || calendarDay.is_holiday === true || calendarDay.is_event_day === true) {
    return true;
  }
  return ['vorfeiertag', 'feiertag', 'eventtag'].includes(String(calendarDay.day_type || ''));
}

export function demandReason(dateStr, calendarDay) {
  const dow = weekdayIndexOf(dateStr);
  if (dow === 6) return 'Samstag';
  if (dow === 0) return 'Sonntag';
  if (!calendarDay) return '';
  if (calendarDay.is_pre_holiday === true || calendarDay.day_type === 'vorfeiertag') return 'Vorfeiertag';
  if (calendarDay.is_holiday === true || calendarDay.day_type === 'feiertag') return 'Feiertag';
  if (calendarDay.is_event_day === true || calendarDay.day_type === 'eventtag') return 'Eventtag';
  return '';
}

export { WEEKDAYS };