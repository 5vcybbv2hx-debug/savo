/**
 * Display.jsx — Vollbild-Slideshow für Bar-TV
 * v6: Full 3D via Three.js — Disco Mirror Ball, German Flag Shader, 3D Fireworks,
 *     3D Soccer/Football, 3D Hearts, 3D Confetti, 3D Snow
 */
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInSeconds, parseISO } from 'date-fns';
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
  const s = document.createElement('style'); s.id = 'savo-kf'; s.textContent = KEYFRAMES;
  document.head.appendChild(s);
}

// ── Three.js CDN Loader ───────────────────────────────────────────────────────
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

// ── Titel → Theme ─────────────────────────────────────────────────────────────
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
// 3D Szenen — Three.js
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

// 🪩 DISCO — Spiegelkugel mit echten 3D Tiles + Lichtspots
function DiscoBall3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(60, W / H, 0.1, 100);
    camera.position.set(0, 0.8, 5); camera.lookAt(0, 0.8, 0);

    // Raum
    const roomMat = new T.MeshStandardMaterial({ color: 0x060610, roughness: 0.98, metalness: 0, side: T.BackSide });
    scene.add(Object.assign(new T.Mesh(new T.BoxGeometry(14, 9, 14), roomMat), { position: new T.Vector3(0, 1, 0) }));
    const floorMat = new T.MeshStandardMaterial({ color: 0x0a0a18, roughness: 0.25, metalness: 0.5 });
    const floor = new T.Mesh(new T.PlaneGeometry(14, 14), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -3.5; floor.receiveShadow = true; scene.add(floor);

    // Aufhängung
    const wireMat = new T.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.05 });
    scene.add(Object.assign(new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 2.8, 8), wireMat), { position: new T.Vector3(0, 3.2, 0) }));

    // Kugel-Gruppe
    const ballGroup = new T.Group(); ballGroup.position.set(0, 2.5, 0); scene.add(ballGroup);

    // Kugel-Basis
    const ballMat = new T.MeshStandardMaterial({ color: 0x666677, metalness: 1.0, roughness: 0.04 });
    ballGroup.add(new T.Mesh(new T.SphereGeometry(0.8, 64, 64), ballMat));

    // Mirror Tiles
    const tileMat = new T.MeshStandardMaterial({ color: 0xddddf0, metalness: 1.0, roughness: 0.0 });
    const LAT = 22, LON = 28;
    for (let li = 0; li < LAT; li++) {
      const phiM = ((li + 0.5) / LAT) * Math.PI;
      const sinP = Math.sin(phiM), cosP = Math.cos(phiM);
      for (let lo = 0; lo < LON; lo++) {
        const thetaM = (lo / LON) * Math.PI * 2;
        const r = 0.805;
        const px = r * sinP * Math.cos(thetaM);
        const py = r * cosP;
        const pz = r * sinP * Math.sin(thetaM);
        const tw = 0.07 * sinP + 0.012, th = 0.055;
        const tile = new T.Mesh(new T.PlaneGeometry(tw * 0.84, th * 0.84), tileMat.clone());
        tile.position.set(px, py, pz);
        tile.lookAt(px * 2, py * 2, pz * 2);
        tile.rotateZ((Math.random() - 0.5) * 0.25);
        ballGroup.add(tile);
      }
    }

    // Ambient
    scene.add(new T.AmbientLight(0x111128, 0.4));

    // Top-Spot
    const topSpot = new T.SpotLight(0xffffff, 4, 10, Math.PI / 14, 0.4, 1.5);
    topSpot.position.set(0, 5.5, 0); topSpot.target = ballGroup;
    topSpot.castShadow = true; scene.add(topSpot); scene.add(topSpot.target);

    // Farbige Lichter
    const LCOLS = [0xff2255, 0xff9900, 0x00ccff, 0xaa00ff, 0x00ff88, 0xff44bb, 0xffff00, 0x00ffee];
    const lights = LCOLS.map((c, i) => {
      const l = new T.PointLight(c, 4.5, 14, 2);
      l.castShadow = true; l.shadow.mapSize.set(256, 256);
      scene.add(l);
      return { light: l, angle: (i / LCOLS.length) * Math.PI * 2, el: 0.2 + (i % 3) * 0.22, speed: 0.007 + i * 0.002 };
    });

    return {
      scene, camera,
      onFrame(t) {
        ballGroup.rotation.y = t * 0.2;
        lights.forEach(l => {
          l.angle += l.speed;
          const el = l.el + Math.sin(t * 0.25 + l.angle) * 0.18;
          l.light.position.set(Math.cos(l.angle) * 4, 2 + Math.sin(el) * 2, Math.sin(l.angle) * 4);
          l.light.intensity = 4.0 + Math.sin(t * 2.2 + l.angle) * 1.5;
        });
        camera.position.x = Math.sin(t * 0.04) * 0.4;
        camera.lookAt(0, 0.8, 0);
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
}

// 🇩🇪 DEUTSCHLAND — 3D Flagge mit Wellen
function GermanyFlag3D() {
  const mountRef = useRef(null);
  useEffect(() => {
    let renderer, animId;
    loadThree().then(T => {
      const el = mountRef.current; if (!el) return;
      const W = el.offsetWidth, H = el.offsetHeight;

      renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      el.appendChild(renderer.domElement);

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(45, W / H, 0.1, 100);
      camera.position.set(0, 0, 4.2);
      camera.lookAt(0, 0, 0);

      // Beleuchtung
      scene.add(new T.AmbientLight(0xffffff, 0.8));
      const sun = new T.DirectionalLight(0xffeedd, 1.6);
      sun.position.set(5, 4, 6); scene.add(sun);
      const fill = new T.DirectionalLight(0x8888ff, 0.4);
      fill.position.set(-4, 2, 3); scene.add(fill);

      // Flagge als Plane-Geometrie (3 Streifen separat für klare Farbtrennung)
      const STRIPE_H = 0.62;
      const FLAG_W = 3.0;
      const SEG_X = 40, SEG_Y = 8;
      const stripeColors = [0x111111, 0xcc0000, 0xffcc00]; // Schwarz, Rot, Gold
      const stripes = [];

      stripeColors.forEach((color, si) => {
        const geo = new T.PlaneGeometry(FLAG_W, STRIPE_H, SEG_X, SEG_Y);
        const pos = geo.attributes.position;
        // Kopiere Ursprungs-Y Werte
        const baseY = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) baseY[i] = pos.array[i * 3 + 1];

        const mat = new T.MeshStandardMaterial({
          color, side: T.DoubleSide, roughness: 0.4, metalness: 0.05,
        });
        const mesh = new T.Mesh(geo, mat);
        // Streifen von oben nach unten: Schwarz oben, Rot mitte, Gold unten
        // Schwarz: y=+STRIPE_H, Rot: y=0, Gold: y=-STRIPE_H
        mesh.position.set(0.35, STRIPE_H - si * STRIPE_H, 0);
        scene.add(mesh);
        stripes.push({ mesh, pos, baseY });
      });

      // Fahnenstab
      const poleMat = new T.MeshStandardMaterial({ color: 0xc0c0d0, metalness: 0.95, roughness: 0.05 });
      const pole = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 4.2, 16), poleMat);
      pole.position.set(-1.65, 0, 0);
      scene.add(pole);

      // Kugel oben
      const knob = new T.Mesh(
        new T.SphereGeometry(0.09, 20, 20),
        new T.MeshStandardMaterial({ color: 0xddaa00, metalness: 1.0, roughness: 0.05 })
      );
      knob.position.set(-1.65, 2.2, 0);
      scene.add(knob);

      // Resize
      const ro = new ResizeObserver(() => {
        const w2 = el.offsetWidth, h2 = el.offsetHeight;
        camera.aspect = w2 / h2; camera.updateProjectionMatrix();
        renderer.setSize(w2, h2);
      });
      ro.observe(el); el._ro = ro;

      let t = 0;
      function animate() {
        animId = requestAnimationFrame(animate);
        t += 0.016;

        // Wellen-Animation für jeden Streifen identisch
        stripes.forEach(({ pos, baseY }) => {
          for (let i = 0; i < pos.count; i++) {
            const x = pos.array[i * 3];
            // nx: 0 (am Stab) → 1 (freies Ende)
            const nx = (x + FLAG_W / 2) / FLAG_W;
            // Amplitude steigt zum freien Ende hin stark an
            const amp = nx * nx * nx * 0.22;
            // Zwei überlagerte Wellen für natürliches Flattern
            const wave = Math.sin(nx * Math.PI * 2.5 - t * 1.8) * amp
                       + Math.sin(nx * Math.PI * 4.5 - t * 1.3) * amp * 0.3;
            pos.array[i * 3 + 2] = wave;
            pos.array[i * 3 + 1] = baseY[i] + Math.sin(nx * Math.PI * 1.8 - t * 1.4) * amp * 0.15;
          }
          pos.needsUpdate = true;
        });

        // Kamera leicht schwenken
        camera.position.x = Math.sin(t * 0.06) * 0.3;
        camera.position.y = Math.sin(t * 0.045) * 0.12;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
      }
      animate();
    }).catch(console.error);

    return () => {
      cancelAnimationFrame(animId);
      if (mountRef.current?._ro) mountRef.current._ro.disconnect();
      if (renderer) { renderer.dispose(); renderer.domElement?.remove(); }
    };
  }, []);
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none' }} />;
}

