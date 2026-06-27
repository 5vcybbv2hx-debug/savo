/**
 * Display.jsx — Vollbild-Slideshow für Bar-TV
 * v9c: Proven v7 base + QR code slide, Tonight slide, next-slide preview (3s),
 *      10s polling, 3D animations (disco, soccer, fireworks), SVG Germany flag,
 *      responsive with clamp() — TextBackdrop & weather widget removed
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInSeconds, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

// ── CSS Keyframes & Styles ────────────────────────────────────────────────────
const STYLES = `
  @keyframes waveFlag {
    0%   { d: path('M0,30 Q15,15 30,30 T60,30 T90,30 T120,30 T150,30 T180,30'); }
    50%  { d: path('M0,25 Q15,10 30,25 T60,25 T90,25 T120,25 T150,25 T180,25'); }
    100% { d: path('M0,30 Q15,15 30,30 T60,30 T90,30 T120,30 T150,30 T180,30'); }
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes popIn { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
  .wave-flag { animation: waveFlag 4s ease-in-out infinite; }
  .fade-in { animation: fadeIn 0.5s ease-out; }
  .slide-up { animation: slideUp 0.6s ease-out; }
  .pop-in { animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
`;

function injectStyles() {
  if (document.getElementById('display-v9-styles')) return;
  const s = document.createElement('style');
  s.id = 'display-v9-styles';
  s.textContent = STYLES;
  document.head.appendChild(s);
}

// ── Accent Colors ─────────────────────────────────────────────────────────────
const ACCENTS = {
  amber:   { bg: '#f59e0b', text: '#000', soft: 'rgba(245,158,11,0.15)' },
  blue:    { bg: '#3b82f6', text: '#fff', soft: 'rgba(59,130,246,0.15)' },
  green:   { bg: '#22c55e', text: '#000', soft: 'rgba(34,197,94,0.15)' },
  red:     { bg: '#ef4444', text: '#fff', soft: 'rgba(239,68,68,0.15)' },
  purple:  { bg: '#a855f7', text: '#fff', soft: 'rgba(168,85,247,0.15)' },
  pink:    { bg: '#ec4899', text: '#fff', soft: 'rgba(236,72,153,0.15)' },
  cyan:    { bg: '#06b6d4', text: '#fff', soft: 'rgba(6,182,212,0.15)' },
};

// ── Type Duration & Theme Detection ───────────────────────────────────────────
const TYPE_DURATION = { announcement: 10, event: 14, drink_special: 12, countdown: 16, qr_code: 20, tonight: 12 };

function detectTheme(title = '', subtitle = '') {
  const txt = (title + ' ' + subtitle).toLowerCase();
  if (/deutsch|germany|german|dfb|schwarz.?rot.?gold/.test(txt)) return 'germany';
  if (/american.?football|nfl|touchdown|superbowl/.test(txt)) return 'american_football';
  if (/fußball|fussball|soccer|bundesliga|champions|euro |wm |em /.test(txt)) return 'soccer';
  if (/party|disco|club|dance|dj |rave|techno|house/.test(txt)) return 'disco';
  if (/live.?music|konzert|concert|band |rock |jazz/.test(txt)) return 'music';
  if (/bier|beer|pils|weizen|craft|brau/.test(txt)) return 'beer';
  if (/cocktail|drink|aperol|spritz|mojito|gin |vodka/.test(txt)) return 'cocktail';
  if (/sommer|summer|beach|strand|ibiza/.test(txt)) return 'summer';
  if (/silvester|neujahr|new.?year|feuerwerk/.test(txt)) return 'fireworks';
  if (/halloween|horror|scary|zombie|geist/.test(txt)) return 'halloween';
  if (/weihnacht|christmas|xmas|advent/.test(txt)) return 'christmas';
  if (/valentine|liebe|love|herz|heart/.test(txt)) return 'love';
  if (/pizza|burger|food|essen|brunch/.test(txt)) return 'food';
  return 'default';
}

// ── Three.js Loader & Immediate Preload ──────────────────────────────────
let _THREE = null;
function loadThree() {
  return new Promise((resolve, reject) => {
    if (_THREE) { resolve(_THREE); return; }
    if (window.THREE) { _THREE = window.THREE; resolve(_THREE); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = () => { _THREE = window.THREE; resolve(_THREE); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
// Preload Three.js immediately when page starts
if (typeof window !== 'undefined') {
  loadThree().catch(console.error);
}

// ── Canvas Animation Hook (defers init until element has non-zero dimensions) ──
function useCanvas(animate) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    
    let animId, initiated = false;
    
    // Defer initialization via rAF until element has non-zero dimensions
    const checkAndInit = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w > 0 && h > 0) {
        initiated = true;
        canvas.width = w;
        canvas.height = h;
        let t = 0;
        const loop = () => {
          t += 0.016;
          animate({ canvas, ctx, t });
          animId = requestAnimationFrame(loop);
        };
        loop();
      } else {
        animId = requestAnimationFrame(checkAndInit);
      }
    };
    
    checkAndInit();
    
    const handleResize = () => {
      if (initiated) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [animate]);
  
  return canvasRef;
}

// ── Three.js Scene Hook ───────────────────────────────────────────────────────
function useThreeScene(buildScene) {
  const mountRef = useRef(null);
  useEffect(() => {
    let renderer, animId;
    loadThree().then(T => {
      const el = mountRef.current; if (!el) return;
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(el.offsetWidth, el.offsetHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      el.appendChild(renderer.domElement);

      const { scene, camera, onFrame } = buildScene(T, el.offsetWidth, el.offsetHeight);

      const ro = new ResizeObserver(() => {
        const w = el.offsetWidth, h = el.offsetHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
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

// 🪩 DISCO — Canvas Discoball
function CanvasDiscoball() {
  const canvasRef = useCanvas(({ canvas, ctx, t }) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height * 0.35;
    const ballRadius = Math.min(canvas.width, canvas.height) * 0.12;
    
    // 12 roaming colored light spots
    const lightCols = ['#ff2255', '#ff9900', '#00ccff', '#aa00ff', '#00ff88', '#ff00ff', '#00ff00', '#ffff00', '#ff0088', '#0088ff', '#88ff00', '#ff8800'];
    const lights = canvasRef.current._lights || lightCols.map((col, i) => ({
      col, angle: (i / 12) * Math.PI * 2, el: 0.4, speed: 0.005 + Math.random() * 0.003,
      x: 0, y: 0
    }));
    if (!canvasRef.current._lights) canvasRef.current._lights = lights;
    
    // 80 glitter spark particles
    const sparks = canvasRef.current._sparks || Array(80).fill(null).map(() => ({
      x: centerX + (Math.random() - 0.5) * canvas.width * 0.8,
      y: centerY + (Math.random() - 0.5) * canvas.height * 0.6,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2 - 1,
      life: Math.random() * 4,
      size: Math.random() * 2 + 1,
      col: lightCols[Math.floor(Math.random() * lightCols.length)]
    }));
    if (!canvasRef.current._sparks) canvasRef.current._sparks = sparks;
    
    // Dark room
    ctx.fillStyle = 'rgba(6,6,16,0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update lights
    lights.forEach((l) => {
      l.angle += l.speed;
      const el = l.el + Math.sin(t * 0.25 + l.angle) * 0.18;
      l.x = centerX + Math.cos(l.angle) * canvas.width * 0.35;
      l.y = centerY + Math.sin(el) * canvas.height * 0.25;
    });
    
    // Light beams (soft rays from spots to room)
    lights.forEach(l => {
      const grad = ctx.createRadialGradient(l.x, l.y, 10, l.x, l.y, 200);
      grad.addColorStop(0, l.col + '40');
      grad.addColorStop(1, l.col + '00');
      ctx.fillStyle = grad;
      ctx.fillRect(l.x - 200, l.y - 200, 400, 400);
    });
    
    // Draw disco ball tiles & reflections
    const tiles = [];
    for (let li = 0; li < 16; li++) {
      const phiM = ((li + 0.5) / 16) * Math.PI;
      const sinP = Math.sin(phiM), cosP = Math.cos(phiM);
      for (let lo = 0; lo < 24; lo++) {
        const thetaM = (lo / 24) * Math.PI * 2 + t * 0.2;
        const nx = sinP * Math.cos(thetaM);
        const ny = cosP;
        
        const px = centerX + nx * ballRadius * 0.9;
        const py = centerY + ny * ballRadius * 0.9;
        
        // Find nearest light for reflection color
        let nearestCol = '#ddddf0';
        let minDist = Infinity;
        lights.forEach(l => {
          const d = Math.hypot(l.x - px, l.y - py);
          if (d < minDist) { minDist = d; nearestCol = l.col; }
        });
        
        const brightness = Math.max(0, 0.3 + nx * 0.7);
        tiles.push({ x: px, y: py, col: nearestCol, brightness, size: ballRadius * 0.08 });
      }
    }
    
    // Draw tiles with brightness variation
    tiles.forEach(tile => {
      ctx.fillStyle = tile.col + Math.floor(80 + tile.brightness * 150).toString(16);
      ctx.shadowBlur = 8;
      ctx.shadowColor = tile.col + '80';
      ctx.fillRect(tile.x - tile.size / 2, tile.y - tile.size / 2, tile.size, tile.size);
    });
    ctx.shadowBlur = 0;
    
    // Specular highlight
    const hlx = centerX - ballRadius * 0.3;
    const hly = centerY - ballRadius * 0.3;
    const hlGrad = ctx.createRadialGradient(hlx, hly, 5, hlx, hly, ballRadius * 0.4);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.arc(hlx, hly, ballRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    // Suspension wire
    ctx.strokeStyle = 'rgba(200,200,200,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - ballRadius - 40);
    ctx.lineTo(centerX, centerY - ballRadius);
    ctx.stroke();
    
    // Update & draw glitter sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.02;
      s.life += 0.016;
      
      if (s.y > canvas.height + 50 || s.life > 5) {
        sparks[i] = {
          x: centerX + (Math.random() - 0.5) * ballRadius * 3,
          y: centerY - ballRadius * 1.5,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 1,
          life: 0,
          size: Math.random() * 2 + 1,
          col: lightCols[Math.floor(Math.random() * lightCols.length)]
        };
      } else {
        const fadeOut = s.life > 3.5 ? Math.max(0, 1 - (s.life - 3.5) / 1.5) : 1;
        ctx.fillStyle = s.col + Math.floor(200 * fadeOut).toString(16);
        ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      }
    }
  });
  
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
}

// 🇩🇪 DEUTSCHLAND — SVG Flag
function GermanySVGFlag() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 200 120" style={{ position: 'absolute', inset: 0, opacity: 0.4, zIndex: 0 }}>
      <rect width="200" height="40" fill="#1a1a1a" />
      <rect y="40" width="200" height="40" fill="#cc0000" />
      <rect y="80" width="200" height="40" fill="#ffcc00" />
      <path d="M0,30 Q15,15 30,30 T60,30 T90,30 T120,30 T150,30 T180,30" stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none" className="wave-flag" />
    </svg>
  );
}

// ⚽ SOCCER
function Soccer3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 1.8, 6.5); camera.lookAt(0, 0, 0);
    scene.add(new T.AmbientLight(0x224422, 0.5));
    const sun = new T.DirectionalLight(0xffffff, 1.8); sun.position.set(5, 9, 5); scene.add(sun);

    const grass = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshLambertMaterial({ color: 0x1a5c1a }));
    grass.rotation.x = -Math.PI / 2; grass.position.y = -1.3; scene.add(grass);

    const ball = new T.Mesh(new T.SphereGeometry(0.62, 24, 24), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
    ball.position.y = -0.68; scene.add(ball);

    return {
      scene, camera,
      onFrame(t) {
        ball.position.x = Math.sin(t * 0.42) * 2.8; ball.position.z = Math.cos(t * 0.31) * 0.9;
        ball.rotation.z = -t * 1.6; ball.rotation.x = t * 0.85;
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none', zIndex: 0 }} />;
}

// 🎆 FIREWORKS
function Fireworks3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(70, W / H, 0.1, 200);
    camera.position.set(0, 0, 9);

    const COLS = [[1,0.13,0.4],[1,0.6,0],[0,0.87,1],[0.67,0,1],[0,1,0.53]];
    const rockets = [], particles = [];

    function spawnRocket() {
      rockets.push({ x:(Math.random()-0.5)*8, y:-4.5, vy:0.13+Math.random()*0.07, col:COLS[Math.floor(Math.random()*COLS.length)] });
    }
    function explode(x, y, col) {
      for (let i = 0; i < 120; i++) {
        const a = Math.random() * Math.PI * 2, sp = 0.045 + Math.random() * 0.11;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: col[0], g: col[1], b: col[2], life: 1, decay: 0.01, sz: 0.11, grav: 0.0009 });
      }
    }

    const pPos = new Float32Array(3500 * 3), pCol = new Float32Array(3500 * 3);
    const pGeo = new T.BufferGeometry();
    pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new T.BufferAttribute(pCol, 3));
    const pMat = new T.PointsMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, size: 0.13 });
    scene.add(new T.Points(pGeo, pMat));

    let nextRocket = 0;
    return {
      scene, camera,
      onFrame(t) {
        if (t > nextRocket) { spawnRocket(); nextRocket = t + 1.5; }
        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i]; r.y += r.vy; r.vy -= 0.0012;
          if (r.vy < 0.01) { explode(r.x, r.y, r.col); rockets.splice(i, 1); }
        }
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy -= p.grav; p.life -= p.decay;
          if (p.life <= 0) particles.splice(i, 1);
        }
        const n = Math.min(particles.length, 3500);
        for (let i = 0; i < n; i++) {
          const p = particles[i];
          pPos[i*3] = p.x; pPos[i*3+1] = p.y; pPos[i*3+2] = 0;
          pCol[i*3] = p.r * p.life; pCol[i*3+1] = p.g * p.life; pCol[i*3+2] = p.b * p.life;
        }
        pGeo.setDrawRange(0, n);
        pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
}

// ❤️ CANVAS LOVE — 2D floating hearts
function CanvasLove() {
  const canvasRef = useCanvas(({ canvas, ctx }) => {
    const hearts = canvasRef.current._hearts || Array(20).fill(null).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5 - 0.3,
      life: Math.random() * 3,
      size: 20 + Math.random() * 30,
      rot: Math.random() * Math.PI * 2
    }));
    if (!canvasRef.current._hearts) canvasRef.current._hearts = hearts;
    
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < hearts.length; i++) {
      const h = hearts[i];
      h.life += 0.016;
      h.x += h.vx;
      h.y += h.vy;
      h.vy -= 0.008;
      h.rot += 0.05;
      
      if (h.y > canvas.height + 50 || h.life > 8) {
        hearts[i] = {
          x: Math.random() * canvas.width,
          y: -30,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5 - 0.3,
          life: 0,
          size: 20 + Math.random() * 30,
          rot: Math.random() * Math.PI * 2
        };
      } else {
        const fadeIn = Math.min(1, h.life / 0.5);
        const fadeOut = h.life > 6 ? Math.max(0, 1 - (h.life - 6) / 2) : 1;
        const opacity = fadeIn * fadeOut * 0.8;
        
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(h.rot);
        ctx.globalAlpha = opacity;
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath();
        const s = h.size;
        ctx.moveTo(0, s * 0.35);
        ctx.bezierCurveTo(-s*0.5, -s*0.2, -s*0.8, -s*0.5, -s*0.35, -s*0.15);
        ctx.bezierCurveTo(-s*0.15, -s*0.35, 0, -s*0.5, s*0.35, -s*0.15);
        ctx.bezierCurveTo(s*0.8, -s*0.5, s*0.5, -s*0.2, 0, s*0.35);
        ctx.fill();
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(255,105,180,0.6)';
        ctx.fill();
        ctx.restore();
      }
    }
  });
  
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
}

// ── QR Code Slide ─────────────────────────────────────────────────────────────
function QRCodeSlide({ slide, accentColor }) {
  const accent = ACCENTS[accentColor] || ACCENTS.blue;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(135deg, ${accent.soft} 0%, rgba(0,0,0,0.3) 100%)`,
      color: '#fff'
    }}>
      <div className="fade-in" style={{
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'clamp(20px, 5%, 40px)'
      }}>
        <h1 style={{ fontSize: 'clamp(28px, 8%, 56px)', fontWeight: 'bold', margin: 0 }}>{slide.title}</h1>
        {slide.subtitle && <p style={{ fontSize: 'clamp(16px, 4%, 28px)', margin: 0, opacity: 0.9 }}>{slide.subtitle}</p>}
        
        {/* Placeholder QR — in production, use qrcode library */}
        <div style={{
          width: 'clamp(150px, 30%, 300px)',
          height: 'clamp(150px, 30%, 300px)',
          background: '#fff',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'clamp(12px, 3%, 24px)',
          color: '#666'
        }}>
          QR: {slide.qr_data?.substring(0, 20)}...
        </div>

        {slide.cta_text && (
          <button style={{
            padding: 'clamp(10px, 2%, 20px) clamp(20px, 4%, 40px)',
            fontSize: 'clamp(14px, 3.5%, 24px)',
            background: accent.bg,
            color: accent.text,
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginTop: 'clamp(10px, 2%, 30px)'
          }}>
            {slide.cta_text}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tonight Slide ─────────────────────────────────────────────────────────────
function TonightSlide({ slide, accentColor }) {
  const accent = ACCENTS[accentColor] || ACCENTS.purple;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`,
      color: '#fff'
    }}>
      <div className="pop-in" style={{
        textAlign: 'center',
        fontSize: 'clamp(48px, 12%, 96px)',
        fontWeight: 'bold',
        marginBottom: 'clamp(20px, 5%, 40px)'
      }}>
        🌙 Tonight
      </div>
      
      <h1 style={{ fontSize: 'clamp(28px, 8%, 56px)', fontWeight: 'bold', margin: 0 }}>{slide.title}</h1>
      {slide.subtitle && <p style={{ fontSize: 'clamp(16px, 4%, 28px)', margin: 'clamp(10px, 2%, 20px) 0 0 0', opacity: 0.85 }}>{slide.subtitle}</p>}
      
      {slide.body_text && (
        <p style={{
          fontSize: 'clamp(14px, 3%, 24px)',
          marginTop: 'clamp(20px, 5%, 40px)',
          maxWidth: '90%',
          lineHeight: '1.6',
          opacity: 0.8
        }}>
          {slide.body_text}
        </p>
      )}

      {slide.event_time && (
        <div style={{
          marginTop: 'clamp(20px, 5%, 40px)',
          fontSize: 'clamp(18px, 5%, 32px)',
          background: accent.soft,
          padding: 'clamp(10px, 2%, 20px) clamp(20px, 4%, 40px)',
          borderRadius: '8px',
          border: `2px solid ${accent.bg}`
        }}>
          ⏰ {slide.event_time}
        </div>
      )}
    </div>
  );
}

// ── Standard Slide w/ Backdrop Overlay ────────────────────────────────────────
function StandardSlide({ slide, accentColor, bgImage }) {
  const accent = ACCENTS[accentColor] || ACCENTS.blue;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: bgImage ? `url(${bgImage})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      {/* Dark Backdrop Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 100%)',
        zIndex: 1
      }} />

      <div className="slide-up" style={{
        position: 'relative',
        zIndex: 2,
        textAlign: 'center',
        color: '#fff',
        maxWidth: '90%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'clamp(10px, 2%, 30px)'
      }}>
        <h1 style={{ fontSize: 'clamp(32px, 10%, 72px)', fontWeight: 'bold', margin: 0 }}>{slide.title}</h1>
        {slide.subtitle && <p style={{ fontSize: 'clamp(18px, 5%, 36px)', margin: 0, opacity: 0.95 }}>{slide.subtitle}</p>}
        {slide.body_text && <p style={{ fontSize: 'clamp(14px, 3.5%, 28px)', margin: 'clamp(10px, 2%, 20px) 0 0 0', opacity: 0.85, lineHeight: '1.5' }}>{slide.body_text}</p>}

        {slide.price_info && (
          <div style={{
            fontSize: 'clamp(20px, 5%, 40px)',
            fontWeight: 'bold',
            background: accent.bg,
            color: accent.text,
            padding: 'clamp(8px, 2%, 16px) clamp(16px, 3%, 32px)',
            borderRadius: '6px',
            marginTop: 'clamp(10px, 2%, 20px)'
          }}>
            {slide.price_info}
          </div>
        )}

        {slide.cta_text && (
          <button style={{
            padding: 'clamp(10px, 2%, 18px) clamp(24px, 4%, 48px)',
            fontSize: 'clamp(14px, 3.5%, 28px)',
            background: accent.bg,
            color: accent.text,
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}>
            {slide.cta_text}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Ambient Idle Screen ───────────────────────────────────────────────────────
function AmbientScreen() {
  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#fff'
    }}>
      <GermanySVGFlag />
      
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 'clamp(60px, 15%, 120px)', fontWeight: 'bold', marginBottom: 'clamp(20px, 5%, 40px)' }}>
          {time}
        </div>
        <p style={{ fontSize: 'clamp(20px, 5%, 40px)', opacity: 0.7, margin: 0 }}>
          Bald geht's los...
        </p>
      </div>


    </div>
  );
}

// ── Main Display Component ────────────────────────────────────────────────────
export default function Display() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState('in'); // in | show | preview | out
  const [nextIdx, setNextIdx] = useState(1);
  const phaseRef = useRef('in');
  const slideTimerRef = useRef(null);
  const pollTimerRef = useRef(null);

  injectStyles();

  // Fetch slides (10s polling)
  const { data: apiData = {}, refetch } = useQuery({
    queryKey: ['displaySlides'],
    queryFn: async () => {
      const res = await fetch('/api/functions/getDisplaySlides');
      return res.json();
    },
    staleTime: Infinity,
    refetchInterval: 10000 // Poll every 10 seconds
  });

  // Extract slides array and company info from response
  const slides = apiData.slides || [];
  const logoUrl = apiData.logo_url;
  const companyName = apiData.company_name;
  const brandingColor = apiData.branding_color;

  const current = slides[currentIdx];
  const next = slides[nextIdx];
  const accent = current?.accent_color || 'blue';
  const theme = detectTheme(current?.title || '', current?.subtitle || '');
  const duration = TYPE_DURATION[current?.slide_type] || 8;

  // Phase cycle: in (0.5s) → show (duration - 3.5s) → preview (3s) → out (0.5s) → next
  useEffect(() => {
    if (!slides.length) return;

    const handlePhase = () => {
      if (phaseRef.current === 'in') {
        setTimeout(() => {
          phaseRef.current = 'show';
          setPhase('show');
        }, 500);
      } else if (phaseRef.current === 'show') {
        setTimeout(() => {
          phaseRef.current = 'preview';
          setPhase('preview');
        }, (duration - 3.5) * 1000);
      } else if (phaseRef.current === 'preview') {
        setTimeout(() => {
          phaseRef.current = 'out';
          setPhase('out');
        }, 3000);
      } else if (phaseRef.current === 'out') {
        setCurrentIdx(prev => (prev + 1) % slides.length);
        setNextIdx(prev => (prev + 1) % slides.length);
        phaseRef.current = 'in';
        setPhase('in');
      }
    };

    handlePhase();
  }, [currentIdx, slides.length, duration]);

  if (!slides.length) return <AmbientScreen />;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#000',
      overflow: 'hidden',
      fontFamily: '"Segoe UI", sans-serif'
    }}>
      {/* Theme Backgrounds */}
      {theme === 'germany' && <GermanySVGFlag />}
      {theme === 'disco' && <CanvasDiscoball />}
      {theme === 'soccer' && <Soccer3D />}
      {theme === 'fireworks' && <Fireworks3D />}
      {theme === 'love' && <CanvasLove />}

      {/* Company Logo (Top-Left) */}
      {logoUrl && (
        <img
          src={logoUrl}
          alt={companyName || 'Logo'}
          style={{
            position: 'absolute',
            top: 'clamp(16px, 3%, 32px)',
            left: 'clamp(16px, 3%, 32px)',
            zIndex: 10,
            height: 'clamp(40px, 8%, 80px)',
            width: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7)) brightness(1.1)',
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Current Slide */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: phase === 'out' ? 0 : 1,
          transition: phase === 'out' ? 'opacity 0.5s ease-out' : 'none'
        }}
      >
        {current?.slide_type === 'qr_code' ? (
          <QRCodeSlide slide={current} accentColor={accent} />
        ) : current?.slide_type === 'tonight' ? (
          <TonightSlide slide={current} accentColor={accent} />
        ) : (
          <StandardSlide slide={current} accentColor={accent} bgImage={current?.image_url} />
        )}
      </div>

      {/* Next Slide Preview (3s before transition, 30% opacity) */}
      {phase === 'preview' && next && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.3,
            transition: 'opacity 0.3s ease-out'
          }}
        >
          {next?.slide_type === 'qr_code' ? (
            <QRCodeSlide slide={next} accentColor={next?.accent_color || 'blue'} />
          ) : next?.slide_type === 'tonight' ? (
            <TonightSlide slide={next} accentColor={next?.accent_color || 'blue'} />
          ) : (
            <StandardSlide slide={next} accentColor={next?.accent_color || 'blue'} bgImage={next?.image_url} />
          )}
        </div>
      )}

      {/* Loading / No Slides */}
      {!current && <AmbientScreen />}
    </div>
  );
}