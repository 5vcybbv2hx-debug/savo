/**
 * voucherPrint62 — Gutschein-Ausgaben für den Brother QL-800 (Thermodirekt).
 *
 * Alle Formate sind 62 mm breit, nur die Höhe variiert:
 *   geschenkgutschein  62 × 100 mm
 *   einloese_beleg     62 × 100 mm
 *   siegel             62 ×  30 mm
 *   verkaufsbeleg      62 ×  60 mm
 *
 * Regeln:
 * - Seitenformat exakt aus der Registry, keine Skalierung; Mischformat in einem
 *   PDF ist erlaubt (addPage mit eigener Höhe).
 * - nur Schwarz, Akzentlinien ausschließlich Grau
 * - QR-Inhalt: https://savo-lounge-club.de/gutschein?nr=<nr>&t=<access_token>
 *   NIEMALS zusätzlich "_t" anhängen — die öffentliche API liefert dann leer.
 * - ohne access_token wird kein QR gerendert (Token wird vorher erzeugt)
 *
 * Neue Formate: nur einen Eintrag in VOUCHER_FORMATS ergänzen (draw + Höhe).
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { voucherQrUrl } from '@/lib/vouchers';

const BLACK = [0, 0, 0];
const GRAY = [110, 110, 110];
const LINE_GRAY = [150, 150, 150];
const HAIRLINE = [190, 190, 190];

// ─── Formatierung ───────────────────────────────────────────────────────────
export function fmtMoney(value) {
  return `${Number(value ?? 0).toFixed(2).replace('.', ',')} €`;
}

export function fmtDate(value) {
  const raw = String(value ?? '');
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.split('-').reverse().join('.');
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString('de-DE');
}

export function fmtDateTime(value) {
  const raw = String(value ?? '');
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fmtDate(raw);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return `${d.toLocaleDateString('de-DE')} · ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
}

const PAYMENT_LABELS = {
  bar: 'Bar',
  ec: 'EC',
  ueberweisung: 'Überweisung',
  bar_ec: 'Bar / EC',
  rabatt_ueberweisung: 'Rabatt / Überweisung',
};

export function paymentLabel(method) {
  return PAYMENT_LABELS[method] || '—';
}

// ─── QR-Ziel ────────────────────────────────────────────────────────────────
/**
 * Öffentliche URL für den QR-Code. Ohne Nummer oder Token → null.
 * voucherQrUrl baut "?nr=…&t=…" — hier wird bewusst NICHTS ergänzt.
 */
export function voucherQrPayload(voucher) {
  if (!voucher?.voucher_number || !voucher?.access_token) return null;
  return voucherQrUrl(voucher);
}

// ─── Zeichnen ───────────────────────────────────────────────────────────────
function spacedWidth(doc, text, charSpace) {
  return doc.getTextWidth(text) + charSpace * Math.max(0, String(text).length - 1);
}

function drawText(doc, text, x, y, {
  size, charSpace = 0, bold = false, color = BLACK, align = 'left', maxWidth, minSize = 4,
} = {}) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  let pt = size;
  doc.setFontSize(pt);
  if (maxWidth) {
    while (pt > minSize && spacedWidth(doc, text, charSpace) > maxWidth) {
      pt = Math.round((pt - 0.2) * 10) / 10;
      doc.setFontSize(pt);
    }
  }
  doc.setTextColor(color[0], color[1], color[2]);
  const w = spacedWidth(doc, text, charSpace);
  const px = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  doc.text(String(text), px, y, { charSpace });
}

const center = (doc, f, text, y, opts = {}) =>
  drawText(doc, text, f.width / 2, y, { align: 'center', maxWidth: f.width - 6, ...opts });

const left = (doc, text, y, opts = {}) => drawText(doc, text, 3, y, { align: 'left', ...opts });

const right = (doc, f, text, y, opts = {}) =>
  drawText(doc, text, f.width - 3, y, { align: 'right', ...opts });

function drawRule(doc, f, y, { width = 0.25, color = LINE_GRAY, from = 3, to = f.width - 3 } = {}) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(width);
  doc.line(from, y, to, y);
}

function drawQr(doc, f, item, y) {
  if (!item.qr) return;
  const size = f.qr;
  doc.addImage(item.qr, 'PNG', f.width / 2 - size / 2, y, size, size, undefined, 'NONE');
}

