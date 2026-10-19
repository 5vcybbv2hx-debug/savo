import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';
const URL_HOME = 'https://bar-shift-pro-fc3522b9.base44.app/';
const TZ = 'Europe/Berlin';
const REMINDER_GRACE_MS = 45 * 60 * 1000;   // 45 Minuten nach Schicht-Ende
const FALLBACK_HOURS_MS = 8 * 60 * 60 * 1000; // 8h Fallback bei fehlender Schicht

async function pushToEmployee(employeeId, title, message, url) {
    if (!employeeId) return null;
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY_2');
    if (!apiKey) throw new Error('OneSignal API-Key fehlt (ONESIGNAL_REST_API_KEY_2)');
    const payload = {
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [String(employeeId)] },
        target_channel: 'push',
        headings: { en: title, de: title },
        contents: { en: message, de: message }
    };
    if (url) payload.url = url;
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
        const errStr = JSON.stringify(data);
        if (/invalid_aliases/i.test(errStr)) return { skipped: true, reason: 'invalid_aliases' };
        throw new Error(`OneSignal API error: ${errStr}`);
    }
    return data;
}

// ── Europe/Berlin Zeithelfer (DST-sicher) ───────────────────────
function berlinParts(epoch) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const map = {};
    for (const p of fmt.formatToParts(new Date(epoch))) map[p.type] = p.value;
    if (map.hour === '24') map.hour = '00'; // en-GB Midnight-Quirk
    return map;
}

// Offset Berlin gegenüber UTC für einen gegebenen Epoch (ms)
function berlinOffsetMs(epoch) {
    const m = berlinParts(epoch);
    const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second);
    return asUTC - epoch;
}

// ISO-String → Berliner Datum "YYYY-MM-DD"
function berlinDateOf(isoStr) {
    const m = berlinParts(new Date(isoStr).getTime());
    return `${m.year}-${m.month}-${m.day}`;
}

// Datum +/- n Tage → "YYYY-MM-DD"
function addDay(dateStr, n) {
    const d = new Date(Date.UTC(+dateStr.slice(0, 4), +dateStr.slice(5, 7) - 1, +dateStr.slice(8, 10)));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

// Berliner Wanduhr-Zeit (dateStr + timeStr) → Epoch ms
function berlinDateTimeToEpoch(dateStr, timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const guess = Date.UTC(+dateStr.slice(0, 4), +dateStr.slice(5, 7) - 1, +dateStr.slice(8, 10), h, m, 0);
    return guess - berlinOffsetMs(guess);
}

// Schicht-Ende als Epoch; Mitternachts-Rollover: end_time <= start_time → Folgetag
function shiftEndEpoch(shift, baseDateStr) {
    const start = shift.start_time;
    const end = shift.end_time;
    if (!end) return null;
    const endDate = (start && end <= start) ? addDay(baseDateStr, 1) : baseDateStr;
    return berlinDateTimeToEpoch(endDate, end);
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const nowEpoch = Date.now();

        // Aktive ClockEntries (noch eingestempelt oder in Pause)
        const activeEntries = await base44.asServiceRole.entities.ClockEntry.filter({
            status: { $in: ['clocked_in', 'on_break'] }
        });

        let notified = 0;
        let skippedRecent = 0;
        let skippedReminded = 0;
        let skippedNoShift = 0;

        for (const entry of activeEntries) {
            if (!entry.employee_id || !entry.clock_in) continue;

            // Bereits erinnert → überspringen
            if (entry.ausstempel_reminder_sent === true) { skippedReminded++; continue; }

            const clockInEpoch = new Date(entry.clock_in).getTime();
            const clockInDate = berlinDateOf(entry.clock_in);

            // Schichten am Berlin-Datum der Einstempelung suchen
            let shifts = [];
            try {
                const res = await base44.asServiceRole.entities.Shift.filter({
                    employee_id: entry.employee_id,
                    date: clockInDate
                });
                shifts = res || [];
            } catch (e) {
                console.error('[notifyOpenClockSessions] Shift-Lookup fehlgeschlagen:', e.message);
            }

            // Bei mehreren Schichten: zuletzt beginnende an diesem Tag
            let shift = null;
            if (shifts.length > 0) {
                shift = shifts.reduce((best, s) =>
                    (!best || (s.start_time || '') > (best.start_time || '')) ? s : best, null);
            }

            let shouldPush = false;
            let message = '';

            if (shift && shift.end_time) {
                const endE = shiftEndEpoch(shift, clockInDate);
                if (endE != null) {
                    if (nowEpoch > endE + REMINDER_GRACE_MS) {
                        shouldPush = true;
                        message = `Deine Schicht ist seit ${shift.end_time} Uhr vorbei — bitte nicht vergessen auszustempeln.`;
                    } else {
                        skippedRecent++; // Schicht noch nicht lange genug vorbei
                    }
                }
            } else {
                // Keine Schicht (spontanes Arbeiten): Fallback nach 8h
                if ((nowEpoch - clockInEpoch) > FALLBACK_HOURS_MS) {
                    shouldPush = true;
                    message = 'Du bist seit über 8 Stunden eingestempelt — bitte ausstempeln.';
                } else {
                    skippedNoShift++;
                }
            }

            if (shouldPush) {
                const title = '😴 Noch eingestempelt!';
                try {
                    await pushToEmployee(entry.employee_id, title, message, URL_HOME);
                    // Flag setzen, damit nicht jeder Workflow-Lauf erneut pusht
                    try {
                        await base44.asServiceRole.entities.ClockEntry.update(
                            entry.id, { ausstempel_reminder_sent: true });
                    } catch (e) {
                        console.error('[notifyOpenClockSessions] Flag-Update fehlgeschlagen:', e.message);
                    }
                    notified++;
                } catch (e) {
                    console.error('[notifyOpenClockSessions] Push fehlgeschlagen für', entry.employee_id, e.message);
                }
            }
        }

        return Response.json({
            checked: activeEntries.length,
            notified,
            skipped_recently_ended: skippedRecent,
            skipped_already_reminded: skippedReminded,
            skipped_no_shift: skippedNoShift
        });
    } catch (error) {
        console.error('[notifyOpenClockSessions] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});