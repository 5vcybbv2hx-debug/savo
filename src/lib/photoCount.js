import { base44 } from '@/api/base44Client';

// Unter diesem Wert gilt ein Vorschlag als unsicher → nicht vorausfüllen.
export const MIN_CONFIDENCE = 0.5;

export const DETECTION_SCHEMA = {
  type: 'object',
  properties: {
    photo_quality: { type: 'string', enum: ['gut', 'mittel', 'schlecht'] },
    view_ok: { type: 'boolean' },
    detected: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          article_id: { type: 'string' },
          article_name: { type: 'string' },
          count: { type: ['number', 'null'] },
          opened_partial: { type: 'number' },
          confidence: { type: 'number' },
          comment: { type: 'string' },
        },
        required: ['article_name', 'count'],
      },
    },
    unknown_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          count: { type: 'number' },
        },
        required: ['description'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['photo_quality', 'detected'],
};

// ── Foto vorbereiten ────────────────────────────────────────────────────────
// EXIF-Orientierung anwenden, aber NIE herunterskalieren: die Pixelmaße des
// Originalfotos bleiben exakt erhalten (kein Resize, ein JPEG-Re-Encode).
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fallback unten (Safari/ältere WebViews)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function preparePhoto(file) {
  const source = await decode(file);
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, width, height);
  source.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  return { blob: blob || file, width, height, portrait: height > width };
}

// ── Prompt ──────────────────────────────────────────────────────────────────
function packLabel(article) {
  const parts = [];
  if (article?.content_amount) parts.push(`${article.content_amount} ${article.content_unit || ''}`.trim());
  if (article?.quantity && article.quantity > 1) parts.push(`${article.quantity} Stück`);
  return parts.length ? parts.join(' × ') : 'Gebinde unbekannt';
}

function buildPrompt(slotLabel, assignments, articles) {
  const list = assignments
    .map((a) => {
      const article = articles.find((art) => art.id === a.article_id);
      const cap = a.max_stock != null ? `${a.max_stock} Gebinde` : 'unbekannt';
      const unit = a.unit || article?.content_unit || 'Stück';
      const orientation = a.storage_orientation || 'nicht angegeben';
      const hint = (a.notes || '').trim();
      return `- ${a.article_name} [ID: ${a.article_id}] — Gebindegröße: ${packLabel(article)} · Lagereinheit: ${unit} · Lagerung: ${orientation} · Fach-Kapazität: ${cap}${hint ? ` · Lagerhinweis: ${hint}` : ''}`;
    })
    .join('\n');

  return `Du siehst ein Foto des Lagerfachs „${slotLabel}" von oben. In diesem Fach stehen erwartungsgemäß folgende Artikel:
${list}

Zähle für jeden dieser Artikel, wie viele GEBINDE du siehst. Zähle nur Gebinde, die vollständig sichtbar sind. Verdeckte oder angeschnittene Gebinde zählen nicht. Wenn du unsicher bist, gib count null und confidence unter 0,5, statt zu raten. Zähle angebrochene Flaschen separat (opened_partial). Nenne zusätzlich Artikel, die nicht in der Liste stehen (unknown_items). Schätze je Artikel eine Confidence 0-1. Wenn das Bild unscharf, dunkel oder nicht von oben aufgenommen ist, setze photo_quality auf "mittel" oder "schlecht" und view_ok auf false.

Regeln:
- Übernimm article_id unverändert aus der Liste oben.
- count = Anzahl vollständiger Gebinde (oder null, wenn nicht sicher zählbar), opened_partial = Anzahl angebrochener Einheiten.
- Alle Zahlen als JSON-Number, niemals leere Strings.
- summary: ein kurzer Satz zur Zählung.
Antworte ausschließlich mit der JSON-Struktur.`;
}

export async function uploadCountPhoto(file) {
  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
  return file_url;
}

export async function recognizeSlotPhoto({ fileUrl, slot, assignments, articles }) {
  const slotLabel = slot?.full_name || slot?.name || 'Fach';
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: buildPrompt(slotLabel, assignments, articles),
    file_urls: [fileUrl],
    response_json_schema: DETECTION_SCHEMA,
  });

  const data = typeof result === 'string' ? JSON.parse(result) : result;
  if (!data || !Array.isArray(data.detected)) {
    throw new Error('Unerwartetes Antwortformat');
  }

  return {
    raw: data,
    photoQuality: ['gut', 'mittel', 'schlecht'].includes(data.photo_quality) ? data.photo_quality : 'mittel',
    viewOk: data.view_ok !== false,
    summary: data.summary || '',
    detected: data.detected.map((d) => {
      const count = Number.isFinite(d?.count) ? Math.max(0, Math.round(d.count)) : null;
      const confidence = Number.isFinite(d?.confidence) ? Math.min(1, Math.max(0, d.confidence)) : 0;
      return {
        article_id: d?.article_id || '',
        article_name: d?.article_name || '',
        count,
        opened_partial: Number.isFinite(d?.opened_partial) ? Math.max(0, Math.round(d.opened_partial)) : 0,
        confidence,
        uncertain: count == null || confidence < MIN_CONFIDENCE,
        comment: d?.comment || '',
      };
    }),
    unknownItems: Array.isArray(data.unknown_items)
      ? data.unknown_items.map((u) => ({
          description: u?.description || '',
          count: Number.isFinite(u?.count) ? Math.round(u.count) : 0,
        }))
      : [],
  };
}

// Vorschlag je Fachartikel: Treffer über article_id, sonst über den Namen.
export function matchSuggestion(assignment, detected) {
  const byId = detected.find((d) => d.article_id && d.article_id === assignment.article_id);
  if (byId) return byId;
  const name = (assignment.article_name || '').trim().toLowerCase();
  return detected.find((d) => (d.article_name || '').trim().toLowerCase() === name) || null;
}