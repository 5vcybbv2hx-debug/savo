/**
 * InstagramExportDialog — Rendert eine Display-Slide im Instagram-Format
 * (Reel 9:16, Post 1:1 oder 4:5) und erlaubt den Download als PNG.
 *
 * Nutzt html2canvas (bereits installiert) zum Rendern des DOM-Knotens.
 */
import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
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

export default function InstagramExportDialog({ open, onOpenChange, slide }) {
  const [format, setFormat] = useState('reel');
  const [exporting, setExporting] = useState(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            Instagram-Export
          </DialogTitle>
        </DialogHeader>

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
        <div className="flex justify-center py-2">
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
              // Skaliert via CSS-transform im Wrapper, aber html2canvas nutzt Originalgröße
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

        {/* Skalierte Vorschau-Hinweis */}
        <p className="text-[10px] text-muted-foreground text-center -mt-1">
          Vorschau wird skaliert angezeigt · Download in voller Auflösung ({fmt.w}×{fmt.h}px)
        </p>

        {/* Download */}
        <Button onClick={handleDownload} disabled={exporting} className="w-full gap-2">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Wird erstellt…' : `${fmt.label} herunterladen`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}