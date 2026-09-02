/**
 * Display.jsx — Vollbild-Slideshow für Bar-TV
 * v8: Ambient Screen, elegante Crossfade-Übergänge, Loading Splash,
 *     typ-spezifische Slide-Dauern, 3D Animationen prominent
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInSeconds, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';

// ── Akzentfarben ──────────────────────────────────────────────────────────────
const ACCENTS = {
  amber:   { bg: '#f59e0b', glow: 'rgba(245,158,11,0.5)',  text: '#000', soft: 'rgba(245,158,11,0.15)' },
  orange:  { bg: '#f97316', glow: 'rgba(249,115,22,0.5)',  text: '#000', soft: 'rgba(249,115,22,0.15)' },
  red:     { bg: '#ef4444', glow: 'rgba(239,68,68,0.5)',   text: '#fff', soft: 'rgba(239,68,68,0.15)'  },
  rose:    { bg: '#f43f5e', glow: 'rgba(244,63,94,0.5)',   text: '#fff', soft: 'rgba(244,63,94,0.15)'  },
  pink:    { bg: '#ec4899', glow: 'rgba(236,72,153,0.5)',  text: '#fff', soft: 'rgba(236,72,153,0.15)' },
  fuchsia: { bg: '#d946ef', glow: 'rgba(217,70,239,0.5)',  text: '#fff', soft: 'rgba(217,70,239,0.15)' },
  purple:  { bg: '#a855f7', glow: 'rgba(168,85,247,0.5)',  text: '#fff', soft: 'rgba(168,85,247,0.15)' },
  violet:  { bg: '#7c3aed', glow: 'rgba(124,58,237,0.5)',  text: '#fff', soft: 'rgba(124,58,237,0.15)' },
  indigo:  { bg: '#6366f1', glow: 'rgba(99,102,241,0.5)',  text: '#fff', soft: 'rgba(99,102,241,0.15)' },
  blue:    { bg: '#3b82f6', glow: 'rgba(59,130,246,0.5)',  text: '#fff', soft: 'rgba(59,130,246,0.15)' },
  sky:     { bg: '#0ea5e9', glow: 'rgba(14,165,233,0.5)',  text: '#fff', soft: 'rgba(14,165,233,0.15)' },
  cyan:    { bg: '#06b6d4', glow: 'rgba(6,182,212,0.5)',   text: '#fff', soft: 'rgba(6,182,212,0.15)'  },
  teal:    { bg: '#14b8a6', glow: 'rgba(20,184,166,0.5)',  text: '#fff', soft: 'rgba(20,184,166,0.15)' },
  green:   { bg: '#22c55e', glow: 'rgba(34,197,94,0.5)',   text: '#000', soft: 'rgba(34,197,94,0.15)'  },
  lime:    { bg: '#84cc16', glow: 'rgba(132,204,22,0.5)',  text: '#000', soft: 'rgba(132,204,22,0.15)' },
  white:   { bg: '#f8fafc', glow: 'rgba(248,250,252,0.4)', text: '#000', soft: 'rgba(248,250,252,0.12)' },
};

// Slide-Typ → Default-Dauer in Sekunden
const TYPE_DURATION = { announcement: 10, event: 14, drink_special: 12, countdown: 16 };

// ── CSS Keyframes ─────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes floatUp     { 0%,100%{transform:translateY(0)}     50%{transform:translateY(-14px)} }
  @keyframes floatDown   { 0%,100%{transform:translateY(0)}     50%{transform:translateY(10px)}  }
  @keyframes pulseGlow   { 0%,100%{opacity:0.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
  @keyframes shimmer     { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes slideInUp   { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideInRight{ from{opacity:0;transform:translateX(60px)} to{opacity:1;transform:translateX(0)} }
  @keyframes bounceIn    { 0%{opacity:0;transform:scale(0.7)} 60%{transform:scale(1.08)} 80%{transform:scale(0.96)} 100%{opacity:1;transform:scale(1)} }
  @keyframes fadeInScale { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
  @keyframes numberFlip  { 0%{transform:translateY(-100%);opacity:0} 30%{transform:translateY(8%)} 100%{transform:translateY(0);opacity:1} }
  @keyframes drinkFloat  { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-10px) rotate(1deg)} }
  @keyframes shimmerBar  { 0%,100%{opacity:0.05} 50%{opacity:0.18} }
  @keyframes spotlight   { 0%{transform:translateX(-110%) skewX(-15deg)} 100%{transform:translateX(310%) skewX(-15deg)} }
  @keyframes ringPulse   { 0%{transform:scale(0.9);opacity:0.8} 50%{transform:scale(1.12);opacity:0.25} 100%{transform:scale(0.9);opacity:0.8} }
  @keyframes ambientPulse{ 0%,100%{opacity:0.15} 50%{opacity:0.35} }
  @keyframes clockTick   { 0%{opacity:1} 49%{opacity:1} 50%{opacity:0.2} 99%{opacity:0.2} 100%{opacity:1} }
  @keyframes loadSpin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes crossFadeIn { from{opacity:0;transform:scale(1.03)} to{opacity:1;transform:scale(1)} }
`;
const MENU_URL = 'https://bar-shift-pro-fc3522b9.base44.app/PublicDrinkMenu';


function injectKeyframes() {
  if (document.getElementById('savo-display-kf')) return;
  const s = document.createElement('style');
  s.id = 'savo-display-kf';
  s.textContent = KEYFRAMES;
  document.head.appendChild(s);
}

// ── Three.js Loader ───────────────────────────────────────────────────────────
// Three.js wird sofort beim Seitenstart geladen — nicht erst bei erstem Slide
let _THREE = null;
let _threePromise = null;
function loadThree() {
  if (_THREE) return Promise.resolve(_THREE);
  if (!_threePromise) {
    _threePromise = new Promise((resolve, reject) => {
      if (window.THREE) { _THREE = window.THREE; resolve(_THREE); return; }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.onload = () => { _THREE = window.THREE; resolve(_THREE); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return _threePromise;
}
// Sofort starten — nicht warten bis ein Slide es braucht
loadThree().catch(() => console.warn('Three.js konnte nicht geladen werden'));

// ── Zuverlässiger Canvas-Setup Hook ──────────────────────────────────────────
// Löst das "0×0 canvas"-Problem: wartet bis das Element im DOM gemessen werden kann
function useCanvas(drawFn) {
  const cvRef = useRef(null);
  const rafRef = useRef(null);
  const stopRef = useRef(null);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;

    function init() {
      const w = cv.offsetWidth;
      const h = cv.offsetHeight;
      if (w === 0 || h === 0) {
        // Noch nicht gerendert — nächsten Frame abwarten
        rafRef.current = requestAnimationFrame(init);
        return;
      }
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d');
      const cleanup = drawFn(ctx, w, h, cv);
      stopRef.current = cleanup;
    }

    rafRef.current = requestAnimationFrame(init);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (stopRef.current) stopRef.current();
    };
  }, []);

  return cvRef;
}



// ── Theme-Erkennung ───────────────────────────────────────────────────────────
function detectTheme(title = '', subtitle = '') {
  const txt = (title + ' ' + subtitle).toLowerCase();
  if (/deutsch|germany|german|dfb|schwarz.?rot.?gold/.test(txt)) return 'germany';
  if (/american.?football|nfl|touchdown|superbowl/.test(txt))    return 'american_football';
  if (/fußball|fussball|soccer|bundesliga|champions|euro |wm |em /.test(txt)) return 'soccer';
  if (/party|disco|club|dance|dj |rave|techno|house/.test(txt))  return 'disco';
  if (/live.?music|konzert|concert|band |rock |jazz/.test(txt))  return 'music';
  if (/bier|beer|pils|weizen|craft|brau/.test(txt))              return 'beer';
  if (/cocktail|drink|aperol|spritz|mojito|gin |vodka/.test(txt))return 'cocktail';
  if (/sommer|summer|beach|strand|ibiza/.test(txt))              return 'summer';
  if (/silvester|neujahr|new.?year|feuerwerk/.test(txt))         return 'fireworks';
  if (/halloween|horror|scary|zombie|geist/.test(txt))           return 'halloween';
  if (/weihnacht|christmas|xmas|advent/.test(txt))               return 'christmas';
  if (/valentine|liebe|love|herz|heart/.test(txt))               return 'love';
  if (/single|ladies|girls.?night|women/.test(txt))              return 'party';
  if (/pizza|burger|food|essen|brunch/.test(txt))                return 'food';
  return 'default';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3D SZENEN — Three.js
// ═══════════════════════════════════════════════════════════════════════════════

function useThreeScene(buildScene) {
  const mountRef = useRef(null);
  useEffect(() => {
    let renderer, animId;
    loadThree().then(T => {
      const el = mountRef.current; if (!el) return;
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.offsetWidth, el.offsetHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      el.appendChild(renderer.domElement);

      const { scene, camera, onFrame, onResize } = buildScene(T, el.offsetWidth, el.offsetHeight);

      const ro = new ResizeObserver(() => {
        const w = el.offsetWidth, h = el.offsetHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (onResize) onResize(w, h);
      });
      ro.observe(el); el._ro = ro;

      let t = 0;
      function loop() {
        animId = requestAnimationFrame(loop);
        t += 0.016;
        onFrame(t);
        renderer.render(scene, camera);
      }
      loop();
    }).catch(console.error);

    return () => {
      cancelAnimationFrame(animId);
      if (mountRef.current?._ro) mountRef.current._ro.disconnect();
      if (renderer) { renderer.dispose(); renderer.domElement?.remove(); }
    };
  }, []);
  return mountRef;
}

// 🪩 DISCO — Spiegelkugel prominent in der Mitte
function CanvasDiscoball() {
    const cvRef = useCanvas((ctx, W, H) => {
    let w = W, h = H;

    // Disco-Spots die über den Raum wandern
    const SPOT_COLS = ['#ff2255','#ff9900','#00ccff','#aa00ff','#00ff88','#ff44bb','#ffff00','#00ffee','#ff6600','#33ffcc'];
    const spots = Array.from({length: 12}, (_, i) => ({
      angle: (i / 12) * Math.PI * 2,
      speed: 0.004 + i * 0.0015,
      radius: 0.28 + (i % 3) * 0.09,
      color: SPOT_COLS[i % SPOT_COLS.length],
      size: 55 + (i % 4) * 22,
      elevation: 0.2 + (i % 4) * 0.18,
    }));

    // Glitzer-Partikel
    const sparks = Array.from({length: 80}, () => ({
      x: Math.random(), y: Math.random(),
      life: Math.random(), speed: 0.003 + Math.random() * 0.005,
      size: 1 + Math.random() * 3,
      color: SPOT_COLS[Math.floor(Math.random() * SPOT_COLS.length)],
    }));

    let t = 0;
    function draw() {
      
      ctx.clearRect(0, 0, w, h);

      // Wandernde Disco-Spots
      spots.forEach(s => {
        s.angle += s.speed;
        const cx = w * (0.2 + Math.cos(s.angle) * s.radius * 0.7 + 0.3);
        const cy = h * (0.15 + Math.abs(Math.sin(s.angle * s.elevation)) * 0.7);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s.size);
        grad.addColorStop(0, s.color + 'cc');
        grad.addColorStop(0.4, s.color + '44');
        grad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(cx, cy, s.size, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      // Glitzer
      sparks.forEach(s => {
        s.life += s.speed;
        if (s.life > 1) { s.life = 0; s.x = Math.random(); s.y = Math.random(); }
        const alpha = Math.sin(s.life * Math.PI);
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Disco-Kugel in der Mitte oben — als SVG-ähnliche Canvas-Zeichnung
      const bx = w * 0.5, by = h * 0.22, br = Math.min(w, h) * 0.11;

      // Kugel-Körper
      const ballGrad = ctx.createRadialGradient(bx - br*0.3, by - br*0.3, br*0.05, bx, by, br);
      ballGrad.addColorStop(0, '#e0e0f0');
      ballGrad.addColorStop(0.5, '#8888aa');
      ballGrad.addColorStop(1, '#333344');
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();

      // Kacheln auf der Kugel
      const ROWS = 8, COLS_N = 12;
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS_N; col++) {
          const phi = ((row + 0.5) / ROWS) * Math.PI;
          const theta = ((col + 0.5) / COLS_N) * Math.PI * 2 + t * 0.3;
          const px = bx + br * 0.92 * Math.sin(phi) * Math.cos(theta);
          const py = by + br * 0.92 * Math.cos(phi);
          const pz = Math.sin(phi) * Math.sin(theta); // -1 bis 1
          if (pz < 0) continue; // nur sichtbare Seite
          const tileSize = (br * 0.13) * Math.sin(phi);
          // Reflexionsfarbe basierend auf Spot-Nähe
          const nearSpot = spots.reduce((best, s) => {
            const sx = w * (0.2 + Math.cos(s.angle) * s.radius * 0.7 + 0.3);
            const sy = h * (0.15 + Math.abs(Math.sin(s.angle * s.elevation)) * 0.7);
            const d = Math.hypot(sx - px, sy - py);
            return d < best.d ? { d, color: s.color } : best;
          }, { d: Infinity, color: '#ffffff' });
          const brightness = Math.max(0, pz);
          ctx.globalAlpha = 0.6 + brightness * 0.4;
          ctx.fillStyle = nearSpot.d < 120 ? nearSpot.color : `rgba(${180+brightness*75},${180+brightness*75},${200+brightness*55},0.9)`;
          ctx.fillRect(px - tileSize/2, py - tileSize/2, tileSize * 0.85, tileSize * 0.85);
        }
      }
      ctx.globalAlpha = 1;

      // Highlight oben links
      const hlGrad = ctx.createRadialGradient(bx - br*0.35, by - br*0.35, 0, bx - br*0.35, by - br*0.35, br*0.5);
      hlGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
      hlGrad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = hlGrad;
      ctx.fill();

      // Aufhängung
      ctx.strokeStyle = 'rgba(200,200,220,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by - br);
      ctx.lineTo(bx, 0);
      ctx.stroke();

      t += 0.016;
    }
    let raf;
    function loop() { draw(); raf = requestAnimationFrame(loop); }
    loop();
    return () => cancelAnimationFrame(raf);
  });
  return <canvas ref={cvRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />;
}


function GermanyFlag2D() {
  const canvasRef = useCanvas((ctx, W_init, H_init) => {
    const canvas = canvasRef.current;
    const SEGS = 80;
    let t = 0;

    function draw() {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Fahne zentriert — kein Mast, korrektes 3:5 Seitenverhältnis
      const flagW = W * 0.68;
      const flagH = flagW * 0.6;   // 3:5 = Höhe ist 60% der Breite
      const startX = (W - flagW) / 2;
      const startY = (H - flagH) / 2;
      const sH = flagH / 3;

      // Mehr Amplitude & 2 Wellenmodi
      const COLORS = [
        ['#111111', '#252525'],
        ['#cc0000', '#ee1111'],
        ['#ffcc00', '#ffe033'],
      ];

      COLORS.forEach((cols, si) => {
        const sy0 = startY + si * sH;
        const top = [], bot = [];

        for (let xi = 0; xi <= SEGS; xi++) {
          const nx  = xi / SEGS;
          const px  = startX + nx * flagW;

          // Stärkere Wellenamplitude — von links (0) nach rechts (max)
          const amp = nx * nx * sH * 0.14;

          // Zwei überlagerte Wellen für natürlichere Bewegung
          const w1 = Math.sin(nx * Math.PI * 2.4 - t * 2.2) * amp;
          const w2 = Math.sin(nx * Math.PI * 4.8 - t * 1.4) * amp * 0.35;
          const w3 = Math.sin(nx * Math.PI * 1.1 - t * 0.8) * amp * 0.18;

          const wave = w1 + w2 + w3;
          top.push({ x: px, y: sy0 + wave });
          bot.push({ x: px, y: sy0 + sH + wave * 0.92 });
        }

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(top[0].x, top[0].y);
        top.forEach(p => ctx.lineTo(p.x, p.y));
        [...bot].reverse().forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();

        const g = ctx.createLinearGradient(startX, 0, startX + flagW, 0);
        g.addColorStop(0,    cols[0] + 'dd');
        g.addColorStop(0.35, cols[1]);
        g.addColorStop(0.7,  cols[1] + 'ee');
        g.addColorStop(1,    cols[0] + 'aa');
        ctx.fillStyle = g;
        ctx.fill();

        // Leichter Glanz oben auf jedem Streifen
        const gloss = ctx.createLinearGradient(0, sy0, 0, sy0 + sH * 0.45);
        gloss.addColorStop(0, 'rgba(255,255,255,0.12)');
        gloss.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gloss;
        ctx.fill();

        ctx.strokeStyle = 'rgba(0,0,0,0.10)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      });

      t += 0.016;
    }

    let _raf;
    function _loop() { draw(); _raf = requestAnimationFrame(_loop); }
    _loop();
    return () => cancelAnimationFrame(_raf);
  });

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.60, pointerEvents: 'none' }} />;
}


// 🎆 FEUERWERK
function Fireworks3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(70, W / H, 0.1, 200);
    camera.position.set(0, 0, 9);

    const starPos = new Float32Array(3000 * 3);
    for (let i = 0; i < 3000 * 3; i++) starPos[i] = (Math.random() - 0.5) * 80;
    const starGeo = new T.BufferGeometry(); starGeo.setAttribute('position', new T.BufferAttribute(starPos, 3));
    scene.add(new T.Points(starGeo, new T.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.45 })));

    const MAX = 3500;
    const pGeo = new T.BufferGeometry();
    const pPos = new Float32Array(MAX * 3), pCol = new Float32Array(MAX * 3), pSz = new Float32Array(MAX);
    pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color',    new T.BufferAttribute(pCol, 3));
    pGeo.setAttribute('size',     new T.BufferAttribute(pSz,  1));
    const pMat = new T.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
    const pSystem = new T.Points(pGeo, pMat); scene.add(pSystem);

    const COLS = [[1,0.13,0.4],[1,0.6,0],[0,0.87,1],[0.67,0,1],[0,1,0.53],[1,0.27,0.73],[1,1,0.2]];
    const rockets = [], particles = [];

    function spawnRocket() {
      rockets.push({ x:(Math.random()-0.5)*8, y:-4.5, z:(Math.random()-0.5)*2, vy:0.13+Math.random()*0.07, vx:(Math.random()-0.5)*0.04, col:COLS[Math.floor(Math.random()*COLS.length)] });
    }
    function explode(x,y,z,col) {
      for (let i=0;i<120+Math.floor(Math.random()*80);i++) {
        const a=Math.random()*Math.PI*2, p=Math.random()*Math.PI, sp=0.045+Math.random()*0.11;
        particles.push({ x,y,z, vx:Math.sin(p)*Math.cos(a)*sp, vy:Math.sin(p)*Math.sin(a)*sp, vz:Math.cos(p)*sp,
          r:col[0],g:col[1],b:col[2], life:1, decay:0.009+Math.random()*0.016, sz:0.11+Math.random()*0.13, grav:0.0009 });
      }
    }

    let nextRocket = 0;
    return {
      scene, camera,
      onFrame(t) {
        if (t > nextRocket) { spawnRocket(); nextRocket = t + 1.4 + Math.random() * 1.8; }
        for (let i=rockets.length-1;i>=0;i--) {
          const r=rockets[i]; r.x+=r.vx; r.y+=r.vy; r.vy-=0.0012;
          if (r.vy<0.01) { explode(r.x,r.y,r.z,r.col); rockets.splice(i,1); }
        }
        for (let i=particles.length-1;i>=0;i--) {
          const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.z+=p.vz;
          p.vy-=p.grav; p.vx*=0.982; p.vz*=0.982; p.life-=p.decay;
          if (p.life<=0) particles.splice(i,1);
        }
        if (particles.length>MAX) particles.splice(0,particles.length-MAX);
        const n=Math.min(particles.length,MAX);
        for (let i=0;i<n;i++) {
          const p=particles[i];
          pPos[i*3]=p.x; pPos[i*3+1]=p.y; pPos[i*3+2]=p.z;
          pCol[i*3]=p.r*p.life; pCol[i*3+1]=p.g*p.life; pCol[i*3+2]=p.b*p.life;
          pSz[i]=p.sz*p.life;
        }
        pGeo.setDrawRange(0,n);
        pGeo.attributes.position.needsUpdate=true; pGeo.attributes.color.needsUpdate=true; pGeo.attributes.size.needsUpdate=true;
        starGeo.attributes.position.array[0] = Math.sin(t) * 0.001; // micro-update to refresh
        starGeo.attributes.position.needsUpdate = false;
        camera.position.x = Math.sin(t*0.045)*0.6;
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
}

// ⚽ SOCCER
function Soccer3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 1.8, 6.5); camera.lookAt(0, 0, 0);
    scene.add(new T.AmbientLight(0x224422, 0.5));
    const sun = new T.DirectionalLight(0xffffff, 1.8); sun.position.set(5, 9, 5); sun.castShadow=true; scene.add(sun);

    const grass = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshLambertMaterial({ color: 0x1a5c1a }));
    grass.rotation.x=-Math.PI/2; grass.position.y=-1.3; grass.receiveShadow=true; scene.add(grass);

    const ball = new T.Mesh(new T.SphereGeometry(0.62, 36, 36), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
    ball.castShadow=true; ball.position.y=-0.68; scene.add(ball);
    [[0,0.63,0],[0,-0.63,0],[0.59,0.22,0.17],[-0.59,0.22,0.17],[0.36,0.22,-0.49],[-0.36,0.22,-0.49],[0,0.22,0.59]].forEach(([px,py,pz]) => {
      const p = new T.Mesh(new T.CircleGeometry(0.17,5), new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
      const n = new T.Vector3(px,py,pz).normalize();
      p.position.copy(n.multiplyScalar(0.63)); p.lookAt(p.position.clone().multiplyScalar(2)); ball.add(p);
    });

    return {
      scene, camera,
      onFrame(t) {
        ball.position.x=Math.sin(t*0.42)*2.8; ball.position.z=Math.cos(t*0.31)*0.9;
        ball.rotation.z=-t*1.6; ball.rotation.x=t*0.85;
        camera.position.x=Math.sin(t*0.055)*0.9; camera.lookAt(0,0,0);
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, opacity: 0.45, pointerEvents: 'none' }} />;
}

// 🏈 AMERICAN FOOTBALL
function AmericanFootball3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 2, 7.5); camera.lookAt(0, 0.2, 0);
    scene.add(new T.AmbientLight(0x334422, 0.4));
    const spot = new T.SpotLight(0xffffff, 2.5, 22, Math.PI/5, 0.4);
    spot.position.set(0, 9, 4); spot.castShadow=true; scene.add(spot);

    const field = new T.Mesh(new T.PlaneGeometry(18,12), new T.MeshLambertMaterial({color:0x1a4a0a}));
    field.rotation.x=-Math.PI/2; field.position.y=-1.9; field.receiveShadow=true; scene.add(field);

    function makeBall(group) {
      const fb = new T.Mesh(new T.SphereGeometry(0.38,28,18), new T.MeshStandardMaterial({color:0x7B3A10,roughness:0.55,metalness:0.05}));
      fb.scale.set(1,0.62,1); fb.castShadow=true; group.add(fb);
      group.add(Object.assign(new T.Mesh(new T.TorusGeometry(0.39,0.009,8,32), new T.MeshBasicMaterial({color:0xffffff})), { rotation: new T.Euler(0,Math.PI/2,0) }));
    }

    const groups = [new T.Group(), new T.Group()];
    groups.forEach(g => { makeBall(g); scene.add(g); });

    return {
      scene, camera,
      onFrame(t) {
        groups.forEach((g,i) => {
          const phase=t*0.42+i*Math.PI;
          g.position.x=Math.sin(phase)*3.5;
          g.position.y=Math.abs(Math.cos(phase*0.5))*1.3-0.4;
          g.position.z=(i===1?-1.5:0)+Math.cos(phase*0.3)*0.5;
          g.rotation.z=t*(i===0?4:-3.5);
        });
        camera.position.x=Math.sin(t*0.045)*0.7; camera.lookAt(0,0.2,0);
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, opacity: 0.45, pointerEvents: 'none' }} />;
}

// ❤️ LOVE
function CanvasLove() {
  const cvRef = useCanvas((ctx, W, H) => {
    const COLS = ['#ff2255','#ff66aa','#ff44bb','#dd0066','#ff88cc','#ee0055','#ff3377','#cc0044','#ff99bb','#ee1177'];
    // Herz per Canvas-Path zeichnen
    function drawHeart(ctx, x, y, size) {
      ctx.beginPath();
      ctx.moveTo(x, y + size * 0.3);
      ctx.bezierCurveTo(x, y, x - size * 0.5, y, x - size * 0.5, y + size * 0.3);
      ctx.bezierCurveTo(x - size * 0.5, y + size * 0.65, x, y + size * 0.9, x, y + size);
      ctx.bezierCurveTo(x, y + size * 0.9, x + size * 0.5, y + size * 0.65, x + size * 0.5, y + size * 0.3);
      ctx.bezierCurveTo(x + size * 0.5, y, x, y, x, y + size * 0.3);
      ctx.closePath();
    }
    const hearts = Array.from({length: 22}, () => ({
      x: Math.random() * W,
      y: H + Math.random() * H * 0.6,
      size: 20 + Math.random() * 55,
      vy: -(0.5 + Math.random() * 1.1),
      vx: (Math.random() - 0.5) * 0.5,
      wb: Math.random() * Math.PI * 2,
      ws: 0.012 + Math.random() * 0.02,
      rot: (Math.random() - 0.5) * 0.4,
      color: COLS[Math.floor(Math.random() * COLS.length)],
      op: 0.35 + Math.random() * 0.5,
    }));
    function draw() {
      ctx.clearRect(0, 0, W, H);
      hearts.forEach(h => {
        h.wb += h.ws;
        h.x += h.vx + Math.sin(h.wb) * 0.6;
        h.y += h.vy;
        if (h.y < -h.size * 2) { h.y = H + h.size; h.x = Math.random() * W; }
        const fade = Math.min(1, (H - h.y) / (H * 0.5)) * h.op;
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        ctx.translate(h.x, h.y);
        ctx.rotate(h.rot + Math.sin(h.wb * 0.5) * 0.12);
        ctx.translate(-h.x, -h.y);
        // Glow
        ctx.shadowColor = h.color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = h.color;
        drawHeart(ctx, h.x - h.size * 0.5, h.y - h.size * 0.5, h.size);
        ctx.fill();
        ctx.restore();
      });
    }
    let raf;
    function loop() { draw(); raf = requestAnimationFrame(loop); }
    loop();
    return () => cancelAnimationFrame(raf);
  });
  return <canvas ref={cvRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', opacity:0.85 }} />;
}

// 🎉 PARTY
function Party3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(65, W / H, 0.1, 100);
    camera.position.set(0, 0, 10);
    scene.add(new T.AmbientLight(0xffffff, 0.7));
    scene.add(Object.assign(new T.PointLight(0xff88ff, 2.5, 22), { position: new T.Vector3(0, 5, 3) }));

    const CCOLS=[0xff3366,0xff9900,0x00ddff,0xaa00ff,0x00ff88,0xffff44,0xff44bb,0x00aaff];
    const pieces = Array.from({length:130},(_,i) => {
      const c=CCOLS[i%CCOLS.length], sh=i%4;
      const geo = sh===0?new T.PlaneGeometry(0.16,0.24):sh===1?new T.CircleGeometry(0.1,6):sh===2?new T.PlaneGeometry(0.22,0.09):new T.CircleGeometry(0.09,3);
      const m = new T.Mesh(geo, new T.MeshLambertMaterial({color:c,side:T.DoubleSide,transparent:true,opacity:0.92}));
      m.position.set((Math.random()-0.5)*13, 5+Math.random()*9, (Math.random()-0.5)*3.5);
      m.userData={vy:-(0.042+Math.random()*0.065),vx:(Math.random()-0.5)*0.024,wb:Math.random()*Math.PI*2,ws:0.03+Math.random()*0.045,rx:(Math.random()-0.5)*0.09,ry:(Math.random()-0.5)*0.09,rz:(Math.random()-0.5)*0.055};
      scene.add(m); return m;
    });

    return {
      scene, camera,
      onFrame(t) {
        pieces.forEach(p => {
          p.userData.wb+=p.userData.ws;
          p.position.y+=p.userData.vy; p.position.x+=p.userData.vx+Math.sin(p.userData.wb)*0.022;
          p.rotation.x+=p.userData.rx; p.rotation.y+=p.userData.ry; p.rotation.z+=p.userData.rz;
          if (p.position.y<-6) { p.position.y=7+Math.random()*4; p.position.x=(Math.random()-0.5)*13; }
        });
        camera.position.x=Math.sin(t*0.032)*0.35;
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, opacity: 0.65, pointerEvents: 'none' }} />;
}

// ❄️ CHRISTMAS
function Christmas3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(65, W / H, 0.1, 100);
    camera.position.set(0, 0, 9);
    scene.add(new T.AmbientLight(0xaabbff, 0.5));

    const N=700;
    const fPos=new Float32Array(N*3), fSz=new Float32Array(N);
    const fVy=new Float32Array(N), fWb=new Float32Array(N), fWs=new Float32Array(N);
    for (let i=0;i<N;i++) {
      fPos[i*3]=(Math.random()-0.5)*16; fPos[i*3+1]=(Math.random()-0.5)*11; fPos[i*3+2]=(Math.random()-0.5)*7;
      fSz[i]=0.045+Math.random()*0.1; fVy[i]=0.016+Math.random()*0.022; fWb[i]=Math.random()*Math.PI*2; fWs[i]=0.01+Math.random()*0.015;
    }
    const fGeo=new T.BufferGeometry();
    fGeo.setAttribute('position',new T.BufferAttribute(fPos,3)); fGeo.setAttribute('size',new T.BufferAttribute(fSz,1));
    scene.add(new T.Points(fGeo, new T.PointsMaterial({color:0xddeeff,size:0.08,transparent:true,opacity:0.88,blending:T.AdditiveBlending,depthWrite:false})));

    return {
      scene, camera,
      onFrame(t) {
        const wind=Math.sin(t*0.18)*0.009;
        for (let i=0;i<N;i++) {
          fWb[i]+=fWs[i];
          fPos[i*3+1]-=fVy[i]; fPos[i*3]+=wind+Math.sin(fWb[i]+i)*0.003;
          if (fPos[i*3+1]<-5.5) fPos[i*3+1]=5.5;
        }
        fGeo.attributes.position.needsUpdate=true;
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none' }} />;
}

// ── 2D Canvas Animationen ─────────────────────────────────────────────────────
function CanvasBeer() {
  const c = useCanvas((ctx, W, H) => {
    const bs=Array.from({length:35},()=>({x:Math.random()*W,y:H+Math.random()*H*0.5,rad:4+Math.random()*14,vy:-(0.6+Math.random()*1.4),vx:(Math.random()-0.5)*0.5,wb:Math.random()*Math.PI*2,ws:0.02+Math.random()*0.04,op:0.4+Math.random()*0.4}));
    function draw(){
      ctx.clearRect(0,0,W,H);
      bs.forEach(b=>{b.wb+=b.ws;b.x+=b.vx+Math.sin(b.wb)*0.4;b.y+=b.vy;if(b.y<-b.rad*2){b.y=H+b.rad;b.x=Math.random()*W;}
        const al=Math.min(1,(-b.y+H)/(H*0.7))*b.op*0.35;ctx.globalAlpha=al;
        const g=ctx.createRadialGradient(b.x-b.rad*0.35,b.y-b.rad*0.35,b.rad*0.05,b.x,b.y,b.rad);
        g.addColorStop(0,'rgba(255,240,180,0.9)');g.addColorStop(0.5,'rgba(220,180,80,0.4)');g.addColorStop(1,'rgba(180,140,40,0.1)');
        ctx.beginPath();ctx.arc(b.x,b.y,b.rad,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
        ctx.strokeStyle='rgba(255,230,100,0.6)';ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;});
    }
    let _raf;
    function _loop() { draw(); _raf = requestAnimationFrame(_loop); }
    _loop();
    return () => cancelAnimationFrame(_raf);
  });

  return <canvas ref={c} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>;
}

function CanvasCocktail() {
  const c = useCanvas((ctx, W, H) => {
    const COLS=['#f43f5e','#a855f7','#06b6d4','#f59e0b','#22c55e','#ec4899','#3b82f6'];
    const bs=Array.from({length:20},(_,i)=>({x:Math.random()*W,y:H+Math.random()*H*0.6,r:10+Math.random()*28,vy:-(0.5+Math.random()*1.2),vx:(Math.random()-0.5)*0.6,color:COLS[i%COLS.length],wb:Math.random()*Math.PI*2,ws:0.015+Math.random()*0.03}));
    function draw(){
      ctx.clearRect(0,0,W,H);
      bs.forEach(b=>{b.wb+=b.ws;b.x+=b.vx+Math.sin(b.wb)*0.5;b.y+=b.vy;if(b.y<-b.r*3){b.y=H+b.r;b.x=Math.random()*W;}
        const al=Math.min(1,(-b.y+H)/(H*0.65))*0.45;ctx.globalAlpha=al;
        const rx=b.r*(1+Math.sin(b.wb*2)*0.12),ry=b.r*(1+Math.cos(b.wb*2)*0.12);
        const g=ctx.createRadialGradient(b.x-rx*0.3,b.y-ry*0.3,rx*0.05,b.x,b.y,rx);
        g.addColorStop(0,b.color+'ff');g.addColorStop(0.6,b.color+'88');g.addColorStop(1,b.color+'11');
        ctx.beginPath();ctx.ellipse(b.x,b.y,rx,ry,b.wb*0.2,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.globalAlpha=1;});
    }
    let _raf;
    function _loop() { draw(); _raf = requestAnimationFrame(_loop); }
    _loop();
    return () => cancelAnimationFrame(_raf);
  });

  return <canvas ref={c} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>;
}

function CanvasSummer() {
  const c = useCanvas((ctx, W, H) => {
    let t=0;
    function draw(){
      ctx.clearRect(0,0,W,H);
      const sx=W*0.85,sy=H*0.15,sr=80;
      ctx.globalAlpha=0.2;
      for(let ray=0;ray<12;ray++){
        const a=(ray/12)*Math.PI*2+t*0.00008;
        const r1=sr+10,r2=sr+40+Math.sin(t*0.0005+ray)*15;
        ctx.strokeStyle='#fde68a';ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(sx+Math.cos(a)*r1,sy+Math.sin(a)*r1);ctx.lineTo(sx+Math.cos(a)*r2,sy+Math.sin(a)*r2);ctx.stroke();
      }
      const sg=ctx.createRadialGradient(sx,sy,sr*0.1,sx,sy,sr*1.5);
      sg.addColorStop(0,'#fde68a');sg.addColorStop(1,'transparent');
      ctx.beginPath();ctx.arc(sx,sy,sr*1.5,0,Math.PI*2);ctx.fillStyle=sg;ctx.globalAlpha=0.28;ctx.fill();
      ctx.globalAlpha=0.4;
      for(let wave=0;wave<4;wave++){
        const yBase=H*(0.65+wave*0.1),amp=H*0.025*(4-wave);
        const sp=(1-wave*0.15)*0.012;
        ctx.beginPath();
        for(let x=0;x<=W;x+=3){
          const y=yBase+Math.sin(x/W*Math.PI*4-t*sp+wave)*amp + Math.sin(x/W*Math.PI*2.5-t*sp*0.6+wave*0.7)*amp*0.4;
          x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
        const wg=ctx.createLinearGradient(0,yBase,0,H);
        wg.addColorStop(0,'rgba(56,189,248,0.18)');wg.addColorStop(1,'rgba(14,165,233,0.08)');
        ctx.fillStyle=wg;ctx.fill();
      }
      ctx.globalAlpha=1;t++;
    }
    let _raf;
    function _loop() { draw(); _raf = requestAnimationFrame(_loop); }
    _loop();
    return () => cancelAnimationFrame(_raf);
  });

  return <canvas ref={c} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>;
}

function CanvasMusic({ accentColor }) {
   const c = useCanvas((ctx, W, H) => {
     let t=0;const BAR=60;
     const hs=Array.from({length:BAR},()=>({h:0.1+Math.random()*0.5,target:0.1+Math.random()*0.6,speed:0.02+Math.random()*0.04,phase:Math.random()*Math.PI*2}));
     function draw(){
       ctx.clearRect(0,0,W,H);
       hs.forEach((b,i)=>{
         b.h+=(b.target-b.h)*b.speed;
         if(Math.abs(b.h-b.target)<0.01)b.target=0.05+Math.random()*0.7*Math.abs(Math.sin(t+b.phase));
         const bw=W/BAR-2,bh=b.h*H*0.55+Math.sin(t*2+b.phase)*H*0.03,bx=i*(W/BAR)+1,by=H*0.78-bh;
         const g=ctx.createLinearGradient(bx,by,bx,H*0.78);
         g.addColorStop(0,accentColor+'ff');g.addColorStop(0.5,accentColor+'aa');g.addColorStop(1,accentColor+'33');
         ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(bx,by,bw,bh,3);ctx.fill();
         ctx.globalAlpha=0.12;ctx.beginPath();ctx.roundRect(bx,H*0.78,bw,bh*0.4,3);ctx.fill();ctx.globalAlpha=1;
       });
       t+=0.022;
     }
     let _raf;
     function _loop() { draw(); _raf = requestAnimationFrame(_loop); }
     _loop();
     return () => cancelAnimationFrame(_raf);
   });

   return <canvas ref={c} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.4,pointerEvents:'none'}}/>;
}

// ── Theme-Router ──────────────────────────────────────────────────────────────
function ThemeBackground({ theme, accent, prominentDisco = false }) {
  switch (theme) {
    case 'germany':           return <GermanyFlag2D />;
    case 'american_football': return <AmericanFootball3D />;
    case 'soccer':            return <Soccer3D />;
    case 'disco':             return <CanvasDiscoball />;
    case 'music':             return <CanvasMusic accentColor={accent.bg} />;
    case 'beer':              return <CanvasBeer />;
    case 'cocktail':          return <CanvasCocktail />;
    case 'summer':            return <CanvasSummer />;
    case 'fireworks':         return <Fireworks3D />;
    case 'christmas':         return <Christmas3D />;
    case 'love':              return <CanvasLove />;
    case 'party':             return <Party3D />;
    default:                  return <Party3D />;
  }
}

// ── Overlay Helfer ─────────────────────────────────────────────────────────────
function SpotlightStreak({color}){return(<div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>{[0,1,2].map(i=>(<div key={i} style={{position:'absolute',top:`${15+i*28}%`,left:0,width:'35%',height:i===1?3:1.5,background:`linear-gradient(90deg,transparent,${color},transparent)`,opacity:i===1?0.5:0.2,animation:`spotlight ${3.5+i*1.2}s ${i*0.8}s ease-in-out infinite`}}/>))}</div>);}
function ShimmerBars({color}){return(<div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>{[0,1,2,3].map(i=>(<div key={i} style={{position:'absolute',left:0,right:0,top:`${20+i*20}%`,height:1,background:`linear-gradient(90deg,transparent,${color},transparent)`,animation:`shimmerBar ${2.5+i*0.6}s ${i*0.4}s ease-in-out infinite`}}/>))}</div>);}
function PulseRings({color}){return(<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>{[0,1,2].map(i=>(<div key={i} style={{position:'absolute',width:500+i*200,height:500+i*200,borderRadius:'50%',border:`1px solid ${color}`,opacity:0,animation:`ringPulse ${2.5+i*0.7}s ${i*0.6}s ease-in-out infinite`}}/>))}</div>);}

// ── Uhr ────────────────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1, color: '#fff', letterSpacing: '-0.02em' }}>
        {format(time, 'HH:mm')}
      </div>
      <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
        {format(time, 'EEEE, d. MMMM', { locale: de })}
      </div>
    </div>
  );
}

// ── Progress Bar ───────────────────────────────────────────────────────────────
function ProgressBar({ duration, color, resetKey }) {
  const [p, setP] = useState(0);
  const sr = useRef(Date.now());
  useEffect(() => {
    setP(0); sr.current = Date.now();
    const iv = setInterval(() => setP(Math.min((Date.now() - sr.current) / 1000 / duration, 1)), 50);
    return () => clearInterval(iv);
  }, [duration, resetKey]);
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, background: 'rgba(255,255,255,0.08)' }}>
      <div style={{ height: '100%', width: `${p * 100}%`, background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 0.05s linear', borderRadius: '0 3px 3px 0' }} />
    </div>
  );
}

// ── Dot Navigation ─────────────────────────────────────────────────────────────
function DotNav({ slides, currentIdx }) {
  return (
    <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 20 }}>
      {slides.map((s, i) => {
        const a = ACCENTS[s.accent_color] || ACCENTS.amber;
        return <div key={i} style={{ height: 6, width: i === currentIdx ? 28 : 6, borderRadius: 3, background: i === currentIdx ? a.bg : 'rgba(255,255,255,0.2)', transition: 'all 0.4s ease', boxShadow: i === currentIdx ? `0 0 10px ${a.bg}` : 'none' }} />;
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOADING SPLASH
// ══════════════════════════════════════════════════════════════════════════════
function LoadingSplash() {
  return (
    <div style={{ background: '#050508', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
      {/* Ambient Hintergrund */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      {/* Spinner */}
      <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#6366f1', animation: 'loadSpin 0.9s linear infinite' }} />
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', fontWeight: 500, letterSpacing: '0.08em' }}>DISPLAY LÄDT …</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AMBIENT SCREEN — läuft wenn keine Slides aktiv sind
// ══════════════════════════════════════════════════════════════════════════════
function AmbientScreen() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const hh = time.getHours(), mm = time.getMinutes(), ss = time.getSeconds();

  return (
    <div style={{ background: '#050508', width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '"Inter",system-ui,sans-serif' }}>

      {/* Sanfte Ambient-Lichter im Hintergrund */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '20%', left: '15%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', animation: 'ambientPulse 5s 0s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,63,94,0.10) 0%, transparent 70%)', animation: 'ambientPulse 7s 1.5s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.07) 0%, transparent 70%)', animation: 'ambientPulse 9s 3s ease-in-out infinite' }} />
      </div>

      {/* Dezente Gitterlinien */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />

      {/* Große Uhr */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 'clamp(6rem, 18vw, 14rem)', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.05em', color: '#ffffff', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 80px rgba(99,102,241,0.4), 0 2px 40px rgba(0,0,0,0.8)' }}>
          {String(hh).padStart(2,'0')}
          <span style={{ animation: 'clockTick 1s step-start infinite', display: 'inline-block', marginInline: '0.05em', color: 'rgba(255,255,255,0.5)' }}>:</span>
          {String(mm).padStart(2,'0')}
        </div>

        {/* Sekunden */}
        <div style={{ fontSize: '2rem', fontWeight: 300, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.2em', marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
          :{String(ss).padStart(2,'0')}
        </div>

        {/* Datum */}
        <div style={{ fontSize: '1.5rem', fontWeight: 400, color: 'rgba(255,255,255,0.35)', marginTop: 24, letterSpacing: '0.06em' }}>
          {format(time, 'EEEE, d. MMMM yyyy', { locale: de })}
        </div>

        {/* Subtiler Hinweis */}
        <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'ambientPulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 }}>Display bereit</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE-TYPEN
// ══════════════════════════════════════════════════════════════════════════════

function SlideAnnouncement({ slide, accent, theme }) {
  const isDiscoParty = theme === 'disco' || theme === 'party';
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: isDiscoParty ? 'flex-end' : 'center', alignItems: 'center', height: '100%', padding: isDiscoParty ? '40px 100px 120px' : '80px 120px', textAlign: 'center', gap: 28 }}>
      <ThemeBackground theme={theme} accent={accent} prominentDisco />
      <div style={{ fontSize: 'clamp(4.2rem,9.5vw,8rem)', fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.03em', textShadow: `0 2px 40px rgba(0,0,0,0.9),0 0 80px ${accent.glow}`, animation: 'floatUp 5s ease-in-out infinite', position: 'relative', zIndex: 1 }}>{slide.title}</div>
      {slide.subtitle && <div style={{ fontSize: '2.6rem', color: 'rgba(255,255,255,0.85)', animation: 'floatDown 6s ease-in-out infinite', position: 'relative', zIndex: 1, textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>{slide.subtitle}</div>}
      {slide.body_text && <div style={{ fontSize: '1.7rem', color: 'rgba(255,255,255,0.65)', maxWidth: 950, position: 'relative', zIndex: 1, textShadow: '0 2px 10px rgba(0,0,0,0.9)' }}>{slide.body_text}</div>}
      {slide.cta_text && <div style={{ background: accent.bg, color: accent.text, padding: '24px 64px', borderRadius: 20, fontWeight: 800, fontSize: '2rem', boxShadow: `0 0 30px ${accent.glow},0 4px 20px rgba(0,0,0,0.6)`, animation: 'pulseGlow 3s ease-in-out infinite', position: 'relative', zIndex: 1 }}>{slide.cta_text}</div>}
    </div>
  );
}

// ── QR-Code auf der Slide (nur wenn Manager "public_event" aktiviert hat) ────
function SlideQR({ slideId }) {
    const [qr, setQr] = useState(null);
    useEffect(() => {
        let alive = true;
        import('qrcode').then((mod) => {
            const QR = mod.default || mod;
            QR.toDataURL(`${window.location.origin}/Event/${slideId}`, {
                width: 440, margin: 1, color: { dark: '#111827', light: '#ffffff' },
            }).then(d => { if (alive) setQr(d); }).catch(() => {});
        }).catch(() => {});
        return () => { alive = false; };
    }, [slideId]);
    if (!qr) return null;
    return (
        <div style={{ position: 'absolute', right: 48, bottom: 48, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, animation: 'fadeInScale 0.8s 1.5s both' }}>
            <div style={{ background: '#fff', padding: 16, borderRadius: 18, boxShadow: '0 10px 40px rgba(0,0,0,0.6)' }}>
                <img src={qr} alt="QR-Code: Event-Details" style={{ width: 200, height: 200, display: 'block' }} />
            </div>
            <div style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.9)', fontWeight: 600, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', padding: '8px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }}>
                📱 Details & Kalender — einfach scannen
            </div>
        </div>
    );
}

function SlideEvent({ slide, accent, theme }) {
  const hasEnd = slide.event_end_date && slide.event_end_date !== slide.event_date;
  const ds = slide.event_date ? format(parseISO(slide.event_date), 'EEEE, d. MMMM', { locale: de }) : '';
  const de2 = hasEnd ? format(parseISO(slide.event_end_date), 'd. MMMM', { locale: de }) : '';
  const ts = [slide.event_time, slide.event_end_time].filter(Boolean).join(' – ') + (slide.event_time ? ' Uhr' : '');
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '80px 120px', textAlign: 'center', gap: 32 }}>
      <ThemeBackground theme={theme} accent={accent} />
      <SpotlightStreak color={accent.bg} />
      <div style={{ background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8, padding: '6px 24px', position: 'relative', zIndex: 1, animation: 'slideInUp 0.6s 0.1s both' }}>
        <span style={{ fontSize: '1.3rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>EVENT</span>
      </div>
      <div style={{ fontSize: 'clamp(4.2rem,9.2vw,7.5rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', background: `linear-gradient(90deg,#fff 0%,${accent.bg} 40%,#fff 60%,${accent.bg} 80%,#fff 100%)`, backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'shimmer 4s linear infinite,slideInUp 0.7s 0.2s both', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 2px 20px rgba(0,0,0,0.9))' }}>{slide.title}</div>
      {slide.subtitle && <div style={{ fontSize: '2.7rem', color: 'rgba(255,255,255,0.8)', animation: 'slideInUp 0.7s 0.35s both', position: 'relative', zIndex: 1, textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>{slide.subtitle}</div>}
      {(ds || ts) && (
        <div style={{ display: 'flex', gap: 80, alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, animation: 'slideInUp 0.7s 0.5s both' }}>
          {ds && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent.bg, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Datum</div>
              <div style={{ fontSize: 'clamp(3rem,5.5vw,4.5rem)', fontWeight: 900, color: '#fff', lineHeight: 1.1, textShadow: '0 2px 30px rgba(0,0,0,0.9)' }}>
                {ds}{de2 && <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.62em' }}> – {de2}</span>}
              </div>
            </div>
          )}
          {ds && ts && <div style={{ width: 1, height: 120, background: `linear-gradient(180deg,transparent,${accent.bg}66,transparent)` }} />}
          {ts && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent.bg, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Uhrzeit</div>
              <div style={{ fontSize: 'clamp(3rem,5.5vw,4.5rem)', fontWeight: 900, color: '#fff', lineHeight: 1.1, textShadow: '0 2px 30px rgba(0,0,0,0.9)' }}>{ts}</div>
            </div>
          )}
        </div>
      )}
      {slide.location && (
        <div style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: '18px 40px', fontWeight: 600, fontSize: '1.9rem', color: '#fff', position: 'relative', zIndex: 1, animation: 'slideInUp 0.7s 0.65s both' }}>📍 {slide.location}</div>
      )}
      {slide.public_event && <SlideQR slideId={slide.id} />}
      {slide.cta_text && <div style={{ background: accent.bg, color: accent.text, padding: '24px 64px', borderRadius: 20, fontWeight: 800, fontSize: '2rem', boxShadow: `0 0 30px ${accent.glow},0 4px 20px rgba(0,0,0,0.6)`, animation: 'slideInUp 0.7s 0.95s both,pulseGlow 3s 1.8s ease-in-out infinite', position: 'relative', zIndex: 1 }}>{slide.cta_text}</div>}
    </div>
  );
}

function SlideDrinkSpecial({ slide, accent, theme }) {
  let drinks = [];
  try { drinks = JSON.parse(slide.body_text || '[]'); } catch {}
  if (!drinks.length) drinks = [{ name: slide.title, price: slide.price_info, emoji: '🍹' }];
  const valid = drinks.filter(d => d && d.name);
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '60px 80px', textAlign: 'center', gap: 32 }}>
      <ThemeBackground theme={theme} accent={accent} />
      <ShimmerBars color={accent.bg} />
      <div style={{ background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8, padding: '6px 24px', position: 'relative', zIndex: 1, animation: 'fadeInScale 0.5s 0.1s both' }}>
        <span style={{ fontSize: '1.3rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>DRINK SPECIAL</span>
      </div>
      {slide.title && valid.length > 1 && <div style={{ fontSize: 'clamp(3.5rem,7vw,5.6rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', animation: 'slideInUp 0.6s 0.2s both', position: 'relative', zIndex: 1, textShadow: '0 2px 30px rgba(0,0,0,0.9)' }}>{slide.title}</div>}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', width: '100%', position: 'relative', zIndex: 1 }}>
        {valid.map((d, i) => (
          <div key={i} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(14px)', border: `2px solid ${accent.bg}55`, borderRadius: 28, padding: '36px 48px', textAlign: 'center', minWidth: 240, flex: '1 1 240px', maxWidth: 380, animation: `bounceIn 0.7s ${0.35 + i * 0.15}s both`, boxShadow: `0 8px 32px rgba(0,0,0,0.5),0 0 24px ${accent.glow}22` }}>
            <div style={{ fontSize: '4rem', marginBottom: 16, display: 'inline-block', animation: `drinkFloat ${3.5 + i * 0.5}s ${i * 0.3}s ease-in-out infinite` }}>{d.emoji || '🍹'}</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff', marginBottom: 16 }}>{d.name}</div>
            {d.price && <div style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 16, background: accent.bg, color: accent.text, fontWeight: 900, fontSize: '2.2rem', boxShadow: `0 0 20px ${accent.glow}` }}>{d.price}</div>}
          </div>
        ))}
      </div>
      {slide.subtitle && <div style={{ fontSize: '1.9rem', color: 'rgba(255,255,255,0.65)', position: 'relative', zIndex: 1, animation: 'slideInUp 0.6s 0.9s both' }}>{slide.subtitle}</div>}
    </div>
  );
}

