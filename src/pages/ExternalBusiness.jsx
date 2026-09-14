/**
 * Außenaufträge — Angebote & Ausgangsrechnungen für externe Events
 * und Werbekostenzuschüsse (WKZ) von Lieferanten/Brauereien.
 *
 * Fluss: Angebot → (bei Zusage) → Rechnung → PDF → gesendet → bezahlt.
 * Rechnungen (doc_status 'Gesendet') fließen in den DATEV-Export ein.
 * Rechnungs-Pflichtangaben nach §14 UStG werden im PDF berücksichtigt.
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { jsPDF } from 'jspdf';
import { format, addDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Plus, Pencil, FileText, Send, CheckCircle2, Ban,
    ArrowRightLeft, Euro, X, ReceiptText, Calculator, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import OfferCalculation from '@/components/external/OfferCalculation';

const CAT_EVENT = 'Externer Event';
const CAT_WKZ = 'Werbekostenzuschuss';
const DEFAULT_ACCOUNT = { [CAT_EVENT]: '8000', [CAT_WKZ]: '8035' };

const eur = n => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => format(new Date(), 'yyyy-MM-dd');

const emptyPosition = () => ({ description: '', quantity: 1, actual_quantity: null, unit_price: 0, ek_per_unit: 0, quantity_provided: 0, unit: '', category: '', notes: '' });

// §19 UStG Kleinunternehmer — kein USt-Ausweis auf Rechnungen
const isSmallBusiness = (company) => !!company?.is_small_business;

// Pflichtfeld-Check vor PDF-Erstellung (§14 UStG)
function validateForPdf(company) {
    if (isSmallBusiness(company)) return true;
    if (!company?.tax_id && !company?.vat_id) {
        toast.error('Firmen-Steuernummer oder USt-IdNr. fehlt — bitte unter Einstellungen → Firmeninfo ergänzen. Ohne diese Angabe ist das PDF nicht rechtskonform (§14 UStG).');
        return false;
    }
    return true;
}

// Empfänger-Ergänzung: Land + USt-IdNr. (bei EU-Kunden, §14a UStG)
function RecipientExtraFields({ record, setField }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
                <Label className="text-[11px]">Land</Label>
                <Input
                    value={record.recipient_country || 'Deutschland'}
                    onChange={(e) => setField('recipient_country', e.target.value)}
                    placeholder="Deutschland"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-[11px]">USt-IdNr. (EU)</Label>
                <Input
                    value={record.recipient_vat_id || ''}
                    onChange={(e) => setField('recipient_vat_id', e.target.value)}
                    placeholder="z.B. ATU12345678"
                />
            </div>
        </div>
    );
}

// ── Adresse: drei Einzelfelder (Straße, PLZ, Ort) ──────────────────────────
function AddressFields({ record, setField }) {
    return (
        <div className="space-y-1.5">
            <Label>Anschrift</Label>
            <Input
                value={record.customer_street || ''}
                onChange={(e) => setField('customer_street', e.target.value)}
                placeholder="Straße und Hausnummer"
            />
            <div className="flex gap-2">
                <Input
                    value={record.customer_postal_code || ''}
                    onChange={(e) => setField('customer_postal_code', e.target.value)}
                    placeholder="PLZ"
                    className="w-24"
                />
                <Input
                    value={record.customer_city || ''}
                    onChange={(e) => setField('customer_city', e.target.value)}
                    placeholder="Ort"
                    className="flex-1"
                />
            </div>
        </div>
    );
}

// ── Nummernkreis: fortlaufend & lückenlos pro Jahr ─────────────────────────────
async function nextNumber(records, field, prefix) {
    const year = new Date().getFullYear();
    const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    const max = records.reduce((m, r) => {
        const match = String(r[field] || '').match(re);
        return match ? Math.max(m, parseInt(match[1])) : m;
    }, 0);
    return `${prefix}-${year}-${String(max + 1).padStart(3, '0')}`;
}

// ── PDF: Angebot/Rechnung im SAVO-Teal-Stil mit §14-UStG-Pflichtangaben ─────
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

async function downloadPdf(kind, data, company) {
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
    if (isInvoice && data.service_date) {
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
    doc.text(recipient || 'Empfänger', MARGIN_L, 57);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    let ry = 62.5;
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
        doc.text(`USt-IdNr.: ${data.recipient_vat_id}`, MARGIN_L, ry);
        ry += 5;
    }

    // Betreff — dezenter Akzentstrich statt Farbfläche
    const catLabel = data.category === CAT_WKZ ? 'Werbekostenzuschuss' : 'Bar-Service / Außengeschäft';
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
        if (y > 248) { doc.addPage(); y = 24; }
        // sehr helle, neutrale Zebra-Füllung (keine Farbe — nur Grauton für Lesbarkeit)
        if (idx % 2 === 1) {
            doc.setFillColor(249, 249, 250);
            doc.rect(MARGIN_L, y - 4.3, MARGIN_R - MARGIN_L, 6.3, 'F');
        }
        doc.setTextColor(...GRAY);
        doc.text(String(idx + 1), MARGIN_L, y);
        doc.setTextColor(...INK);
        doc.text(String(p.description || '').slice(0, 62), MARGIN_L + 9, y);
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
        y += 6.3;
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
    if (company?.iban || company?.bic) {
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
        if (company?.iban) {
            doc.text(`IBAN: ${company.iban}`, MARGIN_L + 3, zy);
            zy += 4.5;
        }
        if (company?.bic) {
            doc.text(`BIC: ${company.bic}${company.bank_name ? ` — ${company.bank_name}` : ''}`, MARGIN_L + 3, zy);
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
        company?.tax_id ? `Steuernr.: ${company.tax_id}` : null,
        company?.vat_id ? `USt-IdNr.: ${company.vat_id}` : null,
    ].filter(Boolean);
    const footerOffset = smallBiz ? 8.6 : 5;
    footer.forEach((l, i) => doc.text(l, MARGIN_L, footerY + footerOffset + i * 4.3));

    doc.setTextColor(...INK);
    doc.save(`${number || (isInvoice ? 'Rechnung' : 'Angebot')}.pdf`);
}

// ── Status-Badges ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const styles = {
        'Entwurf': 'bg-secondary text-muted-foreground border-border',
        'Gesendet': 'bg-blue-500/10 text-blue-500 border-blue-500/30',
        'Bestätigt': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
        'Abgelehnt': 'bg-destructive/10 text-destructive border-destructive/30',
        'Rechnung erstellt': 'bg-primary/10 text-primary border-primary/30',
        'bezahlt': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
        'offen': 'bg-amber-500/10 text-amber-500 border-amber-500/30',
        'überfällig': 'bg-destructive/10 text-destructive border-destructive/30',
        'Storniert': 'bg-destructive/10 text-muted-foreground border-border/50 line-through',
        'teilbezahlt': 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    };
    return (
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', styles[status] || styles['Entwurf'])}>
            {status}
        </span>
    );
}

export default function ExternalBusiness() {
    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState('invoices');
    const [editing, setEditing] = useState(null);   // 'offer' | 'invoice' | null
    const [record, setRecord] = useState(null);

    // ── Daten ───────────────────────────────────────────────────────────────
    const { data: invoices = [] } = useQuery({
        queryKey: ['external-invoices'],
        queryFn: () => base44.entities.DebitorInvoice.list('-invoice_date', 500),
        staleTime: STALE.MEDIUM,
    });
    const { data: offers = [] } = useQuery({
        queryKey: ['external-offers'],
        queryFn: () => base44.entities.Offer.list('-offer_date', 500),
        staleTime: STALE.MEDIUM,
    });
    const { data: suppliers = [] } = useQuery({
        queryKey: ['wkz-suppliers'],
        queryFn: () => base44.entities.Supplier.list(),
        staleTime: STALE.LONG,
    });
    const { data: events = [] } = useQuery({
        queryKey: ['external-events'],
        queryFn: () => base44.entities.Event.list('date', 100),
        staleTime: STALE.MEDIUM,
    });
    const { data: companyList = [] } = useQuery({
        queryKey: ['company-info'],
        queryFn: () => base44.entities.CompanyInfo.list(),
        staleTime: STALE.LONG,
    });
    const company = companyList[0];

    // ── Kennzahlen ──────────────────────────────────────────────────────────
    const openInvoices = useMemo(() =>
        invoices.filter(i => i.doc_status !== 'Storniert' && i.payment_status !== 'bezahlt'),
        [invoices]);
    const openOfferList = useMemo(() =>
        offers.filter(o => !['Abgelehnt', 'Rechnung erstellt'].includes(o.status)),
        [offers]);
    const openSum = openInvoices.reduce((s, i) => s + (i.amount_gross || 0), 0);

    // ── Mutations ───────────────────────────────────────────────────────────
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['external-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['external-offers'] });
    };

    const saveInvoice = useMutation({
        mutationFn: ({ id, data }) => id
            ? base44.entities.DebitorInvoice.update(id, data)
            : base44.entities.DebitorInvoice.create(data),
        onSuccess: () => { invalidate(); setEditing(null); setRecord(null); toast.success('Rechnung gespeichert'); },
        onError: (e) => toast.error('Speichern fehlgeschlagen: ' + e.message),
    });
    const saveOffer = useMutation({
        mutationFn: ({ id, data }) => id
            ? base44.entities.Offer.update(id, data)
            : base44.entities.Offer.create(data),
        onSuccess: () => { invalidate(); setEditing(null); setRecord(null); toast.success('Angebot gespeichert'); },
        onError: (e) => toast.error('Speichern fehlgeschlagen: ' + e.message),
    });
    const updateInvoice = useMutation({
        mutationFn: ({ id, data }) => base44.entities.DebitorInvoice.update(id, data),
        onSuccess: () => { invalidate(); toast.success('Aktualisiert'); },
    });
    const updateOffer = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Offer.update(id, data),
        onSuccess: () => { invalidate(); toast.success('Aktualisiert'); },
    });

    // ── Formular ────────────────────────────────────────────────────────────
    const openNew = (kind) => {
        const isInvoice = kind === 'invoice';
        const cat = CAT_EVENT;
        setRecord({
            category: cat,
            customer_name: '',
            customer_address: '',
            customer_street: '',
            customer_postal_code: '',
            customer_city: '',
            recipient_vat_id: '',
            recipient_country: 'Deutschland',
            supplier_name: '',
            supplier_id: '',
            linked_event_id: '',
            positions: [emptyPosition()],
            tax_rate: 19,
            description: '',
            notes: '',
            notes_public: false,
            // Kalkulationsfelder (Angebote)
            guests: null,
            event_start_time: '',
            event_end_time: '',
            staff_count: null,
            ...(isInvoice
                ? { invoice_date: today(), service_date: today(), service_date_type: 'Einzel', service_date_end: '', due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'), datev_account: DEFAULT_ACCOUNT[cat] }
                : { offer_date: today(), valid_until: format(addDays(new Date(), 30), 'yyyy-MM-dd') }),
        });
        setEditing(kind);
    };

    const openEdit = (kind, r) => {
        setRecord({
            ...r,
            positions: (r.positions && r.positions.length) ? r.positions : [emptyPosition()],
        });
        setEditing(kind);
    };

    const setField = (k, v) => setRecord(r => ({ ...r, [k]: v }));
    const setPosition = (i, k, v) => setRecord(r => {
        const positions = r.positions.map((p, idx) => idx === i ? { ...p, [k]: v } : p);
        return { ...r, positions };
    });
    const addPosition = () => setRecord(r => ({ ...r, positions: [...r.positions, emptyPosition()] }));
    const removePosition = (i) => setRecord(r => ({ ...r, positions: r.positions.filter((_, idx) => idx !== i) }));

    const totals = useMemo(() => {
        const positions = record?.positions || [];
        const net = positions.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0), 0);
        const rate = Number(record?.tax_rate) || 0;
        const vat = net * rate / 100;
        // Kalkulationssummen (intern)
        const wareneinsatz = positions.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.ek_per_unit) || 0), 0);
        const revenueMax = positions.reduce((s, p) => s + (Number(p.quantity_provided) || 0) * (Number(p.unit_price) || 0), 0);
        const db = net - wareneinsatz;
        // Personalkosten (Rechnung)
        const staffCost = (Number(record?.staff_hours) || 0) * (Number(record?.staff_hourly_rate) || 0);
        return { net, vat, gross: net + vat, wareneinsatz, revenueExpected: net, revenueMax, db, marge: net > 0 ? db / net : 0, staffCost };
    }, [record]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isInvoice = editing === 'invoice';
        const positions = record.positions
            .filter(p => p.description?.trim())
            .map(p => ({
                ...p,
                quantity: Number(p.quantity) || 0,
                actual_quantity: p.actual_quantity != null && p.actual_quantity !== '' ? Number(p.actual_quantity) : null,
                unit_price: Number(p.unit_price) || 0,
                total: (Number(p.quantity) || 0) * (Number(p.unit_price) || 0),
            }));
        if (!positions.length) { toast.error('Mindestens eine Position mit Beschreibung nötig'); return; }
        const composedAddress = [record.customer_street, [record.customer_postal_code, record.customer_city].filter(Boolean).join(' ')].filter(Boolean).join('\n');
        const data = {
            category: record.category,
            positions,
            tax_rate: Number(record.tax_rate) || 0,
            amount_net: totals.net,
            tax_amount: totals.vat,
            amount_gross: totals.gross,
            customer_name: record.category === CAT_WKZ ? (record.customer_name || '') : record.customer_name,
            customer_address: composedAddress || record.customer_address || '',
            customer_street: record.customer_street || '',
            customer_postal_code: record.customer_postal_code || '',
            customer_city: record.customer_city || '',
            recipient_vat_id: record.recipient_vat_id || '',
            recipient_country: record.recipient_country || 'Deutschland',
            supplier_name: record.supplier_name || '',
            supplier_id: record.supplier_id || '',
            linked_event_id: record.linked_event_id || '',
            description: record.description || '',
            notes: record.notes || '',
            notes_public: !!record.notes_public,
        };
        // Kalkulationsfelder (nur fuer Angebote)
        if (!isInvoice) {
            Object.assign(data, {
                guests: record.guests || null,
                event_start_time: record.event_start_time || '',
                event_end_time: record.event_end_time || '',
                staff_count: record.staff_count || null,
                wareneinsatz_total: totals.wareneinsatz,
                revenue_expected_total: totals.revenueExpected,
                revenue_max_total: totals.revenueMax,
                db_expected_total: totals.db,
                db_marge_total: totals.marge,
            });
        }
        if (isInvoice) {
            Object.assign(data, {
                invoice_date: record.invoice_date,
                service_date: record.service_date || record.invoice_date,
                service_date_type: record.service_date_type || 'Einzel',
                service_date_end: record.service_date_type === 'Zeitraum' ? (record.service_date_end || '') : '',
                due_date: record.due_date,
                datev_account: record.datev_account || DEFAULT_ACCOUNT[record.category],
                payment_status: record.payment_status || 'offen',
                doc_status: record.doc_status || 'Entwurf',
                staff_hours: record.staff_hours != null && record.staff_hours !== '' ? Number(record.staff_hours) : null,
                staff_hourly_rate: record.staff_hourly_rate != null && record.staff_hourly_rate !== '' ? Number(record.staff_hourly_rate) : null,
                staff_cost_total: totals.staffCost || null,
            });
            if (!record.id) data.invoice_number = await nextNumber(invoices, 'invoice_number', 'RE');
            saveInvoice.mutate({ id: record.id, data });
        } else {
            Object.assign(data, {
                offer_date: record.offer_date,
                valid_until: record.valid_until,
                status: record.status || 'Entwurf',
            });
            if (!record.id) data.offer_number = await nextNumber(offers, 'offer_number', 'AN');
            saveOffer.mutate({ id: record.id, data });
        }
    };

    // ── Angebot → Rechnung ──────────────────────────────────────────────────
    const convertOffer = useMutation({
        mutationFn: async (offer) => {
            const invoiceNumber = await nextNumber(invoices, 'invoice_number', 'RE');
            const invoice = await base44.entities.DebitorInvoice.create({
                invoice_number: invoiceNumber,
                invoice_date: today(),
                service_date: today(),
                due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
                category: offer.category,
                customer_name: offer.customer_name || '',
                customer_address: offer.customer_address || '',
                customer_street: offer.customer_street || '',
                customer_postal_code: offer.customer_postal_code || '',
                customer_city: offer.customer_city || '',
                recipient_vat_id: offer.recipient_vat_id || '',
                recipient_country: offer.recipient_country || 'Deutschland',
                supplier_name: offer.supplier_name || '',
                supplier_id: offer.supplier_id || '',
                linked_event_id: offer.linked_event_id || '',
                positions: offer.positions || [],
                tax_rate: offer.tax_rate || 19,
                amount_net: offer.amount_net || 0,
                tax_amount: offer.tax_amount || 0,
                amount_gross: offer.amount_gross || 0,
                description: offer.description || '',
                notes: offer.notes || '',
                notes_public: !!offer.notes_public,
                offer_id: offer.id,
                offer_number: offer.offer_number,
                datev_account: DEFAULT_ACCOUNT[offer.category] || '8000',
                payment_status: 'offen',
                doc_status: 'Entwurf',
                service_date_type: 'Einzel',
            });
            await base44.entities.Offer.update(offer.id, {
                status: 'Rechnung erstellt',
                converted_invoice_id: invoice.id,
            });
            return invoice;
        },
        onSuccess: (inv) => {
            invalidate();
            toast.success(`Rechnung ${inv.invoice_number} erstellt — jetzt PDF erzeugen und senden`);
        },
        onError: (e) => toast.error('Konvertierung fehlgeschlagen: ' + e.message),
    });

    // ── Stornorechnung erzeugen (§14a Abs. 3 UStG) ──────────────────────────
    const stornoInvoice = useMutation({
        mutationFn: async (original) => {
            const stornoNumber = await nextNumber(invoices, 'invoice_number', 'ST');
            const storno = await base44.entities.DebitorInvoice.create({
                invoice_number: stornoNumber,
                invoice_date: today(),
                service_date: today(),
                due_date: today(),
                category: original.category,
                customer_name: original.customer_name || '',
                customer_address: original.customer_address || '',
                customer_street: original.customer_street || '',
                customer_postal_code: original.customer_postal_code || '',
                customer_city: original.customer_city || '',
                recipient_vat_id: original.recipient_vat_id || '',
                recipient_country: original.recipient_country || 'Deutschland',
                supplier_name: original.supplier_name || '',
                supplier_id: original.supplier_id || '',
                linked_event_id: original.linked_event_id || '',
                positions: (original.positions || []).map(p => ({
                    description: p.description || '',
                    quantity: Number(p.quantity) || 0,
                    unit_price: -(Number(p.unit_price) || 0),
                    total: -((Number(p.quantity) || 0) * (Number(p.unit_price) || 0)),
                })),
                tax_rate: original.tax_rate || 19,
                amount_net: -(original.amount_net || 0),
                tax_amount: -(original.tax_amount || 0),
                amount_gross: -(original.amount_gross || 0),
                description: `Stornorechnung zu ${original.invoice_number}`,
                notes: original.notes || '',
                notes_public: !!original.notes_public,
                storno_reference: original.invoice_number,
                datev_account: original.datev_account || DEFAULT_ACCOUNT[original.category],
                payment_status: 'bezahlt',
                paid_date: today(),
                paid_amount: -(original.amount_gross || 0),
                doc_status: 'Gesendet',
                service_date_type: 'Einzel',
            });
            await base44.entities.DebitorInvoice.update(original.id, {
                doc_status: 'Storniert',
            });
            return storno;
        },
        onSuccess: (storno) => {
            invalidate();
            toast.success(`Stornorechnung ${storno.invoice_number} erstellt — PDF herunterladen und an Empfänger senden.`);
        },
        onError: (e) => toast.error('Stornierung fehlgeschlagen: ' + e.message),
    });

    // ── Render ──────────────────────────────────────────────────────────────
    if (!permissions.canViewAccounting) {
        return <PermissionDenied message="Kein Zugriff auf Außenaufträge." />;
    }

    const invoiceActions = (r) => {
        if (r.doc_status === 'Storniert') return null;
        return (
            <div className="flex flex-wrap gap-1.5 justify-end">
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => downloadPdf('invoice', r, company)}>
                    <FileText className="w-3 h-3" /> PDF
                </Button>
                {r.doc_status === 'Entwurf' && (
                    <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => updateInvoice.mutate({ id: r.id, data: { doc_status: 'Gesendet' } })}>
                        <Send className="w-3 h-3" /> Gesendet
                    </Button>
                )}
                {r.payment_status !== 'bezahlt' && r.doc_status === 'Gesendet' && (
                    <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 text-emerald-600 hover:text-emerald-500 border-emerald-500/30" onClick={() => updateInvoice.mutate({ id: r.id, data: { payment_status: 'bezahlt', paid_date: today(), paid_amount: r.amount_gross } })}>
                        <CheckCircle2 className="w-3 h-3" /> Bezahlt
                    </Button>
                )}
                {r.doc_status !== 'Gesendet' && !r.storno_reference && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title="Stornorechnung erzeugen" onClick={() => { if (confirm(`Rechnung ${r.invoice_number} stornieren?\n\nEs wird eine Stornorechnung mit eigenem Nummernkreis (ST-…) erstellt und die Originalrechnung als storniert markiert.`)) stornoInvoice.mutate(r); }}>
                        <Ban className="w-3.5 h-3.5" />
                    </Button>
                )}
            </div>
        );
    };

    const offerActions = (r) => {
        if (['Rechnung erstellt', 'Abgelehnt'].includes(r.status)) return null;
        return (
            <div className="flex flex-wrap gap-1.5 justify-end">
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => downloadPdf('offer', r, company)}>
                    <FileText className="w-3 h-3" /> PDF
                </Button>
                {r.status === 'Entwurf' && (
                    <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => updateOffer.mutate({ id: r.id, data: { status: 'Gesendet' } })}>
                        <Send className="w-3 h-3" /> Gesendet
                    </Button>
                )}
                {r.status === 'Gesendet' && (
                    <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => { if (confirm('Rechnung aus diesem Angebot erstellen?')) convertOffer.mutate(r); }}>
                        <ArrowRightLeft className="w-3 h-3" /> Zur Rechnung
                    </Button>
                )}
                <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => updateOffer.mutate({ id: r.id, data: { status: 'Abgelehnt' } })}>
                    Abgelehnt
                </Button>
            </div>
        );
    };

    const list = tab === 'invoices' ? invoices : offers;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Außenaufträge</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Angebote & Rechnungen — externe Events, Werbekostenzuschüsse
                        </p>
                    </div>
                    <Button onClick={() => openNew(tab === 'invoices' ? 'invoice' : 'offer')} className="shrink-0">
                        <Plus className="w-4 h-4 mr-1.5" />
                        Neu
                    </Button>
                </div>

                {/* Kennzahlen */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-secondary/40 rounded-xl p-3">
                        <p className="text-lg font-bold text-foreground">{eur(openSum)} €</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Offene Rechnungen ({openInvoices.length})</p>
                    </div>
                    <div className="bg-secondary/40 rounded-xl p-3">
                        <p className="text-lg font-bold text-foreground">{openOfferList.length}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Offene Angebote</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex p-1 rounded-xl bg-secondary/50 border border-border/50">
                    {[
                        { key: 'invoices', label: `Rechnungen (${invoices.length})` },
                        { key: 'offers', label: `Angebote (${offers.length})` },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                                tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Liste */}
                {list.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <ReceiptText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Noch keine {tab === 'invoices' ? 'Rechnungen' : 'Angebote'}</p>
                        <p className="text-xs mt-1 opacity-70">Erstelle das erste mit „Neu"</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {list.map(r => {
                            const isInvoice = tab === 'invoices';
                            const number = isInvoice ? r.invoice_number : r.offer_number;
                            const recipient = r.category === CAT_WKZ ? (r.supplier_name || 'Lieferant') : (r.customer_name || 'Kunde');
                            const dateVal = r.invoice_date || r.offer_date;
                            const status = isInvoice
                                ? (r.doc_status === 'Storniert' ? 'Storniert' : (r.payment_status === 'bezahlt' ? 'bezahlt' : (r.doc_status === 'Gesendet' ? 'offen' : (r.doc_status || 'Entwurf'))))
                                : r.status;
                            return (
                                <div key={r.id} className={cn('rounded-xl border bg-card border-border/50 p-4 space-y-3',
                                    isInvoice && r.doc_status === 'Storniert' && 'opacity-60')}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">{number || '— ohne Nummer'}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                {recipient}{dateVal ? ` · ${format(parseISO(dateVal), 'dd.MM.yyyy', { locale: de })}` : ''}
                                            </p>
                                            {r.category === CAT_WKZ && (
                                                <span className="inline-block mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">WKZ</span>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold text-foreground">{eur(r.amount_gross)} €</p>
                                            <div className="mt-1"><StatusBadge status={status} /></div>
                                        </div>
                                    </div>
                                    {r.positions && r.positions.length > 0 && (
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {r.positions.map(p => p.description).filter(Boolean).join(' · ')}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
                                        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-muted-foreground" onClick={() => openEdit(isInvoice ? 'invoice' : 'offer', r)}>
                                            <Pencil className="w-3 h-3" /> Bearbeiten
                                        </Button>
                                        {isInvoice ? invoiceActions(r) : offerActions(r)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Formular-Dialog ──────────────────────────────────────────────── */}
            <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setRecord(null); } }}>
                <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {record?.id ? 'Bearbeiten' : 'Neu'}: {editing === 'invoice' ? 'Rechnung' : 'Angebot'}
                            {record?.id && record[editing === 'invoice' ? 'invoice_number' : 'offer_number'] && (
                                <span className="text-muted-foreground font-normal"> ({record[editing === 'invoice' ? 'invoice_number' : 'offer_number']})</span>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {record && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Kategorie */}
                            <div className="space-y-1.5">
                                <Label>Art</Label>
                                <Select value={record.category} onValueChange={(v) => setField('category', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={CAT_EVENT}>Externer Event (Bar-Service)</SelectItem>
                                        <SelectItem value={CAT_WKZ}>Werbekostenzuschuss (WKZ)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Empfänger */}
                            {record.category === CAT_WKZ ? (
                                <>
                                    <div className="space-y-1.5">
                                        <Label>Lieferant / Brauerei *</Label>
                                        <Select
                                            value={record.supplier_name || ''}
                                            onValueChange={(v) => {
                                                const sup = suppliers.find(s => s.name === v);
                                                setField('supplier_name', v);
                                                setField('supplier_id', sup?.id || '');
                                            }}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Lieferant wählen" /></SelectTrigger>
                                            <SelectContent>
                                                {suppliers.map(s => (
                                                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {suppliers.length === 0 && (
                                            <p className="text-[11px] text-muted-foreground">Keine Lieferanten angelegt — Name manuell unten bei Notizen hinterlegbar.</p>
                                        )}
                                    </div>
                                    <AddressFields record={record} setField={setField} />
                                    <RecipientExtraFields record={record} setField={setField} />
                                </>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        <Label>Kunde / Veranstalter *</Label>
                                        <Input value={record.customer_name || ''} onChange={(e) => setField('customer_name', e.target.value)} placeholder="z.B. WKZ, Stadtfest e.V." required />
                                    </div>
                                    <AddressFields record={record} setField={setField} />
                                    <RecipientExtraFields record={record} setField={setField} />
                                </>
                            )}

                            {/* Event-Bezug (optional) */}
                            <div className="space-y-1.5">
                                <Label>Event-Bezug (optional)</Label>
                                <Select
                                    value={record.linked_event_id || 'none'}
                                    onValueChange={(v) => setField('linked_event_id', v === 'none' ? '' : v)}
                                >
                                    <SelectTrigger><SelectValue placeholder="Ohne Event" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Ohne Event</SelectItem>
                                        {events.map(ev => (
                                            <SelectItem key={ev.id} value={ev.id}>
                                                {ev.title?.trim()} {ev.date ? `(${format(parseISO(ev.date), 'dd.MM.yyyy')})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Positionen — Kalkulation fuer Angebote, einfach fuer Rechnungen */}
                            {editing === 'offer' ? (
                                <OfferCalculation
                                    record={record}
                                    setField={setField}
                                    setPosition={setPosition}
                                    addPosition={addPosition}
                                    removePosition={removePosition}
                                />
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Positionen *</Label>
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={addPosition}>
                                            <Plus className="w-3 h-3 mr-1" /> Position
                                        </Button>
                                    </div>
                                    {record.positions.map((p, i) => (
                                        <div key={i} className="flex gap-1.5 items-start">
                                            <div className="flex-1 space-y-1.5">
                                                <Input
                                                    value={p.description}
                                                    onChange={(e) => setPosition(i, 'description', e.target.value)}
                                                    placeholder="z.B. Bar-Service 6h inkl. 2 Barkeeper"
                                                />
                                                <div className="flex gap-1.5">
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={p.quantity}
                                                        onChange={(e) => setPosition(i, 'quantity', e.target.value)}
                                                        placeholder="Soll"
                                                        className="w-20"
                                                        title="Soll-Menge (laut Angebot)"
                                                    />
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={p.actual_quantity ?? ''}
                                                        onChange={(e) => setPosition(i, 'actual_quantity', e.target.value)}
                                                        placeholder="Ist"
                                                        className="w-20"
                                                        title="Tatsächlich verbrauchte/gelieferte Menge"
                                                    />
                                                    <div className="relative flex-1">
                                                        <Euro className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={p.unit_price}
                                                            onChange={(e) => setPosition(i, 'unit_price', e.target.value)}
                                                            placeholder="Einzelpreis"
                                                            className="pl-7"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <Button type="button" variant="ghost" size="sm" className="w-7 h-7 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removePosition(i)}>
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Personal-Block (nur Rechnungen) — Arbeitsstunden × Stundensatz */}
                            {editing === 'invoice' && (
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2.5">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                                        <Users className="w-3.5 h-3.5" />
                                        PERSONAL VOR ORT
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Arbeitsstunden</Label>
                                            <Input
                                                type="number"
                                                step="0.25"
                                                value={record.staff_hours ?? ''}
                                                onChange={(e) => setField('staff_hours', e.target.value ? Number(e.target.value) : null)}
                                                placeholder="z.B. 12"
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Stundensatz (€/Std)</Label>
                                            <Input
                                                type="number"
                                                step="0.5"
                                                value={record.staff_hourly_rate ?? ''}
                                                onChange={(e) => setField('staff_hourly_rate', e.target.value ? Number(e.target.value) : null)}
                                                placeholder="z.B. 18"
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    </div>
                                    {(Number(record.staff_hours) || 0) > 0 && (Number(record.staff_hourly_rate) || 0) > 0 && (
                                        <p className="text-[11px] text-muted-foreground text-right">
                                            Personalkosten gesamt: <span className="font-semibold text-foreground">
                                                {eur((Number(record.staff_hours) || 0) * (Number(record.staff_hourly_rate) || 0))} €
                                            </span>
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Datum + Steuersatz */}
                            <div className="grid grid-cols-2 gap-3">
                                {editing === 'invoice' ? (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label>Rechnungsdatum *</Label>
                                            <Input type="date" value={record.invoice_date || ''} onChange={(e) => setField('invoice_date', e.target.value)} required />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Leistung</Label>
                                            <Select
                                                value={record.service_date_type || 'Einzel'}
                                                onValueChange={(v) => setField('service_date_type', v)}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Einzel">Einzelnes Datum</SelectItem>
                                                    <SelectItem value="Zeitraum">Zeitraum (von – bis)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>{record.service_date_type === 'Zeitraum' ? 'Leistung von' : 'Leistungsdatum'}</Label>
                                            <Input type="date" value={record.service_date || ''} onChange={(e) => setField('service_date', e.target.value)} />
                                        </div>
                                        {record.service_date_type === 'Zeitraum' && (
                                            <div className="space-y-1.5">
                                                <Label>Leistung bis</Label>
                                                <Input type="date" value={record.service_date_end || ''} onChange={(e) => setField('service_date_end', e.target.value)} />
                                            </div>
                                        )}
                                        <div className="space-y-1.5">
                                            <Label>Zahlbar bis</Label>
                                            <Input type="date" value={record.due_date || ''} onChange={(e) => setField('due_date', e.target.value)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>DATEV-Konto</Label>
                                            <Input value={record.datev_account || ''} onChange={(e) => setField('datev_account', e.target.value)} placeholder={DEFAULT_ACCOUNT[record.category]} />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label>Angebotsdatum *</Label>
                                            <Input type="date" value={record.offer_date || ''} onChange={(e) => setField('offer_date', e.target.value)} required />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Gültig bis</Label>
                                            <Input type="date" value={record.valid_until || ''} onChange={(e) => setField('valid_until', e.target.value)} />
                                        </div>
                                    </>
                                )}
                                <div className="space-y-1.5">
                                    <Label>Umsatzsteuer</Label>
                                    <Select value={String(record.tax_rate)} onValueChange={(v) => setField('tax_rate', Number(v))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="19">19 %</SelectItem>
                                            <SelectItem value="7">7 %</SelectItem>
                                            <SelectItem value="0">0 %</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Notizen */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label>Notizen</Label>
                                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={!!record.notes_public}
                                            onChange={(e) => setField('notes_public', e.target.checked)}
                                            className="w-3.5 h-3.5 rounded border-border accent-primary"
                                        />
                                        Auf PDF sichtbar
                                    </label>
                                </div>
                                <Input value={record.notes || ''} onChange={(e) => setField('notes', e.target.value)} placeholder="Absprachen, Ansprechpartner,…" />
                                {record.notes_public && (
                                    <p className="text-[10px] text-primary/80">Diese Notiz wird auf dem PDF für den Empfänger sichtbar.</p>
                                )}
                            </div>

                            {/* Summen */}
                            <div className="rounded-xl bg-secondary/40 border border-border/50 p-3.5 space-y-1 text-sm">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Netto</span><span>{eur(totals.net)} &euro;</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>USt {record.tax_rate} %</span><span>{eur(totals.vat)} &euro;</span>
                                </div>
                                <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/50">
                                    <span>Gesamt</span><span>{eur(totals.gross)} &euro;</span>
                                </div>
                                {editing === 'invoice' && totals.staffCost > 0 && (
                                    <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                                        <span>Personalkosten (intern)</span>
                                        <span>{eur(totals.staffCost)} &euro;</span>
                                    </div>
                                )}
                                {editing === 'offer' && totals.wareneinsatz > 0 && (
                                    <>
                                        <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                                            <span>Wareneinsatz (intern)</span>
                                            <span>{eur(totals.wareneinsatz)} &euro;</span>
                                        </div>
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-muted-foreground">Deckungsbeitrag</span>
                                            <span className={totals.db >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                                                {eur(totals.db)} &euro; ({(totals.marge * 100).toFixed(1)}%)
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex gap-2 pt-1">
                                <Button type="button" variant="outline" className="flex-1" onClick={() => { setEditing(null); setRecord(null); }}>
                                    Abbrechen
                                </Button>
                                <Button type="submit" className="flex-1" disabled={saveInvoice.isPending || saveOffer.isPending}>
                                    Speichern
                                </Button>
                            </div>
                            {record.id && (
                                <p className="text-[10px] text-muted-foreground text-center">
                                    Nummer {record[editing === 'invoice' ? 'invoice_number' : 'offer_number']} bleibt beim Bearbeiten erhalten.
                                </p>
                            )}
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}