/**
 * Display.jsx — Vollbild-Slideshow für Bar-TV
 * v5: Premium Canvas-Animationen — Flaggen-Physik, Feuerwerk-Partikel, Disco-Spiegelkugel,
 *     Bier-Schaum, Snow-Drift, Music-Equalizer, Football-Spiralball
 */
import { useState, useEffect, useRef, useCallback } from 'react';
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

// ── CSS Keyframes ─────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes floatUp    { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-14px)} }
  @keyframes floatDown  { 0%,100%{transform:translateY(0)}   50%{transform:translateY(10px)}  }
  @keyframes pulseGlow  { 0%,100%{opacity:0.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
  @keyframes shimmer    { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes slideInUp  { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
  @keyframes bounceIn   { 0%{opacity:0;transform:scale(0.7)} 60%{transform:scale(1.08)} 80%{transform:scale(0.96)} 100%{opacity:1;transform:scale(1)} }
  @keyframes fadeInScale{ from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }
  @keyframes numberFlip { 0%{transform:translateY(-100%);opacity:0} 30%{transform:translateY(8%)} 100%{transform:translateY(0);opacity:1} }
  @keyframes drinkFloat { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-10px) rotate(1deg)} }
  @keyframes shimmerBar { 0%,100%{opacity:0.05} 50%{opacity:0.18} }
  @keyframes spotlight  { 0%{transform:translateX(-110%) skewX(-15deg)} 100%{transform:translateX(310%) skewX(-15deg)} }
  @keyframes ringPulse  { 0%{transform:scale(0.9);opacity:0.8} 50%{transform:scale(1.12);opacity:0.25} 100%{transform:scale(0.9);opacity:0.8} }
`;
function injectKeyframes() {
  if (document.getElementById('savo-kf')) return;
  const s = document.createElement('style');
  s.id = 'savo-kf'; s.textContent = KEYFRAMES;
  document.head.appendChild(s);
}

// ── Titel-Analyzer ────────────────────────────────────────────────────────────
function detectTheme(title = '', subtitle = '') {
  const txt = (title + ' ' + subtitle).toLowerCase();
  if (/deutsch|germany|german|dfb|schwarz.?rot.?gold|bundesadler/.test(txt)) return 'germany';
  if (/american.?football|nfl|touchdown|superbowl|quarterback/.test(txt)) return 'american_football';
  if (/fußball|fussball|soccer|tor |bundesliga|champions|euro |wm |em |kick/.test(txt)) return 'soccer';
  if (/party|disco|club|dance|dj |rave|techno|house/.test(txt)) return 'disco';
  if (/live.?music|konzert|concert|band |rock |jazz|acoustic|singer/.test(txt)) return 'music';
  if (/bier|beer|pils|weizen|craft|brau/.test(txt)) return 'beer';
  if (/cocktail|drink|aperol|spritz|mojito|gin |vodka|rum |sex.?on|frozen/.test(txt)) return 'cocktail';
  if (/sommer|summer|beach|strand|ibiza|tropical/.test(txt)) return 'summer';
  if (/silvester|neujahr|new.?year|feuerwerk/.test(txt)) return 'fireworks';
  if (/halloween|horror|scary|zombie|geist|ghost/.test(txt)) return 'halloween';
  if (/weihnacht|christmas|xmas|advent|santa/.test(txt)) return 'christmas';
  if (/valentine|liebe|love|herz|heart/.test(txt)) return 'love';
  if (/single|ladies|girls night|girlsnight|women/.test(txt)) return 'party';
  if (/pizza|burger|food|essen|brunch|bbq|grill/.test(txt)) return 'food';
  return 'default';
}

// ═══════════════════════════════════════════════════════════════════════════
// CANVAS ANIMATIONEN
// ═══════════════════════════════════════════════════════════════════════════

// 🇩🇪 Deutschland — Flagge mit echter Wellen-Physik auf Canvas
function CanvasGermanyFlag({ opacity = 0.22 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let t = 0;
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    const FW = W * 0.62, FH = H * 0.32;
    const FX = W * 0.19, FY = H * 0.34;
    const COLS = 80, ROWS = 3;
    const colors = ['#111111', '#CC0000', '#FFCE00'];
    const segW = FW / COLS;
    const segH = FH / ROWS;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      // Fahnenmast
      const grad = ctx.createLinearGradient(FX - 12, 0, FX, 0);
      grad.addColorStop(0, '#888'); grad.addColorStop(0.5, '#eee'); grad.addColorStop(1, '#666');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(FX - 10, FY - 30, 10, FH + 60, 4); ctx.fill();
      // Fahnenstab oben
      ctx.fillStyle = '#aaa'; ctx.beginPath();
      ctx.arc(FX - 5, FY - 30, 10, 0, Math.PI * 2); ctx.fill();

      // Flagge: Spalte für Spalte mit Sinus-Welle
      for (let c = 0; c < COLS; c++) {
        const progress = c / COLS;
        const amplitude = 18 * progress * progress;
        const wave1 = Math.sin(progress * Math.PI * 2.5 - t * 2.2) * amplitude;
        const wave2 = Math.sin(progress * Math.PI * 1.8 - t * 1.6) * amplitude * 0.4;
        const xBase = FX + c * segW;
        for (let row = 0; row < ROWS; row++) {
          const yBase = FY + row * segH;
          const yOff1 = Math.sin(progress * Math.PI * 2 - t * 2) * amplitude * 0.3;
          // Schatten (Tiefe durch Welle)
          const light = 1 - Math.abs(Math.sin(progress * Math.PI * 2.5 - t * 2.2)) * 0.35;
          ctx.fillStyle = shadeColor(colors[row], light);
          ctx.beginPath();
          ctx.moveTo(xBase, yBase + wave1 + wave2 + yOff1 * row);
          ctx.lineTo(xBase + segW + 0.5, yBase + (c + 1 < COLS ? (Math.sin((c+1)/COLS * Math.PI * 2.5 - t * 2.2) * ((c+1)/COLS)**2 * 18) : wave1) + wave2 + yOff1 * row);
          ctx.lineTo(xBase + segW + 0.5, yBase + segH + wave1 + wave2 + yOff1 * (row + 1));
          ctx.lineTo(xBase, yBase + segH + wave1 + wave2 + yOff1 * (row + 1));
          ctx.closePath(); ctx.fill();
        }
      }
      // Flaggen-Rand-Glow
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 2;
      ctx.strokeRect(FX, FY, FW, FH);

      t += 0.016;
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity, pointerEvents:'none' }} />;
}

function shadeColor(hex, factor) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*factor)},${Math.round(g*factor)},${Math.round(b*factor)})`;
}

// ⚽ Soccer — grüner Rasen + rollende Bälle
function CanvasSoccer({ opacity = 0.3 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const W = canvas.width, H = canvas.height;

    const balls = Array.from({length: 3}, (_, i) => ({
      x: -80 - i * 350, y: H * (0.25 + i * 0.25),
      vx: 1.2 + i * 0.4, r: 32 + i * 8, angle: 0,
      va: (1.2 + i * 0.3) * 0.04,
    }));

    function drawBall(x, y, r, angle) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      // Ball Basis
      const g = ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r);
      g.addColorStop(0,'#fff'); g.addColorStop(0.4,'#ddd'); g.addColorStop(1,'#999');
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
      // Pentagons
      ctx.fillStyle = '#222';
      for (let p = 0; p < 5; p++) {
        const a = (p/5)*Math.PI*2 - Math.PI/2;
        const px = Math.cos(a)*r*0.55, py = Math.sin(a)*r*0.55;
        ctx.beginPath();
        for (let v = 0; v < 5; v++) {
          const va = (v/5)*Math.PI*2 - Math.PI/2;
          const vx2 = px + Math.cos(va)*r*0.22, vy2 = py + Math.sin(va)*r*0.22;
          v === 0 ? ctx.moveTo(vx2,vy2) : ctx.lineTo(vx2,vy2);
        }
        ctx.closePath(); ctx.fill();
      }
      // Center pentagon
      ctx.beginPath();
      for (let v = 0; v < 5; v++) {
        const va = (v/5)*Math.PI*2 - Math.PI/2;
        v===0 ? ctx.moveTo(Math.cos(va)*r*0.25,Math.sin(va)*r*0.25)
              : ctx.lineTo(Math.cos(va)*r*0.25,Math.sin(va)*r*0.25);
      }
      ctx.closePath(); ctx.fill();
      // Glanz
      ctx.beginPath(); ctx.arc(-r*0.28,-r*0.28,r*0.2,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fill();
      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0,0,W,H);
      // Rasen-Linien
      ctx.strokeStyle = 'rgba(34,197,94,0.12)'; ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const y = H * (i/8);
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
      }
      // Mittellinie
      ctx.strokeStyle = 'rgba(34,197,94,0.18)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
      ctx.beginPath(); ctx.arc(W/2, H/2, H*0.2, 0, Math.PI*2); ctx.stroke();

      balls.forEach(b => {
        b.x += b.vx; b.angle += b.va;
        if (b.x > W + 100) b.x = -100;
        ctx.globalAlpha = 0.28;
        // Schatten
        ctx.beginPath(); ctx.ellipse(b.x, b.y + b.r*0.8, b.r*0.9, b.r*0.25, 0, 0, Math.PI*2);
        ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fill();
        ctx.globalAlpha = opacity;
        drawBall(b.x, b.y, b.r, b.angle);
      });
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  return <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:1,pointerEvents:'none'}} />;
}

