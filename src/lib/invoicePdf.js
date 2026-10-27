/**
 * PDF-Erzeugung für Außenaufträge (Angebote & Ausgangsrechnungen).
 *
 * Design: ruhiges Layout mit §14-UStG-Pflichtangaben, ein Akzentton (Teal)
 * sparsam eingesetzt, Logo im Originalseitenverhältnis.
 *
 * Ausgelagert aus ExternalBusiness.jsx, damit die Seite unter dem Edit-Limit
 * bleibt. Kategorien und Helfer sind die gemeinsame Quelle für die Seite.
 */
import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export const CAT_EVENT = 'Externer Event';
export const CAT_WKZ = 'Werbekostenzuschuss';
export const CAT_GUTSCHEIN = 'Gutschein';
// Gutschein-Verkauf (Kauf auf Rechnung): Konto 1370 — DATEV-Konto vom Buchhalter bestätigen lassen
export const DEFAULT_ACCOUNT = { [CAT_EVENT]: '8000', [CAT_WKZ]: '8035', [CAT_GUTSCHEIN]: '1370' };

export const eur = n => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const today = () => format(new Date(), 'yyyy-MM-dd');

export const emptyPosition = () => ({ description: '', quantity: 1, actual_quantity: null, unit_price: 0, ek_per_unit: 0, quantity_provided: 0, unit: '', category: '', notes: '' });

// §19 UStG Kleinunternehmer — kein USt-Ausweis auf Rechnungen
export const isSmallBusiness = (company) => !!company?.is_small_business;

// Pflichtfeld-Check vor PDF-Erstellung (§14 UStG)
export function validateForPdf(company) {
    if (isSmallBusiness(company)) return true;
    if (!company?.tax_id && !company?.vat_id) {
        toast.error('Firmen-Steuernummer oder USt-IdNr. fehlt — bitte unter Einstellungen → Firmeninfo ergänzen. Ohne diese Angabe ist das PDF nicht rechtskonform (§14 UStG).');
        return false;
    }
    return true;
}

// ── PDF: Angebot/Rechnung — ruhiges, elegantes Layout mit §14-UStG-Pflichtangaben ─
// Design: viel Weißraum, ein Akzentton (Teal) sparsam eingesetzt, keine Flächenfüllung
// im Kopf. Logo wird im Originalseitenverhältnis eingepasst (nie gequetscht).
const TEAL = [8, 145, 178];         // #0891b2 — Akzent (Linien, Titel, kleine Details)
const TEAL_DARK = [14, 116, 144];   // #0e7490 — Labels/Kleintext in Akzentfarbe
const GRAY = [110, 110, 116];       // sekundärer Text
const GRAY_LIGHT = [238, 238, 240]; // Trennlinien / Notiz-Hintergrund
const INK = [30, 30, 32];           // Haupttext (kein reines Schwarz — wirkt weicher)

// Lädt ein Bild und liefert Data-URL + Originalmaße, damit das Seitenverhältnis
// beim Platzieren im PDF exakt erhalten bleibt (kein Verzerren/Quetschen).
async function loadImageWithSize(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve({
                    dataUrl: canvas.toDataURL('image/png'),
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                });
            } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

