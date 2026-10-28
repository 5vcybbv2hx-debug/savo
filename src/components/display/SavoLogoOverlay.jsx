/**
 * SAVO-Logo — Wortzeichen in der Slide-Typografie (Bebas Neue, letter-spacing 0.1em).
 *
 * <SavoWordmarkIcon />   kleines Icon (z. B. Toggle im Export-Modal)
 * <SavoLogoOverlay />    Overlay in der Export-Vorschau — prozentuales Layout,
 *                        identisch zur Position im fertigen Bild
 */
import React from 'react';
import { SAVO_LOGO_LAYOUT } from '@/lib/savoWordmark';

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

export default function SavoLogoOverlay({ width, height }) {
  if (!width || !height) return null;
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        right: width * SAVO_LOGO_LAYOUT.rightRatio,
        bottom: height * SAVO_LOGO_LAYOUT.bottomRatio,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          fontFamily: '"Bebas Neue","Jost",sans-serif',
          fontSize: Math.max(8, width * SAVO_LOGO_LAYOUT.fontRatio),
          letterSpacing: '0.1em',
          lineHeight: 1,
          color: '#ffffff',
          opacity: SAVO_LOGO_LAYOUT.opacity,
          filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.55))',
        }}
      >
        SAVO
      </span>
    </div>
  );
}