/**
 * SAVO-Wortzeichen für den Export (Instagram/Content).
 *
 * Gezeichnet direkt auf das gerenderte Canvas — Typografie identisch zum
 * SAVO-Logo der Slides (Bebas Neue, letter-spacing 0.1em).
 * Die TV-Display-Anzeige nutzt diese Datei bewusst NICHT.
 */
import { SAVO_BLUE } from '@/lib/brandAssets';

const FONT_STACK = '"Bebas Neue","Jost",sans-serif';
const WORD = 'SAVO';

/** Layout im Export — Schriftgröße ~17 % der Bildbreite, oberhalb der Bildmitte. */
export const SAVO_LOGO_LAYOUT = {
  fontRatio: 0.17,
  centerYRatio: 0.3,
  opacity: 0.85,
};

/** Stellt sicher, dass Bebas Neue im Canvas verfügbar ist (Fallback: Jost). */
export async function ensureSavoLogoFont() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  try {
    await document.fonts.load(`400 100px "Bebas Neue"`);
  } catch { /* Fallback auf Jost */ }
}

/**
 * Zeichnet "SAVO" in SAVO-Blau auf ein Canvas (volle Export-Auflösung).
 */
export function drawSavoWordmark(ctx, width, height, layout = SAVO_LOGO_LAYOUT) {
  if (!ctx || !width || !height) return;

  const fontSize = Math.round(width * layout.fontRatio);

  ctx.save();
  ctx.font = `400 ${fontSize}px ${FONT_STACK}`;
  ctx.letterSpacing = `${(fontSize * 0.1).toFixed(1)}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = layout.opacity;
  ctx.fillStyle = SAVO_BLUE;
  // feiner Schatten, damit das blaue Wortzeichen auch auf dunklem Stein lesbar bleibt
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = fontSize * 0.2;
  ctx.fillText(WORD, width / 2, height * layout.centerYRatio);
  ctx.restore();
}