export async function downloadPdf(kind, data, company) {
    if (!validateForPdf(company)) return;
    const doc = new jsPDF('p', 'mm', 'a4');
    const isInvoice = kind === 'invoice';
    const number = isInvoice ? data.invoice_number : data.offer_number;
    const recipient = data.category === CAT_WKZ ? data.supplier_name : data.customer_name;
    // Adresse: bevorzugt aus Einzelfeldern, Fallback auf legacy customer_address
    const addressLines = [
        data.customer_street,
        [data.customer_postal_code, data.customer_city].filter(Boolean).join(' '),
    ].filter(Boolean);
    const address = addressLines.length ? addressLines : (data.customer_address || '').split('\n');

    const MARGIN_L = 18, MARGIN_R = 192;

    // Logo laden — im Originalseitenverhältnis einpassen (max. 15mm hoch, 34mm breit)
    const logo = company?.logo_url ? await loadImageWithSize(company.logo_url) : null;
    let logoW = 0, logoH = 0;
    if (logo) {
        const ratio = logo.width / logo.height;
        logoH = 15;
        logoW = logoH * ratio;
        if (logoW > 34) { logoW = 34; logoH = logoW / ratio; }
    }

    // ── Kopf: Logo (natürliches Format) + Firma links, Dokumenttitel rechts ────
    if (logo) {
        try { doc.addImage(logo.dataUrl, 'PNG', MARGIN_L, 14, logoW, logoH); } catch { /* Fallback: nur Text */ }
    }
    const textX = MARGIN_L + (logo ? logoW + 6 : 0);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(company?.company_name || 'SAVO', textX, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    const subLine = [company?.street, [company?.postal_code, company?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    if (subLine) doc.text(subLine, textX, 25.5);
    if (company?.owner_name) doc.text(`Inhaber: ${company.owner_name}`, textX, 30);

    // Dokumenttitel rechts — schlank, nur Textfarbe als Akzent, keine Fläche
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.setTextColor(...TEAL);
    const docTitle = isInvoice
        ? (data.category === CAT_WKZ ? 'GUTSCHRIFT' : (data.storno_reference ? 'STORNORECHNUNG' : 'RECHNUNG'))
        : 'ANGEBOT';
    doc.text(docTitle, MARGIN_R, 20, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(`Nr. ${number}`, MARGIN_R, 26, { align: 'right' });
    doc.text(`Datum: ${format(parseISO(isInvoice ? data.invoice_date : data.offer_date), 'dd.MM.yyyy')}`, MARGIN_R, 31, { align: 'right' });
    if (data.service_date) {
        const leistung = (data.service_date_type === 'Zeitraum' && data.service_date_end)
            ? `Leistung: ${format(parseISO(data.service_date), 'dd.MM.yyyy')} – ${format(parseISO(data.service_date_end), 'dd.MM.yyyy')}`
            : `Leistung: ${format(parseISO(data.service_date), 'dd.MM.yyyy')}`;
        doc.text(leistung, MARGIN_R, 36, { align: 'right' });
    }

    // Dünne Trennlinie unter dem Kopf
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_L, 41, MARGIN_R, 41);

    // ── Empfänger-Block ──────────────────────────────────────────────────────
    doc.setFontSize(7.5);
    doc.setTextColor(...TEAL_DARK);
    doc.setFont('helvetica', 'bold');
    doc.text(isInvoice ? 'RECHNUNG AN' : 'ANGEBOT AN', MARGIN_L, 51);
    doc.setTextColor(...INK);
    doc.setFontSize(10.5);
    // Name umbrechen statt abschneiden — mehrzeilige Namen verschieben den Block nach unten
    const recipLines = doc.splitTextToSize(String(recipient || 'Empfänger'), MARGIN_R - MARGIN_L);
    recipLines.forEach((l, i) => doc.text(l, MARGIN_L, 57 + i * 5));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    let ry = 62.5 + (recipLines.length - 1) * 5;
    const addrLines = Array.isArray(address) ? address : String(address).split('\n');
    addrLines.slice(0, 4).forEach((l) => {
        doc.text(l, MARGIN_L, ry);
        ry += 5;
    });
    if (data.recipient_country && data.recipient_country !== 'Deutschland') {
        doc.text(data.recipient_country, MARGIN_L, ry);
        ry += 5;
    }
    if (data.recipient_vat_id) {
        doc.text(`Steuernummer: ${data.recipient_vat_id}`, MARGIN_L, ry);
        ry += 5;
    }

    // Betreff — dezenter Akzentstrich statt Farbfläche
    const catLabel = data.category === CAT_WKZ
        ? 'Werbekostenzuschuss'
        : (data.category === CAT_GUTSCHEIN ? 'Gutschein-Verkauf' : 'Bar-Service / Außengeschäft');
    const betreffY = ry + 4;
    doc.setFillColor(...TEAL);
    doc.rect(MARGIN_L, betreffY - 3.2, 1, 4.2, 'F');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Betreff: ${catLabel}`, MARGIN_L + 4, betreffY);

    // ── Positionen-Tabelle ───────────────────────────────────────────────────
    let y = betreffY + 9;
    // Kopfzeile: kein Flächenfüllung, nur graue Kleinschrift + dünne Teal-Unterlinie
    const hasActual = isInvoice && (data.positions || []).some(p => p.actual_quantity != null);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('POS', MARGIN_L, y);
    doc.text('BESCHREIBUNG', MARGIN_L + 9, y);
    if (hasActual) {
        doc.text('SOLL', 128, y, { align: 'right' });
        doc.text('IST', 142, y, { align: 'right' });
        doc.text('PREIS', 162, y, { align: 'right' });
    } else {
        doc.text('ANZ.', 138, y, { align: 'right' });
        doc.text('PREIS', 158, y, { align: 'right' });
    }
    doc.text('SUMME', MARGIN_R, y, { align: 'right' });
    y += 2.5;
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.4);
    doc.line(MARGIN_L, y, MARGIN_R, y);
    y += 5.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    (data.positions || []).forEach((p, idx) => {
        // Beschreibung umbrechen statt abschneiden — Zeile wächst mit
        const descMaxW = (hasActual ? 117 : 127) - (MARGIN_L + 9);
        const descLines = doc.splitTextToSize(String(p.description || ''), descMaxW);
        const lineH = 4.3;
        const rowH = 6.3 + (descLines.length - 1) * lineH;
        if (y + rowH > 248) { doc.addPage(); y = 24; }
        // sehr helle, neutrale Zebra-Füllung (keine Farbe — nur Grauton für Lesbarkeit)
        if (idx % 2 === 1) {
            doc.setFillColor(249, 249, 250);
            doc.rect(MARGIN_L, y - 4.3, MARGIN_R - MARGIN_L, rowH, 'F');
        }
        doc.setTextColor(...GRAY);
        doc.text(String(idx + 1), MARGIN_L, y);
        doc.setTextColor(...INK);
        doc.text(descLines, MARGIN_L + 9, y, { lineHeightFactor: 1.15 });
        if (hasActual) {
            doc.text(String(p.quantity ?? 1), 128, y, { align: 'right' });
            doc.setTextColor(...TEAL_DARK);
            doc.text(p.actual_quantity != null ? String(p.actual_quantity) : '—', 142, y, { align: 'right' });
            doc.setTextColor(...INK);
            doc.text(eur(p.unit_price), 162, y, { align: 'right' });
        } else {
            doc.text(String(p.quantity ?? 1), 138, y, { align: 'right' });
            doc.text(eur(p.unit_price), 158, y, { align: 'right' });
        }
        doc.text(eur(p.total ?? (p.quantity * p.unit_price)), MARGIN_R, y, { align: 'right' });
        y += rowH;
        doc.setDrawColor(...GRAY_LIGHT);
        doc.setLineWidth(0.2);
        doc.line(MARGIN_L, y - 3.4, MARGIN_R, y - 3.4);
    });

    // ── Summen — bei Kleinunternehmern (§19 UStG) kein USt-Ausweis ──────────
    y += 4;
    const smallBiz = isSmallBusiness(company);
    if (!smallBiz) {
        doc.setFontSize(9);
        doc.setTextColor(...GRAY);
        doc.setFont('helvetica', 'normal');
        doc.text('Netto', 155, y, { align: 'right' });
        doc.text(`${eur(data.amount_net)} EUR`, MARGIN_R, y, { align: 'right' });
        y += 5.5;
        doc.text(`USt ${data.tax_rate ?? 19}%`, 155, y, { align: 'right' });
        doc.text(`${eur(data.tax_amount)} EUR`, MARGIN_R, y, { align: 'right' });
        y += 3.5;
        doc.setDrawColor(...TEAL);
        doc.setLineWidth(0.5);
        doc.line(140, y, MARGIN_R, y);
        y += 6.5;
    } else {
        y += 4;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(smallBiz ? 'Gesamt (netto)' : (isInvoice ? 'Gesamt' : 'Gesamt brutto'), 155, y, { align: 'right' });
    doc.text(`${eur(data.amount_gross)} EUR`, MARGIN_R, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    y += 6;

    // ── Personal-Block (nur Rechnungen) — Arbeitsstunden × Stundensatz ────────
    if (isInvoice && (Number(data.staff_hours) || 0) > 0 && (Number(data.staff_hourly_rate) || 0) > 0) {
        y += 3;
        doc.setFillColor(...GRAY_LIGHT);
        doc.roundedRect(MARGIN_L, y, MARGIN_R - MARGIN_L, 11, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...TEAL_DARK);
        doc.text('PERSONAL VOR ORT', MARGIN_L + 3, y + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...INK);
        doc.text(
            `${Number(data.staff_hours).toLocaleString('de-DE', { minimumFractionDigits: 1 })} Std × ${eur(data.staff_hourly_rate)} €/Std`,
            MARGIN_L + 3, y + 8.5
        );
        doc.text(`${eur(data.staff_cost_total)} EUR`, MARGIN_R - 3, y + 8.5, { align: 'right' });
        y += 15;
    }

    // ── Zahlungsblock — IBAN/BIC prominent (Angebot + Rechnung identisch) ──────
    // Quelle: Rechnungs-Snapshot → bank_account_id nachladen → Fallback company.iban
    let payIban = data.iban_snapshot || '';
    let payBic = data.bic_snapshot || '';
    let payBankName = data.bank_name_snapshot || '';
    if (!payIban && data.bank_account_id) {
        try {
            const acc = await base44.entities.BankAccount.get(data.bank_account_id);
            if (acc) {
                payIban = acc.iban || '';
                payBic = acc.bic || '';
                payBankName = acc.bank_name || '';
            }
        } catch { /* Fallback auf company.iban unten */ }
    }
    if (!payIban && !payBic) {
        payIban = company?.iban || '';
        payBic = company?.bic || '';
        payBankName = company?.bank_name || '';
    }
    if (payIban || payBic) {
        y += 3;
        doc.setFillColor(...GRAY_LIGHT);
        doc.roundedRect(MARGIN_L, y, MARGIN_R - MARGIN_L, 16, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...TEAL_DARK);
        doc.text('Z A H L U N G', MARGIN_L + 3, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...INK);
        let zy = y + 10;
        if (payIban) {
            doc.text(`IBAN: ${payIban}`, MARGIN_L + 3, zy);
            zy += 4.5;
        }
        if (payBic) {
            doc.text(`BIC: ${payBic}${payBankName ? ` — ${payBankName}` : ''}`, MARGIN_L + 3, zy);
        }
        y += 20;
    }

    // ── Sichtbare Notiz — neutrale, dezente Fläche (kein Teal) ─────────────────
    if (data.notes_public && data.notes && data.notes.trim()) {
        y += 5;
        const noteLines = doc.splitTextToSize(data.notes.trim(), MARGIN_R - MARGIN_L - 4);
        const noteH = 6 + noteLines.slice(0, 5).length * 4.5 + 2;
        doc.setFillColor(...GRAY_LIGHT);
        doc.roundedRect(MARGIN_L, y, MARGIN_R - MARGIN_L, noteH, 1.5, 1.5, 'F');
        doc.setTextColor(...GRAY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('NOTIZ', MARGIN_L + 2, y + 4.5);
        doc.setTextColor(...INK);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        noteLines.slice(0, 5).forEach((l, i) => doc.text(l, MARGIN_L + 2, y + 9 + i * 4.5));
        y += noteH + 4;
    }

    // ── Footer — dünne Trennlinie, gedämpfter Text ──────────────────────────────
    const footerY = Math.max(y + 8, 262);
    doc.setDrawColor(...GRAY_LIGHT);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_L, footerY - 5, MARGIN_R, footerY - 5);
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    if (!isInvoice && data.valid_until) {
        doc.text(`Freibleibendes Angebot, gültig bis ${format(parseISO(data.valid_until), 'dd.MM.yyyy')}.`, MARGIN_L, footerY);
    }
    if (isInvoice && data.storno_reference) {
        doc.text(`Stornorechnung zu Rechnung ${data.storno_reference}.`, MARGIN_L, footerY);
    } else if (isInvoice && data.due_date) {
        doc.text(`Zahlbar bis ${format(parseISO(data.due_date), 'dd.MM.yyyy')} ohne Abzug.`, MARGIN_L, footerY);
    }
    if (smallBiz) {
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text('Gemäß §19 UStG wird kein Umsatzsteuer ausgewiesen.', MARGIN_L, footerY + 4.3);
    }
    const footer = [
        company?.tax_id ? `Steuernummer: ${company.tax_id}` : null,
        company?.tax_office ? `Finanzamt: ${company.tax_office}` : null,
        company?.vat_id ? `USt-IdNr.: ${company.vat_id}` : null,
    ].filter(Boolean);
    const footerOffset = smallBiz ? 8.6 : 5;
    footer.forEach((l, i) => doc.text(l, MARGIN_L, footerY + footerOffset + i * 4.3));

    doc.setTextColor(...INK);
    doc.save(`${number || (isInvoice ? 'Rechnung' : 'Angebot')}.pdf`);
}