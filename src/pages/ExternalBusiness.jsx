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
    ArrowRightLeft, Euro, X, ReceiptText
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CAT_EVENT = 'Externer Event';
const CAT_WKZ = 'Werbekostenzuschuss';
const DEFAULT_ACCOUNT = { [CAT_EVENT]: '8000', [CAT_WKZ]: '8035' };

const eur = n => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => format(new Date(), 'yyyy-MM-dd');

const emptyPosition = () => ({ description: '', quantity: 1, unit_price: 0 });

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

// ── PDF: Angebot/Rechnung mit §14-UStG-Pflichtangaben ────────────────────────
function downloadPdf(kind, data, company) {
    const doc = new jsPDF('p', 'mm', 'a4');
    const isInvoice = kind === 'invoice';
    const number = isInvoice ? data.invoice_number : data.offer_number;
    const recipient = isInvoice
        ? (data.category === CAT_WKZ ? data.supplier_name : data.customer_name)
        : (data.category === CAT_WKZ ? data.supplier_name : data.customer_name);
    const address = data.customer_address || '';

    // Kopf
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(company?.company_name || 'SAVO', 15, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const companyLines = [
        company?.owner_name ? `Inhaber: ${company.owner_name}` : null,
        [company?.street, [company?.postal_code, company?.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    ].filter(Boolean);
    companyLines.forEach((l, i) => doc.text(l, 15, 24 + i * 4.5));

    // Titel rechts
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(isInvoice ? 'RECHNUNG' : 'ANGEBOT', 195, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Nr. ${number}`, 195, 24, { align: 'right' });
    doc.text(`Datum: ${format(parseISO(isInvoice ? data.invoice_date : data.offer_date), 'dd.MM.yyyy')}`, 195, 29, { align: 'right' });
    if (isInvoice && data.service_date) {
        doc.text(`Leistungsdatum: ${format(parseISO(data.service_date), 'dd.MM.yyyy')}`, 195, 34, { align: 'right' });
    }

    // Empfänger
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(recipient || 'Empfänger', 15, 48);
    doc.setFont('helvetica', 'normal');
    address.split('\n').slice(0, 4).forEach((l, i) => doc.text(l, 15, 54 + i * 5));

    // Kategorie
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Betreff: ${data.category === CAT_WKZ ? 'Werbekostenzuschuss' : 'Bar-Service / Außengeschäft'}`, 15, 78);
    doc.setTextColor(0);

    // Positionen
    let y = 88;
    doc.setFillColor(245, 245, 245);
    doc.rect(15, y, 180, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Pos', 17, y + 5.5);
    doc.text('Beschreibung', 26, y + 5.5);
    doc.text('Anz.', 138, y + 5.5, { align: 'right' });
    doc.text('Preis', 158, y + 5.5, { align: 'right' });
    doc.text('Summe', 193, y + 5.5, { align: 'right' });
    y += 8;
    doc.setFont('helvetica', 'normal');
    (data.positions || []).forEach((p, idx) => {
        if (y > 245) { doc.addPage(); y = 20; }
        const rowH = 6;
        doc.text(String(idx + 1), 17, y + 5);
        doc.text(String(p.description || '').slice(0, 60), 26, y + 5);
        doc.text(String(p.quantity ?? 1), 138, y + 5, { align: 'right' });
        doc.text(eur(p.unit_price), 158, y + 5, { align: 'right' });
        doc.text(eur(p.total ?? (p.quantity * p.unit_price)), 193, y + 5, { align: 'right' });
        y += rowH;
        doc.setDrawColor(230);
        doc.line(15, y, 195, y);
        y += 2;
    });

    // Summen
    y += 4;
    doc.text('Netto', 150, y, { align: 'right' });
    doc.text(`${eur(data.amount_net)} EUR`, 193, y, { align: 'right' });
    y += 6;
    doc.text(`USt ${data.tax_rate ?? 19}%`, 150, y, { align: 'right' });
    doc.text(`${eur(data.tax_amount)} EUR`, 193, y, { align: 'right' });
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(isInvoice ? 'Gesamtbetrag' : 'Gesamt (brutto)', 150, y, { align: 'right' });
    doc.text(`${eur(data.amount_gross)} EUR`, 193, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // Footer
    const footerY = Math.max(y + 14, 258);
    if (!isInvoice && data.valid_until) {
        doc.text(`Freibleibendes Angebot, gültig bis ${format(parseISO(data.valid_until), 'dd.MM.yyyy')}.`, 15, footerY);
    }
    if (isInvoice && data.due_date) {
        doc.text(`Zahlbar bis ${format(parseISO(data.due_date), 'dd.MM.yyyy')} ohne Abzug.`, 15, footerY);
    }
    const footer = [
        company?.tax_id ? `Steuernummer: ${company.tax_id}` : null,
        company?.vat_id ? `USt-IdNr.: ${company.vat_id}` : null,
        company?.iban ? `IBAN: ${company.iban}${company.bank_name ? ` (${company.bank_name})` : ''}` : null,
    ].filter(Boolean);
    footer.forEach((l, i) => doc.text(l, 15, footerY + 6 + i * 4.5));

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
            supplier_name: '',
            supplier_id: '',
            linked_event_id: '',
            positions: [emptyPosition()],
            tax_rate: 19,
            description: '',
            notes: '',
            ...(isInvoice
                ? { invoice_date: today(), service_date: today(), due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'), datev_account: DEFAULT_ACCOUNT[cat] }
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
        const net = (record?.positions || []).reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0), 0);
        const rate = Number(record?.tax_rate) || 0;
        const vat = net * rate / 100;
        return { net, vat, gross: net + vat };
    }, [record]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isInvoice = editing === 'invoice';
        const positions = record.positions
            .filter(p => p.description?.trim())
            .map(p => ({ ...p, quantity: Number(p.quantity) || 0, unit_price: Number(p.unit_price) || 0, total: (Number(p.quantity) || 0) * (Number(p.unit_price) || 0) }));
        if (!positions.length) { toast.error('Mindestens eine Position mit Beschreibung nötig'); return; }
        const data = {
            category: record.category,
            positions,
            tax_rate: Number(record.tax_rate) || 0,
            amount_net: totals.net,
            tax_amount: totals.vat,
            amount_gross: totals.gross,
            customer_name: record.category === CAT_WKZ ? (record.customer_name || '') : record.customer_name,
            customer_address: record.customer_address || '',
            supplier_name: record.supplier_name || '',
            supplier_id: record.supplier_id || '',
            linked_event_id: record.linked_event_id || '',
            description: record.description || '',
            notes: record.notes || '',
        };
        if (isInvoice) {
            Object.assign(data, {
                invoice_date: record.invoice_date,
                service_date: record.service_date || record.invoice_date,
                due_date: record.due_date,
                datev_account: record.datev_account || DEFAULT_ACCOUNT[record.category],
                payment_status: record.payment_status || 'offen',
                doc_status: record.doc_status || 'Entwurf',
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
                offer_id: offer.id,
                offer_number: offer.offer_number,
                datev_account: DEFAULT_ACCOUNT[offer.category] || '8000',
                payment_status: 'offen',
                doc_status: 'Entwurf',
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
                {r.doc_status !== 'Gesendet' && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => { if (confirm(`Rechnung ${r.invoice_number} stornieren?`)) updateInvoice.mutate({ id: r.id, data: { doc_status: 'Storniert' } }); }}>
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
                                    <div className="space-y-1.5">
                                        <Label>Anschrift (für PDF)</Label>
                                        <Input value={record.customer_address || ''} onChange={(e) => setField('customer_address', e.target.value)} placeholder="Straße, PLZ Ort" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        <Label>Kunde / Veranstalter *</Label>
                                        <Input value={record.customer_name || ''} onChange={(e) => setField('customer_name', e.target.value)} placeholder="z.B. WKZ, Stadtfest e.V." required />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Anschrift</Label>
                                        <Input value={record.customer_address || ''} onChange={(e) => setField('customer_address', e.target.value)} placeholder="Straße, PLZ Ort" />
                                    </div>
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

                            {/* Positionen */}
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
                                                    placeholder="Anz."
                                                    className="w-20"
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

                            {/* Datum + Steuersatz */}
                            <div className="grid grid-cols-2 gap-3">
                                {editing === 'invoice' ? (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label>Rechnungsdatum *</Label>
                                            <Input type="date" value={record.invoice_date || ''} onChange={(e) => setField('invoice_date', e.target.value)} required />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Leistungsdatum</Label>
                                            <Input type="date" value={record.service_date || ''} onChange={(e) => setField('service_date', e.target.value)} />
                                        </div>
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
                                <Label>Notizen (intern)</Label>
                                <Input value={record.notes || ''} onChange={(e) => setField('notes', e.target.value)} placeholder="Absprachen, Ansprechpartner,…" />
                            </div>

                            {/* Summen */}
                            <div className="rounded-xl bg-secondary/40 border border-border/50 p-3.5 space-y-1 text-sm">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Netto</span><span>{eur(totals.net)} €</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>USt {record.tax_rate} %</span><span>{eur(totals.vat)} €</span>
                                </div>
                                <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/50">
                                    <span>Gesamt</span><span>{eur(totals.gross)} €</span>
                                </div>
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