function drawWordmark(doc, f, { size = 20, charSpace = 2.6, y = 10 } = {}) {
  center(doc, f, 'SAVO', y, { size, charSpace, bold: true });
  center(doc, f, 'LOUNGE · CLUB', y + 4.8, { size: 6.4, charSpace: 1.5, color: GRAY });
  drawRule(doc, f, y + 8.2);
}

// ─── 1) Geschenkgutschein · 62 × 100 mm ─────────────────────────────────────
function drawGift(doc, item, f) {
  const v = item.voucher;

  drawWordmark(doc, f);

  center(doc, f, 'GUTSCHEIN', 27, { size: 12.5, charSpace: 2.4, bold: true });
  center(doc, f, fmtMoney(v.original_value), 43, { size: 30, bold: true });

  drawRule(doc, f, 51.5, { width: 0.2, color: HAIRLINE });

  center(doc, f, `Nr. ${v.voucher_number ?? ''}`, 55.5, { size: 9.5, bold: true });
  center(doc, f, `Ausgestellt ${fmtDate(v.issue_date)}`, 60, { size: 6.4, color: GRAY });

  drawQr(doc, f, item, 62.5);

  center(doc, f, 'SAVO Lounge-Club · Badstraße 1 · 72336 Balingen', 93.4, { size: 4.6, color: GRAY });
  center(doc, f, 'Einlösbar auf Speisen & Getränke · Restwert jederzeit abrufbar', 96.2, { size: 4.6, color: GRAY });
}

// ─── 2) Einlösebeleg · 62 × 100 mm ───────────────────────────────────────────
function drawRedeem(doc, item, f) {
  const v = item.voucher;

  drawWordmark(doc, f, { size: 17, charSpace: 2.3 });

  center(doc, f, 'EINLÖSEBELEG', 25, { size: 10.5, charSpace: 1.9, bold: true });
  center(doc, f, 'GUTSCHEIN', 29.8, { size: 8.5, charSpace: 1.6, bold: true });

  center(doc, f, `Nr. ${v.voucher_number ?? ''}`, 37, { size: 9, bold: true });
  center(doc, f, `Eingelöst: ${fmtMoney(item.amount)}`, 44.5, { size: 10 });
  center(doc, f, `Rest: ${fmtMoney(item.remaining)}`, 57, { size: 19, bold: true });
  center(doc, f, fmtDateTime(item.at), 63.5, { size: 6.4, color: GRAY });

  drawQr(doc, f, item, 67);

  center(doc, f, 'Restwert mit QR prüfbar', 94.6, { size: 4.8, color: GRAY });
}

// ─── 3) Kuvert-Siegel · 62 × 30 mm ──────────────────────────────────────────
function drawSeal(doc, item, f) {
  const v = item.voucher;
  const qrSize = f.qr;
  const qrX = 3;
  const qrY = (f.height - qrSize) / 2;

  if (item.qr) doc.addImage(item.qr, 'PNG', qrX, qrY, qrSize, qrSize, undefined, 'NONE');

  // rechte Spalte: von QR-Kante + 1 mm bis 3 mm vor Papierrand
  const colX = qrX + qrSize + 1;
  const colCx = colX + (f.width - 3 - colX) / 2;
  const colW = f.width - 3 - colX - 1;

  drawText(doc, 'SAVO', colCx, 8.2, { align: 'center', size: 10, charSpace: 1.6, bold: true, maxWidth: colW });
  drawText(doc, 'GUTSCHEIN · GESCHENKT', colCx, 13.6, { align: 'center', size: 4.6, charSpace: 0.2, color: GRAY, maxWidth: colW });
  drawText(doc, `${fmtMoney(v.original_value)} · Nr. ${v.voucher_number ?? ''}`, colCx, 19.4, { align: 'center', size: 6, bold: true, maxWidth: colW });
  drawText(doc, 'savo-lounge-club.de', colCx, 25.6, { align: 'center', size: 4, color: GRAY, maxWidth: colW });
}

