/**
 * accentColors.js — EINZIGE Quelle für die Akzentfarben der TV-Slides
 * und der Instagram-Exporte (vom Inhaber freigegeben, 31.10.2026).
 *
 * Regeln:
 * ─ DisplaySlide.accent_color (String-Key) steuert Titel, Akzentlinien und
 *   Eckklammern. Kein Cyan-Hardcode mehr in den Slide-Komponenten.
 * ─ Null/leer/unbekannt → Cyan (#00BFFF).
 * ─ Alte Keys (amber, rose, fuchsia, …) bleiben mit ihren bisherigen Hex-Werten
 *   erhalten, damit bereits laufende Slides unverändert aussehen.
 */

// ── Freigegebenes Mapping (Schlüssel → Hex) ───────────────────────────────────
const HEX = {
  // 1) Das freigegebene Farbset
  orange: '#FF8C00',
  pink: '#FF2D95',
  cyan: '#00BFFF',
  sky: '#38BDF8',
  red: '#E2574C',
  purple: '#A855F7',
  gold: '#F5C451',
  // 2) Bestehende Schlüssel — Werte unverändert (Abwärtskompatibilität)
  amber: '#f59e0b',
  rose: '#f43f5e',
  fuchsia: '#d946ef',
  violet: '#7c3aed',
  indigo: '#6366f1',
  blue: '#3b82f6',
  teal: '#14b8a6',
  green: '#22c55e',
  lime: '#84cc16',
  white: '#f8fafc',
};

// ── Anzeige-Namen für die Farbauswahl im Slide-Editor ─────────────────────────
const LABELS = {
  gold: 'Gold',
  orange: 'Orange',
  red: 'Rot',
  pink: 'Pink',
  purple: 'Lila',
  sky: 'Himmelblau',
  cyan: 'Cyan',
  amber: 'Amber',
  rose: 'Rose',
  fuchsia: 'Fuchsia',
  violet: 'Violett',
  indigo: 'Indigo',
  blue: 'Blau',
  teal: 'Teal',
  green: 'Grün',
  lime: 'Lime',
  white: 'Weiß',
};

export const DEFAULT_ACCENT_KEY = 'cyan';

// ── Helfer ────────────────────────────────────────────────────────────────────
function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const hex = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return ('#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]).toUpperCase();
  }
  return null;
}

function hexToRgb(hex) {
  const h = normalizeHex(hex) || HEX[DEFAULT_ACCENT_KEY];
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Schriftfarbe AUF der Akzentfarbe (z. B. CTA-Button): hell → schwarz, dunkel → weiß
function readableTextOn(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.35 ? '#000' : '#fff';
}

/** Aus einem Hex-Wert das Slide-Akzent-Objekt bauen. */
export function accentFromHex(hex) {
  const bg = normalizeHex(hex) || HEX[DEFAULT_ACCENT_KEY];
  return {
    bg,
    glow: rgba(bg, 0.5),
    soft: rgba(bg, 0.15),
    text: readableTextOn(bg),
    titleGlow: accentGlowText(bg),
    lineGlow: accentGlowFilter(bg),
  };
}

/**
 * Zentrale Auflösung: nimmt einen Key ('orange'), einen Hex-Wert ('#FF8C00')
 * oder null/'' und liefert immer ein vollständiges Akzent-Objekt.
 * Fallback ist Cyan #00BFFF.
 */
export function resolveAccent(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (HEX[key]) return accentFromHex(HEX[key]);
  const asHex = normalizeHex(value);
  if (asHex) return accentFromHex(asHex);
  return accentFromHex(HEX[DEFAULT_ACCENT_KEY]);
}

/** Nur der Hex-Wert (für Flächen, Rahmen, Canvas). */
export function accentHex(value) {
  return resolveAccent(value).bg;
}

/** Weicher zweistufiger Text-Glow (12px / 32px, ca. 55 % Deckkraft). */
export function accentGlowText(hex) {
  const c = normalizeHex(hex) || HEX[DEFAULT_ACCENT_KEY];
  return `0 0 12px ${rgba(c, 0.55)}, 0 0 32px ${rgba(c, 0.55)}`;
}

/** Weicher zweistufiger Drop-Shadow-Glow für Linien/Eckklammern. */
export function accentGlowFilter(hex) {
  const c = normalizeHex(hex) || HEX[DEFAULT_ACCENT_KEY];
  return `drop-shadow(0 0 6px ${rgba(c, 0.55)}) drop-shadow(0 0 16px ${rgba(c, 0.55)})`;
}

// ── Fertige Tabellen ──────────────────────────────────────────────────────────
/** Key → { bg, glow, soft, text, titleGlow, lineGlow } */
export const ACCENTS = Object.keys(HEX).reduce((acc, key) => {
  acc[key] = accentFromHex(HEX[key]);
  return acc;
}, {});

export const DEFAULT_ACCENT = ACCENTS[DEFAULT_ACCENT_KEY];

/** Für Farbwähler im Slide-Editor: [{ value, label, hex }] */
export const ACCENT_OPTIONS = Object.keys(HEX).map((key) => ({
  value: key,
  label: LABELS[key] || key,
  hex: HEX[key],
}));