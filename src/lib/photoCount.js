import { base44 } from '@/api/base44Client';

// Unter diesem Wert gilt ein Vorschlag als unsicher → nicht vorausfüllen.
export const MIN_CONFIDENCE = 0.5;

// ── Fachreihenfolge ─────────────────────────────────────────────────────────
// Physische Reihenfolge im Fach: sort_order, sonst Name. Position 1 = links.
export function orderSlotAssignments(assignments = []) {
  return [...assignments].sort((a, b) =>
    ((a.sort_order ?? 0) - (b.sort_order ?? 0)) ||
    (a.article_name || '').localeCompare(b.article_name || '', 'de')
  );
}

export const DETECTION_SCHEMA = {
  type: 'object',
  properties: {
    photo_quality: { type: 'string', enum: ['gut', 'mittel', 'schlecht'] },
    view_ok: { type: 'boolean' },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          position: { type: 'number' },
          article_id: { type: 'string' },
          article_name: { type: 'string' },
          count: { type: ['number', 'null'] },
          confidence: { type: 'number' },
          comment: { type: 'string' },
        },
        required: ['position', 'count'],
      },
    },
    detected_total: { type: ['number', 'null'] },
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
  required: ['photo_quality', 'segments'],
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
function buildPrompt(slotLabel, ordered, articles) {
  const list = ordered
    .map((a, idx) => {
      const article = articles.find((art) => art.id === a.article_id);
      const parts = [`${idx + 1}) ${a.article_name} [ID: ${a.article_id}]`];
      if (article?.content_amount) {
        parts.push(`${article.content_amount} ${article.content_unit || ''}`.trim());
      }
      if (a.storage_orientation && a.storage_orientation !== 'unbekannt') {
        parts.push(`Lagerung ${a.storage_orientation}`);
      }
      const hint = (a.notes || '').trim();
      if (hint) parts.push(`Hinweis: ${hint}`);
      return `- ${parts.join(' · ')}`;
    })
    .join('\n');

  return `Du siehst ein Foto des Lagerfachs „${slotLabel}". In diesem Fach stehen diese Sorten in dieser physischen Reihenfolge von links nach rechts:
${list}

EINHEIT — WICHTIG: Die Einheit ist immer Flasche bzw. Dose (Stück). Rechne NICHT in Kästen oder Gebinden. Lieferschein-Logik (Ka/Fa/Do mit Gebindeumrechnung) gilt hier nicht.

Zähle JEDE Sorte EINZELN. Gib genau einen Eintrag pro Position zurück — auch wenn die Sorte dort nicht sichtbar oder das Fach an dieser Stelle leer ist (dann count 0). Gib KEINE Gesamtsumme über alle Sorten als Sortenwert aus.

Positionsraster: Position 1 ist das linke Segment des Fachs, Position ${ordered.length} das rechte. Teile das Foto gleichmäßig auf diese ${ordered.length} Positionen auf und zähle je Segment die Flaschen/Dosen dieser Sorte.

Regeln:
- count = Anzahl sichtbarer Flaschen bzw. Dosen dieser Sorte (nur vollständig sichtbare Einheiten; verdeckte oder angeschnittene zählen nicht). Nichts sichtbar → 0. Wenn du unsicher bist: count null und confidence unter 0,5, statt zu raten.
- position = die Nummer aus der Liste oben, article_id unverändert übernehmen.
- confidence je Sorte 0-1. Nenne zusätzlich Artikel, die nicht in der Liste stehen (unknown_items).
- detected_total = Summe aller gezählten Flaschen/Dosen (nur Kontrollwert).
- Wenn das Bild unscharf, dunkel oder nicht aufs Fach gerichtet ist: photo_quality "mittel" oder "schlecht" und view_ok false.
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
  const ordered = orderSlotAssignments(assignments);
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: buildPrompt(slotLabel, ordered, articles),
    file_urls: [fileUrl],
    response_json_schema: DETECTION_SCHEMA,
  });

  const data = typeof result === 'string' ? JSON.parse(result) : result;
  if (!data || !Array.isArray(data.segments)) {
    throw new Error('Unerwartetes Antwortformat');
  }

  return {
    raw: data,
    photoQuality: ['gut', 'mittel', 'schlecht'].includes(data.photo_quality) ? data.photo_quality : 'mittel',
    viewOk: data.view_ok !== false,
    summary: data.summary || '',
    segments: data.segments
      .map((s) => {
        const count = Number.isFinite(s?.count) ? Math.max(0, Math.round(s.count)) : null;
        const confidence = Number.isFinite(s?.confidence) ? Math.min(1, Math.max(0, s.confidence)) : 0;
        return {
          position: Number.isFinite(s?.position) ? Math.round(s.position) : 0,
          article_id: s?.article_id || '',
          article_name: s?.article_name || '',
          count,
          confidence,
          uncertain: count == null || confidence < MIN_CONFIDENCE,
          comment: s?.comment || '',
        };
      })
      .sort((a, b) => a.position - b.position),
    detectedTotal: Number.isFinite(data.detected_total) ? Math.round(data.detected_total) : null,
    unknownItems: Array.isArray(data.unknown_items)
      ? data.unknown_items.map((u) => ({
          description: u?.description || '',
          count: Number.isFinite(u?.count) ? Math.round(u.count) : 0,
        }))
      : [],
  };
}