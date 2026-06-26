/**
 * Display.jsx — Vollbild-Slideshow für Bar-TV
 * v4: Titel-basierte thematische Hintergrund-Animationen (Flagge, Disco, Bubbles, Ball, Wellen, Feuerwerk...)
 */
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInSeconds, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';

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

// ── Keyframes ─────────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes floatUp     { 0%,100%{transform:translateY(0)}    50%{transform:translateY(-14px)} }
  @keyframes floatDown   { 0%,100%{transform:translateY(0)}    50%{transform:translateY(10px)}  }
  @keyframes pulseGlow   { 0%,100%{opacity:0.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
  @keyframes shimmer     { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes slideInUp   { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
  @keyframes bounceIn    { 0%{opacity:0;transform:scale(0.7)} 60%{transform:scale(1.08)} 80%{transform:scale(0.96)} 100%{opacity:1;transform:scale(1)} }
  @keyframes flipIn      { 0%{opacity:0;transform:rotateX(90deg) translateY(-30px)} 60%{transform:rotateX(-8deg)} 100%{opacity:1;transform:rotateX(0)} }
  @keyframes spotlight   { 0%{transform:translateX(-110%) skewX(-15deg)} 100%{transform:translateX(310%) skewX(-15deg)} }
  @keyframes particleFly { 0%{opacity:0;transform:translate(0,0) scale(0)} 20%{opacity:0.8} 100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(1.2)} }
  @keyframes ringPulse   { 0%{transform:scale(0.9);opacity:0.8} 50%{transform:scale(1.12);opacity:0.25} 100%{transform:scale(0.9);opacity:0.8} }
  @keyframes fadeInScale { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }
  @keyframes shimmerBar  { 0%,100%{opacity:0.05} 50%{opacity:0.18} }
  @keyframes numberFlip  { 0%{transform:translateY(-100%);opacity:0} 30%{transform:translateY(8%)} 100%{transform:translateY(0);opacity:1} }
  @keyframes drinkFloat  { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-10px) rotate(1deg)} }
  @keyframes flagWave    { 0%{transform:skewY(0deg) scaleX(1)}   25%{transform:skewY(1.5deg) scaleX(0.97)} 50%{transform:skewY(-1deg) scaleX(1.02)} 75%{transform:skewY(2deg) scaleX(0.98)} 100%{transform:skewY(0deg) scaleX(1)} }
  @keyframes bubbleRise  { 0%{transform:translateY(0) scale(1);opacity:0.7} 100%{transform:translateY(-110vh) scale(1.3);opacity:0} }
  @keyframes ballRoll    { 0%{transform:translateX(-8vw) rotate(0deg);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateX(108vw) rotate(720deg);opacity:0} }
  @keyframes discoBeam   { 0%{transform:rotate(0deg);opacity:0.7} 50%{opacity:0.15} 100%{transform:rotate(360deg);opacity:0.7} }
  @keyframes waveFlow    { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes firework    { 0%{transform:translate(0,0) scale(0);opacity:1} 80%{opacity:0.8} 100%{transform:translate(var(--fx),var(--fy)) scale(1);opacity:0} }
  @keyframes starBurst   { 0%{transform:scale(0) rotate(0);opacity:1} 100%{transform:scale(2.5) rotate(180deg);opacity:0} }
  @keyframes snowFall    { 0%{transform:translateY(-10px) translateX(0);opacity:0} 10%{opacity:0.8} 90%{opacity:0.6} 100%{transform:translateY(105vh) translateX(var(--sx));opacity:0} }
  @keyframes heartBeat   { 0%,100%{transform:scale(1)} 14%{transform:scale(1.2)} 28%{transform:scale(1)} 42%{transform:scale(1.15)} 70%{transform:scale(1)} }
  @keyframes musicWave   { 0%,100%{height:8px} 50%{height:var(--mh)} }
  @keyframes sunRay      { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
  @keyframes ghostFloat  { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-20px) rotate(3deg)} }
`;

function injectKeyframes() {
  if (document.getElementById('savo-kf')) return;
  const s = document.createElement('style');
  s.id = 'savo-kf';
  s.textContent = KEYFRAMES;
  document.head.appendChild(s);
}

// ── Titel-Analyzer ────────────────────────────────────────────────────────────
function detectTheme(title = '', subtitle = '') {
  const txt = (title + ' ' + subtitle).toLowerCase();
  if (/deutsch|germany|german|dfb|schwarz.?rot.?gold|bundesadler/.test(txt)) return 'germany';
  if (/österreich|austria|AUT/.test(txt)) return 'austria';
  if (/schweiz|switzerland|SUI/.test(txt)) return 'switzerland';
  if (/fußball|fussball|football|soccer|tor|bundesliga|champions|euro|wm|em|spiel|kick/.test(txt)) return 'football';
  if (/party|disco|club|dance|dj|rave|techno|house|elektronik/.test(txt)) return 'disco';
  if (/live.?music|konzert|concert|band|rock|jazz|acoustic|singer/.test(txt)) return 'music';
  if (/bier|beer|pils|weizen|craft|brau/.test(txt)) return 'beer';
  if (/cocktail|drink|aperol|spritz|mojito|gin|vodka|rum|sex.?on/.test(txt)) return 'cocktail';
  if (/sommer|summer|beach|strand|urlaub|ibiza|tropical|tiki/.test(txt)) return 'summer';
  if (/silvester|neujahr|new.?year|countdown|feuerwerk/.test(txt)) return 'fireworks';
  if (/halloween|horror|scary|zombie|geist|ghost/.test(txt)) return 'halloween';
  if (/weihnacht|christmas|xmas|advent|santa/.test(txt)) return 'christmas';
  if (/valentine|liebe|love|herz|heart/.test(txt)) return 'love';
  if (/pizza|burger|food|essen|brunch|bbq|grill/.test(txt)) return 'food';
  if (/single|ladies|women|girl/.test(txt)) return 'party';
  return 'default';
}

// ── Themen-Animationen ────────────────────────────────────────────────────────

// 🇩🇪 Deutschlandfahne
function GermanyFlag() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0.18 }}>
      {/* Große wehende Fahne im Hintergrund */}
      <div style={{ width: '70vw', maxWidth: 900, borderRadius: 16, overflow: 'hidden',
        animation: 'flagWave 3s ease-in-out infinite', transformOrigin: 'left center',
        boxShadow: '0 0 80px rgba(0,0,0,0.6)' }}>
        <div style={{ height: '11vw', maxHeight: 140, background: '#000' }} />
        <div style={{ height: '11vw', maxHeight: 140, background: '#DD0000' }} />
        <div style={{ height: '11vw', maxHeight: 140, background: '#FFCE00' }} />
      </div>
      {/* Kleines Echo rechts */}
      <div style={{ position: 'absolute', right: '8%', bottom: '15%', width: 120, borderRadius: 8, overflow: 'hidden',
        animation: 'flagWave 4s 0.5s ease-in-out infinite', opacity: 0.6 }}>
        <div style={{ height: 20, background: '#000' }} />
        <div style={{ height: 20, background: '#DD0000' }} />
        <div style={{ height: 20, background: '#FFCE00' }} />
      </div>
    </div>
  );
}

// ⚽ Fußball
function FootballBg() {
  const balls = [
    { delay: 0, top: '30%', dur: 9 },
    { delay: 4, top: '60%', dur: 11 },
    { delay: 7, top: '15%', dur: 8 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {balls.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', top: b.top, fontSize: '5rem',
          animation: `ballRoll ${b.dur}s ${b.delay}s linear infinite`,
          opacity: 0.25,
        }}>⚽</div>
      ))}
      {/* Grüne Rasen-Linien dezent */}
      {[20, 50, 80].map(p => (
        <div key={p} style={{
          position: 'absolute', top: `${p}%`, left: 0, right: 0,
          height: 1, background: 'rgba(34,197,94,0.15)',
        }} />
      ))}
    </div>
  );
}

// 🪩 Disco
function DiscoBg({ color }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Rotierende Licht-Strahlen */}
      {[0,60,120,180,240,300].map((angle, i) => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%',
          width: '120vw', height: 2,
          background: `linear-gradient(90deg, transparent, ${['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff','#f72585'][i]}, transparent)`,
          transformOrigin: '0 50%',
          transform: `rotate(${angle}deg)`,
          animation: `discoBeam ${3 + i * 0.4}s ${i * 0.3}s linear infinite`,
          opacity: 0.35,
        }} />
      ))}
      {/* Disco-Ball-Spiegelung */}
      <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: 80, height: 80, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #fff, #aaa 40%, #555)',
        boxShadow: '0 0 30px rgba(255,255,255,0.4)',
        animation: 'gentleRotate 8s linear infinite',
        opacity: 0.5,
      }} />
    </div>
  );
}

// 🎵 Musik / Live Music
function MusicBg({ color }) {
  const bars = Array.from({ length: 32 }, (_, i) => ({
    h: 15 + Math.random() * 70,
    dur: 0.4 + Math.random() * 0.8,
    delay: Math.random() * 1.5,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end',
      justifyContent: 'center', gap: 6, padding: '0 60px 0', pointerEvents: 'none', opacity: 0.3 }}>
      {bars.map((b, i) => (
        <div key={i} style={{
          width: 10, borderRadius: 5,
          background: `linear-gradient(to top, ${color}, transparent)`,
          '--mh': `${b.h}px`,
          animation: `musicWave ${b.dur}s ${b.delay}s ease-in-out infinite`,
          height: 8,
        }} />
      ))}
    </div>
  );
}

// 🍺 Bier — Blasen
function BeerBubbles({ color }) {
  const bubbles = Array.from({ length: 20 }, (_, i) => ({
    x: 5 + Math.random() * 90,
    size: 8 + Math.random() * 20,
    dur: 4 + Math.random() * 6,
    delay: Math.random() * 8,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {bubbles.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: -20, left: `${b.x}%`,
          width: b.size, height: b.size, borderRadius: '50%',
          border: `2px solid ${color}66`,
          background: `${color}11`,
          animation: `bubbleRise ${b.dur}s ${b.delay}s ease-in infinite`,
        }} />
      ))}
    </div>
  );
}

// 🍹 Cocktail — farbige Blasen
function CocktailBubbles({ color }) {
  const colors = ['#f43f5e','#a855f7','#06b6d4','#f59e0b','#22c55e'];
  const bubbles = Array.from({ length: 16 }, (_, i) => ({
    x: 5 + Math.random() * 90,
    size: 6 + Math.random() * 16,
    dur: 3 + Math.random() * 5,
    delay: Math.random() * 6,
    color: colors[i % colors.length],
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {bubbles.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: -20, left: `${b.x}%`,
          width: b.size, height: b.size, borderRadius: '50%',
          background: `${b.color}33`,
          border: `1px solid ${b.color}66`,
          animation: `bubbleRise ${b.dur}s ${b.delay}s ease-in infinite`,
        }} />
      ))}
    </div>
  );
}

// ☀️ Sommer / Beach
function SummerBg({ color }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Sonne */}
      <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260,
        borderRadius: '50%', background: 'radial-gradient(circle, #fde68a, #f59e0b88, transparent 70%)',
        animation: 'pulseGlow 4s ease-in-out infinite', opacity: 0.4 }} />
      {/* Wellen unten */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, overflow: 'hidden' }}>
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none"
          style={{ width: '200%', height: '100%', animation: 'waveFlow 8s linear infinite', opacity: 0.25 }}>
          <path d="M0,60 C240,100 480,20 720,60 C960,100 1200,20 1440,60 L1440,120 L0,120 Z" fill={color} />
        </svg>
      </div>
    </div>
  );
}

// 🎆 Feuerwerk / Silvester
function FireworksBg({ color }) {
  const bursts = Array.from({ length: 6 }, (_, i) => ({
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 60,
    delay: i * 1.2,
    c: [color, '#f59e0b', '#ec4899', '#06b6d4', '#22c55e', '#a855f7'][i],
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', opacity: 0.6 }}>
      {bursts.map((b, bi) =>
        Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const dist = 60 + Math.random() * 60;
          return (
            <div key={`${bi}-${i}`} style={{
              position: 'absolute', left: `${b.x}%`, top: `${b.y}%`,
              width: 6, height: 6, borderRadius: '50%',
              background: b.c,
              '--fx': `${Math.cos(angle) * dist}px`,
              '--fy': `${Math.sin(angle) * dist}px`,
              animation: `firework 1.5s ${b.delay + i * 0.03}s ease-out infinite`,
              boxShadow: `0 0 6px ${b.c}`,
            }} />
          );
        })
      )}
    </div>
  );
}

// 🎃 Halloween
function HalloweenBg() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', opacity: 0.3 }}>
      {['👻','🎃','🕷️','👻','🦇','🕸️'].map((e, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${10 + i * 15}%`,
          top: `${15 + (i % 2) * 30}%`,
          fontSize: '3rem',
          animation: `ghostFloat ${3 + i * 0.4}s ${i * 0.5}s ease-in-out infinite`,
        }}>{e}</div>
      ))}
    </div>
  );
}

