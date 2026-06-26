/**
 * Display — Vollbild-Slideshow für Bar-TV
 * Öffne diese Seite im Browser-Vollbild (F11)
 * Quellen: DisplaySlide (manuell) + Events + WeeklySpecials (automatisch)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays, differenceInHours, parseISO, isAfter, isBefore } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ── Accent-Farb-Map ───────────────────────────────────────────────────────────
const ACCENTS = {
  amber:  { bg: '#f59e0b', glow: 'rgba(245,158,11,0.4)',  text: '#fff', soft: 'rgba(245,158,11,0.12)' },
  blue:   { bg: '#3b82f6', glow: 'rgba(59,130,246,0.4)',  text: '#fff', soft: 'rgba(59,130,246,0.12)' },
  green:  { bg: '#22c55e', glow: 'rgba(34,197,94,0.4)',   text: '#fff', soft: 'rgba(34,197,94,0.12)'  },
  red:    { bg: '#ef4444', glow: 'rgba(239,68,68,0.4)',   text: '#fff', soft: 'rgba(239,68,68,0.12)'  },
  purple: { bg: '#a855f7', glow: 'rgba(168,85,247,0.4)',  text: '#fff', soft: 'rgba(168,85,247,0.12)' },
  pink:   { bg: '#ec4899', glow: 'rgba(236,72,153,0.4)',  text: '#fff', soft: 'rgba(236,72,153,0.12)' },
  cyan:   { bg: '#06b6d4', glow: 'rgba(6,182,212,0.4)',   text: '#fff', soft: 'rgba(6,182,212,0.12)'  },
};

// ── Uhr ───────────────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right">
      <div style={{ fontSize: '3.2rem', fontWeight: 700, lineHeight: 1, color: '#fff', letterSpacing: '-0.02em' }}>
        {format(time, 'HH:mm')}
      </div>
      <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
        {format(time, 'EEEE, d. MMMM', { locale: de })}
      </div>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ duration, color, running }) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    setProgress(0);
    startRef.current = Date.now();
    if (!running) return;
    const raf = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      setProgress(Math.min(elapsed / duration, 1));
    }, 50);
    return () => clearInterval(raf);
  }, [duration, running]);

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.1)' }}>
      <div style={{
        height: '100%',
        width: `${progress * 100}%`,
        background: color,
        boxShadow: `0 0 8px ${color}`,
        transition: 'width 0.05s linear',
        borderRadius: '0 2px 2px 0',
      }} />
    </div>
  );
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function CountdownBadge({ dateStr, color }) {
  if (!dateStr) return null;
  const target = parseISO(dateStr);
  const now = new Date();
  const days = differenceInDays(target, now);
  const hours = differenceInHours(target, now) % 24;

  if (days < 0) return null;
  if (days === 0) return (
    <div style={{ background: color, color: '#fff', borderRadius: 12, padding: '8px 20px', fontWeight: 800, fontSize: '1.1rem', display: 'inline-block' }}>
      HEUTE! {hours > 0 ? `in ${hours}h` : 'jetzt'}
    </div>
  );
  return (
    <div style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${color}`, borderRadius: 12, padding: '8px 20px', display: 'inline-flex', gap: 16, alignItems: 'center' }}>
      <span style={{ color: '#fff', fontWeight: 800, fontSize: '2rem', lineHeight: 1 }}>{days}</span>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Tage<br/>noch</span>
      {hours > 0 && <>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: '2rem', lineHeight: 1 }}>{hours}</span>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Std.<br/>noch</span>
      </>}
    </div>
  );
}

// ── Slide: Announcement / Default ────────────────────────────────────────────
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
        {slide.subtitle && (
          <div style={{ fontSize: '1.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 400, marginBottom: 24 }}>
            {slide.subtitle}
          </div>
        )}
        {slide.body_text && (
          <div style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.5)', maxWidth: 700, margin: '0 auto' }}>
            {slide.body_text}
          </div>
        )}
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
  return (
    <div style={{ display: 'grid', gridTemplateColumns: slide.image_url ? '1fr 1fr' : '1fr', height: '100%' }}>
      {slide.image_url && (
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <img src={slide.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0) 60%, #0a0a0a)' }} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 80px 80px 60px', gap: 28 }}>
        <div style={{ background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8, padding: '6px 16px', display: 'inline-flex', width: 'fit-content', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Event</span>
        </div>
        <div>
          <div style={{ fontSize: '3.8rem', fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 16 }}>
            {slide.title}
          </div>
          {slide.subtitle && (
            <div style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.65)' }}>{slide.subtitle}</div>
          )}
        </div>
        {(slide.event_date || slide.event_time) && (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {slide.event_date && (
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 20px', color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>
                📅 {format(parseISO(slide.event_date), 'EEEE, d. MMMM', { locale: de })}
              </div>
            )}
            {slide.event_time && (
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 20px', color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>
                🕐 {slide.event_time} Uhr
              </div>
            )}
          </div>
        )}
        {slide.event_date && <CountdownBadge dateStr={slide.event_date} color={accent.bg} />}
        {slide.cta_text && (
          <div style={{ background: accent.bg, color: accent.text, padding: '14px 36px', borderRadius: 14, fontWeight: 800, fontSize: '1.2rem', display: 'inline-block', width: 'fit-content', boxShadow: `0 0 25px ${accent.glow}` }}>
            {slide.cta_text}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Slide: Drink Special ──────────────────────────────────────────────────────
function SlideDrinkSpecial({ slide, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '80px 120px', textAlign: 'center', gap: 36 }}>
      <div style={{ fontSize: '5rem', marginBottom: -16 }}>🍹</div>
      <div style={{ background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8, padding: '6px 20px', display: 'inline-block' }}>
        <span style={{ fontSize: '0.8rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Drink Special</span>
      </div>
      <div>
        <div style={{ fontSize: '5rem', fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em', textShadow: `0 0 60px ${accent.glow}`, marginBottom: 16 }}>
          {slide.title}
        </div>
        {slide.subtitle && (
          <div style={{ fontSize: '1.6rem', color: 'rgba(255,255,255,0.65)' }}>{slide.subtitle}</div>
        )}
        {slide.body_text && (
          <div style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.45)', marginTop: 16, maxWidth: 600, margin: '16px auto 0' }}>
            {slide.body_text}
          </div>
        )}
      </div>
      {slide.price_info && (
        <div style={{ background: accent.bg, color: accent.text, padding: '20px 60px', borderRadius: 20, fontWeight: 900, fontSize: '2.4rem', boxShadow: `0 0 50px ${accent.glow}`, letterSpacing: '-0.02em' }}>
          {slide.price_info}
        </div>
      )}
      {slide.cta_text && !slide.price_info && (
        <div style={{ color: accent.bg, fontWeight: 700, fontSize: '1.3rem' }}>{slide.cta_text}</div>
      )}
    </div>
  );
}

// ── Slide: Image Only ─────────────────────────────────────────────────────────
function SlideImageOnly({ slide, accent }) {
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {slide.image_url && (
        <img src={slide.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {(slide.title || slide.cta_text) && (
        <div style={{ position: 'absolute', bottom: 60, left: 80, right: 80 }}>
          {slide.title && (
            <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.8)', marginBottom: 12 }}>
              {slide.title}
            </div>
          )}
          {slide.cta_text && (
            <div style={{ background: accent.bg, color: accent.text, padding: '12px 32px', borderRadius: 12, fontWeight: 700, fontSize: '1.2rem', display: 'inline-block', boxShadow: `0 0 25px ${accent.glow}` }}>
              {slide.cta_text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Slide Router ──────────────────────────────────────────────────────────────
function SlideContent({ slide, accent }) {
  switch (slide.slide_type) {
    case 'event':         return <SlideEvent slide={slide} accent={accent} />;
    case 'drink_special': return <SlideDrinkSpecial slide={slide} accent={accent} />;
    case 'image_only':    return <SlideImageOnly slide={slide} accent={accent} />;
    default:              return <SlideAnnouncement slide={slide} accent={accent} />;
  }
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function Display() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [animating, setAnimating]   = useState(false);
  const [visible, setVisible]       = useState(true);
  const timerRef = useRef(null);

  // Queries
  const { data: manualSlides = [] } = useQuery({
    queryKey: ['display-slides'],
    queryFn:  () => base44.entities.DisplaySlide.filter({ is_active: true }),
    refetchInterval: 60_000, // jede Minute neu laden
    staleTime: 30_000,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['display-events'],
    queryFn:  () => base44.entities.Event.list('event_date', 20),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  const { data: specials = [] } = useQuery({
    queryKey: ['display-specials'],
    queryFn:  () => base44.entities.WeeklySpecial.filter({ is_active: true }),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  const { data: companyInfo = [] } = useQuery({
    queryKey: ['company-info'],
    queryFn:  () => base44.entities.CompanyInfo.list(),
    staleTime: 600_000,
  });

  const company = companyInfo[0];

  // Alle Slides zusammenbauen
  const allSlides = (() => {
    const now = new Date();
    const slides = [];

    // 1. Manuelle Slides (gefiltert nach Zeitfenster)
    manualSlides
      .filter(s => {
        if (s.show_from  && isBefore(now, parseISO(s.show_from)))  return false;
        if (s.show_until && isAfter(now,  parseISO(s.show_until))) return false;
        return true;
      })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .forEach(s => slides.push(s));

    // 2. Kommende Events (nur zukünftige, max 5)
    events
      .filter(e => e.event_date && isAfter(parseISO(e.event_date), now))
      .slice(0, 5)
      .forEach(e => slides.push({
        id:           `event-${e.id}`,
        slide_type:   'event',
        title:        e.title || e.name,
        subtitle:     e.description || e.subtitle || '',
        event_date:   e.event_date,
        event_time:   e.start_time || e.event_time || '',
        image_url:    e.image_url || e.cover_image || '',
        accent_color: 'blue',
        duration_seconds: 10,
        cta_text:     'Seid dabei!',
      }));

    // 3. Aktive Drink Specials
    specials.slice(0, 3).forEach(s => slides.push({
      id:           `special-${s.id}`,
      slide_type:   'drink_special',
      title:        s.name || s.title,
      subtitle:     s.description || '',
      price_info:   s.special_price ? `${s.special_price} €` : s.price_display || '',
      accent_color: 'amber',
      duration_seconds: 8,
    }));

    return slides;
  })();

  const currentSlide = allSlides[currentIdx] || null;
  const accent = ACCENTS[currentSlide?.accent_color || 'amber'];
  const duration = currentSlide?.duration_seconds || 8;

  // Auto-Advance
  const advance = useCallback(() => {
    if (allSlides.length <= 1) return;
    setAnimating(true);
    setVisible(false);
    setTimeout(() => {
      setCurrentIdx(i => (i + 1) % allSlides.length);
      setVisible(true);
      setAnimating(false);
    }, 600);
  }, [allSlides.length]);

  useEffect(() => {
    if (!currentSlide) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(advance, duration * 1000);
    return () => clearTimeout(timerRef.current);
  }, [currentIdx, duration, advance, currentSlide]);

  // Keine Slides
  if (allSlides.length === 0) {
    return (
      <div style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
        {company?.logo_url && (
          <img src={company.logo_url} alt="Logo" style={{ height: 80, objectFit: 'contain', opacity: 0.6 }} />
        )}
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '1.2rem' }}>Keine aktiven Slides</p>
        <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.85rem' }}>Slides im Manager-Bereich anlegen</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', position: 'relative', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Hintergrund-Glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${accent.glow} 0%, transparent 60%)`,
        transition: 'background 1.2s ease',
      }} />

      {/* Top Bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {company?.logo_url
            ? <img src={company.logo_url} alt="Logo" style={{ height: 44, objectFit: 'contain' }} />
            : <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.4rem', opacity: 0.9 }}>{company?.name || ''}</div>
          }
        </div>
        <Clock />
      </div>

      {/* Slide Inhalt */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        {currentSlide && <SlideContent slide={currentSlide} accent={accent} />}
      </div>

      {/* Bottom Bar: Dots + Progress */}
      <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, zIndex: 10, display: 'flex', justifyContent: 'center', gap: 8 }}>
        {allSlides.map((_, i) => (
          <button key={i} onClick={() => { setCurrentIdx(i); setVisible(true); }}
            style={{
              width: i === currentIdx ? 28 : 8, height: 8, borderRadius: 4,
              background: i === currentIdx ? accent.bg : 'rgba(255,255,255,0.2)',
              border: 'none', cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Progress Bar */}
      <ProgressBar duration={duration} color={accent.bg} running={!animating} key={currentIdx} />
    </div>
  );
}
