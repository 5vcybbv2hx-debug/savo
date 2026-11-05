/**
 * voucherPrint62 — Gutschein-Ausgaben 62 × 100 mm für den Brother QL-800
 * (Thermodirekt, Endlosrolle 62 mm).
 *
 * Regeln:
 * - Seitenformat exakt 62 × 100 mm, ein Gutschein pro Seite, keine Skalierung
 * - nur Schwarz, Akzentlinien ausschließlich Grau
 * - QR-Inhalt: https://savo-lounge-club.de/gutschein?nr=<nr>&t=<access_token>
 *   NIEMALS zusätzlich "_t" anhängen — die öffentliche API liefert dann leer.
 * - ohne access_token wird kein QR gerendert (Token wird vorher erzeugt)
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { voucherQrUrl } from '@/lib/vouchers';

export const VOUCHER_PAGE_MM = { width: 62, height: 100 };

const PAGE = VOUCHER_PAGE_MM;
const CENTER = PAGE.width / 2;
const INNER_W = 50;          // 6 mm Rand je Seite (max. 3 mm Vorgabe ist enger, wir bleiben sicher)

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

// ─── QR-Ziel ────────────────────────────────────────────────────────────────
/**
 * Öffentliche URL für den QR-Code. Ohne Nummer oder Token → null.
 * voucherQrUrl baut "?nr=…&t=…" — hier wird bewusst NICHTS ergänzt.
 */
export function voucherQrPayload(voucher) {
  if (!voucher?.voucher_number || !voucher?.access_token) return null;
  return voucherQrUrl(voucher);
}

// ─── Text-Zeichnen (nur Helvetica, alles zentriert) ─────────────────────────
function spacedWidth(doc, text, charSpace) {
  return doc.getTextWidth(text) + charSpace * Math.max(0, String(text).length - 1);
}

function drawCentered(doc, text, y, {
  size, charSpace = 0, bold = false, color = BLACK, maxWidth = INNER_W,
} = {}) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  let pt = size;
  doc.setFontSize(pt);
  while (pt > 5 && spacedWidth(doc, text, charSpace) > maxWidth) {
    pt = Math.round((pt - 0.3) * 10) / 10;
    doc.setFontSize(pt);
  }
  doc.setTextColor(color[0], color[1], color[2]);
  const x = CENTER - spacedWidth(doc, text, charSpace) / 2;
  doc.text(String(text), x, y, { charSpace });
}

function drawRule(doc, y, { width = 0.3, color = LINE_GRAY, from = 6, to = 56 } = {}) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(width);
  doc.line(from, y, to, y);
}

function drawBrand(doc, { size = 20, charSpace = 2.6 } = {}) {
  drawCentered(doc, 'SAVO', 10, { size, charSpace, bold: true });
  drawCentered(doc, 'LOUNGE · CLUB', 14.8, { size: 6.4, charSpace: 1.5, color: GRAY });
  drawRule(doc, 18.2);
}

// ─── a) Geschenkgutschein (Verkauf) ─────────────────────────────────────────
function drawGift(doc, item) {
  const v = item.voucher;

  drawBrand(doc);

  drawCentered(doc, 'GUTSCHEIN', 27, { size: 12.5, charSpace: 2.4, bold: true });
  drawCentered(doc, fmtMoney(v.original_value), 43, { size: 30, bold: true });

  drawRule(doc, 51.5, { width: 0.2, color: HAIRLINE });

  drawCentered(doc, `Nr. ${v.voucher_number ?? ''}`, 55.5, { size: 9.5, bold: true });
  drawCentered(doc, `Ausgestellt ${fmtDate(v.issue_date)}`, 60, { size: 6.4, color: GRAY });

  if (item.qr) doc.addImage(item.qr, 'PNG', CENTER - 14, 62.5, 28, 28, undefined, 'NONE');

  drawCentered(doc, 'SAVO Lounge-Club · Badstraße 1 · 72336 Balingen',
    93.4, { size: 4.6, color: GRAY, maxWidth: 56 });
  drawCentered(doc, 'Einlösbar auf Speisen & Getränke · Restwert jederzeit abrufbar',
    96.2, { size: 4.6, color: GRAY, maxWidth: 56 });
}

// ─── b) Einlösebeleg (nach Einlösung) ───────────────────────────────────────
function drawRedeem(doc, item) {
  const v = item.voucher;

  drawBrand(doc, { size: 17, charSpace: 2.3 });

  drawCentered(doc, 'EINLÖSEBELEG', 25, { size: 10.5, charSpace: 1.9, bold: true });
  drawCentered(doc, 'GUTSCHEIN', 29.8, { size: 8.5, charSpace: 1.6, bold: true });

  drawCentered(doc, `Nr. ${v.voucher_number ?? ''}`, 37, { size: 9, bold: true });
  drawCentered(doc, `Eingelöst: ${fmtMoney(item.amount)}`, 44.5, { size: 10 });
  drawCentered(doc, `Rest: ${fmtMoney(item.remaining)}`, 57, { size: 19, bold: true });
  drawCentered(doc, fmtDateTime(item.at), 63.5, { size: 6.4, color: GRAY });

  if (item.qr) doc.addImage(item.qr, 'PNG', CENTER - 12, 67, 24, 24, undefined, 'NONE');

  drawCentered(doc, 'Restwert mit QR prüfbar', 94.6, { size: 4.8, color: GRAY, maxWidth: 56 });
}

// ─── PDF bauen ──────────────────────────────────────────────────────────────
/**
 * items: [{ kind: 'gift' | 'redeem', voucher, amount?, remaining?, at? }]
 * Jede Position wird eine eigene Seite im Format 62 × 100 mm.
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

  const doc = new jsPDF({
    unit: 'mm',
    format: [PAGE.width, PAGE.height],
    orientation: 'portrait',
    compress: true,
  });

  prepared.forEach((item, index) => {
    if (index > 0) doc.addPage([PAGE.width, PAGE.height], 'portrait');
    if (item.kind === 'redeem') drawRedeem(doc, item);
    else drawGift(doc, item);
  });

  return doc;
}