// 🎄 Weihnachten
function ChristmasBg() {
  const flakes = Array.from({ length: 25 }, (_, i) => ({
    x: Math.random() * 100,
    delay: Math.random() * 8,
    dur: 6 + Math.random() * 8,
    size: 8 + Math.random() * 14,
    sx: (Math.random() - 0.5) * 60 + 'px',
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {flakes.map((f, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${f.x}%`, top: -20,
          fontSize: f.size, '--sx': f.sx,
          animation: `snowFall ${f.dur}s ${f.delay}s linear infinite`,
          opacity: 0.5,
        }}>❄️</div>
      ))}
    </div>
  );
}

// ❤️ Valentinstag / Love
function LoveBg({ color }) {
  const hearts = Array.from({ length: 12 }, (_, i) => ({
    x: 5 + Math.random() * 90,
    size: 1 + Math.random() * 1.5,
    dur: 4 + Math.random() * 5,
    delay: Math.random() * 6,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', opacity: 0.3 }}>
      {hearts.map((h, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: -30, left: `${h.x}%`,
          fontSize: `${h.size}rem`, color,
          animation: `bubbleRise ${h.dur}s ${h.delay}s ease-in infinite`,
        }}>❤️</div>
      ))}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        fontSize: '8rem', opacity: 0.1, animation: 'heartBeat 1.5s ease-in-out infinite' }}>❤️</div>
    </div>
  );
}

// 🎉 Party (Fallback für Single Party etc.)
function PartyBg({ color }) {
  const confetti = Array.from({ length: 22 }, (_, i) => ({
    x: Math.random() * 100,
    c: ['#f59e0b','#ef4444','#a855f7','#06b6d4','#22c55e','#ec4899'][i % 6],
    size: 6 + Math.random() * 10,
    delay: Math.random() * 5,
    dur: 4 + Math.random() * 4,
    sx: (Math.random() - 0.5) * 80 + 'px',
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {confetti.map((c, i) => (
        <div key={i} style={{
          position: 'absolute', top: -15, left: `${c.x}%`,
          width: c.size, height: c.size,
          borderRadius: i % 3 === 0 ? '50%' : 2,
          background: c.c, '--sx': c.sx, opacity: 0.7,
          animation: `snowFall ${c.dur}s ${c.delay}s linear infinite`,
        }} />
      ))}
    </div>
  );
}

// 🍕 Food
function FoodBg() {
  const items = ['🍕','🍔','🍣','🥗','🍜'];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', opacity: 0.2 }}>
      {items.map((e, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${10 + i * 18}%`,
          top: `${20 + (i % 2) * 35}%`,
          fontSize: '4rem',
          animation: `drinkFloat ${3 + i * 0.5}s ${i * 0.4}s ease-in-out infinite`,
        }}>{e}</div>
      ))}
    </div>
  );
}

