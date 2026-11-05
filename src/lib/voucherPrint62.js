/**
 * voucherPrint62 — Gutschein-Ausgaben für den Brother QL-800 (Thermodirekt).
 *
 * Jedes Format hat seine EIGENE, natürliche Seitenhöhe (unit 'mm', kein
 * Skalieren). Der Drucker schneidet auf die jeweilige Seitenhöhe, ein eigenes
 * Papierformat ist in macOS hinterlegt (von Pierre getestet).
 *
 *   geschenkgutschein  62 × 100 mm
 *   einloese_beleg     62 × 100 mm
 *   siegel             62 ×  30 mm
 *   verkaufsbeleg      62 ×  60 mm
 *
 * Regeln:
 * - 3 mm Rand an allen Seiten (Inhalt 3 … Breite-3 / Höhe-3)
 * - nur Schwarz, Akzentlinien ausschließlich Grau
 * - QR-Inhalt: https://savo-lounge-club.de/gutschein?nr=<nr>&t=<access_token>
 *   NIEMALS zusätzlich "_t" anhängen — die öffentliche API liefert dann leer.
 * - ohne access_token wird kein QR gerendert (Token wird vorher erzeugt)
 *
 * Neue Formate: nur einen Eintrag in VOUCHER_FORMATS ergänzen (height, draw, qr).
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { voucherQrUrl } from '@/lib/vouchers';

const BLACK = [0, 0, 0];
const GRAY = [110, 110, 110];
const LINE_GRAY = [150, 150, 150];

const PAGE_WIDTH = 62;
const MARGIN = 3;

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
  drawText(doc, text, f.width / 2, y, { align: 'center', maxWidth: f.width - 2 * MARGIN, ...opts });

const left = (doc, text, y, opts = {}) => drawText(doc, text, MARGIN, y, { align: 'left', ...opts });

const right = (doc, f, text, y, opts = {}) =>
  drawText(doc, text, f.width - MARGIN, y, { align: 'right', ...opts });

function drawRule(doc, f, y, { width = 0.25, color = LINE_GRAY, from = MARGIN, to = f.width - MARGIN } = {}) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(width);
  doc.line(from, y, to, y);
}

function drawQrCentered(doc, f, item, y) {
  if (!item.qr) return;
  const size = f.qr;
  doc.addImage(item.qr, 'PNG', f.width / 2 - size / 2, y, size, size, undefined, 'NONE');
}

function drawQrAt(doc, item, x, y, size) {
  if (!item.qr) return;
  doc.addImage(item.qr, 'PNG', x, y, size, size, undefined, 'NONE');
}

// ─── 1) Geschenkgutschein · 62 × 100 mm ─────────────────────────────────────
function drawGift(doc, item, f) {
  const v = item.voucher;

  center(doc, f, 'SAVO', 12, { size: 17, charSpace: 2.2, bold: true });
  center(doc, f, 'LOUNGE · CLUB', 16.2, { size: 5.6, charSpace: 1.2, color: GRAY });
  drawRule(doc, f, 19);

  center(doc, f, 'GUTSCHEIN', 24.5, { size: 6, charSpace: 1.8, bold: true });
  center(doc, f, fmtMoney(v.original_value), 38, { size: 30, bold: true });

  center(doc, f, `Nr. ${v.voucher_number ?? ''}`, 44, { size: 7.5, bold: true });
  center(doc, f, `Ausgestellt ${fmtDate(v.issue_date)}`, 48, { size: 5.2, color: GRAY });

  drawQrCentered(doc, f, item, 51);

  center(doc, f, 'SAVO Lounge-Club · Badstraße 1 · 72336 Balingen', 86.5, { size: 4.6, color: GRAY });
  center(doc, f, 'Einlösbar auf Speisen & Getränke', 90.5, { size: 4.6, color: GRAY });
}

// ─── 2) Einlösebeleg · 62 × 100 mm ──────────────────────────────────────────
function drawRedeem(doc, item, f) {
  const v = item.voucher;

  center(doc, f, 'SAVO', 14, { size: 13, charSpace: 2.2, bold: true });
  drawRule(doc, f, 17);

  center(doc, f, 'EINLÖSEBELEG GUTSCHEIN', 22.5, { size: 5.4, charSpace: 1, bold: true });
  center(doc, f, `Nr. ${v.voucher_number ?? ''}`, 28, { size: 7, bold: true });

  center(doc, f, `Eingelöst: ${fmtMoney(item.amount)}`, 38, { size: 9 });
  center(doc, f, `Rest: ${fmtMoney(item.remaining)}`, 50, { size: 16, bold: true });
  center(doc, f, fmtDateTime(item.at), 55.5, { size: 5.4, color: GRAY });

  drawQrCentered(doc, f, item, 58);

  center(doc, f, 'Restwert mit QR prüfbar', 89.5, { size: 4.6, color: GRAY });
}

// ─── 3) Kuvert-Siegel · 62 × 30 mm (QR links, Text rechts) ──────────────────
function drawSeal(doc, item, f) {
  const v = item.voucher;
  const qrX = MARGIN;
  const qrY = (f.height - f.qr) / 2;
  const textX = qrX + f.qr + 2;

  drawQrAt(doc, item, qrX, qrY, f.qr);

  const maxTextWidth = f.width - MARGIN - textX;
  drawText(doc, 'SAVO', textX, 9.5, { size: 11, charSpace: 1.6, bold: true, maxWidth: maxTextWidth });
  drawText(doc, 'GUTSCHEIN · GESCHENKT', textX, 14.2, { size: 4.6, color: GRAY, maxWidth: maxTextWidth });
  drawText(doc, `${fmtMoney(v.original_value)} · Nr. ${v.voucher_number ?? ''}`, textX, 21, {
    size: 10, bold: true, maxWidth: maxTextWidth,
  });
  drawText(doc, 'savo-lounge-club.de', textX, 26.5, { size: 4.4, color: GRAY, maxWidth: maxTextWidth });
}

// ─── 4) Verkaufsbeleg (Kasse) · 62 × 60 mm ──────────────────────────────────
function drawSale(doc, item, f) {
  const v = item.voucher;
  const issued = v.created_date || v.issue_date;

  center(doc, f, 'SAVO', 7.4, { size: 10, charSpace: 2, bold: true });
  center(doc, f, 'BELEG GUTSCHEINVERKAUF', 10.9, { size: 4.8, charSpace: 1, bold: true });
  drawRule(doc, f, 12.4);

  left(doc, `Datum: ${fmtDateTime(issued)}`, 16.2, { size: 4.8 });
  right(doc, f, 'Kasse: Theke', 16.2, { size: 4.8 });

  drawRule(doc, f, 17.8);

  left(doc, `Gutschein Nr. ${v.voucher_number ?? ''}`, 22.2, { size: 6, bold: true });
  right(doc, f, fmtMoney(v.original_value), 22.2, { size: 6, bold: true });

  left(doc, `Zahlart: ${paymentLabel(v.payment_method)}`, 26, { size: 4.6 });
  right(doc, f, '0 % USt (Verbindlichkeit)', 26, { size: 4.4, color: GRAY });

  center(doc, f, 'Einlösbar auf Speisen & Getränke', 29.4, { size: 4.2, color: GRAY });

  drawRule(doc, f, 31.2);

  left(doc, 'Summe', 35.8, { size: 7, bold: true });
  right(doc, f, fmtMoney(v.original_value), 35.8, { size: 7, bold: true });

  drawQrCentered(doc, f, item, 37.6);

  center(doc, f, 'Vielen Dank!', 56.4, { size: 4, bold: true });
}

// ─── Format-Registry (je Format eigene Seitenhöhe) ──────────────────────────
export const VOUCHER_FORMATS = {
  geschenkgutschein: {
    key: 'geschenkgutschein',
    label: 'Geschenkgutschein',
    hint: 'Verkauf',
    width: PAGE_WIDTH,
    height: 100,
    qr: 28,
    draw: drawGift,
  },
  einloese_beleg: {
    key: 'einloese_beleg',
    label: 'Einlösebeleg',
    hint: 'nach Einlösung',
    width: PAGE_WIDTH,
    height: 100,
    qr: 24,
    draw: drawRedeem,
  },
  siegel: {
    key: 'siegel',
    label: 'Kuvert-Siegel',
    hint: 'Aufkleber',
    width: PAGE_WIDTH,
    height: 30,
    qr: 22,
    draw: drawSeal,
  },
  verkaufsbeleg: {
    key: 'verkaufsbeleg',
    label: 'Verkaufsbeleg',
    hint: 'Kasse',
    width: PAGE_WIDTH,
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

// ─── PDF bauen ──────────────────────────────────────────────────────────────
/**
 * items: [{ format, voucher, amount?, remaining?, at? }]
 * Jede Position wird eine Seite in der natürlichen Höhe ihres Formats
 * (100 / 100 / 30 / 60 mm) — ohne Skalierung.
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

  // jsPDF dreht Seiten automatisch auf "portrait", wenn format[0] > format[1].
  // Für die breiten, flachen Formate (Siegel 62×30, Verkaufsbeleg 62×60) muss
  // deshalb ausdrücklich 'landscape' gesetzt werden, damit die Maße stimmen.
  const orientationOf = (f) => (f.width > f.height ? 'landscape' : 'portrait');

  const first = getVoucherFormat(prepared[0].format);
  const doc = new jsPDF({
    unit: 'mm',
    format: [first.width, first.height],
    orientation: orientationOf(first),
    compress: true,
  });

  prepared.forEach((item, index) => {
    const f = getVoucherFormat(item.format);
    if (index > 0) doc.addPage([f.width, f.height], orientationOf(f));
    f.draw(doc, item, f);
  });

  return doc;
}