// 🏈 American Football — Spiralball mit Yard-Lines
function CanvasAmericanFootball({ opacity = 0.3 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const W = canvas.width, H = canvas.height;
    let t = 0;
    // Mehrere Bälle mit unterschiedlichen Wurfbahnen
    const balls = [
      { startX: -60, startY: H*0.55, endX: W+60, endY: H*0.2, dur: 180, phase: 0 },
      { startX: W+60, startY: H*0.3, endX: -60, endY: H*0.7, dur: 220, phase: 80 },
      { startX: -60, startY: H*0.75, endX: W+60, endY: H*0.4, dur: 260, phase: 140 },
    ];

    function drawFootball(x, y, angle, scale=1) {
      ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(scale,scale);
      const rx=36, ry=20;
      // Ball Körper
      const g = ctx.createRadialGradient(-rx*0.2,-ry*0.3,2,0,0,rx*0.9);
      g.addColorStop(0,'#d4781a'); g.addColorStop(0.5,'#a0520a'); g.addColorStop(1,'#6b3106');
      ctx.beginPath(); ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
      // Nähte
      ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(-rx+4,0); ctx.lineTo(rx-4,0); ctx.stroke();
      for (let i=-2;i<=2;i++) {
        ctx.beginPath();
        ctx.moveTo(i*7, -ry*0.55);
        ctx.bezierCurveTo(i*7-4, -ry*0.2, i*7+4, ry*0.2, i*7, ry*0.55);
        ctx.stroke();
      }
      // Glanz
      ctx.beginPath(); ctx.ellipse(-rx*0.25,-ry*0.3,rx*0.18,ry*0.12,0,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fill();
      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0,0,W,H);
      // Yard-Lines (Kunstrasen-Feeling)
      ctx.fillStyle = 'rgba(34,100,34,0.06)';
      ctx.fillRect(0,0,W,H);
      for (let i=0;i<=10;i++) {
        const x = (i/10)*W;
        ctx.strokeStyle = i===5 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)';
        ctx.lineWidth = i===5 ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
        if (i>0&&i<10) {
          ctx.fillStyle='rgba(255,255,255,0.07)';
          ctx.font='bold 18px sans-serif'; ctx.textAlign='center';
          ctx.fillText(`${i*10}`, x, H*0.12);
        }
      }
      // Balls
      balls.forEach(b => {
        const frame = (t + b.phase) % b.dur;
        const progress = frame / b.dur;
        const eased = progress < 0.5 ? 2*progress*progress : 1-2*(1-progress)*(1-progress);
        const x = b.startX + (b.endX-b.startX)*eased;
        const arc = Math.sin(progress*Math.PI)*H*0.18;
        const y = b.startY + (b.endY-b.startY)*eased - arc;
        const dx = b.endX - b.startX;
        const angle = Math.atan2((b.endY-b.startY)*eased - arc - ((b.startY+(b.endY-b.startY)*(eased-0.01))-arc*0.98), dx*0.01) * 0.6;
        const alpha = Math.sin(progress*Math.PI);
        ctx.globalAlpha = alpha * opacity;
        // Schatten
        ctx.beginPath(); ctx.ellipse(x,y+22,30,8,0,0,Math.PI*2);
        ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fill();
        drawFootball(x, y, angle, 1);
        // Spiral-Trail
        ctx.globalAlpha = alpha * 0.08;
        for (let trail=1;trail<=6;trail++) {
          const tp = Math.max(0, progress - trail*0.015);
          const te = tp < 0.5 ? 2*tp*tp : 1-2*(1-tp)*(1-tp);
          const tx2 = b.startX + (b.endX-b.startX)*te;
          const ty2 = b.startY + (b.endY-b.startY)*te - Math.sin(tp*Math.PI)*H*0.18;
          ctx.beginPath(); ctx.arc(tx2,ty2,4-trail*0.4,0,Math.PI*2);
          ctx.fillStyle='#d4781a'; ctx.fill();
        }
        ctx.globalAlpha = 1;
      });
      t++;
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  return <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:1,pointerEvents:'none'}} />;
}

