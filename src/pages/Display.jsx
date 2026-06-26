/**
 * Display.jsx — Vollbild-Slideshow für Bar-TV
 * v2: Countdown zentriert, Mehrtages-Events, Ort-Anzeige,
 *     Mehrere Drink-Specials, Auto-Skip abgelaufener Slides
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInSeconds, differenceInDays, differenceInHours, differenceInMinutes, parseISO, isAfter, isBefore } from 'date-fns';
import { de } from 'date-fns/locale';

const ACCENTS = {
  amber:   { bg: '#f59e0b', glow: 'rgba(245,158,11,0.45)',  text: '#000', soft: 'rgba(245,158,11,0.14)' },
  orange:  { bg: '#f97316', glow: 'rgba(249,115,22,0.45)',  text: '#000', soft: 'rgba(249,115,22,0.14)' },
  red:     { bg: '#ef4444', glow: 'rgba(239,68,68,0.45)',   text: '#fff', soft: 'rgba(239,68,68,0.14)'  },
  rose:    { bg: '#f43f5e', glow: 'rgba(244,63,94,0.45)',   text: '#fff', soft: 'rgba(244,63,94,0.14)'  },
  pink:    { bg: '#ec4899', glow: 'rgba(236,72,153,0.45)',  text: '#fff', soft: 'rgba(236,72,153,0.14)' },
  fuchsia: { bg: '#d946ef', glow: 'rgba(217,70,239,0.45)',  text: '#fff', soft: 'rgba(217,70,239,0.14)' },
  purple:  { bg: '#a855f7', glow: 'rgba(168,85,247,0.45)',  text: '#fff', soft: 'rgba(168,85,247,0.14)' },
  violet:  { bg: '#7c3aed', glow: 'rgba(124,58,237,0.45)',  text: '#fff', soft: 'rgba(124,58,237,0.14)' },
  indigo:  { bg: '#6366f1', glow: 'rgba(99,102,241,0.45)',  text: '#fff', soft: 'rgba(99,102,241,0.14)' },
  blue:    { bg: '#3b82f6', glow: 'rgba(59,130,246,0.45)',  text: '#fff', soft: 'rgba(59,130,246,0.14)' },
  sky:     { bg: '#0ea5e9', glow: 'rgba(14,165,233,0.45)',  text: '#fff', soft: 'rgba(14,165,233,0.14)' },
  cyan:    { bg: '#06b6d4', glow: 'rgba(6,182,212,0.45)',   text: '#fff', soft: 'rgba(6,182,212,0.14)'  },
  teal:    { bg: '#14b8a6', glow: 'rgba(20,184,166,0.45)',  text: '#fff', soft: 'rgba(20,184,166,0.14)' },
  green:   { bg: '#22c55e', glow: 'rgba(34,197,94,0.45)',   text: '#000', soft: 'rgba(34,197,94,0.14)'  },
  lime:    { bg: '#84cc16', glow: 'rgba(132,204,22,0.45)',  text: '#000', soft: 'rgba(132,204,22,0.14)' },
  white:   { bg: '#f8fafc', glow: 'rgba(248,250,252,0.35)', text: '#000', soft: 'rgba(248,250,252,0.10)' },
};

// ── Uhr ───────────────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1, color: '#fff', letterSpacing: '-0.02em' }}>
        {format(time, 'HH:mm')}
      </div>
      <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
        {format(time, 'EEEE, d. MMMM', { locale: de })}
      </div>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ duration, color, key: _key }) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef(Date.now());
  useEffect(() => {
    setProgress(0);
    startRef.current = Date.now();
    const iv = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      setProgress(Math.min(elapsed / duration, 1));
    }, 50);
    return () => clearInterval(iv);
  }, [duration, _key]);
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, background: 'rgba(255,255,255,0.08)' }}>
      <div style={{ height: '100%', width: `${progress * 100}%`, background: color,
        boxShadow: `0 0 10px ${color}`, transition: 'width 0.05s linear', borderRadius: '0 3px 3px 0' }} />
    </div>
  );
}

// ── Countdown (ZENTRIERT, live) ───────────────────────────────────────────────
function CountdownSlide({ slide, accent }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!slide.event_date) return null;
  const target = parseISO(slide.event_date + (slide.event_time ? 'T' + slide.event_time : 'T00:00:00'));
  const totalSec = differenceInSeconds(target, now);

  if (totalSec < 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 32, textAlign: 'center' }}>
      <div style={{ fontSize: '5rem' }}>🎉</div>
      <div style={{ fontSize: '4rem', fontWeight: 900, color: accent.bg, textShadow: `0 0 60px ${accent.glow}` }}>ES IST SOWEIT!</div>
      <div style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{slide.title}</div>
    </div>
  );

  const days  = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);
  const secs  = totalSec % 60;

  const units = days > 0
    ? [{ v: days, l: 'Tage' }, { v: hours, l: 'Std.' }, { v: mins, l: 'Min.' }]
    : [{ v: hours, l: 'Std.' }, { v: mins, l: 'Min.' }, { v: secs, l: 'Sek.' }];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 40, textAlign: 'center', padding: '60px 80px' }}>
      {/* Label */}
      <div style={{ background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8, padding: '6px 24px', display: 'inline-block' }}>
        <span style={{ fontSize: '0.85rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Countdown</span>
      </div>

      {/* Titel */}
      <div style={{ fontSize: '3.8rem', fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.02em', textShadow: '0 2px 40px rgba(0,0,0,0.5)' }}>
        {slide.title}
      </div>

      {/* Countdown-Kacheln */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center' }}>
        {units.map((u, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              border: `2px solid ${accent.bg}`,
              borderRadius: 20,
              padding: '24px 36px',
              minWidth: 130,
              boxShadow: `0 0 40px ${accent.glow}`,
            }}>
              <div style={{ fontSize: '5rem', fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                {String(u.v).padStart(2, '0')}
              </div>
              <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', marginTop: 8, fontWeight: 600 }}>{u.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Datum / Zeit / Ort */}
      {(slide.event_date || slide.event_time || slide.location) && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {slide.event_date && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 22px', color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>
              📅 {format(parseISO(slide.event_date), 'EEEE, d. MMMM yyyy', { locale: de })}
            </div>
          )}
          {slide.event_time && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 22px', color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>
              🕐 {slide.event_time} Uhr
            </div>
          )}
          {slide.location && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 22px', color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>
              📍 {slide.location}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Slide: Announcement ───────────────────────────────────────────────────────
function SlideAnnouncement({ slide, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '80px 120px', textAlign: 'center', gap: 32 }}>
      {slide.image_url && (
        <div style={{ width: 160, height: 160, borderRadius: 24, overflow: 'hidden', border: `3px solid ${accent.bg}`, boxShadow: `0 0 40px ${accent.glow}` }}>
          <img src={slide.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div>
        <div style={{ fontSize: '4.5rem', fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.03em', textShadow: '0 2px 40px rgba(0,0,0,0.5)', marginBottom: 20 }}>
          {slide.title}
        </div>
        {slide.subtitle && <div style={{ fontSize: '1.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: 24 }}>{slide.subtitle}</div>}
        {slide.body_text && <div style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.5)', maxWidth: 700, margin: '0 auto' }}>{slide.body_text}</div>}
      </div>
      {slide.cta_text && (
        <div style={{ background: accent.bg, color: accent.text, padding: '16px 48px', borderRadius: 16, fontWeight: 800, fontSize: '1.4rem', boxShadow: `0 0 30px ${accent.glow}` }}>
          {slide.cta_text}
        </div>
      )}
    </div>
  );
}

// ── Slide: Event ──────────────────────────────────────────────────────────────
function SlideEvent({ slide, accent }) {
  const hasEndDate = slide.event_end_date && slide.event_end_date !== slide.event_date;
  const dateStr = slide.event_date ? format(parseISO(slide.event_date), 'EEEE, d. MMMM', { locale: de }) : '';
  const endDateStr = hasEndDate ? format(parseISO(slide.event_end_date), 'd. MMMM', { locale: de }) : '';
  const timeStr = [slide.event_time, slide.event_end_time].filter(Boolean).join(' – ') + (slide.event_time ? ' Uhr' : '');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: slide.image_url ? '1fr 1fr' : '1fr', height: '100%' }}>
      {slide.image_url && (
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <img src={slide.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0) 60%, #0a0a0a)' }} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 80px 80px 60px', gap: 28 }}>
        <div style={{ background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8, padding: '6px 16px', width: 'fit-content' }}>
          <span style={{ fontSize: '0.75rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Event</span>
        </div>
        <div>
          <div style={{ fontSize: '3.8rem', fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 16 }}>{slide.title}</div>
          {slide.subtitle && <div style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.65)' }}>{slide.subtitle}</div>}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {slide.event_date && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 20px', color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>
              📅 {hasEndDate ? `${dateStr} – ${endDateStr}` : dateStr}
            </div>
          )}
          {slide.event_time && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 20px', color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>
              🕐 {timeStr}
            </div>
          )}
          {slide.location && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 20px', color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>
              📍 {slide.location}
            </div>
          )}
        </div>
        {slide.cta_text && (
          <div style={{ background: accent.bg, color: accent.text, padding: '14px 36px', borderRadius: 14, fontWeight: 800, fontSize: '1.2rem', display: 'inline-block', width: 'fit-content', boxShadow: `0 0 25px ${accent.glow}` }}>
            {slide.cta_text}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Slide: Drink Special (Mehrere Getränke) ───────────────────────────────────
function SlideDrinkSpecial({ slide, accent }) {
  let drinks = [];
  if (slide.body_text) {
    try { drinks = JSON.parse(slide.body_text); } catch {}
  }
  // Fallback: Altes Format (einzelnes Getränk)
  if (!drinks.length) {
    drinks = [{ name: slide.title, price: slide.price_info, emoji: '🍹' }];
  }

  const isGrid = drinks.length > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '60px 80px', textAlign: 'center', gap: 28 }}>
      {/* Label */}
      <div style={{ background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8, padding: '6px 20px' }}>
        <span style={{ fontSize: '0.8rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Drink Special</span>
      </div>

      {/* Titel (nur wenn nicht alle Getränke einzeln angezeigt werden) */}
      {slide.title && (
        <div style={{ fontSize: drinks.length === 1 ? '4.5rem' : '2.8rem', fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.03em', textShadow: `0 0 60px ${accent.glow}` }}>
          {slide.title}
        </div>
      )}

      {/* Getränke-Kacheln */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
        {drinks.filter(d => d.name).map((dr, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.06)',
            border: `2px solid ${accent.bg}44`,
            borderRadius: 20,
            padding: '28px 40px',
            textAlign: 'center',
            minWidth: 180,
            flex: drinks.length > 2 ? '1 1 180px' : 'none',
            maxWidth: drinks.length === 1 ? 400 : 280,
            boxShadow: `inset 0 0 40px ${accent.glow}22`,
          }}>
            <div style={{ fontSize: drinks.length === 1 ? '4rem' : '3rem', marginBottom: 12 }}>{dr.emoji || '🍹'}</div>
            <div style={{ fontSize: drinks.length === 1 ? '2rem' : '1.4rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 12 }}>{dr.name}</div>
            {dr.price && (
              <div style={{
                background: accent.bg,
                color: accent.text,
                padding: drinks.length === 1 ? '12px 32px' : '8px 20px',
                borderRadius: 12,
                fontWeight: 900,
                fontSize: drinks.length === 1 ? '2.4rem' : '1.6rem',
                display: 'inline-block',
                boxShadow: `0 0 20px ${accent.glow}`,
                letterSpacing: '-0.01em',
              }}>{dr.price}</div>
            )}
          </div>
        ))}
      </div>

      {slide.subtitle && (
        <div style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.55)' }}>{slide.subtitle}</div>
      )}
    </div>
  );
}

// ── Slide: Image Only ─────────────────────────────────────────────────────────
function SlideImageOnly({ slide }) {
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <img src={slide.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {slide.title && (
        <div style={{ position: 'absolute', bottom: 60, left: 80, right: 80 }}>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}>{slide.title}</div>
        </div>
      )}
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function Display() {
  const [idx, setIdx]     = useState(0);
  const [visible, setVisible] = useState(true);

  const { data: slides = [] } = useQuery({
    queryKey: ['display-slides'],
    queryFn: async () => {
      const now = new Date();
      const all = await base44.entities.DisplaySlide.list('sort_order', 100);
      return all.filter(s => {
        if (!s.is_active) return false;
        if (s.show_from  && isBefore(now, parseISO(s.show_from)))  return false;
        if (s.show_until && isAfter(now,  parseISO(s.show_until))) return false;
        return true;
      });
    },
    refetchInterval: 30000,
  });

  const sorted = [...slides].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  useEffect(() => {
    if (!sorted.length) return;
    const current = sorted[idx % sorted.length];
    const dur = (current?.duration_seconds || 8) * 1000;

    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % sorted.length);
        setVisible(true);
      }, 500);
    }, dur);
    return () => clearTimeout(t);
  }, [idx, sorted.length]);

  if (!sorted.length) return (
    <div style={{ background: '#0a0a0a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: '4rem' }}>📺</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.5rem', fontWeight: 600 }}>Keine aktiven Slides</div>
      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.9rem' }}>Erstelle Slides im Display-Manager</div>
    </div>
  );

  const slide  = sorted[idx % sorted.length];
  const accent = ACCENTS[slide.accent_color] || ACCENTS.amber;

  return (
    <div style={{ background: '#0a0a0a', height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}>

      {/* Hintergrund-Glow */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${accent.glow} 0%, transparent 70%)`, pointerEvents: 'none', transition: 'background 1s ease' }} />

      {/* Header: Logo + Uhr */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 48px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', opacity: 0.9 }}>
          <span style={{ color: accent.bg }}>●</span> QUI
        </div>
        <Clock />
      </div>

      {/* Slide-Inhalt */}
      <div style={{ position: 'absolute', inset: 0, opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease', paddingTop: '5rem' }}>
        {slide.slide_type === 'countdown'     && <CountdownSlide       slide={slide} accent={accent} />}
        {slide.slide_type === 'event'         && <SlideEvent           slide={slide} accent={accent} />}
        {slide.slide_type === 'drink_special' && <SlideDrinkSpecial    slide={slide} accent={accent} />}
        {slide.slide_type === 'image_only'    && <SlideImageOnly       slide={slide} />}
        {(!slide.slide_type || slide.slide_type === 'announcement') && <SlideAnnouncement slide={slide} accent={accent} />}
      </div>

      {/* Slide-Indikator */}
      <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 10 }}>
        {sorted.map((_, i) => (
          <div key={i} style={{ width: i === idx % sorted.length ? 24 : 6, height: 6, borderRadius: 3, background: i === idx % sorted.length ? accent.bg : 'rgba(255,255,255,0.2)', transition: 'all 0.3s ease', boxShadow: i === idx % sorted.length ? `0 0 8px ${accent.bg}` : 'none' }} />
        ))}
      </div>

      {/* Progress Bar */}
      <ProgressBar key={`${idx}-${slide.id}`} duration={slide.duration_seconds || 8} color={accent.bg} />
    </div>
  );
}