// Dezente Partikel (default)
function DefaultParticles({ color }) {
  const particles = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: 3 + Math.random() * 5,
      tx: (Math.random() - 0.5) * 300 + 'px',
      ty: -(80 + Math.random() * 200) + 'px',
      delay: Math.random() * 4, dur: 4 + Math.random() * 5,
    }))
  ).current;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size, borderRadius: '50%', background: color,
          opacity: 0, '--tx': p.tx, '--ty': p.ty,
          animation: `particleFly ${p.dur}s ${p.delay}s ease-out infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Theme → Komponente ────────────────────────────────────────────────────────
function ThemeBackground({ theme, accent }) {
  switch (theme) {
    case 'germany':    return <GermanyFlag />;
    case 'football':   return <FootballBg />;
    case 'disco':      return <DiscoBg color={accent.bg} />;
    case 'music':      return <MusicBg color={accent.bg} />;
    case 'beer':       return <BeerBubbles color={accent.bg} />;
    case 'cocktail':   return <CocktailBubbles color={accent.bg} />;
    case 'summer':     return <SummerBg color={accent.bg} />;
    case 'fireworks':  return <FireworksBg color={accent.bg} />;
    case 'halloween':  return <HalloweenBg />;
    case 'christmas':  return <ChristmasBg />;
    case 'love':       return <LoveBg color={accent.bg} />;
    case 'party':      return <PartyBg color={accent.bg} />;
    case 'food':       return <FoodBg />;
    default:           return <DefaultParticles color={accent.bg} />;
  }
}

// ── Spotlight-Streak (Event) ──────────────────────────────────────────────────
function SpotlightStreak({ color }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          position: 'absolute', top: `${15 + i * 28}%`, left: 0,
          width: '35%', height: i === 1 ? 3 : 1.5,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: i === 1 ? 0.5 : 0.2,
          animation: `spotlight ${3.5 + i * 1.2}s ${i * 0.8}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Shimmer-Bars (Drink) ──────────────────────────────────────────────────────