// 🪩 Disco — Spiegelkugel mit echten Lichtreflexionen
function CanvasDisco({ accentColor, opacity=0.55 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const W = canvas.width, H = canvas.height;
    let t = 0;
    const SPOTS = 28;
    const COLORS = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff','#f72585','#00f5d4','#ff9f1c'];
    const spots = Array.from({length:SPOTS},(_,i)=>({
      angle: (i/SPOTS)*Math.PI*2,
      dist: 60+Math.random()*Math.min(W,H)*0.38,
      color: COLORS[i%COLORS.length],
      r: 12+Math.random()*22,
      speed: 0.008+Math.random()*0.012,
      phase: Math.random()*Math.PI*2,
    }));

    const BALL_X = W/2, BALL_Y = H*0.13, BALL_R = 52;
    const tiles = [];
    for (let row=-5;row<=5;row++) for (let col=-5;col<=5;col++) {
      const dx=col*BALL_R*0.38, dy=row*BALL_R*0.38;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if (dist<=BALL_R) tiles.push({dx,dy,nx:dx/BALL_R,ny:dy/BALL_R,nz:Math.sqrt(1-(dx/BALL_R)**2-(dy/BALL_R)**2)||0.01});
    }

    function draw() {
      ctx.clearRect(0,0,W,H);
      // Boden-Spots (Licht das vom Boden reflektiert)
      spots.forEach(s => {
        s.angle += s.speed;
        const x = BALL_X + Math.cos(s.angle+t*0.3)*s.dist;
        const y = H*0.85 + Math.sin(s.angle*0.7+t*0.2)*H*0.08;
        const g2 = ctx.createRadialGradient(x,y,0,x,y,s.r*2.5);
        g2.addColorStop(0,s.color+'cc'); g2.addColorStop(0.4,s.color+'44'); g2.addColorStop(1,'transparent');
        ctx.beginPath(); ctx.ellipse(x,y,s.r*2.5,s.r*0.8,0,0,Math.PI*2);
        ctx.fillStyle=g2; ctx.globalAlpha=0.35; ctx.fill();
        // Wand-Spots
        const wx = x; const wy = H*0.4 + Math.sin(s.angle*1.3)*H*0.2;
        ctx.beginPath(); ctx.arc(wx,wy,s.r,0,Math.PI*2);
        const g3 = ctx.createRadialGradient(wx,wy,0,wx,wy,s.r);
        g3.addColorStop(0,s.color+'aa'); g3.addColorStop(1,'transparent');
        ctx.fillStyle=g3; ctx.globalAlpha=0.18; ctx.fill();
      });
      ctx.globalAlpha=1;

      // Spiegelkugel
      const bg = ctx.createRadialGradient(BALL_X-BALL_R*0.3,BALL_Y-BALL_R*0.3,BALL_R*0.05,BALL_X,BALL_Y,BALL_R);
      bg.addColorStop(0,'#ddd'); bg.addColorStop(0.5,'#888'); bg.addColorStop(1,'#333');
      ctx.beginPath(); ctx.arc(BALL_X,BALL_Y,BALL_R,0,Math.PI*2);
      ctx.fillStyle=bg; ctx.fill();
      // Kugel-Tiles
      tiles.forEach(tile => {
        const reflAngle = t*1.2 + tile.nx*2;
        const ci = Math.abs(Math.round(reflAngle*2)) % COLORS.length;
        const brightness = 0.3 + tile.nz*0.7 + Math.sin(t*2+tile.nx*3)*0.15;
        const sx = BALL_X + tile.dx, sy = BALL_Y + tile.dy;
        const tw = BALL_R*0.34, th = BALL_R*0.34;
        ctx.fillStyle = Math.random() > 0.97 ? COLORS[ci] : `rgba(${Math.round(200*brightness)},${Math.round(200*brightness)},${Math.round(210*brightness)},0.9)`;
        ctx.fillRect(sx-tw/2+0.5, sy-th/2+0.5, tw-1, th-1);
      });
      // Kugel-Glanz
      const glowG = ctx.createRadialGradient(BALL_X-BALL_R*0.25,BALL_Y-BALL_R*0.25,2,BALL_X,BALL_Y,BALL_R);
      glowG.addColorStop(0,'rgba(255,255,255,0.5)'); glowG.addColorStop(0.4,'transparent');
      ctx.beginPath(); ctx.arc(BALL_X,BALL_Y,BALL_R,0,Math.PI*2); ctx.fillStyle=glowG; ctx.fill();
      // Aufhängung
      ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(BALL_X,0); ctx.lineTo(BALL_X,BALL_Y-BALL_R); ctx.stroke();

      t+=0.018;
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  },[]);
  return <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity,pointerEvents:'none'}} />;
}

// 🎵 Musik — reaktiver Equalizer mit Wellen
function CanvasMusic({ accentColor, opacity=0.4 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext('2d');
    canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width,H=canvas.height;
    let t=0;
    const BAR_COUNT=60;
    const heights=Array.from({length:BAR_COUNT},(_,i)=>({
      h:0.1+Math.random()*0.5,
      target:0.1+Math.random()*0.6,
      speed:0.02+Math.random()*0.04,
      phase:Math.random()*Math.PI*2,
    }));
    function draw(){
      ctx.clearRect(0,0,W,H);
      // Hintergrund-Welle
      ctx.beginPath();
      for(let x=0;x<=W;x+=2){
        const y=H*0.5+Math.sin(x/W*Math.PI*4+t)*H*0.08+Math.sin(x/W*Math.PI*8-t*1.3)*H*0.04;
        x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.strokeStyle=accentColor+'55'; ctx.lineWidth=2; ctx.stroke();

      // EQ Bars
      heights.forEach((bar,i)=>{
        bar.h+=(bar.target-bar.h)*bar.speed;
        if(Math.abs(bar.h-bar.target)<0.01){
          bar.target=0.05+Math.random()*0.7*Math.abs(Math.sin(t+bar.phase));
        }
        const bw=W/BAR_COUNT-2;
        const bh=bar.h*H*0.55+Math.sin(t*2+bar.phase)*H*0.03;
        const bx=i*(W/BAR_COUNT)+1;
        const by=H*0.78-bh;
        const g=ctx.createLinearGradient(bx,by,bx,H*0.78);
        g.addColorStop(0,accentColor+'ff');
        g.addColorStop(0.5,accentColor+'aa');
        g.addColorStop(1,accentColor+'33');
        ctx.fillStyle=g;
        ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,3); ctx.fill();
        // Mirror
        ctx.globalAlpha=0.15;
        ctx.beginPath(); ctx.roundRect(bx,H*0.78,bw,bh*0.4,3); ctx.fill();
        ctx.globalAlpha=1;
      });

      // Noten
      if(t%120<2){
        const nx=Math.random()*W, ny=H*0.5+Math.random()*H*0.3;
      }
      t+=0.022;
      rafRef.current=requestAnimationFrame(draw);
    }
    draw();
    return ()=>cancelAnimationFrame(rafRef.current);
  },[accentColor]);
  return <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity,pointerEvents:'none'}}/>;
}

// 🍺 Bier — Physik-Blasen mit Schaum
function CanvasBeer({ opacity=0.35 }) {
  const canvasRef=useRef(null); const rafRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext('2d');
    canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width,H=canvas.height;
    const bubbles=Array.from({length:35},()=>({
      x:Math.random()*W, y:H+Math.random()*H*0.5,
      r:4+Math.random()*14,
      vy:-(0.6+Math.random()*1.4),
      vx:(Math.random()-0.5)*0.5,
      wobble:Math.random()*Math.PI*2,
      wobbleSpeed:0.02+Math.random()*0.04,
      opacity:0.4+Math.random()*0.4,
    }));
    function draw(){
      ctx.clearRect(0,0,W,H);
      // Glas-Silhouette leicht andeuten
      const glassX=W*0.5, glassW=W*0.18, glassH=H*0.7;
      const g=ctx.createLinearGradient(glassX-glassW/2,0,glassX+glassW/2,0);
      g.addColorStop(0,'rgba(255,200,50,0.03)');
      g.addColorStop(0.3,'rgba(255,200,50,0.07)');
      g.addColorStop(0.7,'rgba(255,200,50,0.07)');
      g.addColorStop(1,'rgba(255,200,50,0.03)');
      ctx.fillStyle=g;
      ctx.fillRect(glassX-glassW/2,H*0.15,glassW,glassH);

      bubbles.forEach(b=>{
        b.wobble+=b.wobbleSpeed;
        b.x+=b.vx+Math.sin(b.wobble)*0.4;
        b.y+=b.vy;
        if(b.y<-b.r*2){ b.y=H+b.r; b.x=Math.random()*W; }
        const alpha=Math.min(1,(-b.y+H)/(H*0.7))*b.opacity;
        ctx.globalAlpha=alpha*opacity;
        const bg=ctx.createRadialGradient(b.x-b.r*0.35,b.y-b.r*0.35,b.r*0.05,b.x,b.y,b.r);
        bg.addColorStop(0,'rgba(255,240,180,0.9)');
        bg.addColorStop(0.5,'rgba(220,180,80,0.4)');
        bg.addColorStop(1,'rgba(180,140,40,0.1)');
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
        ctx.fillStyle=bg; ctx.fill();
        ctx.strokeStyle='rgba(255,230,100,0.6)'; ctx.lineWidth=1;
        ctx.stroke();
        // Glanz
        ctx.beginPath(); ctx.arc(b.x-b.r*0.3,b.y-b.r*0.3,b.r*0.2,0,Math.PI*2);
        ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.fill();
        ctx.globalAlpha=1;
      });
      rafRef.current=requestAnimationFrame(draw);
    }
    draw();
    return ()=>cancelAnimationFrame(rafRef.current);
  },[]);
  return <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:1,pointerEvents:'none'}}/>;
}

