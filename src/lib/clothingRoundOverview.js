/**
 * Bestellübersicht einer Klamotten-Runde als PDF.
 *
 * Datenquelle: ClothingOrder (round_id) + Employee (short_name über employee_id —
 * employee_name in den Bestellzeilen ist bei den meisten Zeilen leer).
 * Das PDF wird beim Abschließen erzeugt, privat abgelegt und die file_uri in
 * ClothingRound.pdf_url gespeichert.
 */
import { jsPDF } from 'jspdf';
import { base44 } from '@/api/base44Client';

const TEAL = [8, 145, 178];
const TEAL_DARK = [14, 116, 144];
const GRAY = [110, 110, 116];
const INK = [30, 30, 32];
const MARGIN_L = 18;
const MARGIN_R = 192;

export const ITEM_LABELS = { pulli: 'Pulli', zshirt: 'Shirt' };
const itemLabel = (key) => ITEM_LABELS[key] || key;

const fmtDate = (value, withTime = false) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('de-DE', withTime
        ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const todayIso = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const hasQuantity = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

const employeeName = (order, employeesById) => {
    const emp = employeesById[order.employee_id];
    return (emp?.short_name || '').trim()
        || (emp?.name || '').trim()
        || (order.employee_name || '').trim()
        || 'Unbekannt';
};

/**
 * Fasst die Bestellungen einer Runde zusammen.
 * Mengen werden NUR gezählt, wenn sie tatsächlich gesetzt sind — Zeilen ohne
 * Mengenangabe landen ausschließlich im Abschnitt "Unvollständige Angaben".
 */
export function summarizeRound(round, orders, employeesById = {}) {
    const persons = new Map();
    const totals = {};
    const openRows = [];
    let totalPieces = 0;

    (orders || []).forEach((order) => {
        const name = employeeName(order, employeesById);
        const key = order.employee_id || name;
        if (!persons.has(key)) persons.set(key, { name, pulli: null, shirt: null });
        const person = persons.get(key);
        const slot = order.item === 'pulli' ? 'pulli' : 'shirt';

        if (!hasQuantity(order.quantity)) {
            person[slot] = person[slot] || { size: order.size || '—', qty: null, open: true };
            openRows.push({ name, item: order.item, size: order.size || '—' });
            return;
        }

        const qty = Number(order.quantity);
        totalPieces += qty;
        if (!totals[order.item]) totals[order.item] = { sizes: {}, total: 0 };
        totals[order.item].sizes[order.size] = (totals[order.item].sizes[order.size] || 0) + qty;
        totals[order.item].total += qty;

        if (person[slot]?.open) {
            person[slot] = { size: order.size, qty, open: false };
        } else if (person[slot]) {
            person[slot] = { size: person[slot].size, qty: person[slot].qty + qty, open: false };
        } else {
            person[slot] = { size: order.size, qty, open: false };
        }
    });

    const personList = [...persons.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));

    return {
        persons: personList,
        totals,
        openRows,
        totalPieces,
        openCount: openRows.length,
        personCount: personList.length,
    };
}

// ── PDF-Layout ───────────────────────────────────────────────────────────────
const fitText = (doc, text, maxWidth) => {
    let out = String(text ?? '');
    if (doc.getTextWidth(out) <= maxWidth) return out;
    while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxWidth) out = out.slice(0, -1);
    return `${out}…`;
};

function drawTable(doc, startY, columns, rows, opts = {}) {
    let y = startY;
    const bottom = opts.bottom || 272;

    const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        columns.forEach((c) => doc.text(c.label.toUpperCase(), c.x, y, { align: c.align || 'left' }));
        y += 2.5;
        doc.setDrawColor(...TEAL);
        doc.setLineWidth(0.4);
        doc.line(MARGIN_L, y, MARGIN_R, y);
        y += 5;
    };

    drawHeader();

    rows.forEach((row, index) => {
        if (y > bottom) {
            doc.addPage();
            y = 22;
            drawHeader();
        }
        doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...(row.muted ? GRAY : INK));
        columns.forEach((c, ci) => {
            const cell = fitText(doc, row.cells[ci] ?? '', c.width || 70);
            doc.text(cell, c.x, y, { align: c.align || 'left' });
        });
        if (row.bold) {
            y += 1.5;
            doc.setDrawColor(230, 230, 233);
            doc.setLineWidth(0.2);
            doc.line(MARGIN_L, y, MARGIN_R, y);
            y += 4;
        } else {
            y += 5.5;
        }
    });

    return y;
}

function sectionTitle(doc, y, text, hint) {
    let top = y;
    if (top > 255) { doc.addPage(); top = 22; }
    doc.setFillColor(...TEAL);
    doc.rect(MARGIN_L, top - 3.2, 1, 4.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(text, MARGIN_L + 4, top);
    if (hint) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text(hint, MARGIN_R, top, { align: 'right' });
    }
    return top + 7;
}

