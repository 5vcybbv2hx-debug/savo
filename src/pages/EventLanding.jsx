/**
 * EventLanding — Öffentliche Event-Detailseite für Gäste
 * Auf diese Seite verweist der QR-Code auf dem TV-Display (nur wenn der
 * Manager im DisplayManager "Öffentliche Event-Seite & QR-Code" aktiviert hat).
 *
 * Gäste sehen: Titel, Datum/Uhrzeit, Ort, Beschreibung, Preise/CTA —
 * und können das Event per Klick im Kalender speichern (ICS-Download
 * oder Google Calendar). Plus Link zur öffentlichen Getränkekarte.
 */
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicBase44 } from '@/api/base44Client';
import { format, parseISO, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarPlus, MapPin, Clock, GlassWater, Loader2, Home } from 'lucide-react';

// ── ICS-Helfer ────────────────────────────────────────────────────────────────
const icsEscape = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

const buildICS = (ev) => {
    const allDay = !ev.event_time;
    const startBase = parseISO(ev.event_date + (allDay ? 'T00:00:00' : 'T' + ev.event_time + ':00'));
    const endBase = ev.event_end_date
        ? parseISO(ev.event_end_date + (allDay ? 'T00:00:00' : 'T' + (ev.event_end_time || ev.event_time) + ':00'))
        : startBase;

    const start = allDay
        ? format(startBase, 'yyyyMMdd')
        : format(startBase, "yyyyMMdd'T'HHmmss");
    const end = allDay
        ? format(addDays(endBase, 1), 'yyyyMMdd')
        : format(endBase, "yyyyMMdd'T'HHmmss");

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SAVO Lounge Club//Event//DE',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:savo-event-${ev.event_date}-${(ev.title || '').slice(0, 12).replace(/\W/g, '')}@savo`,
        `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss")}`,
        `DTSTART${allDay ? ';VALUE=DATE' : ''}:${start}`,
        `DTEND${allDay ? ';VALUE=DATE' : ''}:${end}`,
        `SUMMARY:${icsEscape(ev.title)}`,
    ];
    if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
    const details = [ev.subtitle, ev.description].filter(Boolean).join('\n');
    if (details) lines.push(`DESCRIPTION:${icsEscape(details)}`);
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n');
};

