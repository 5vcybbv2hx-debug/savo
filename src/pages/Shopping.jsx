import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import {
    Plus, ShoppingCart, Trash2, Check, Package, Camera,
    Search, AlertTriangle, MoreVertical, ChevronRight,
    ChevronDown, ScanLine
} from 'lucide-react';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import KanbanScanModal from '../components/shopping/KanbanScanModal';
import SmartCombobox from '@/components/ui/SmartCombobox';
import ArticlePickerSheet from '../components/shopping/ArticlePickerSheet';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
const SUPPLIER_COLORS = [
    'bg-blue-500/15 text-blue-400 border-blue-500/25',
    'bg-orange-500/15 text-orange-400 border-orange-500/25',
    'bg-purple-500/15 text-purple-400 border-purple-500/25',
    'bg-red-500/15 text-red-400 border-red-500/25',
    'bg-green-500/15 text-green-400 border-green-500/25',
    'bg-pink-500/15 text-pink-400 border-pink-500/25',
    'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
];
const getSupplierColor = (idx) => SUPPLIER_COLORS[idx >= 0 ? idx % SUPPLIER_COLORS.length : 0];

function timeAgo(isoStr) {
    if (!isoStr) return '';
    try {
        return format(new Date(isoStr), 'dd.MM. HH:mm', { locale: de });
    } catch { return ''; }
}

// Status-Kette: offen → erhalten
const STATUS_NEXT = { offen: 'erhalten' };
const STATUS_CFG = {
    offen:    { label: 'Offen',     bg: 'bg-slate-500/15 text-slate-300 border-slate-500/25' },
    erhalten: { label: 'Erhalten',  bg: 'bg-green-500/15 text-green-400 border-green-500/25' },
};

