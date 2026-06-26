/**
 * Display.jsx — Vollbild-Slideshow für Bar-TV
 * v3: Typ-spezifische CSS-Animationen (Partikel, Shimmer, Flip, Spotlight)
 */
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInSeconds, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

// ── Farb-Palette ──────────────────────────────────────────────────────────────
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

// ── Global CSS Keyframes (einmalig injiziert) ─────────────────────────────────
const KEYFRAMES = `
  @keyframes floatUp    { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-14px)} }
  @keyframes floatDown  { 0%,100%{transform:translateY(0)}   50%{transform:translateY(10px)}  }
  @keyframes pulseGlow  { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
  @keyframes shimmer    { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes slideInUp  { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideInLeft{ from{opacity:0;transform:translateX(-50px)} to{opacity:1;transform:translateX(0)} }
  @keyframes bounceIn   { 0%{opacity:0;transform:scale(0.7)} 60%{transform:scale(1.08)} 80%{transform:scale(0.96)} 100%{opacity:1;transform:scale(1)} }
  @keyframes flipIn     { 0%{opacity:0;transform:rotateX(90deg) translateY(-30px)} 60%{transform:rotateX(-8deg)} 100%{opacity:1;transform:rotateX(0)} }
  @keyframes spotlight  { 0%{transform:translateX(-110%) skewX(-15deg)} 100%{transform:translateX(310%) skewX(-15deg)} }
  @keyframes particleFly{ 0%{opacity:0;transform:translate(0,0) scale(0)} 20%{opacity:0.8} 100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(1.2)} }
  @keyframes ringPulse  { 0%{transform:scale(0.9);opacity:0.8} 50%{transform:scale(1.12);opacity:0.3} 100%{transform:scale(0.9);opacity:0.8} }
  @keyframes gentleRotate{0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
  @keyframes fadeInScale{ from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }
  @keyframes shimmerBar { 0%,100%{opacity:0.05} 50%{opacity:0.18} }
  @keyframes numberFlip { 0%{transform:translateY(-100%);opacity:0} 30%{transform:translateY(8%)} 100%{transform:translateY(0);opacity:1} }
  @keyframes drinkFloat { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-10px) rotate(1deg)} }
`;

function injectKeyframes() {
  if (document.getElementById('savo-display-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'savo-display-keyframes';
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

// ── Partikel-Hintergrund (Announcement) ──────────────────────────────────────
function Particles({ color, count = 18 }) {
  const particles = useRef(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 3 + Math.random() * 5,
      tx: (Math.random() - 0.5) * 300 + 'px',
      ty: -(80 + Math.random() * 200) + 'px',
      delay: Math.random() * 4,
      dur: 4 + Math.random() * 5,
    }))
  ).current;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: color,
          opacity: 0,
          '--tx': p.tx, '--ty': p.ty,
          animation: `particleFly ${p.dur}s ${p.delay}s ease-out infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Spotlight-Streak (Event) ──────────────────────────────────────────────────
function SpotlightStreak({ color }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          top: `${15 + i * 28}%`,
          left: 0,
          width: '35%',
          height: i === 1 ? 3 : 1.5,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: i === 1 ? 0.5 : 0.2,
          animation: `spotlight ${3.5 + i * 1.2}s ${i * 0.8}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Shimmer-Bars (Drink Special) ──────────────────────────────────────────────
function ShimmerBars({ color }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{
          position: 'absolute',
          left: 0, right: 0,
          top: `${20 + i * 20}%`,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
          animation: `shimmerBar ${2.5 + i * 0.6}s ${i * 0.4}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Puls-Ring (Countdown) ─────────────────────────────────────────────────────
function PulseRings({ color }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          width: 500 + i * 200,
          height: 500 + i * 200,
          borderRadius: '50%',
          border: `1px solid ${color}`,
          opacity: 0,
          animation: `ringPulse ${2.5 + i * 0.7}s ${i * 0.6}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

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
function ProgressBar({ duration, color, resetKey }) {
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
  }, [duration, resetKey]);
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, background: 'rgba(255,255,255,0.08)' }}>
      <div style={{ height: '100%', width: `${progress * 100}%`, background: color,
        boxShadow: `0 0 10px ${color}`, transition: 'width 0.05s linear', borderRadius: '0 3px 3px 0' }} />
    </div>
  );
}

