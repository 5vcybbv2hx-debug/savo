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

/**
 * Layout im Export — Schriftgröße ~5,5 % der Bildbreite, Abstand 5 % rechts / 6 % unten.
 * Gilt für alle drei Bildformate (9:16, 1:1, 4:5).
 */
export const SAVO_LOGO_LAYOUT = {
  fontRatio: 0.055,
  rightRatio: 0.05,
  bottomRatio: 0.06,
  opacity: 0.78,
};

/** Stellt sicher, dass Bebas Neue im Canvas verfügbar ist (Fallback: Jost). */
export async function ensureSavoLogoFont() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  try {
    await document.fonts.load(`400 100px "Bebas Neue"`);
  } catch { /* Fallback auf Jost */ }
}

/** Mittlere Helligkeit (0–1) im Bereich, um Weiß vs. SAVO-Blau zu wählen. */
function regionLuminance(ctx, x, y, w, h) {
  try {
    const data = ctx.getImageData(Math.max(0, x), Math.max(0, y), Math.max(1, w), Math.max(1, h)).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 32) {
      if (data[i + 3] < 40) continue;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      n++;
    }
    return n ? sum / n / 255 : 0;
  } catch {
    return 0;
  }
}

/**
 * Zeichnet "SAVO" unten rechts auf ein Canvas (volle Export-Auflösung).
 * Weiß auf dunklen Motiven (Steinwand), SAVO-Blau auf hellen.
 */
export function drawSavoWordmark(ctx, width, height, layout = SAVO_LOGO_LAYOUT) {
  if (!ctx || !width || !height) return;

  const fontSize = Math.round(width * layout.fontRatio);
  const x = Math.round(width - width * layout.rightRatio);
  const y = Math.round(height - height * layout.bottomRatio);

  ctx.save();
  ctx.font = `400 ${fontSize}px ${FONT_STACK}`;
  ctx.letterSpacing = `${(fontSize * 0.1).toFixed(1)}px`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';

  const metrics = ctx.measureText(WORD);
  const boxW = Math.min(width, Math.ceil(metrics.width) + fontSize);
  const boxH = Math.ceil(fontSize * 1.5);
  const onLightGround = regionLuminance(ctx, x - boxW, y - boxH, boxW, boxH) > 0.55;

  ctx.globalAlpha = layout.opacity;
  ctx.fillStyle = onLightGround ? SAVO_BLUE : '#ffffff';
  if (!onLightGround) {
    // dezenter Schatten, damit das weiße Wortzeichen auch auf hellen Steinflächen lesbar bleibt
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = fontSize * 0.28;
    ctx.shadowOffsetY = fontSize * 0.04;
  }
  ctx.fillText(WORD, x, y);
  ctx.restore();
}