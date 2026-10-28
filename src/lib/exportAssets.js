/**
 * Export-Assets — Vorladen der Brand-Assets (Steinwand) für den Bild-/Video-Export.
 *
 * Hintergrund: html2canvas rendert CSS-`background-image` erst, wenn das Bild
 * bereits geladen ist – beim Export war die Steinwand deshalb oft noch leer.
 * Im Export wird die Wand daher als Data-URL in ein echtes <img> gelegt
 * (siehe WallAssetContext + BrandWallBackground in Display.jsx).
 */
import { createContext } from 'react';
import { BRAND_WALL_URL } from './brandAssets';

/** Im Export gesetzt: Steinwand als Data-URL. TV-Display nutzt null → CSS-Background wie bisher. */
export const WallAssetContext = createContext(null);

let wallPromise = null;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

/** Lädt die Steinwand einmalig als Data-URL (fetch → Blob, Fallback: <img> → Canvas). */
export function loadBrandWallDataUrl() {
  if (wallPromise) return wallPromise;
  wallPromise = (async () => {
    try {
      const res = await fetch(BRAND_WALL_URL, { mode: 'cors' });
      if (!res.ok) throw new Error(`Wall fetch ${res.status}`);
      return await blobToDataUrl(await res.blob());
    } catch {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = BRAND_WALL_URL;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/jpeg', 0.92);
    }
  })();
  return wallPromise;
}

/** Wartet, bis alle <img> (Steinwand, QR-Code) im Dokument geladen sind. */
export async function waitForImages(doc) {
  const imgs = Array.from(doc?.images || []);
  await Promise.all(imgs.map(img => (
    img.complete && img.naturalWidth > 0
      ? Promise.resolve()
      : new Promise(res => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
        })
  )));
  try { await doc?.fonts?.ready; } catch { /* Fonts sind nicht kritisch */ }
}

/**
 * Wird im Export-iframe eingebunden und nur bei gesetzter Klasse `.export-freeze`
 * aktiv: Animationen springen in den Endzustand (Titel sichtbar, Glow an) und
 * Gradient-Titel werden solide gerendert (html2canvas kann background-clip:text nicht).
 */
export const EXPORT_FREEZE_CSS = `
.export-freeze *, .export-freeze *::before, .export-freeze *::after {
  animation-delay: 0s !important;
  animation-duration: 0.001s !important;
  animation-iteration-count: 1 !important;
  animation-fill-mode: both !important;
  transition: none !important;
}
.export-freeze [style*="background-clip"] {
  -webkit-text-fill-color: #fff !important;
  background: none !important;
  color: #fff !important;
}
`;