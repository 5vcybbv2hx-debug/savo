/**
 * InstagramExportDialog — Rendert eine Display-Slide im Instagram-Format
 * (Reel 9:16, Post 1:1 oder 4:5) und erlaubt den Download als PNG.
 *
 * Video-Modus: Nimmt die animierte TV-Slide (aus Display.jsx) als Video auf.
 * Die Slide wird in einem 9:16-iframe gerendert (damit vw korrekt ist) und
 * frameweise per html2canvas auf einen Canvas gezeichnet, dessen Stream
 * via MediaRecorder aufgezeichnet wird.
 *
 * KI-Video (Core.GenerateVideo) als experimentelle Zweitoption.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Share2, Video, Image as ImageIcon, Info, ChevronDown, Film, X } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  ACCENTS, KEYFRAMES, injectKeyframes, detectTheme,
  SlideAnnouncement, SlideEvent, SlideDrinkSpecial, SlideCountdown, SlideQRCode, SlideTonight,
} from '@/pages/Display';
import { useSlideRecorder } from '@/components/display/useSlideRecorder';

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
  auto: 'cinematic bar atmosphere', germany: 'German flag colors waving',
  american_football: 'American football stadium energy', soccer: 'soccer stadium crowd',
  disco: 'disco ball spinning, colorful lights', music: 'live music stage, equalizer bars',
  party: 'confetti raining down, party celebration', cocktail: 'colorful cocktail bubbles',
  beer: 'beer bubbles rising in golden glasses', fireworks: 'fireworks exploding in night sky',
  summer: 'sunny beach vibes, warm golden light', christmas: 'snowflakes falling, cozy winter',
  halloween: 'spooky halloween atmosphere, pumpkins glowing', love: 'floating hearts, romantic lighting',
  food: 'delicious food close-ups, steam rising', default: 'elegant bar atmosphere with soft bokeh',
};

// ── Datum/Uhrzeit deutsch ──────────────────────────────────────────────────
function formatEventDate(slide) {
  if (!slide.event_date) return '';
  try {
    if (slide.event_end_date && slide.event_end_date !== slide.event_date) {
      return `${format(parseISO(slide.event_date), 'EE d. MMM', { locale: de })} – ${format(parseISO(slide.event_end_date), 'EE d. MMM', { locale: de })}`;
    }
    return format(parseISO(slide.event_date), 'EEEE, d. MMMM', { locale: de });
  } catch { return slide.event_date; }
}
function formatEventTime(slide) {
  const parts = [slide.event_time, slide.event_end_time].filter(Boolean);
  return parts.length ? parts.join(' – ') + ' Uhr' : '';
}
function getTitleFont(title) {
  const len = (title || '').length;
  if (len > 18) return '4rem'; if (len > 12) return '5rem'; if (len > 8) return '6.5rem'; return '8rem';
}
function buildMotionPrompt(slide) {
  const parts = ['Subtle cinematic motion, slow camera push-in, soft light flicker, floating particles'];
  const theme = THEME_PROMPTS[slide.background_theme] || THEME_PROMPTS.default;
  parts.push(theme);
  const d = formatEventDate(slide); if (d) parts.push(`Date: ${d}`);
  const t = formatEventTime(slide); if (t) parts.push(`Time: ${t}`);
  if (slide.location) parts.push(`Location: ${slide.location}`);
  return parts.join('. ');
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE-RENDERER (nutzt Display.jsx Komponenten — TV + Instagram)
// ════════════════════════════════════════════════════════════════════════════
function SlideRenderer({ slide, accent, theme, aspectRatio = '9/16' }) {
  switch (slide.slide_type) {
    case 'announcement':  return <SlideAnnouncement slide={slide} accent={accent} theme={theme} />;
    case 'event':        return <SlideEvent slide={slide} accent={accent} theme={theme} aspectRatio={aspectRatio} />;
    case 'drink_special':return <SlideDrinkSpecial slide={slide} accent={accent} theme={theme} />;
    case 'countdown':    return <SlideCountdown slide={slide} accent={accent} theme={theme} />;
    case 'qr_code':      return <SlideQRCode slide={slide} accent={accent} theme={theme} />;
    case 'tonight':      return <SlideTonight slide={slide} accent={accent} theme={theme} />;
    default:             return <SlideAnnouncement slide={slide} accent={accent} theme={theme} />;
  }
}

function IframeSlideRenderer({ slide, accent, theme, iframeRef, width = 1080, height = 1920, aspectRatio = '9/16' }) {
  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const setup = () => {
      const doc = iframe.contentDocument;
      if (!doc || !doc.body) return;
      doc.body.style.margin = '0'; doc.body.style.padding = '0';
      doc.body.style.overflow = 'hidden'; doc.body.style.background = '#050508';
      doc.body.style.width = `${width}px`; doc.body.style.height = `${height}px`;
      doc.body.style.fontFamily = '"Jost","Century Gothic",sans-serif'; doc.body.style.color = '#fff';
      const style = doc.createElement('style'); style.textContent = KEYFRAMES;
      doc.head.appendChild(style);
      // Google Fonts für Bebas Neue + Jost im iframe
      const fontLink = doc.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Jost:wght@300;400;500;600;700&display=swap';
      doc.head.appendChild(fontLink);
      setPortalTarget(doc.body);
    };
    setup();
    iframe.addEventListener('load', setup);
    return () => iframe.removeEventListener('load', setup);
  }, [width, height, iframeRef]);

  return (
    <>
      <iframe ref={iframeRef} style={{ width, height, border: 'none', display: 'block' }} />
      {portalTarget && createPortal(<SlideRenderer slide={slide} accent={accent} theme={theme} aspectRatio={aspectRatio} />, portalTarget)}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN DIALOG
// ════════════════════════════════════════════════════════════════════════════
export default function InstagramExportDialog({ open, onOpenChange, slide }) {
  const [format, setFormat] = useState('reel');
  const [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState('image');
  const [scale, setScale] = useState(0.3);
  const [kiExpanded, setKiExpanded] = useState(false);
  const [kiLoading, setKiLoading] = useState(false);
  const [kiVideoUrl, setKiVideoUrl] = useState(null);

  const wrapperRef = useRef(null);
  const videoWrapperRef = useRef(null);
  const iframeRef = useRef(null);
  const imageIframeRef = useRef(null);
  const overlayIframeRef = useRef(null);

  const fmt = FORMATS.find(f => f.value === format);
  const recorder = useSlideRecorder({ iframeRef, duration: 10 });
  const [showPreHint, setShowPreHint] = useState(false);

  // Keyframes
  useEffect(() => {
    if (!open) return;
    injectKeyframes();
  }, [open]);

  // Skalierung Bild-Modus
  useEffect(() => {
    if (!open || mode !== 'image' || !wrapperRef.current) return;
    const update = () => {
      if (!wrapperRef.current) return;
      const w = wrapperRef.current.clientWidth;
      setScale(Math.min(1, Math.max(0.2, w / fmt.w)));
    };
    update();
    const ro = new ResizeObserver(update); ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [open, mode, fmt.w]);

  // Skalierung Video-Modus
  const [videoScale, setVideoScale] = useState(0.3);
  useEffect(() => {
    if (!open || mode !== 'video' || !videoWrapperRef.current) return;
    const update = () => {
      if (!videoWrapperRef.current) return;
      const w = videoWrapperRef.current.clientWidth;
      setVideoScale(Math.min(1, Math.max(0.2, w / 1080)));
    };
    update();
    const ro = new ResizeObserver(update); ro.observe(videoWrapperRef.current);
    return () => ro.disconnect();
  }, [open, mode]);

  // ── PNG Capture (iframe body via html2canvas) ──
  const captureIframe = useCallback(async (targetFmt) => {
    const iframe = imageIframeRef.current || overlayIframeRef.current;
    if (!iframe?.contentDocument?.body) return null;
    await new Promise(r => setTimeout(r, 500));
    return html2canvas(iframe.contentDocument.body, {
      width: targetFmt.w, height: targetFmt.h, scale: 1,
      backgroundColor: null, useCORS: true, logging: false,
    });
  }, []);

  const handleDownload = async () => {
    setExporting(true);
    try {
      const canvas = await captureIframe(fmt); if (!canvas) return;
      const link = document.createElement('a');
      link.download = `instagram_${format}_${(slide.title || 'slide').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40)}.png`;
      link.href = canvas.toDataURL('image/png'); link.click();
      toast.success('Instagram-Bild heruntergeladen');
    } catch (e) { toast.error('Export fehlgeschlagen: ' + (e?.message || 'Unbekannt')); }
    finally { setExporting(false); }
  };

  const handleDownloadOverlay = async () => {
    setExporting(true);
    try {
      const canvas = await captureIframe(FORMATS[0]); if (!canvas) return;
      const link = document.createElement('a');
      link.download = `overlay_${(slide.title || 'slide').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40)}.png`;
      link.href = canvas.toDataURL('image/png'); link.click();
      toast.success('Overlay-Bild heruntergeladen');
    } catch (e) { toast.error('Download fehlgeschlagen: ' + (e?.message || 'Unbekannt')); }
    finally { setExporting(false); }
  };

  // ── KI-Video (Core.GenerateVideo) ──
  const handleGenerateKI = async () => {
    setKiLoading(true); setKiVideoUrl(null);
    try {
      const res = await base44.integrations.Core.GenerateVideo({
        prompt: buildMotionPrompt(slide), aspect_ratio: '9:16', duration: 6, generate_audio: false,
      });
      if (res?.url) { setKiVideoUrl(res.url); toast.success('KI-Video generiert!'); }
      else toast.error('Keine Video-URL erhalten');
    } catch (e) { toast.error('KI-Video fehlgeschlagen: ' + (e?.message || 'Unbekannt')); }
    finally { setKiLoading(false); }
  };

  const downloadVideo = (url, prefix) => {
    const a = document.createElement('a');
    a.href = url; a.download = `${prefix}_${(slide.title || 'slide').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40)}.mp4`;
    a.target = '_blank'; a.click();
  };

  if (!slide) return null;

  const slideAccent = ACCENTS[slide.accent_color] || ACCENTS.amber;
  const slideTheme = slide.background_theme && slide.background_theme !== 'auto'
    ? slide.background_theme : detectTheme(slide.title, slide.subtitle);
  const safeTitle = (slide.title || 'slide').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
  const videoExt = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="w-4 h-4 text-primary" />Instagram-Export</DialogTitle>
        </DialogHeader>

        {/* Modus-Umschalter */}
        <div className="flex p-1 rounded-xl bg-secondary/50 border border-border/50 gap-1">
          <button onClick={() => setMode('image')} className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5', mode === 'image' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
            <ImageIcon className="w-3.5 h-3.5" /> Bild
          </button>
          <button onClick={() => setMode('video')} className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5', mode === 'video' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
            <Video className="w-3.5 h-3.5" /> Video
          </button>
        </div>

        {mode === 'image' ? (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Format wählen</p>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map(f => (
                  <button key={f.value} onClick={() => setFormat(f.value)} className={cn('rounded-lg border p-2.5 text-center transition-all', format === f.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50')}>
                    <div className="mx-auto mb-1.5 bg-muted rounded" style={{ aspectRatio: f.ratio, width: f.ratio === '9/16' ? 18 : f.ratio === '4/5' ? 24 : 28, maxWidth: 30 }} />
                    <p className="text-[11px] font-semibold text-foreground">{f.label}</p>
                    <p className="text-[9px] text-muted-foreground">{f.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div ref={wrapperRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
              <div style={{ width: fmt.w * scale, height: fmt.h * scale, overflow: 'hidden', position: 'relative', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: fmt.w, height: fmt.h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  <IframeSlideRenderer slide={slide} accent={slideAccent} theme={slideTheme} iframeRef={imageIframeRef} width={fmt.w} height={fmt.h} aspectRatio={fmt.ratio} />
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center -mt-1">Vorschau skaliert · Download in voller Auflösung ({fmt.w}×{fmt.h}px)</p>
            <Button onClick={handleDownload} disabled={exporting} className="w-full gap-2">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Wird erstellt…' : `${fmt.label} herunterladen`}
            </Button>
          </>
        ) : (
          /* ── VIDEO MODUS ── */
          <div className="space-y-4">
            {/* Methoden-Indikator */}
            <div className="flex items-center gap-2 text-xs">
              {recorder.availableMethod === 'hd' ? (
                <span className="flex items-center gap-1.5 text-green-500"><span className="w-2 h-2 rounded-full bg-green-500" /> HD-Aufnahme (30 fps)</span>
              ) : recorder.availableMethod === 'fallback' ? (
                <span className="flex items-center gap-1.5 text-amber-500"><span className="w-2 h-2 rounded-full bg-amber-500" /> Vereinfachte Aufnahme (niedrigere Bildrate)</span>
              ) : (
                <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-muted-foreground" /> Nicht unterstützt</span>
              )}
            </div>

            {/* Vorab-Hinweis für HD-Aufnahme */}
            {showPreHint && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="text-sm text-foreground">Gleich fragt der Browser nach der Freigabe: bitte diesen Tab wählen.</p>
                <div className="flex gap-2">
                  <Button onClick={() => { setShowPreHint(false); recorder.startRecording(); }} size="sm" className="flex-1">Verstanden, Aufnahme starten</Button>
                  <Button onClick={() => setShowPreHint(false)} variant="outline" size="sm">Abbrechen</Button>
                </div>
              </div>
            )}

            {!showPreHint && recorder.availableMethod === 'none' ? (
              /* Browser nicht unterstützt */
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex gap-2">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                    Videoaufnahme geht am besten am Computer (Chrome/Edge). Alternativ das Bild herunterladen.
                  </p>
                </div>
                <Button onClick={handleDownloadOverlay} disabled={exporting} variant="outline" className="w-full gap-2">
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Bild herunterladen (Reel-Format)
                </Button>
              </div>
            ) : !showPreHint && recorder.recording ? (
              /* Aufnahme läuft */
              <div className="space-y-3">
                {recorder.activeMethod === 'fallback' && (
                  <div ref={videoWrapperRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
                    <div style={{ width: 1080 * videoScale, height: 1920 * videoScale, overflow: 'hidden', position: 'relative', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 1920, transform: `scale(${videoScale})`, transformOrigin: 'top left' }}>
                        <IframeSlideRenderer slide={slide} accent={slideAccent} theme={slideTheme} iframeRef={iframeRef} />
                      </div>
                    </div>
                  </div>
                )}
                {recorder.activeMethod === 'hd' && (
                  <p className="text-xs text-muted-foreground text-center py-8">Aufnahme läuft — der Tab-Inhalt wird aufgezeichnet.</p>
                )}
                {/* Fortschrittsbalken */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Aufnahme läuft…</span>
                    <span className="font-medium text-foreground">{Math.round(recorder.progress * (recorder.activeMethod === 'hd' ? recorder.hdDuration : recorder.fallbackDuration))}s / {recorder.activeMethod === 'hd' ? recorder.hdDuration : recorder.fallbackDuration}s</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-100" style={{ width: `${recorder.progress * 100}%` }} />
                  </div>
                </div>
                <Button onClick={recorder.cancelRecording} variant="destructive" className="w-full gap-2">
                  <X className="w-4 h-4" /> Abbrechen
                </Button>
              </div>
            ) : !showPreHint && recorder.videoUrl ? (
              /* Video fertig */
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-border bg-black flex justify-center" style={{ maxHeight: 350 }}>
                  <video src={recorder.videoUrl} controls loop playsInline className="max-h-80 rounded" style={{ aspectRatio: '9/16', height: '100%' }} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => downloadVideo(recorder.videoUrl, 'instagram_reel')} className="flex-1 gap-2">
                    <Download className="w-4 h-4" /> Video herunterladen
                  </Button>
                  <Button onClick={recorder.reset} variant="outline" className="gap-2">
                    <Video className="w-4 h-4" /> Neu
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">Format: .{videoExt}</p>
              </div>
            ) : !showPreHint ? (
              /* Bereit zur Aufnahme */
              <div className="space-y-3">
                <div ref={videoWrapperRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
                  <div style={{ width: 1080 * videoScale, height: 1920 * videoScale, overflow: 'hidden', position: 'relative', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 1920, transform: `scale(${videoScale})`, transformOrigin: 'top left' }}>
                      <IframeSlideRenderer slide={slide} accent={slideAccent} theme={slideTheme} iframeRef={iframeRef} />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">TV-Slide-Vorschau · {recorder.availableMethod === 'hd' ? recorder.hdDuration : recorder.fallbackDuration} Sekunden Aufnahme</p>
                <Button onClick={() => { if (recorder.availableMethod === 'hd') setShowPreHint(true); else recorder.startRecording(); }} className="w-full gap-2">
                  <Film className="w-4 h-4" /> Video aus TV-Slide aufnehmen
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  {recorder.availableMethod === 'hd'
                    ? 'Nimmt 10 Sekunden auf · Alle Texte & Animationen 1:1 wie im TV'
                    : 'Nimmt 6 Sekunden auf · Vereinfachte Aufnahme mit niedrigerer Bildrate'}
                </p>
              </div>
            ) : null}

            {/* KI-Atmosphäre (experimentell) — eingeklappt */}
            <div className="border-t border-border pt-3">
              <button onClick={() => setKiExpanded(!kiExpanded)} className="w-full flex items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <span className="flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> KI-Atmosphäre (experimentell)</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', kiExpanded && 'rotate-180')} />
              </button>
              {kiExpanded && (
                <div className="mt-3 space-y-2.5">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 flex gap-2">
                    <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
                      KI-Videos können Texte verändern. Für verlässliche Infos das Bild oder die TV-Slide-Videoaufnahme nutzen.
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 border border-border/50 p-2.5 text-[11px] text-muted-foreground leading-relaxed max-h-20 overflow-y-auto">
                    {buildMotionPrompt(slide)}
                  </div>
                  {kiVideoUrl && (
                    <div className="rounded-xl overflow-hidden border border-border bg-black flex justify-center" style={{ maxHeight: 280 }}>
                      <video src={kiVideoUrl} controls loop playsInline className="max-h-72 rounded" style={{ aspectRatio: '9/16', height: '100%' }} />
                    </div>
                  )}
                  <Button onClick={handleGenerateKI} disabled={kiLoading} variant="outline" className="w-full gap-2 text-xs">
                    {kiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                    {kiLoading ? 'KI generiert… (~60s)' : 'KI-Video generieren'}
                  </Button>
                  {kiVideoUrl && (
                    <Button onClick={() => downloadVideo(kiVideoUrl, 'ki_reel')} variant="outline" className="w-full gap-2 text-xs">
                      <Download className="w-3.5 h-3.5" /> KI-Video herunterladen
                    </Button>
                  )}
                  <p className="text-[10px] text-muted-foreground text-center">Kostet 30 Integrations-Credits</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hidden overlay iframe for image capture in video mode */}
        {mode === 'video' && slide && (
          <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 }} aria-hidden="true">
            <IframeSlideRenderer slide={slide} accent={slideAccent} theme={slideTheme} iframeRef={overlayIframeRef} width={1080} height={1920} aspectRatio="9/16" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}