// 🎆 FEUERWERK — 3D Partikel mit Physik
function Fireworks3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(70, W / H, 0.1, 200);
    camera.position.set(0, 0, 9);

    // Sterne
    const starPos = new Float32Array(3000 * 3);
    for (let i = 0; i < 3000 * 3; i++) starPos[i] = (Math.random() - 0.5) * 80;
    const starGeo = new T.BufferGeometry(); starGeo.setAttribute('position', new T.BufferAttribute(starPos, 3));
    const stars = new T.Points(starGeo, new T.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.45 }));
    scene.add(stars);

    // Partikel-System
    const MAX = 3500;
    const pGeo = new T.BufferGeometry();
    const pPos = new Float32Array(MAX * 3), pCol = new Float32Array(MAX * 3), pSz = new Float32Array(MAX);
    pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color',    new T.BufferAttribute(pCol, 3));
    pGeo.setAttribute('size',     new T.BufferAttribute(pSz, 1));
    const pMat = new T.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
    const pSystem = new T.Points(pGeo, pMat); scene.add(pSystem);

    const COLS = [[1,0.13,0.4],[1,0.6,0],[0,0.87,1],[0.67,0,1],[0,1,0.53],[1,0.27,0.73],[1,1,0.2]];
    const rockets = [], particles = [];

    function spawnRocket() {
      rockets.push({ x:(Math.random()-0.5)*8, y:-4.5, z:(Math.random()-0.5)*2, vy:0.13+Math.random()*0.07, vx:(Math.random()-0.5)*0.04, col:COLS[Math.floor(Math.random()*COLS.length)] });
    }
    function explode(x,y,z,col) {
      for (let i=0;i<110+Math.floor(Math.random()*80);i++) {
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
          if (p.life<=0) { particles.splice(i,1); }
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
        stars.rotation.y = t*0.004;
        camera.position.x = Math.sin(t*0.045)*0.6;
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
}

// ⚽ SOCCER — 3D Fußball auf Rasen
function Soccer3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 1.8, 6.5); camera.lookAt(0, 0, 0);

    scene.add(new T.AmbientLight(0x224422, 0.5));
    const sun = new T.DirectionalLight(0xffffff, 1.8); sun.position.set(5, 9, 5); sun.castShadow = true; scene.add(sun);

    // Rasen
    const grass = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshLambertMaterial({ color: 0x1a5c1a }));
    grass.rotation.x = -Math.PI/2; grass.position.y = -1.3; grass.receiveShadow = true; scene.add(grass);
    for (let i=-4;i<=4;i+=2) {
      const line = new T.Mesh(new T.PlaneGeometry(0.05, 20), new T.MeshBasicMaterial({ color: 0x2a7c2a, transparent:true, opacity:0.5 }));
      line.rotation.x=-Math.PI/2; line.position.set(i,-1.29,0); scene.add(line);
    }

    // Ball
    const ballMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const ball = new T.Mesh(new T.SphereGeometry(0.62, 36, 36), ballMat);
    ball.castShadow = true; ball.position.y = -0.68; scene.add(ball);
    const patchMat = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    [[0,0.63,0],[0,-0.63,0],[0.59,0.22,0.17],[-0.59,0.22,0.17],[0.36,0.22,-0.49],[-0.36,0.22,-0.49],[0,0.22,0.59]].forEach(([px,py,pz]) => {
      const p = new T.Mesh(new T.CircleGeometry(0.17,5), patchMat);
      const n = new T.Vector3(px,py,pz).normalize();
      p.position.copy(n.multiplyScalar(0.63)); p.lookAt(p.position.clone().multiplyScalar(2)); ball.add(p);
    });

    return {
      scene, camera,
      onFrame(t) {
        ball.position.x = Math.sin(t*0.42)*2.8;
        ball.position.z = Math.cos(t*0.31)*0.9;
        ball.rotation.z = -t*1.6; ball.rotation.x = t*0.85;
        camera.position.x = Math.sin(t*0.055)*0.9; camera.lookAt(0,0,0);
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, opacity: 0.42, pointerEvents: 'none' }} />;
}

