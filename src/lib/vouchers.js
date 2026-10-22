/**
 * vouchers.js — Helfer rund um Gutschein-Zugriffscode und Beleg-QR.
 *
 * Der QR-Code auf dem 80mm-Beleg enthält Nummer + access_token. Da die
 * Gutschein-Nummern sequenziell sind, wäre eine URL nur mit Nummer ratbar —
 * der Token schützt den Live-Restwert auf der öffentlichen Gutschein-Seite.
 *
 * Wichtig: Alphabet auch in base44/functions/migrateVoucherTokens/entry.ts
 * identisch halten (Backend kann src/ nicht importieren).
 */

// 32 Zeichen, ohne verwechselbare Zeichen (kein I, kein O, keine 0 und keine 1)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Öffentliche Gutschein-Seite (SAVO Lounge Website) — zeigt den Live-Restwert
export const VOUCHER_PUBLIC_BASE_URL = 'https://savo-lounge-club.de/gutschein';

/** Erzeugt einen 6-stelligen, kryptographisch zufälligen Zugriffscode. */
export function generateVoucherAccessToken(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  // 256 ist durch 32 teilbar → keine Modulo-Verzerrung
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** URL, die im QR-Code auf dem Beleg steckt. */
export function voucherQrUrl(voucher) {
  return `${VOUCHER_PUBLIC_BASE_URL}?nr=${voucher?.voucher_number ?? ''}&t=${voucher?.access_token ?? ''}`;
}

// ── Re.-Nr. vom flatpay-Kassenbon ───────────────────────────────────────────
// Auf dem flatpay-Beleg stehen mehrere Nummern; eindeutig ist nur die
// fortlaufende Re.-Nr. (z. B. 1000167) — sie ist im flatpay-Backend
// (Verkäufe/Belege) wieder auffindbar. Deshalb Pflichtfeld bei jeder Einlösung.
export const RECEIPT_PLACEHOLDER = 'z. B. 1000167';
export const RECEIPT_HINT = "Oben auf dem flatpay-Beleg nach 'Re.-Nr.:' — z. B. 1000167";
export const RECEIPT_INVALID_HINT = 'Bitte die Re.-Nr. vom Kassenbon eingeben — nur Ziffern';

/** Nur Ziffern, höchstens 10 Stellen — direkt beim Tippen anwenden. */
export function sanitizeReceiptNumber(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 10);
}

/** Gültig sind 3–10 Ziffern. */
export function isValidReceiptNumber(value) {
  return /^\d{3,10}$/.test(String(value ?? '').trim());
}