import { base44 } from '@/api/base44Client';

export const MAX_PAGES = 10;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    supplier_name: { type: 'string' },
    delivery_note_number: { type: 'string' },
    delivery_date: { type: 'string' },
    pages_read: { type: 'number' },
    positions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          raw_text: { type: 'string' },
          article_name: { type: 'string' },
          quantity: { type: 'number' },
          packaging: { type: 'string' },
          units_per_packaging: { type: 'number' },
          content_amount: { type: 'number' },
          content_unit: { type: 'string' },
          unit_price: { type: 'number' },
          line_total: { type: 'number' },
          page_number: { type: 'number' },
        },
        required: ['raw_text', 'article_name', 'quantity', 'page_number'],
      },
    },
  },
  required: ['positions'],
};

const PRICE_RULE = 'Auf Lieferscheinen stehen in der Regel keine Preise. Zahlen mit Einheiten wie l, ml, cl, g, kg, ×, Fl., Kasten, Karton sind Mengen- oder Gebindeangaben und niemals Preise. Übernimm einen Wert nur dann als Preis, wenn er ausdrücklich als Preis gekennzeichnet ist (€, EP, EK, Preis, Betrag) oder eine Summe mit Währungszeichen ist. Im Zweifel: null.';

const PROMPT = `Du liest einen Lieferschein eines Getränke-/Gastro-Lieferanten aus (Fotos oder PDF, ggf. mehrere Seiten desselben Belegs).
Gib ausschließlich die geforderte JSON-Struktur zurück, ohne Erklärungen, ohne Kommentare und ohne Markdown.

Seiten:
- Du bekommst alle Seiten EINES Belegs, in der Reihenfolge der Übergabe (Seite 1 zuerst).
- Lies jede Seite vollständig und vergib bei jeder Position page_number = die Seitennummer, auf der sie steht (1 = erste übergebene Seite).
- pages_read: Anzahl der Seiten, die du tatsächlich gelesen hast.
- Wiederholt sich derselbe Artikel auf mehreren Seiten, gib ihn je Seite als eigene Position zurück. Summiere nicht.

Kopf:
- supplier_name: Name des Lieferanten (meist auf Seite 1).
- delivery_note_number: Lieferschein-Nummer (nur die Nummer, ohne Label).
- delivery_date: Lieferdatum im Format YYYY-MM-DD. Wenn kein Datum erkennbar ist: null.

Positionen:
- raw_text: die Bezeichnung genau so, wie sie auf dem Lieferschein steht (inkl. Artikelnummer, Gebindeangabe).
- article_name: der reine Produktname ohne Mengen-, Gebinde- und Preisangaben.
- quantity: gelieferte Menge als Zahl (Anzahl Gebinde bzw. Stück).
- packaging: Gebindeart — einer von "Kasten", "Karton", "Flaschen", "Stück" (bei Unsicherheit "Stück").
- units_per_packaging: Anzahl Einzelflaschen/-stücke pro Gebinde, sonst 1. Wenn z. B. "6 x 0,75 l" steht, dann 6.
- content_amount: Füllmenge je Einheit als Zahl (z. B. 0.7 bei "0,7 l", 0.75 bei "0,75 l"). Sonst null.
- content_unit: Einheit der Füllmenge — einer von "l", "ml", "cl", "g", "kg". Sonst null.
- unit_price: Einkaufspreis netto pro Einzeleinheit als Zahl (ohne Währungszeichen) oder null.
- line_total: Zeilensumme netto als Zahl oder null.

Preis-Regel (wörtlich zu befolgen):
"${PRICE_RULE}"

Weitere Regeln:
- Alle Zahlen als JSON-Number mit Punkt als Dezimaltrennzeichen (12.50, nicht "12,50").
- Unbekannte oder nicht lesbare Werte: null. Niemals schätzen, niemals leere Strings.
- Keine Positionen erfinden. Nur Zeilen, die tatsächlich als Warenposition auf dem Lieferschein stehen (keine Summen-, MwSt- oder Pfandzeilen).`;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Deterministischer Preis-Filter: Inhaltsangaben dürfen nie als Preis durchgehen. */
export function sanitizePrice(position) {
  const contentAmount = num(position.content_amount);
  const price = num(position.unit_price);

  if (price === null) {
    return { ...position, unit_price: null, line_total: null, price_missing: true };
  }
  const looksLikeContent = contentAmount !== null && Math.abs(price - contentAmount) < 0.005;
  if (price < 1 || looksLikeContent) {
    return { ...position, unit_price: null, line_total: null, price_missing: true };
  }
  return { ...position, unit_price: price, price_missing: false };
}

