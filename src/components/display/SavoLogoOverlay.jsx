/**
 * SAVO-Logo — Wortzeichen in der Slide-Typografie (Bebas Neue, letter-spacing 0.1em).
 *
 * <SavoWordmarkIcon />   kleines Icon (z. B. Toggle im Export-Modal)
 * <SavoLogoOverlay />    Overlay in der Export-Vorschau — zentral, in SAVO-Blau,
 *                        identische Größe wie im fertigen Bild
 */
import React from 'react';
import { SAVO_LOGO_LAYOUT } from '@/lib/savoWordmark';
import { SAVO_BLUE } from '@/lib/brandAssets';

export function SavoWordmarkIcon({ size = 15, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        fontFamily: '"Bebas Neue","Jost",sans-serif',
        fontSize: size,
        letterSpacing: '0.08em',
        lineHeight: 1,
        color: 'currentColor',
      }}
    >
      SAVO
    </span>
  );
}

export default function SavoLogoOverlay({ width }) {
  if (!width) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          fontFamily: '"Bebas Neue","Jost",sans-serif',
          fontSize: Math.max(10, width * SAVO_LOGO_LAYOUT.fontRatio),
          letterSpacing: '0.1em',
          lineHeight: 1,
          color: SAVO_BLUE,
          opacity: SAVO_LOGO_LAYOUT.opacity,
          filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.35))',
        }}
      >
        SAVO
      </span>
    </div>
  );
}