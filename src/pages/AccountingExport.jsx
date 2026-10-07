/**
 * DATEV-Export — Monatsexport für den Steuerberater
 *
 * v2 Verbesserungen:
 *  - Kassenbuch-Einträge (CashbookEntry) werden mit exportiert
 *  - Vollständigkeitsprüfung vor Export (fehlende Beträge, fehlende Bilder)
 *  - DATEV-Nummern aufklappbar (nicht mehr prominent)
 *  - Klarere, weniger technische Beschreibung
 *  - Kein redundanter "Neuer Export"-Button
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Button } from '@/components/ui/button';
import {
    Download, FileText, Archive, CheckCircle2,
    ChevronLeft, ChevronRight, AlertTriangle,
    ChevronDown, BookOpen, Receipt, Package, FileJson
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import AtlasExportSection from '@/components/accounting/AtlasExport';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = n => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function MonthNav({ value, onChange }) {
    const date = new Date(value + '-01');
    const isCurrentMonth = value === format(new Date(), 'yyyy-MM');
    return (
        <div className="flex items-center gap-2">
            <button onClick={() => onChange(format(subMonths(date, 1), 'yyyy-MM'))}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-base font-bold text-foreground min-w-[130px] text-center">
                {format(date, 'MMMM yyyy', { locale: de })}
            </span>
            <button onClick={() => onChange(format(addMonths(date, 1), 'yyyy-MM'))}
                disabled={isCurrentMonth}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

// ── DATEV EXTF Buchungsstapel ─────────────────────────────────────────────────
function buildDATEVCsv(receipts, cashbookEntries, invoices, month, beraterNr, mandantenNr) {
    const now = new Date();
    const ts  = format(now, 'yyyyMMddHHmmssSSS');
    const [y, m] = month.split('-');
    const wjBeginn   = `${y}0101`;
    const lastDay    = new Date(Number(y), Number(m), 0).getDate();
    const sachkonto  = '1200'; // Bank/Kasse SKR03

    const header = [
        '"EXTF"', '700', '21', '"Buchungsstapel"', '13', ts, '', '"RE"', '', '',
        beraterNr || '0', mandantenNr || '0',
        wjBeginn, '4',
        `${y}${m}01`, `${y}${m}${lastDay}`,
        '"BarShift Pro"', '', '1', '0', '0', 'EUR', '', '', '', '', '', '',
    ].join(';');

    const cols = [
        'Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'WKZ Umsatz',
        'Kurs', 'Basis-Umsatz', 'WKZ Basis-Umsatz', 'Konto',
        'Gegenkonto (ohne BU-Schlüssel)', 'BU-Schlüssel', 'Belegdatum',
        'Belegfeld 1', 'Belegfeld 2', 'Skonto', 'Buchungstext',
    ].join(';');

    const buKey = rate => rate === 19 ? '9' : rate === 7 ? '8' : '';

    // Belege → Ausgaben (Soll-Buchungen auf Aufwandskonto)
    const receiptRows = receipts.map(r => {
        const betrag = (r.amount_gross || 0).toFixed(2).replace('.', ',');
        const datum  = r.receipt_date ? format(new Date(r.receipt_date), 'ddMM') : '';
        const konto  = r.datev_account || '4990';
        const bu     = buKey(r.tax_rate ?? 19);
        const text   = `"${[r.supplier_name, r.category].filter(Boolean).join(' / ')}"`;
        const fields = Array(14).fill('');
        fields[0]  = betrag;
        fields[1]  = 'S';
        fields[2]  = 'EUR';
        fields[6]  = konto;
        fields[7]  = sachkonto;
        fields[8]  = bu;
        fields[9]  = datum;
        fields[10] = r.receipt_number || r.id?.slice(0, 12) || '';
        fields[13] = text;
        return fields.join(';');
    });

    // Kassenbuch-Einträge → Einnahmen (Haben) und Ausgaben (Soll)
    const cashRows = cashbookEntries.map(e => {
        const isIncome = ['Einnahme', 'Privateinlage', 'Trinkgeld'].includes(e.entry_type);
        const betrag   = (e.amount || 0).toFixed(2).replace('.', ',');
        const datum    = e.date ? format(new Date(e.date), 'ddMM') : '';
        const bu       = buKey(e.tax_rate ?? 0);
        // Einnahmen → Erlöskonto 8000, Ausgaben → 4990 fallback
        const konto    = isIncome ? '8000' : (e.category === 'Personal' ? '4100' : '4990');
        const shKz     = isIncome ? 'H' : 'S';
        const text     = `"${[e.description, e.category, e.entry_type].filter(Boolean).join(' / ')}"`;
        const fields   = Array(14).fill('');
        fields[0]  = betrag;
        fields[1]  = shKz;
        fields[2]  = 'EUR';
        fields[6]  = konto;
        fields[7]  = sachkonto;
        fields[8]  = bu;
        fields[9]  = datum;
        fields[10] = e.id?.slice(0, 12) || '';
        fields[13] = text;
        return fields.join(';');
    });

    // Ausgangsrechnungen (Außenaufträge) → Erlöse (Haben-Buchungen)
    const invoiceRows = invoices.map(r => {
        const betrag = (r.amount_gross || 0).toFixed(2).replace('.', ',');
        const datum  = r.invoice_date ? format(new Date(r.invoice_date), 'ddMM') : '';
        const bu     = buKey(r.tax_rate ?? 19);
        const konto  = r.datev_account || (r.category === 'Werbekostenzuschuss' ? '8035' : '8000');
        const text   = `"${[r.category, r.customer_name || r.supplier_name, r.invoice_number].filter(Boolean).join(' / ')}"`;
        const fields = Array(14).fill('');
        fields[0]  = betrag;
        fields[1]  = 'H';
        fields[2]  = 'EUR';
        fields[6]  = konto;
        fields[7]  = sachkonto;
        fields[8]  = bu;
        fields[9]  = datum;
        fields[10] = r.invoice_number || '';
        fields[13] = text;
        return fields.join(';');
    });

    return [header, cols, ...receiptRows, ...cashRows, ...invoiceRows].join('\r\n');
}

function downloadFile(content, filename, mime) {
    const bom  = mime.includes('csv') ? '\uFEFF' : '';
    const blob = new Blob([bom + content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ── Hauptseite ────────────────────────────────────────────────────────────────
export default function AccountingExport() {
    const permissions = usePermissions();
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [exporting,     setExporting]     = useState(false);
    const [showAdvanced,  setShowAdvanced]  = useState(false);
    const [beraterNr,     setBeraterNr]     = useState('');
    const [mandantenNr,   setMandantenNr]   = useState('');

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: receipts = [] } = useQuery({
        queryKey: ['accounting-receipts'],
        queryFn:  () => base44.entities.AccountingReceipt.list('-receipt_date', 500),
        staleTime: STALE.MEDIUM,
    });

    const { data: cashbookEntries = [] } = useQuery({
        queryKey: ['cashbook-entries'],
        queryFn:  () => base44.entities.CashbookEntry.list('-date', 500),
        staleTime: STALE.MEDIUM,
    });

    const { data: debitorInvoices = [] } = useQuery({
        queryKey: ['external-invoices'],
        queryFn:  () => base44.entities.DebitorInvoice.list('-invoice_date', 500),
        staleTime: STALE.MEDIUM,
    });

    // ── Filter auf gewählten Monat ────────────────────────────────────────────
    const monthReceipts = useMemo(() =>
        receipts.filter(r => r.receipt_date?.startsWith(selectedMonth)),
        [receipts, selectedMonth]
    );

    const monthCashbook = useMemo(() =>
        cashbookEntries.filter(e => e.date?.startsWith(selectedMonth)),
        [cashbookEntries, selectedMonth]
    );

    // Nur gesendete, nicht stornierte Rechnungen zählen als Umsatz
    const monthInvoices = useMemo(() =>
        debitorInvoices.filter(r => r.invoice_date?.startsWith(selectedMonth) && r.doc_status === 'Gesendet'),
        [debitorInvoices, selectedMonth]
    );

    // ── Vollständigkeitsprüfung ───────────────────────────────────────────────
    const checks = useMemo(() => {
        const missingAmount  = monthReceipts.filter(r => !r.amount_gross || r.amount_gross === 0);
        const missingImage   = monthReceipts.filter(r => !r.file_url);
        const missingCat     = monthReceipts.filter(r => !r.category);
        return { missingAmount, missingImage, missingCat };
    }, [monthReceipts]);

    const hasErrors   = checks.missingAmount.length > 0;
    const hasWarnings = checks.missingImage.length > 0 || checks.missingCat.length > 0;

    // ── Summen ────────────────────────────────────────────────────────────────
    const totalReceipts  = monthReceipts.reduce((s, r) => s + (r.amount_gross || 0), 0);
    const totalCashbook  = monthCashbook.reduce((s, e) => s + (e.amount || 0), 0);
    const totalInvoices = monthInvoices.reduce((s, r) => s + (r.amount_gross || 0), 0);
    const totalEntries   = monthReceipts.length + monthCashbook.length + monthInvoices.length;
    const withImage      = monthReceipts.filter(r => r.file_url).length;

    const [y, m]     = selectedMonth.split('-');
    const monthLabel = format(new Date(Number(y), Number(m) - 1, 1), 'MMMM yyyy', { locale: de });

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExport = async () => {
        if (totalEntries === 0) {
            toast.error('Keine Buchungen im gewählten Monat');
            return;
        }
        setExporting(true);
        try {
            // 1. DATEV CSV (Belege + Kassenbuch)
            const csv = buildDATEVCsv(monthReceipts, monthCashbook, monthInvoices, selectedMonth, beraterNr, mandantenNr);
            downloadFile(csv, `EXTF_Buchungsstapel_${selectedMonth}.csv`, 'text/csv;charset=utf-8');

            // 2. Belege als ZIP (nur wenn Bilder vorhanden)
            if (withImage > 0) {
                try {
                    const JSZip = (await import('jszip')).default;
                    const zip   = new JSZip();
                    const folder = zip.folder(`Belege_${selectedMonth}`);
                    const withFiles = monthReceipts.filter(r => r.file_url);

                    await Promise.all(withFiles.map(async r => {
                        try {
                            const resp = await fetch(r.file_url);
                            const blob = await resp.blob();
                            const ext  = r.file_url.split('.').pop()?.split('?')[0] || 'jpg';
                            const name = `${r.receipt_date || 'unbekannt'}_${r.supplier_name || r.id}_${r.id.slice(-4)}.${ext}`;
                            folder.file(name.replace(/[/\\?%*:|"<>]/g, '-'), blob);
                        } catch { /* einzelne Datei überspringen */ }
                    }));

                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    const url = URL.createObjectURL(zipBlob);
                    const a   = document.createElement('a');
                    a.href = url; a.download = `Belege_${selectedMonth}.zip`; a.click();
                    URL.revokeObjectURL(url);
                } catch {
                    toast.error('ZIP-Export fehlgeschlagen — CSV wurde trotzdem erstellt');
                }
            }

            toast.success(`${monthLabel} erfolgreich exportiert`);
        } catch (err) {
            toast.error('Export fehlgeschlagen: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    if (!permissions.canViewAccounting) {
        return <PermissionDenied message="Kein Zugriff auf den Export." />;
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div>
                    <h1 className="text-xl font-bold text-foreground">DATEV-Export</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Buchungsstapel + Belege für den Steuerberater
                    </p>
                </div>

                {/* ── Monatsauswahl ────────────────────────────────────────── */}
                <MonthNav value={selectedMonth} onChange={setSelectedMonth} />

                {/* ── Monats-Übersicht ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-secondary/40 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-foreground">{monthReceipts.length}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Belege</p>
                    </div>
                    <div className="bg-secondary/40 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-foreground">{monthCashbook.length}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Kassenbuch</p>
                    </div>
                    <div className="bg-secondary/40 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-foreground">{monthInvoices.length}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Rechnungen</p>
                    </div>
                    <div className="bg-secondary/40 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-foreground">{fmt(totalReceipts + totalCashbook + totalInvoices)} €</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Gesamt</p>
                    </div>
                </div>

                {/* ── Vollständigkeitsprüfung ──────────────────────────────── */}
                {(hasErrors || hasWarnings) && (
                    <div className="space-y-2">
                        {checks.missingAmount.length > 0 && (
                            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-500/8 border border-red-500/25 text-red-400">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p className="text-xs font-semibold">
                                    {checks.missingAmount.length} Beleg{checks.missingAmount.length > 1 ? 'e' : ''} ohne Betrag — bitte vor dem Export ergänzen
                                </p>
                            </div>
                        )}
                        {checks.missingImage.length > 0 && (
                            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/8 border border-amber-500/25 text-amber-400">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p className="text-xs font-semibold">
                                    {checks.missingImage.length} Beleg{checks.missingImage.length > 1 ? 'e' : ''} ohne Bild — wird trotzdem exportiert, aber kein ZIP-Anhang
                                </p>
                            </div>
                        )}
                        {checks.missingCat.length > 0 && (
                            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/8 border border-amber-500/25 text-amber-400">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p className="text-xs font-semibold">
                                    {checks.missingCat.length} Beleg{checks.missingCat.length > 1 ? 'e' : ''} ohne Kategorie — Sachkonto wird als 4990 (Sonstiges) exportiert
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Was wird exportiert ──────────────────────────────────── */}
                <div className="space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-0.5">
                        Dein Steuerberater bekommt
                    </p>

                    <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border/50 bg-card">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">Buchungsstapel (CSV)</p>
                            <p className="text-xs text-muted-foreground">
                                {totalEntries} Buchungssätze · DATEV-Format · direkt importierbar
                            </p>
                        </div>
                        {totalEntries > 0
                            ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                            : <span className="text-xs text-muted-foreground shrink-0">leer</span>
                        }
                    </div>

                    <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border/50 bg-card">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Archive className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">Belegbilder (ZIP)</p>
                            <p className="text-xs text-muted-foreground">
                                {withImage > 0
                                    ? `${withImage} Belegbilder · via DATEV Belegtransfer hochladen`
                                    : 'Keine Bilder vorhanden'
                                }
                            </p>
                        </div>
                        {withImage > 0
                            ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                            : <Receipt className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                        }
                    </div>
                </div>

                {/* ── Erweitert (DATEV-Nummern) ────────────────────────────── */}
                <div className="border border-border/50 rounded-xl overflow-hidden">
                    <button onClick={() => setShowAdvanced(s => !s)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-accent/20 transition-all">
                        <span className="text-sm font-semibold text-foreground">Erweitert — DATEV-Nummern</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">optional</span>
                            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', showAdvanced && 'rotate-180')} />
                        </div>
                    </button>
                    {showAdvanced && (
                        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/40 bg-card">
                            <p className="text-xs text-muted-foreground">
                                Vom Steuerberater mitgeteilt. Ohne Angabe wird 0 verwendet — kann beim Import korrigiert werden.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs text-muted-foreground">Beraternummer</label>
                                    <input value={beraterNr} onChange={e => setBeraterNr(e.target.value)}
                                        placeholder="z.B. 12345"
                                        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs text-muted-foreground">Mandantennummer</label>
                                    <input value={mandantenNr} onChange={e => setMandantenNr(e.target.value)}
                                        placeholder="z.B. 1001"
                                        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Export-Button ────────────────────────────────────────── */}
                <Button
                    onClick={handleExport}
                    disabled={exporting || totalEntries === 0 || hasErrors}
                    className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-bold text-base gap-2 disabled:opacity-50">
                    {exporting ? (
                        <>
                            <Package className="w-5 h-5 animate-pulse" />
                            Wird exportiert…
                        </>
                    ) : (
                        <>
                            <Download className="w-5 h-5" />
                            {monthLabel} exportieren
                        </>
                    )}
                </Button>

                {hasErrors && (
                    <p className="text-center text-xs text-red-400">
                        Bitte erst Belege ohne Betrag korrigieren
                    </p>
                )}
                {totalEntries === 0 && !hasErrors && (
                    <p className="text-center text-xs text-muted-foreground">
                        Keine Buchungen im gewählten Monat
                    </p>
                )}

                {/* ── Atlas Export (JSON für Controlling-App) ─────────────────── */}
                <details className="border border-border/50 rounded-xl overflow-hidden">
                    <summary className="px-4 py-3 bg-card hover:bg-accent/20 cursor-pointer text-sm font-semibold text-foreground list-none flex items-center gap-2">
                        <FileJson className="w-4 h-4 text-primary" />
                        Atlas Export — operative Daten als JSON
                    </summary>
                    <div className="p-4 bg-card border-t border-border/40">
                        <AtlasExportSection base44={base44} />
                    </div>
                </details>

            </div>
        </div>
    );
}