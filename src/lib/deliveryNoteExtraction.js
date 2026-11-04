import { base44 } from '@/api/base44Client';
import { unitCodeFromLegacy } from '@/lib/deliveryNoteUnits';

export const MAX_PAGES = 10;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    document_type: { type: 'string' },
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
          supplier_article_number: { type: 'string' },
          quantity_packages: { type: 'number' },
          unit_code: { type: 'string' },
          units_per_packaging: { type: 'number' },
          content_amount: { type: 'number' },
          content_unit: { type: 'string' },
          is_return: { type: 'boolean' },
          unit_price: { type: 'number' },
          line_total: { type: 'number' },
          page_number: { type: 'number' },
        },
        required: ['raw_text', 'article_name', 'quantity_packages', 'page_number'],
      },
    },
  },
  required: ['positions'],
};

const PRICE_RULE = 'Auf Lieferscheinen stehen in der Regel keine Preise. Zahlen mit Einheiten wie l, ml, cl, g, kg, ×, Fl., Kasten, Karton sind Mengen- oder Gebindeangaben und niemals Preise. Übernimm einen Wert nur dann als Preis, wenn er ausdrücklich als Preis gekennzeichnet ist (€, EP, EK, Preis, Betrag) oder eine Summe mit Währungszeichen ist. Im Zweifel: null.';

const PROMPT = `Du liest einen Lieferschein eines Getränke-/Gastro-Lieferanten aus (Fotos oder PDF, ggf. mehrere Seiten desselben Belegs).
Gib ausschließlich die geforderte JSON-Struktur zurück, ohne Erklärungen, ohne Kommentare und ohne Markdown.

Dokumenttyp (zuerst prüfen):
- Prüfe zuerst, ob die Seite Ware oder LEERGUT/RETOURE zeigt.
- Erkennungsmerkmale Leergut: Spaltenüberschrift "RETOURE", "Leergut", Zeilen wie "GASTRO-FASS", "WEINVOLL", "CO2 PFAND", handschriftlich eingetragene Mengen, keine Artikelnummern im Format 5-stellig.
- document_type: "leergut", wenn der ganze Beleg ausschließlich Leergut/Rückgabe zeigt; "lieferschein", wenn Ware geliefert wird (auch wenn zusätzlich Leergut-Zeilen auf dem Beleg stehen); "rechnung" bei einer Rechnung; "unbekannt", wenn nichts erkennbar ist.
- is_return je Position: true bei Leergut-/Rückgabe-Zeilen, sonst false.

Seiten:
- Du bekommst alle Seiten EINES Belegs, in der Reihenfolge der Übergabe (Seite 1 zuerst).
- Lies jede Seite vollständig und vergib bei jeder Position page_number = die Seitennummer, auf der sie steht (1 = erste übergebene Seite).
- pages_read: Anzahl der Seiten, die du tatsächlich gelesen hast.
- Wiederholt sich derselbe Artikel auf mehreren Seiten, gib ihn je Seite als eigene Position zurück. Summiere nicht.

Kopf:
- supplier_name: Name des Lieferanten (meist auf Seite 1).
- delivery_note_number: Lieferschein-Nummer (nur die Nummer, ohne Label).
- delivery_date: Lieferdatum im Format YYYY-MM-DD. Wenn kein Datum erkennbar ist: null.

Einheiten-Kürzel auf Lieferscheinen: Ka = Kasten, Fa = Fass, Do = Dose, Fl = Flasche, Ba = Bag in Box, St = Stück.
Spalte "Geb." = Stück pro Gebinde → units_per_packaging.
Spalte "Inh." = Inhalt je Gebinde in Litern bzw. kg und ist KEIN Preis und KEINE Stückzahl → content_amount / content_unit.

Positionen:
- raw_text: die Bezeichnung genau so, wie sie auf dem Lieferschein steht (inkl. Artikelnummer, Gebindeangabe).
- article_name: der reine Produktname ohne Mengen-, Gebinde- und Preisangaben.
- supplier_article_number: die Artikelnummer des Lieferanten aus dieser Zeile (meist 5-stellig, z. B. "38182"). Nicht die Lieferschein-Nummer. Sonst null.
- quantity_packages: Liefermenge als Zahl in der Einheit der Zeile (z. B. 1.00 bei "1,00 Ka").
- unit_code: Einheiten-Kürzel der Zeile — genau einer von "Ka", "Fa", "Do", "Fl", "Ba", "St". Wenn kein Kürzel erkennbar ist: "St".
- units_per_packaging: Stück pro Gebinde aus der Spalte "Geb."; wenn dort nichts steht: 1.
- content_amount: Inhalt je Gebinde als Zahl aus der Spalte "Inh." (z. B. 0.7 bei "0,7 l", 30 bei "30,00"). Sonst null.
- content_unit: Einheit des Inhalts — einer von "l", "ml", "cl", "g", "kg". Sonst null.
- unit_price: Einkaufspreis netto pro Einzeleinheit als Zahl (ohne Währungszeichen) oder null.
- line_total: Zeilensumme netto als Zahl oder null.

Preis-Regel (wörtlich zu befolgen):
"${PRICE_RULE}"

Weitere Regeln:
- Alle Zahlen als JSON-Number mit Punkt als Dezimaltrennzeichen (12.50, nicht "12,50").
- Unbekannte oder nicht lesbare Werte: null. Niemals schätzen, niemals leere Strings.
- Keine Positionen erfinden. Nur Zeilen, die tatsächlich als Waren- oder Leergutposition auf dem Beleg stehen (keine Summen- oder MwSt-Zeilen).`;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const UNIT_ALIASES = { ka: 'Ka', fa: 'Fa', do: 'Do', fl: 'Fl', ba: 'Ba', st: 'St', kg: 'kg' };

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
  const legacyUnit = p?.packaging || (p?.unit_code ? '' : p?.unit) || '';
  const unitCode = UNIT_ALIASES[p?.unit_code] || unitCodeFromLegacy(legacyUnit);
  const perPack = num(p?.units_per_packaging) ?? num(p?.unit_size) ?? 1;
  const packages = num(p?.quantity_packages) ?? num(p?.quantity);
  const mapped = {
    raw_text: p?.raw_text || '',
    article_name: p?.article_name || p?.raw_text || '',
    supplier_article_number: p?.supplier_article_number ? String(p.supplier_article_number).trim() : '',
    quantity: packages,
    quantity_packages: packages,
    unit_code: unitCode,
    quantity_units: null,
    unit: legacyUnit,
    packaging: legacyUnit,
    unit_size: perPack,
    units_per_packaging: perPack,
    content_amount: num(p?.content_amount),
    content_unit: p?.content_unit || null,
    is_return: p?.is_return === true,
    unit_price: num(p?.unit_price),
    line_total: num(p?.line_total),
    page_number: num(p?.page_number) ?? fallbackPage,
  };
  return sanitizePrice(mapped);
}

function normalizeResult(data, pageCount, fallbackPage = 1) {
  const positions = Array.isArray(data?.positions) ? data.positions : [];
  return {
    document_type: String(data?.document_type || '').trim().toLowerCase(),
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

function resolveDocumentType(results, positions) {
  const ware = positions.filter((p) => !p.is_return).length;
  const returns = positions.length - ware;
  const declared = results.find((r) => r?.document_type)?.document_type || '';
  if (ware === 0 && returns > 0) return 'leergut';
  if (declared === 'rechnung') return 'rechnung';
  if (positions.length === 0) return declared === 'leergut' ? 'leergut' : 'unbekannt';
  return 'lieferschein';
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
    document_type: resolveDocumentType(results, positions),
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