import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Inlined holiday utils (local imports not supported in Deno Deploy) ────────
function getEasterSunday(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    return new Date(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
function shiftDate(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function getHolidaysBW(year) {
    const e = getEasterSunday(year);
    return [
        { date: new Date(year, 0, 1),   name: 'Neujahr' },
        { date: new Date(year, 0, 6),   name: 'Heilige Drei Könige' },
        { date: shiftDate(e, -2),        name: 'Karfreitag' },
        { date: shiftDate(e,  1),        name: 'Ostermontag' },
        { date: new Date(year, 4, 1),   name: 'Tag der Arbeit' },
        { date: shiftDate(e, 39),        name: 'Christi Himmelfahrt' },
        { date: shiftDate(e, 50),        name: 'Pfingstmontag' },
        { date: shiftDate(e, 60),        name: 'Fronleichnam' },
        { date: new Date(year, 9, 3),   name: 'Tag der Deutschen Einheit' },
        { date: new Date(year, 10, 1),  name: 'Allerheiligen' },
        { date: new Date(year, 11, 25), name: '1. Weihnachtstag' },
        { date: new Date(year, 11, 26), name: '2. Weihnachtstag' },
    ];
}

// ─── ICS helpers ─────────────────────────────────────────────────────────────
const now8601 = () => new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
const dateStr  = (d) => d.replace(/-/g, '');

function buildEvent({ uid, dtstart, dtend, summary, description, allDay = false, transparent = false }) {
    const lines = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now8601()}`,
        allDay ? `DTSTART;VALUE=DATE:${dtstart}` : `DTSTART:${dtstart}`,
        allDay ? `DTEND;VALUE=DATE:${dtend}`   : `DTEND:${dtend}`,
        `SUMMARY:${summary}`,
    ];
    if (description) lines.push(`DESCRIPTION:${description}`);
    if (transparent)  lines.push('TRANSP:TRANSPARENT');
    lines.push('STATUS:CONFIRMED', 'END:VEVENT');
    return lines.join('\r\n');
}

// ─── Main handler ─────────────────────────────────────────────────────────────
// SECURITY: Token-basierte Authentifizierung — externe Kalender-Clients
// (Apple/Google/Outlook) rufen diese URL ohne Auth-Header auf.
// Das Token wird in CompanyInfo.calendar_feed_token gespeichert und vom
// Manager in der Live-Sync-Anleitung generiert. Ohne gültiges Token → 403.
Deno.serve(async (req) => {
    try {
        const reqUrl = new URL(req.url);
        const token = reqUrl.searchParams.get('token');

        if (!token) {
            return new Response('Token required. Generate one in the app under Live-Synchronisation.', { status: 401 });
        }

        const base44 = createClientFromRequest(req);

        // Token gegen CompanyInfo validieren
        const companyRecords = await base44.asServiceRole.entities.CompanyInfo.list();
        const company = companyRecords?.[0];
        if (!company || !company.calendar_feed_token || company.calendar_feed_token !== token) {
            return new Response('Invalid or expired token', { status: 403 });
        }

        const [shifts, reservations, employees, vacations, meetings] = await Promise.all([
            base44.asServiceRole.entities.Shift.list('-date', 500),
            base44.asServiceRole.entities.Reservation.list('-date', 500),
            base44.asServiceRole.entities.Employee.list(),
            base44.asServiceRole.entities.VacationRequest.filter({ status: 'genehmigt' }),
            base44.asServiceRole.entities.TeamMeetingSchedule.list('-date', 100),
        ]);

        const year = new Date().getFullYear();
        const holidays = [...getHolidaysBW(year), ...getHolidaysBW(year + 1)];

        const events = [];

        // ── Shifts: only operational info, no personal data beyond name ──────
        for (const s of shifts) {
            const d = dateStr(s.date);
            const [startH] = s.start_time.split(':').map(Number);
            const [endH]   = s.end_time.split(':').map(Number);
            let endDate = d;
            if (endH < startH || (endH === startH && endH === 0)) {
                const next = new Date(s.date + 'T00:00:00');
                next.setDate(next.getDate() + 1);
                endDate = next.toISOString().split('T')[0].replace(/-/g, '');
            }
            events.push([
                'BEGIN:VEVENT',
                `UID:shift-${s.id}@barmanager.app`,
                `DTSTAMP:${now8601()}`,
                `DTSTART;TZID=Europe/Berlin:${d}T${s.start_time.replace(':', '')}00`,
                `DTEND;TZID=Europe/Berlin:${endDate}T${s.end_time.replace(':', '')}00`,
                `SUMMARY:${s.employee_name}${s.shift_type ? ' – ' + s.shift_type : ''}`,
                'STATUS:CONFIRMED',
                'END:VEVENT',
            ].join('\r\n'));
        }

        // ── Reservations: guest count + table only, NO phone/email/notes ─────
        // PRIVACY: Phone, email and personal notes are stripped — they are internal data.
        for (const r of reservations) {
            if (r.status === 'storniert') continue;
            const d    = dateStr(r.date);
            const time = r.time.replace(':', '') + '00';
            const endH = (parseInt(r.time.split(':')[0]) + 2).toString().padStart(2, '0');
            const endT = endH + r.time.split(':')[1] + '00';
            const desc = `${r.guests} Personen${r.table ? ' – Tisch ' + r.table : ''}`;
            events.push(buildEvent({
                uid: `res-${r.id}@barmanager.app`,
                dtstart: `${d}T${time}`,
                dtend:   `${d}T${endT}`,
                summary: `🪑 Reservierung (${r.guests} Pers.)`,
                description: desc,
                // NOTE: customer_name intentionally omitted — GDPR / data minimisation
            }));
        }

        // ── Birthdays: name + role only, no personal dates exposed directly ──
        const currentYear = new Date().getFullYear();
        for (const emp of employees) {
            if (!emp.birthday) continue;
            const mmdd = emp.birthday.slice(5).replace('-', '');
            events.push(buildEvent({
                uid: `birthday-${emp.id}@barmanager.app`,
                // We output the current year's occurrence; RRULE handles future years
                dtstart: `${currentYear}${mmdd}`,
                dtend:   `${currentYear}${mmdd}`,
                summary: `🎂 ${emp.name}`,
                allDay: true,
                transparent: true,
            }) + '\r\nRRULE:FREQ=YEARLY');
        }

        // ── Vacations: employee name + duration, no notes ─────────────────────
        for (const v of vacations) {
            const start   = dateStr(v.start_date);
            const endNext = new Date(v.end_date); endNext.setDate(endNext.getDate() + 1);
            const end     = endNext.toISOString().split('T')[0].replace(/-/g, '');
            events.push(buildEvent({
                uid: `vacation-${v.id}@barmanager.app`,
                dtstart: start,
                dtend:   end,
                summary: `🏖️ ${v.employee_name}${v.days_count ? ' (' + v.days_count + ' Tage)' : ''}`,
                allDay: true,
                transparent: true,
                // NOTE: vacation.notes omitted — may contain medical / personal context
            }));
        }

        // ── Team Meetings ─────────────────────────────────────────────────────
        for (const m of meetings) {
            const d = dateStr(m.date);
            const time = m.time.replace(':', '') + '00';
            const endH = (parseInt(m.time.split(':')[0]) + 2).toString().padStart(2, '0');
            const endT = endH + m.time.split(':')[1] + '00';
            events.push(buildEvent({
                uid: `meeting-${m.id}@barmanager.app`,
                dtstart: `${d}T${time}`,
                dtend:   `${d}T${endT}`,
                summary: `📋 Teamsitzung`,
                description: m.location ? `Ort: ${m.location}` : undefined,
            }));
        }

        // ── Holidays ──────────────────────────────────────────────────────────
        for (const h of holidays) {
            const d   = h.date.toISOString().split('T')[0].replace(/-/g, '');
            const end = new Date(h.date); end.setDate(end.getDate() + 1);
            const de  = end.toISOString().split('T')[0].replace(/-/g, '');
            events.push(buildEvent({
                uid: `holiday-${d}@barmanager.app`,
                dtstart: d, dtend: de,
                summary: `🎉 ${h.name}`,
                description: 'Gesetzlicher Feiertag in Baden-Württemberg',
                allDay: true, transparent: true,
            }));
        }

        const vtimezone = [
            'BEGIN:VTIMEZONE',
            'TZID:Europe/Berlin',
            'BEGIN:STANDARD',
            'DTSTART:19701025T030000',
            'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
            'TZOFFSETFROM:+0200',
            'TZOFFSETTO:+0100',
            'TZNAME:CET',
            'END:STANDARD',
            'BEGIN:DAYLIGHT',
            'DTSTART:19700329T020000',
            'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
            'TZOFFSETFROM:+0100',
            'TZOFFSETTO:+0200',
            'TZNAME:CEST',
            'END:DAYLIGHT',
            'END:VTIMEZONE',
        ].join('\r\n');

        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Bar Manager//Live Calendar//DE',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:Bar Management Live',
            'X-WR-TIMEZONE:Europe/Berlin',
            'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
            'X-PUBLISHED-TTL:PT15M',
            vtimezone,
            ...events,
            'END:VCALENDAR',
        ].join('\r\n');

        return new Response(ics, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'inline; filename="calendar.ics"',
                // SECURITY: private — must not be cached by CDNs or shared proxies
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            }
        });

    } catch (error) {
        console.error('Calendar feed error:', error);
        // SECURITY: No internal error details to client
        return new Response('Internal server error', { status: 500 });
    }
});