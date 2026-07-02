/**
 * Lightweight fuzzy search utility.
 * Ranks results by match quality: exact > startsWith > includes > fuzzy char proximity.
 * No external dependencies, mobile-performant.
 */

/**
 * Score a single string against a query.
 * Returns a score between 0 (no match) and 100 (exact match).
 */
export function scoreMatch(text, query) {
  if (!text || !query) return 0;
  const t = text.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  if (t === q) return 100;
  if (t.startsWith(q)) return 85;
  if (t.includes(q)) return 70;

  // Word-boundary match (any word in text starts with query)
  const words = t.split(/[\s\-_/]+/);
  if (words.some(w => w.startsWith(q))) return 65;

  // Prefix of any word
  if (words.some(w => w.includes(q))) return 50;

  // Fuzzy: all chars of query appear in order in text
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  if (qi === q.length) {
    // Score based on how spread out — closer = better
    return Math.max(10, 40 - (q.length > 0 ? Math.floor((t.length - q.length) / q.length) * 5 : 0));
  }

  return 0;
}

/**
 * Search and rank an array of items.
 *
 * @param {Array} items — array of objects
 * @param {string} query — search string
 * @param {Function} getTexts — fn(item) => string[] — all texts to search against
 * @param {Function} [getBoost] — fn(item) => number — extra score (e.g. usage frequency)
 * @param {number} [minScore=10] — minimum score to include
 * @returns {Array} sorted items
 */
export function fuzzySearch(items, query, getTexts, getBoost = null, minScore = 10) {
  if (!query?.trim()) return items;

  const scored = items
    .map(item => {
      const texts = getTexts(item) || [];
      const best = Math.max(...texts.map(t => scoreMatch(t, query)));
      const boost = getBoost ? (getBoost(item) || 0) : 0;
      return { item, score: best + boost };
    })
    .filter(x => x.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return scored.map(x => x.item);
}

/**
 * Highlight matching portion of text (returns { before, match, after }).
 * Useful for bolding search matches in results.
 */
export function highlightMatch(text, query) {
  if (!text || !query) return { before: text, match: '', after: '' };
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return { before: text, match: '', after: '' };
  return {
    before: text.slice(0, idx),
    match: text.slice(idx, idx + query.length),
    after: text.slice(idx + query.length),
  };
}

// ── Word-order-independent, hyphen/plural-tolerant matching ─────────────────
// Splits both the search term and the searchable text into individual words
// (on whitespace and hyphens) and requires every search word to loosely match
// (substring in either direction) at least one word in the text — so word
// order, hyphenation, and simple singular/plural differences don't cause
// "Artikel nicht gefunden", even though the record actually exists.
function tokenize(str) {
  return (str || '').toLowerCase().trim().split(/[\s-]+/).filter(Boolean);
}

/** True if every word in `term` loosely matches at least one word in `text`. */
export function fuzzyMatches(text, term) {
  if (!term?.trim()) return true;
  const textWords = tokenize(text);
  const termWords = tokenize(term);
  if (textWords.length === 0) return false;
  return termWords.every(qt => textWords.some(hw => hw.includes(qt) || qt.includes(hw)));
}

/** Convenience: builds the searchable haystack from an Article's common fields. */
export function articleSearchText(article) {
  return [article?.name, article?.manufacturer, article?.category, article?.barcode].filter(Boolean).join(' ');
}