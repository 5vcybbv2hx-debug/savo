import { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { LoadingState, EmptyState } from '@/components/ui/StateDisplay';
import { useErrorHandler } from '@/components/error/ErrorHandler';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import { format } from 'date-fns';
import { Scan, Camera, Check, Trash2, CheckCheck, Plus, Pencil, AlertCircle, X, ShoppingCart } from 'lucide-react';
import QuantityInputModal from '../components/restock/QuantityInputModal';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import BarcodeScanner from '../components/restock/BarcodeScanner';

// ── Inline Toast ─────────────────────────────────────────────────────────────
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
                        className={cn('flex-1', danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-slate-900')}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Restock() {
    const queryClient = useQueryClient();

    // Offline sync
    useEffect(() => {
        const handleOnline = () => syncMutations(base44).catch(console.error);
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    const barcodeInputRef = useRef(null);
    const [barcode, setBarcode]           = useState('');
    const [scannerOpen, setScannerOpen]   = useState(false);
    const [selectedArticle, setSelectedArticle] = useState('');
    const [recentIds, setRecentIds]       = useState([]);
    const recentTimers = useRef({});

    // Quantity modal
    const [pendingArticle, setPendingArticle] = useState(null);
    const [qtyModalOpen, setQtyModalOpen]     = useState(false);

    // Toast
    const [toast, setToast] = useState(null); // { message, type }
    const showToast = (message, type = 'error') => setToast({ message, type });

    // Confirm dialog
    const [confirmDialog, setConfirmDialog] = useState(null); // { title, description, onConfirm }

    // Order nudge — zeigt Vorschlag zum Bestellen nach Erledigung
    const [orderNudge, setOrderNudge] = useState({}); // { [itemId]: true/false }

    // ── Queries ──────────────────────────────────────────────────────────────
    const { data: restockItems = [] } = useQuery({
        queryKey: ['restock-items'],
        queryFn: () => base44.entities.RestockItem.list('-created_date', 100),
        staleTime: STALE.MEDIUM,
    });

    const { data: articles = [], isLoading: articlesLoading, isError: articlesError, error: articlesErrorObj } = useQuery({
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

    // ── Recent highlight ─────────────────────────────────────────────────────
    const markRecent = (id) => {
        setRecentIds(prev => [...prev.filter(x => x !== id), id]);
        if (recentTimers.current[id]) clearTimeout(recentTimers.current[id]);
        recentTimers.current[id] = setTimeout(() => {
            setRecentIds(prev => prev.filter(x => x !== id));
        }, 8000);
    };

    // ── Mutations ────────────────────────────────────────────────────────────
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

    // ── Scan logic ───────────────────────────────────────────────────────────
    // Artikel direkt (per ID) hinzufügen — auch ohne Barcode
    const handleArticleDirect = (article) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const existingItem = restockItems.find(
            item => item.article_id === article.id && item.date === today && !item.is_completed
        );
        setPendingArticle({ article, existingItem: existingItem || null });
        setQtyModalOpen(true);
        setBarcode('');
    };

    const handleScan = (scannedBarcode) => {
        const article = articles.find(a => a.barcode === scannedBarcode);
        if (!article) {
            showToast(`Artikel nicht gefunden: ${scannedBarcode}`, 'error');
            return;
        }
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
                article_id: article.id,         // ID-Verknüpfung (primär)
                barcode: article.barcode || '', // Barcode optional
                article_name: article.name,
                article_image_url: article.image_url || null,
                quantity: qty,
                restocked_by: user?.full_name || user?.email || 'Unbekannt',
                date: format(new Date(), 'yyyy-MM-dd'),
                time: format(new Date(), 'HH:mm'),
                is_completed: false,
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

    const toggleComplete = (item) => {
        const nowCompleted = !item.is_completed;
        updateMutation.mutate({ id: item.id, data: { ...item, is_completed: nowCompleted } });

        // Nudge anzeigen wenn gerade als erledigt markiert
        if (nowCompleted) {
            const alreadyInOrder = shoppingItems.some(
                s => s.item_name === item.article_name && s.status === 'offen'
            );
            if (!alreadyInOrder) {
                setOrderNudge(prev => ({ ...prev, [item.id]: true }));
                setTimeout(() => setOrderNudge(prev => ({ ...prev, [item.id]: false })), 8000);
            }
        } else {
            setOrderNudge(prev => ({ ...prev, [item.id]: false }));
        }
    };

    const addToOrder = async (item) => {
        const article = articles.find(a => a.id === item.article_id);
        await base44.entities.ShoppingList.create({
            item_name:  item.article_name,
            category:   article?.suppliers?.[0] || article?.supplier_details?.[0]?.supplier_name || '',
            quantity:   item.quantity,
            unit:       article?.content_unit || 'Stück',
            status:     'offen',
            notes:      `Aus Auffüllliste vom ${format(new Date(), 'dd.MM.yyyy')}`,
        });
        queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
        queryClient.invalidateQueries({ queryKey: ['shopping-list-restock'] });
        setOrderNudge(prev => ({ ...prev, [item.id]: false }));
        showToast(`${item.article_name} zur Bestellung hinzugefügt`, 'success');
    };

    const handleDelete = (id) => {
        setConfirmDialog({
            title: 'Eintrag löschen?',
            description: 'Dieser Eintrag wird unwiderruflich gelöscht.',
            onConfirm: () => { deleteMutation.mutate(id); setConfirmDialog(null); },
        });
    };

    const handleDeleteCompleted = () => {
        const completedItems = todayItems.filter(item => item.is_completed);
        if (completedItems.length === 0) {
            showToast('Keine erledigten Aufgaben vorhanden', 'info');
            return;
        }
        setConfirmDialog({
            title: `${completedItems.length} Einträge löschen?`,
            description: 'Alle erledigten Aufgaben von heute werden gelöscht.',
            onConfirm: async () => {
                setConfirmDialog(null);
                for (const item of completedItems) {
                    await deleteMutation.mutateAsync(item.id);
                }
            },
        });
    };

    const handleQuantityEdit = (item) => {
        const article = articles.find(a => a.id === item.article_id || a.barcode === item.barcode) || { name: item.article_name, barcode: item.barcode };
        setPendingArticle({ article, existingItem: item });
        setQtyModalOpen(true);
    };

    // ── Sorted / grouped items ────────────────────────────────────────────────
    const todayItems = useMemo(() => {
        return restockItems
            .filter(item => item.date === format(new Date(), 'yyyy-MM-dd'))
            .sort((a, b) => {
                if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
                const aRecent = recentIds.indexOf(a.id);
                const bRecent = recentIds.indexOf(b.id);
                if (aRecent !== -1 || bRecent !== -1) {
                    if (aRecent === -1) return 1;
                    if (bRecent === -1) return -1;
                    return bRecent - aRecent;
                }
                const catA = articles.find(art => art.id === a.article_id || art.barcode === a.barcode)?.category || 'Sonstiges';
                const catB = articles.find(art => art.id === b.article_id || art.barcode === b.barcode)?.category || 'Sonstiges';
                return catA.localeCompare(catB);
            });
    }, [restockItems, recentIds, articles]);

    // ── Autocomplete matches ──────────────────────────────────────────────────
    const searchMatches = useMemo(() => {
        if (!barcode.trim()) return [];
        const q = barcode.toLowerCase();
        return articles.filter(a =>
            a.barcode === barcode ||
            a.name?.toLowerCase().includes(q) ||
            a.barcode?.includes(barcode)
        ).slice(0, 8);
    }, [barcode, articles]);

    // ── Loading / error ───────────────────────────────────────────────────────
    if (articlesLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><LoadingState /></div>;
    if (articlesError) return (
        <div className="min-h-screen bg-background p-4 flex items-center justify-center">
            {handleError({ error: articlesErrorObj, title: 'Artikel konnten nicht geladen werden', onRetry: () => queryClient.invalidateQueries({ queryKey: ['articles'] }) })}
        </div>
    );

    // ── Grouped items ─────────────────────────────────────────────────────────
    const groupedItems = todayItems.reduce((groups, item) => {
        const cat = articles.find(art => art.id === item.article_id || art.barcode === item.barcode)?.category || 'Sonstiges';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
        return groups;
    }, {});

    return (
        <div className="min-h-screen bg-background">
            {/* Toast */}
            {toast && (
                <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                open={!!confirmDialog}
                title={confirmDialog?.title || ''}
                description={confirmDialog?.description}
                onConfirm={confirmDialog?.onConfirm || (() => {})}
                onCancel={() => setConfirmDialog(null)}
            />

            <div className="max-w-2xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Auffülliste</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {todayItems.filter(i => !i.is_completed).length} offen
                        {todayItems.filter(i => i.is_completed).length > 0 && (
                            <> · {todayItems.filter(i => i.is_completed).length} erledigt</>
                        )}
                    </p>
                </div>

                {/* Scanner Card */}
                <Card className="p-5 mb-6 border-border">
                    <form onSubmit={handleBarcodeSubmit} className="space-y-3">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                                <Scan className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground text-sm">Artikel scannen</p>
                                <p className="text-xs text-muted-foreground">Barcode eingeben, scannen oder Artikel suchen</p>
                            </div>
                        </div>

                        <div className="relative">
                            <Input
                                ref={barcodeInputRef}
                                type="text"
                                inputMode="text"
                                value={barcode}
                                onChange={(e) => { setBarcode(e.target.value); setSelectedArticle(''); }}
                                placeholder="Barcode oder Artikelname…"
                                className="h-11 bg-background border-border/70 text-foreground pr-8"
                                autoFocus
                                autoComplete="off"
                            />
                            {barcode && (
                                <button
                                    type="button"
                                    onClick={() => setBarcode('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                            {/* Autocomplete Dropdown */}
                            {searchMatches.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-card border border-border/70 rounded-xl shadow-xl z-20">
                                    {searchMatches.map(article => (
                                        <button
                                            key={article.id}
                                            type="button"
                                            onClick={() => {
                                                setBarcode('');
                                                handleArticleDirect(article);
                                            }}
                                            className="w-full px-4 py-3 text-left hover:bg-secondary border-b border-border/40 last:border-0 transition-colors active:scale-[0.98]"
                                        >
                                            <div className="font-medium text-foreground text-sm">{article.name}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                {article.category || 'Sonstiges'}{article.barcode ? ` · ${article.barcode}` : ''}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {barcode.trim().length >= 2 && searchMatches.length === 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/70 rounded-xl shadow-xl z-20 px-4 py-3 text-sm text-muted-foreground text-center">
                                    Kein Artikel gefunden
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setScannerOpen(true)}
                                className="h-11 border-border/70"
                            >
                                <Camera className="w-4 h-4 mr-2" />
                                Kamera
                            </Button>
                            <Button
                                type="submit"
                                className="h-11 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
                                disabled={!barcode.trim() && !selectedArticle}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Hinzufügen
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* Liste */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-foreground">Heutige Auffülliste</h2>
                        {todayItems.filter(i => i.is_completed).length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDeleteCompleted}
                                className="h-9 border-border/60 text-muted-foreground hover:text-foreground"
                            >
                                <CheckCheck className="w-4 h-4 mr-1.5" />
                                Erledigte löschen
                            </Button>
                        )}
                    </div>

                    {todayItems.length === 0 ? (
                        <Card className="p-10 text-center border-border/40">
                            <Scan className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                            <p className="text-muted-foreground font-medium">Noch keine Artikel erfasst</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Scanne einen Barcode oder suche einen Artikel</p>
                        </Card>
                    ) : (
                        <div className="space-y-5">
                            {Object.entries(groupedItems).map(([category, items]) => (
                                <div key={category}>
                                    {/* Kategorie-Trennlinie */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="h-px bg-border/40 flex-1" />
                                        <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider px-1">{category}</span>
                                        <div className="h-px bg-border/40 flex-1" />
                                    </div>

                                    <div className="space-y-2">
                                        {items.map(item => (
                                            <Card
                                                key={item.id}
                                                className={cn(
                                                    "border-border transition-all",
                                                    item.is_completed && "opacity-50",
                                                    item._offline && "border-yellow-500/40"
                                                )}
                                            >
                                                <div className="flex items-center gap-3 p-4">
                                                    {/* Checkbox */}
                                                    <button
                                                        onClick={() => toggleComplete(item)}
                                                        className={cn(
                                                            "w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all active:scale-90",
                                                            item.is_completed
                                                                ? "bg-green-600 border-green-600"
                                                                : "border-border/70 hover:border-green-500"
                                                        )}
                                                    >
                                                        {item.is_completed && <Check className="w-4 h-4 text-white" />}
                                                    </button>

                                                    {/* Bild */}
                                                    {item.article_image_url && (
                                                        <img
                                                            src={item.article_image_url}
                                                            alt={item.article_name}
                                                            className="w-11 h-11 rounded-lg object-cover border border-border/40 shrink-0"
                                                            loading="lazy"
                                                        />
                                                    )}

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn(
                                                            "font-medium text-sm truncate",
                                                            item.is_completed ? "text-muted-foreground line-through" : "text-foreground"
                                                        )}>
                                                            {item.article_name}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                            <button
                                                                onClick={() => handleQuantityEdit(item)}
                                                                className="font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 active:scale-90 transition-transform"
                                                            >
                                                                {item.quantity}×
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                            <span>·</span>
                                                            <span className="font-mono">{item.barcode}</span>
                                                            {item._offline && <span className="text-yellow-500">⚡ offline</span>}
                                                        </div>
                                                    </div>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-900/20 active:scale-90 transition-all shrink-0"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Order Nudge */}
                                                {orderNudge[item.id] && (
                                                    <div className="flex items-center gap-3 px-4 py-3 border-t border-amber-500/30 bg-amber-500/10 animate-in slide-in-from-top-2 duration-200">
                                                        <ShoppingCart className="w-4 h-4 text-amber-500 shrink-0" />
                                                        <p className="text-xs text-amber-200 flex-1">
                                                            In Bestellliste aufnehmen?
                                                        </p>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => addToOrder(item)}
                                                            className="h-8 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold text-xs"
                                                        >
                                                            <Plus className="w-3 h-3 mr-1" />
                                                            Hinzufügen
                                                        </Button>
                                                        <button
                                                            onClick={() => setOrderNudge(prev => ({ ...prev, [item.id]: false }))}
                                                            className="text-amber-400/60 hover:text-amber-300"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Camera Scanner */}
            <BarcodeScanner
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={handleCameraScan}
            />

            {/* Quantity Modal */}
            <QuantityInputModal
                open={qtyModalOpen}
                onClose={() => { setQtyModalOpen(false); setPendingArticle(null); }}
                onConfirm={handleQtyConfirm}
                articleName={pendingArticle?.article?.name || ''}
                existingQuantity={pendingArticle?.existingItem?.quantity ?? null}
            />
        </div>
    );
}