function SlideCountdown({ slide, accent, theme }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);
  if (!slide.event_date) return null;
  const target = parseISO(slide.event_date + (slide.event_time ? 'T' + slide.event_time : 'T00:00:00'));
  const total = differenceInSeconds(target, now);
  if (total < 0) return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 32, textAlign: 'center' }}>
      <ThemeBackground theme={theme} accent={accent} />
      <div style={{ fontSize: '5rem', animation: 'bounceIn 0.8s both', position: 'relative', zIndex: 1 }}>🎉</div>
      <div style={{ fontSize: '4rem', fontWeight: 900, color: accent.bg, textShadow: `0 0 60px ${accent.glow}`, animation: 'pulseGlow 2s ease-in-out infinite', position: 'relative', zIndex: 1 }}>ES IST SOWEIT!</div>
      <div style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600, position: 'relative', zIndex: 1 }}>{slide.title}</div>
    </div>
  );

  const days = Math.floor(total / 86400), hours = Math.floor((total % 86400) / 3600), mins = Math.floor((total % 3600) / 60), secs = total % 60;
  const units = days > 0 ? [{ v: days, l: 'Tage' }, { v: hours, l: 'Std.' }, { v: mins, l: 'Min.' }] : [{ v: hours, l: 'Std.' }, { v: mins, l: 'Min.' }, { v: secs, l: 'Sek.' }];
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 40, textAlign: 'center', padding: '60px 80px' }}>
      <ThemeBackground theme={theme} accent={accent} />
      <PulseRings color={accent.bg} />
      <div style={{ background: accent.soft, border: `1px solid ${accent.bg}`, borderRadius: 8, padding: '6px 24px', position: 'relative', zIndex: 1 }}>
        <span style={{ fontSize: '1.3rem', color: accent.bg, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Countdown</span>
      </div>
      <div style={{ fontSize: '5.2rem', fontWeight: 900, color: '#fff', lineHeight: 1.05, textShadow: '0 2px 40px rgba(0,0,0,0.9)', animation: 'slideInUp 0.6s 0.2s both', position: 'relative', zIndex: 1 }}>{slide.title}</div>
      {slide.public_event && <SlideQR slideId={slide.id} />}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        {units.map((u, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(14px)', border: `2px solid ${accent.bg}`, borderRadius: 20, padding: '32px 48px', minWidth: 180, boxShadow: `0 0 40px ${accent.glow},0 8px 32px rgba(0,0,0,0.6)`, animation: `bounceIn 0.7s ${0.4 + i * 0.12}s both`, overflow: 'hidden' }}>
              <div key={`${i}-${u.v}`} style={{ fontSize: '7rem', fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', animation: 'numberFlip 0.35s ease-out both' }}>{String(u.v).padStart(2, '0')}</div>
              <div style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.6)', marginTop: 12, fontWeight: 600 }}>{u.l}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        {slide.event_date && <div style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14, padding: '15px 30px', color: '#fff', fontWeight: 600, fontSize: '1.6rem' }}>📅 {format(parseISO(slide.event_date), 'EEEE, d. MMMM yyyy', { locale: de })}</div>}
        {slide.event_time && <div style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14, padding: '15px 30px', color: '#fff', fontWeight: 600, fontSize: '1.6rem' }}>🕐 {slide.event_time} Uhr</div>}
        {slide.location && <div style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14, padding: '15px 30px', color: '#fff', fontWeight: 600, fontSize: '1.6rem' }}>📍 {slide.location}</div>}
      </div>
    </div>
  );
}

