import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import {
    Plus, ShoppingCart, Trash2, Check, Package, Camera,
    Search, AlertTriangle, MoreVertical, ChevronRight,
    ChevronDown, ScanLine, Send, Truck, CheckCircle2,
    XCircle, ArrowRight, ClipboardCheck, RotateCcw
} from 'lucide-react';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

// ── Farben & Status-Config ────────────────────────────────────────────────────
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

const STATUS_CFG = {
    offen:         { label: 'Offen',      icon: Package,      color: 'bg-muted text-muted-foreground border-border' },
    bestellt:      { label: 'Bestellt',   icon: Send,         color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
    erhalten:      { label: 'Erhalten',   icon: Truck,        color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
    abgeschlossen: { label: 'Abgeschl.',  icon: CheckCircle2, color: 'bg-green-500/15 text-green-400 border-green-500/25' },
};

function timeAgo(isoStr) {
    if (!isoStr) return '';
    try { return format(new Date(isoStr), 'dd.MM. HH:mm', { locale: de }); }
    catch { return ''; }
}

// ── ShoppingRow ───────────────────────────────────────────────────────────────
function ShoppingRow({ item, suppliers, onEdit, onDelete, onMarkBestellt, onOpenWareneingang, unitPrice, activeTab }) {
    const supplierIdx = suppliers.findIndex(s => s.name === item.category);
    const isDone = item.status === 'abgeschlossen';
    const hasDiff = item.delivered_quantity != null && item.delivered_quantity !== item.quantity;
    const isShort = hasDiff && item.delivered_quantity < item.quantity;
    const isOver  = hasDiff && item.delivered_quantity > item.quantity;

    return (
        <div className={cn(
            'flex items-center gap-3 px-3 py-3 rounded-xl border transition-all',
            isDone
                ? 'bg-green-500/5 border-green-500/15 opacity-50'
                : item.status === 'erhalten'
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : item.status === 'bestellt'
                        ? 'bg-blue-500/5 border-blue-500/15'
                        : 'bg-card border-border/50 hover:border-border'
        )}>
            {/* Status-Indikator */}
            <div className={cn(
                'w-2 h-2 rounded-full shrink-0',
                item.status === 'abgeschlossen' ? 'bg-green-500' :
                item.status === 'erhalten'      ? 'bg-amber-500' :
                item.status === 'bestellt'      ? 'bg-blue-500' : 'bg-border'
            )} />

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className={cn(
                    'text-sm font-semibold truncate',
                    isDone ? 'text-muted-foreground line-through' : 'text-foreground'
                )}>
                    {item.item_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {/* Menge: bestellt vs geliefert */}
                    {item.status === 'erhalten' || item.status === 'abgeschlossen' ? (
                        <span className="text-xs font-medium">
                            <span className={cn(
                                isShort ? 'text-destructive' : isOver ? 'text-blue-400' : 'text-green-400'
                            )}>
                                {item.delivered_quantity ?? '?'}{item.unit ? ` ${item.unit}` : ''}
                            </span>
                            <span className="text-muted-foreground"> / {item.quantity}{item.unit ? ` ${item.unit}` : ''} bestellt</span>
                            {isShort && <span className="text-destructive ml-1">▼ {(item.quantity - item.delivered_quantity).toFixed(1)} fehlt</span>}
                            {isOver  && <span className="text-blue-400 ml-1">▲ {(item.delivered_quantity - item.quantity).toFixed(1)} extra</span>}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground font-medium">
                            {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                        </span>
                    )}

                    {item.packaging_label && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/25 bg-primary/5 text-primary/80 shrink-0">
                            {item.packaging_label}
                        </Badge>
                    )}
                    {item.category && (
                        <Badge variant="outline"
                            className={cn('text-[10px] px-1.5 py-0 h-4 border shrink-0', getSupplierColor(supplierIdx))}>
                            {item.category}
                        </Badge>
                    )}
                    {item.price_per_pack && item.status === 'offen' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/25 bg-amber-500/10 text-amber-400 tabular-nums shrink-0">
                            {(parseFloat(item.price_per_pack) * (parseFloat(item.quantity) || 1)).toFixed(2)} € ges.
                        </Badge>
                    )}
                    {!item.price_per_pack && unitPrice && item.status === 'offen' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/25 bg-amber-500/10 text-amber-400 tabular-nums shrink-0">
                            ~{(unitPrice * (parseFloat(item.quantity) || 1)).toFixed(2)} €
                        </Badge>
                    )}
                    {item.delivery_note && (
                        <span className="text-[10px] text-amber-400 italic truncate max-w-[140px]">
                            ⚠ {item.delivery_note}
                        </span>
                    )}
                    {item.ordered_at && item.status !== 'offen' && (
                        <span className="text-[10px] text-muted-foreground">
                            Best. {timeAgo(item.ordered_at)}
                        </span>
                    )}
                </div>
            </div>

            {/* Aktions-Button je nach Status */}
            <div className="flex items-center gap-1 shrink-0">
                {activeTab === 'bestellt' && (
                    <Button size="sm" variant="outline"
                        onClick={() => onOpenWareneingang(item)}
                        className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 px-2.5">
                        <Truck className="w-3.5 h-3.5 mr-1" />
                        Eingang
                    </Button>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        {item.status === 'offen' && (
                            <DropdownMenuItem onClick={() => onMarkBestellt([item])}>
                                <Send className="w-4 h-4 mr-2 text-blue-400" />
                                Als bestellt markieren
                            </DropdownMenuItem>
                        )}
                        {item.status === 'bestellt' && (
                            <DropdownMenuItem onClick={() => onOpenWareneingang(item)}>
                                <Truck className="w-4 h-4 mr-2 text-amber-400" />
                                Wareneingang quittieren
                            </DropdownMenuItem>
                        )}
                        {item.status === 'erhalten' && (
                            <DropdownMenuItem onClick={() => onOpenWareneingang(item)}>
                                <RotateCcw className="w-4 h-4 mr-2 text-muted-foreground" />
                                Wareneingang korrigieren
                            </DropdownMenuItem>
                        )}
                        {(item.status === 'offen' || item.status === 'bestellt') && (
                            <DropdownMenuItem onClick={() => onEdit(item)}>
                                Bearbeiten
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => onDelete(item.id)}
                            className="text-destructive focus:text-destructive focus:bg-destructive/10">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Löschen
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

// ── Wareneingang Dialog ───────────────────────────────────────────────────────
function WareneingangDialog({ item, open, onClose, onConfirm }) {
    const [deliveredQty, setDeliveredQty] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (item && open) {
            setDeliveredQty(String(item.quantity ?? ''));
            setNote(item.delivery_note || '');
        }
    }, [item, open]);

    if (!item) return null;

    const delivered = parseFloat(deliveredQty) || 0;
    const ordered   = parseFloat(item.quantity) || 0;
    const diff      = delivered - ordered;
    const isShort   = diff < 0;
    const isOver    = diff > 0;
    const isExact   = diff === 0;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-amber-500" />
                        Wareneingang quittieren
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Artikel-Info */}
                    <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                        <p className="font-semibold text-sm text-foreground">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Bestellt: <span className="font-medium text-foreground">{item.quantity} {item.unit || 'Stück'}</span>
                            {item.category && <> · Lieferant: <span className="font-medium text-foreground">{item.category}</span></>}
                        </p>
                    </div>

                    {/* Gelieferte Menge */}
                    <div>
                        <Label className="text-sm font-medium">Gelieferte Menge</Label>
                        <div className="flex items-center gap-2 mt-1.5">
                            <Input
                                type="number"
                                step="0.5"
                                min="0"
                                value={deliveredQty}
                                onChange={e => setDeliveredQty(e.target.value)}
                                className="h-11 text-lg font-bold text-center"
                                autoFocus
                            />
                            <span className="text-sm text-muted-foreground shrink-0">{item.unit || 'Stück'}</span>
                        </div>
                    </div>

                    {/* Differenz-Anzeige */}
                    {deliveredQty !== '' && (
                        <div className={cn(
                            'rounded-lg px-3 py-2.5 text-sm font-medium flex items-center gap-2',
                            isExact ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            isShort ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                      'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        )}>
                            {isExact && <><Check className="w-4 h-4" /> Vollständig geliefert</>}
                            {isShort && <><XCircle className="w-4 h-4" /> {Math.abs(diff).toFixed(1)} {item.unit || 'Stück'} fehlt</>}
                            {isOver  && <><AlertTriangle className="w-4 h-4" /> {diff.toFixed(1)} {item.unit || 'Stück'} extra</>}
                        </div>
                    )}

                    {/* Notiz */}
                    <div>
                        <Label className="text-sm font-medium text-muted-foreground">Notiz (optional)</Label>
                        <Textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="z.B. Flasche beschädigt, Rest kommt nächste Woche..."
                            className="mt-1.5 resize-none h-16 text-sm"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Abbrechen
                    </Button>
                    <Button
                        onClick={() => onConfirm({ deliveredQty: delivered, note })}
                        disabled={deliveredQty === ''}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
                        <Check className="w-4 h-4 mr-1.5" />
                        Quittieren
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Hauptseite ────────────────────────────────────────────────────────────────
export default function Shopping() {
    const permissions  = usePermissions();
    const queryClient  = useQueryClient();

    useEffect(() => {
        const handleOnline = () => syncMutations(base44).catch(console.error);
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    // ── State ─────────────────────────────────────────────────────────────────
    const [modalOpen,            setModalOpen]            = useState(false);
    const [selectedItem,         setSelectedItem]         = useState(null);
    const [supplierFilter,       setSupplierFilter]       = useState('alle');
    const [kanbanOpen,           setKanbanOpen]           = useState(false);
    const [articlePickerOpen,    setArticlePickerOpen]    = useState(false);
    const [eanInput,             setEanInput]             = useState('');
    const [searchSuggestions,    setSearchSuggestions]    = useState([]);
    const [showSuggestions,      setShowSuggestions]      = useState(false);
    const [deleteConfirm,        setDeleteConfirm]        = useState(null);
    const [wareneingangItem,     setWareneingangItem]     = useState(null);
    const [closeOrderConfirm,    setCloseOrderConfirm]    = useState(false);
    const [markBestelltConfirm,  setMarkBestelltConfirm]  = useState(null); // Array von Items
    const [activeTab,            setActiveTab]            = useState('offen');
    const [formData, setFormData] = useState({
        item_name: '', category: '', quantity: '', unit: '', status: 'offen', notes: ''
    });

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: items = [] } = useQuery({
        queryKey: ['shopping-list'],
        queryFn: () => base44.entities.ShoppingList.list('-created_date', 300),
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

    // Artikel als "bestellt" markieren (einzeln oder alle offenen)
    const handleMarkBestellt = async (itemsToMark) => {
        const now = new Date().toISOString();
        for (const item of itemsToMark) {
            await updateMutation.mutateAsync({
                id: item.id,
                data: { ...item, status: 'bestellt', ordered_at: now }
            });
        }
        queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
        toast.success(`${itemsToMark.length} Artikel als bestellt markiert`);
        setMarkBestelltConfirm(null);
        if (activeTab === 'offen') setActiveTab('bestellt');
    };

    // Wareneingang quittieren
    const handleWareneingangConfirm = async ({ deliveredQty, note }) => {
        const item = wareneingangItem;
        const now  = new Date().toISOString();

        // Gebinde → Einzeleinheiten berechnen
        const article = articles.find(a => a.id === item.article_id || a.name === item.item_name);
        const primarySupplier = article?.supplier_details?.find(s => s.is_primary) || article?.supplier_details?.[0];
        const usedOpt = (primarySupplier?.packaging_options || []).find(o => o.id === item.packaging_option_id)
            || (primarySupplier?.packaging_options || []).find(o => o.is_default)
            || null;
        const unitsPerPack = parseFloat(usedOpt?.units_per_pack) || 1;
        const deliveredUnits = deliveredQty * unitsPerPack;

        await updateMutation.mutateAsync({
            id: item.id,
            data: {
                ...item,
                status:             'erhalten',
                delivered_quantity: deliveredQty,
                delivered_units:    deliveredUnits,
                received_at:        now,
                delivery_note:      note || null,
            }
        });

        // Lagerbestand erhöhen (in Einzeleinheiten)
        if (item.article_id && deliveredUnits > 0) {
            if (article) {
                const newStock = (parseFloat(article.current_stock) || 0) + deliveredUnits;
                await base44.entities.Article.update(article.id, { current_stock: newStock });
                queryClient.invalidateQueries({ queryKey: ['articles'] });
                const packLabel = usedOpt ? `${deliveredQty}× ${usedOpt.packaging_type}` : `${deliveredUnits} Stück`;
                toast.success(`${article.name}: +${packLabel} → ${newStock} ${article.content_unit || 'Stück'} im Lager`);
            }
        }

        queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
        setWareneingangItem(null);
        toast.success('Wareneingang quittiert');
        setActiveTab('erhalten');
    };

    // Bestellung abschließen (alle "erhalten" Items)
    const handleCloseOrder = async () => {
        const receivedAll = items.filter(i => i.status === 'erhalten' &&
            (supplierFilter === 'alle' || i.category === supplierFilter));
        for (const item of receivedAll) {
            await updateMutation.mutateAsync({
                id: item.id,
                data: { ...item, status: 'abgeschlossen' }
            });
        }
        queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
        setCloseOrderConfirm(false);
        toast.success(`Bestellung abgeschlossen — ${receivedAll.length} Artikel archiviert`);
        setActiveTab('abgeschlossen');
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
                data: { ...existing, quantity: parseFloat(existing.quantity || 0) + 1 }
            });
        } else {
            const _ps = article.supplier_details?.find(s => s.is_primary) || article.supplier_details?.[0];
            const _d  = (_ps?.packaging_options || []).find(o => o.is_default) || (_ps?.packaging_options || [])[0];
            await createMutation.mutateAsync({
                item_name:  article.name,
                article_id: article.id,
                category:   article.suppliers?.[0] || _ps?.supplier_name || suppliers[0]?.name || '',
                quantity:   1,
                unit:       _d?.packaging_type || 'Stück',
                status:     'offen',
            });
        }
        setEanInput('');
        queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    };

    // Live-Suche: Vorschläge beim Tippen
    const handleEanChange = (value) => {
        setEanInput(value);
        if (value.trim().length < 2) {
            setSearchSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        const q = value.trim().toLowerCase();
        const matches = articles.filter(a =>
            a.is_active !== false && (
                a.name?.toLowerCase().includes(q) ||
                a.barcode?.includes(value.trim()) ||
                a.category?.toLowerCase().includes(q)
            )
        ).slice(0, 6);
        setSearchSuggestions(matches);
        setShowSuggestions(matches.length > 0);
    };

    const handleSuggestionSelect = async (article) => {
        setShowSuggestions(false);
        setEanInput('');
        const existing = items.find(i => i.item_name === article.name && i.status === 'offen');
        if (existing) {
            await updateMutation.mutateAsync({
                id: existing.id,
                data: { ...existing, quantity: parseFloat(existing.quantity || 0) + 1 }
            });
            toast.success(`${article.name} — Menge erhöht`);
        } else {
            const ps2 = article.supplier_details?.find(s=>s.is_primary)||article.supplier_details?.[0];
            const d2  = (ps2?.packaging_options||[]).find(o=>o.is_default)||(ps2?.packaging_options||[])[0];
            const _sn = ps2?.supplier_name || article.suppliers?.[0] || suppliers[0]?.name || '';
            await createMutation.mutateAsync({
                item_name:           article.name,
                article_id:          article.id,
                category:            _sn,
                supplier_name:       _sn,
                packaging_option_id: d2?.id || null,
                packaging_label:     d2 ? `${d2.packaging_type} ${d2.units_per_pack}×` : null,
                price_per_unit:      d2?.price_per_unit || article.purchase_price || null,
                quantity:            1,
                unit:                d2?.packaging_type || 'Stück',
                status:              'offen',
            });
            toast.success(`${article.name} hinzugefügt`);
        }
        queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const lowStockSuggestions = useMemo(() =>
        articles.filter(a => {
            if (a.is_active === false) return false;
            if (a.min_stock == null || a.current_stock == null) return false;
            if (a.current_stock > a.min_stock) return false;
            return !items.some(i =>
                (i.status === 'offen' || i.status === 'bestellt') && (
                    (a.id && i.article_id === a.id) || i.item_name === a.name
                )
            );
        }), [articles, items]
    );

    const filteredItems = useMemo(() =>
        items.filter(i =>
            (supplierFilter === 'alle' || i.category === supplierFilter) &&
            i.status === activeTab
        ), [items, supplierFilter, activeTab]
    );

    const orderSummary = useMemo(() => {
        const openOrderItems = items.filter(i => i.status === 'offen');
        let totalNet = 0, totalVat7 = 0, totalVat19 = 0;
        let itemsWithPrice = 0, itemsWithoutPrice = 0;

        openOrderItems.forEach(item => {
            const article = articles.find(a => a.name === item.item_name);
            const price = item.price_per_unit || article?.purchase_price || article?.supplier_details?.find(s=>s.is_primary)?.purchase_price || article?.supplier_details?.[0]?.purchase_price;
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
        return item?.price_per_unit || article?.purchase_price || article?.supplier_details?.find(s=>s.is_primary)?.purchase_price || article?.supplier_details?.[0]?.purchase_price || null;
    };

    // Tab-Counts
    const counts = useMemo(() => ({
        offen:         items.filter(i => i.status === 'offen').length,
        bestellt:      items.filter(i => i.status === 'bestellt').length,
        erhalten:      items.filter(i => i.status === 'erhalten').length,
        abgeschlossen: items.filter(i => i.status === 'abgeschlossen').length,
    }), [items]);

    // Aktive Lieferanten für Filter
    const activeSuppliers = useMemo(() => {
        const names = new Set(items.filter(i => i.status === activeTab).map(i => i.category).filter(Boolean));
        return suppliers.filter(s => names.has(s.name));
    }, [items, suppliers, activeTab]);

    if (!permissions.canViewShopping)
        return <PermissionDenied message="Du hast keine Berechtigung, die Bestellungen zu sehen." />;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">

                {/* ── Header ────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-primary" />
                            Bestellungen
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {counts.offen} offen · {counts.bestellt} bestellt · {counts.erhalten} im Eingang
                        </p>
                    </div>

                    {permissions.canEditShopping && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" className="h-9 gap-1.5">
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

                {/* ── Kostenkalkulation Banner (nur Tab Offen) ──────────── */}
                {activeTab === 'offen' && orderSummary.openCount > 0 && (
                    <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-primary/25 bg-primary/5">
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
                        {/* Alle bestellen Button */}
                        {permissions.canEditShopping && (
                            <Button
                                onClick={() => setMarkBestelltConfirm(items.filter(i => i.status === 'offen'))}
                                className="h-10 shrink-0 gap-1.5 bg-primary hover:bg-primary/90">
                                <Send className="w-4 h-4" />
                                Bestellt!
                            </Button>
                        )}
                    </div>
                )}

                {/* ── Wareneingang abschließen Banner ───────────────────── */}
                {activeTab === 'erhalten' && filteredItems.length > 0 && permissions.canEditShopping && (
                    <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-green-500/25 bg-green-500/5">
                        <div>
                            <p className="text-sm font-semibold text-foreground">
                                {filteredItems.length} Artikel quittiert
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Alles vollständig? Bestellung jetzt abschließen.
                            </p>
                        </div>
                        <Button
                            onClick={() => setCloseOrderConfirm(true)}
                            className="h-10 shrink-0 gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                            <ClipboardCheck className="w-4 h-4" />
                            Abschließen
                        </Button>
                    </div>
                )}

                {/* ── Niedrigbestand-Hinweise ───────────────────────────── */}
                {lowStockSuggestions.length > 0 && activeTab === 'offen' && (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                            <p className="text-sm font-semibold text-foreground">
                                {lowStockSuggestions.length} Artikel unter Mindestbestand
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {lowStockSuggestions.slice(0, 8).map(a => (
                                <button key={a.id}
                                    onClick={() => {
                                        const _ps = a.supplier_details?.find(s => s.is_primary) || a.supplier_details?.[0];
                                        const _sn = _ps?.supplier_name || a.suppliers?.[0] || suppliers[0]?.name || '';
                                        const _d  = (_ps?.packaging_options||[]).find(o=>o.is_default)||(_ps?.packaging_options||[])[0];
                                        handleArticleAdd({
                                            item_name:           a.name,
                                            article_id:          a.id,
                                            category:            _sn,
                                            supplier_name:       _sn,
                                            packaging_option_id: _d?.id || null,
                                            packaging_label:     _d ? `${_d.packaging_type} ${_d.units_per_pack}×` : null,
                                            price_per_unit:      _d?.price_per_unit || a.purchase_price || null,
                                            price_per_pack:      _d?.price_per_pack || null,
                                            quantity:            Math.max(1, (a.min_stock || 1) - (a.current_stock || 0)),
                                            unit:                _d?.packaging_type || 'Stück',
                                            status:              'offen',
                                        });
                                    }}
                                    className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-colors">
                                    + {a.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Status-Tabs ───────────────────────────────────────── */}
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                    {[
                        { id: 'offen',         label: 'Offen',       icon: Package },
                        { id: 'bestellt',      label: 'Bestellt',    icon: Send },
                        { id: 'erhalten',      label: 'Wareneingang',icon: Truck },
                        { id: 'abgeschlossen', label: 'Archiv',      icon: CheckCircle2 },
                    ].map(tab => {
                        const count = counts[tab.id];
                        return (
                            <button key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-full text-xs font-semibold border transition-all',
                                    activeTab === tab.id
                                        ? 'bg-primary border-primary text-primary-foreground'
                                        : 'border-border text-muted-foreground hover:text-foreground bg-card'
                                )}>
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                                {count > 0 && (
                                    <span className={cn(
                                        'text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center',
                                        activeTab === tab.id ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                                    )}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── Lieferanten-Filter ────────────────────────────────── */}
                {activeSuppliers.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                        {['alle', ...activeSuppliers.map(s => s.name)].map((name, idx) => (
                            <button key={name}
                                onClick={() => setSupplierFilter(name)}
                                className={cn(
                                    'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                                    supplierFilter === name
                                        ? 'bg-card border-foreground text-foreground'
                                        : 'border-border text-muted-foreground hover:text-foreground bg-transparent'
                                )}>
                                {name === 'alle' ? 'Alle Lieferanten' : name}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── EAN / Schnellsuche (nur Tab Offen) ───────────────── */}
                {activeTab === 'offen' && permissions.canEditShopping && (
                    <div className="relative">
                        <form onSubmit={handleEanSubmit} className="flex gap-2">
                            <Input
                                value={eanInput}
                                onChange={e => handleEanChange(e.target.value)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                onFocus={() => searchSuggestions.length > 0 && setShowSuggestions(true)}
                                placeholder="Barcode oder Artikelname eingeben..."
                                className="h-10 text-sm flex-1"
                                autoComplete="off"
                            />
                            <Button type="submit" variant="outline" size="icon" className="h-10 w-10 shrink-0">
                                <Search className="w-4 h-4" />
                            </Button>
                        </form>

                        {/* Live-Vorschläge Dropdown */}
                        {showSuggestions && searchSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
                                {searchSuggestions.map(article => {
                                    const alreadyInList = items.some(i => i.item_name === article.name && i.status === 'offen');
                                    return (
                                        <button
                                            key={article.id}
                                            type="button"
                                            onMouseDown={() => handleSuggestionSelect(article)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors border-b border-border/40 last:border-0"
                                        >
                                            {article.image_url
                                                ? <img src={article.image_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                                                : <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                    <Package className="w-4 h-4 text-muted-foreground/40" />
                                                  </div>
                                            }
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{article.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {article.category || 'Sonstiges'}
                                                    {article.barcode ? ` · ${article.barcode}` : ''}
                                                </p>
                                            </div>
                                            {alreadyInList
                                                ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium shrink-0">In Liste</span>
                                                : <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                                            }
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Item-Liste ────────────────────────────────────────── */}
                <div className="space-y-2">
                    {filteredItems.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-medium">
                                {activeTab === 'offen' ? 'Bestellliste ist leer' :
                                 activeTab === 'bestellt' ? 'Keine offenen Bestellungen' :
                                 activeTab === 'erhalten' ? 'Kein Wareneingang ausstehend' :
                                 'Noch keine abgeschlossenen Bestellungen'}
                            </p>
                            {activeTab === 'offen' && (
                                <p className="text-xs mt-1 opacity-60">Artikel über "+ Hinzufügen" ergänzen</p>
                            )}
                        </div>
                    ) : (
                        filteredItems.map(item => (
                            <ShoppingRow
                                key={item.id}
                                item={item}
                                suppliers={suppliers}
                                activeTab={activeTab}
                                unitPrice={getUnitPrice(item)}
                                onEdit={openModal}
                                onDelete={(id) => setDeleteConfirm(id)}
                                onMarkBestellt={(items) => setMarkBestelltConfirm(items)}
                                onOpenWareneingang={(item) => setWareneingangItem(item)}
                            />
                        ))
                    )}
                </div>

            </div>

            {/* ── Wareneingang Dialog ───────────────────────────────────── */}
            <WareneingangDialog
                item={wareneingangItem}
                open={!!wareneingangItem}
                onClose={() => setWareneingangItem(null)}
                onConfirm={handleWareneingangConfirm}
            />

            {/* ── Bestellung abgeben Confirm ────────────────────────────── */}
            <AlertDialog open={!!markBestelltConfirm} onOpenChange={(o) => !o && setMarkBestelltConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Send className="w-5 h-5 text-blue-400" />
                            Bestellung aufgeben?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {markBestelltConfirm?.length} Artikel werden als "bestellt" markiert.
                            Du hast die Bestellung beim Lieferanten aufgegeben?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleMarkBestellt(markBestelltConfirm)}>
                            Ja, Bestellung aufgegeben
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Bestellung abschließen Confirm ────────────────────────── */}
            <AlertDialog open={closeOrderConfirm} onOpenChange={setCloseOrderConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <ClipboardCheck className="w-5 h-5 text-green-400" />
                            Bestellung abschließen?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Alle quittieren Artikel werden ins Archiv verschoben. Lagerbestände wurden bereits beim Quittieren aktualisiert.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Noch nicht</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleCloseOrder}
                            className="bg-green-600 hover:bg-green-700 text-white">
                            Abschließen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Löschen Confirm ───────────────────────────────────────── */}
            <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Artikel löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dieser Eintrag wird dauerhaft aus der Bestellliste entfernt.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { deleteMutation.mutate(deleteConfirm); setDeleteConfirm(null); }}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Artikel hinzufügen Modal ──────────────────────────────── */}
            <Dialog open={modalOpen} onOpenChange={closeModal}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedItem ? 'Artikel bearbeiten' : 'Artikel hinzufügen'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-3 pt-1">
                        <div>
                            <Label className="text-xs text-muted-foreground">Artikelname *</Label>
                            <SmartCombobox
                                value={formData.item_name}
                                onChange={v => setFormData(p => ({ ...p, item_name: v }))}
                                options={articles.map(a => a.name)}
                                placeholder="Artikel suchen oder eingeben..."
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Lieferant *</Label>
                            <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                                <SelectTrigger className="h-9 mt-1">
                                    <SelectValue placeholder="Lieferant wählen" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.map(s => (
                                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs text-muted-foreground">Menge *</Label>
                                <Input type="number" step="0.5" min="0"
                                    value={formData.quantity}
                                    onChange={e => setFormData(p => ({ ...p, quantity: e.target.value }))}
                                    className="h-9 mt-1" required />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Einheit</Label>
                                <Input value={formData.unit}
                                    onChange={e => setFormData(p => ({ ...p, unit: e.target.value }))}
                                    placeholder="Stück, Kiste..."
                                    className="h-9 mt-1" />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Notiz</Label>
                            <Textarea value={formData.notes}
                                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                                className="mt-1 h-16 resize-none text-sm" />
                        </div>
                        <div className="flex gap-2 pt-1">
                            <Button type="button" variant="outline" onClick={closeModal} className="flex-1 h-10">
                                Abbrechen
                            </Button>
                            <Button type="submit" className="flex-1 h-10">
                                {selectedItem ? 'Speichern' : 'Hinzufügen'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Picker & Scanner ──────────────────────────────────────── */}
            <KanbanScanModal open={kanbanOpen} onClose={() => setKanbanOpen(false)} onAdd={handleArticleAdd} articles={articles} suppliers={suppliers} />
            <ArticlePickerSheet open={articlePickerOpen} onClose={() => setArticlePickerOpen(false)} onAdd={handleArticleAdd} articles={articles} suppliers={suppliers} />
        </div>
    );
}