// ── Slide: ANNOUNCEMENT ───────────────────────────────────────────────────────
function SlideAnnouncement({ slide, accent }) {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'center', height: '100%', padding: '80px 120px', textAlign: 'center', gap: 32 }}>
      <Particles color={accent.bg} />

      {/* Titel mit Float-Animation */}
      <div style={{
        fontSize: 'clamp(3rem,7vw,5.5rem)', fontWeight: 900, color: '#fff',
        lineHeight: 1.05, letterSpacing: '-0.03em', textShadow: `0 2px 40px rgba(0,0,0,0.5), 0 0 80px ${accent.glow}`,
        animation: 'floatUp 5s ease-in-out infinite',
        position: 'relative', zIndex: 1,
      }}>
        {slide.title}
      </div>

      {slide.subtitle && (
        <div style={{
          fontSize: '1.8rem', color: 'rgba(255,255,255,0.7)',
          animation: 'floatDown 6s ease-in-out infinite',
          position: 'relative', zIndex: 1,
        }}>
          {slide.subtitle}
        </div>
      )}
      {slide.body_text && (
        <div style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.45)', maxWidth: 700, position: 'relative', zIndex: 1 }}>
          {slide.body_text}
        </div>
      )}

      {slide.cta_text && (
        <div style={{
          background: accent.bg, color: accent.text, padding: '16px 48px',
          borderRadius: 16, fontWeight: 800, fontSize: '1.4rem',
          boxShadow: `0 0 30px ${accent.glow}`,
          animation: 'pulseGlow 3s ease-in-out infinite',
          position: 'relative', zIndex: 1,
        }}>
          {slide.cta_text}
        </div>
      )}
    </div>
  );
}

// ── Slide: EVENT ──────────────────────────────────────────────────────────────
function SlideEvent({ slide, accent }) {
  const hasEndDate = slide.event_end_date && slide.event_end_date !== slide.event_date;
  const dateStr = slide.event_date ? format(parseISO(slide.event_date), 'EEEE, d. MMMM', { locale: de }) : '';
  const endDateStr = hasEndDate ? format(parseISO(slide.event_end_date), 'd. MMMM', { locale: de }) : '';
  const timeStr = [slide.event_time, slide.event_end_time].filter(Boolean).join(' – ') + (slide.event_time ? ' Uhr' : '');

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'center', height: '100%', padding: '80px 120px', textAlign: 'center', gap: 36 }}>
      <SpotlightStreak color={accent.bg} />

      {/* Type Badge – einfliegen */}
      <div style={{
        background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8,
        padding: '6px 24px', display: 'inline-block', position: 'relative', zIndex: 1,
        animation: 'slideInUp 0.6s 0.1s both ease-out',
      }}>
        <span style={{ fontSize: '0.85rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          EVENT
        </span>
      </div>

      {/* Titel mit Shimmer-Text */}
      <div style={{
        fontSize: 'clamp(3rem,6.5vw,5rem)', fontWeight: 900, lineHeight: 1.05,
        letterSpacing: '-0.03em',
        background: `linear-gradient(90deg, #fff 0%, ${accent.bg} 40%, #fff 60%, ${accent.bg} 80%, #fff 100%)`,
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: 'shimmer 4s linear infinite, slideInUp 0.7s 0.2s both ease-out',
        position: 'relative', zIndex: 1,
      }}>
        {slide.title}
      </div>

      {slide.subtitle && (
        <div style={{
          fontSize: '1.8rem', color: 'rgba(255,255,255,0.65)',
          animation: 'slideInUp 0.7s 0.35s both ease-out',
          position: 'relative', zIndex: 1,
        }}>
          {slide.subtitle}
        </div>
      )}

      {/* Meta-Pills – von unten reinfliegen, gestaffelt */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        {dateStr && (
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 24px',
            fontWeight: 600, fontSize: '1.1rem', color: '#fff',
            animation: 'slideInUp 0.7s 0.5s both ease-out' }}>
            📅 {dateStr}{endDateStr ? ` – ${endDateStr}` : ''}
          </div>
        )}
        {timeStr && (
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 24px',
            fontWeight: 600, fontSize: '1.1rem', color: '#fff',
            animation: 'slideInUp 0.7s 0.65s both ease-out' }}>
            🕐 {timeStr}
          </div>
        )}
        {slide.location && (
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 24px',
            fontWeight: 600, fontSize: '1.1rem', color: '#fff',
            animation: 'slideInUp 0.7s 0.8s both ease-out' }}>
            📍 {slide.location}
          </div>
        )}
      </div>

      {slide.cta_text && (
        <div style={{
          background: accent.bg, color: accent.text, padding: '16px 48px',
          borderRadius: 16, fontWeight: 800, fontSize: '1.4rem',
          boxShadow: `0 0 30px ${accent.glow}`,
          animation: 'slideInUp 0.7s 0.95s both ease-out, pulseGlow 3s 1.8s ease-in-out infinite',
          position: 'relative', zIndex: 1,
        }}>
          {slide.cta_text}
        </div>
      )}
    </div>
  );
}

