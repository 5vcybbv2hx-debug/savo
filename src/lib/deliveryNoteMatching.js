/**
 * deliveryNoteMatching.js — Abgleich Lieferschein-Positionen mit Artikeln,
 * Lieferanten und offenen Bestellungen.
 */

export function normalizeName(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Lieferant: exakt (case-insensitiv), dann "includes" in beide Richtungen. */
export function matchSupplier(name, suppliers = []) {
  const target = (name || '').trim().toLowerCase();
  if (!target) return null;
  const exact = suppliers.find(s => (s.name || '').trim().toLowerCase() === target);
  if (exact) return exact;
  const partial = suppliers.find(s => {
    const n = (s.name || '').trim().toLowerCase();
    return n && (n.includes(target) || target.includes(n));
  });
  return partial || null;
}

function preferredBySupplier(article, supplierName) {
  if (!supplierName) return false;
  const s = supplierName.toLowerCase();
  const inList = (article.suppliers || []).some(n => (n || '').toLowerCase() === s);
  const inDetails = (article.supplier_details || []).some(d => (d.supplier_name || '').toLowerCase() === s);
  return inList || inDetails;
}

const normNumber = (v) => String(v ?? '').trim().toLowerCase().replace(/^0+/, '');

/**
 * Gelernte Lieferanten-Artikelnummern: Article.supplier_article_numbers
 * ({"Mebold": "38182"}) plus Altbestand supplier_details[].article_number.
 */
function supplierNumbers(article, supplierName) {
  const learned = Object.entries(article.supplier_article_numbers || {})
    .filter(([name]) => !supplierName || String(name).trim().toLowerCase() === supplierName.trim().toLowerCase())
    .map(([, number]) => String(number ?? '').trim());
  const fromDetails = (article.supplier_details || [])
    .filter(d => !supplierName || String(d.supplier_name || '').trim().toLowerCase() === supplierName.trim().toLowerCase())
    .map(d => String(d.article_number || '').trim());
  return [...learned, ...fromDetails].filter(Boolean);
}

const supplierMatches = (supplierName, article) => preferredBySupplier(article, supplierName);

/**
 * Artikel-Abgleich in fester Reihenfolge:
 * 1. Lieferanten-Artikelnummer, 2. exakter Name, 3. normalisierter Name, 4. includes.
 * Gibt { article, source } zurück; source = 'artikelnummer' | 'name' | null.
 */
export function matchArticleDetailed(position, articles = [], supplierName = '') {
  const raw = position.raw_text || '';
  const name = position.article_name || raw;
  const nameLower = name.trim().toLowerCase();
  const norm = normalizeName(name);
  const number = normNumber(position.supplier_article_number);

  const active = articles.filter(a => a.is_active !== false && a.name);
  const bySupplierFirst = (list) =>
    [...list.filter(a => supplierMatches(supplierName, a)), ...list.filter(a => !supplierMatches(supplierName, a))];

  // 1. Lieferanten-Artikelnummer
  if (number) {
    const hit = bySupplierFirst(active.filter(a => supplierNumbers(a, supplierName).some(n => normNumber(n) === number)));
    if (hit[0]) return { article: hit[0], source: 'artikelnummer' };
  }

  // 2. exakter Name
  if (nameLower) {
    const exact = bySupplierFirst(active.filter(a => a.name.trim().toLowerCase() === nameLower));
    if (exact[0]) return { article: exact[0], source: 'name' };
  }
  // 3. normalisierter Name
  if (norm) {
    const normed = bySupplierFirst(active.filter(a => normalizeName(a.name) === norm));
    if (normed[0]) return { article: normed[0], source: 'name' };
  }
  // 4. includes (kürzester Treffer = spezifischster)
  if (norm.length >= 4) {
    const partial = bySupplierFirst(active.filter(a => {
      const n = normalizeName(a.name);
      return n && (n.includes(norm) || norm.includes(n));
    })).sort((a, b) => a.name.length - b.name.length);
    if (partial[0]) return { article: partial[0], source: 'name' };
  }
  // 5. Artikelnummer irgendwo im Zeilentext (Altbestand, Barcode)
  const haystack = `${raw} ${name}`.toLowerCase();
  const codeHit = active.find(a => {
    const codes = [a.barcode, ...supplierNumbers(a, supplierName)].filter(Boolean).map(c => String(c).toLowerCase());
    return codes.some(c => c.length >= 4 && haystack.includes(c));
  });
  return { article: codeHit || null, source: codeHit ? 'artikelnummer' : null };
}

export function matchArticle(position, articles = [], supplierName = '') {
  return matchArticleDetailed(position, articles, supplierName).article;
}

/** Offene Bestellposition desselben Lieferanten zu einer Lieferschein-Position. */
export function matchShoppingItem(position, articleId, openItems = []) {
  if (articleId) {
    const byArticle = openItems.find(i => i.article_id === articleId);
    if (byArticle) return byArticle;
  }
  const norm = normalizeName(position.article_name || position.raw_text);
  if (!norm) return null;
  const byName = openItems
    .filter(i => {
      const n = normalizeName(i.item_name);
      return n && (n === norm || n.includes(norm) || norm.includes(n));
    })
    .sort((a, b) => (a.item_name || '').length - (b.item_name || '').length);
  return byName[0] || null;
}

export function priceDeltaPercent(oldPrice, newPrice) {
  const oldV = Number(oldPrice);
  const newV = Number(newPrice);
  if (!oldV || !newV || oldV <= 0) return null;
  return ((newV - oldV) / oldV) * 100;
}