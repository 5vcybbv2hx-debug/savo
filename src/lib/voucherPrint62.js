/**
 * voucherPrint62 — Gutschein-Ausgaben für den Brother QL-800 (Thermodirekt).
 *
 * WICHTIG: Der QL-800 schneidet IMMER nach 70 mm — unabhängig davon, wie hoch
 * die Seite im PDF ist. Deshalb haben ALLE Formate exakt 62 × 70 mm
 * (format: [62, 70], unit 'mm'). Variable Höhen würden dazu führen, dass der
 * Cutter den Rest wegwirft oder Inhalt anschneidet.
 *
 *   geschenkgutschein  62 × 70 mm
 *   einloese_beleg     62 × 70 mm
 *   siegel             62 × 70 mm
 *   verkaufsbeleg      62 × 70 mm
 *
 * Regeln:
 * - Inhalt ausschließlich zwischen 3 mm und 67 mm Höhe (3 mm Rand oben/unten)
 * - nur Schwarz, Akzentlinien ausschließlich Grau
 * - QR-Inhalt: https://savo-lounge-club.de/gutschein?nr=<nr>&t=<access_token>
 *   NIEMALS zusätzlich "_t" anhängen — die öffentliche API liefert dann leer.
 * - ohne access_token wird kein QR gerendert (Token wird vorher erzeugt)
 *
 * Neue Formate: nur einen Eintrag in VOUCHER_FORMATS ergänzen (draw + QR-Größe).
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { voucherQrUrl } from '@/lib/vouchers';

const BLACK = [0, 0, 0];
const GRAY = [110, 110, 110];
const LINE_GRAY = [150, 150, 150];
const HAIRLINE = [190, 190, 190];

// Feste Seitenhöhe für den QL-800 (Cutter schneidet immer bei 70 mm)
const PAGE_MM = { width: 62, height: 70 };

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

// ─── 1) Geschenkgutschein · 62 × 70 mm ──────────────────────────────────────
function drawGift(doc, item, f) {
  const v = item.voucher;

  center(doc, f, 'SAVO', 9, { size: 15, charSpace: 2.2, bold: true });
  center(doc, f, 'LOUNGE · CLUB', 12.8, { size: 4.8, charSpace: 1.2, color: GRAY });
  drawRule(doc, f, 15.4);

  center(doc, f, 'GUTSCHEIN', 19.4, { size: 5.6, charSpace: 1.8, bold: true });
  center(doc, f, fmtMoney(v.original_value), 29.2, { size: 26, bold: true });

  center(doc, f, `Nr. ${v.voucher_number ?? ''}`, 34, { size: 7, bold: true });
  center(doc, f, `Ausgestellt ${fmtDate(v.issue_date)}`, 37.4, { size: 4.6, color: GRAY });

  drawQr(doc, f, item, 39);

  center(doc, f, 'SAVO Lounge-Club · Badstraße 1 · 72336 Balingen', 62.2, { size: 4.2, color: GRAY });
  center(doc, f, 'Einlösbar auf Speisen & Getränke', 65.4, { size: 4.2, color: GRAY });
}

// ─── 2) Einlösebeleg · 62 × 70 mm ───────────────────────────────────────────
function drawRedeem(doc, item, f) {
  const v = item.voucher;

  center(doc, f, 'SAVO', 9.5, { size: 12, charSpace: 2.2, bold: true });
  drawRule(doc, f, 12.4);

  center(doc, f, 'EINLÖSEBELEG GUTSCHEIN', 17.5, { size: 5, charSpace: 1, bold: true });
  center(doc, f, `Nr. ${v.voucher_number ?? ''}`, 22.6, { size: 6.5, bold: true });

  center(doc, f, `Eingelöst: ${fmtMoney(item.amount)}`, 29, { size: 8 });
  center(doc, f, `Rest: ${fmtMoney(item.remaining)}`, 38.5, { size: 15, bold: true });
  center(doc, f, fmtDateTime(item.at), 43, { size: 4.8, color: GRAY });

  drawQr(doc, f, item, 45);

  center(doc, f, 'Restwert mit QR prüfbar', 65.8, { size: 4.4, color: GRAY });
}

// ─── 3) Kuvert-Siegel · 62 × 70 mm ──────────────────────────────────────────
function drawSeal(doc, item, f) {
  const v = item.voucher;

  center(doc, f, 'SAVO', 11, { size: 14, charSpace: 2.2, bold: true });
  center(doc, f, 'GUTSCHEIN · GESCHENKT', 15.2, { size: 4.6, charSpace: 0.2, color: GRAY });
  drawRule(doc, f, 18);

  center(doc, f, fmtMoney(v.original_value), 27.6, { size: 20, bold: true });
  center(doc, f, `Nr. ${v.voucher_number ?? ''}`, 32.6, { size: 6.5, bold: true });

  drawQr(doc, f, item, 35);

  center(doc, f, 'savo-lounge-club.de', 60.8, { size: 4.2, color: GRAY });
  center(doc, f, 'SAVO Lounge-Club · Badstraße 1 · 72336 Balingen', 64.2, { size: 4, color: GRAY });
}

// ─── 4) Verkaufsbeleg (Kasse) · 62 × 70 mm ──────────────────────────────────
function drawSale(doc, item, f) {
  const v = item.voucher;
  const issued = v.created_date || v.issue_date;

  center(doc, f, 'SAVO', 9, { size: 9.5, charSpace: 2, bold: true });
  center(doc, f, 'GUTSCHEINVERKAUF', 13, { size: 4.6, charSpace: 1, bold: true });
  drawRule(doc, f, 15.6);

  left(doc, `Datum: ${fmtDateTime(issued)}`, 19.6, { size: 4.4 });
  right(doc, f, 'Kasse: Theke', 19.6, { size: 4.4 });

  left(doc, `Gutschein Nr. ${v.voucher_number ?? ''}`, 25.4, { size: 5.6, bold: true });
  right(doc, f, fmtMoney(v.original_value), 25.4, { size: 5.6, bold: true });

  left(doc, `Zahlart: ${paymentLabel(v.payment_method)}`, 29.6, { size: 4.2 });
  right(doc, f, '0 % USt (Verbindlichkeit)', 29.6, { size: 3.9, color: GRAY });

  center(doc, f, 'Einlösbar auf Speisen & Getränke', 33.4, { size: 4.2, color: GRAY });

  drawRule(doc, f, 35.8);

  left(doc, 'Summe', 40.6, { size: 6.5, bold: true });
  right(doc, f, fmtMoney(v.original_value), 40.6, { size: 6.5, bold: true });

  center(doc, f, '0 % USt, keine Umsatzsteuer (Verbindlichkeit)', 44.6, { size: 4, color: GRAY });

  drawQr(doc, f, item, 47);

  center(doc, f, 'Vielen Dank!', 65.4, { size: 4.6, bold: true });
}

// ─── Format-Registry (alle Formate 62 × 70 mm) ──────────────────────────────
export const VOUCHER_FORMATS = {
  geschenkgutschein: {
    key: 'geschenkgutschein',
    label: 'Geschenkgutschein',
    hint: 'Verkauf',
    width: PAGE_MM.width,
    height: PAGE_MM.height,
    qr: 20,
    draw: drawGift,
  },
  einloese_beleg: {
    key: 'einloese_beleg',
    label: 'Einlösebeleg',
    hint: 'nach Einlösung',
    width: PAGE_MM.width,
    height: PAGE_MM.height,
    qr: 18,
    draw: drawRedeem,
  },
  siegel: {
    key: 'siegel',
    label: 'Kuvert-Siegel',
    hint: 'Aufkleber',
    width: PAGE_MM.width,
    height: PAGE_MM.height,
    qr: 22,
    draw: drawSeal,
  },
  verkaufsbeleg: {
    key: 'verkaufsbeleg',
    label: 'Verkaufsbeleg',
    hint: 'Kasse',
    width: PAGE_MM.width,
    height: PAGE_MM.height,
    qr: 15,
    draw: drawSale,
  },
};

export const VOUCHER_FORMAT_LIST = Object.values(VOUCHER_FORMATS);
export const DEFAULT_VOUCHER_FORMAT = 'geschenkgutschein';

export function getVoucherFormat(key) {
  return VOUCHER_FORMATS[key] || VOUCHER_FORMATS[DEFAULT_VOUCHER_FORMAT];
}

// Feste Papiergröße QL-800 (Cutter schneidet immer 70 mm)
export const VOUCHER_PAGE_MM = { ...PAGE_MM };

// ─── PDF bauen ──────────────────────────────────────────────────────────────
/**
 * items: [{ format, voucher, amount?, remaining?, at? }]
 * Jede Position wird eine Seite — alle Seiten exakt 62 × 70 mm,
 * damit der QL-800 nichts abschneidet.
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

  const doc = new jsPDF({
    unit: 'mm',
    format: [PAGE_MM.width, PAGE_MM.height],
    orientation: 'portrait',
    compress: true,
  });

  prepared.forEach((item, index) => {
    const f = getVoucherFormat(item.format);
    if (index > 0) doc.addPage([PAGE_MM.width, PAGE_MM.height], 'portrait');
    f.draw(doc, item, f);
  });

  return doc;
}