// 🍹 Cocktail — farbige Flüssigkeits-Blasen
function CanvasCocktail({ accentColor, opacity=0.4 }) {
  const canvasRef=useRef(null); const rafRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext('2d');
    canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width,H=canvas.height;
    const COLS=['#f43f5e','#a855f7','#06b6d4','#f59e0b','#22c55e','#ec4899','#3b82f6'];
    const blobs=Array.from({length:20},(_,i)=>({
      x:Math.random()*W, y:H+Math.random()*H*0.6,
      r:10+Math.random()*28, vy:-(0.5+Math.random()*1.2),
      vx:(Math.random()-0.5)*0.6, color:COLS[i%COLS.length],
      wobble:Math.random()*Math.PI*2, ws:0.015+Math.random()*0.03,
    }));
    function draw(){
      ctx.clearRect(0,0,W,H);
      blobs.forEach(b=>{
        b.wobble+=b.ws; b.x+=b.vx+Math.sin(b.wobble)*0.5; b.y+=b.vy;
        if(b.y<-b.r*3){ b.y=H+b.r; b.x=Math.random()*W; }
        const alpha=Math.min(1,(-b.y+H)/(H*0.65))*0.55*opacity;
        ctx.globalAlpha=alpha;
        // Blob mit leichter Verformung
        const rx=b.r*(1+Math.sin(b.wobble*2)*0.12);
        const ry=b.r*(1+Math.cos(b.wobble*2)*0.12);
        const bg=ctx.createRadialGradient(b.x-rx*0.3,b.y-ry*0.3,rx*0.05,b.x,b.y,rx);
        bg.addColorStop(0,b.color+'ff'); bg.addColorStop(0.6,b.color+'88'); bg.addColorStop(1,b.color+'11');
        ctx.beginPath(); ctx.ellipse(b.x,b.y,rx,ry,b.wobble*0.2,0,Math.PI*2);
        ctx.fillStyle=bg; ctx.fill();
        ctx.globalAlpha=alpha*0.6;
        ctx.beginPath(); ctx.arc(b.x-rx*0.28,b.y-ry*0.28,rx*0.22,0,Math.PI*2);
        ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fill();
        ctx.globalAlpha=1;
      });
      rafRef.current=requestAnimationFrame(draw);
    }
    draw();
    return ()=>cancelAnimationFrame(rafRef.current);
  },[]);
  return <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:1,pointerEvents:'none'}}/>;
}

// 🎆 Feuerwerk — echte Partikelphysik mit Gravitation & Trails
function CanvasFireworks({ accentColor, opacity=0.7 }) {
  const canvasRef=useRef(null); const rafRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext('2d');
    canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width,H=canvas.height;
    const COLS=['#f59e0b','#ef4444','#a855f7','#06b6d4','#22c55e','#ec4899','#3b82f6','#fff'];
    const rockets=[]; const particles=[];
    let t=0;

    function spawnRocket(){
      rockets.push({
        x:W*0.1+Math.random()*W*0.8, y:H,
        vy:-(12+Math.random()*8),
        vx:(Math.random()-0.5)*3,
        color:COLS[Math.floor(Math.random()*COLS.length)],
        trail:[],
      });
    }

    function explode(x,y,color){
      const count=80+Math.floor(Math.random()*60);
      for(let i=0;i<count;i++){
        const angle=(i/count)*Math.PI*2+(Math.random()-0.5)*0.4;
        const speed=2+Math.random()*7;
        particles.push({
          x,y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
          color, life:1, decay:0.012+Math.random()*0.018,
          r:2+Math.random()*3, gravity:0.12+Math.random()*0.08,
          trail:[],
        });
      }
    }

    function draw(){
      ctx.fillStyle='rgba(10,10,10,0.18)';
      ctx.fillRect(0,0,W,H);

      if(t%55===0||(t<10&&t%12===0)) spawnRocket();

      // Raketen
      for(let i=rockets.length-1;i>=0;i--){
        const r=rockets[i];
        r.trail.push({x:r.x,y:r.y});
        if(r.trail.length>12) r.trail.shift();
        r.x+=r.vx; r.y+=r.vy; r.vy+=0.3;
        r.trail.forEach((pt,ti)=>{
          ctx.globalAlpha=(ti/r.trail.length)*0.6*opacity;
          ctx.beginPath(); ctx.arc(pt.x,pt.y,1.5,0,Math.PI*2);
          ctx.fillStyle=r.color; ctx.fill();
        });
        if(r.vy>=0){
          explode(r.x,r.y,r.color);
          rockets.splice(i,1);
        }
      }

      // Partikel
      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];
        p.trail.push({x:p.x,y:p.y});
        if(p.trail.length>8) p.trail.shift();
        p.x+=p.vx; p.y+=p.vy; p.vy+=p.gravity;
        p.vx*=0.98; p.life-=p.decay;
        if(p.life<=0){ particles.splice(i,1); continue; }
        // Trail
        p.trail.forEach((pt,ti)=>{
          ctx.globalAlpha=(ti/p.trail.length)*p.life*0.5*opacity;
          ctx.beginPath(); ctx.arc(pt.x,pt.y,p.r*0.4,0,Math.PI*2);
          ctx.fillStyle=p.color; ctx.fill();
        });
        // Partikel
        ctx.globalAlpha=p.life*opacity;
        const pg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*1.5);
        pg.addColorStop(0,'#fff'); pg.addColorStop(0.3,p.color); pg.addColorStop(1,'transparent');
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*1.5,0,Math.PI*2);
        ctx.fillStyle=pg; ctx.fill();
        ctx.globalAlpha=1;
      }

      t++;
      rafRef.current=requestAnimationFrame(draw);
    }
    draw();
    return ()=>cancelAnimationFrame(rafRef.current);
  },[]);
  return <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:1,pointerEvents:'none'}}/>;
}

// ❄️ Weihnachten — Schnee mit Wind-Drift
function CanvasSnow({ opacity=0.55 }) {
  const canvasRef=useRef(null); const rafRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext('2d');
    canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width,H=canvas.height;
    let t=0;
    const flakes=Array.from({length:80},()=>({
      x:Math.random()*W, y:Math.random()*H,
      r:1.5+Math.random()*4.5, vy:0.5+Math.random()*1.5,
      vx:(Math.random()-0.5)*0.8, wobble:Math.random()*Math.PI*2,
      ws:0.01+Math.random()*0.02,
    }));
    function draw(){
      ctx.clearRect(0,0,W,H);
      const wind=Math.sin(t*0.003)*0.6;
      flakes.forEach(f=>{
        f.wobble+=f.ws; f.x+=f.vx+wind+Math.sin(f.wobble)*0.4; f.y+=f.vy;
        if(f.y>H+10){ f.y=-10; f.x=Math.random()*W; }
        if(f.x>W+10) f.x=-10; if(f.x<-10) f.x=W+10;
        ctx.globalAlpha=(0.4+Math.sin(f.wobble)*0.2)*opacity;
        const fg=ctx.createRadialGradient(f.x-f.r*0.3,f.y-f.r*0.3,0,f.x,f.y,f.r);
        fg.addColorStop(0,'#fff'); fg.addColorStop(0.6,'rgba(200,230,255,0.8)'); fg.addColorStop(1,'transparent');
        ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,Math.PI*2);
        ctx.fillStyle=fg; ctx.fill();
        ctx.globalAlpha=1;
      });
      t++;
      rafRef.current=requestAnimationFrame(draw);
    }
    draw();
    return ()=>cancelAnimationFrame(rafRef.current);
  },[]);
  return <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:1,pointerEvents:'none'}}/>;
}

