/**
 * businessCalendarUtils.js
 * Utility-Funktionen für den Betriebskalender.
 * Prüft ob eine Aufgabe an einem bestimmten Tag erscheinen soll.
 */

import { format } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * Gibt den BusinessCalendarDay-Eintrag für ein Datum zurück (oder null).
 * @param {string} dateStr  'yyyy-MM-dd'
 * @param {Array}  calendarDays  Array von BusinessCalendarDay-Records
 */
export function getCalendarDayForDate(dateStr, calendarDays = []) {
    return calendarDays.find(d => d.date === dateStr) || null;
}

/**
 * Prüft ob eine Aufgabe (mit special_day_rules) an einem Datum erscheinen soll.
 *
 * @param {Object} task  CleaningTask / OperationalTask mit:
 *   - due_weekdays: string[]   z.B. ['Montag','Dienstag']
 *   - special_day_rules: Object  { include_special_openings, include_pre_holidays, ... }
 * @param {Date}   date   JavaScript Date-Objekt
 * @param {Object|null} calendarEntry  BusinessCalendarDay-Record für diesen Tag (oder null)
 * @returns {boolean}
 */
export function taskAppearsOnDate(task, date, calendarEntry) {
    const rules = task.special_day_rules || {};
    const weekday = format(date, 'EEEE', { locale: de }); // 'Montag', 'Dienstag', ...

    // 1. Wenn "nur an Sondertagen" → Wochentage ignorieren
    if (rules.only_special_days) {
        return calendarEntry ? matchesSpecialRules(rules, calendarEntry) : false;
    }

    // 2. Wochentags-Prüfung (Standard)
    const weekdays = task.due_weekdays || [];
    const matchesWeekday = weekdays.length === 0 || weekdays.includes(weekday);

    // 3. Sonderregel-Prüfung (OR-Logik: zusätzlich zum Wochentag)
    const matchesSpecial = calendarEntry ? matchesSpecialRules(rules, calendarEntry) : false;

    return matchesWeekday || matchesSpecial;
}

/**
 * Intern: Prüft ob der Betriebskalender-Eintrag eine der aktivierten Sonderregeln erfüllt.
 */
function matchesSpecialRules(rules, entry) {
    if (rules.include_special_openings   && entry.is_special_opening)  return true;
    if (rules.include_pre_holidays       && entry.is_pre_holiday)       return true;
    if (rules.include_holidays           && entry.is_holiday)           return true;
    if (rules.include_event_days         && entry.is_event_day)         return true;
    if (rules.include_long_nights        && entry.is_long_night)        return true;
    if (rules.include_inventory_days     && entry.is_inventory_day)     return true;
    if (rules.include_cleaning_only_days && entry.is_cleaning_only_day) return true;

    // "Nicht an geschlossenen Tagen" → explizit false wenn geschlossen
    if (rules.exclude_closed_days && entry.is_closed) return false;

    return false;
}

/**
 * Gibt ein kurzes Label für den Sondertag zurück (für Badge-Anzeige).
 */
export function getSpecialDayLabel(calendarEntry) {
    if (!calendarEntry) return null;
    const labels = {
        sonderoeffnung:           'Sonderöffnung',
        vorfeiertag:              'Vorfeiertag',
        feiertag:                 'Feiertag',
        eventtag:                 'Eventtag',
        lange_nacht:              'Lange Nacht',
        inventurtag:              'Inventurtag',
        geschlossen:              'Geschlossen',
        geschlossen_mit_reinigung:'Reinigung',
        saisonstart:              'Saisonstart',
        saisonende:               'Saisonende',
        betriebsferien:           'Betriebsferien',
        wartungstag:              'Wartung',
    };
    return labels[calendarEntry.day_type] || null;
}

/**
 * Gibt Farbe (Tailwind-Klasse) für Sondertag-Badge zurück.
 */
export function getSpecialDayColor(dayType) {
    const colors = {
        sonderoeffnung:           'bg-status-warn/20 text-status-warn/25 border-status-warn/30',
        vorfeiertag:              'bg-status-warn/20 text-status-warn/25 border-status-warn/30',
        feiertag:                 'bg-status-danger/20 text-status-danger/25 border-status-danger/30',
        eventtag:                 'bg-primary/20 text-primary border-primary/30',
        lange_nacht:              'bg-primary/20 text-primary border-primary/30',
        inventurtag:              'bg-primary/20 text-primary border-primary/30',
        geschlossen:              'bg-surface text-muted-foreground border-border',
        geschlossen_mit_reinigung:'bg-primary/20 text-primary border-primary/30',
        saisonstart:              'bg-status-ok/20 text-status-ok/25 border-status-ok/30',
        saisonende:               'bg-status-warn/20 text-status-warn/25 border-status-warn/30',
        betriebsferien:           'bg-primary/20 text-primary border-primary/30',
        wartungstag:              'bg-surface text-muted-foreground border-border',
    };
    return colors[dayType] || '';
}