/**
 * ArticleModal — neu strukturiert
 * 3 Sektionen: Basis · Lager · Einkauf & Details
 * Alle bestehenden Felder + Funktionen bleiben erhalten.
 */
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SmartCombobox from '@/components/ui/SmartCombobox';
import { Camera, Upload, Image as ImageIcon, Crop, Sparkles, ChevronDown } from 'lucide-react';
import SupplierDetailsEditor from './SupplierDetailsEditor';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BarcodeScanner from '@/components/restock/BarcodeScanner';
import ImageEditor from '@/components/articles/ImageEditor';
import AllergenSelector from '@/components/menu/AllergenSelector';
import { haptics } from "@/components/utils/haptics";
import { toast } from 'sonner';
import PriceHistoryPanel from '@/components/articles/PriceHistoryPanel';
import { recordPriceChange } from '@/lib/priceHistoryUtils';
import { History } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Sektion-Wrapper ───────────────────────────────────────────────────────────
function Section({ title, defaultOpen = true, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-border/50 rounded-xl overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <span className="text-sm font-semibold text-foreground">{title}</span>
                <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="px-4 py-4 space-y-4 bg-background">
                    {children}
                </div>
            )}
        </div>
    );
}

// ── Haupt-Modal ───────────────────────────────────────────────────────────────
export default function ArticleModal({ open, onClose, article, onSave }) {
    const queryClient = useQueryClient();
    const currentUser = useRef(null);
    useEffect(() => { base44.auth.me().then(u => { currentUser.current = u; }).catch(() => {}); }, []);

    const { data: categories = [] } = useQuery({
        queryKey: ['article-categories'],
        queryFn: () => base44.entities.ArticleCategory.list('order'),
    });

    const { data: allSuppliers = [] } = useQuery({
        queryKey: ['suppliers-list'],
        queryFn: () => base44.entities.Supplier.list('order'),
    });
    const supplierNames = allSuppliers
        .filter(s => s.is_active !== false && (s.type || 'Lieferant') === 'Lieferant')
        .map(s => s.name);

    const cachedArticles = queryClient.getQueryData(['articles']) ?? [];
    const manufacturerSuggestions = [...new Set(cachedArticles.map(a => a.manufacturer).filter(Boolean))].sort();

    // ── State ─────────────────────────────────────────────────────────────────
    const [scannerOpen,     setScannerOpen]     = useState(false);
    const [uploading,       setUploading]        = useState(false);
    const [imageEditorOpen, setImageEditorOpen]  = useState(false);
    const [tempImageUrl,    setTempImageUrl]     = useState('');
    const [detectingAllergens, setDetectingAllergens] = useState(false);
    const [saving,          setSaving]           = useState(false);

    const emptyForm = {
        barcode: '', name: '', manufacturer: '', category: '',
        suppliers: [], supplier_details: [],
        purchase_price: '', tax_rate: 19, current_stock: '', min_stock: '',
        shelf_id: '', storage_location: '',
        image_url: '',
        allergens: '', allergens_list: [], additives: [],
        notes: '', unit: '', quantity: '', content_amount: '', content_unit: '',
        deposit: '', deposit_type: 'kein',
    };

    const [formData, setFormData] = useState(emptyForm);
    const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

    // ── Legacy-Migration: alte supplier_details in packaging_options umwandeln ────────
    const migrateSupplierDetails = (details = []) => details.map(s => {
        // Bereits neues Format → unverändert
        // Bereits neues Format mit Daten → unverändert lassen
        if (Array.isArray(s.packaging_options) && s.packaging_options.length > 0) return s;
        // packaging_options existiert leer aber keine alten Felder → leer lassen
        const hasOldFields = s.packaging_units || s.purchase_price;
        if (Array.isArray(s.packaging_options) && !hasOldFields) return s;
        // Altes Format: packaging_units + packaging_size + purchase_price auf Lieferanten-Ebene
        const units = parseFloat(s.packaging_units);
        const price = parseFloat(s.purchase_price);
        if (!isNaN(units) && units > 0 && !isNaN(price) && price > 0) {
            const packPrice  = units > 1 ? price * units : price;
            const unitPrice  = price;
            return {
                ...s,
                packaging_options: [{
                    id:             Math.random().toString(36).slice(2, 10),
                    packaging_type: s.packaging_size || 'Kiste',
                    units_per_pack: units,
                    price_per_pack: parseFloat(packPrice.toFixed(4)),
                    price_per_unit: parseFloat(unitPrice.toFixed(4)),
                    is_default:     true,
                    min_order_qty:  '',
                    deposit_per_unit: s.deposit ? String(s.deposit) : '',
                    deposit_type:   s.deposit_type || 'kein',
                }],
            };
        }
        // Nur purchase_price ohne Gebinde → Einzelstück-Option
        if (!isNaN(price) && price > 0) {
            return {
                ...s,
                packaging_options: [{
                    id:             Math.random().toString(36).slice(2, 10),
                    packaging_type: 'Stück',
                    units_per_pack: 1,
                    price_per_pack: parseFloat(price.toFixed(4)),
                    price_per_unit: parseFloat(price.toFixed(4)),
                    is_default:     true,
                    min_order_qty:  '',
                    deposit_per_unit: '',
                    deposit_type:   'kein',
                }],
            };
        }
        // Kein Preis → leere packaging_options
        return { ...s, packaging_options: [] };
    });

    useEffect(() => {
        if (!open) return;
        if (article) {
            setFormData({
                barcode:          article.barcode || '',
                name:             article.name || '',
                manufacturer:     article.manufacturer || '',
                category:         article.category || '',
                suppliers:        article.suppliers || [],
                supplier_details: migrateSupplierDetails(article.supplier_details || []),
                unit:             article.unit || '',
                quantity:         article.quantity != null ? String(article.quantity) : '',
                quantity:         article.quantity || '',
                content_amount:   article.content_amount != null ? String(article.content_amount) : '',
                content_unit:     article.content_unit || '',
                purchase_price:   article.purchase_price || '',
                tax_rate:         article.tax_rate ?? 19,
                current_stock:    article.current_stock ?? '',
                min_stock:        article.min_stock ?? '',
                shelf_id:         article.shelf_id || '',
                storage_location: article.storage_location || '',
                image_url:        article.image_url || '',
                allergens:        article.allergens || '',
                allergens_list:   article.allergens_list || [],
                additives:        article.additives || [],
                notes:            article.notes || '',
                deposit:          article.deposit || '',
                deposit_type:     article.deposit_type || 'kein',
            });
        } else {
            setFormData(emptyForm);
        }
    }, [article, open]);

    // ── Allergene KI ──────────────────────────────────────────────────────────
    const detectAllergens = async () => {
        if (!formData.name) { toast.error('Bitte zuerst Artikelname eingeben'); return; }
        setDetectingAllergens(true);
        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Analysiere den folgenden Artikel und liste NUR die enthaltenen Allergene auf: "${formData.name}". Gib nur die Allergene als kommaseparierte Liste zurück. Wenn keine Allergene vorhanden sind, antworte mit "Keine". Berücksichtige: Gluten, Krebstiere, Eier, Fisch, Erdnüsse, Soja, Milch, Schalenfrüchte, Sellerie, Senf, Sesam, Sulfite, Lupinen, Weichtiere.`,
                response_json_schema: { type: 'object', properties: { allergens: { type: 'string' } } }
            });
            set('allergens', result.allergens === 'Keine' ? '' : result.allergens);
            toast.success('Allergene erkannt');
        } catch {
            toast.error('Fehler bei der Allergenerkennung');
        } finally {
            setDetectingAllergens(false);
        }
    };

    // ── Bild ──────────────────────────────────────────────────────────────────
    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setTempImageUrl(URL.createObjectURL(file));
        setImageEditorOpen(true);
    };

    const handleImageSave = async (editedFile) => {
        setUploading(true);
        setImageEditorOpen(false);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file: editedFile });
            set('image_url', file_url);
            URL.revokeObjectURL(tempImageUrl);
            setTempImageUrl('');
            toast.success('Bild hochgeladen');
        } catch (err) {
            toast.error('Fehler beim Hochladen: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const suppliersArray = formData.supplier_details.map(s => s.supplier_name).filter(Boolean);
            const primary = formData.supplier_details.find(s => s.is_primary) || formData.supplier_details[0];
            const defaultOpt = (primary?.packaging_options || []).find(o => o.is_default) || (primary?.packaging_options || [])[0];
            const finalPrice = (defaultOpt?.price_per_unit != null ? parseFloat(defaultOpt.price_per_unit)
                : primary?.purchase_price ? parseFloat(primary.purchase_price) : null);

            // _pack_price_input ist ein UI-Hilfswert — nicht in die DB speichern
            const cleanSupplierDetails = formData.supplier_details.map(s => {
                const { _pack_price_input, ...clean } = s;
                const cleanOpts = (clean.packaging_options || []).map(opt => ({
                    ...opt,
                    units_per_pack:   opt.units_per_pack   !== '' ? parseFloat(opt.units_per_pack)   : undefined,
                    price_per_pack:   opt.price_per_pack   !== '' ? parseFloat(opt.price_per_pack)   : undefined,
                    price_per_unit:   opt.price_per_unit   != null ? parseFloat(opt.price_per_unit)  : undefined,
                    min_order_qty:    opt.min_order_qty    !== '' ? parseFloat(opt.min_order_qty)    : undefined,
                    deposit_per_unit: opt.deposit_per_unit !== '' ? parseFloat(opt.deposit_per_unit) : undefined,
                }));
                return { ...clean, packaging_options: cleanOpts, purchase_price: clean.purchase_price ? parseFloat(clean.purchase_price) : undefined };
            });

            const dataToSave = {
                ...formData,
                supplier_details: cleanSupplierDetails,
                suppliers:        suppliersArray.length > 0 ? suppliersArray : formData.suppliers,
                quantity:         formData.quantity        ? parseFloat(formData.quantity)        : undefined,
                content_amount:   formData.content_amount  ? parseFloat(formData.content_amount)  : undefined,
                purchase_price:   finalPrice,
                current_stock:    formData.current_stock !== '' ? parseFloat(formData.current_stock) : 0,
                min_stock:        formData.min_stock !== ''     ? parseFloat(formData.min_stock)     : undefined,
                deposit:          formData.deposit         ? parseFloat(formData.deposit)          : undefined,
            };

            if (article?.id) {
                await recordPriceChange({
                    articleId:    article.id,
                    articleName:  formData.name,
                    oldPrice:     article.purchase_price,
                    newPrice:     finalPrice,
                    user:         currentUser.current,
                    supplierName: primary?.supplier_name,
                });
            }

            haptics.light();
            onSave(dataToSave, article?.id);
        } finally {
            setSaving(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0">
                    <DialogHeader className="px-5 pt-5 pb-0">
                        <DialogTitle className="text-base">
                            {article?.id ? 'Artikel bearbeiten' : 'Neuer Artikel'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="px-5 pb-5 pt-4 space-y-3">

                        {/* ── SEKTION 1: Basis ─────────────────────────────── */}
                        <Section title="📦 Basis" defaultOpen={true}>

                            {/* Bild + Name nebeneinander */}
                            <div className="flex gap-3 items-start">
                                {/* Bild */}
                                <label className="relative shrink-0 cursor-pointer group">
                                    <div className={cn(
                                        'w-16 h-16 rounded-xl border-2 border-dashed border-border overflow-hidden flex items-center justify-center bg-secondary/30',
                                        'hover:border-amber-500/50 transition-colors'
                                    )}>
                                        {formData.image_url ? (
                                            <img src={formData.image_url} alt="" className="w-full h-full object-cover" />
                                        ) : uploading ? (
                                            <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                                        ) : (
                                            <ImageIcon className="w-5 h-5 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                                        )}
                                    </div>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                </label>

                                {/* Name + Kategorie */}
                                <div className="flex-1 space-y-2">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Name *</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => set('name', e.target.value)}
                                            placeholder="Artikelname"
                                            required
                                            className="h-9 mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Kategorie</Label>
                                        <Select value={formData.category} onValueChange={v => set('category', v)}>
                                            <SelectTrigger className="h-9 mt-1">
                                                <SelectValue placeholder="Kategorie wählen…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map(c => (
                                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Barcode */}
                            <div>
                                <Label className="text-xs text-muted-foreground">Barcode / EAN</Label>
                                <div className="flex gap-2 mt-1">
                                    <Input
                                        value={formData.barcode}
                                        onChange={e => set('barcode', e.target.value)}
                                        placeholder="EAN-Code"
                                        className="h-9 font-mono"
                                    />
                                    <Button type="button" variant="outline" size="sm"
                                        className="h-9 px-3 shrink-0"
                                        onClick={() => setScannerOpen(true)}>
                                        <Camera className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </Section>

                        {/* ── SEKTION 2: Lager ─────────────────────────────── */}
                        <Section title="🏪 Lager" defaultOpen={true}>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Bestand</Label>
                                    <Input type="number" step="0.01"
                                        value={formData.current_stock}
                                        onChange={e => set('current_stock', e.target.value)}
                                        placeholder="0"
                                        className="h-9 mt-1" />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Mindestbestand</Label>
                                    <Input type="number" step="0.01"
                                        value={formData.min_stock}
                                        onChange={e => set('min_stock', e.target.value)}
                                        placeholder="—"
                                        className="h-9 mt-1" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Lagerort</Label>
                                    <Input
                                        value={formData.storage_location}
                                        onChange={e => set('storage_location', e.target.value)}
                                        placeholder="z.B. Keller"
                                        className="h-9 mt-1" />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Regal / Fach</Label>
                                    <Input
                                        value={formData.shelf_id}
                                        onChange={e => set('shelf_id', e.target.value)}
                                        placeholder="z.B. A1"
                                        className="h-9 mt-1" />
                                </div>
                            </div>
                        </Section>

                        {/* ── SEKTION 3: Einkauf & Details ─────────────────── */}
                        <Section title="🛒 Einkauf & Details" defaultOpen={false}>

                            {/* Lieferanten */}
                            <div>
                                <Label className="text-xs text-muted-foreground">Lieferanten</Label>
                                <div className="mt-1">
                                    <SupplierDetailsEditor
                                        value={formData.supplier_details}
                                        onChange={v => set('supplier_details', v)}
                                        availableSuppliers={supplierNames}
                                    />
                                </div>
                            </div>

                            {/* Einkaufspreis Fallback */}
                            {formData.supplier_details.length === 0 && (
                                <div>
                                    <Label className="text-xs text-muted-foreground">Einkaufspreis (€)</Label>
                                    <Input type="number" step="0.01"
                                        value={formData.purchase_price}
                                        onChange={e => set('purchase_price', e.target.value)}
                                        placeholder="0.00"
                                        className="h-9 mt-1" />
                                </div>
                            )}

                            {/* MwSt-Satz */}
                            <div>
                                <Label className="text-xs text-muted-foreground">MwSt-Satz</Label>
                                <Select value={String(formData.tax_rate ?? 19)} onValueChange={v => set('tax_rate', Number(v))}>
                                    <SelectTrigger className="h-9 mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="19">19% (Standard)</SelectItem>
                                        <SelectItem value="7">7% (Lebensmittel)</SelectItem>
                                        <SelectItem value="0">0% (steuerfrei)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Inhalt & Einheit */}
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1.5 block">Inhalt pro Einheit</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <Label className="text-[10px] text-muted-foreground/70">Menge (Anzahl)</Label>
                                        <Input type="number" step="1" min="1"
                                            value={formData.quantity}
                                            onChange={e => set('quantity', e.target.value)}
                                            placeholder="1"
                                            className="h-9 mt-1 text-sm" />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-muted-foreground/70">Füllmenge</Label>
                                        <Input type="number" step="0.001"
                                            value={formData.content_amount}
                                            onChange={e => set('content_amount', e.target.value)}
                                            placeholder="0.7"
                                            className="h-9 mt-1 text-sm" />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-muted-foreground/70">Einheit</Label>
                                        <Select value={formData.content_unit} onValueChange={v => set('content_unit', v)}>
                                            <SelectTrigger className="h-9 mt-1">
                                                <SelectValue placeholder="—" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {['Stück', 'l', 'ml', 'kg', 'g', 'cl'].map(u => (
                                                    <SelectItem key={u} value={u}>{u}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {formData.quantity > 1 && formData.content_amount && formData.content_unit && (
                                    <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                                        = {formData.quantity}× {formData.content_amount} {formData.content_unit} pro Einheit
                                    </p>
                                )}
                            </div>

                            {/* Pfand */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Pfandtyp</Label>
                                    <Select value={formData.deposit_type || 'kein'} onValueChange={v => set('deposit_type', v)}>
                                        <SelectTrigger className="h-9 mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="kein">Kein Pfand</SelectItem>
                                            <SelectItem value="einweg">Einweg (0,25 €)</SelectItem>
                                            <SelectItem value="mehrweg_flasche">Mehrweg Flasche (0,15 €)</SelectItem>
                                            <SelectItem value="mehrweg_kiste">Mehrweg Kiste (1,50 €)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Pfand (€/Einheit)</Label>
                                    <Input type="number" step="0.01"
                                        value={formData.deposit}
                                        onChange={e => set('deposit', e.target.value)}
                                        placeholder={
                                            formData.deposit_type === 'einweg'           ? '0.25' :
                                            formData.deposit_type === 'mehrweg_flasche'  ? '0.15' :
                                            formData.deposit_type === 'mehrweg_kiste'    ? '1.50' : '—'
                                        }
                                        className="h-9 mt-1 text-sm" />
                                </div>
                            </div>

                            {/* Hersteller */}
                            <div>
                                <Label className="text-xs text-muted-foreground">Hersteller / Marke</Label>
                                <div className="mt-1">
                                    <SmartCombobox
                                        value={formData.manufacturer}
                                        onChange={v => set('manufacturer', v)}
                                        options={manufacturerSuggestions}
                                        placeholder="Hersteller…"
                                        allowCreate={true}
                                    />
                                </div>
                            </div>

                            {/* Allergene */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <Label className="text-xs text-muted-foreground">Allergene</Label>
                                    <button type="button" onClick={detectAllergens}
                                        disabled={detectingAllergens}
                                        className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50">
                                        <Sparkles className="w-3 h-3" />
                                        {detectingAllergens ? 'Erkenne…' : 'KI erkennen'}
                                    </button>
                                </div>
                                <AllergenSelector
                                    allergensList={formData.allergens_list || []}
                                    additives={formData.additives || []}
                                    onChange={(key, val) => set(key, val)}
                                />
                                <Input
                                    value={formData.allergens}
                                    onChange={e => set('allergens', e.target.value)}
                                    placeholder="Freitext Allergene…"
                                    className="h-9 mt-2 text-xs"
                                />
                            </div>

                            {/* Notizen */}
                            <div>
                                <Label className="text-xs text-muted-foreground">Notizen</Label>
                                <Textarea
                                    value={formData.notes}
                                    onChange={e => set('notes', e.target.value)}
                                    placeholder="Interne Notizen…"
                                    rows={2}
                                    className="resize-none mt-1 text-sm"
                                />
                            </div>

                            {/* Preisverlauf (nur bei bestehendem Artikel) */}
                            {article?.id && (
                                <div>
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <History className="w-3 h-3" /> Preisverlauf
                                    </Label>
                                    <div className="mt-1">
                                        <PriceHistoryPanel articleId={article.id} />
                                    </div>
                                </div>
                            )}
                        </Section>

                        {/* ── Aktionen ─────────────────────────────────────── */}
                        <div className="flex gap-2 pt-1">
                            <Button type="button" variant="outline"
                                onClick={onClose} className="flex-1 h-10">
                                Abbrechen
                            </Button>
                            <Button type="submit" disabled={saving}
                                className="flex-1 h-10 bg-amber-600 hover:bg-amber-700 text-white">
                                {saving ? 'Speichern…' : 'Speichern'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Sub-Dialoge */}
            <BarcodeScanner
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={(barcode) => { set('barcode', barcode); setScannerOpen(false); }}
            />
            <ImageEditor
                open={imageEditorOpen}
                imageUrl={tempImageUrl}
                onSave={handleImageSave}
                onClose={() => { setImageEditorOpen(false); URL.revokeObjectURL(tempImageUrl); setTempImageUrl(''); }}
            />
        </>
    );
}