export function buildOverviewPdf(round, summary) {
    const doc = new jsPDF('p', 'mm', 'a4');
    const name = round?.round_name || 'Klamotten-Bestellrunde';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEAL_DARK);
    doc.text('SAVO — KLAMOTTEN-BESTELLUNG', MARGIN_L, 20);

    doc.setFontSize(16);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(`Bestellübersicht – ${name}`, MARGIN_R - MARGIN_L)[0], MARGIN_L, 28);

    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_L, 33, MARGIN_R, 33);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(`Frist: ${fmtDate(round?.deadline, true)}`, MARGIN_L, 40);
    doc.text(`Erstellt am: ${fmtDate(new Date(), true)}`, MARGIN_L, 45.5);
    doc.text(`Personen: ${summary.personCount}`, MARGIN_L + 80, 40);
    doc.text(`Teile gesamt: ${summary.totalPieces}`, MARGIN_L + 80, 45.5);
    if (summary.openCount > 0) {
        doc.setTextColor(180, 70, 0);
        doc.text(`Ohne Mengenangabe: ${summary.openCount} Zeilen`, MARGIN_L + 80, 51);
    }

    // ── Tabelle 1: Pro Person ────────────────────────────────────────────────
    let y = sectionTitle(doc, 60, 'Pro Person', `${summary.personCount} Personen`);
    const cellFor = (slot) => {
        if (!slot) return '—';
        if (slot.open) return `${slot.size} · offen`;
        return `${slot.size} · ${slot.qty}×`;
    };
    const personRows = summary.persons.map((p, i) => ({
        cells: [p.name, cellFor(p.pulli), cellFor(p.shirt)],
        muted: i > 0 && false,
    }));
    y = drawTable(doc, y, [
        { label: 'Name', x: MARGIN_L, width: 68 },
        { label: 'Pulli (Größe · Menge)', x: 92, width: 48 },
        { label: 'Shirt (Größe · Menge)', x: 145, width: 47 },
    ], personRows.length ? personRows : [{ cells: ['Keine Bestellungen erfasst', '', ''], muted: true }]);

    // ── Tabelle 2: Bestellsumme für den Lieferanten ──────────────────────────
    y = sectionTitle(doc, y + 8, 'Bestellsumme für den Lieferanten');
    const sumRows = [];
    ['pulli', 'zshirt'].forEach((key) => {
        const group = summary.totals[key];
        if (!group) return;
        Object.keys(group.sizes).forEach((size) => {
            sumRows.push({ cells: [itemLabel(key), size, `${group.sizes[size]} Stk.`] });
        });
        sumRows.push({ cells: [`${itemLabel(key)} gesamt`, '', `${group.total} Stk.`], bold: true });
    });
    y = drawTable(doc, y, [
        { label: 'Artikel', x: MARGIN_L, width: 70 },
        { label: 'Größe', x: 92, width: 40 },
        { label: 'Menge', x: 145, width: 47 },
    ], sumRows.length ? sumRows : [{ cells: ['Keine gesicherten Mengen', '', ''], muted: true }]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const perItem = ['pulli', 'zshirt']
        .filter((key) => summary.totals[key])
        .map((key) => `${summary.totals[key].total} ${itemLabel(key)}${summary.totals[key].total === 1 ? '' : 's'}`);
    if (y > 265) { doc.addPage(); y = 22; }
    doc.text(`Summe: ${perItem.join(', ') || '0'}${perItem.length ? ` = ${summary.totalPieces} Teile` : ''}`, MARGIN_L, y + 2);
    y += 10;

    // ── Abschnitt: Unvollständige Angaben ────────────────────────────────────
    y = sectionTitle(doc, y, 'Unvollständige Angaben', summary.openCount > 0 ? `${summary.openCount} Zeilen ohne Menge` : undefined);
    if (summary.openCount === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...GRAY);
        doc.text('Alle Bestellungen enthalten eine Mengenangabe.', MARGIN_L, y);
        y += 8;
    } else {
        const openRows = summary.openRows.map((r) => ({
            cells: [r.name, itemLabel(r.item), r.size],
        }));
        y = drawTable(doc, y, [
            { label: 'Name', x: MARGIN_L, width: 70 },
            { label: 'Artikel', x: 92, width: 40 },
            { label: 'Größe', x: 145, width: 47 },
        ], openRows);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        if (y > 262) { doc.addPage(); y = 22; }
        doc.text('Diese Zeilen sind nicht in den Summen enthalten und müssen vor der Bestellung geklärt werden.', MARGIN_L, y);
    }

    // ── Fußzeile mit Seitenzahlen ────────────────────────────────────────────
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i += 1) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        doc.text(`Bestellübersicht ${name} · Seite ${i} von ${pages}`, MARGIN_R, 290, { align: 'right' });
    }

    return doc;
}

const slug = (value) => String(value || 'Bestellrunde')
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Erzeugt die PDF-Übersicht einer Runde, legt sie privat ab und speichert die
 * Ablage in ClothingRound.pdf_url (plus Kennzahlen, PDF-Datum, ggf. closed_at).
 */
export async function generateRoundOverviewPdf(round, { markClosed = false } = {}) {
    if (!round?.id) throw new Error('Keine Runde ausgewählt');

    const [orders, employees] = await Promise.all([
        base44.entities.ClothingOrder.filter({ round_id: round.id }),
        base44.entities.Employee.list(),
    ]);
    const employeesById = Object.fromEntries((employees || []).map((e) => [e.id, e]));
    const summary = summarizeRound(round, orders, employeesById);

    const blob = buildOverviewPdf(round, summary).output('blob');
    const file = new File([blob], `Bestelluebersicht-${slug(round.round_name)}.pdf`, { type: 'application/pdf' });
    const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });

    const patch = {
        pdf_url: file_uri,
        pdf_created_date: todayIso(),
        total_items: summary.totalPieces,
        open_items: summary.openCount,
    };
    if (markClosed) {
        patch.is_active = false;
        if (!round.closed_at) patch.closed_at = new Date().toISOString();
    }
    await base44.entities.ClothingRound.update(round.id, patch);

    return { file_uri, summary };
}

/** Öffnet die gespeicherte PDF — private Ablage wird in eine signierte URL getauscht. */
export async function openRoundPdf(fileUri) {
    if (!fileUri) return;
    if (/^https?:\/\//i.test(fileUri)) {
        window.open(fileUri, '_blank', 'noopener');
        return;
    }
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 3600 });
    window.open(signed_url, '_blank', 'noopener');
}