// ─── 4) Verkaufsbeleg (Kasse) · 62 × 60 mm ──────────────────────────────────
function drawSale(doc, item, f) {
  const v = item.voucher;
  const issued = v.created_date || v.issue_date;

  center(doc, f, 'SAVO', 6.4, { size: 11, charSpace: 2.2, bold: true });
  center(doc, f, 'BELEG GUTSCHEINVERKAUF', 10.8, { size: 5.4, charSpace: 0.9, bold: true });
  drawRule(doc, f, 13);

  left(doc, `Datum: ${fmtDateTime(issued)}`, 16.8, { size: 4.2 });
  right(doc, f, 'Kasse: Theke', 16.8, { size: 4.2 });

  left(doc, `Gutschein Nr. ${v.voucher_number ?? ''}`, 22.4, { size: 5.4, bold: true });
  right(doc, f, fmtMoney(v.original_value), 22.4, { size: 5.4, bold: true });

  drawRule(doc, f, 24.6, { width: 0.2, color: HAIRLINE });

  left(doc, `Zahlart: ${paymentLabel(v.payment_method)}`, 28.2, { size: 4.4 });
  right(doc, f, '0 % USt (Verbindlichkeit)', 28.2, { size: 3.9, color: GRAY });

  drawRule(doc, f, 31);

  left(doc, 'Summe', 35.4, { size: 6.2, bold: true });
  right(doc, f, fmtMoney(v.original_value), 35.4, { size: 6.6, bold: true });

  drawQr(doc, f, item, 38);

  center(doc, f, 'Vielen Dank!', 57.6, { size: 4.6, bold: true });
}

// ─── Format-Registry (eine Konstante — neue Formate nur hier ergänzen) ──────
export const VOUCHER_FORMATS = {
  geschenkgutschein: {
    key: 'geschenkgutschein',
    label: 'Geschenkgutschein',
    hint: 'Verkauf',
    width: 62,
    height: 100,
    qr: 28,
    draw: drawGift,
  },
  einloese_beleg: {
    key: 'einloese_beleg',
    label: 'Einlösebeleg',
    hint: 'nach Einlösung',
    width: 62,
    height: 100,
    qr: 24,
    draw: drawRedeem,
  },
  siegel: {
    key: 'siegel',
    label: 'Kuvert-Siegel',
    hint: 'Aufkleber',
    width: 62,
    height: 30,
    qr: 22,
    draw: drawSeal,
  },
  verkaufsbeleg: {
    key: 'verkaufsbeleg',
    label: 'Verkaufsbeleg',
    hint: 'Kasse',
    width: 62,
    height: 60,
    qr: 16,
    draw: drawSale,
  },
};

export const VOUCHER_FORMAT_LIST = Object.values(VOUCHER_FORMATS);
export const DEFAULT_VOUCHER_FORMAT = 'geschenkgutschein';

export function getVoucherFormat(key) {
  return VOUCHER_FORMATS[key] || VOUCHER_FORMATS[DEFAULT_VOUCHER_FORMAT];
}

// Alte Export-Konstante (62 × 100) bleibt für Bestandscode erhalten.
export const VOUCHER_PAGE_MM = { width: 62, height: 100 };

// ─── PDF bauen ──────────────────────────────────────────────────────────────
/**
 * items: [{ format, voucher, amount?, remaining?, at? }]
 * Jede Position wird eine eigene Seite in der Höhe ihres Formats.
 * Mischformate in einem Dokument sind ausdrücklich erlaubt.
 */
export async function buildVoucherPdf(items = []) {
  const prepared = await Promise.all(items.map(async (item) => {
    const payload = voucherQrPayload(item.voucher);
    const qr = payload
      ? await QRCode.toDataURL(payload, {
        margin: 0,
        width: 760,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      })
      : null;
    return { ...item, qr };
  }));

  if (!prepared.length) return null;

  const first = getVoucherFormat(prepared[0].format);
  const doc = new jsPDF({
    unit: 'mm',
    format: [first.width, first.height],
    orientation: first.height >= first.width ? 'portrait' : 'landscape',
    compress: true,
  });

  prepared.forEach((item, index) => {
    const f = getVoucherFormat(item.format);
    if (index > 0) {
      doc.addPage([f.width, f.height], f.height >= f.width ? 'portrait' : 'landscape');
    }
    f.draw(doc, item, f);
  });

  return doc;
}