// ── Slide: DRINK SPECIAL ──────────────────────────────────────────────────────
function SlideDrinkSpecial({ slide, accent }) {
  let drinks = [];
  try { drinks = JSON.parse(slide.body_text || '[]'); } catch {}
  if (!drinks.length) {
    drinks = [{ name: slide.title, price: slide.price_info, emoji: '🍹' }];
  }
  const validDrinks = drinks.filter(d => d && d.name);

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'center', height: '100%', padding: '60px 80px', textAlign: 'center', gap: 32 }}>
      <ShimmerBars color={accent.bg} />

      {/* Badge */}
      <div style={{
        background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8,
        padding: '6px 24px', display: 'inline-block', position: 'relative', zIndex: 1,
        animation: 'fadeInScale 0.5s 0.1s both',
      }}>
        <span style={{ fontSize: '0.85rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          DRINK SPECIAL
        </span>
      </div>

      {/* Übertitel */}
      {slide.title && validDrinks.length > 1 && (
        <div style={{
          fontSize: 'clamp(2.5rem,5vw,4rem)', fontWeight: 900, color: '#fff',
          letterSpacing: '-0.03em', lineHeight: 1.05,
          animation: 'slideInUp 0.6s 0.2s both ease-out',
          position: 'relative', zIndex: 1,
        }}>
          {slide.title}
        </div>
      )}

      {/* Drink Cards */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', width: '100%', position: 'relative', zIndex: 1 }}>
        {validDrinks.map((d, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.06)',
            border: `2px solid ${accent.bg}44`,
            borderRadius: 24, padding: '28px 36px',
            textAlign: 'center', minWidth: 180, flex: '1 1 180px', maxWidth: 280,
            animation: `bounceIn 0.7s ${0.35 + i * 0.15}s both`,
          }}>
            {/* Float-Animation nur auf Emoji */}
            <div style={{ fontSize: '2.8rem', marginBottom: 12, display: 'inline-block',
              animation: `drinkFloat ${3.5 + i * 0.5}s ${i * 0.3}s ease-in-out infinite` }}>
              {d.emoji || '🍹'}
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>
              {d.name}
            </div>
            {d.price && (
              <div style={{
                display: 'inline-block', padding: '8px 20px', borderRadius: 12,
                background: accent.bg, color: accent.text, fontWeight: 900, fontSize: '1.5rem',
                boxShadow: `0 0 20px ${accent.glow}`,
                // Shimmer auf dem Preis
                backgroundImage: `linear-gradient(90deg, ${accent.bg} 0%, #fff6 40%, ${accent.bg} 60%, #fff6 80%, ${accent.bg} 100%)`,
                backgroundSize: '200% auto',
                animation: 'shimmer 3s linear infinite',
              }}>
                {d.price}
              </div>
            )}
          </div>
        ))}
      </div>

      {slide.subtitle && (
        <div style={{ fontSize: '1.3rem', color: 'rgba(255,255,255,0.55)', position: 'relative', zIndex: 1,
          animation: 'slideInUp 0.6s 0.9s both ease-out' }}>
          {slide.subtitle}
        </div>
      )}
    </div>
  );
}

