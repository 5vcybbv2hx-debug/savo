// fixMarcoDuplicateEntry.ts
// Einmaliger Cleanup: Am 07.07.2026 wurde durch einen doppelten Einstempel-Vorgang
// (zwei ClockEntry-Sessions binnen 0,5 Sekunden) für Marco Monachino ein doppelter
// Zeiterfassungs-Eintrag erzeugt. Der Manager hat bestätigt, dass die Session MIT der
// echten 280-Minuten-Pause (17:00-21:40 Uhr) korrekt ist. Die Session mit der pauschalen
// 45-Minuten-Pause (ohne echten Pauseneintrag) wird hier entfernt.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CLOCK_ENTRY_ID_TO_DELETE = '6a4ce95f95991ba50d205ff1';
const TIME_ENTRY_ID_TO_DELETE = '6a4d869931659181bfe0a516';

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

    const result: any = { clock_entry: null, time_entry: null };

    try {
      const ce = await db.ClockEntry.get(CLOCK_ENTRY_ID_TO_DELETE);
      if (ce) {
        await db.ClockEntry.delete(CLOCK_ENTRY_ID_TO_DELETE);
        result.clock_entry = { deleted: true, id: CLOCK_ENTRY_ID_TO_DELETE };
      } else {
        result.clock_entry = { deleted: false, reason: 'not_found' };
      }
    } catch (e) {
      result.clock_entry = { deleted: false, error: String(e) };
    }

    try {
      const te = await db.TimeEntry.get(TIME_ENTRY_ID_TO_DELETE);
      if (te) {
        await db.TimeEntry.delete(TIME_ENTRY_ID_TO_DELETE);
        result.time_entry = { deleted: true, id: TIME_ENTRY_ID_TO_DELETE };
      } else {
        result.time_entry = { deleted: false, reason: 'not_found' };
      }
    } catch (e) {
      result.time_entry = { deleted: false, error: String(e) };
    }

    return Response.json({ success: true, result });
  } catch (err) {
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
});
