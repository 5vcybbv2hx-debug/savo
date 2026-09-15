/**
 * InstagramExportDialog — Rendert eine Display-Slide im Instagram-Format
 * (Reel 9:16, Post 1:1 oder 4:5) und erlaubt den Download als PNG.
 *
 * Zusätzlich: KI-Video-Generierung für Reels/Stories (9:16, 6 Sekunden)
 * über die Core.GenerateVideo Integration.
 */
import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Share2, Video, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

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

// Baut einen Video-Prompt aus den Slide-Daten
function buildVideoPrompt(slide) {
  const parts = [];
  const theme = THEME_PROMPTS[slide.background_theme] || THEME_PROMPTS.default;
  parts.push(theme);

  if (slide.title) parts.push(`Text overlay: "${slide.title}"`);
  if (slide.subtitle) parts.push(`Subtitle: "${slide.subtitle}"`);

  // Drinks
  if (slide.slide_type === 'drink_special' && slide.body_text) {
    try {
      const drinks = JSON.parse(slide.body_text).filter(d => d.name);
      if (drinks.length) {
        const drinkDesc = drinks.map(d => `${d.emoji || ''} ${d.name}${d.price ? ` (${d.price})` : ''}`).join(', ');
        parts.push(`Featured drinks: ${drinkDesc}`);
      }
    } catch {}
  }

  // Event-Details
  if (slide.event_date) parts.push(`Date: ${slide.event_date}`);
  if (slide.event_time) parts.push(`Time: ${slide.event_time}`);
  if (slide.location) parts.push(`Location: ${slide.location}`);
  if (slide.cta_text) parts.push(`Call to action: "${slide.cta_text}"`);

  parts.push('Vertical 9:16 format, 6 seconds, energetic and eye-catching, suitable for Instagram Reel');
  return parts.join('. ');
}

