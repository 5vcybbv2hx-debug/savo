/**
 * deliveryNoteUnits.js — Einheiten-Mapping für Lieferscheine.
 * Kasten/Dose/Flasche/Fass werden auf die Lagereinheit umgerechnet,
 * das Fass bleibt als Anzahl Fässer (Inhalt in Litern ist nur Information).
 */

export const UNIT_CODES = ['Ka', 'Fa', 'Do', 'Fl', 'Ba', 'St', 'kg'];

export const UNIT_LABELS = {
  Ka: 'Kasten',
  Fa: 'Fass',
  Do: 'Dose',
  Fl: 'Flasche',
  Ba: 'Bag in Box',
  St: 'Stück',
  kg: 'kg',
};

/** Lagereinheit, in der gebucht wird. */
export const UNIT_TARGETS = {
  Ka: 'Flaschen',
  Fa: 'Fässer',
  Do: 'Dosen',
  Fl: 'Flaschen',
  Ba: 'Beutel',
  St: 'Stück',
  kg: 'kg',
};

export function unitLabel(code) {
  return UNIT_LABELS[code] || UNIT_LABELS.St;
}

/** Alte Freitext-Einheit ("Karton", "Flaschen", …) auf ein Kürzel abbilden. */
export function unitCodeFromLegacy(unit) {
  const u = String(unit || '').trim().toLowerCase();
  if (!u) return 'St';
  if (u.startsWith('kasten') || u.startsWith('karton') || u.startsWith('kiste') || u === 'ka') return 'Ka';
  if (u.startsWith('fass') || u === 'fa') return 'Fa';
  if (u.startsWith('dose') || u === 'do') return 'Do';
  if (u.startsWith('flasch') || u === 'fl') return 'Fl';
  if (u.startsWith('bag') || u === 'ba') return 'Ba';
  if (u === 'kg' || u.startsWith('kilo')) return 'kg';
  return 'St';
}

export function packageCount(position) {
  const value = position?.quantity_packages ?? position?.quantity;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function perPackaging(position) {
  const value = position?.units_per_packaging ?? position?.unit_size;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * quantity_units = quantity_packages × units_per_packaging
 * Ausnahme Fass: Liefermenge = Anzahl Fässer (Inhalt in Litern nur Info).
 */
export function quantityUnits(position) {
  const packages = packageCount(position);
  if (packages === null) return null;
  const code = position?.unit_code || unitCodeFromLegacy(position?.unit);
  if (code === 'Fa') return packages;
  return Math.round(packages * perPackaging(position) * 1000) / 1000;
}

const fmt = (n) => String(Math.round(Number(n) * 1000) / 1000).replace('.', ',');

/** Anzeige "1 Kasten × 12 = 12 Flaschen" bzw. "1 Fass (30,00 l)". */
export function unitBreakdown(position) {
  const packages = packageCount(position);
  const code = position?.unit_code || unitCodeFromLegacy(position?.unit);
  const per = perPackaging(position);
  const units = quantityUnits(position);
  const from = unitLabel(code);
  const to = UNIT_TARGETS[code] || 'Stück';
  const content = position?.content_amount
    ? `${fmt(position.content_amount)} ${position.content_unit || ''}`.trim()
    : null;

  if (packages === null) return { code, text: '', units: null };

  if (code === 'Fa') {
    return {
      code,
      units,
      text: `${fmt(packages)} ${from}${content ? ` (${content})` : ''} = ${fmt(units)} ${to}`,
    };
  }
  if (per > 1) {
    return { code, units, text: `${fmt(packages)} ${from} × ${fmt(per)} = ${fmt(units)} ${to}` };
  }
  return { code, units, text: `${fmt(packages)} ${from} = ${fmt(units)} ${to}` };
}