// ☀️ Sommer — Wellen + Sonne-Strahlen
function CanvasSummer({ accentColor, opacity=0.4 }) {
  const canvasRef=useRef(null); const rafRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext('2d');
    canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width,H=canvas.height;
    let t=0;
    function draw(){
      ctx.clearRect(0,0,W,H);
      // Sonne
      const sx=W*0.85,sy=H*0.15,sr=80;
      ctx.globalAlpha=0.25*opacity;
      for(let ray=0;ray<12;ray++){
        const angle=(ray/12)*Math.PI*2+t*0.008;
        const r1=sr+10,r2=sr+40+Math.sin(t*0.05+ray)*15;
        ctx.strokeStyle='#fde68a'; ctx.lineWidth=3+Math.sin(t*0.04+ray)*1.5;
        ctx.beginPath();
        ctx.moveTo(sx+Math.cos(angle)*r1,sy+Math.sin(angle)*r1);
        ctx.lineTo(sx+Math.cos(angle)*r2,sy+Math.sin(angle)*r2);
        ctx.stroke();
      }
      const sg=ctx.createRadialGradient(sx-sr*0.3,sy-sr*0.3,sr*0.1,sx,sy,sr*1.5);
      sg.addColorStop(0,'#fde68a'); sg.addColorStop(0.5,'#f59e0b88'); sg.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(sx,sy,sr*1.5,0,Math.PI*2);
      ctx.fillStyle=sg; ctx.globalAlpha=0.3*opacity; ctx.fill();
      ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2);
      ctx.fillStyle='#fde68a'; ctx.globalAlpha=0.55*opacity; ctx.fill();

      // Wellen
      ctx.globalAlpha=opacity;
      for(let wave=0;wave<4;wave++){
        const yBase=H*(0.65+wave*0.1);
        const amp=H*0.025*(4-wave);
        const speed=1-wave*0.15;
        ctx.beginPath();
        for(let x=0;x<=W;x+=3){
          const y=yBase+Math.sin(x/W*Math.PI*5-t*speed*1.5+wave)*amp
                      +Math.sin(x/W*Math.PI*8+t*speed+wave*0.5)*amp*0.4;
          x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
        const wg=ctx.createLinearGradient(0,yBase,0,H);
        const alpha=(0.15-wave*0.03)*opacity;
        wg.addColorStop(0,`rgba(56,189,248,${alpha*2})`);
        wg.addColorStop(1,`rgba(14,165,233,${alpha})`);
        ctx.fillStyle=wg; ctx.fill();
      }
      ctx.globalAlpha=1;
      t++;
      rafRef.current=requestAnimationFrame(draw);
    }
    draw();
    return ()=>cancelAnimationFrame(rafRef.current);
  },[]);
  return <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:1,pointerEvents:'none'}}/>;
}

// ❤️ Love — Herzen mit Physik
function CanvasLove({ accentColor, opacity=0.45 }) {
  const canvasRef=useRef(null); const rafRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext('2d');
    canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width,H=canvas.height;
    const COLS=['#f43f5e','#ec4899','#f97316','#a855f7'];
    const hearts=Array.from({length:18},(_,i)=>({
      x:Math.random()*W, y:H+Math.random()*H*0.4,
      size:16+Math.random()*36, vy:-(0.6+Math.random()*1.3),
      vx:(Math.random()-0.5)*0.7, color:COLS[i%COLS.length],
      wobble:Math.random()*Math.PI*2, ws:0.015+Math.random()*0.025,
      rotation:Math.random()*Math.PI*2, rs:(Math.random()-0.5)*0.02,
    }));
    function drawHeart(x,y,size,color,alpha){
      ctx.save(); ctx.translate(x,y); ctx.globalAlpha=alpha;
      const s=size/15;
      ctx.beginPath();
      ctx.moveTo(0,-s*4);
      ctx.bezierCurveTo(s*5,-s*9,s*12,-s*3,0,s*5);
      ctx.bezierCurveTo(-s*12,-s*3,-s*5,-s*9,0,-s*4);
      ctx.fillStyle=color; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s*2,-s*6); ctx.bezierCurveTo(-s*1,-s*9,-s*0.5,-s*8,-s*1,-s*6);
      ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fill();
      ctx.restore();
    }
    function draw(){
      ctx.clearRect(0,0,W,H);
      hearts.forEach(h=>{
        h.wobble+=h.ws; h.rotation+=h.rs;
        h.x+=h.vx+Math.sin(h.wobble)*0.5; h.y+=h.vy;
        if(h.y<-h.size*3){ h.y=H+h.size; h.x=Math.random()*W; }
        const alpha=Math.min(1,(-h.y+H)/(H*0.65))*0.7*opacity;
        ctx.save(); ctx.translate(h.x,h.y); ctx.rotate(h.rotation);
        drawHeart(0,0,h.size,h.color,alpha);
        ctx.restore();
      });
      // Großes Zentrum-Herz mit Pulse
      rafRef.current=requestAnimationFrame(draw);
    }
    draw();
    return ()=>cancelAnimationFrame(rafRef.current);
  },[]);
  return <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:1,pointerEvents:'none'}}/>;
}

// 🎉 Party / Konfetti
function CanvasParty({ accentColor, opacity=0.55 }) {
  const canvasRef=useRef(null); const rafRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext('2d');
    canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width,H=canvas.height;
    const COLS=['#f59e0b','#ef4444','#a855f7','#06b6d4','#22c55e','#ec4899','#3b82f6','#f97316'];
    const pieces=Array.from({length:90},(_,i)=>({
      x:Math.random()*W, y:Math.random()*H-H,
      w:6+Math.random()*12, h:4+Math.random()*8,
      color:COLS[i%COLS.length],
      vy:1+Math.random()*3, vx:(Math.random()-0.5)*2,
      rotation:Math.random()*Math.PI*2, rs:(Math.random()-0.5)*0.15,
      wobble:Math.random()*Math.PI*2, ws:0.02+Math.random()*0.04,
      shape: i%4, // 0=rect, 1=circle, 2=star, 3=triangle
    }));
    function draw(){
      ctx.clearRect(0,0,W,H);
      pieces.forEach(p=>{
        p.wobble+=p.ws; p.rotation+=p.rs;
        p.x+=p.vx+Math.sin(p.wobble)*0.8; p.y+=p.vy;
        if(p.y>H+20){ p.y=-20; p.x=Math.random()*W; }
        const scaleY=Math.abs(Math.cos(p.wobble));
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rotation);
        ctx.globalAlpha=(0.7+Math.sin(p.wobble)*0.2)*opacity;
        ctx.fillStyle=p.color;
        if(p.shape===0){
          ctx.fillRect(-p.w/2,-p.h*scaleY/2,p.w,p.h*scaleY);
        } else if(p.shape===1){
          ctx.beginPath(); ctx.ellipse(0,0,p.w*0.5,p.h*0.5*scaleY,0,0,Math.PI*2); ctx.fill();
        } else if(p.shape===2){
          ctx.beginPath();
          ctx.moveTo(0,-p.w/2); ctx.lineTo(p.w*0.15,-p.h*0.1*scaleY); ctx.lineTo(p.w*0.5,0);
          ctx.lineTo(p.w*0.15,p.h*0.1*scaleY); ctx.lineTo(0,p.w/2);
          ctx.lineTo(-p.w*0.15,p.h*0.1*scaleY); ctx.lineTo(-p.w*0.5,0);
          ctx.lineTo(-p.w*0.15,-p.h*0.1*scaleY); ctx.closePath(); ctx.fill();
        } else {
          ctx.beginPath(); ctx.moveTo(0,-p.h*scaleY/2); ctx.lineTo(p.w/2,p.h*scaleY/2); ctx.lineTo(-p.w/2,p.h*scaleY/2); ctx.closePath(); ctx.fill();
        }
        ctx.restore(); ctx.globalAlpha=1;
      });
      rafRef.current=requestAnimationFrame(draw);
    }
    draw();
    return ()=>cancelAnimationFrame(rafRef.current);
  },[]);
  return <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:1,pointerEvents:'none'}}/>;
}