// ── QR-Code Slide ─────────────────────────────────────────────────────────────
function SlideQRCode({ slide, accent, theme }) {
  const qrSize = 'clamp(230px,24vw,340px)';
  return (
    <div style={{ position:'relative',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',height:'100%',padding:'80px 120px',textAlign:'center',gap:40 }}>
      <ThemeBackground theme={theme} accent={accent} />
      <div style={{ position:'relative',zIndex:2,display:'flex',flexDirection:'column',alignItems:'center',gap:32 }}>
        <div style={{ background:accent.soft,border:`1px solid ${accent.bg}`,borderRadius:8,padding:'5px 20px',animation:'slideInUp 0.5s 0.1s both' }}>
          <span style={{ fontSize:'1.25rem',color:accent.bg,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase' }}>{slide.subtitle||'QR-Code scannen'}</span>
        </div>
        <div style={{ fontSize:'clamp(3rem,7vw,6.2rem)',fontWeight:900,color:'#fff',letterSpacing:'-0.03em',textShadow:`0 2px 40px rgba(0,0,0,0.9),0 0 80px ${accent.glow}`,animation:'slideInUp 0.6s 0.2s both' }}>{slide.title}</div>
        <div style={{ position:'relative',animation:'bounceIn 0.8s 0.4s both' }}>
          <div style={{ position:'absolute',inset:-8,borderRadius:20,border:`3px solid ${accent.bg}`,boxShadow:`0 0 30px ${accent.glow},0 0 60px ${accent.glow}33`,animation:'pulseGlow 3s ease-in-out infinite',pointerEvents:'none' }}/>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(slide.body_text||MENU_URL)}&bgcolor=050508&color=ffffff&margin=12`}
            alt="QR Code"
            style={{ width:qrSize,height:qrSize,borderRadius:14,display:'block' }}
          />
        </div>
        {slide.cta_text&&<div style={{ fontSize:'clamp(1.3rem,2.1vw,1.7rem)',color:'rgba(255,255,255,0.7)',fontWeight:500,animation:'slideInUp 0.6s 0.9s both' }}>{slide.cta_text}</div>}
      </div>
    </div>
  );
}

// ── Heute Abend Slide ─────────────────────────────────────────────────────────
function SlideTonight({ slide, accent, theme }) {
  return (
    <div style={{ position:'relative',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',height:'100%',padding:'80px 120px',textAlign:'center',gap:32 }}>
      <ThemeBackground theme={theme} accent={accent} />
      <SpotlightStreak color={accent.bg} />
      <div style={{ position:'relative',zIndex:2,display:'flex',flexDirection:'column',alignItems:'center',gap:28,maxWidth:900,width:'100%' }}>
        <div style={{ background:accent.soft,border:`1px solid ${accent.bg}`,borderRadius:8,padding:'5px 20px',animation:'slideInUp 0.5s 0.1s both' }}>
          <span style={{ fontSize:'1.25rem',color:accent.bg,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase' }}>Heute Abend</span>
        </div>
        <div style={{ fontSize:'clamp(3.5rem,8vw,6.8rem)',fontWeight:900,color:'#fff',letterSpacing:'-0.03em',lineHeight:1.05,animation:'slideInUp 0.6s 0.2s both',textShadow:`0 2px 40px rgba(0,0,0,0.9),0 0 80px ${accent.glow}` }}>{slide.title}</div>
        {slide.subtitle&&<div style={{ fontSize:'clamp(1.7rem,3.2vw,2.6rem)',color:'rgba(255,255,255,0.85)',animation:'slideInUp 0.6s 0.35s both',textShadow:'0 2px 20px rgba(0,0,0,0.9)' }}>{slide.subtitle}</div>}
        {slide.body_text&&(
          <div style={{ display:'flex',gap:16,flexWrap:'wrap',justifyContent:'center',animation:'slideInUp 0.6s 0.5s both' }}>
            {slide.body_text.split(',').map((name,i)=>(
              <div key={i} style={{ background:'rgba(255,255,255,0.08)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:50,padding:'16px 36px',fontWeight:700,fontSize:'clamp(1.4rem,2.6vw,1.9rem)',color:'#fff',animation:`bounceIn 0.6s ${0.6+i*0.12}s both` }}>
                {name.trim()}
              </div>
            ))}
          </div>
        )}
        {slide.event_time&&<div style={{ background:'rgba(0,0,0,0.45)',backdropFilter:'blur(8px)',border:`1px solid ${accent.bg}55`,borderRadius:14,padding:'15px 32px',fontWeight:600,fontSize:'clamp(1.3rem,2.1vw,1.7rem)',color:accent.bg,animation:'slideInUp 0.6s 0.8s both' }}>🕐 Ab {slide.event_time} Uhr</div>}
      </div>
    </div>
  );
}

// ── Nächster Slide Preview ────────────────────────────────────────────────────
function NextSlidePreview({ slide, visible }) {
  if (!slide) return null;
  const a = ACCENTS[slide.accent_color] || ACCENTS.amber;
  return (
    <div style={{
      position:'absolute',bottom:36,right:48,zIndex:25,
      display:'flex',alignItems:'center',gap:12,
      background:'rgba(0,0,0,0.6)',backdropFilter:'blur(16px)',
      border:'1px solid rgba(255,255,255,0.12)',
      borderRadius:14,padding:'10px 18px',
      opacity:visible?1:0,
      transform:visible?'translateY(0)':'translateY(12px)',
      transition:'opacity 0.5s ease,transform 0.5s ease',
      pointerEvents:'none',
    }}>
      <div style={{ width:6,height:6,borderRadius:'50%',background:a.bg,boxShadow:`0 0 8px ${a.bg}`,flexShrink:0 }}/>
      <div>
        <div style={{ fontSize:'0.65rem',color:'rgba(255,255,255,0.4)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:2 }}>Weiter</div>
        <div style={{ fontSize:'0.9rem',fontWeight:600,color:'#fff',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{slide.title}</div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// HAUPT-COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function Display() {
  const [companyLogo, setCompanyLogo] = useState(null);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState('in');
  const [showNextPreview, setShowNextPreview] = useState(false);
  const previewRef = useRef(null); // 'in' | 'show' | 'out'
  const timerRef = useRef(null);

  useEffect(() => { injectKeyframes(); }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['displaySlides'],
    queryFn: async () => {
      const now = new Date();
      // Logo laden — public client, kein User-Login nötig
      try {
        const companies = await base44.entities.CompanyInfo.list();
        if (companies?.[0]?.logo_url) setCompanyLogo(companies[0].logo_url);
      } catch (_) {}
      // Slides laden
      // show_from/show_until kommen vom datetime-local Input als lokale Zeit
      // (ohne Timezone-Suffix) — daher mit parseISO als lokal parsen und
      // mit new Date() (ebenfalls lokal) vergleichen, nicht mit toISOString() (UTC).
      const all = await base44.entities.DisplaySlide.list();
      return (all || [])
        .filter(s => {
          if (!s.is_active) return false;
          if (s.show_from && now < parseISO(s.show_from)) return false;
          if (s.show_until && now > parseISO(s.show_until)) return false;
          return true;
        })
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  const slides = data || [];

  // Slide-Wechsel mit Crossfade
  const goNext = useCallback(() => {
    setShowNextPreview(false);
    setPhase('out');
    setTimeout(() => {
      setCurrentIdx(i => (i + 1) % slides.length);
      setPhase('in');
      setTimeout(() => setPhase('show'), 50);
    }, 600);
  }, [slides.length]);

  useEffect(() => {
    if (!slides.length) return;
    setPhase('in');
    setTimeout(() => setPhase('show'), 50);
  }, [slides.length]);

  useEffect(() => {
    if (!slides.length || phase === 'out') return;
    clearTimeout(timerRef.current);
    const slide = slides[currentIdx];
    const dur = (slide?.duration_seconds || TYPE_DURATION[slide?.slide_type] || 10) * 1000;
    setShowNextPreview(false);
    if (slides.length > 1) {
      previewRef.current = setTimeout(() => setShowNextPreview(true), Math.max(dur - 3000, 1000));
    }
    timerRef.current = setTimeout(goNext, dur);
    return () => { clearTimeout(timerRef.current); clearTimeout(previewRef.current); };
  }, [currentIdx, slides, goNext, phase]);

  // Loading
  if (isLoading) return <LoadingSplash />;

  // Kein aktiver Slide → Ambient Screen
  if (!slides.length) return <AmbientScreen />;

  const slide = slides[currentIdx];
  const accent = ACCENTS[slide.accent_color] || ACCENTS.amber;
  const theme = slide.background_theme && slide.background_theme !== 'auto'
    ? slide.background_theme
    : detectTheme(slide.title, slide.subtitle);

  const dur = slide.duration_seconds || TYPE_DURATION[slide.slide_type] || 10;

  return (
    <div style={{ background: '#050508', width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: '"Inter",system-ui,sans-serif', color: '#fff' }}>

      {/* Ambient Glow unten */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 80% 55% at 50% 105%,${accent.glow} 0%,transparent 70%)`, transition: 'background 1.2s ease' }} />

      {/* Logo oben links */}
      {companyLogo && (
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 30, padding: '24px 40px', display: 'flex', alignItems: 'center' }}>
          <img
            src={companyLogo}
            alt="Logo"
            style={{ height: 'clamp(48px, 7vh, 96px)', maxWidth: 'clamp(120px, 18vw, 280px)', objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7)) brightness(1.1)', opacity: 0.95 }}
          />
        </div>
      )}

      {/* Uhr entfernt — nur Logo sichtbar */}

      {/* Slide Content mit Crossfade + Scale */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: phase === 'out' ? 0 : 1,
        transform: phase === 'out' ? 'scale(0.97)' : phase === 'in' ? 'scale(1.03)' : 'scale(1)',
        transition: phase === 'out' ? 'opacity 0.6s ease, transform 0.6s ease' : 'opacity 0.7s ease, transform 0.7s ease',
      }}>
        {slide.slide_type === 'announcement'  && <SlideAnnouncement  slide={slide} accent={accent} theme={theme} />}
        {slide.slide_type === 'event'         && <SlideEvent         slide={slide} accent={accent} theme={theme} />}
        {slide.slide_type === 'drink_special' && <SlideDrinkSpecial  slide={slide} accent={accent} theme={theme} />}
        {slide.slide_type === 'countdown'     && <SlideCountdown     slide={slide} accent={accent} theme={theme} />}
        {slide.slide_type === 'qr_code'       && <SlideQRCode        slide={slide} accent={accent} theme={theme} />}
        {slide.slide_type === 'tonight'       && <SlideTonight       slide={slide} accent={accent} theme={theme} />}
      </div>

      {/* Nächster Slide Preview */}
      <NextSlidePreview slide={slides.length > 1 ? slides[(currentIdx + 1) % slides.length] : null} visible={showNextPreview} />
      {/* Dots + Progress */}
      {slides.length > 1 && <DotNav slides={slides} currentIdx={currentIdx} />}
      <ProgressBar duration={dur} color={accent.bg} resetKey={currentIdx} />
    </div>
  );
}