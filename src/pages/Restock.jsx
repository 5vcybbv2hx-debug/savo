import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { useErrorHandler } from '@/components/error/ErrorHandler';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import { format } from 'date-fns';
import {
    Scan, Camera, Check, Trash2, CheckCheck, Plus, X,
    ShoppingCart, AlertCircle, ChevronRight, PackageCheck
} from 'lucide-react';
import QuantityInputModal from '../components/restock/QuantityInputModal';
import RundgangMode from '../components/restock/RundgangMode';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import BarcodeScanner from '../components/restock/BarcodeScanner';

// ── Inline Toast ──────────────────────────────────────────────────────────────
function Toast({ message, type = 'error', onDismiss }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 4000);
        return () => clearTimeout(t);
    }, [message]);

    const colors = {
        error:   'bg-red-900/80 border-red-500/50 text-red-200',
        success: 'bg-green-900/80 border-green-500/50 text-green-200',
        info:    'bg-blue-900/80 border-blue-500/50 text-blue-200',
    };

    return (
        <div className={cn(
            'fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl max-w-sm w-[92vw] animate-in slide-in-from-top-2 duration-200',
            colors[type]
        )}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium flex-1">{message}</span>
            <button onClick={onDismiss} className="opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ open, title, description, confirmLabel = 'Löschen', onConfirm, onCancel, danger = true }) {
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
            <DialogContent className="sm:max-w-sm rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-foreground">{title}</DialogTitle>
                    {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
                </DialogHeader>
                <DialogFooter className="flex gap-2 mt-2">
                    <Button variant="outline" onClick={onCancel} className="flex-1">Abbrechen</Button>
                    <Button
                        onClick={onConfirm}
                        className={cn('flex-1', danger ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-primary hover:bg-primary/90 text-primary-foreground')}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function Restock() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    useEffect(() => {
        const handleOnline = () => syncMutations(base44).catch(console.error);
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    const barcodeInputRef = useRef(null);
    const [barcode, setBarcode]                   = useState('');
    const [scannerOpen, setScannerOpen]           = useState(false);
    const [selectedArticle, setSelectedArticle]   = useState('');
    const [recentIds, setRecentIds]               = useState([]);
    const recentTimers = useRef({});

    const [pendingArticle, setPendingArticle]     = useState(null);
    const [qtyModalOpen, setQtyModalOpen]         = useState(false);
    const [toast, setToast]                       = useState(null);
    const [confirmDialog, setConfirmDialog]       = useState(null);
    const [orderNudge, setOrderNudge]             = useState({});

    const showToast = (message, type = 'error') => setToast({ message, type });

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: restockItems = [] } = useQuery({
        queryKey: ['restock-items'],
        queryFn: () => base44.entities.RestockItem.list('-created_date', 200),
        staleTime: STALE.MEDIUM,
    });

    const { data: articles = [], isLoading: articlesLoading } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list('name', 500),
        staleTime: STALE.SLOW,
    });

    const { data: shoppingItems = [] } = useQuery({
        queryKey: ['shopping-list-restock'],
        queryFn: () => base44.entities.ShoppingList.filter({ status: 'offen' }),
        staleTime: 60 * 1000,
    });

    const { handleError } = useErrorHandler();

    // ── Recent highlight ──────────────────────────────────────────────────────
    const markRecent = (id) => {
        setRecentIds(prev => [...prev.filter(x => x !== id), id]);
        if (recentTimers.current[id]) clearTimeout(recentTimers.current[id]);
        recentTimers.current[id] = setTimeout(() => {
            setRecentIds(prev => prev.filter(x => x !== id));
        }, 8000);
    };

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: async (data) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'RestockItem', type: 'create', data });
                const fakeId = `offline-${Date.now()}`;
                queryClient.setQueryData(['restock-items'], (old) => [{ ...data, id: fakeId, _offline: true }, ...(old || [])]);
                return { id: fakeId, ...data, _offline: true };
            }
            return base44.entities.RestockItem.create(data);
        },
        onSuccess: (newItem) => {
            if (!newItem?._offline) queryClient.invalidateQueries({ queryKey: ['restock-items'] });
            if (newItem?.id) markRecent(newItem.id);
        },
        onError: () => showToast('Fehler beim Erstellen des Eintrags'),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'RestockItem', type: 'update', id, data });
                queryClient.setQueryData(['restock-items'], (old) => old?.map(item => item.id === id ? { ...item, ...data } : item) || old);
                return { queued: true, id };
            }
            return base44.entities.RestockItem.update(id, data);
        },
        onSuccess: (result, variables) => {
            if (!result?.queued) queryClient.invalidateQueries({ queryKey: ['restock-items'] });
            markRecent(result?.id || variables.id);
        },
        onError: () => showToast('Fehler beim Aktualisieren'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'RestockItem', type: 'delete', id });
                queryClient.setQueryData(['restock-items'], (old) => old?.filter(item => item.id !== id) || old);
                return { queued: true };
            }
            return base44.entities.RestockItem.delete(id);
        },
        onSuccess: (result) => {
            if (!result?.queued) queryClient.invalidateQueries({ queryKey: ['restock-items'] });
        },
        onError: () => showToast('Fehler beim Löschen'),
    });

    // ── Scan-Logik (Abgleich über article_id + date, bereichsübergreifend) ─────
    const handleArticleDirect = (article) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const existingItem = restockItems.find(
            item => item.article_id === article.id &&
                    item.date === today &&
                    !item.is_completed
        );
        setPendingArticle({ article, existingItem: existingItem || null });
        setQtyModalOpen(true);
        setBarcode('');
    };

    const handleScan = (scannedBarcode) => {
        const article = articles.find(a => a.barcode === scannedBarcode);
        if (!article) { showToast(`Artikel nicht gefunden: ${scannedBarcode}`, 'error'); return; }
        handleArticleDirect(article);
    };

    const handleQtyConfirm = async (qty) => {
        setQtyModalOpen(false);
        if (!pendingArticle) return;
        const { article, existingItem } = pendingArticle;
        setPendingArticle(null);

        if (existingItem) {
            updateMutation.mutate({ id: existingItem.id, data: { ...existingItem, quantity: qty } });
        } else {
            const user = await base44.auth.me();
            createMutation.mutate({
                article_id:        article.id,
                barcode:           article.barcode || '',
                article_name:      article.name,
                article_image_url: article.image_url || null,
                quantity:          qty,
                area_id:           null,
                area_name:         null,
                restocked_by:      user?.full_name || user?.email || 'Unbekannt',
                date:              format(new Date(), 'yyyy-MM-dd'),
                time:              format(new Date(), 'HH:mm'),
                is_completed:      false,
            });
        }
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
    };

    const handleBarcodeSubmit = async (e) => {
        e.preventDefault();
        if (selectedArticle) {
            const article = articles.find(a => a.id === selectedArticle);
            if (article) { handleArticleDirect(article); setSelectedArticle(''); }
            return;
        }
        if (!barcode.trim()) return;
        handleScan(barcode.trim());
    };

    const handleCameraScan = (decodedText) => {
        setScannerOpen(false);
        handleScan(decodedText);
    };

    const toggleComplete = async (item) => {
        const nowCompleted = !item.is_completed;
        const effectiveQty = item.needed_quantity != null ? parseFloat(item.needed_quantity) : parseFloat(item.quantity) || 0;
        updateMutation.mutate({ id: item.id, data: { ...item, is_completed: nowCompleted } });

        if (nowCompleted) {
            if (item.article_id && effectiveQty > 0 && !item.stock_reduced) {
                const article = articles.find(a => a.id === item.article_id);
                if (article && article.current_stock != null) {
                    const newStock = Math.max(0, (parseFloat(article.current_stock) || 0) - effectiveQty);
                    try {
                        await base44.entities.Article.update(article.id, { current_stock: newStock });
                        await base44.entities.RestockItem.update(item.id, { stock_reduced: true });
                        queryClient.invalidateQueries({ queryKey: ['articles'] });
                    } catch (e) { console.warn('[Restock] Bestandsabzug fehlgeschlagen:', e); }
                }
            }
            const alreadyInOrder = shoppingItems.some(
                s => s.item_name === item.article_name && (s.status === 'offen' || s.status === 'bestellt')
            );
            if (!alreadyInOrder) {
                setOrderNudge(prev => ({ ...prev, [item.id]: true }));
                setTimeout(() => setOrderNudge(prev => ({ ...prev, [item.id]: false })), 8000);
            }
        } else {
            if (item.article_id && effectiveQty > 0 && item.stock_reduced) {
                const article = articles.find(a => a.id === item.article_id);
                if (article) {
                    const newStock = (parseFloat(article.current_stock) || 0) + effectiveQty;
                    try {
                        await base44.entities.Article.update(article.id, { current_stock: newStock });
                        await base44.entities.RestockItem.update(item.id, { stock_reduced: false });
                        queryClient.invalidateQueries({ queryKey: ['articles'] });
                    } catch (e) { console.warn('[Restock] Bestandsrestore fehlgeschlagen:', e); }
                }
            }
            setOrderNudge(prev => ({ ...prev, [item.id]: false }));
        }
    };

    // Gebinde-Bestell-Vorschlag: rechnet die im Rundgang aufgefüllte Flaschen-Menge auf
    // volle Gebinde-Einheiten (Kiste/Karton/Palette…) des Standard-Lieferanten hoch —
    // z.B. 3 Flaschen benötigt bei einem 6er-Karton → Vorschlag "1× Karton (6×)".
    // Ohne diese Umrechnung würde die Flaschen-Anzahl 1:1 als Gebinde-Menge übernommen
    // (bei Havana Club 3 also fälschlich "3× Karton" statt "1× Karton" bestellt werden).
    const getOrderSuggestion = (item) => {
        const article = articles.find(a => a.id === item.article_id);
        const primarySupplier = article?.supplier_details?.find(s => s.is_primary) || article?.supplier_details?.[0];
        const supplierName = primarySupplier?.supplier_name || article?.suppliers?.[0] || '';
        const defaultOpt = (primarySupplier?.packaging_options || []).find(o => o.is_default) || (primarySupplier?.packaging_options || [])[0];
        const unitsPerPack = parseFloat(defaultOpt?.units_per_pack) || 1;
        const bottleNeed = item.needed_quantity != null ? parseFloat(item.needed_quantity) : (parseFloat(item.quantity) || 0);
        const suggestedQty = Math.max(1, Math.ceil(bottleNeed / unitsPerPack));
        return {
            article, primarySupplier, supplierName, defaultOpt, unitsPerPack, bottleNeed,
            suggestedQty,
            suggestedUnits: suggestedQty * unitsPerPack,
            packagingLabel: defaultOpt ? `${defaultOpt.packaging_type} ${defaultOpt.units_per_pack}×` : null,
            wasRounded: unitsPerPack > 1 && suggestedQty * unitsPerPack !== bottleNeed,
        };
    };

    // Einzeln zur Bestellung
    const addToOrder = async (item) => {
        const s = getOrderSuggestion(item);
        await base44.entities.ShoppingList.create({
            item_name:           item.article_name,
            article_id:          item.article_id || null,
            category:            s.supplierName,
            supplier_name:       s.supplierName,
            packaging_option_id: s.defaultOpt?.id || null,
            packaging_label:     s.packagingLabel,
            price_per_pack:      s.defaultOpt?.price_per_pack || null,
            price_per_unit:      s.defaultOpt?.price_per_unit || s.article?.purchase_price || null,
            quantity:            s.suggestedQty,
            quantity_units:      s.suggestedUnits,
            unit:                s.defaultOpt?.packaging_type || 'Stück',
            status:              'offen',
            notes:               `Auffüllliste ${format(new Date(), 'dd.MM.yyyy')} · ${item.area_name || ''}`,
        });
        queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
        queryClient.invalidateQueries({ queryKey: ['shopping-list-restock'] });
        setOrderNudge(prev => ({ ...prev, [item.id]: false }));
        showToast(
            s.wasRounded
                ? `${item.article_name}: ${s.suggestedQty}× ${s.defaultOpt?.packaging_type || ''} bestellt (auf volles Gebinde aufgerundet)`
                : `${item.article_name} zur Bestellung hinzugefügt`,
            'success'
        );
    };

    // Alle erledigten zur Bestellung (bereichsübergreifend)
    const addAllCompletedToOrder = async () => {
        const completed = todayItems.filter(i => i.is_completed);
        let added = 0, skipped = 0, rounded = 0;

        for (const item of completed) {
            const alreadyInOrder = shoppingItems.some(
                s => s.item_name === item.article_name && (s.status === 'offen' || s.status === 'bestellt')
            );
            if (alreadyInOrder) { skipped++; continue; }

            const s = getOrderSuggestion(item);
            await base44.entities.ShoppingList.create({
                item_name:           item.article_name,
                article_id:          item.article_id || null,
                category:            s.supplierName,
                supplier_name:       s.supplierName,
                packaging_option_id: s.defaultOpt?.id || null,
                packaging_label:     s.packagingLabel,
                price_per_pack:      s.defaultOpt?.price_per_pack || null,
                price_per_unit:      s.defaultOpt?.price_per_unit || s.article?.purchase_price || null,
                quantity:            s.suggestedQty,
                quantity_units:      s.suggestedUnits,
                unit:                s.defaultOpt?.packaging_type || 'Stück',
                status:              'offen',
                notes:               `Auffüllliste ${format(new Date(), 'dd.MM.yyyy')} · ${item.area_name || ''}`.trim().replace(/·\s*$/, ''),
            });
            added++;
            if (s.wasRounded) rounded++;
        }

        queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
        queryClient.invalidateQueries({ queryKey: ['shopping-list-restock'] });

        return { added, skipped, rounded };
    };

    const handleDelete = (id) => {
        setConfirmDialog({
            title: 'Eintrag löschen?',
            description: 'Dieser Eintrag wird unwiderruflich gelöscht.',
            onConfirm: () => { deleteMutation.mutate(id); setConfirmDialog(null); },
        });
    };

    // Kombiniert: alle erledigten Artikel bestellen + aus Liste löschen
    const handleOrderAndClean = () => {
        const completedItems = todayItems.filter(item => item.is_completed);
        if (completedItems.length === 0) { showToast('Keine erledigten Aufgaben vorhanden', 'info'); return; }
        setConfirmDialog({
            title: 'Bestellen & erledigen?',
            description: `${completedItems.length} erledigte Artikel werden zur Bestellliste hinzugefügt und aus der Auffüllliste entfernt.`,
            confirmLabel: 'Bestellen & erledigen',
            danger: false,
            onConfirm: async () => {
                try {
                    // 1. Bestellen (inkl. Duplikat-Check)
                    const { added, skipped, rounded } = await addAllCompletedToOrder();
                    // 2. Löschen — erst nach erfolgreichem Bestellen
                    for (const item of completedItems) {
                        try { await deleteMutation.mutateAsync(item.id); } catch {}
                    }
                    queryClient.invalidateQueries({ queryKey: ['restock-items'] });
                    setConfirmDialog(null);
                    const skipNote = skipped > 0 ? ` · ${skipped} bereits in Bestellung` : '';
                    const roundNote = rounded > 0 ? ` · ${rounded}× auf volles Gebinde aufgerundet` : '';
                    showToast(`${added} Artikel bestellt, Liste bereinigt${skipNote}${roundNote}`, 'success');
                } catch (e) {
                    showToast('Fehler beim Bestellen & Erledigen', 'error');
                }
            },
        });
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const today = format(new Date(), 'yyyy-MM-dd');

    // Alle heutigen Items (bereichsübergreifend)
    const todayItems = useMemo(() => {
        return restockItems
            .filter(item => item.date === today)
            .sort((a, b) => {
                if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
                return (b.created_date || '').localeCompare(a.created_date || '');
            });
    }, [restockItems, today]);

    const searchMatches = useMemo(() => {
        if (!barcode.trim()) return [];
        const q = barcode.toLowerCase();
        return articles.filter(a =>
            a.barcode === barcode ||
            a.name.toLowerCase().includes(q) ||
            a.barcode?.includes(barcode)
        );
    }, [barcode, articles]);

    const groupedItems = useMemo(() =>
        todayItems.reduce((groups, item) => {
            const cat = articles.find(art => art.id === item.article_id || art.barcode === item.barcode)?.category || 'Sonstiges';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
            return groups;
        }, {}),
    [todayItems, articles]);

    const openCount      = todayItems.filter(i => !i.is_completed).length;
    const completedCount = todayItems.filter(i => i.is_completed).length;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">

                {/* ── Header ────────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <Scan className="w-5 h-5 text-primary" />
                            Auffüllliste
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {openCount} offen · {completedCount} erledigt
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(createPageUrl('Warehouse') + '?tab=keller')}
                        className="gap-1.5 shrink-0"
                    >
                        <PackageCheck className="w-4 h-4" />
                        Keller
                    </Button>
                </div>

                {/* ── Scan-/Such-Leiste ─────────────────────────────────── */}
                <Card className="p-4 border-border/60">
                    <form onSubmit={handleBarcodeSubmit} className="space-y-3">
                        <div className="flex gap-2">
                            <Input
                                ref={barcodeInputRef}
                                type="text"
                                inputMode="text"
                                value={barcode}
                                onChange={e => { setBarcode(e.target.value); setSelectedArticle(''); }}
                                placeholder="Barcode scannen oder Artikel suchen..."
                                className="flex-1 h-11 text-base"
                                autoComplete="off"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 shrink-0"
                                onClick={() => setScannerOpen(true)}
                            >
                                <Camera className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Artikel-Vorschläge */}
                        {barcode.trim().length >= 2 && searchMatches.length > 0 && (
                            <div className="rounded-lg border border-border bg-popover overflow-hidden">
                                {searchMatches.slice(0, 5).map(article => (
                                    <button
                                        key={article.id}
                                        type="button"
                                        onClick={() => { setSelectedArticle(article.id); setBarcode(article.name); }}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors border-b border-border/40 last:border-0',
                                            selectedArticle === article.id && 'bg-accent'
                                        )}
                                    >
                                        {article.image_url
                                            ? <img src={article.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                                            : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                                                <Scan className="w-4 h-4 text-muted-foreground" />
                                              </div>
                                        }
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{article.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {article.category || 'Sonstiges'}{article.barcode ? ` · ${article.barcode}` : ''}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {barcode.trim().length >= 2 && searchMatches.length === 0 && (
                            <p className="text-xs text-muted-foreground px-1">Kein Artikel gefunden</p>
                        )}

                        <Button
                            type="submit"
                            disabled={!barcode.trim() && !selectedArticle}
                            className="w-full h-11 font-semibold"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Zur Liste hinzufügen
                        </Button>
                    </form>
                </Card>

                {/* ── Bereich → Möbel → Fach → Artikel Baum ─────────────── */}
                <RundgangMode
                    restockItems={restockItems}
                    articles={articles}
                    createMutation={createMutation}
                    updateMutation={updateMutation}
                    showToast={showToast}
                />

                {/* ── Heutige Auffüllliste (alle Bereiche) ──────────────── */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-foreground">
                            Heutige Auffüllliste
                        </h2>

                        {completedCount > 0 && (
                            <Button
                                size="sm"
                                onClick={handleOrderAndClean}
                                className="h-9 gap-1.5"
                            >
                                <ShoppingCart className="w-4 h-4" />
                                Bestellen & erledigen
                            </Button>
                        )}
                    </div>

                    {/* ── Leere Liste ───────────────────────────────────── */}
                    {todayItems.length === 0 ? (
                        <Card className="p-10 text-center border-border/40">
                            <Scan className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                            <p className="text-muted-foreground font-medium">Noch keine Artikel erfasst</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                Scanne einen Barcode, suche einen Artikel<br />
                                oder gehe den Rundgang durch die Fächer
                            </p>
                        </Card>
                    ) : (
                        <div className="space-y-5">
                            {Object.entries(groupedItems).map(([category, items]) => (
                                <div key={category}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                                            {category}
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        {items.map(item => (
                                            <Card key={item.id} className={cn(
                                                'overflow-hidden border transition-all',
                                                recentIds.includes(item.id) && 'ring-2 ring-primary/40',
                                                item.is_completed && 'opacity-60'
                                            )}>
                                                <div className="flex items-center gap-3 px-4 py-3">
                                                    {/* Artikel-Bild */}
                                                    {item.article_image_url
                                                        ? <img src={item.article_image_url} alt=""
                                                            className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                                        : <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                            <Scan className="w-5 h-5 text-muted-foreground/40" />
                                                          </div>
                                                    }

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn(
                                                            'text-sm font-semibold truncate',
                                                            item.is_completed ? 'text-muted-foreground line-through' : 'text-foreground'
                                                        )}>
                                                            {item.article_name}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-xs text-muted-foreground">
                                                                {item.needed_quantity != null ? item.needed_quantity : item.quantity} Stück · {item.time || ''}
                                                            </span>
                                                            {item.area_name && (
                                                                <span className="text-xs text-muted-foreground/60 truncate max-w-[100px]">
                                                                    · {item.area_name}
                                                                </span>
                                                            )}
                                                            {item.restocked_by && (
                                                                <span className="text-xs text-muted-foreground/60 truncate max-w-[100px]">
                                                                    · {item.restocked_by.split(' ')[0]}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Abhaken */}
                                                    <button
                                                        onClick={() => toggleComplete(item)}
                                                        className={cn(
                                                            'w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 transition-all active:scale-90',
                                                            item.is_completed
                                                                ? 'border-green-500 bg-green-500'
                                                                : 'border-border hover:border-primary'
                                                        )}
                                                    >
                                                        {item.is_completed && <Check className="w-4 h-4 text-white" />}
                                                    </button>

                                                    {/* Löschen */}
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all shrink-0"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Order Nudge */}
                                                {orderNudge[item.id] && (() => {
                                                    const s = getOrderSuggestion(item);
                                                    return (
                                                        <div className="flex items-center gap-3 px-4 py-3 border-t border-primary/20 bg-primary/5 animate-in slide-in-from-top-2 duration-200">
                                                            <ShoppingCart className="w-4 h-4 text-primary shrink-0" />
                                                            <p className="text-xs text-muted-foreground flex-1">
                                                                {s.wasRounded
                                                                    ? <>In Bestellliste aufnehmen? <span className="text-foreground font-medium">{s.suggestedQty}× {s.defaultOpt?.packaging_type}</span> deckt die {s.bottleNeed} benötigten Flaschen ({s.packagingLabel}).</>
                                                                    : 'In Bestellliste aufnehmen?'}
                                                            </p>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => addToOrder(item)}
                                                                className="h-8 text-xs gap-1"
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                                Hinzufügen
                                                            </Button>
                                                            <button
                                                                onClick={() => setOrderNudge(prev => ({ ...prev, [item.id]: false }))}
                                                                className="text-muted-foreground/60 hover:text-muted-foreground"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modals ────────────────────────────────────────────────── */}
            <QuantityInputModal
                open={qtyModalOpen}
                article={pendingArticle?.article}
                existingItem={pendingArticle?.existingItem}
                onConfirm={handleQtyConfirm}
                onClose={() => { setQtyModalOpen(false); setPendingArticle(null); }}
            />

            <BarcodeScanner
                open={scannerOpen}
                onScan={handleCameraScan}
                onClose={() => setScannerOpen(false)}
            />

            <ConfirmDialog
                open={!!confirmDialog}
                title={confirmDialog?.title || ''}
                description={confirmDialog?.description}
                onConfirm={confirmDialog?.onConfirm}
                onCancel={() => setConfirmDialog(null)}
            />
        </div>
    );
}