// 🍕 Food — schwebende Icons mit Dampf
function FoodBg() {
  const items=['🍕','🍔','🍣','🥗','🌮','🍜','🥩','🍷'];
  return (
    <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',opacity:0.18}}>
      {items.map((e,i)=>(
        <div key={i} style={{
          position:'absolute', left:`${5+i*12}%`,
          top:`${15+(i%3)*25}%`, fontSize:`${3+((i%3)*0.8)}rem`,
          filter:'drop-shadow(0 0 12px rgba(255,150,50,0.5))',
          animation:`drinkFloat ${3+i*0.5}s ${i*0.35}s ease-in-out infinite`,
        }}>{e}</div>
      ))}
    </div>
  );
}

// 🎃 Halloween
function HalloweenBg() {
  const items=['👻','🎃','🕷️','👻','🦇','🕸️','💀','🌙'];
  return (
    <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',opacity:0.25}}>
      {items.map((e,i)=>(
        <div key={i} style={{
          position:'absolute', left:`${5+i*12}%`, top:`${10+(i%3)*28}%`,
          fontSize:`${2.5+(i%3)*0.5}rem`,
          filter:'drop-shadow(0 0 8px rgba(255,100,0,0.6))',
          animation:`ghostFloat ${3+i*0.4}s ${i*0.5}s ease-in-out infinite`,
        }}>{e}</div>
      ))}
      <style>{`@keyframes ghostFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-20px) rotate(3deg)}}`}</style>
    </div>
  );
}

// ── Theme → Canvas ────────────────────────────────────────────────────────────
function ThemeBackground({ theme, accent }) {
  switch(theme){
    case 'germany':          return <CanvasGermanyFlag />;
    case 'american_football':return <CanvasAmericanFootball />;
    case 'soccer':           return <CanvasSoccer />;
    case 'disco':            return <CanvasDisco accentColor={accent.bg} />;
    case 'music':            return <CanvasMusic accentColor={accent.bg} />;
    case 'beer':             return <CanvasBeer />;
    case 'cocktail':         return <CanvasCocktail accentColor={accent.bg} />;
    case 'summer':           return <CanvasSummer accentColor={accent.bg} />;
    case 'fireworks':        return <CanvasFireworks accentColor={accent.bg} />;
    case 'halloween':        return <HalloweenBg />;
    case 'christmas':        return <CanvasSnow />;
    case 'love':             return <CanvasLove accentColor={accent.bg} />;
    case 'party':            return <CanvasParty accentColor={accent.bg} />;
    case 'food':             return <FoodBg />;
    default:                 return <CanvasParty accentColor={accent.bg} opacity={0.2}/>;
  }
}

// ── Spotlight-Streak ──────────────────────────────────────────────────────────
function SpotlightStreak({color}){
  return(
    <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
      {[0,1,2].map(i=>(
        <div key={i} style={{position:'absolute',top:`${15+i*28}%`,left:0,width:'35%',height:i===1?3:1.5,
          background:`linear-gradient(90deg,transparent,${color},transparent)`,opacity:i===1?0.5:0.2,
          animation:`spotlight ${3.5+i*1.2}s ${i*0.8}s ease-in-out infinite`}}/>
      ))}
    </div>
  );
}
function ShimmerBars({color}){
  return(
    <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
      {[0,1,2,3].map(i=>(
        <div key={i} style={{position:'absolute',left:0,right:0,top:`${20+i*20}%`,height:1,
          background:`linear-gradient(90deg,transparent,${color},transparent)`,
          animation:`shimmerBar ${2.5+i*0.6}s ${i*0.4}s ease-in-out infinite`}}/>
      ))}
    </div>
  );
}
function PulseRings({color}){
  return(
    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
      {[0,1,2].map(i=>(
        <div key={i} style={{position:'absolute',width:500+i*200,height:500+i*200,borderRadius:'50%',
          border:`1px solid ${color}`,opacity:0,
          animation:`ringPulse ${2.5+i*0.7}s ${i*0.6}s ease-in-out infinite`}}/>
      ))}
    </div>
  );
}

