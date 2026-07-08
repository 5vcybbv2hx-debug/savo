// fixTimeEntrySyncDuplicates.ts
// Einmaliger Cleanup + Migration:
// 1. Verknüpft bestehende, unveränderte TimeEntries rückwirkend mit ihrer ursprünglichen
//    ClockEntry (source_clock_entry_id), damit der Sync-Job sie künftig korrekt erkennt.
// 2. Verknüpft Marco Monachinos manuell korrigierten Eintrag vom 25.06. explizit mit der
//    ClockEntry, aus der er ursprünglich (fehlerhaft) importiert wurde.
// 3. Entfernt den fälschlich re-importierten Duplikat-Eintrag vom 26.06. (0h, 01:49-01:49).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { formatInTimeZone } from 'npm:date-fns-tz@3.2.0';

const TZ = 'Europe/Berlin';

const MARCO_CORRECTED_TIME_ENTRY_ID = '6a43e921a7e9cd8667915149'; // date 2026-06-25, 16:00-01:49, genehmigt
const MARCO_SOURCE_CLOCK_ENTRY_ID = '6a3dbe6c7da76e9ed9bb137d';   // clock_in 2026-06-25T23:49:00Z
const BROKEN_DUPLICATE_TIME_ENTRY_ID = '6a4d94165a3cbf0d976d0c86'; // date 2026-06-26, 01:49-01:49, 0h

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const result: any = {};

    // 1. Generelles Backfill: alle TimeEntries ohne source_clock_entry_id mit ihrer
    // ursprünglichen ClockEntry verknüpfen (per employee_id+date+start_time-Match,
    // exakt die gleiche Logik wie der bisherige Sync-Dedup-Key).
    const clockEntries = await db.ClockEntry.list('-clock_in', 500);
    const completed = clockEntries.filter((e: any) => e.clock_out && e.status === 'clocked_out');
    const timeEntries = await db.TimeEntry.list('-date', 1000);
    const unlinked = timeEntries.filter((t: any) => !t.source_clock_entry_id);

    const keyToClockEntry = new Map<string, any>();
    for (const ce of completed) {
      const date = formatInTimeZone(new Date(ce.clock_in), TZ, 'yyyy-MM-dd');
      const start_time = formatInTimeZone(new Date(ce.clock_in), TZ, 'HH:mm');
      keyToClockEntry.set(`${ce.employee_id}_${date}_${start_time}`, ce);
    }

    let backfilled = 0;
    for (const t of unlinked) {
      const key = `${t.employee_id}_${t.date}_${t.start_time}`;
      const match = keyToClockEntry.get(key);
      if (match) {
        await db.TimeEntry.update(t.id, { source_clock_entry_id: match.id });
        backfilled++;
      }
    }
    result.backfilled_by_key_match = backfilled;

    // 2. Marcos manuell korrigierten Eintrag explizit verknüpfen (Key passt nach der
    // Korrektur nicht mehr, daher hier gezielt).
    try {
      const marco = await db.TimeEntry.get(MARCO_CORRECTED_TIME_ENTRY_ID);
      if (marco && !marco.source_clock_entry_id) {
        await db.TimeEntry.update(MARCO_CORRECTED_TIME_ENTRY_ID, { source_clock_entry_id: MARCO_SOURCE_CLOCK_ENTRY_ID });
        result.marco_linked = true;
      } else {
        result.marco_linked = false;
        result.marco_reason = marco ? 'already_linked' : 'not_found';
      }
    } catch (e) {
      result.marco_linked = false;
      result.marco_error = String(e);
    }

    // 3. Kaputtes Duplikat löschen
    try {
      const dup = await db.TimeEntry.get(BROKEN_DUPLICATE_TIME_ENTRY_ID);
      if (dup) {
        await db.TimeEntry.delete(BROKEN_DUPLICATE_TIME_ENTRY_ID);
        result.duplicate_deleted = true;
      } else {
        result.duplicate_deleted = false;
        result.duplicate_reason = 'not_found';
      }
    } catch (e) {
      result.duplicate_deleted = false;
      result.duplicate_error = String(e);
    }

    return Response.json({ success: true, result });
  } catch (err) {
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
});