// ── Zeilen-Komponente ─────────────────────────────────────────────────────────
function ShoppingRow({ item, suppliers, onStatusChange, onEdit, onDelete, unitPrice }) {
    const supplierIdx = suppliers.findIndex(s => s.name === item.category);
    const statusCfg   = STATUS_CFG[item.status] || STATUS_CFG.offen;
    const nextStatus  = STATUS_NEXT[item.status];
    const isReceived  = item.status === 'erhalten';

    return (
        <div className={cn(
            'flex items-center gap-3 px-3 py-3 rounded-xl border transition-all',
            isReceived
                ? 'bg-green-500/5 border-green-500/15 opacity-60'
                : 'bg-card border-border/50 hover:border-border'
        )}>
            {/* Status-Toggle */}
            <button
                onClick={() => nextStatus && onStatusChange(item, nextStatus)}
                disabled={!nextStatus}
                title={nextStatus ? `Als "${STATUS_CFG[nextStatus]?.label}" markieren` : 'Abgeschlossen'}
                className={cn(
                    'w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    item.status === 'erhalten'
                        ? 'border-green-500 bg-green-500'
                        : 'border-border hover:border-amber-500 active:scale-90'
                )}>
                {item.status === 'erhalten' && <Check className="w-3.5 h-3.5 text-white" />}
            </button>

            {/* Name + Meta */}
            <div className="flex-1 min-w-0">
                <p className={cn(
                    'text-sm font-semibold truncate',
                    isReceived ? 'text-muted-foreground line-through' : 'text-foreground'
                )}>
                    {item.item_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground font-medium">
                        {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                    </span>
                    {item.category && (
                        <Badge variant="outline"
                            className={cn('text-[10px] px-1.5 py-0 h-4 border', getSupplierColor(supplierIdx))}>
                            {item.category}
                        </Badge>
                    )}
                    {unitPrice && (
                        <Badge variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 border-amber-500/25 bg-amber-500/10 text-amber-400">
                            {(unitPrice * (parseFloat(item.quantity) || 1)).toFixed(2)} €
                        </Badge>
                    )}
                    {item.notes && (
                        <span className="text-[10px] text-muted-foreground italic truncate max-w-[120px]">
                            {item.notes}
                        </span>
                    )}
                    {isReceived && item.updated_date && (
                        <span className="text-[10px] text-green-400">
                            ✓ {timeAgo(item.updated_date)}
                        </span>
                    )}
                </div>
            </div>

            {/* Aktionen */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    {nextStatus && (
                        <DropdownMenuItem onClick={() => onStatusChange(item, nextStatus)}>
                            <ChevronRight className="w-4 h-4 mr-2 text-muted-foreground" />
                            Als {STATUS_CFG[nextStatus]?.label} markieren
                        </DropdownMenuItem>
                    )}
                    {item.status !== 'offen' && (
                        <DropdownMenuItem onClick={() => onStatusChange(item, 'offen')}>
                            Zurück auf Offen
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onEdit(item)}>
                        Bearbeiten
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => onDelete(item.id)}
                        className="text-red-400 focus:text-red-400 focus:bg-red-500/10">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Löschen
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

// ── Haupt-Seite ───────────────────────────────────────────────────────────────
export default function Shopping() {
    const permissions  = usePermissions();
    const queryClient  = useQueryClient();

    useEffect(() => {
        const handleOnline = () => syncMutations(base44).catch(console.error);
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    // ── State ─────────────────────────────────────────────────────────────────
    const [modalOpen,         setModalOpen]         = useState(false);
    const [selectedItem,      setSelectedItem]       = useState(null);
    const [supplierFilter,    setSupplierFilter]     = useState('alle');
    const [kanbanOpen,        setKanbanOpen]         = useState(false);
    const [articlePickerOpen, setArticlePickerOpen]  = useState(false);
    const [eanInput,          setEanInput]           = useState('');
    const [deleteConfirm,     setDeleteConfirm]      = useState(null);
    const [deleteAllConfirm,  setDeleteAllConfirm]   = useState(false);
    const [receivedCollapsed, setReceivedCollapsed]  = useState(false);
    const [activeTab, setActiveTab] = useState('offen');
    const [formData, setFormData] = useState({
        item_name: '', category: '', quantity: '', unit: '', status: 'offen', notes: ''
    });

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: items = [] } = useQuery({
        queryKey: ['shopping-list'],
        queryFn: () => base44.entities.ShoppingList.list('-created_date', 200),
        staleTime: 2 * 60 * 1000,
    });

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list('name'),
        staleTime: 10 * 60 * 1000,
    });

    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => base44.entities.Supplier.filter({ is_active: true }, 'order'),
        staleTime: 10 * 60 * 1000,
    });

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: async (data) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'ShoppingList', type: 'create', data });
                return { queued: true };
            }
            return base44.entities.ShoppingList.create(data);
        },
        onSuccess: (r) => { if (!r?.queued) queryClient.invalidateQueries({ queryKey: ['shopping-list'] }); closeModal(); }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'ShoppingList', type: 'update', id, data });
                queryClient.setQueryData(['shopping-list'], old => old?.map(i => i.id === id ? { ...i, ...data } : i) || old);
                return { queued: true };
            }
            return base44.entities.ShoppingList.update(id, data);
        },
        onSuccess: (r) => { if (!r?.queued) queryClient.invalidateQueries({ queryKey: ['shopping-list'] }); closeModal(); },
        onError: () => queryClient.invalidateQueries({ queryKey: ['shopping-list'] }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'ShoppingList', type: 'delete', id });
                queryClient.setQueryData(['shopping-list'], old => old?.filter(i => i.id !== id) || old);
                return { queued: true };
            }
            return base44.entities.ShoppingList.delete(id);
        },
        onSuccess: (r) => { if (!r?.queued) queryClient.invalidateQueries({ queryKey: ['shopping-list'] }); },
        onError: () => queryClient.invalidateQueries({ queryKey: ['shopping-list'] }),
    });

    // ── Handlers ──────────────────────────────────────────────────────────────
    const openModal = (item = null) => {
        if (item) {
            setSelectedItem(item);
            setFormData({
                item_name: item.item_name,
                category:  item.category,
                quantity:  item.quantity,
                unit:      item.unit || '',
                status:    item.status,
                notes:     item.notes || '',
            });
        } else {
            setSelectedItem(null);
            setFormData({
                item_name: '',
                category:  supplierFilter !== 'alle' ? supplierFilter : (suppliers[0]?.name || ''),
                quantity:  '',
                unit:      '',
                status:    'offen',
                notes:     '',
            });
        }
        setModalOpen(true);
    };

    const closeModal = () => { setModalOpen(false); setSelectedItem(null); };

    const handleSubmit = (e) => {
        e.preventDefault();
        const data = { ...formData, quantity: parseFloat(formData.quantity) };
        if (selectedItem) updateMutation.mutate({ id: selectedItem.id, data });
        else              createMutation.mutate(data);
    };

    const handleStatusChange = (item, newStatus) =>
        updateMutation.mutate({ id: item.id, data: { ...item, status: newStatus } });

    const handleDeleteConfirmed = () => {
        if (!deleteConfirm) return;
        deleteMutation.mutate(deleteConfirm);
        setDeleteConfirm(null);
    };

    const handleDeleteAllReceived = async () => {
        for (const item of receivedItems) {
            try { await deleteMutation.mutateAsync(item.id); } catch { /* ignore */ }
        }
        queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
        setDeleteAllConfirm(false);
    };

    const handleArticleAdd = (itemData) => {
        const existing = items.find(i =>
            i.status === 'offen' && (
                (itemData.article_id && i.article_id === itemData.article_id) ||
                i.item_name === itemData.item_name
            )
        );
        if (existing) {
            updateMutation.mutate({
                id: existing.id,
                data: { ...existing, quantity: parseFloat(existing.quantity || 0) + itemData.quantity }
            });
        } else {
            createMutation.mutate(itemData);
        }
    };

    const handleEanSubmit = async (e) => {
        e.preventDefault();
        if (!eanInput.trim()) return;
        const input = eanInput.trim().toLowerCase();
        let article = articles.find(a => a.barcode === eanInput.trim());
        if (!article) article = articles.find(a => a.name.toLowerCase() === input);
        if (!article) article = articles.find(a => a.name.toLowerCase().includes(input));
        if (!article) { toast.error('Artikel nicht gefunden'); setEanInput(''); return; }

        const existing = items.find(i => i.item_name === article.name && i.status === 'offen');
        if (existing) {
            await updateMutation.mutateAsync({
                id: existing.id,
                data: { ...existing, quantity: parseFloat(existing.quantity || 0) + parseFloat(article.quantity || 1) }
            });
        } else {
            await createMutation.mutateAsync({
                item_name: article.name,
                category:  article.suppliers?.[0] || suppliers[0]?.name || '',
                quantity:  parseFloat(article.quantity || 1),
                unit:      article.unit || '',
                status:    'offen',
                notes:     '',
            });
        }
        setEanInput('');
        queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const lowStockSuggestions = useMemo(() =>
        articles.filter(a => {
            if (a.is_active === false) return false;
            if (a.min_stock == null || a.current_stock == null) return false;
            if (a.current_stock > a.min_stock) return false;
            return !items.some(i =>
                i.status === 'offen' && (
                    (a.id && i.article_id === a.id) || i.item_name === a.name
                )
            );
        }), [articles, items]
    );

    const filteredItems = items.filter(i => 
        (supplierFilter === 'alle' || i.category === supplierFilter) &&
        i.status === activeTab
    );

    const openItems     = filteredItems.filter(i => i.status === 'offen');
    const orderedItems  = [];
    const receivedItems = filteredItems.filter(i => i.status === 'erhalten');

    const orderSummary = useMemo(() => {
        const openOrderItems = items.filter(i => i.status === 'offen');
        let totalNet = 0;
        let totalVat7 = 0;
        let totalVat19 = 0;
        let itemsWithPrice = 0;
        let itemsWithoutPrice = 0;

        openOrderItems.forEach(item => {
            const article = articles.find(a => a.name === item.item_name);
            const price = article?.purchase_price || article?.supplier_details?.[0]?.purchase_price;
            if (price) {
                const qty = parseFloat(item.quantity) || 1;
                const lineNet = price * qty;
                const taxRate = article?.tax_rate ?? 19;
                totalNet += lineNet;
                if (taxRate === 7) totalVat7 += lineNet * 0.07;
                else if (taxRate === 19) totalVat19 += lineNet * 0.19;
                itemsWithPrice++;
            } else {
                itemsWithoutPrice++;
            }
        });

        const totalVat = totalVat7 + totalVat19;
        return { totalNet, totalVat, totalVat7, totalVat19, totalGross: totalNet + totalVat, itemsWithPrice, itemsWithoutPrice, openCount: openOrderItems.length };
    }, [items, articles]);

    const getUnitPrice = (item) => {
        const article = articles.find(a => a.name === item.item_name);
        return article?.purchase_price || article?.supplier_details?.[0]?.purchase_price || null;
    };

    const totalOpen     = items.filter(i => i.status === 'offen').length;
    const totalReceived = items.filter(i => i.status === 'erhalten').length;

    if (!permissions.canViewShopping)
        return <PermissionDenied message="Du hast keine Berechtigung, die Einkaufsliste zu sehen." />;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">

                {/* ── Header ────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-amber-500" />
                            Einkaufsliste
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {totalOpen} offen · {totalReceived} erhalten
                        </p>
                    </div>

                    {permissions.canEditShopping && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm"
                                    className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                                    <Plus className="w-4 h-4" />
                                    Hinzufügen
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => setArticlePickerOpen(true)}>
                                    <Search className="w-4 h-4 mr-2 text-muted-foreground" />
                                    Artikel suchen
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setKanbanOpen(true)}>
                                    <ScanLine className="w-4 h-4 mr-2 text-muted-foreground" />
                                    Kanban scannen
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openModal()}>
                                    <Plus className="w-4 h-4 mr-2 text-muted-foreground" />
                                    Manuell eingeben
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {/* ── Live-Kostenkalkulation Banner ────────────────────── */}
                {orderSummary.openCount > 0 && (
                    <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-amber-500/25 bg-amber-500/8">
                        <div>
                            <p className="text-xs text-muted-foreground">Geschätzte Bestellsumme</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-foreground">
                                    {orderSummary.totalGross.toFixed(2)} €
                                </span>
                                {orderSummary.itemsWithoutPrice > 0 && (
                                    <span className="text-xs text-amber-400">
                                        + {orderSummary.itemsWithoutPrice} ohne Preis
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                                <span>Netto: {orderSummary.totalNet.toFixed(2)} €</span>
                                {orderSummary.totalVat7 > 0 && <span>7%: +{orderSummary.totalVat7.toFixed(2)} €</span>}
                                {orderSummary.totalVat19 > 0 && <span>19%: +{orderSummary.totalVat19.toFixed(2)} €</span>}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground">{orderSummary.openCount} Positionen</p>
                            <p className="text-xs text-muted-foreground">{orderSummary.itemsWithPrice} mit Preis</p>
                        </div>
                    </div>
                )}

                {/* ── Tab-Navigation ───────────────────────────────────── */}
                <div className="flex gap-2">
                    {[
                        { id: 'offen',    label: 'Aktuelle Bestellung' },
                        { id: 'erhalten', label: 'Archiv' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex-1 py-2 rounded-full text-xs font-semibold border transition-all flex items-center justify-center gap-1.5',
                                activeTab === tab.id
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'border-border text-muted-foreground bg-card hover:text-foreground'
                            )}
                        >
                            {tab.label}
                            {tab.id === 'offen' && orderSummary.openCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-[10px]">
                                    {orderSummary.openCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── EAN / Schnelleingabe ──────────────────────────────── */}
                {permissions.canEditShopping && activeTab === 'offen' && (
                    <form onSubmit={handleEanSubmit} className="flex gap-2">
                        <SmartCombobox
                            value={eanInput}
                            onChange={setEanInput}
                            options={articles.map(a => a.name)}
                            placeholder="EAN oder Artikelname schnell hinzufügen…"
                            allowCreate={false}
                            className="flex-1"
                        />
                        <Button type="submit"
                            className="h-11 shrink-0 bg-amber-600 hover:bg-amber-700 text-white px-4">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </form>
                )}

                {/* ── Lieferanten-Filter (horizontale Chips) ────────────── */}
                {suppliers.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                        {[{ name: 'alle' }, ...suppliers].map((s, i) => (
                            <button key={s.name}
                                onClick={() => setSupplierFilter(s.name)}
                                className={cn(
                                    'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                    supplierFilter === s.name
                                        ? 'bg-amber-500 border-amber-500 text-white'
                                        : 'border-border text-muted-foreground hover:text-foreground bg-card'
                                )}>
                                {s.name === 'alle' ? 'Alle' : s.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Low-Stock Vorschläge ──────────────────────────────── */}
                {lowStockSuggestions.length > 0 && supplierFilter === 'alle' && activeTab === 'offen' && (
                    <div className="rounded-xl border border-orange-500/25 bg-orange-500/8 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <p className="text-xs font-bold text-orange-400 uppercase tracking-wide">
                                Nachbestellen ({lowStockSuggestions.length})
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            {lowStockSuggestions.map(article => (
                                <div key={article.id}
                                    className="flex items-center gap-2.5 py-1">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{article.name}</p>
                                        <p className="text-[10px] text-orange-400">
                                            Bestand {article.current_stock} / Min. {article.min_stock} {article.content_unit || ''}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleArticleAdd({
                                            article_id: article.id,
                                            item_name:  article.name,
                                            category:   article.supplier_details?.find(s => s.is_primary)?.supplier_name || article.suppliers?.[0] || suppliers[0]?.name || '',
                                            quantity:   Math.max(1, (article.min_stock || 1) - (article.current_stock || 0)),
                                            unit:       article.content_unit || 'Stück',
                                            status:     'offen',
                                            notes:      'Mindestbestand unterschritten',
                                        })}
                                        className="shrink-0 h-7 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors">
                                        + Übernehmen
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Offen ────────────────────────────────────────────── */}
                {openItems.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-0.5">
                            Offen ({openItems.length})
                        </p>
                        {openItems.map(item => (
                            <ShoppingRow key={item.id}
                                item={item}
                                suppliers={suppliers}
                                onStatusChange={handleStatusChange}
                                onEdit={openModal}
                                onDelete={setDeleteConfirm}
                                unitPrice={getUnitPrice(item)}
                            />
                        ))}
                    </div>
                )}

{/* ── Erhalten (einklappbar) ────────────────────────────── */}
                {receivedItems.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-0.5">
                            <button
                                onClick={() => setReceivedCollapsed(c => !c)}
                                className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', receivedCollapsed && '-rotate-90')} />
                                Erhalten ({receivedItems.length})
                            </button>
                            <button
                                onClick={() => setDeleteAllConfirm(true)}
                                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                                <Trash2 className="w-3 h-3" />
                                Alle löschen
                            </button>
                        </div>
                        {!receivedCollapsed && receivedItems.map(item => (
                            <ShoppingRow key={item.id}
                                item={item}
                                suppliers={suppliers}
                                onStatusChange={handleStatusChange}
                                onEdit={openModal}
                                onDelete={setDeleteConfirm}
                                unitPrice={getUnitPrice(item)}
                            />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {filteredItems.length === 0 && lowStockSuggestions.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-semibold text-foreground">Liste ist leer</p>
                        <p className="text-sm mt-1">Füge Artikel über das + Menü hinzu</p>
                    </div>
                )}

                {/* ── Modals & Dialogs ──────────────────────────────────── */}
                <KanbanScanModal
                    open={kanbanOpen}
                    onClose={() => setKanbanOpen(false)}
                    articles={articles}
                    suppliers={suppliers}
                    items={items}
                    onAdd={handleArticleAdd}
                />

                <ArticlePickerSheet
                    open={articlePickerOpen}
                    onClose={() => setArticlePickerOpen(false)}
                    articles={articles}
                    suppliers={suppliers}
                    onAdd={handleArticleAdd}
                />

                {/* Bearbeiten-Modal */}
                <Dialog open={modalOpen} onOpenChange={closeModal}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>{selectedItem ? 'Artikel bearbeiten' : 'Artikel hinzufügen'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                            <div className="space-y-1.5">
                                <Label>Artikelname *</Label>
                                <SmartCombobox
                                    value={formData.item_name}
                                    onChange={(val) => {
                                        const article = articles.find(a => a.name === val);
                                        setFormData(prev => ({
                                            ...prev,
                                            item_name: val,
                                            category:  article?.suppliers?.[0] || prev.category,
                                            quantity:  article?.quantity || prev.quantity,
                                            unit:      article?.unit || prev.unit,
                                        }));
                                    }}
                                    options={articles.map(a => a.name)}
                                    placeholder="Artikel suchen…"
                                    allowCreate={true}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Lieferant *</Label>
                                <Select value={formData.category}
                                    onValueChange={v => setFormData({ ...formData, category: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(s => (
                                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Menge *</Label>
                                    <Input type="number" step="0.01"
                                        value={formData.quantity}
                                        onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                        placeholder="1" required />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Einheit</Label>
                                    <Input value={formData.unit}
                                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                        placeholder="Stk, kg, L…" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Notiz</Label>
                                <Textarea value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Optional…"
                                    rows={2} className="resize-none" />
                            </div>
                            <div className="flex gap-2 pt-1">
                                <Button type="button" variant="outline"
                                    onClick={closeModal} className="flex-1 h-10">
                                    Abbrechen
                                </Button>
                                <Button type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="flex-1 h-10 bg-amber-600 hover:bg-amber-700 text-white">
                                    {createMutation.isPending || updateMutation.isPending ? 'Speichern…' : 'Speichern'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Löschen-Bestätigung */}
                <AlertDialog open={!!deleteConfirm} onOpenChange={o => !o && setDeleteConfirm(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Artikel löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Diese Aktion kann nicht rückgängig gemacht werden.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteConfirmed}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Löschen
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Alle Erhalten löschen */}
                <AlertDialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{receivedItems.length} Artikel löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Alle erhaltenen Artikel werden unwiderruflich gelöscht.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteAllReceived}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Alle löschen
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}