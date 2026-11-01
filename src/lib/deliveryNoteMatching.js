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

/** Artikelnummern beim Lieferanten (für den Barcode/Artikelnummer-Abgleich). */
function supplierArticleNumbers(article) {
  return (article.supplier_details || [])
    .map(d => String(d.article_number || '').trim())
    .filter(Boolean);
}

export function matchArticle(position, articles = [], supplierName = '') {
  const raw = position.raw_text || '';
  const name = position.article_name || raw;
  const nameLower = name.trim().toLowerCase();
  const norm = normalizeName(name);

  const active = articles.filter(a => a.is_active !== false && a.name);
  const bySupplierFirst = (list) =>
    [...list.filter(a => preferredBySupplier(a, supplierName)), ...list.filter(a => !preferredBySupplier(a, supplierName))];

  // 1. exakter Name
  if (nameLower) {
    const exact = bySupplierFirst(active.filter(a => a.name.trim().toLowerCase() === nameLower));
    if (exact[0]) return exact[0];
  }
  // 2. normalisierter Name
  if (norm) {
    const normed = bySupplierFirst(active.filter(a => normalizeName(a.name) === norm));
    if (normed[0]) return normed[0];
  }
  // 3. includes (kürzester Treffer = spezifischster)
  if (norm.length >= 4) {
    const partial = bySupplierFirst(active.filter(a => {
      const n = normalizeName(a.name);
      return n && (n.includes(norm) || norm.includes(n));
    })).sort((a, b) => a.name.length - b.name.length);
    if (partial[0]) return partial[0];
  }
  // 4. Barcode / Artikelnummer im Lieferschein-Text
  const haystack = `${raw} ${name}`.toLowerCase();
  const codeHit = active.find(a => {
    const codes = [a.barcode, ...supplierArticleNumbers(a)].filter(Boolean).map(c => String(c).toLowerCase());
    return codes.some(c => c.length >= 4 && haystack.includes(c));
  });
  return codeHit || null;
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

/** Einzeleinheiten, die gebucht werden (Menge × Gebindegröße bei Karton/Flaschen). */
export function bookedUnits(position) {
  const qty = Number(position.quantity) || 0;
  const size = Number(position.unit_size) || 0;
  const unit = String(position.unit || '');
  const isPack = /karton|kiste|pack|gebinde|flasche/i.test(unit);
  if (isPack && size > 0) return qty * size;
  return qty;
}