function ShimmerBars({ color }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{
          position: 'absolute', left: 0, right: 0, top: `${20 + i * 20}%`, height: 1,
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
          position: 'absolute', width: 500 + i * 200, height: 500 + i * 200,
          borderRadius: '50%', border: `1px solid ${color}`, opacity: 0,
          animation: `ringPulse ${2.5 + i * 0.7}s ${i * 0.6}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Uhr ───────────────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
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
    setProgress(0); startRef.current = Date.now();
    const iv = setInterval(() => {
      setProgress(Math.min((Date.now() - startRef.current) / 1000 / duration, 1));
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
function SlideAnnouncement({ slide, accent, theme }) {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'center', height: '100%', padding: '80px 120px', textAlign: 'center', gap: 32 }}>
      <ThemeBackground theme={theme} accent={accent} />
      <div style={{ fontSize: 'clamp(3rem,7vw,5.5rem)', fontWeight: 900, color: '#fff',
        lineHeight: 1.05, letterSpacing: '-0.03em',
        textShadow: `0 2px 40px rgba(0,0,0,0.5), 0 0 80px ${accent.glow}`,
        animation: 'floatUp 5s ease-in-out infinite', position: 'relative', zIndex: 1 }}>
        {slide.title}
      </div>
      {slide.subtitle && (
        <div style={{ fontSize: '1.8rem', color: 'rgba(255,255,255,0.7)',
          animation: 'floatDown 6s ease-in-out infinite', position: 'relative', zIndex: 1 }}>
          {slide.subtitle}
        </div>
      )}
      {slide.body_text && (
        <div style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.45)', maxWidth: 700, position: 'relative', zIndex: 1 }}>
          {slide.body_text}
        </div>
      )}
      {slide.cta_text && (
        <div style={{ background: accent.bg, color: accent.text, padding: '16px 48px',
          borderRadius: 16, fontWeight: 800, fontSize: '1.4rem',
          boxShadow: `0 0 30px ${accent.glow}`,
          animation: 'pulseGlow 3s ease-in-out infinite', position: 'relative', zIndex: 1 }}>
          {slide.cta_text}
        </div>
      )}
    </div>
  );
}

// ── Slide: EVENT ──────────────────────────────────────────────────────────────
function SlideEvent({ slide, accent, theme }) {
  const hasEndDate = slide.event_end_date && slide.event_end_date !== slide.event_date;
  const dateStr = slide.event_date ? format(parseISO(slide.event_date), 'EEEE, d. MMMM', { locale: de }) : '';
  const endDateStr = hasEndDate ? format(parseISO(slide.event_end_date), 'd. MMMM', { locale: de }) : '';
  const timeStr = [slide.event_time, slide.event_end_time].filter(Boolean).join(' – ') + (slide.event_time ? ' Uhr' : '');

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'center', height: '100%', padding: '80px 120px', textAlign: 'center', gap: 36 }}>
      <ThemeBackground theme={theme} accent={accent} />
      <SpotlightStreak color={accent.bg} />

      <div style={{ background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8,
        padding: '6px 24px', position: 'relative', zIndex: 1, animation: 'slideInUp 0.6s 0.1s both ease-out' }}>
        <span style={{ fontSize: '0.85rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>EVENT</span>
      </div>

      <div style={{ fontSize: 'clamp(3rem,6.5vw,5rem)', fontWeight: 900, lineHeight: 1.05,
        letterSpacing: '-0.03em',
        background: `linear-gradient(90deg, #fff 0%, ${accent.bg} 40%, #fff 60%, ${accent.bg} 80%, #fff 100%)`,
        backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text', animation: 'shimmer 4s linear infinite, slideInUp 0.7s 0.2s both ease-out',
        position: 'relative', zIndex: 1 }}>
        {slide.title}
      </div>

      {slide.subtitle && (
        <div style={{ fontSize: '1.8rem', color: 'rgba(255,255,255,0.65)',
          animation: 'slideInUp 0.7s 0.35s both ease-out', position: 'relative', zIndex: 1 }}>
          {slide.subtitle}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        {dateStr && <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 24px', fontWeight: 600, fontSize: '1.1rem', color: '#fff', animation: 'slideInUp 0.7s 0.5s both ease-out' }}>📅 {dateStr}{endDateStr ? ` – ${endDateStr}` : ''}</div>}
        {timeStr && <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 24px', fontWeight: 600, fontSize: '1.1rem', color: '#fff', animation: 'slideInUp 0.7s 0.65s both ease-out' }}>🕐 {timeStr}</div>}
        {slide.location && <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 24px', fontWeight: 600, fontSize: '1.1rem', color: '#fff', animation: 'slideInUp 0.7s 0.8s both ease-out' }}>📍 {slide.location}</div>}
      </div>

      {slide.cta_text && (
        <div style={{ background: accent.bg, color: accent.text, padding: '16px 48px',
          borderRadius: 16, fontWeight: 800, fontSize: '1.4rem', boxShadow: `0 0 30px ${accent.glow}`,
          animation: 'slideInUp 0.7s 0.95s both ease-out, pulseGlow 3s 1.8s ease-in-out infinite',
          position: 'relative', zIndex: 1 }}>
          {slide.cta_text}
        </div>
      )}
    </div>
  );
}

// ── Slide: DRINK SPECIAL ──────────────────────────────────────────────────────
function SlideDrinkSpecial({ slide, accent, theme }) {
  let drinks = [];
  try { drinks = JSON.parse(slide.body_text || '[]'); } catch {}
  if (!drinks.length) drinks = [{ name: slide.title, price: slide.price_info, emoji: '🍹' }];
  const validDrinks = drinks.filter(d => d && d.name);

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'center', height: '100%', padding: '60px 80px', textAlign: 'center', gap: 32 }}>
      <ThemeBackground theme={theme} accent={accent} />
      <ShimmerBars color={accent.bg} />

      <div style={{ background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8,
        padding: '6px 24px', position: 'relative', zIndex: 1, animation: 'fadeInScale 0.5s 0.1s both' }}>
        <span style={{ fontSize: '0.85rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>DRINK SPECIAL</span>
      </div>

      {slide.title && validDrinks.length > 1 && (
        <div style={{ fontSize: 'clamp(2.5rem,5vw,4rem)', fontWeight: 900, color: '#fff',
          letterSpacing: '-0.03em', animation: 'slideInUp 0.6s 0.2s both ease-out', position: 'relative', zIndex: 1 }}>
          {slide.title}
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', width: '100%', position: 'relative', zIndex: 1 }}>
        {validDrinks.map((d, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.06)', border: `2px solid ${accent.bg}44`,
            borderRadius: 24, padding: '28px 36px', textAlign: 'center',
            minWidth: 180, flex: '1 1 180px', maxWidth: 280,
            animation: `bounceIn 0.7s ${0.35 + i * 0.15}s both` }}>
            <div style={{ fontSize: '2.8rem', marginBottom: 12, display: 'inline-block',
              animation: `drinkFloat ${3.5 + i * 0.5}s ${i * 0.3}s ease-in-out infinite` }}>
              {d.emoji || '🍹'}
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>{d.name}</div>
            {d.price && (
              <div style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 12,
                background: accent.bg, color: accent.text, fontWeight: 900, fontSize: '1.5rem',
                boxShadow: `0 0 20px ${accent.glow}`,
                backgroundImage: `linear-gradient(90deg, ${accent.bg} 0%, #fff6 40%, ${accent.bg} 60%, #fff6 80%, ${accent.bg} 100%)`,
                backgroundSize: '200% auto', animation: 'shimmer 3s linear infinite' }}>
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
function SlideCountdown({ slide, accent, theme }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);

  if (!slide.event_date) return null;
  const target = parseISO(slide.event_date + (slide.event_time ? 'T' + slide.event_time : 'T00:00:00'));
  const totalSec = differenceInSeconds(target, now);

  if (totalSec < 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 32, textAlign: 'center' }}>
      <ThemeBackground theme={theme} accent={accent} />
      <div style={{ fontSize: '5rem', animation: 'bounceIn 0.8s both', position: 'relative', zIndex: 1 }}>🎉</div>
      <div style={{ fontSize: '4rem', fontWeight: 900, color: accent.bg,
        textShadow: `0 0 60px ${accent.glow}`, animation: 'pulseGlow 2s ease-in-out infinite', position: 'relative', zIndex: 1 }}>ES IST SOWEIT!</div>
      <div style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, position: 'relative', zIndex: 1 }}>{slide.title}</div>
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
      <ThemeBackground theme={theme} accent={accent} />
      <PulseRings color={accent.bg} />

      <div style={{ background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8,
        padding: '6px 24px', position: 'relative', zIndex: 1, animation: 'fadeInScale 0.5s 0.1s both' }}>
        <span style={{ fontSize: '0.85rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Countdown</span>
      </div>

      <div style={{ fontSize: '3.8rem', fontWeight: 900, color: '#fff', lineHeight: 1.05,
        letterSpacing: '-0.02em', textShadow: '0 2px 40px rgba(0,0,0,0.5)',
        animation: 'slideInUp 0.6s 0.2s both ease-out', position: 'relative', zIndex: 1 }}>
        {slide.title}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        {units.map((u, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.06)', border: `2px solid ${accent.bg}`,
              borderRadius: 20, padding: '24px 36px', minWidth: 130, boxShadow: `0 0 40px ${accent.glow}`,
              animation: `bounceIn 0.7s ${0.4 + i * 0.12}s both`, overflow: 'hidden' }}>
              <div key={`${i}-${u.v}`} style={{ fontSize: '5rem', fontWeight: 900, color: '#fff',
                lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums',
                animation: 'numberFlip 0.35s ease-out both' }}>
                {String(u.v).padStart(2, '0')}
              </div>
              <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', marginTop: 8, fontWeight: 600 }}>{u.l}</div>
            </div>
          </div>
        ))}
      </div>

      {(slide.event_date || slide.event_time || slide.location) && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          {slide.event_date && <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 22px', color: '#fff', fontWeight: 600, fontSize: '1.1rem', animation: 'slideInUp 0.6s 0.8s both ease-out' }}>📅 {format(parseISO(slide.event_date), 'EEEE, d. MMMM yyyy', { locale: de })}</div>}
          {slide.event_time && <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 22px', color: '#fff', fontWeight: 600, fontSize: '1.1rem', animation: 'slideInUp 0.6s 0.95s both ease-out' }}>🕐 {slide.event_time} Uhr</div>}
          {slide.location   && <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 22px', color: '#fff', fontWeight: 600, fontSize: '1.1rem', animation: 'slideInUp 0.6s 1.1s both ease-out' }}>📍 {slide.location}</div>}
        </div>
      )}
    </div>
  );
}

// ── Dot Navigation ────────────────────────────────────────────────────────────
function DotNav({ slides, currentIdx, accents }) {
  return (
    <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 8, zIndex: 20 }}>
      {slides.map((s, i) => {
        const a = accents[s.accent_color] || accents.amber;
        return (
          <div key={i} style={{ height: 6, width: i === currentIdx ? 24 : 6, borderRadius: 3,
            background: i === currentIdx ? a.bg : 'rgba(255,255,255,0.2)',
            transition: 'all 0.3s ease',
            boxShadow: i === currentIdx ? `0 0 8px ${a.bg}` : 'none' }} />
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
    queryKey: ['displaySlides-v4'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getDisplaySlides');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const slides = data?.slides || [];
  const company = data?.company;

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
  const theme = slide ? detectTheme(slide.title, slide.subtitle) : 'default';

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
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${accent.glow} 0%, transparent 70%)`,
        transition: 'background 1s ease' }} />

      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 48px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.9 }}>
          {company?.logo_url
            ? <img src={company.logo_url} alt="Logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
            : <span style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
                <span style={{ color: accent.bg }}>●</span> {company?.company_name || 'SAVO'}
              </span>}
        </div>
        <Clock />
      </div>

      {/* Slide Content */}
      <div style={{ position: 'absolute', inset: 0, opacity: isTransitioning ? 0 : 1, transition: 'opacity 0.5s ease' }}>
        {slide.slide_type === 'announcement'  && <SlideAnnouncement  slide={slide} accent={accent} theme={theme} />}
        {slide.slide_type === 'event'         && <SlideEvent         slide={slide} accent={accent} theme={theme} />}
        {slide.slide_type === 'drink_special' && <SlideDrinkSpecial  slide={slide} accent={accent} theme={theme} />}
        {slide.slide_type === 'countdown'     && <SlideCountdown     slide={slide} accent={accent} theme={theme} />}
      </div>

      {slides.length > 1 && <DotNav slides={slides} currentIdx={currentIdx} accents={ACCENTS} />}
      <ProgressBar duration={slide.duration_seconds || 8} color={accent.bg} resetKey={currentIdx} />
    </div>
  );
}