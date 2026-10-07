/**
 * Belege — Belegerfassung für DATEV-Vorbereitung
 *
 * v2 Verbesserungen:
 *  - Einziger „+ Beleg" Button → Bottom-Sheet mit Foto / Datei / Manuell
 *  - Suche nur bei Bedarf (Icon-Button)
 *  - Kategorie-Filter als Chips
 *  - Karten ohne MwSt-Detail — nur Betrag + Lieferant + Datum
 *  - Visuelles Signal bei fehlendem Bild
 */
import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Camera, Upload, Sparkles, Receipt, Trash2, ExternalLink,
    Plus, Search, X, ChevronLeft, ChevronRight, ImageOff, Pencil
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Konstanten ────────────────────────────────────────────────────────────────
const TAX_RATES = ['0', '7', '19'];
const CATEGORIES = [
    'Getränke', 'Lebensmittel', 'Reinigung', 'Personal',
    'Miete', 'Energie', 'GEMA', 'Versicherung', 'Software',
    'Bewirtung', 'Büro', 'Marketing', 'Sonstiges',
];
const CATEGORY_ACCOUNT = {
    'Getränke': '3400', 'Lebensmittel': '3200', 'Reinigung': '4140',
    'Personal': '4100', 'Miete': '4210', 'Energie': '4240',
    'GEMA': '4990', 'Versicherung': '4360', 'Software': '4980',
    'Bewirtung': '4650', 'Büro': '4930', 'Marketing': '4600', 'Sonstiges': '4990',
};
const fmt = n => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Monatsnavigation ──────────────────────────────────────────────────────────
function MonthNav({ value, onChange }) {
    const date = new Date(value + '-01');
    return (
        <div className="flex items-center gap-1.5">
            <button onClick={() => onChange(format(subMonths(date, 1), 'yyyy-MM'))}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-foreground min-w-[110px] text-center">
                {format(date, 'MMMM yyyy', { locale: de })}
            </span>
            <button onClick={() => onChange(format(addMonths(date, 1), 'yyyy-MM'))}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

// ── Beleg-Formular ────────────────────────────────────────────────────────────
function ReceiptForm({ data, onChange }) {
    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Lieferant / Absender *</Label>
                <Input value={data.supplier_name || ''}
                    onChange={e => onChange({ ...data, supplier_name: e.target.value })}
                    placeholder="z.B. Metro, Edeka, Stadtwerke…" className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Datum *</Label>
                    <Input type="date" value={data.receipt_date || ''}
                        onChange={e => onChange({ ...data, receipt_date: e.target.value })}
                        className="h-10" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Brutto (€) *</Label>
                    <Input type="number" step="0.01" value={data.amount_gross || ''}
                        onChange={e => onChange({ ...data, amount_gross: parseFloat(e.target.value) || '' })}
                        placeholder="0,00" className="h-10" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">MwSt.</Label>
                    <Select value={String(data.tax_rate ?? 19)}
                        onValueChange={v => onChange({ ...data, tax_rate: Number(v) })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {TAX_RATES.map(r => <SelectItem key={r} value={r}>{r}%</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Kategorie</Label>
                    <Select value={data.category || ''}
                        onValueChange={v => onChange({ ...data, category: v })}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Wählen…" /></SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}

// ── Beleg-Karte ───────────────────────────────────────────────────────────────
function ReceiptCard({ receipt, onEdit, onDelete }) {
    const hasImage = !!receipt.file_url;
    const isImage  = hasImage && !receipt.file_url.endsWith('.pdf');

    return (
        <div onClick={onEdit}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-card hover:border-border cursor-pointer transition-all group min-h-[58px]">

            {/* Bild-Thumbnail */}
            <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border',
                hasImage ? 'border-border/40 bg-secondary/30' : 'border-dashed border-border/60 bg-secondary/20'
            )}>
                {isImage
                    ? <img src={receipt.file_url} alt="" className="w-full h-full object-cover" />
                    : hasImage
                        ? <Receipt className="w-4 h-4 text-blue-400" />
                        : <ImageOff className="w-3.5 h-3.5 text-muted-foreground/40" />
                }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                    {receipt.supplier_name || 'Unbekannt'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                    {receipt.receipt_date ? format(new Date(receipt.receipt_date), 'dd.MM.yyyy') : '—'}
                    {receipt.category && ` · ${receipt.category}`}
                    {!hasImage && (
                        <span className="ml-1.5 text-amber-400/80 font-medium">· kein Bild</span>
                    )}
                </p>
            </div>

            {/* Externer Link bei PDF */}
            {receipt.file_url?.endsWith('.pdf') && (
                <a href={receipt.file_url} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-blue-400/60 hover:text-blue-400 p-1 shrink-0 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                </a>
            )}

            {/* Betrag */}
            <div className="text-right shrink-0">
                <p className="text-sm font-bold text-foreground">{fmt(receipt.amount_gross)} €</p>
                <p className="text-[10px] text-muted-foreground">{receipt.tax_rate ?? 19}% MwSt.</p>
            </div>

            {/* Löschen */}
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
                className="opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 min-w-[28px] min-h-[28px] flex items-center justify-center shrink-0">
                <Trash2 className="w-3 h-3" />
            </button>
        </div>
    );
}

// ── Upload-Auswahl Sheet ──────────────────────────────────────────────────────
function UploadSheet({ open, onClose, onFile, onManual }) {
    const cameraRef = useRef();
    const fileRef   = useRef();

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="sm:max-w-xs">
                <DialogHeader>
                    <DialogTitle>Beleg hinzufügen</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 py-2">
                    {/* Foto */}
                    <label className="cursor-pointer">
                        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border hover:bg-accent/30 transition-all min-h-[56px]">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                                <Camera className="w-4.5 h-4.5 text-amber-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Foto aufnehmen</p>
                                <p className="text-xs text-muted-foreground">Kamera öffnen · KI liest automatisch aus</p>
                            </div>
                        </div>
                        <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                            onChange={e => { onClose(); onFile(e.target.files?.[0]); }}
                            className="hidden" />
                    </label>

                    {/* Datei */}
                    <label className="cursor-pointer">
                        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border hover:bg-accent/30 transition-all min-h-[56px]">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                                <Upload className="w-4.5 h-4.5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Datei hochladen</p>
                                <p className="text-xs text-muted-foreground">Bild oder PDF · KI liest automatisch aus</p>
                            </div>
                        </div>
                        <input ref={fileRef} type="file" accept="image/*,application/pdf"
                            onChange={e => { onClose(); onFile(e.target.files?.[0]); }}
                            className="hidden" />
                    </label>

                    {/* Manuell */}
                    <button onClick={() => { onClose(); onManual(); }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border hover:bg-accent/30 transition-all min-h-[56px]">
                        <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-semibold text-foreground">Manuell eingeben</p>
                            <p className="text-xs text-muted-foreground">Ohne Bild — Daten direkt eintippen</p>
                        </div>
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Hauptseite ────────────────────────────────────────────────────────────────
export default function AccountingReceipts() {
    const permissions  = usePermissions();
    const queryClient  = useQueryClient();

    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [catFilter,     setCatFilter]     = useState('alle');
    const [searchOpen,    setSearchOpen]    = useState(false);
    const [search,        setSearch]        = useState('');
    const [sheetOpen,     setSheetOpen]     = useState(false);
    const [uploadOpen,    setUploadOpen]    = useState(false);
    const [editOpen,      setEditOpen]      = useState(false);
    const [deleteTarget,  setDeleteTarget]  = useState(null);
    const [selected,      setSelected]      = useState(null);
    const [editData,      setEditData]      = useState({});
    const [uploading,     setUploading]     = useState(false);
    const [aiProcessing,  setAiProcessing]  = useState(false);
    const [previewUrl,    setPreviewUrl]    = useState(null);

    // ── Query ─────────────────────────────────────────────────────────────────
    const { data: receipts = [] } = useQuery({
        queryKey: ['accounting-receipts'],
        queryFn:  () => base44.entities.AccountingReceipt.list('-receipt_date', 500),
        staleTime: STALE.MEDIUM,
    });

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: d => base44.entities.AccountingReceipt.create(d),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting-receipts'] });
            setUploadOpen(false);
            setEditData({});
            setPreviewUrl(null);
            toast.success('Beleg gespeichert');
        },
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.AccountingReceipt.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting-receipts'] });
            setEditOpen(false);
            toast.success('Beleg aktualisiert');
        },
        onError: () => toast.error('Fehler beim Aktualisieren'),
    });

    const deleteMutation = useMutation({
        mutationFn: id => base44.entities.AccountingReceipt.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting-receipts'] });
            setDeleteTarget(null);
            setEditOpen(false);
            toast.success('Beleg gelöscht');
        },
        onError: () => toast.error('Fehler beim Löschen'),
    });

    // ── Filter ────────────────────────────────────────────────────────────────
    const monthReceipts = useMemo(() =>
        receipts.filter(r => r.receipt_date?.startsWith(selectedMonth)),
        [receipts, selectedMonth]
    );

    const filtered = useMemo(() => {
        let list = monthReceipts;
        if (catFilter !== 'alle') {
            if (catFilter === 'kein_bild') list = list.filter(r => !r.file_url);
            else list = list.filter(r => r.category === catFilter);
        }
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(r =>
                r.supplier_name?.toLowerCase().includes(q) ||
                r.category?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [monthReceipts, catFilter, search]);

    const totalGross = filtered.reduce((s, r) => s + (r.amount_gross || 0), 0);
    const missingImages = monthReceipts.filter(r => !r.file_url).length;

    // Kategorien die diesen Monat vorkommen
    const activeCategories = useMemo(() => {
        const cats = [...new Set(monthReceipts.map(r => r.category).filter(Boolean))];
        return cats.sort();
    }, [monthReceipts]);

    // ── Datei-Upload + KI ─────────────────────────────────────────────────────
    const handleFileUpload = async file => {
        if (!file) return;
        setUploading(true);
        setUploadOpen(true);
        setEditData({ receipt_date: format(new Date(), 'yyyy-MM-dd'), tax_rate: 19 });

        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            setPreviewUrl(file_url);
            setUploading(false);
            setAiProcessing(true);

            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Du bist ein Buchhalter. Analysiere diesen Beleg und extrahiere:
- supplier_name: Firmenname des Ausstellers
- receipt_date: Datum im Format YYYY-MM-DD
- amount_gross: Bruttobetrag als Zahl
- tax_rate: Steuersatz (0, 7 oder 19)
- category: Eine aus: ${CATEGORIES.join(', ')}
Antworte NUR mit validem JSON.`,
                image_urls: [file_url],
                response_json_schema: {
                    type: 'object',
                    properties: {
                        supplier_name: { type: 'string' },
                        receipt_date:  { type: 'string' },
                        amount_gross:  { type: 'number' },
                        tax_rate:      { type: 'number' },
                        category:      { type: 'string' },
                    }
                }
            });

            setEditData({ ...result, file_url, status: 'freigegeben', datev_account: CATEGORY_ACCOUNT[result.category] || '4990' });
        } catch {
            toast.error('KI-Analyse fehlgeschlagen — bitte manuell ausfüllen');
            setEditData({ file_url: previewUrl, status: 'freigegeben' });
        } finally {
            setUploading(false);
            setAiProcessing(false);
        }
    };

    const handleManual = () => {
        setPreviewUrl(null);
        setEditData({ receipt_date: format(new Date(), 'yyyy-MM-dd'), tax_rate: 19, status: 'freigegeben' });
        setUploadOpen(true);
    };

    const openEdit = receipt => {
        setSelected(receipt);
        setEditData({ ...receipt });
        setEditOpen(true);
    };

    const handleSaveNew = () => {
        if (!editData.supplier_name || !editData.receipt_date || !editData.amount_gross) {
            toast.error('Lieferant, Datum und Betrag sind Pflichtfelder');
            return;
        }
        createMutation.mutate({
            ...editData,
            datev_account: CATEGORY_ACCOUNT[editData.category] || '4990',
            status: 'freigegeben',
        });
    };

    const handleSaveEdit = () => {
        if (!selected) return;
        updateMutation.mutate({
            id: selected.id,
            data: { ...editData, datev_account: CATEGORY_ACCOUNT[editData.category] || '4990' }
        });
    };

    if (!permissions.canViewAccounting) {
        return <PermissionDenied message="Kein Zugriff auf das Belegarchiv." />;
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Belege</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">Scan → KI → DATEV-Export</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Suche als Icon-Toggle */}
                        <button onClick={() => { setSearchOpen(s => !s); if (searchOpen) setSearch(''); }}
                            className={cn(
                                'w-9 h-9 flex items-center justify-center rounded-lg border transition-all',
                                searchOpen
                                    ? 'bg-accent border-border text-foreground'
                                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                            )}>
                            {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                        </button>
                        {/* Einziger Upload-Button */}
                        <Button onClick={() => setSheetOpen(true)}
                            className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                            <Plus className="w-4 h-4" /> Beleg
                        </Button>
                    </div>
                </div>

                {/* ── Monatsnavigation + Summe ─────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <MonthNav value={selectedMonth} onChange={setSelectedMonth} />
                    <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{fmt(totalGross)} €</p>
                        <p className="text-[10px] text-muted-foreground">{filtered.length} Belege</p>
                    </div>
                </div>

                {/* ── Suche (nur wenn offen) ───────────────────────────────── */}
                {searchOpen && (
                    <Input
                        autoFocus
                        placeholder="Lieferant oder Kategorie suchen…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="h-10"
                    />
                )}

                {/* ── Kategorie-Filter-Chips ───────────────────────────────── */}
                {monthReceipts.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                        <button onClick={() => setCatFilter('alle')}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all',
                                catFilter === 'alle'
                                    ? 'bg-amber-600 border-amber-600 text-white'
                                    : 'border-border text-muted-foreground hover:border-foreground/30'
                            )}>
                            Alle ({monthReceipts.length})
                        </button>
                        {missingImages > 0 && (
                            <button onClick={() => setCatFilter('kein_bild')}
                                className={cn(
                                    'px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all',
                                    catFilter === 'kein_bild'
                                        ? 'bg-amber-500 border-amber-500 text-white'
                                        : 'border-amber-500/30 text-amber-400 hover:border-amber-500/60'
                                )}>
                                ⚠ Kein Bild ({missingImages})
                            </button>
                        )}
                        {activeCategories.map(cat => (
                            <button key={cat} onClick={() => setCatFilter(cat === catFilter ? 'alle' : cat)}
                                className={cn(
                                    'px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all',
                                    catFilter === cat
                                        ? 'bg-amber-600 border-amber-600 text-white'
                                        : 'border-border text-muted-foreground hover:border-foreground/30'
                                )}>
                                {cat} ({monthReceipts.filter(r => r.category === cat).length})
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Beleg-Liste ──────────────────────────────────────────── */}
                {filtered.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-semibold text-foreground">Keine Belege</p>
                        <p className="text-sm mt-1">
                            {catFilter !== 'alle' ? 'Kein Beleg in dieser Kategorie' : 'Beleg über den Button oben hinzufügen'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map(r => (
                            <ReceiptCard
                                key={r.id}
                                receipt={r}
                                onEdit={() => openEdit(r)}
                                onDelete={() => setDeleteTarget(r.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Upload-Auswahl Sheet ─────────────────────────────────────── */}
            <UploadSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onFile={handleFileUpload}
                onManual={handleManual}
            />

            {/* ── Upload / KI / Neu-Beleg Dialog ──────────────────────────── */}
            <Dialog open={uploadOpen} onOpenChange={o => { if (!o) { setUploadOpen(false); setPreviewUrl(null); setEditData({}); } }}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Neuer Beleg</DialogTitle>
                    </DialogHeader>

                    {(uploading || aiProcessing) ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-blue-500/15 flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-blue-400 animate-pulse" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-foreground">
                                    {uploading ? 'Wird hochgeladen…' : 'KI liest Beleg aus…'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {aiProcessing ? 'Lieferant, Betrag & MwSt werden erkannt' : ''}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 py-1">
                            {/* Bild-Vorschau */}
                            {previewUrl && (
                                <div className="relative">
                                    <img src={previewUrl} alt="Beleg"
                                        className="w-full h-40 object-contain rounded-xl border border-border/50 bg-secondary/20" />
                                    <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                                        className="absolute top-2 right-2 bg-background/80 backdrop-blur px-2 py-1 rounded-lg text-xs text-blue-400 flex items-center gap-1">
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            )}
                            {editData.supplier_name && (
                                <div className="flex items-center gap-2 text-xs bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2 text-green-400">
                                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                    KI hat Daten erkannt — bitte prüfen und ggf. korrigieren
                                </div>
                            )}
                            <ReceiptForm data={editData} onChange={setEditData} />
                        </div>
                    )}

                    {!uploading && !aiProcessing && (
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setUploadOpen(false); setPreviewUrl(null); setEditData({}); }}>
                                Abbrechen
                            </Button>
                            <Button onClick={handleSaveNew}
                                disabled={createMutation.isPending}
                                className="bg-amber-600 hover:bg-amber-700 text-white flex-1">
                                {createMutation.isPending ? 'Speichert…' : 'Speichern'}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Bearbeiten Dialog ────────────────────────────────────────── */}
            <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Beleg bearbeiten</DialogTitle>
                    </DialogHeader>
                    <div className="py-1 space-y-4">
                        {selected?.file_url && (
                            <div className="relative">
                                {selected.file_url.endsWith('.pdf') ? (
                                    <a href={selected.file_url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-blue-500/20 bg-blue-500/8 text-blue-400 text-sm">
                                        <Receipt className="w-4 h-4" /> PDF öffnen
                                        <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                                    </a>
                                ) : (
                                    <img src={selected.file_url} alt="Beleg"
                                        className="w-full h-32 object-contain rounded-xl border border-border/50 bg-secondary/20" />
                                )}
                            </div>
                        )}
                        <ReceiptForm data={editData} onChange={setEditData} />
                    </div>
                    <DialogFooter className="gap-2 flex-row">
                        <Button variant="outline" size="sm"
                            onClick={() => setDeleteTarget(selected?.id)}
                            className="text-destructive border-destructive/30 hover:bg-destructive/10 h-9">
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />Löschen
                        </Button>
                        <Button onClick={handleSaveEdit}
                            disabled={updateMutation.isPending}
                            className="bg-amber-600 hover:bg-amber-700 text-white flex-1 h-9">
                            {updateMutation.isPending ? 'Speichert…' : 'Speichern'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm ───────────────────────────────────────────── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Beleg löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Der Beleg und das hochgeladene Bild werden dauerhaft entfernt.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(deleteTarget)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}