// 🏈 AMERICAN FOOTBALL — 3D Spiralwurf
function AmericanFootball3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 2, 7.5); camera.lookAt(0, 0.2, 0);

    scene.add(new T.AmbientLight(0x334422, 0.4));
    const spot = new T.SpotLight(0xffffff, 2.5, 22, Math.PI/5, 0.4); spot.position.set(0, 9, 4); spot.castShadow=true; scene.add(spot);

    // Feld
    const field = new T.Mesh(new T.PlaneGeometry(18,12), new T.MeshLambertMaterial({color:0x1a4a0a}));
    field.rotation.x=-Math.PI/2; field.position.y=-1.9; field.receiveShadow=true; scene.add(field);
    for (let i=-7;i<=7;i+=1.75) {
      const yl = new T.Mesh(new T.PlaneGeometry(0.05,12), new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.14}));
      yl.rotation.x=-Math.PI/2; yl.position.set(i,-1.89,0); scene.add(yl);
    }

    // Football (Ei-Form: SphereGeometry + scale)
    function makeBall(group) {
      const fbMat = new T.MeshStandardMaterial({ color:0x7B3A10, roughness:0.55, metalness:0.05 });
      const fb = new T.Mesh(new T.SphereGeometry(0.38,28,18), fbMat);
      fb.scale.set(1, 0.62, 1); fb.castShadow=true; group.add(fb);
      const seamMat = new T.MeshBasicMaterial({ color:0xffffff });
      const seam = new T.Mesh(new T.TorusGeometry(0.39,0.009,8,32), seamMat);
      seam.rotation.y=Math.PI/2; group.add(seam);
    }

    const groups = [new T.Group(), new T.Group()];
    groups.forEach((g,i) => { makeBall(g); scene.add(g); });

    return {
      scene, camera,
      onFrame(t) {
        groups.forEach((g,i) => {
          const phase=t*0.42+i*Math.PI;
          g.position.x = Math.sin(phase)*3.5;
          g.position.y = Math.abs(Math.cos(phase*0.5))*1.3 - 0.4;
          g.position.z = (i===1?-1.5:0)+Math.cos(phase*0.3)*0.5;
          g.rotation.z = t*(i===0?4:-3.5);
          g.rotation.y = Math.atan2(Math.cos(phase)*3.5, 0.5) + Math.PI/2;
        });
        camera.position.x=Math.sin(t*0.045)*0.7; camera.lookAt(0,0.2,0);
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, opacity: 0.42, pointerEvents: 'none' }} />;
}

// ❤️ LOVE — 3D Herzen schweben auf
function Love3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(62, W / H, 0.1, 100);
    camera.position.set(0, 0, 9);

    scene.add(new T.AmbientLight(0xff88aa, 0.45));
    const pk = new T.PointLight(0xff2266, 3.5, 22); pk.position.set(0, 4, 3); scene.add(pk);
    const pu = new T.PointLight(0xaa00ff, 2.5, 22); pu.position.set(-3,-2,2); scene.add(pu);

    // Herz-Form
    const shape = new T.Shape();
    shape.moveTo(0, 0.5);
    shape.bezierCurveTo(0,0.85,0.52,0.85,0.52,0.5);
    shape.bezierCurveTo(0.52,0.15,0,-0.2,0,-0.45);
    shape.bezierCurveTo(0,-0.2,-0.52,0.15,-0.52,0.5);
    shape.bezierCurveTo(-0.52,0.85,0,0.85,0,0.5);
    const heartGeo = new T.ExtrudeGeometry(shape, { depth:0.2, bevelEnabled:true, bevelSize:0.045, bevelThickness:0.045, bevelSegments:8 });
    heartGeo.center();

    const HCOLS = [0xff2255,0xff66aa,0xff44bb,0xdd0066,0xff88cc,0xee0055,0xff3377,0xcc0044];
    const hearts = Array.from({length:16},(_,i) => {
      const mat = new T.MeshStandardMaterial({ color:HCOLS[i%HCOLS.length], roughness:0.18, metalness:0.35, transparent:true, opacity:0.88 });
      const m = new T.Mesh(heartGeo, mat);
      const sc = 0.28+Math.random()*0.52; m.scale.setScalar(sc);
      m.position.set((Math.random()-0.5)*9, -5-Math.random()*6, (Math.random()-0.5)*2.5);
      m.userData = { vy:0.026+Math.random()*0.032, wb:Math.random()*Math.PI*2, ws:0.018+Math.random()*0.022, rs:(Math.random()-0.5)*0.028 };
      scene.add(m); return m;
    });

    // Glitzer
    const spkPos = new Float32Array(600*3);
    for (let i=0;i<600*3;i++) spkPos[i]=(Math.random()-0.5)*14;
    const spkGeo = new T.BufferGeometry(); spkGeo.setAttribute('position',new T.BufferAttribute(spkPos,3));
    scene.add(new T.Points(spkGeo, new T.PointsMaterial({color:0xffaacc,size:0.045,transparent:true,opacity:0.55,blending:T.AdditiveBlending})));

    return {
      scene, camera,
      onFrame(t) {
        hearts.forEach(h => {
          h.userData.wb+=h.userData.ws;
          h.position.y+=h.userData.vy;
          h.position.x+=Math.sin(h.userData.wb)*0.018;
          h.rotation.y+=h.userData.rs;
          h.rotation.z=Math.sin(h.userData.wb*0.5)*0.14;
          if (h.position.y>6) { h.position.y=-5-Math.random()*3; h.position.x=(Math.random()-0.5)*9; }
        });
        pk.position.set(Math.sin(t*0.38)*3.5, Math.cos(t*0.28)*2+1.5, 3);
        camera.position.x=Math.sin(t*0.038)*0.45;
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, opacity: 0.58, pointerEvents: 'none' }} />;
}

