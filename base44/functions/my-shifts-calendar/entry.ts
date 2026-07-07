// my-shifts-calendar — öffentlicher ICS-Feed, Token-basierte Authentifizierung
// Kein User-Auth nötig: Apple/Google/Outlook rufen diese URL ohne Auth-Header auf.
// Sicherheit: employee_id + calendar_token (zufällig, 32 Zeichen) im Query-String.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── ICS helpers ───────────────────────────────────────────────────────────────
const nowStamp = () => new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
const esc = (s) => (s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

function timeToMin(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
}

// Formatiert "H:MM" oder "HH:MM" zu einem RFC5545-konformen 6-stelligen
// HHMMSS-Zeitanteil. Ohne dies erzeugte z.B. "5:00" (einstellige Stunde,
// wie sie bei vielen Nachtschichten im System vorkommt, z.B. "16:00-1:00")
// nur "50000" (5 Ziffern statt 6) — ein ungueltiger ICS-Zeitstempel, den
// viele Kalender-Apps (v.a. Google Calendar) zum Anlass nehmen, den
// KOMPLETTEN Feed abzulehnen statt nur das einzelne Event zu ueberspringen.
function toICSTime(t) {
    const [h, m] = (t || '00:00').split(':').map(Number);
    return `${String(h || 0).padStart(2, '0')}${String(m || 0).padStart(2, '0')}00`;
}

function shiftToEvent(s) {
    const d        = s.date.replace(/-/g, '');
    const startMin = timeToMin(s.start_time);
    const endMin   = timeToMin(s.end_time);
    let endDate = d;
    if (endMin <= startMin) {
        const next = new Date(s.date + 'T00:00:00');
        next.setDate(next.getDate() + 1);
        endDate = next.toISOString().split('T')[0].replace(/-/g, '');
    }
    const lines = [
        'BEGIN:VEVENT',
        `UID:shift-${s.id}@barshift.app`,
        `DTSTAMP:${nowStamp()}`,
        `DTSTART;TZID=Europe/Berlin:${d}T${toICSTime(s.start_time)}`,
        `DTEND;TZID=Europe/Berlin:${endDate}T${toICSTime(s.end_time)}`,
        `SUMMARY:🍺 ${esc(s.shift_type || 'Schicht')}`,
    ];
    if (s.notes) lines.push(`DESCRIPTION:${esc(s.notes)}`);
    lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT');
    return lines.join('\r\n');
}

function birthdayToEvent(e) {
    if (!e.birthday) return null;
    const parts = e.birthday.split('-');
    if (parts.length < 3) return null;
    const [, mm, dd] = parts;
    const today    = new Date();
    const thisYear = today.getFullYear();
    const thisDate = new Date(thisYear, Number(mm) - 1, Number(dd));
    const startYear = thisDate < today ? thisYear + 1 : thisYear;
    const yDate = `${startYear}${mm.padStart(2,'0')}${dd.padStart(2,'0')}`;
    const endDay = new Date(startYear, Number(mm) - 1, Number(dd) + 1);
    const yEnd  = `${endDay.getFullYear()}${mm.padStart(2,'0')}${String(endDay.getDate()).padStart(2,'0')}`;
    return [
        'BEGIN:VEVENT',
        `UID:bday-${e.id}@barshift.app`,
        `DTSTAMP:${nowStamp()}`,
        `DTSTART;VALUE=DATE:${yDate}`,
        `DTEND;VALUE=DATE:${yEnd}`,
        `SUMMARY:🎂 ${esc(e.name || '')}`,
        'RRULE:FREQ=YEARLY',
        'TRANSP:TRANSPARENT',
        'STATUS:CONFIRMED',
        'END:VEVENT',
    ].join('\r\n');
}

function meetingToEvent(m) {
    if (!m.date) return null;
    const d    = m.date.replace(/-/g, '');
    const time = m.time || '18:00';
    const st   = toICSTime(time);
    const startH = parseInt(time.split(':')[0], 10) || 0;
    const endH   = String(Math.min(startH + 2, 23)).padStart(2, '0');
    const endMin = String(parseInt(time.split(':')[1], 10) || 0).padStart(2, '0');
    const et   = `${endH}${endMin}00`;
    const lines = [
        'BEGIN:VEVENT',
        `UID:meeting-${m.id}@barshift.app`,
        `DTSTAMP:${nowStamp()}`,
        `DTSTART;TZID=Europe/Berlin:${d}T${st}`,
        `DTEND;TZID=Europe/Berlin:${d}T${et}`,
        `SUMMARY:📋 Teamsitzung`,
    ];
    if (m.location) lines.push(`LOCATION:${esc(m.location)}`);
    if (m.notes)    lines.push(`DESCRIPTION:${esc(m.notes)}`);
    lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT');
    return lines.join('\r\n');
}

const VTIMEZONE = [
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Berlin',
    'BEGIN:STANDARD',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
].join('\r\n');

// ─── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    }

    const reqUrl = new URL(req.url);
    const employeeId = reqUrl.searchParams.get('employee_id');
    const token      = reqUrl.searchParams.get('token');

    if (!employeeId || !token) {
        return new Response('employee_id and token are required', { status: 400 });
    }

    try {
        // asServiceRole funktioniert auch ohne User-Auth-Header (externe Kalender-Clients)
        const base44 = createClientFromRequest(req);

        const empResults = await base44.asServiceRole.entities.Employee.filter({ id: employeeId }, 'name', 1);
        const employee = empResults?.[0] || null;

        if (!employee) {
            return new Response('Employee not found', { status: 404 });
        }

        if (!employee.calendar_token || employee.calendar_token !== token) {
            return new Response('Invalid or expired token', { status: 403 });
        }

        // Alle Daten parallel laden
        const [shifts, allEmployees, meetings] = await Promise.all([
            base44.asServiceRole.entities.Shift.filter({ employee_id: employeeId }, '-date', 500).catch(() => []),
            base44.asServiceRole.entities.Employee.filter({ is_active: true }, 'name', 200).catch(() => []),
            base44.asServiceRole.entities.TeamMeetingSchedule.list('-date', 100).catch(() => []),
        ]);

        const shiftEvents    = shifts.map(shiftToEvent);
        const birthdayEvents = allEmployees
            .filter(e => e.birthday && e.id !== employeeId)
            .map(birthdayToEvent)
            .filter(Boolean);
        const meetingEvents  = meetings.map(meetingToEvent).filter(Boolean);

        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//BarShift Pro//Schichten//DE',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            `X-WR-CALNAME:${esc(employee.name)} – Schichten`,
            'X-WR-TIMEZONE:Europe/Berlin',
            'X-WR-CALDESC:Deine Schichten\\, Teamgeburtstage und Teamsitzungen',
            'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
            'X-PUBLISHED-TTL:PT15M',
            VTIMEZONE,
            ...shiftEvents,
            ...birthdayEvents,
            ...meetingEvents,
            'END:VCALENDAR',
        ].join('\r\n');

        return new Response(ics, {
            status: 200,
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'inline; filename="my-shifts.ics"',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Access-Control-Allow-Origin': '*',
            }
        });

    } catch (err) {
        console.error('[my-shifts-calendar] error:', err?.message || err);
        return new Response('Internal server error: ' + (err?.message || ''), { status: 500 });
    }
});