// ── Uhr ───────────────────────────────────────────────────────────────────────
function Clock(){
  const [time,setTime]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t);},[]);
  return(
    <div style={{textAlign:'right'}}>
      <div style={{fontSize:'3rem',fontWeight:700,lineHeight:1,color:'#fff',letterSpacing:'-0.02em'}}>{format(time,'HH:mm')}</div>
      <div style={{fontSize:'0.9rem',color:'rgba(255,255,255,0.5)',marginTop:3}}>{format(time,'EEEE, d. MMMM',{locale:de})}</div>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({duration,color,resetKey}){
  const [progress,setProgress]=useState(0);
  const startRef=useRef(Date.now());
  useEffect(()=>{
    setProgress(0); startRef.current=Date.now();
    const iv=setInterval(()=>{setProgress(Math.min((Date.now()-startRef.current)/1000/duration,1));},50);
    return()=>clearInterval(iv);
  },[duration,resetKey]);
  return(
    <div style={{position:'absolute',bottom:0,left:0,right:0,height:5,background:'rgba(255,255,255,0.08)'}}>
      <div style={{height:'100%',width:`${progress*100}%`,background:color,
        boxShadow:`0 0 10px ${color}`,transition:'width 0.05s linear',borderRadius:'0 3px 3px 0'}}/>
    </div>
  );
}

// ── Slide: ANNOUNCEMENT ───────────────────────────────────────────────────────
function SlideAnnouncement({slide,accent,theme}){
  return(
    <div style={{position:'relative',display:'flex',flexDirection:'column',justifyContent:'center',
      alignItems:'center',height:'100%',padding:'80px 120px',textAlign:'center',gap:32}}>
      <ThemeBackground theme={theme} accent={accent}/>
      <div style={{fontSize:'clamp(3rem,7vw,5.5rem)',fontWeight:900,color:'#fff',lineHeight:1.05,
        letterSpacing:'-0.03em',textShadow:`0 2px 40px rgba(0,0,0,0.5),0 0 80px ${accent.glow}`,
        animation:'floatUp 5s ease-in-out infinite',position:'relative',zIndex:1}}>{slide.title}</div>
      {slide.subtitle&&<div style={{fontSize:'1.8rem',color:'rgba(255,255,255,0.7)',
        animation:'floatDown 6s ease-in-out infinite',position:'relative',zIndex:1}}>{slide.subtitle}</div>}
      {slide.body_text&&<div style={{fontSize:'1.2rem',color:'rgba(255,255,255,0.45)',maxWidth:700,position:'relative',zIndex:1}}>{slide.body_text}</div>}
      {slide.cta_text&&<div style={{background:accent.bg,color:accent.text,padding:'16px 48px',
        borderRadius:16,fontWeight:800,fontSize:'1.4rem',boxShadow:`0 0 30px ${accent.glow}`,
        animation:'pulseGlow 3s ease-in-out infinite',position:'relative',zIndex:1}}>{slide.cta_text}</div>}
    </div>
  );
}

// ── Slide: EVENT ──────────────────────────────────────────────────────────────
function SlideEvent({slide,accent,theme}){
  const hasEndDate=slide.event_end_date&&slide.event_end_date!==slide.event_date;
  const dateStr=slide.event_date?format(parseISO(slide.event_date),'EEEE, d. MMMM',{locale:de}):'';
  const endDateStr=hasEndDate?format(parseISO(slide.event_end_date),'d. MMMM',{locale:de}):'';
  const timeStr=[slide.event_time,slide.event_end_time].filter(Boolean).join(' – ')+(slide.event_time?' Uhr':'');
  return(
    <div style={{position:'relative',display:'flex',flexDirection:'column',justifyContent:'center',
      alignItems:'center',height:'100%',padding:'80px 120px',textAlign:'center',gap:36}}>
      <ThemeBackground theme={theme} accent={accent}/>
      <SpotlightStreak color={accent.bg}/>
      <div style={{background:accent.soft,border:`1px solid ${accent.bg}`,borderRadius:8,
        padding:'6px 24px',position:'relative',zIndex:1,animation:'slideInUp 0.6s 0.1s both ease-out'}}>
        <span style={{fontSize:'0.85rem',color:accent.bg,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>EVENT</span>
      </div>
      <div style={{fontSize:'clamp(3rem,6.5vw,5rem)',fontWeight:900,lineHeight:1.05,letterSpacing:'-0.03em',
        background:`linear-gradient(90deg,#fff 0%,${accent.bg} 40%,#fff 60%,${accent.bg} 80%,#fff 100%)`,
        backgroundSize:'200% auto',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
        animation:'shimmer 4s linear infinite,slideInUp 0.7s 0.2s both ease-out',position:'relative',zIndex:1}}>{slide.title}</div>
      {slide.subtitle&&<div style={{fontSize:'1.8rem',color:'rgba(255,255,255,0.65)',
        animation:'slideInUp 0.7s 0.35s both ease-out',position:'relative',zIndex:1}}>{slide.subtitle}</div>}
      <div style={{display:'flex',gap:16,flexWrap:'wrap',justifyContent:'center',position:'relative',zIndex:1}}>
        {dateStr&&<div style={{background:'rgba(255,255,255,0.08)',borderRadius:12,padding:'12px 24px',fontWeight:600,fontSize:'1.1rem',color:'#fff',animation:'slideInUp 0.7s 0.5s both ease-out'}}>📅 {dateStr}{endDateStr?` – ${endDateStr}`:''}</div>}
        {timeStr&&<div style={{background:'rgba(255,255,255,0.08)',borderRadius:12,padding:'12px 24px',fontWeight:600,fontSize:'1.1rem',color:'#fff',animation:'slideInUp 0.7s 0.65s both ease-out'}}>🕐 {timeStr}</div>}
        {slide.location&&<div style={{background:'rgba(255,255,255,0.08)',borderRadius:12,padding:'12px 24px',fontWeight:600,fontSize:'1.1rem',color:'#fff',animation:'slideInUp 0.7s 0.8s both ease-out'}}>📍 {slide.location}</div>}
      </div>
      {slide.cta_text&&<div style={{background:accent.bg,color:accent.text,padding:'16px 48px',borderRadius:16,fontWeight:800,fontSize:'1.4rem',
        boxShadow:`0 0 30px ${accent.glow}`,animation:'slideInUp 0.7s 0.95s both ease-out,pulseGlow 3s 1.8s ease-in-out infinite',
        position:'relative',zIndex:1}}>{slide.cta_text}</div>}
    </div>
  );
}

// ── Slide: DRINK SPECIAL ──────────────────────────────────────────────────────
function SlideDrinkSpecial({slide,accent,theme}){
  let drinks=[];
  try{drinks=JSON.parse(slide.body_text||'[]');}catch{}
  if(!drinks.length) drinks=[{name:slide.title,price:slide.price_info,emoji:'🍹'}];
  const valid=drinks.filter(d=>d&&d.name);
  return(
    <div style={{position:'relative',display:'flex',flexDirection:'column',justifyContent:'center',
      alignItems:'center',height:'100%',padding:'60px 80px',textAlign:'center',gap:32}}>
      <ThemeBackground theme={theme} accent={accent}/>
      <ShimmerBars color={accent.bg}/>
      <div style={{background:accent.soft,border:`1px solid ${accent.bg}`,borderRadius:8,
        padding:'6px 24px',position:'relative',zIndex:1,animation:'fadeInScale 0.5s 0.1s both'}}>
        <span style={{fontSize:'0.85rem',color:accent.bg,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>DRINK SPECIAL</span>
      </div>
      {slide.title&&valid.length>1&&<div style={{fontSize:'clamp(2.5rem,5vw,4rem)',fontWeight:900,color:'#fff',
        letterSpacing:'-0.03em',animation:'slideInUp 0.6s 0.2s both ease-out',position:'relative',zIndex:1}}>{slide.title}</div>}
      <div style={{display:'flex',gap:24,flexWrap:'wrap',justifyContent:'center',width:'100%',position:'relative',zIndex:1}}>
        {valid.map((d,i)=>(
          <div key={i} style={{background:'rgba(255,255,255,0.06)',border:`2px solid ${accent.bg}44`,
            borderRadius:24,padding:'28px 36px',textAlign:'center',minWidth:180,flex:'1 1 180px',maxWidth:280,
            animation:`bounceIn 0.7s ${0.35+i*0.15}s both`}}>
            <div style={{fontSize:'2.8rem',marginBottom:12,display:'inline-block',animation:`drinkFloat ${3.5+i*0.5}s ${i*0.3}s ease-in-out infinite`}}>{d.emoji||'🍹'}</div>
            <div style={{fontSize:'1.3rem',fontWeight:800,color:'#fff',marginBottom:12}}>{d.name}</div>
            {d.price&&<div style={{display:'inline-block',padding:'8px 20px',borderRadius:12,
              background:accent.bg,color:accent.text,fontWeight:900,fontSize:'1.5rem',
              boxShadow:`0 0 20px ${accent.glow}`,backgroundImage:`linear-gradient(90deg,${accent.bg} 0%,#fff6 40%,${accent.bg} 60%,#fff6 80%,${accent.bg} 100%)`,
              backgroundSize:'200% auto',animation:'shimmer 3s linear infinite'}}>{d.price}</div>}
          </div>
        ))}
      </div>
      {slide.subtitle&&<div style={{fontSize:'1.3rem',color:'rgba(255,255,255,0.55)',position:'relative',zIndex:1,animation:'slideInUp 0.6s 0.9s both ease-out'}}>{slide.subtitle}</div>}
    </div>
  );
}

// ── Slide: COUNTDOWN ─────────────────────────────────────────────────────────
function SlideCountdown({slide,accent,theme}){
  const [now,setNow]=useState(new Date());
  useEffect(()=>{const iv=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(iv);},[]);
  if(!slide.event_date) return null;
  const target=parseISO(slide.event_date+(slide.event_time?'T'+slide.event_time:'T00:00:00'));
  const totalSec=differenceInSeconds(target,now);
  if(totalSec<0) return(
    <div style={{position:'relative',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:32,textAlign:'center'}}>
      <ThemeBackground theme={theme} accent={accent}/>
      <div style={{fontSize:'5rem',animation:'bounceIn 0.8s both',position:'relative',zIndex:1}}>🎉</div>
      <div style={{fontSize:'4rem',fontWeight:900,color:accent.bg,textShadow:`0 0 60px ${accent.glow}`,
        animation:'pulseGlow 2s ease-in-out infinite',position:'relative',zIndex:1}}>ES IST SOWEIT!</div>
      <div style={{fontSize:'2rem',color:'rgba(255,255,255,0.7)',fontWeight:600,position:'relative',zIndex:1}}>{slide.title}</div>
    </div>
  );
  const days=Math.floor(totalSec/86400),hours=Math.floor((totalSec%86400)/3600);
  const mins=Math.floor((totalSec%3600)/60),secs=totalSec%60;
  const units=days>0?[{v:days,l:'Tage'},{v:hours,l:'Std.'},{v:mins,l:'Min.'}]:[{v:hours,l:'Std.'},{v:mins,l:'Min.'},{v:secs,l:'Sek.'}];
  return(
    <div style={{position:'relative',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:40,textAlign:'center',padding:'60px 80px'}}>
      <ThemeBackground theme={theme} accent={accent}/>
      <PulseRings color={accent.bg}/>
      <div style={{background:accent.soft,border:`1px solid ${accent.bg}`,borderRadius:8,padding:'6px 24px',position:'relative',zIndex:1,animation:'fadeInScale 0.5s 0.1s both'}}>
        <span style={{fontSize:'0.85rem',color:accent.bg,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>Countdown</span>
      </div>
      <div style={{fontSize:'3.8rem',fontWeight:900,color:'#fff',lineHeight:1.05,letterSpacing:'-0.02em',
        textShadow:'0 2px 40px rgba(0,0,0,0.5)',animation:'slideInUp 0.6s 0.2s both ease-out',position:'relative',zIndex:1}}>{slide.title}</div>
      <div style={{display:'flex',gap:24,alignItems:'center',justifyContent:'center',position:'relative',zIndex:1}}>
        {units.map((u,i)=>(
          <div key={i} style={{textAlign:'center'}}>
            <div style={{background:'rgba(255,255,255,0.06)',border:`2px solid ${accent.bg}`,borderRadius:20,padding:'24px 36px',minWidth:130,
              boxShadow:`0 0 40px ${accent.glow}`,animation:`bounceIn 0.7s ${0.4+i*0.12}s both`,overflow:'hidden'}}>
              <div key={`${i}-${u.v}`} style={{fontSize:'5rem',fontWeight:900,color:'#fff',lineHeight:1,
                letterSpacing:'-0.04em',fontVariantNumeric:'tabular-nums',animation:'numberFlip 0.35s ease-out both'}}>
                {String(u.v).padStart(2,'0')}
              </div>
              <div style={{fontSize:'1rem',color:'rgba(255,255,255,0.5)',marginTop:8,fontWeight:600}}>{u.l}</div>
            </div>
          </div>
        ))}
      </div>
      {(slide.event_date||slide.event_time||slide.location)&&(
        <div style={{display:'flex',gap:16,flexWrap:'wrap',justifyContent:'center',position:'relative',zIndex:1}}>
          {slide.event_date&&<div style={{background:'rgba(255,255,255,0.08)',borderRadius:10,padding:'10px 22px',color:'#fff',fontWeight:600,fontSize:'1.1rem',animation:'slideInUp 0.6s 0.8s both ease-out'}}>📅 {format(parseISO(slide.event_date),'EEEE, d. MMMM yyyy',{locale:de})}</div>}
          {slide.event_time&&<div style={{background:'rgba(255,255,255,0.08)',borderRadius:10,padding:'10px 22px',color:'#fff',fontWeight:600,fontSize:'1.1rem',animation:'slideInUp 0.6s 0.95s both ease-out'}}>🕐 {slide.event_time} Uhr</div>}
          {slide.location&&<div style={{background:'rgba(255,255,255,0.08)',borderRadius:10,padding:'10px 22px',color:'#fff',fontWeight:600,fontSize:'1.1rem',animation:'slideInUp 0.6s 1.1s both ease-out'}}>📍 {slide.location}</div>}
        </div>
      )}
    </div>
  );
}

// ── Dot Nav ───────────────────────────────────────────────────────────────────
function DotNav({slides,currentIdx,accents}){
  return(
    <div style={{position:'absolute',bottom:20,left:'50%',transform:'translateX(-50%)',display:'flex',gap:8,zIndex:20}}>
      {slides.map((s,i)=>{
        const a=accents[s.accent_color]||accents.amber;
        return <div key={i} style={{height:6,width:i===currentIdx?24:6,borderRadius:3,
          background:i===currentIdx?a.bg:'rgba(255,255,255,0.2)',transition:'all 0.3s ease',
          boxShadow:i===currentIdx?`0 0 8px ${a.bg}`:'none'}}/>;
      })}
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function Display(){
  const [currentIdx,setCurrentIdx]=useState(0);
  const [isTransitioning,setIsTransitioning]=useState(false);
  const timerRef=useRef(null);
  useEffect(()=>{injectKeyframes();},[]);

  const {data}=useQuery({
    queryKey:['displaySlides'],
    queryFn:async()=>{
      const res=await fetch('/functions/getDisplaySlides');
      if(!res.ok) throw new Error('Fehler');
      const json=await res.json();
      const now=new Date().toISOString();
      return (json.slides||[])
        .filter(s=>{
          if(!s.is_active) return false;
          if(s.show_from&&now<s.show_from) return false;
          if(s.show_until&&now>s.show_until) return false;
          return true;
        })
        .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    },
    refetchInterval:30000,
  });

  const slides=data||[];
  useEffect(()=>{
    if(!slides.length) return;
    const dur=(slides[currentIdx]?.duration_seconds||8)*1000;
    timerRef.current=setTimeout(()=>{
      setIsTransitioning(true);
      setTimeout(()=>{setCurrentIdx(i=>(i+1)%slides.length);setIsTransitioning(false);},500);
    },dur);
    return()=>clearTimeout(timerRef.current);
  },[currentIdx,slides]);

  const slide=slides[currentIdx];
  const accent=slide?(ACCENTS[slide.accent_color]||ACCENTS.amber):ACCENTS.amber;
  const theme=slide?detectTheme(slide.title,slide.subtitle):'default';

  if(!slide) return(
    <div style={{background:'#0a0a0a',width:'100vw',height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}>
      <div style={{fontSize:'3rem',opacity:0.3}}>📺</div>
      <div style={{color:'rgba(255,255,255,0.4)',fontSize:'1.5rem',fontWeight:600}}>Keine aktiven Slides</div>
      <div style={{color:'rgba(255,255,255,0.2)',fontSize:'0.9rem'}}>Erstelle Slides im Display-Manager</div>
    </div>
  );

  return(
    <div style={{background:'#0a0a0a',width:'100vw',height:'100vh',overflow:'hidden',
      position:'relative',fontFamily:'"Inter",system-ui,sans-serif',color:'#fff'}}>
      <div style={{position:'absolute',inset:0,pointerEvents:'none',
        background:`radial-gradient(ellipse 80% 60% at 50% 100%,${accent.glow} 0%,transparent 70%)`,
        transition:'background 1s ease'}}/>
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:30,
        display:'flex',alignItems:'center',justifyContent:'space-between',padding:'28px 48px',
        background:'linear-gradient(to bottom,rgba(0,0,0,0.6),transparent)'}}>
        <div style={{fontSize:'1.6rem',fontWeight:800,letterSpacing:'-0.03em',opacity:0.9}}>
          <span style={{color:accent.bg}}>●</span> SAVO
        </div>
        <Clock/>
      </div>
      <div style={{position:'absolute',inset:0,opacity:isTransitioning?0:1,transition:'opacity 0.5s ease'}}>
        {slide.slide_type==='announcement' &&<SlideAnnouncement  slide={slide} accent={accent} theme={theme}/>}
        {slide.slide_type==='event'        &&<SlideEvent         slide={slide} accent={accent} theme={theme}/>}
        {slide.slide_type==='drink_special'&&<SlideDrinkSpecial  slide={slide} accent={accent} theme={theme}/>}
        {slide.slide_type==='countdown'    &&<SlideCountdown     slide={slide} accent={accent} theme={theme}/>}
      </div>
      {slides.length>1&&<DotNav slides={slides} currentIdx={currentIdx} accents={ACCENTS}/>}
      <ProgressBar duration={slide.duration_seconds||8} color={accent.bg} resetKey={currentIdx}/>
    </div>
  );
}