// ── Slide: COUNTDOWN ─────────────────────────────────────────────────────────
function SlideCountdown({ slide, accent }) {
  const [now, setNow] = useState(new Date());
  const prevSecs = useRef({});

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!slide.event_date) return null;
  const target = parseISO(slide.event_date + (slide.event_time ? 'T' + slide.event_time : 'T00:00:00'));
  const totalSec = differenceInSeconds(target, now);

  if (totalSec < 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 32, textAlign: 'center' }}>
      <div style={{ fontSize: '5rem', animation: 'bounceIn 0.8s both' }}>🎉</div>
      <div style={{ fontSize: '4rem', fontWeight: 900, color: accent.bg,
        textShadow: `0 0 60px ${accent.glow}`, animation: 'pulseGlow 2s ease-in-out infinite' }}>
        ES IST SOWEIT!
      </div>
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
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: 40, textAlign: 'center', padding: '60px 80px' }}>
      <PulseRings color={accent.bg} />

      {/* Badge */}
      <div style={{ background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8,
        padding: '6px 24px', position: 'relative', zIndex: 1,
        animation: 'fadeInScale 0.5s 0.1s both' }}>
        <span style={{ fontSize: '0.85rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Countdown
        </span>
      </div>

      {/* Titel */}
      <div style={{ fontSize: '3.8rem', fontWeight: 900, color: '#fff', lineHeight: 1.05,
        letterSpacing: '-0.02em', textShadow: `0 2px 40px rgba(0,0,0,0.5)`,
        animation: 'slideInUp 0.6s 0.2s both ease-out', position: 'relative', zIndex: 1 }}>
        {slide.title}
      </div>

      {/* Kacheln mit Flip-Anim bei jeder Änderung */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        {units.map((u, i) => {
          const key = `${i}-${u.v}`;
          return (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{
                background: 'rgba(255,255,255,0.06)',
                border: `2px solid ${accent.bg}`,
                borderRadius: 20, padding: '24px 36px', minWidth: 130,
                boxShadow: `0 0 40px ${accent.glow}`,
                animation: `bounceIn 0.7s ${0.4 + i * 0.12}s both`,
                overflow: 'hidden', position: 'relative',
              }}>
                {/* Zahl mit Flip wenn sie sich ändert */}
                <div key={key} style={{
                  fontSize: '5rem', fontWeight: 900, color: '#fff', lineHeight: 1,
                  letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums',
                  animation: 'numberFlip 0.35s ease-out both',
                }}>
                  {String(u.v).padStart(2, '0')}
                </div>
                <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', marginTop: 8, fontWeight: 600 }}>
                  {u.l}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Meta Pills */}
      {(slide.event_date || slide.event_time || slide.location) && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          {slide.event_date && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 22px',
              color: '#fff', fontWeight: 600, fontSize: '1.1rem',
              animation: 'slideInUp 0.6s 0.8s both ease-out' }}>
              📅 {format(parseISO(slide.event_date), 'EEEE, d. MMMM yyyy', { locale: de })}
            </div>
          )}
          {slide.event_time && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 22px',
              color: '#fff', fontWeight: 600, fontSize: '1.1rem',
              animation: 'slideInUp 0.6s 0.95s both ease-out' }}>
              🕐 {slide.event_time} Uhr
            </div>
          )}
          {slide.location && (
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 22px',
              color: '#fff', fontWeight: 600, fontSize: '1.1rem',
              animation: 'slideInUp 0.6s 1.1s both ease-out' }}>
              📍 {slide.location}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dot-Navigation ────────────────────────────────────────────────────────────