const downloadICS = (ev) => {
    const blob = new Blob([buildICS(ev)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (ev.title || 'Event').replace(/[^\w\- äöüÄÖÜß]/g, '').trim().replace(/\s+/g, '_') + '.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const gcalUrl = (ev) => {
    const params = new URLSearchParams({ action: 'TEMPLATE', ctz: 'Europe/Berlin', text: ev.title || 'Event' });
    if (ev.location) params.set('location', ev.location);
    const details = [ev.subtitle, ev.description].filter(Boolean).join('\n');
    if (details) params.set('details', details);
    if (ev.event_date) {
        const allDay = !ev.event_time;
        const s = parseISO(ev.event_date + (allDay ? 'T00:00:00' : 'T' + ev.event_time + ':00'));
        const e = ev.event_end_date
            ? parseISO(ev.event_end_date + (allDay ? 'T00:00:00' : 'T' + (ev.event_end_time || ev.event_time) + ':00'))
            : s;
        const f = (d) => allDay ? format(d, 'yyyyMMdd') : format(d, "yyyyMMdd'T'HHmmss");
        params.set('dates', `${f(s)}/${f(allDay ? addDays(e, 1) : e)}`);
    }
    return 'https://calendar.google.com/calendar/render?' + params.toString();
};

// ── Datums-Ansicht ────────────────────────────────────────────────────────────
function EventDate({ ev }) {
    if (!ev.event_date) return null;
    let startStr = '', endStr = '', timeStr = '';
    try {
        startStr = format(parseISO(ev.event_date), 'EEEE, d. MMMM yyyy', { locale: de });
        if (ev.event_end_date && ev.event_end_date !== ev.event_date) {
            endStr = format(parseISO(ev.event_end_date), 'EEEE, d. MMMM yyyy', { locale: de });
        }
        if (ev.event_time) {
            timeStr = ev.event_time + (ev.event_end_time ? ' – ' + ev.event_end_time : '') + ' Uhr';
        }
    } catch { return null; }

    return (
        <div className="w-full bg-black/40 border border-amber-500/25 rounded-2xl p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-500 text-xs font-bold tracking-[0.18em] uppercase">
                <CalendarPlus className="w-4 h-4" /> Termin
            </div>
            <p className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {startStr}{endStr && <span className="text-white/50"> — {endStr}</span>}
            </p>
            {timeStr && (
                <p className="flex items-center gap-2 text-lg sm:text-xl font-bold text-amber-400">
                    <Clock className="w-5 h-5" /> {timeStr}
                </p>
            )}
            {ev.location && (
                <p className="flex items-center gap-2 text-base font-semibold text-white/80">
                    <MapPin className="w-5 h-5 text-amber-500 shrink-0" /> {ev.location}
                </p>
            )}
        </div>
    );
}

// ── Hauptseite ────────────────────────────────────────────────────────────────
export default function EventLanding() {
    const { id } = useParams();

    const { data, isLoading } = useQuery({
        queryKey: ['public-event', id],
        queryFn: async () => {
            const res = await publicBase44.functions.invoke('getPublicEvent', { id });
            return res.data || res;
        },
        staleTime: 60 * 1000,
        retry: 1,
    });

    const ev = data?.found ? data.event : null;

    return (
        <div className="min-h-screen bg-[#0c0a09] text-white" style={{
            backgroundImage: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(245,158,11,0.14) 0%, transparent 60%)',
        }}>
            <div className="max-w-lg mx-auto px-4 py-8 sm:py-12 space-y-6">

                {/* Brand */}
                <div className="text-center">
                    <Link to="/PublicDrinkMenu" className="inline-flex items-center gap-2 text-amber-500 hover:text-amber-400 transition-colors">
                        <span className="text-lg font-black tracking-[0.28em] uppercase">SAVO Lounge Club</span>
                    </Link>
                </div>

                {isLoading ? (
                    <div className="py-24 flex flex-col items-center gap-3 text-white/50">
                        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                        <p className="text-sm">Event wird geladen…</p>
                    </div>
                ) : !ev ? (
                    <div className="py-16 text-center space-y-4">
                        <p className="text-6xl">🍸</p>
                        <p className="text-2xl font-black text-white">Event nicht gefunden</p>
                        <p className="text-sm text-white/50">
                            Dieses Event ist nicht mehr verfügbar oder wurde noch nicht freigegeben.
                        </p>
                        <Link to="/PublicDrinkMenu"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors">
                            <GlassWater className="w-4 h-4" /> Zur Getränkekarte
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Event-Karte */}
                        <div className="rounded-3xl border border-amber-500/25 bg-gradient-to-b from-amber-500/10 to-transparent overflow-hidden">
                            <div className="px-6 sm:px-8 py-8 sm:py-10 space-y-4">
                                <div className="inline-flex items-center px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30">
                                    <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-amber-500">
                                        {ev.slide_type === 'countdown' ? 'Kommt bald' : 'Event'}
                                    </span>
                                </div>
                                <h1 className="text-4xl sm:text-5xl font-black leading-[1.05] tracking-tight text-white"
                                    style={{ textShadow: '0 2px 30px rgba(245,158,11,0.25)' }}>
                                    {ev.title}
                                </h1>
                                {ev.subtitle && (
                                    <p className="text-lg text-white/70 font-medium">{ev.subtitle}</p>
                                )}
                                {ev.price_info && (
                                    <p className="text-amber-400 font-black text-xl">{ev.price_info}</p>
                                )}
                            </div>
                        </div>

                        {/* Termin */}
                        <EventDate ev={ev} />

                        {/* Beschreibung */}
                        {ev.description && (
                            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 sm:p-6">
                                <p className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap">{ev.description}</p>
                            </div>
                        )}

                        {/* CTA */}
                        {ev.cta_text && (
                            <div className="text-center px-4 py-4 rounded-2xl bg-amber-500 text-black font-black text-lg">
                                {ev.cta_text}
                            </div>
                        )}

                        {/* Kalender + Getränke */}
                        <div className="space-y-3">
                            <button onClick={() => downloadICS(ev)}
                                className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-black text-base transition-colors shadow-lg shadow-amber-500/20">
                                <CalendarPlus className="w-5 h-5" />
                                In meinem Kalender speichern
                            </button>
                            <a href={gcalUrl(ev)} target="_blank" rel="noopener noreferrer"
                                className="block text-center text-sm text-white/60 hover:text-amber-400 transition-colors py-1">
                                …oder zu Google Kalender hinzufügen
                            </a>
                            <Link to="/PublicDrinkMenu"
                                className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 text-white font-bold text-base transition-colors">
                                <GlassWater className="w-5 h-5 text-amber-500" />
                                Getränkekarte ansehen
                            </Link>
                        </div>
                    </>
                )}

                {/* Footer */}
                <p className="text-center text-xs text-white/30 pt-4 pb-2">
                    SAVO Lounge Club · Wir freuen uns auf dich
                </p>
            </div>
        </div>
    );
}