function normalizePosition(p, fallbackPage) {
  const packaging = p?.packaging || p?.unit || 'Stück';
  const unitsPer = num(p?.units_per_packaging) ?? num(p?.unit_size) ?? 1;
  const mapped = {
    raw_text: p?.raw_text || '',
    article_name: p?.article_name || p?.raw_text || '',
    quantity: num(p?.quantity),
    unit: packaging,
    packaging,
    unit_size: unitsPer,
    units_per_packaging: unitsPer,
    content_amount: num(p?.content_amount),
    content_unit: p?.content_unit || null,
    unit_price: num(p?.unit_price),
    line_total: num(p?.line_total),
    page_number: num(p?.page_number) ?? fallbackPage,
  };
  return sanitizePrice(mapped);
}

function normalizeResult(data, pageCount, fallbackPage = 1) {
  const positions = Array.isArray(data?.positions) ? data.positions : [];
  return {
    supplier_name: data?.supplier_name || '',
    delivery_note_number: data?.delivery_note_number || '',
    delivery_date: data?.delivery_date || '',
    pages_read: num(data?.pages_read),
    positions: positions.map((p) => normalizePosition(p, fallbackPage)),
  };
}

async function callModel(pageUrls) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: PROMPT,
    file_urls: pageUrls,
    response_json_schema: RESPONSE_SCHEMA,
  });
  return typeof result === 'string' ? JSON.parse(result) : result;
}

function finalize(results, pageCount) {
  const first = results.find(Boolean) || {};
  const positions = results.filter(Boolean).flatMap((r) => r.positions);
  const coveredPages = new Set(positions.map((p) => p.page_number).filter(Boolean));
  const missing_pages = [];
  for (let page = 1; page <= pageCount; page += 1) {
    if (!coveredPages.has(page)) missing_pages.push(page);
  }
  return {
    supplier_name: first.supplier_name || '',
    delivery_note_number: first.delivery_note_number || '',
    delivery_date: first.delivery_date || '',
    page_count: pageCount,
    missing_pages,
    positions,
  };
}

/**
 * Liest alle Seiten EINES Lieferscheins aus.
 * Erst gemeinsam in einem Aufruf (file_urls-Array); meldet das Modell weniger
 * gelesene Seiten als übergeben, wird jede Seite einzeln erkannt und zusammengeführt.
 */
export async function extractDeliveryNote(pageUrls) {
  const urls = (Array.isArray(pageUrls) ? pageUrls : [pageUrls]).filter(Boolean);
  if (urls.length === 0) throw new Error('Keine Seiten zum Auslesen vorhanden.');

  if (urls.length === 1) {
    return finalize([normalizeResult(await callModel(urls), 1, 1)], 1);
  }

  const combined = normalizeResult(await callModel(urls), urls.length, 1);
  if ((combined.pages_read ?? 0) >= urls.length) {
    return finalize([combined], urls.length);
  }

  // Fallback: das Modell konnte nicht alle Seiten in einem Aufruf lesen → Seite für Seite.
  const perPage = [];
  for (let i = 0; i < urls.length; i += 1) {
    try {
      perPage.push(normalizeResult(await callModel([urls[i]]), 1, i + 1));
    } catch {
      perPage.push(null);
    }
  }
  return finalize(perPage, urls.length);
}

export async function uploadDeliveryFile(file) {
  const result = await base44.integrations.Core.UploadPublicFile({ file });
  return result.file_url;
}