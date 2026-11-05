/**
 * slotLabels — 62 × 30 mm Etiketten für den Brother QL-800 (Thermodirekt, Endlosrolle 62 mm)
 *
 * Regeln der Rolle:
 * - Nutzbreite 58 mm (2 mm Rand je Seite), Höhe 30 mm
 * - nur Schwarz, Akzente ausschließlich Grau
 * - Name: erste 18 Zeichen fett, Rest als zweite Zeile kleiner
 * - QR links 22 × 22 mm, Text rechts
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export const LABEL_MM = { width: 62, height: 30 };

const MARGIN = 2;          // 2 mm Rand je Seite → 58 mm Nutzbreite
const QR_SIZE = 22;
const QR_Y = (LABEL_MM.height - QR_SIZE) / 2;
const DIVIDER_X = 25.5;
const TEXT_X = 27;
const TEXT_W = LABEL_MM.width - TEXT_X - MARGIN; // 33 mm

const MAX_NAME_CHARS = 18;

// ─── Namen aufteilen: 18 Zeichen + Rest ──────────────────────────────────────
export function splitLabelName(value, limit = MAX_NAME_CHARS) {
    const name = String(value || '').trim().replace(/\s+/g, ' ');
    if (name.length <= limit) return { first: name, rest: '' };
    const cut = name.slice(0, limit);
    const space = cut.lastIndexOf(' ');
    const first = space > 6 ? cut.slice(0, space) : cut;
    return { first, rest: name.slice(first.length).trim() };
}

// ─── Short-Code erzeugen (Muster RA-SC-XXXX) ─────────────────────────────────
export function generateSlotCode(areaName, furnitureName, taken = new Set()) {
    const initials = (value) => {
        const clean = String(value || '').replace(/[^A-Za-zÀ-ž0-9]/g, '').toUpperCase();
        return (clean.slice(0, 2) || 'XX').padEnd(2, 'X');
    };
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
        let tail = '';
        for (let i = 0; i < 4; i++) tail += alphabet[Math.floor(Math.random() * alphabet.length)];
        code = `${initials(areaName)}-${initials(furnitureName)}-${tail}`;
    } while (taken.has(code));
    return code;
}

// ─── QR als PNG-Data-URL ─────────────────────────────────────────────────────
export function qrDataUrl(text, sizePx = 720) {
    return QRCode.toDataURL(String(text ?? ''), {
        margin: 0,
        width: sizePx,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
    });
}

export function formatEuro(value) {
    if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '';
    return `${Number(value).toFixed(2).replace('.', ',')} €`;
}

// ─── Helfer für Textanpassung ────────────────────────────────────────────────
function fitFont(doc, text, maxW, startPt, minPt) {
    let pt = startPt;
    doc.setFontSize(pt);
    while (pt > minPt && doc.getTextWidth(text) > maxW) {
        pt = Math.round((pt - 0.2) * 10) / 10;
        doc.setFontSize(pt);
    }
    return pt;
}

function fitText(doc, value, maxW) {
    const text = String(value || '');
    if (doc.getTextWidth(text) <= maxW) return text;
    let cut = text;
    while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxW) cut = cut.slice(0, -1);
    return `${cut.trim()}…`;
}

function newLabelDoc() {
    return new jsPDF({
        unit: 'mm',
        format: [LABEL_MM.width, LABEL_MM.height],
        orientation: 'landscape',
        compress: true,
    });
}

function drawBox(doc, qr) {
    if (qr) doc.addImage(qr, 'PNG', MARGIN, QR_Y, QR_SIZE, QR_SIZE, undefined, 'NONE');
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.line(DIVIDER_X, 3, DIVIDER_X, LABEL_MM.height - 3);
}

function drawPath(doc, path) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.2);
    doc.setTextColor(90, 90, 90);
    doc.text(fitText(doc, path, TEXT_W), TEXT_X, 7);
}

// ─── Fach-Etikett ────────────────────────────────────────────────────────────
function drawSlotLabel(doc, item) {
    drawBox(doc, item.qr);
    drawPath(doc, item.path);

    const { first, rest } = splitLabelName(item.name);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    fitFont(doc, first, TEXT_W, 9.6, 7);
    doc.text(first, TEXT_X, rest ? 13.4 : 15.4);

    if (rest) {
        doc.setFont('helvetica', 'normal');
        fitFont(doc, rest, TEXT_W, 7.4, 5.5);
        doc.text(fitText(doc, rest, TEXT_W), TEXT_X, 17.8);
    }

    doc.setFont('courier', 'bold');
    doc.setTextColor(0, 0, 0);
    fitFont(doc, item.code, TEXT_W, 9, 6);
    doc.text(item.code, TEXT_X, 25);
}

// ─── Preisschild ─────────────────────────────────────────────────────────────
function drawPriceLabel(doc, item) {
    drawBox(doc, item.qr);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8.4);
    const lines = doc.splitTextToSize(String(item.name || ''), TEXT_W).slice(0, 2);
    lines.forEach((line, i) => doc.text(fitText(doc, line, TEXT_W), TEXT_X, 7.4 + i * 3.9));

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    fitFont(doc, item.price, TEXT_W, 15, 9);
    doc.text(item.price, TEXT_X, 20.6);

    if (item.volume) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.setTextColor(80, 80, 80);
        doc.text(fitText(doc, item.volume, TEXT_W), TEXT_X, 25.4);
    }
}

function buildPdf(items, draw) {
    const doc = newLabelDoc();
    items.forEach((item, index) => {
        if (index > 0) doc.addPage([LABEL_MM.width, LABEL_MM.height], 'landscape');
        draw(doc, item);
    });
    return doc;
}

/**
 * items: [{ code, name, path, qr }]
 * Ein Etikett pro Seite im Format 62 × 30 mm.
 */
export function buildSlotLabelPdf(items) {
    return buildPdf(items, drawSlotLabel);
}

/**
 * items: [{ name, price, volume, qr }]
 */
export function buildPriceLabelPdf(items) {
    return buildPdf(items, drawPriceLabel);
}

export function openPdfForPrint(doc) {
    const url = doc.output('bloburl');
    window.open(url, '_blank');
}