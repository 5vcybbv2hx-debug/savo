/**
 * InstagramExportDialog — Rendert eine Display-Slide im Instagram-Format
 * (Reel 9:16, Post 1:1 oder 4:5) mit allen Event-Infos und erlaubt den
 * Download als PNG.
 *
 * KI-Video: Image-to-Video über das AI Gateway (video-gateway Backend-Function).
 * Die Event-Karte wird als PNG gerendert, hochgeladen und als first_frame
 * an das Video-Modell übergeben — so bleiben alle Texte/QR/Datum erhalten.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Share2, Video, Image as ImageIcon, ExternalLink, Info } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const FORMATS = [
  { value: 'reel',  label: 'Reel / Story', ratio: '9/16',  w: 1080, h: 1920, desc: '9:16 — Hochformat' },
  { value: 'post',  label: 'Post (quadrat)', ratio: '1/1',  w: 1080, h: 1080, desc: '1:1 — Klassischer Post' },
  { value: 'post45', label: 'Post (hoch)',  ratio: '4/5',  w: 1080, h: 1350, desc: '4:5 — Portrait-Post' },
];

const ACCENT_HEX = {
  amber: '#f59e0b', orange: '#f97316', red: '#ef4444', rose: '#f43f5e',
  pink: '#ec4899', fuchsia: '#d946ef', purple: '#a855f7', violet: '#7c3aed',
  indigo: '#6366f1', blue: '#3b82f6', sky: '#0ea5e9', cyan: '#06b6d4',
  teal: '#14b8a6', green: '#22c55e', lime: '#84cc16', white: '#f8fafc',
};

const THEME_PROMPTS = {
  auto: 'cinematic bar atmosphere',
  germany: 'German flag colors waving, festive atmosphere',
  american_football: 'American football stadium energy, dynamic',
  soccer: 'soccer stadium crowd cheering, green pitch',
  disco: 'disco ball spinning, colorful lights flashing',
  music: 'live music stage, equalizer bars pulsing',
  party: 'confetti raining down, party celebration',
  cocktail: 'colorful cocktail bubbles rising, vibrant',
  beer: 'beer bubbles rising in golden glasses',
  fireworks: 'fireworks exploding in night sky',
  summer: 'sunny beach vibes, warm golden light',
  christmas: 'snowflakes falling, cozy winter mood',
  halloween: 'spooky halloween atmosphere, pumpkins glowing',
  love: 'floating hearts, romantic warm lighting',
  food: 'delicious food close-ups, steam rising',
  default: 'elegant bar atmosphere with soft bokeh lights',
};

// ── Datum/Uhrzeit deutsch formatieren ─────────────────────────────────────
function formatEventDate(slide) {
  if (!slide.event_date) return '';
  try {
    if (slide.event_end_date && slide.event_end_date !== slide.event_date) {
      const d1 = format(parseISO(slide.event_date), 'EE d. MMM', { locale: de });
      const d2 = format(parseISO(slide.event_end_date), 'EE d. MMM', { locale: de });
      return `${d1} – ${d2}`;
    }
    return format(parseISO(slide.event_date), 'EEEE, d. MMMM', { locale: de });
  } catch { return slide.event_date; }
}

function formatEventTime(slide) {
  const parts = [slide.event_time, slide.event_end_time].filter(Boolean);
  if (!parts.length) return '';
  return parts.join(' – ') + ' Uhr';
}

// ── Titel-Schriftgröße nach Zeichenanzahl ──────────────────────────────────
function getTitleFont(title) {
  const len = (title || '').length;
  if (len > 18) return '4rem';
  if (len > 12) return '5rem';
  if (len > 8) return '6.5rem';
  return '8rem';
}

// ── QR-Code Komponente (nutzt qrcode-Paket) ─────────────────────────────────
function QRCodeImage({ size = 110, url = 'https://savo-lounge-club.de/events' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    import('qrcode').then(mod => {
      const QR = mod.default || mod;
      QR.toDataURL(url, { width: size * 2, margin: 1, color: { dark: '#000', light: '#fff' } })
        .then(d => { if (alive) setSrc(d); })
        .catch(() => {});
    }).catch(() => {});
    return () => { alive = false; };
  }, [url, size]);
  if (!src) return <div style={{ width: size, height: size, background: '#fff', borderRadius: 8 }} />;
  return <img src={src} alt="QR-Code" style={{ width: size, height: size, display: 'block' }} />;
}

// ── Motion-Prompt für Image-to-Video ───────────────────────────────────────
function buildMotionPrompt(slide) {
  const parts = [
    'Subtle cinematic motion, slow camera push-in, soft light flicker, floating particles; keep ALL text and the QR code exactly as in the reference image, do not alter, blur or move any text',
  ];
  const theme = THEME_PROMPTS[slide.background_theme] || THEME_PROMPTS.default;
  parts.push(theme);
  const dateStr = formatEventDate(slide);
  if (dateStr) parts.push(`Date: ${dateStr}`);
  const timeStr = formatEventTime(slide);
  if (timeStr) parts.push(`Time: ${timeStr}`);
  if (slide.location) parts.push(`Location: ${slide.location}`);
  return parts.join('. ');
}

// ════════════════════════════════════════════════════════════════════════════
// EVENT-KARTE (Capture-Element, wird von html2canvas erfasst)
// ════════════════════════════════════════════════════════════════════════════
function EventCard({ slide, fmt, accent, company, imageError, setImageError }) {
  const titleFont = getTitleFont(slide.title);
  const dateStr = formatEventDate(slide);
  const timeStr = formatEventTime(slide);
  const isDrinkSpecial = slide.slide_type === 'drink_special';
  const description = !isDrinkSpecial ? slide.body_text : null;
  const locationStr = slide.location || (company ? `SAVO${company.city ? ' · ' + company.city : ''}` : 'SAVO');

  let drinks = [];
  if (isDrinkSpecial && slide.body_text) {
    try { drinks = JSON.parse(slide.body_text).filter(d => d.name); } catch {}
  }

  const typeLabel = isDrinkSpecial ? 'Drink Special' :
    slide.slide_type === 'event' ? 'Event' :
    slide.slide_type === 'countdown' ? 'Countdown' :
    slide.slide_type === 'tonight' ? 'Tonight' : 'Ankündigung';

  const isCompact = fmt.h <= 1200;
  const gap = isCompact ? '1.5%' : '2.5%';

  return (
    <div
      data-capture-card
      style={{
        width: fmt.w, height: fmt.h,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '5% 6%',
        gap,
        fontFamily: '"Jost", "Century Gothic", "AppleGothic", "Segoe UI", system-ui, sans-serif',
        background: `linear-gradient(160deg, ${accent}18 0%, #0a0a0a 40%, ${accent}0a 100%)`,
      }}
    >
      {/* Ambient-Verlauf */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at 50% 25%, ${accent}25, transparent 65%)`,
      }} />

      {/* ── Header: SAVO Logo + Typ-Badge ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
        <span style={{
          fontFamily: '"Jost", "Century Gothic", sans-serif',
          fontWeight: 700, fontSize: '2.5rem', color: '#0099db',
          letterSpacing: '0.05em',
        }}>SAVO</span>
        <span style={{
          background: accent + '22', border: `1px solid ${accent}`, borderRadius: 8,
          padding: '5px 18px', fontSize: '1rem', color: accent, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>{typeLabel}</span>
      </div>

      {/* ── Bild-Banner (falls image_url) ── */}
      {slide.image_url && !imageError && (
        <div style={{
          borderRadius: 16, overflow: 'hidden', flexShrink: 0,
          height: isCompact ? '22%' : '28%', position: 'relative', zIndex: 1,
        }}>
          <img
            src={slide.image_url} alt="" crossOrigin="anonymous"
            onError={() => setImageError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* ── Titel ── */}
      <div style={{
        fontSize: titleFont, fontWeight: 900, color: '#fff',
        lineHeight: 1.05, letterSpacing: '-0.02em',
        maxWidth: '90%', wordBreak: 'keep-all', overflowWrap: 'anywhere',
        flexShrink: 0, position: 'relative', zIndex: 1,
        textShadow: '0 2px 30px rgba(0,0,0,0.8)',
      }}>{slide.title}</div>

      {/* ── Untertitel ── */}
      {slide.subtitle && (
        <div style={{
          fontSize: '1.6rem', color: 'rgba(255,255,255,0.7)',
          maxWidth: '85%', flexShrink: 0, position: 'relative', zIndex: 1,
        }}>{slide.subtitle}</div>
      )}

      {/* ── Datum + Uhrzeit ── */}
      {(dateStr || timeStr) && (
        <div style={{
          display: 'flex', gap: '5%', alignItems: 'center',
          flexShrink: 0, position: 'relative', zIndex: 1,
        }}>
          {dateStr && (
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: accent, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>Datum</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', lineHeight: 1.1, maxWidth: '46vw' }}>{dateStr}</div>
            </div>
          )}
          {dateStr && timeStr && <div style={{ width: 1, height: 50, background: accent + '44' }} />}
          {timeStr && (
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: accent, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>Uhrzeit</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{timeStr}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Ort ── */}
      {locationStr && (
        <div style={{
          fontSize: '1.3rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600,
          flexShrink: 0, position: 'relative', zIndex: 1,
        }}>📍 {locationStr}</div>
      )}

      {/* ── Beschreibung (max 3 Zeilen) ── */}
      {description && (
        <div style={{
          fontSize: '1.05rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          flexShrink: 0, position: 'relative', zIndex: 1,
        }}>{description}</div>
      )}

      {/* ── Drinks (nur drink_special) ── */}
      {drinks.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', flexShrink: 0, position: 'relative', zIndex: 1 }}>
          {drinks.map((dr, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.08)', border: `1px solid ${accent}44`,
              borderRadius: 12, padding: '10px 20px', textAlign: 'center', minWidth: 100,
            }}>
              <div style={{ fontSize: '2rem' }}>{dr.emoji}</div>
              <div style={{ fontSize: '1rem', color: '#fff', fontWeight: 600, marginTop: 2 }}>{dr.name}</div>
              {dr.price && <div style={{ fontSize: '1.1rem', color: accent, fontWeight: 800, marginTop: 2 }}>{dr.price}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── Preis ── */}
      {slide.price_info && (
        <div style={{
          fontSize: '1.4rem', color: accent, fontWeight: 800,
          flexShrink: 0, position: 'relative', zIndex: 1,
        }}>{slide.price_info}</div>
      )}

      {/* ── QR + CTA (unten) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '5%',
        marginTop: 'auto', flexShrink: 0, position: 'relative', zIndex: 1,
      }}>
        {slide.public_event && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fff', padding: 6, borderRadius: 10, display: 'inline-block' }}>
              <QRCodeImage size={110} />
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Mehr Infos</div>
          </div>
        )}
        {slide.cta_text && !slide.cta_text.startsWith('event:') && (
          <div style={{
            background: accent, color: '#fff', padding: '12px 32px',
            borderRadius: 12, fontWeight: 800, fontSize: '1.3rem',
            boxShadow: `0 0 24px ${accent}66`,
          }}>{slide.cta_text}</div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: `1px solid ${accent}33`, paddingTop: '2%',
        flexShrink: 0, position: 'relative', zIndex: 1,
      }}>
        <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)' }}>@savo_loungeclub</span>
        <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)' }}>savo-lounge-club.de</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN DIALOG
// ════════════════════════════════════════════════════════════════════════════
export default function InstagramExportDialog({ open, onOpenChange, slide }) {
  const [format, setFormat] = useState('reel');
  const [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState('image');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [scale, setScale] = useState(0.3);
  const [company, setCompany] = useState(null);
  const [imageError, setImageError] = useState(false);
  const captureRef = useRef(null);
  const wrapperRef = useRef(null);

  const fmt = FORMATS.find(f => f.value === format);
  const accent = slide ? (ACCENT_HEX[slide.accent_color] || '#f59e0b') : '#f59e0b';

  // CompanyInfo für Ort/Logo laden
  useEffect(() => {
    if (!open) return;
    base44.entities.CompanyInfo.list().then(records => {
      if (records?.[0]) setCompany(records[0]);
    }).catch(() => {});
  }, [open]);

  // Reset imageError bei Slide-Wechsel
  useEffect(() => {
    setImageError(false);
  }, [slide?.id]);

  // Skalierung: Karte an Dialogbreite anpassen
  useEffect(() => {
    if (!open || !wrapperRef.current) return;
    const updateScale = () => {
      if (!wrapperRef.current) return;
      const availWidth = wrapperRef.current.clientWidth;
      const s = Math.min(1, Math.max(0.2, availWidth / fmt.w));
      setScale(s);
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [open, fmt.w]);

  // ── PNG Capture (für Download und Video) ────────────────────────────────
  const captureCanvas = useCallback(async (targetFmt) => {
    if (!captureRef.current) return null;
    // Kurz warten falls QR-Code noch lädt
    await new Promise(r => setTimeout(r, 300));
    const canvas = await html2canvas(captureRef.current, {
      width: targetFmt.w, height: targetFmt.h, scale: 1,
      backgroundColor: null, useCORS: true, logging: false,
      onclone: (clonedDoc) => {
        const el = clonedDoc.querySelector('[data-capture-card]');
        if (el) {
          el.style.transform = 'none';
          el.style.position = 'static';
          el.style.top = 'auto';
          el.style.left = 'auto';
        }
      },
    });
    return canvas;
  }, []);

  const handleDownload = async () => {
    setExporting(true);
    try {
      const canvas = await captureCanvas(fmt);
      if (!canvas) return;
      const link = document.createElement('a');
      const safeTitle = (slide.title || 'slide').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
      link.download = `instagram_${format}_${safeTitle}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Instagram-Bild heruntergeladen');
    } catch (e) {
      toast.error('Export fehlgeschlagen: ' + (e?.message || 'Unbekannt'));
    } finally {
      setExporting(false);
    }
  };

  // ── PNG für Video-Overlay herunterladen ──────────────────────────────────
  const handleDownloadOverlay = async () => {
    setExporting(true);
    try {
      const reelFmt = FORMATS[0]; // immer Reel für Video-Overlay
      const canvas = await captureCanvas(reelFmt);
      if (!canvas) return;
      const link = document.createElement('a');
      const safeTitle = (slide.title || 'slide').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
      link.download = `overlay_${safeTitle}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Overlay-Bild heruntergeladen');
    } catch (e) {
      toast.error('Download fehlgeschlagen: ' + (e?.message || 'Unbekannt'));
    } finally {
      setExporting(false);
    }
  };

  // ── KI-Video mit Image-to-Video (AI Gateway) ─────────────────────────────
  const handleGenerateVideo = async () => {
    setVideoLoading(true);
    setVideoUrl(null);
    try {
      // 1. PNG der Event-Karte rendern (Reel-Format)
      const reelFmt = FORMATS[0];
      const canvas = await captureCanvas(reelFmt);
      if (!canvas) throw new Error('Karte konnte nicht gerendert werden');

      // 2. PNG hochladen (stored publicly — anyone with the link can open them)
      const dataUrl = canvas.toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'event-card.png', { type: 'image/png' });
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
      const imageUrl = uploadRes?.file_url;
      if (!imageUrl) throw new Error('Upload fehlgeschlagen');

      // 3. Video-Generierung mit first_frame (Image-to-Video)
      const motionPrompt = buildMotionPrompt(slide);
      const createRes = await base44.functions.invoke('video-gateway', {
        action: 'create',
        request: {
          model: 'seedance_2_fast',
          prompt: motionPrompt,
          seconds: 6,
          aspect_ratio: '9:16',
          resolution: '720p',
          frame_images: [{
            type: 'image_url',
            image_url: { url: imageUrl },
            frame_type: 'first_frame',
          }],
          generate_audio: false,
        },
      });

      let video = createRes.data;
      if (!video?.id) throw new Error('Keine Video-ID erhalten');

      // 4. Polling bis Video fertig
      const POLL_MS = 5000;
      const MAX_POLLS = 24;
      const isProcessing = (s) => s === 'queued' || s === 'in_progress';

      for (let i = 0; isProcessing(video.status) && i < MAX_POLLS; i++) {
        await new Promise(r => setTimeout(r, POLL_MS));
        const retrieveRes = await base44.functions.invoke('video-gateway', {
          action: 'retrieve', videoId: video.id,
        });
        video = retrieveRes.data;
      }

      if (video.status === 'failed') throw new Error(video.error?.message || 'Video-Generierung fehlgeschlagen');
      if (!video.url) throw new Error('Video-URL nicht verfügbar');

      setVideoUrl(video.url);
      toast.success('Video generiert!');
    } catch (e) {
      toast.error('Video-Generierung fehlgeschlagen: ' + (e?.message || 'Unbekannt'));
    } finally {
      setVideoLoading(false);
    }
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    const safeTitle = (slide.title || 'slide').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
    a.href = videoUrl;
    a.download = `instagram_reel_${safeTitle}.mp4`;
    a.target = '_blank';
    a.click();
  };

  if (!slide) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            Instagram-Export
          </DialogTitle>
        </DialogHeader>

        {/* Modus-Umschalter: Bild vs Video */}
        <div className="flex p-1 rounded-xl bg-secondary/50 border border-border/50 gap-1">
          <button
            onClick={() => setMode('image')}
            className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
              mode === 'image' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Bild
          </button>
          <button
            onClick={() => setMode('video')}
            className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
              mode === 'video' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
          >
            <Video className="w-3.5 h-3.5" /> Video (KI)
          </button>
        </div>

        {mode === 'image' ? (
          <>
            {/* Format-Auswahl */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Format wählen</p>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={cn(
                      'rounded-lg border p-2.5 text-center transition-all',
                      format === f.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="mx-auto mb-1.5 bg-muted rounded" style={{ aspectRatio: f.ratio, width: f.ratio === '9/16' ? 18 : f.ratio === '4/5' ? 24 : 28, maxWidth: 30 }} />
                    <p className="text-[11px] font-semibold text-foreground">{f.label}</p>
                    <p className="text-[9px] text-muted-foreground">{f.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Vorschau — skaliert via transform */}
            <div ref={wrapperRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
              <div style={{ width: fmt.w * scale, height: fmt.h * scale, overflow: 'hidden', position: 'relative' }}>
                <div ref={captureRef} style={{ position: 'absolute', top: 0, left: 0, width: fmt.w, height: fmt.h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  <EventCard slide={slide} fmt={fmt} accent={accent} company={company} imageError={imageError} setImageError={setImageError} />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground text-center -mt-1">
              Vorschau skaliert · Download in voller Auflösung ({fmt.w}×{fmt.h}px)
            </p>

            <Button onClick={handleDownload} disabled={exporting} className="w-full gap-2">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Wird erstellt…' : `${fmt.label} herunterladen`}
            </Button>
          </>
        ) : (
          /* ── VIDEO MODUS ── */
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5" /> KI-Video mit Referenzbild
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Die Event-Karte wird als Bild gerendert und als Startbild (first frame) an das
                Video-Modell übergeben. So bleiben alle Texte, Datum und QR-Code erhalten.
                Dauer ca. 1–3 Minuten. 6 Sekunden, 9:16, ohne Audio.
              </p>
            </div>

            {/* Hinweis: KI-Video Text-Limitation */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 flex gap-2">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
                KI-Videos können Texte verändern. Für verlässliche Infos das Bild (PNG) nutzen
                oder das Video in Instagram mit Text-Sticker ergänzen.
              </p>
            </div>

            {/* Prompt-Vorschau */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Motion-Prompt:</p>
              <div className="rounded-lg bg-muted/40 border border-border/50 p-2.5 text-[11px] text-muted-foreground leading-relaxed max-h-20 overflow-y-auto">
                {buildMotionPrompt(slide)}
              </div>
            </div>

            {/* Video-Vorschau / Ergebnis */}
            {videoUrl && (
              <div className="space-y-2">
                <div className="rounded-xl overflow-hidden border border-border bg-black flex justify-center" style={{ maxHeight: 320 }}>
                  <video src={videoUrl} controls playsInline className="max-h-80 rounded" style={{ aspectRatio: '9/16', height: '100%' }} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={downloadVideo} className="flex-1 gap-2">
                    <Download className="w-4 h-4" /> Video herunterladen
                  </Button>
                  <Button variant="outline" asChild className="gap-2">
                    <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" /> Öffnen
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {/* Generieren-Button */}
            {!videoUrl && (
              <Button onClick={handleGenerateVideo} disabled={videoLoading} className="w-full gap-2">
                {videoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                {videoLoading ? 'Video wird generiert… (~1–3 Min.)' : 'Video generieren (9:16, 6 Sek.)'}
              </Button>
            )}

            {/* Neu generieren */}
            {videoUrl && (
              <Button onClick={handleGenerateVideo} disabled={videoLoading} variant="outline" className="w-full gap-2 text-xs">
                {videoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                {videoLoading ? 'Generiert…' : 'Neues Video generieren'}
              </Button>
            )}

            {/* Overlay-Bild Download */}
            <Button onClick={handleDownloadOverlay} disabled={exporting} variant="outline" className="w-full gap-2 text-xs">
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Infos als Bild herunterladen (für Video-Overlay)
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              Kostet Integrations-Credits pro Video
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}