import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { formatInTimeZone } from 'npm:date-fns-tz@3.2.0';

const TZ = 'Europe/Berlin';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Nur Admins erlaubt' }, { status: 403 });
    }

    // Alle abgeschlossenen ClockEntries laden
    const clockEntries = await base44.asServiceRole.entities.ClockEntry.list('-clock_in', 500);
    const completedEntries = clockEntries.filter(e => e.clock_out && e.status === 'clocked_out');

    // Alle vorhandenen TimeEntries laden
    const timeEntries = await base44.asServiceRole.entities.TimeEntry.list('-date', 1000);

    // Primärer Dedup-Mechanismus: source_clock_entry_id — bleibt gültig, auch wenn ein
    // Manager Datum/Startzeit eines Eintrags nachträglich korrigiert (z.B. bei falsch
    // erfassten Mitternachts-Stempeln). Ohne diesen Link würde eine manuelle Korrektur
    // den alten, fehlerhaften Stempel beim nächsten Sync einfach wieder reimportieren.
    const existingClockEntryIds = new Set(
      timeEntries.filter(t => t.source_clock_entry_id).map(t => t.source_clock_entry_id)
    );

    // Fallback für ältere TimeEntries, die noch keinen source_clock_entry_id-Link haben
    // (z.B. sehr alte Importe vor Einführung dieses Felds).
    const existingKeys = new Set(
      timeEntries
        .filter(t => !t.source_clock_entry_id)
        .map(t => `${t.employee_id}_${t.date}_${t.start_time}`)
    );

    let created = 0;
    let skipped = 0;

    for (const entry of completedEntries) {
      if (existingClockEntryIds.has(entry.id)) {
        skipped++;
        continue;
      }

      const clockInDate = new Date(entry.clock_in);
      const clockOutDate = new Date(entry.clock_out);

      // WICHTIG: Alle Zeiten in Europe/Berlin formatieren, NICHT UTC
      const date = formatInTimeZone(clockInDate, TZ, 'yyyy-MM-dd');
      const start_time = formatInTimeZone(clockInDate, TZ, 'HH:mm');
      const end_time = formatInTimeZone(clockOutDate, TZ, 'HH:mm');

      const key = `${entry.employee_id}_${date}_${start_time}`;

      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      const totalHours = entry.total_hours || Math.round(
        ((clockOutDate - clockInDate) / 3600000 - (entry.pause_minutes || 0) / 60) * 100
      ) / 100;

      await base44.asServiceRole.entities.TimeEntry.create({
        employee_id: entry.employee_id,
        employee_name: entry.employee_name,
        date,
        start_time,
        end_time,
        break_minutes: entry.pause_minutes || 0,
        total_hours: totalHours,
        status: 'eingereicht',
        employee_confirmed: true,
        employee_confirmed_at: entry.clock_out,
        notes: 'Nachträglich aus Stempelzeiten importiert',
        source_clock_entry_id: entry.id,
      });

      existingClockEntryIds.add(entry.id);
      existingKeys.add(key);
      created++;
    }

    return Response.json({ success: true, created, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
