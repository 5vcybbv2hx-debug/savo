/**
 * InstagramGlyph — offizielle Kamera-Glyphe als Inline-SVG.
 *
 * <InstagramGlyph size={…} />   kleines Icon (z. B. Toggle im Export-Modal)
 * <InstagramGlyphOverlay />     Overlay in der Export-Vorschau — prozentuales
 *                               Layout, identisch zur Position im fertigen Bild
 */
import React from 'react';
import { INSTAGRAM_GLYPH_PATH, INSTAGRAM_GLYPH_VIEWBOX, GLYPH_LAYOUT } from '@/lib/instagramGlyph';

export function InstagramGlyph({ size = 16, className = '', opacity = 1 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${INSTAGRAM_GLYPH_VIEWBOX} ${INSTAGRAM_GLYPH_VIEWBOX}`}
      className={className}
      style={{ opacity, fill: 'currentColor' }}
      aria-hidden="true"
    >
      <path d={INSTAGRAM_GLYPH_PATH} />
    </svg>
  );
}

export default function InstagramGlyphOverlay() {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        right: `${GLYPH_LAYOUT.rightRatio * 100}%`,
        bottom: `${GLYPH_LAYOUT.bottomRatio * 100}%`,
        width: `${GLYPH_LAYOUT.sizeRatio * 100}%`,
        aspectRatio: '1 / 1',
      }}
    >
      <svg
        viewBox={`0 0 ${INSTAGRAM_GLYPH_VIEWBOX} ${INSTAGRAM_GLYPH_VIEWBOX}`}
        width="100%"
        height="100%"
        aria-hidden="true"
        style={{
          fill: '#ffffff',
          opacity: GLYPH_LAYOUT.opacity,
          filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.45))',
        }}
      >
        <path d={INSTAGRAM_GLYPH_PATH} />
      </svg>
    </div>
  );
}