export default function InstagramExportDialog({ open, onOpenChange, slide }) {
  const [format, setFormat] = useState('reel');
  const [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState('image'); // 'image' | 'video'
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const captureRef = useRef(null);

  if (!slide) return null;

  const accent = ACCENT_HEX[slide.accent_color] || '#f59e0b';
  const fmt = FORMATS.find(f => f.value === format);

  // Drinks aus body_text (JSON) falls drink_special
  let drinks = [];
  if (slide.slide_type === 'drink_special' && slide.body_text) {
    try { drinks = JSON.parse(slide.body_text).filter(d => d.name); } catch {}
  }

  const handleDownload = async () => {
    if (!captureRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(captureRef.current, {
        width: fmt.w,
        height: fmt.h,
        scale: 1,
        backgroundColor: '#0a0a0a',
        useCORS: true,
        logging: false,
      });
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

  const handleGenerateVideo = async () => {
    setVideoLoading(true);
    setVideoUrl(null);
    try {
      const prompt = buildVideoPrompt(slide);
      const res = await base44.integrations.Core.GenerateVideo({
        prompt,
        aspect_ratio: '9:16',
        duration: 6,
        generate_audio: false,
      });
      if (res?.url) {
        setVideoUrl(res.url);
        toast.success('Video generiert!');
      } else {
        toast.error('Keine Video-URL erhalten');
      }
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
                      format === f.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div
                      className="mx-auto mb-1.5 bg-muted rounded"
                      style={{
                        aspectRatio: f.ratio,
                        width: f.ratio === '9/16' ? 18 : f.ratio === '4/5' ? 24 : 28,
                        maxWidth: 30,
                      }}
                    />
                    <p className="text-[11px] font-semibold text-foreground">{f.label}</p>
                    <p className="text-[9px] text-muted-foreground">{f.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Vorschau — wird für html2canvas gerendert */}
            <div className="flex justify-center py-2 overflow-hidden">
              <div
                ref={captureRef}
                style={{
                  width: fmt.w,
                  height: fmt.h,
                  aspectRatio: fmt.ratio,
                  background: '#0a0a0a',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '6%',
                  textAlign: 'center',
                  gap: '3%',
                }}
                className="rounded-xl"
              >
                {/* Typ-Badge */}
                <div style={{
                  background: accent + '22',
                  border: `1px solid ${accent}`,
                  borderRadius: 8,
                  padding: '6px 20px',
                  fontSize: '1.1rem',
                  color: accent,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>
                  {slide.slide_type === 'drink_special' ? 'Drink Special' :
                   slide.slide_type === 'event' ? 'Event' :
                   slide.slide_type === 'countdown' ? 'Countdown' :
                   slide.slide_type === 'tonight' ? 'Tonight' :
                   'Ankündigung'}
                </div>

                {/* Titel */}
                <div style={{
                  fontSize: format === 'reel' ? '4.5rem' : '3.5rem',
                  fontWeight: 900,
                  color: '#fff',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  maxWidth: '90%',
                }}>
                  {slide.title || 'Titel'}
                </div>

                {/* Untertitel */}
                {slide.subtitle && (
                  <div style={{
                    fontSize: format === 'reel' ? '1.8rem' : '1.5rem',
                    color: 'rgba(255,255,255,0.65)',
                    maxWidth: '85%',
                  }}>
                    {slide.subtitle}
                  </div>
                )}

                {/* Drink-Specials */}
                {drinks.length > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: 16,
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    maxWidth: '90%',
                  }}>
                    {drinks.map((dr, i) => (
                      <div key={i} style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: `1px solid ${accent}44`,
                        borderRadius: 14,
                        padding: '14px 24px',
                        textAlign: 'center',
                        minWidth: 120,
                      }}>
                        <div style={{ fontSize: '2.5rem' }}>{dr.emoji}</div>
                        <div style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 600, marginTop: 4 }}>{dr.name}</div>
                        {dr.price && <div style={{ fontSize: '1.3rem', color: accent, fontWeight: 800, marginTop: 2 }}>{dr.price}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Event-Details */}
                {slide.slide_type === 'event' && (slide.event_date || slide.location) && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {slide.event_date && (
                      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 22px', color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>
                        📅 {slide.event_date}
                      </div>
                    )}
                    {slide.event_time && (
                      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 22px', color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>
                        🕐 {slide.event_time}
                      </div>
                    )}
                    {slide.location && (
                      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 22px', color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>
                        📍 {slide.location}
                      </div>
                    )}
                  </div>
                )}

                {/* CTA */}
                {slide.cta_text && (
                  <div style={{
                    background: accent,
                    color: '#fff',
                    padding: '14px 40px',
                    borderRadius: 14,
                    fontWeight: 800,
                    fontSize: '1.4rem',
                    boxShadow: `0 0 24px ${accent}66`,
                  }}>
                    {slide.cta_text}
                  </div>
                )}

                {/* Bild */}
                {slide.image_url && slide.slide_type !== 'drink_special' && (
                  <img
                    src={slide.image_url}
                    alt=""
                    crossOrigin="anonymous"
                    style={{
                      maxWidth: '80%',
                      maxHeight: format === 'reel' ? '40%' : '35%',
                      borderRadius: 16,
                      objectFit: 'cover',
                    }}
                  />
                )}

                {/* Farbstreifen unten */}
                <div style={{
                  position: 'absolute',
                  bottom: 0, left: 0, right: 0,
                  height: 8,
                  background: accent,
                  boxShadow: `0 0 12px ${accent}66`,
                }} />
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground text-center -mt-1">
              Vorschau wird skaliert angezeigt · Download in voller Auflösung ({fmt.w}×{fmt.h}px)
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
                <Video className="w-3.5 h-3.5" /> KI-Video-Generierung
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Generiert ein 6-Sekunden-Video im Reel-Format (9:16) aus den Slide-Daten.
                Dauer ca. 30–60 Sekunden. Ohne Audio — perfekt für Instagram-Reels mit eigener Musik.
              </p>
            </div>

            {/* Prompt-Vorschau */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">KI-Prompt (aus Slide generiert):</p>
              <div className="rounded-lg bg-muted/40 border border-border/50 p-2.5 text-[11px] text-muted-foreground leading-relaxed max-h-24 overflow-y-auto">
                {buildVideoPrompt(slide)}
              </div>
            </div>

            {/* Video-Vorschau / Ergebnis */}
            {videoUrl && (
              <div className="space-y-2">
                <div className="rounded-xl overflow-hidden border border-border bg-black flex justify-center" style={{ maxHeight: 320 }}>
                  <video
                    src={videoUrl}
                    controls
                    playsInline
                    className="max-h-80 rounded"
                    style={{ aspectRatio: '9/16', height: '100%' }}
                  />
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
                {videoLoading ? 'Video wird generiert… (~60s)' : 'Video generieren (9:16, 6 Sek.)'}
              </Button>
            )}

            {/* Neu generieren */}
            {videoUrl && (
              <Button onClick={handleGenerateVideo} disabled={videoLoading} variant="outline" className="w-full gap-2 text-xs">
                {videoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                {videoLoading ? 'Generiert…' : 'Neues Video generieren'}
              </Button>
            )}

            <p className="text-[10px] text-muted-foreground text-center">
              Kostet 30 Integrations-Credits pro Video
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}