/**
 * Teilen statt „irgendwo speichern“.
 *
 * Primär: Web Share API mit Datei — iOS bietet „Bild sichern“ (landet direkt in
 * Fotos), Android Fotos/Galerie. Fallback: klassischer Download mit sprechendem
 * Dateinamen (savo_<titel>_<format>_<datum>.<ext>).
 */

export function canShareFiles() {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || (navigator?.maxTouchPoints || 0) > 0;
}

export function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht erzeugt werden'))),
      type,
      1,
    );
  });
}

export function slugify(text) {
  return String(text || 'savo')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'savo';
}

/** savo_<titel>_<format>_<YYYY-MM-DD>.<ext> */
export function buildExportFilename(slide, formatKey, ext) {
  const date = new Date().toISOString().slice(0, 10);
  return `savo_${slugify(slide?.title)}_${formatKey || 'export'}_${date}.${ext}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * @returns {'shared'|'downloaded'|'cancelled'}
 */
export async function shareOrDownloadFile(blob, filename, { title, text } = {}) {
  const file = new File([blob], filename, { type: (blob.type || 'application/octet-stream').split(';')[0] });

  let canShare = false;
  try {
    canShare = canShareFiles() && navigator.canShare({ files: [file] });
  } catch {
    canShare = false;
  }

  if (canShare) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // Kein Ziel gefunden oder Teilen nicht möglich → klassischer Download
    }
  }

  downloadBlob(blob, filename);
  return 'downloaded';
}