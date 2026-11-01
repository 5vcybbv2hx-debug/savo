import { base44 } from '@/api/base44Client';

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
          count: { type: 'number' },
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

function packLabel(article) {
  const parts = [];
  if (article?.content_amount) parts.push(`${article.content_amount} ${article.content_unit || ''}`.trim());
  if (article?.quantity && article.quantity > 1) parts.push(`${article.quantity} Stück`);
  return parts.length ? parts.join(' × ') : 'Gebinde unbekannt';
}

function buildPrompt(assignments, articles) {
  const list = assignments
    .map((a) => {
      const article = articles.find((art) => art.id === a.article_id);
      const cap = a.max_stock != null ? `${a.max_stock} Gebinde` : 'unbekannt';
      return `- ${a.article_name} [ID: ${a.article_id}] — Gebinde: ${packLabel(article)} · Fach-Kapazität: ${cap}`;
    })
    .join('\n');

  return `Du siehst ein Foto eines Lagerfachs von oben. In diesem Fach stehen erwartungsgemäß folgende Artikel:
${list}

Zähle für jeden dieser Artikel, wie viele GEBINDE du siehst. Zähle nur vollständige, eindeutig erkennbare Gebinde; zähle angebrochene Flaschen separat (opened_partial). Nenne zusätzlich Artikel, die nicht in der Liste stehen (unknown_items). Schätze je Artikel eine Confidence 0-1. Wenn das Bild unscharf, dunkel oder nicht von oben aufgenommen ist, setze photo_quality auf "mittel" oder "schlecht", view_ok auf false und zähle lieber zu wenig als zu viel.

Regeln:
- Übernimm article_id unverändert aus der Liste oben.
- count = Anzahl vollständiger Gebinde, opened_partial = Anzahl angebrochener Einheiten.
- Alle Zahlen als JSON-Number, niemals leere Strings.
- summary: ein kurzer Satz zur Zählung.
Antworte ausschließlich mit der JSON-Struktur.`;
}

export async function uploadCountPhoto(file) {
  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
  return file_url;
}

export async function recognizeSlotPhoto({ fileUrl, assignments, articles }) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: buildPrompt(assignments, articles),
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
    detected: data.detected.map((d) => ({
      article_id: d?.article_id || '',
      article_name: d?.article_name || '',
      count: Number.isFinite(d?.count) ? Math.max(0, Math.round(d.count)) : 0,
      opened_partial: Number.isFinite(d?.opened_partial) ? Math.max(0, Math.round(d.opened_partial)) : 0,
      confidence: Number.isFinite(d?.confidence) ? Math.min(1, Math.max(0, d.confidence)) : 0,
      comment: d?.comment || '',
    })),
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