import { base44 } from '@/api/base44Client';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    supplier_name: { type: 'string' },
    delivery_note_number: { type: 'string' },
    delivery_date: { type: 'string' },
    positions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          raw_text: { type: 'string' },
          article_name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          unit_size: { type: 'number' },
          unit_price: { type: 'number' },
          line_total: { type: 'number' },
        },
        required: ['raw_text', 'article_name', 'quantity'],
      },
    },
    total_net: { type: 'number' },
  },
  required: ['supplier_name', 'positions'],
};

const PROMPT = `Du liest einen Lieferschein eines Getränke-/Gastro-Lieferanten aus (Foto oder PDF).
Gib ausschließlich die geforderte JSON-Struktur zurück, ohne Erklärungen, ohne Kommentare und ohne Markdown.

Regeln:
- supplier_name: Name des Lieferanten oben auf dem Lieferschein.
- delivery_note_number: Lieferschein-Nummer (nur die Nummer, ohne Label).
- delivery_date: Lieferdatum im Format YYYY-MM-DD. Wenn kein Datum erkennbar ist: null.
- positions: jede gelieferte Warenposition einzeln.
  - raw_text: die Bezeichnung genau so, wie sie auf dem Lieferschein steht (inkl. Artikelnummer, Gebindeangabe).
  - article_name: der reine Produktname ohne Mengen, Gebinde- und Preisangaben.
  - quantity: gelieferte Menge als Zahl (Anzahl Gebinde bzw. Stück).
  - unit: Einheit der Menge — einer von "Karton", "Flaschen", "Stück", "kg" (bei Unsicherheit "Stück").
  - unit_size: Anzahl Einzelflaschen/-stücke pro Gebinde, sonst 1. Wenn z. B. "6 x 0,75 l" steht, dann 6.
  - unit_price: Einkaufspreis netto pro Einzeleinheit als Zahl (ohne Währungszeichen).
  - line_total: Zeilensumme netto als Zahl.
- total_net: Gesamtsumme netto als Zahl.
- Alle Zahlen als JSON-Number mit Punkt als Dezimaltrennzeichen (12.50, nicht "12,50").
- Unbekannte oder nicht lesbare Werte: null. Niemals schätzen, niemals leere Strings.
- Keine Positionen erfinden. Nur Zeilen, die tatsächlich als Warenposition auf dem Lieferschein stehen (keine Summen-, MwSt- oder Pfandzeilen).`;

export async function extractDeliveryNote(fileUrl) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: PROMPT,
    file_urls: [fileUrl],
    response_json_schema: RESPONSE_SCHEMA,
  });

  const data = typeof result === 'string' ? JSON.parse(result) : result;
  const positions = Array.isArray(data?.positions) ? data.positions : [];

  return {
    supplier_name: data?.supplier_name || '',
    delivery_note_number: data?.delivery_note_number || '',
    delivery_date: data?.delivery_date || '',
    total_net: typeof data?.total_net === 'number' ? data.total_net : null,
    positions: positions.map((p) => ({
      raw_text: p?.raw_text || '',
      article_name: p?.article_name || p?.raw_text || '',
      quantity: typeof p?.quantity === 'number' ? p.quantity : null,
      unit: p?.unit || 'Stück',
      unit_size: typeof p?.unit_size === 'number' ? p.unit_size : 1,
      unit_price: typeof p?.unit_price === 'number' ? p.unit_price : null,
      line_total: typeof p?.line_total === 'number' ? p.line_total : null,
    })),
  };
}

export async function uploadDeliveryFile(file) {
  const result = await base44.integrations.Core.UploadPublicFile({ file });
  return result.file_url;
}