// 🎉 PARTY — 3D Konfetti
function Party3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(65, W / H, 0.1, 100);
    camera.position.set(0, 0, 10);
    scene.add(new T.AmbientLight(0xffffff, 0.7));
    const pl = new T.PointLight(0xff88ff, 2.5, 22); pl.position.set(0,5,3); scene.add(pl);

    const CCOLS=[0xff3366,0xff9900,0x00ddff,0xaa00ff,0x00ff88,0xffff44,0xff44bb,0x00aaff];
    const pieces = Array.from({length:130},(_,i) => {
      const c=CCOLS[i%CCOLS.length], sh=i%4;
      let geo;
      if (sh===0)      geo=new T.PlaneGeometry(0.16,0.24);
      else if (sh===1) geo=new T.CircleGeometry(0.1,6);
      else if (sh===2) geo=new T.PlaneGeometry(0.22,0.09);
      else             geo=new T.CircleGeometry(0.09,3);
      const mat=new T.MeshLambertMaterial({color:c,side:T.DoubleSide,transparent:true,opacity:0.92});
      const m=new T.Mesh(geo,mat);
      m.position.set((Math.random()-0.5)*13,5+Math.random()*9,(Math.random()-0.5)*3.5);
      m.userData={vy:-(0.042+Math.random()*0.065),vx:(Math.random()-0.5)*0.024,wb:Math.random()*Math.PI*2,ws:0.03+Math.random()*0.045,rx:(Math.random()-0.5)*0.09,ry:(Math.random()-0.5)*0.09,rz:(Math.random()-0.5)*0.055};
      scene.add(m); return m;
    });

    return {
      scene, camera,
      onFrame(t) {
        pieces.forEach(p => {
          p.userData.wb+=p.userData.ws;
          p.position.y+=p.userData.vy;
          p.position.x+=p.userData.vx+Math.sin(p.userData.wb)*0.022;
          p.rotation.x+=p.userData.rx; p.rotation.y+=p.userData.ry; p.rotation.z+=p.userData.rz;
          if (p.position.y<-6) { p.position.y=7+Math.random()*4; p.position.x=(Math.random()-0.5)*13; }
        });
        pl.position.set(Math.sin(t*0.55)*4.5, 5, Math.cos(t*0.48)*3.5);
        camera.position.x=Math.sin(t*0.032)*0.35;
      }
    };
  });
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, opacity: 0.62, pointerEvents: 'none' }} />;
}

// ❄️ WEIHNACHTEN — 3D Schnee
function Christmas3D() {
  const mountRef = useThreeScene((T, W, H) => {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(65, W / H, 0.1, 100);
    camera.position.set(0, 0, 9);
    scene.add(new T.AmbientLight(0xaabbff, 0.5));
    scene.add(Object.assign(new T.DirectionalLight(0xccddff, 0.9), { position: new T.Vector3(3,5,4) }));

    // Partikel-Schnee
    const N=700;
    const fPos=new Float32Array(N*3), fSz=new Float32Array(N);
    const fVy=new Float32Array(N), fWb=new Float32Array(N), fWs=new Float32Array(N);
    for (let i=0;i<N;i++) {
      fPos[i*3]=(Math.random()-0.5)*16; fPos[i*3+1]=(Math.random()-0.5)*11; fPos[i*3+2]=(Math.random()-0.5)*7;
      fSz[i]=0.045+Math.random()*0.1; fVy[i]=0.016+Math.random()*0.022; fWb[i]=Math.random()*Math.PI*2; fWs[i]=0.01+Math.random()*0.015;
    }
    const fGeo=new T.BufferGeometry();
    fGeo.setAttribute('position',new T.BufferAttribute(fPos,3)); fGeo.setAttribute('size',new T.BufferAttribute(fSz,1));
    const fMat=new T.PointsMaterial({color:0xddeeff,size:0.08,transparent:true,opacity:0.88,blending:T.AdditiveBlending,depthWrite:false});
    const flakes=new T.Points(fGeo,fMat); scene.add(flakes);

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
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, opacity: 0.58, pointerEvents: 'none' }} />;
}

// ── 2D Canvas Animationen (Bier, Cocktail, Sommer, Musik, Food, Halloween) ────

