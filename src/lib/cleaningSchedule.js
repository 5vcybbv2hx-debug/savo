// Nacht- und Bedarfslogik der Putzliste (Frontend-Spiegel von base44/shared/cleaningSchedule.ts).
// Eine Nachtschicht läuft von 05:00 bis 05:00 am Folgetag. Ein Haken um 01:30 am Samstag
// gehört damit zur Freitags-Schicht.
// Bedarfsnacht = Freitag, Samstag, Vorfeiertags-Abend oder Abend vor einem Feiertag.

export const NIGHT_START_HOUR = 5;

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