function DotNav({ slides, currentIdx, accents }) {
  return (
    <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 8, zIndex: 20 }}>
      {slides.map((s, i) => {
        const a = accents[s.accent_color] || accents.amber;
        return (
          <div key={i} style={{
            height: 6, width: i === currentIdx ? 24 : 6, borderRadius: 3,
            background: i === currentIdx ? a.bg : 'rgba(255,255,255,0.2)',
            transition: 'all 0.3s ease',
            boxShadow: i === currentIdx ? `0 0 8px ${a.bg}` : 'none',
          }} />
        );
      })}
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function Display() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => { injectKeyframes(); }, []);

  const { data } = useQuery({
    queryKey: ['displaySlides'],
    queryFn: async () => {
      const res = await fetch('/functions/getDisplaySlides');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const json = await res.json();
      const now = new Date().toISOString();
      return (json.slides || [])
        .filter(s => {
          if (!s.is_active) return false;
          if (s.show_from  && now < s.show_from)  return false;
          if (s.show_until && now > s.show_until) return false;
          return true;
        })
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
    refetchInterval: 30000,
  });

  const slides = data || [];

  // Auto-Advance
  useEffect(() => {
    if (!slides.length) return;
    const dur = (slides[currentIdx]?.duration_seconds || 8) * 1000;
    timerRef.current = setTimeout(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIdx(i => (i + 1) % slides.length);
        setIsTransitioning(false);
      }, 500);
    }, dur);
    return () => clearTimeout(timerRef.current);
  }, [currentIdx, slides]);

  const slide = slides[currentIdx];
  const accent = slide ? (ACCENTS[slide.accent_color] || ACCENTS.amber) : ACCENTS.amber;

  if (!slide) return (
    <div style={{ background: '#0a0a0a', width: '100vw', height: '100vh', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <div style={{ fontSize: '3rem', opacity: 0.3 }}>📺</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.5rem', fontWeight: 600 }}>Keine aktiven Slides</div>
      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.9rem' }}>Erstelle Slides im Display-Manager</div>
    </div>
  );

  return (
    <div style={{ background: '#0a0a0a', width: '100vw', height: '100vh', overflow: 'hidden',
      position: 'relative', fontFamily: '"Inter", system-ui, sans-serif', color: '#fff' }}>

      {/* Ambient Glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${accent.glow} 0%, transparent 70%)`,
        transition: 'background 1s ease',
      }} />

      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '28px 48px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
      }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', opacity: 0.9 }}>
          <span style={{ color: accent.bg }}>●</span> SAVO
        </div>
        <Clock />
      </div>

      {/* Slide Content — mit Fade-Transition */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: isTransitioning ? 0 : 1,
        transition: 'opacity 0.5s ease',
      }}>
        {slide.slide_type === 'announcement' && <SlideAnnouncement slide={slide} accent={accent} />}
        {slide.slide_type === 'event'        && <SlideEvent        slide={slide} accent={accent} />}
        {slide.slide_type === 'drink_special'&& <SlideDrinkSpecial slide={slide} accent={accent} />}
        {slide.slide_type === 'countdown'    && <SlideCountdown    slide={slide} accent={accent} />}
      </div>

      {/* Dots */}
      {slides.length > 1 && <DotNav slides={slides} currentIdx={currentIdx} accents={ACCENTS} />}

      {/* Progress Bar */}
      <ProgressBar
        duration={slide.duration_seconds || 8}
        color={accent.bg}
        resetKey={currentIdx}
      />
    </div>
  );
}