function CanvasBeer() {
  const c=useRef(null),r=useRef(null);
  useEffect(()=>{
    const cv=c.current; if(!cv)return; const ctx=cv.getContext('2d');
    cv.width=cv.offsetWidth; cv.height=cv.offsetHeight;
    const W=cv.width,H=cv.height;
    const bs=Array.from({length:35},()=>({x:Math.random()*W,y:H+Math.random()*H*0.5,rad:4+Math.random()*14,vy:-(0.6+Math.random()*1.4),vx:(Math.random()-0.5)*0.5,wb:Math.random()*Math.PI*2,ws:0.02+Math.random()*0.04,op:0.4+Math.random()*0.4}));
    function draw(){
      ctx.clearRect(0,0,W,H);
      bs.forEach(b=>{b.wb+=b.ws;b.x+=b.vx+Math.sin(b.wb)*0.4;b.y+=b.vy;if(b.y<-b.rad*2){b.y=H+b.rad;b.x=Math.random()*W;}
        const al=Math.min(1,(-b.y+H)/(H*0.7))*b.op*0.35;ctx.globalAlpha=al;
        const g=ctx.createRadialGradient(b.x-b.rad*0.35,b.y-b.rad*0.35,b.rad*0.05,b.x,b.y,b.rad);
        g.addColorStop(0,'rgba(255,240,180,0.9)');g.addColorStop(0.5,'rgba(220,180,80,0.4)');g.addColorStop(1,'rgba(180,140,40,0.1)');
        ctx.beginPath();ctx.arc(b.x,b.y,b.rad,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
        ctx.strokeStyle='rgba(255,230,100,0.6)';ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;});
      r.current=requestAnimationFrame(draw);
    }
    draw(); return()=>cancelAnimationFrame(r.current);
  },[]);
  return <canvas ref={c} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>;
}
function CanvasCocktail({accentColor}) {
  const c=useRef(null),r=useRef(null);
  useEffect(()=>{
    const cv=c.current;if(!cv)return;const ctx=cv.getContext('2d');
    cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;const W=cv.width,H=cv.height;
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
      r.current=requestAnimationFrame(draw);
    }
    draw();return()=>cancelAnimationFrame(r.current);
  },[]);
  return <canvas ref={c} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>;
}
function CanvasSummer() {
  const c=useRef(null),r=useRef(null);
  useEffect(()=>{
    const cv=c.current;if(!cv)return;const ctx=cv.getContext('2d');
    cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;const W=cv.width,H=cv.height;
    let t=0;
    function draw(){
      ctx.clearRect(0,0,W,H);
      const sx=W*0.85,sy=H*0.15,sr=80;
      ctx.globalAlpha=0.2;
      for(let ray=0;ray<12;ray++){const a=(ray/12)*Math.PI*2+t*0.00008,r1=sr+10,r2=sr+40+Math.sin(t*0.0005+ray)*15;ctx.strokeStyle='#fde68a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(sx+Math.cos(a)*r1,sy+Math.sin(a)*r1);ctx.lineTo(sx+Math.cos(a)*r2,sy+Math.sin(a)*r2);ctx.stroke();}
      const sg=ctx.createRadialGradient(sx,sy,sr*0.1,sx,sy,sr*1.5);sg.addColorStop(0,'#fde68a');sg.addColorStop(1,'transparent');
      ctx.beginPath();ctx.arc(sx,sy,sr*1.5,0,Math.PI*2);ctx.fillStyle=sg;ctx.globalAlpha=0.28;ctx.fill();
      ctx.globalAlpha=0.4;
      for(let wave=0;wave<4;wave++){
        const yBase=H*(0.65+wave*0.1),amp=H*0.025*(4-wave),sp=1-wave*0.15;
        ctx.beginPath();for(let x=0;x<=W;x+=3){const y=yBase+Math.sin(x/W*Math.PI*4-t*sp*0.012+wave)*amp+Math.sin(x/W*Math.PI*2.5-t*sp*0.007+wave*0.7)*amp*0.4;x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
        ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
        const wg=ctx.createLinearGradient(0,yBase,0,H);wg.addColorStop(0,'rgba(56,189,248,0.18)');wg.addColorStop(1,'rgba(14,165,233,0.08)');ctx.fillStyle=wg;ctx.fill();
      }
      ctx.globalAlpha=1;t++;r.current=requestAnimationFrame(draw);
    }
    draw();return()=>cancelAnimationFrame(r.current);
  },[]);
  return <canvas ref={c} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>;
}
function CanvasMusic({accentColor}) {
  const c=useRef(null),r=useRef(null);
  useEffect(()=>{
    const cv=c.current;if(!cv)return;const ctx=cv.getContext('2d');
    cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;const W=cv.width,H=cv.height;
    let t=0;const BAR=60;
    const hs=Array.from({length:BAR},()=>({h:0.1+Math.random()*0.5,target:0.1+Math.random()*0.6,speed:0.02+Math.random()*0.04,phase:Math.random()*Math.PI*2}));
    function draw(){
      ctx.clearRect(0,0,W,H);
      hs.forEach((b,i)=>{
        b.h+=(b.target-b.h)*b.speed;if(Math.abs(b.h-b.target)<0.01)b.target=0.05+Math.random()*0.7*Math.abs(Math.sin(t+b.phase));
        const bw=W/BAR-2,bh=b.h*H*0.55+Math.sin(t*2+b.phase)*H*0.03,bx=i*(W/BAR)+1,by=H*0.78-bh;
        const g=ctx.createLinearGradient(bx,by,bx,H*0.78);
        g.addColorStop(0,accentColor+'ff');g.addColorStop(0.5,accentColor+'aa');g.addColorStop(1,accentColor+'33');
        ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(bx,by,bw,bh,3);ctx.fill();
        ctx.globalAlpha=0.12;ctx.beginPath();ctx.roundRect(bx,H*0.78,bw,bh*0.4,3);ctx.fill();ctx.globalAlpha=1;
      });
      t+=0.022;r.current=requestAnimationFrame(draw);
    }
    draw();return()=>cancelAnimationFrame(r.current);
  },[accentColor]);
  return <canvas ref={c} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.4,pointerEvents:'none'}}/>;
}
function FoodBg(){
  return(<div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',opacity:0.18}}>
    {['🍕','🍔','🍣','🥗','🌮','🍜','🥩','🍷'].map((e,i)=>(<div key={i} style={{position:'absolute',left:`${5+i*12}%`,top:`${15+(i%3)*25}%`,fontSize:`${3+(i%3)*0.8}rem`,filter:'drop-shadow(0 0 12px rgba(255,150,50,0.5))',animation:`drinkFloat ${3+i*0.5}s ${i*0.35}s ease-in-out infinite`}}>{e}</div>))}
  </div>);
}
function HalloweenBg(){
  return(<div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',opacity:0.25}}>
    <style>{`@keyframes ghostFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-20px) rotate(3deg)}}`}</style>
    {['👻','🎃','🕷️','👻','🦇','🕸️','💀','🌙'].map((e,i)=>(<div key={i} style={{position:'absolute',left:`${5+i*12}%`,top:`${10+(i%3)*28}%`,fontSize:`${2.5+(i%3)*0.5}rem`,filter:'drop-shadow(0 0 8px rgba(255,100,0,0.6))',animation:`ghostFloat ${3+i*0.4}s ${i*0.5}s ease-in-out infinite`}}>{e}</div>))}
  </div>);
}

// ── Theme Router ──────────────────────────────────────────────────────────────
function ThemeBackground({ theme, accent }) {
  switch(theme) {
    case 'germany':           return <GermanyFlag3D />;
    case 'american_football': return <AmericanFootball3D />;
    case 'soccer':            return <Soccer3D />;
    case 'disco':             return <DiscoBall3D />;
    case 'music':             return <CanvasMusic accentColor={accent.bg} />;
    case 'beer':              return <CanvasBeer />;
    case 'cocktail':          return <CanvasCocktail accentColor={accent.bg} />;
    case 'summer':            return <CanvasSummer />;
    case 'fireworks':         return <Fireworks3D />;
    case 'halloween':         return <HalloweenBg />;
    case 'christmas':         return <Christmas3D />;
    case 'love':              return <Love3D />;
    case 'party':             return <Party3D />;
    case 'food':              return <FoodBg />;
    default:                  return <Party3D />;
  }
}

// ── Overlay Helfer ────────────────────────────────────────────────────────────
function SpotlightStreak({color}){return(<div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>{[0,1,2].map(i=>(<div key={i} style={{position:'absolute',top:`${15+i*28}%`,left:0,width:'35%',height:i===1?3:1.5,background:`linear-gradient(90deg,transparent,${color},transparent)`,opacity:i===1?0.5:0.2,animation:`spotlight ${3.5+i*1.2}s ${i*0.8}s ease-in-out infinite`}}/>))}</div>);}
function ShimmerBars({color}){return(<div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>{[0,1,2,3].map(i=>(<div key={i} style={{position:'absolute',left:0,right:0,top:`${20+i*20}%`,height:1,background:`linear-gradient(90deg,transparent,${color},transparent)`,animation:`shimmerBar ${2.5+i*0.6}s ${i*0.4}s ease-in-out infinite`}}/>))}</div>);}
function PulseRings({color}){return(<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>{[0,1,2].map(i=>(<div key={i} style={{position:'absolute',width:500+i*200,height:500+i*200,borderRadius:'50%',border:`1px solid ${color}`,opacity:0,animation:`ringPulse ${2.5+i*0.7}s ${i*0.6}s ease-in-out infinite`}}/>))}</div>);}

// ── Uhr ───────────────────────────────────────────────────────────────────────
function Clock(){const[time,setTime]=useState(new Date());useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t);},[]);return(<div style={{textAlign:'right'}}><div style={{fontSize:'3rem',fontWeight:700,lineHeight:1,color:'#fff',letterSpacing:'-0.02em'}}>{format(time,'HH:mm')}</div><div style={{fontSize:'0.9rem',color:'rgba(255,255,255,0.5)',marginTop:3}}>{format(time,'EEEE, d. MMMM',{locale:de})}</div></div>);}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({duration,color,resetKey}){const[p,setP]=useState(0);const sr=useRef(Date.now());useEffect(()=>{setP(0);sr.current=Date.now();const iv=setInterval(()=>setP(Math.min((Date.now()-sr.current)/1000/duration,1)),50);return()=>clearInterval(iv);},[duration,resetKey]);return(<div style={{position:'absolute',bottom:0,left:0,right:0,height:5,background:'rgba(255,255,255,0.08)'}}><div style={{height:'100%',width:`${p*100}%`,background:color,boxShadow:`0 0 10px ${color}`,transition:'width 0.05s linear',borderRadius:'0 3px 3px 0'}}/></div>);}

// ── Slide-Typen ───────────────────────────────────────────────────────────────
const glass = 'background:rgba(0,0,0,0.5);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:12px 24px;font-weight:600;font-size:1.1rem;color:#fff';

function SlideAnnouncement({slide,accent,theme}){return(<div style={{position:'relative',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',height:'100%',padding:'80px 120px',textAlign:'center',gap:32}}>
  <ThemeBackground theme={theme} accent={accent}/>
  <div style={{fontSize:'clamp(3rem,7vw,5.5rem)',fontWeight:900,color:'#fff',lineHeight:1.05,letterSpacing:'-0.03em',textShadow:`0 2px 40px rgba(0,0,0,0.9),0 0 80px ${accent.glow}`,animation:'floatUp 5s ease-in-out infinite',position:'relative',zIndex:1}}>{slide.title}</div>
  {slide.subtitle&&<div style={{fontSize:'1.8rem',color:'rgba(255,255,255,0.85)',animation:'floatDown 6s ease-in-out infinite',position:'relative',zIndex:1,textShadow:'0 2px 20px rgba(0,0,0,0.9)'}}>{slide.subtitle}</div>}
  {slide.body_text&&<div style={{fontSize:'1.2rem',color:'rgba(255,255,255,0.65)',maxWidth:700,position:'relative',zIndex:1,textShadow:'0 2px 10px rgba(0,0,0,0.9)'}}>{slide.body_text}</div>}
  {slide.cta_text&&<div style={{background:accent.bg,color:accent.text,padding:'16px 48px',borderRadius:16,fontWeight:800,fontSize:'1.4rem',boxShadow:`0 0 30px ${accent.glow},0 4px 20px rgba(0,0,0,0.6)`,animation:'pulseGlow 3s ease-in-out infinite',position:'relative',zIndex:1}}>{slide.cta_text}</div>}
</div>);}

function SlideEvent({slide,accent,theme}){
  const hasEnd=slide.event_end_date&&slide.event_end_date!==slide.event_date;
  const ds=slide.event_date?format(parseISO(slide.event_date),'EEEE, d. MMMM',{locale:de}):'';
  const de2=hasEnd?format(parseISO(slide.event_end_date),'d. MMMM',{locale:de}):'';
  const ts=[slide.event_time,slide.event_end_time].filter(Boolean).join(' – ')+(slide.event_time?' Uhr':'');
  return(<div style={{position:'relative',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',height:'100%',padding:'80px 120px',textAlign:'center',gap:36}}>
    <ThemeBackground theme={theme} accent={accent}/><SpotlightStreak color={accent.bg}/>
    <div style={{background:accent.soft,border:`1px solid ${accent.bg}`,borderRadius:8,padding:'6px 24px',position:'relative',zIndex:1,animation:'slideInUp 0.6s 0.1s both'}}><span style={{fontSize:'0.85rem',color:accent.bg,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>EVENT</span></div>
    <div style={{fontSize:'clamp(3rem,6.5vw,5rem)',fontWeight:900,lineHeight:1.05,letterSpacing:'-0.03em',background:`linear-gradient(90deg,#fff 0%,${accent.bg} 40%,#fff 60%,${accent.bg} 80%,#fff 100%)`,backgroundSize:'200% auto',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',animation:'shimmer 4s linear infinite,slideInUp 0.7s 0.2s both',position:'relative',zIndex:1,filter:'drop-shadow(0 2px 20px rgba(0,0,0,0.9))'}}>{slide.title}</div>
    {slide.subtitle&&<div style={{fontSize:'1.8rem',color:'rgba(255,255,255,0.8)',animation:'slideInUp 0.7s 0.35s both',position:'relative',zIndex:1,textShadow:'0 2px 20px rgba(0,0,0,0.9)'}}>{slide.subtitle}</div>}
    <div style={{display:'flex',gap:16,flexWrap:'wrap',justifyContent:'center',position:'relative',zIndex:1}}>
      {ds&&<div style={{background:'rgba(0,0,0,0.55)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:12,padding:'12px 24px',fontWeight:600,fontSize:'1.1rem',color:'#fff',animation:'slideInUp 0.7s 0.5s both'}}>📅 {ds}{de2?` – ${de2}`:''}</div>}
      {ts&&<div style={{background:'rgba(0,0,0,0.55)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:12,padding:'12px 24px',fontWeight:600,fontSize:'1.1rem',color:'#fff',animation:'slideInUp 0.7s 0.65s both'}}>🕐 {ts}</div>}
      {slide.location&&<div style={{background:'rgba(0,0,0,0.55)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:12,padding:'12px 24px',fontWeight:600,fontSize:'1.1rem',color:'#fff',animation:'slideInUp 0.7s 0.8s both'}}>📍 {slide.location}</div>}
    </div>
    {slide.cta_text&&<div style={{background:accent.bg,color:accent.text,padding:'16px 48px',borderRadius:16,fontWeight:800,fontSize:'1.4rem',boxShadow:`0 0 30px ${accent.glow},0 4px 20px rgba(0,0,0,0.6)`,animation:'slideInUp 0.7s 0.95s both,pulseGlow 3s 1.8s ease-in-out infinite',position:'relative',zIndex:1}}>{slide.cta_text}</div>}
  </div>);}

function SlideDrinkSpecial({slide,accent,theme}){
  let drinks=[];try{drinks=JSON.parse(slide.body_text||'[]');}catch{}
  if(!drinks.length)drinks=[{name:slide.title,price:slide.price_info,emoji:'🍹'}];
  const valid=drinks.filter(d=>d&&d.name);
  return(<div style={{position:'relative',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',height:'100%',padding:'60px 80px',textAlign:'center',gap:32}}>
    <ThemeBackground theme={theme} accent={accent}/><ShimmerBars color={accent.bg}/>
    <div style={{background:accent.soft,border:`1px solid ${accent.bg}`,borderRadius:8,padding:'6px 24px',position:'relative',zIndex:1,animation:'fadeInScale 0.5s 0.1s both'}}><span style={{fontSize:'0.85rem',color:accent.bg,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>DRINK SPECIAL</span></div>
    {slide.title&&valid.length>1&&<div style={{fontSize:'clamp(2.5rem,5vw,4rem)',fontWeight:900,color:'#fff',letterSpacing:'-0.03em',animation:'slideInUp 0.6s 0.2s both',position:'relative',zIndex:1,textShadow:'0 2px 30px rgba(0,0,0,0.9)'}}>{slide.title}</div>}
    <div style={{display:'flex',gap:24,flexWrap:'wrap',justifyContent:'center',width:'100%',position:'relative',zIndex:1}}>
      {valid.map((d,i)=>(<div key={i} style={{background:'rgba(0,0,0,0.5)',backdropFilter:'blur(14px)',border:`2px solid ${accent.bg}55`,borderRadius:24,padding:'28px 36px',textAlign:'center',minWidth:180,flex:'1 1 180px',maxWidth:280,animation:`bounceIn 0.7s ${0.35+i*0.15}s both`,boxShadow:`0 8px 32px rgba(0,0,0,0.5),0 0 24px ${accent.glow}22`}}>
        <div style={{fontSize:'2.8rem',marginBottom:12,display:'inline-block',animation:`drinkFloat ${3.5+i*0.5}s ${i*0.3}s ease-in-out infinite`}}>{d.emoji||'🍹'}</div>
        <div style={{fontSize:'1.3rem',fontWeight:800,color:'#fff',marginBottom:12}}>{d.name}</div>
        {d.price&&<div style={{display:'inline-block',padding:'8px 20px',borderRadius:12,background:accent.bg,color:accent.text,fontWeight:900,fontSize:'1.5rem',boxShadow:`0 0 20px ${accent.glow}`,backgroundImage:`linear-gradient(90deg,${accent.bg} 0%,#fff6 40%,${accent.bg} 60%,#fff6 80%,${accent.bg} 100%)`,backgroundSize:'200% auto',animation:'shimmer 3s linear infinite'}}>{d.price}</div>}
      </div>))}
    </div>
    {slide.subtitle&&<div style={{fontSize:'1.3rem',color:'rgba(255,255,255,0.65)',position:'relative',zIndex:1,animation:'slideInUp 0.6s 0.9s both'}}>{slide.subtitle}</div>}
  </div>);}

function SlideCountdown({slide,accent,theme}){
  const[now,setNow]=useState(new Date());useEffect(()=>{const iv=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(iv);},[]);
  if(!slide.event_date)return null;
  const target=parseISO(slide.event_date+(slide.event_time?'T'+slide.event_time:'T00:00:00'));
  const total=differenceInSeconds(target,now);
  if(total<0)return(<div style={{position:'relative',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:32,textAlign:'center'}}><ThemeBackground theme={theme} accent={accent}/><div style={{fontSize:'5rem',animation:'bounceIn 0.8s both',position:'relative',zIndex:1}}>🎉</div><div style={{fontSize:'4rem',fontWeight:900,color:accent.bg,textShadow:`0 0 60px ${accent.glow}`,animation:'pulseGlow 2s ease-in-out infinite',position:'relative',zIndex:1}}>ES IST SOWEIT!</div><div style={{fontSize:'2rem',color:'rgba(255,255,255,0.85)',fontWeight:600,position:'relative',zIndex:1,textShadow:'0 2px 20px rgba(0,0,0,0.9)'}}>{slide.title}</div></div>);
  const days=Math.floor(total/86400),hours=Math.floor((total%86400)/3600),mins=Math.floor((total%3600)/60),secs=total%60;
  const units=days>0?[{v:days,l:'Tage'},{v:hours,l:'Std.'},{v:mins,l:'Min.'}]:[{v:hours,l:'Std.'},{v:mins,l:'Min.'},{v:secs,l:'Sek.'}];
  return(<div style={{position:'relative',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:40,textAlign:'center',padding:'60px 80px'}}>
    <ThemeBackground theme={theme} accent={accent}/><PulseRings color={accent.bg}/>
    <div style={{background:accent.soft,border:`1px solid ${accent.bg}`,borderRadius:8,padding:'6px 24px',position:'relative',zIndex:1,animation:'fadeInScale 0.5s 0.1s both'}}><span style={{fontSize:'0.85rem',color:accent.bg,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>Countdown</span></div>
    <div style={{fontSize:'3.8rem',fontWeight:900,color:'#fff',lineHeight:1.05,textShadow:'0 2px 40px rgba(0,0,0,0.9)',animation:'slideInUp 0.6s 0.2s both',position:'relative',zIndex:1}}>{slide.title}</div>
    <div style={{display:'flex',gap:24,alignItems:'center',justifyContent:'center',position:'relative',zIndex:1}}>
      {units.map((u,i)=>(<div key={i} style={{textAlign:'center'}}>
        <div style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(14px)',border:`2px solid ${accent.bg}`,borderRadius:20,padding:'24px 36px',minWidth:130,boxShadow:`0 0 40px ${accent.glow},0 8px 32px rgba(0,0,0,0.6)`,animation:`bounceIn 0.7s ${0.4+i*0.12}s both`,overflow:'hidden'}}>
          <div key={`${i}-${u.v}`} style={{fontSize:'5rem',fontWeight:900,color:'#fff',lineHeight:1,letterSpacing:'-0.04em',fontVariantNumeric:'tabular-nums',animation:'numberFlip 0.35s ease-out both'}}>{String(u.v).padStart(2,'0')}</div>
          <div style={{fontSize:'1rem',color:'rgba(255,255,255,0.6)',marginTop:8,fontWeight:600}}>{u.l}</div>
        </div>
      </div>))}
    </div>
    {(slide.event_date||slide.event_time||slide.location)&&(<div style={{display:'flex',gap:16,flexWrap:'wrap',justifyContent:'center',position:'relative',zIndex:1}}>
      {slide.event_date&&<div style={{background:'rgba(0,0,0,0.55)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'10px 22px',color:'#fff',fontWeight:600,fontSize:'1.1rem',animation:'slideInUp 0.6s 0.8s both'}}>📅 {format(parseISO(slide.event_date),'EEEE, d. MMMM yyyy',{locale:de})}</div>}
      {slide.event_time&&<div style={{background:'rgba(0,0,0,0.55)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'10px 22px',color:'#fff',fontWeight:600,fontSize:'1.1rem',animation:'slideInUp 0.6s 0.95s both'}}>🕐 {slide.event_time} Uhr</div>}
      {slide.location&&<div style={{background:'rgba(0,0,0,0.55)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'10px 22px',color:'#fff',fontWeight:600,fontSize:'1.1rem',animation:'slideInUp 0.6s 1.1s both'}}>📍 {slide.location}</div>}
    </div>)}
  </div>);}

function DotNav({slides,currentIdx}){return(<div style={{position:'absolute',bottom:20,left:'50%',transform:'translateX(-50%)',display:'flex',gap:8,zIndex:20}}>{slides.map((s,i)=>{const a=ACCENTS[s.accent_color]||ACCENTS.amber;return<div key={i} style={{height:6,width:i===currentIdx?24:6,borderRadius:3,background:i===currentIdx?a.bg:'rgba(255,255,255,0.2)',transition:'all 0.3s ease',boxShadow:i===currentIdx?`0 0 8px ${a.bg}`:'none'}}/>;})}</div>);}

export default function Display(){
  const[currentIdx,setCurrentIdx]=useState(0);
  const[isTransitioning,setIsTransitioning]=useState(false);
  const timerRef=useRef(null);
  useEffect(()=>{injectKeyframes();},[]);

  const{data}=useQuery({
    queryKey:['displaySlides'],
    queryFn:async()=>{
      const res=await fetch('/functions/getDisplaySlides');
      if(!res.ok)throw new Error('Fehler');
      const json=await res.json();
      const now=new Date().toISOString();
      return(json.slides||[]).filter(s=>{if(!s.is_active)return false;if(s.show_from&&now<s.show_from)return false;if(s.show_until&&now>s.show_until)return false;return true;}).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    },
    refetchInterval:30000,
  });

  const slides=data||[];
  useEffect(()=>{
    if(!slides.length)return;
    const dur=(slides[currentIdx]?.duration_seconds||8)*1000;
    timerRef.current=setTimeout(()=>{setIsTransitioning(true);setTimeout(()=>{setCurrentIdx(i=>(i+1)%slides.length);setIsTransitioning(false);},500);},dur);
    return()=>clearTimeout(timerRef.current);
  },[currentIdx,slides]);

  const slide=slides[currentIdx];
  const accent=slide?(ACCENTS[slide.accent_color]||ACCENTS.amber):ACCENTS.amber;
  const theme=slide?(slide.background_theme&&slide.background_theme!=='auto'?slide.background_theme:detectTheme(slide.title,slide.subtitle)):'default';

  if(!slide)return(<div style={{background:'#0a0a0a',width:'100vw',height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}><div style={{fontSize:'3rem',opacity:0.3}}>📺</div><div style={{color:'rgba(255,255,255,0.4)',fontSize:'1.5rem',fontWeight:600}}>Keine aktiven Slides</div><div style={{color:'rgba(255,255,255,0.2)',fontSize:'0.9rem'}}>Erstelle Slides im Display-Manager</div></div>);

  return(<div style={{background:'#050508',width:'100vw',height:'100vh',overflow:'hidden',position:'relative',fontFamily:'"Inter",system-ui,sans-serif',color:'#fff'}}>
    <div style={{position:'absolute',inset:0,pointerEvents:'none',background:`radial-gradient(ellipse 80% 60% at 50% 100%,${accent.glow} 0%,transparent 70%)`,transition:'background 1s ease'}}/>
    <div style={{position:'absolute',top:0,left:0,right:0,zIndex:30,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'28px 48px',background:'linear-gradient(to bottom,rgba(0,0,0,0.7),transparent)'}}>
      <div style={{fontSize:'1.6rem',fontWeight:800,letterSpacing:'-0.03em',opacity:0.9}}><span style={{color:accent.bg}}>●</span> SAVO</div>
      <Clock/>
    </div>
    <div style={{position:'absolute',inset:0,opacity:isTransitioning?0:1,transition:'opacity 0.5s ease'}}>
      {slide.slide_type==='announcement' &&<SlideAnnouncement  slide={slide} accent={accent} theme={theme}/>}
      {slide.slide_type==='event'        &&<SlideEvent         slide={slide} accent={accent} theme={theme}/>}
      {slide.slide_type==='drink_special'&&<SlideDrinkSpecial  slide={slide} accent={accent} theme={theme}/>}
      {slide.slide_type==='countdown'    &&<SlideCountdown     slide={slide} accent={accent} theme={theme}/>}
    </div>
    {slides.length>1&&<DotNav slides={slides} currentIdx={currentIdx}/>}
    <ProgressBar duration={slide.duration_seconds||8} color={accent.bg} resetKey={currentIdx}/>
  </div>);
}
