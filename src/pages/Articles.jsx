/**
 * Articles — Artikeldatenbank
 * - Artikel deaktivieren statt löschen
 * - Edit via ArticleModal (kein Seitenwechsel)
 * - Kategorie-Chips horizontal scrollbar
 * - Niedrigbestand-Alert
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import {
    Plus, Search, Camera, Package, AlertTriangle,
    MoreVertical, Download,
    EyeOff, Eye, ChevronDown
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import ArticleModal from '@/components/articles/ArticleModal';
import BarcodeScanner from '@/components/restock/BarcodeScanner';
import CategoryManager from '@/components/articles/CategoryManager';
import PDFExportButton from '@/components/export/PDFExportButton';
import BulkImporter from '@/components/articles/BulkImporter';
import LabelPrinter from '@/components/articles/LabelPrinter';
import LazyImage from '@/components/ui/lazy-image';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getMenuItemSourceArticles, unionAllergensAdditives } from '@/lib/allergenSync';
import { format } from 'date-fns';

// ── Artikel-Zeile ─────────────────────────────────────────────────────────────
function ArticleRow({ article, isLowStock, onEdit, onToggleActive, isManager, assignments }) {
    const stock    = article.current_stock ?? 0;
    const minStock = article.min_stock ?? 0;

    return (
        <div
            onClick={() => onEdit(article)}
            className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer active:scale-[0.99]',
                article.is_active === false
                    ? 'opacity-40 bg-secondary/20 border-border/30'
                    : isLowStock
                    ? 'bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40'
                    : 'bg-card border-border/50 hover:border-border hover:bg-accent/20'
            )}>
            {/* Bild */}
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary/50 shrink-0">
                {article.image_url ? (
                    <LazyImage src={article.image_url} alt={article.name}
                        className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{article.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {/* Bestand */}
                    <span className={cn(
                        'text-xs font-medium',
                        isLowStock ? 'text-orange-400' : 'text-muted-foreground'
                    )}>
                        {stock}{minStock > 0 ? ` / ${minStock}` : ''}
                        {article.content_unit ? ` ${article.content_unit}` : ''}
                        {isLowStock && ' ⚠️'}
                    </span>
                    {/* Lieferant */}
                    {article.supplier_details?.[0]?.supplier_name && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                            {article.supplier_details[0].supplier_name}
                        </span>
                    )}
                    {/* Lagerort */}
                    {assignments.length > 0 && (
                        <span className="text-[10px] text-muted-foreground/60">
                            📍 {assignments[0].slot_full_name}{assignments.length > 1 && ` +${assignments.length - 1}`}
                        </span>
                    )}
                </div>
            </div>

            {/* Aktivieren/Deaktivieren — nur für Manager, stoppt Bubbling */}
            {isManager && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"
                            onClick={e => e.stopPropagation()}
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleActive(article); }}
                            className={article.is_active === false
                                ? 'text-green-400 focus:text-green-400'
                                : 'text-muted-foreground'}>
                            {article.is_active === false ? (
                                <><Eye className="w-4 h-4 mr-2" />Reaktivieren</>
                            ) : (
                                <><EyeOff className="w-4 h-4 mr-2" />Deaktivieren</>
                            )}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function Articles() {
    const queryClient = useQueryClient();
    const permissions = usePermissions();

    useEffect(() => {
        const handleOnline = () => syncMutations(base44).catch(console.error);
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    // ── State ─────────────────────────────────────────────────────────────────
    const [searchTerm,      setSearchTerm]     = useState('');
    const [filterCategory,  setFilterCategory] = useState('all');
    const [showInactive,    setShowInactive]   = useState(false);
    const [modalOpen,       setModalOpen]      = useState(false);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [scannerOpen,     setScannerOpen]    = useState(false);
    const [deactivateConfirm, setDeactivateConfirm] = useState(null);

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list('order'),
        staleTime: STALE.MEDIUM,
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['article-categories'],
        queryFn: () => base44.entities.ArticleCategory.list('order'),
        staleTime: STALE.SLOW,
    });

    const { data: storageAssignments = [] } = useQuery({
        queryKey: ['storage-assignments-active'],
        queryFn: () => base44.entities.StorageAssignment.filter({ is_active: true }, 'article_name', 1000),
        staleTime: STALE.SLOW,
    });

    const assignmentMap = useMemo(() => {
        const map = {};
        for (const a of storageAssignments) {
            if (!map[a.article_id]) map[a.article_id] = [];
            map[a.article_id].push(a);
        }
        return map;
    }, [storageAssignments]);

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: async (data) => {
            if (!data.barcode) data.barcode = `GEN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'Article', type: 'create', data });
                return { ...data, id: `offline-${Date.now()}`, _offline: true };
            }
            return base44.entities.Article.create(data);
        },
        onSuccess: (newArticle) => {
            queryClient.setQueryData(['articles'], old => old ? [...old, newArticle] : [newArticle]);
            if (!newArticle._offline) queryClient.invalidateQueries({ queryKey: ['articles'] });
            setModalOpen(false);
            setSelectedArticle(null);
            toast.success('Artikel erstellt');
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'Article', type: 'update', id, data });
                return { queued: true };
            }
            return base44.entities.Article.update(id, data);
        },
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries(['articles']);
            const previous = queryClient.getQueryData(['articles']);
            queryClient.setQueryData(['articles'], old => old?.map(a => a.id === id ? { ...a, ...data } : a));
            return { previous };
        },
        onError: (_, __, context) => queryClient.setQueryData(['articles'], context.previous),
        onSuccess: async (result, variables) => {
            if (!result?.queued) queryClient.invalidateQueries({ queryKey: ['articles'] });
            setModalOpen(false);
            setSelectedArticle(null);

            // Allergene/Zusatzstoffe des Artikels haben sich evtl. geändert
            // → an alle Getränke kaskadieren, die diesen Artikel (direkt oder über ein Rezept) verwenden.
            const articleId = variables?.id;
            const changedAllergenFields = variables?.data && ('allergens_list' in variables.data || 'additives' in variables.data);
            if (!result?.queued && articleId && changedAllergenFields) {
                try {
                    const [allArticles, allRecipes, allMenuItems] = await Promise.all([
                        base44.entities.Article.list('name', 500),
                        base44.entities.Recipe.list('name', 500),
                        base44.entities.MenuItem.list('name', 500),
                    ]);
                    const affectedRecipeIds = new Set(
                        allRecipes.filter(r =>
                            (r.ingredients || []).some(ing => ing.article_id === articleId) ||
                            (r.mix_variants || []).some(v => (v.ingredients || []).some(ing => ing.article_id === articleId))
                        ).map(r => r.id)
                    );
                    const affected = allMenuItems.filter(mi =>
                        (mi.use_recipe_calculation && affectedRecipeIds.has(mi.linked_recipe_id)) ||
                        mi.linked_article_id === articleId ||
                        (mi.linked_article_ids || []).includes(articleId)
                    );
                    if (affected.length > 0) {
                        await Promise.all(affected.map(mi => {
                            const sourceArticles = getMenuItemSourceArticles(mi, allArticles, allRecipes);
                            const { allergens, additives } = unionAllergensAdditives(sourceArticles);
                            return base44.entities.MenuItem.update(mi.id, { allergens_list: allergens, additives });
                        }));
                        queryClient.invalidateQueries({ queryKey: ['menu-items'] });
                    }
                } catch (syncErr) {
                    console.warn('[Articles] Allergen-Sync zu MenuItems fehlgeschlagen:', syncErr);
                }
            }
        },
    });

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleAdd = () => { setSelectedArticle(null); setModalOpen(true); };
    const handleEdit = (article) => { setSelectedArticle(article); setModalOpen(true); };

    const handleSave = (data, id) => {
        if (id) updateMutation.mutate({ id, data });
        else    createMutation.mutate({ ...data, is_active: true });
    };

    const handleToggleActive = (article) => {
        if (article.is_active !== false) {
            // Deaktivieren → Bestätigung
            setDeactivateConfirm(article);
        } else {
            // Reaktivieren → sofort
            updateMutation.mutate({ id: article.id, data: { is_active: true } });
            toast.success(`${article.name} reaktiviert`);
        }
    };

    const handleDeactivateConfirmed = () => {
        if (!deactivateConfirm) return;
        updateMutation.mutate({ id: deactivateConfirm.id, data: { is_active: false } });
        toast.success(`${deactivateConfirm.name} deaktiviert`);
        setDeactivateConfirm(null);
    };

    const handleScannerResult = (barcode) => {
        const article = articles.find(a => a.barcode === barcode);
        if (article) {
            handleEdit(article);
        } else {
            setSelectedArticle({ barcode });
            setModalOpen(true);
        }
        setScannerOpen(false);
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const activeArticles = useMemo(() =>
        articles.filter(a => showInactive || a.is_active !== false),
        [articles, showInactive]
    );

    const lowStockIds = useMemo(() =>
        new Set(articles.filter(a => a.min_stock > 0 && (a.current_stock ?? 0) < a.min_stock).map(a => a.id)),
        [articles]
    );

    const filteredArticles = useMemo(() => {
        const q = searchTerm.toLowerCase();
        return activeArticles.filter(a => {
            const matchSearch = !q ||
                a.name?.toLowerCase().includes(q) ||
                a.barcode?.includes(q);
            const matchCat = filterCategory === 'all' || filterCategory === '__low_stock__' || a.category === filterCategory;
            const matchLowStock = filterCategory !== '__low_stock__' || (a.min_stock > 0 && (a.current_stock ?? 0) < a.min_stock);
            return matchSearch && matchCat && matchLowStock;
        });
    }, [activeArticles, searchTerm, filterCategory]);

    const groupedArticles = useMemo(() => {
        const catNames = categories.map(c => c.name);
        const groups = categories
            .filter(cat => filterCategory === 'all' || filterCategory === '__low_stock__' || cat.name === filterCategory)
            .map(cat => ({
                cat,
                items: filteredArticles.filter(a => a.category === cat.name),
            }))
            .filter(g => g.items.length > 0);

        const uncategorized = filteredArticles.filter(a => !a.category || !catNames.includes(a.category));
        if (uncategorized.length > 0 && filterCategory === 'all') {
            groups.push({ cat: { id: '__other', name: 'Sonstiges' }, items: uncategorized });
        }
        return groups;
    }, [filteredArticles, categories, filterCategory]);

    // Flache Liste in exakt der auf dem Bildschirm sichtbaren Reihenfolge (Gruppen + Items) —
    // Basis für die Weiterblättern-Navigation im ArticleModal (Prev/Next).
    const flatVisibleArticles = useMemo(() =>
        groupedArticles.flatMap(g => g.items),
        [groupedArticles]
    );

    // Weiterblättern im Artikel-Modal (Prev/Next) — folgt exakt der sichtbaren,
    // gefilterten/gruppierten Liste, damit die Reihenfolge zum Bildschirm passt.
    const handleNavigateArticle = (direction) => {
        if (!selectedArticle?.id) return;
        const idx = flatVisibleArticles.findIndex(a => a.id === selectedArticle.id);
        if (idx === -1) return;
        const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= flatVisibleArticles.length) return;
        setSelectedArticle(flatVisibleArticles[nextIdx]);
    };

    const articleNavPosition = useMemo(() => {
        if (!selectedArticle?.id) return null;
        const idx = flatVisibleArticles.findIndex(a => a.id === selectedArticle.id);
        if (idx === -1) return null;
        return { index: idx, total: flatVisibleArticles.length, hasPrev: idx > 0, hasNext: idx < flatVisibleArticles.length - 1 };
    }, [selectedArticle, flatVisibleArticles]);

    const lowStockArticles = useMemo(() =>
        articles.filter(a => a.is_active !== false && lowStockIds.has(a.id)),
        [articles, lowStockIds]
    );

    // ── CSV Export ─────────────────────────────────────────────────────────────
    const exportCSV = () => {
        const headers = [
            'Name', 'Barcode', 'Kategorie', 'Bestand', 'Mindestbestand',
            'Verkaufspreis', 'Einkaufspreis', 'Einheit', 'Lieferant',
            'Aktiv', 'Notizen'
        ];
        const escape = (val) => {
            if (val == null) return '';
            const s = String(val);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        };
        const rows = filteredArticles.map(a => [
            escape(a.name),
            escape(a.barcode),
            escape(a.category),
            escape(a.current_stock),
            escape(a.min_stock),
            escape(a.sale_price),
            escape(a.purchase_price),
            escape(a.content_unit || a.unit),
            escape(a.supplier),
            escape(a.is_active === false ? 'Nein' : 'Ja'),
            escape(a.notes)
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const bom = '\uFEFF';
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `artikeldatenbank-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`${filteredArticles.length} Artikel als CSV exportiert`);
    };

    if (!permissions.canEditShopping) return <PermissionDenied />;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">

                {/* ── Header ────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <Package className="w-5 h-5 text-amber-500" />
                            Artikeldatenbank
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Alle Artikel mit Preisen, Lieferanten und Beständen
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {permissions.isManager && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9 px-2.5">
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => setScannerOpen(true)}>
                                        <Camera className="w-4 h-4 mr-2 text-muted-foreground" />
                                        Barcode scannen
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <span><BulkImporter /></span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <span><LabelPrinter articles={filteredArticles} /></span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <span>
                                            <PDFExportButton
                                                data={filteredArticles}
                                                filename="artikel"
                                                title="Artikeldatenbank"
                                                columns={[
                                                    { label: 'Name', field: 'name' },
                                                    { label: 'Barcode', field: 'barcode' },
                                                    { label: 'Kategorie', field: 'category' },
                                                    { label: 'Bestand', render: a => `${a.current_stock || 0}/${a.min_stock || '-'}` },
                                                    { label: 'Preis', render: a => a.purchase_price?.toFixed(2) || '-' },
                                                ]}
                                                variant="ghost"
                                                className="w-full justify-start px-2 h-8 text-sm font-normal"
                                            />
                                        </span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={exportCSV}>
                                        <Download className="w-4 h-4 mr-2 text-muted-foreground" />
                                        CSV exportieren
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setShowInactive(s => !s)}>
                                        {showInactive
                                            ? <><EyeOff className="w-4 h-4 mr-2" />Inaktive ausblenden</>
                                            : <><Eye className="w-4 h-4 mr-2" />Inaktive anzeigen</>
                                        }
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        <CategoryManager />
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        <Button size="sm"
                            onClick={handleAdd}
                            className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                            <Plus className="w-4 h-4" />
                            Neu
                        </Button>
                    </div>
                </div>

                {/* ── Suche ─────────────────────────────────────────────── */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Name oder Barcode suchen…"
                        className="pl-9 h-10"
                    />
                </div>

                {/* ── Kategorie-Chips ────────────────────────────────────── */}
                <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                    {[{ id: 'all', name: 'Alle' }, ...categories].map(cat => (
                        <button key={cat.id} onClick={() => setFilterCategory(cat.id === 'all' ? 'all' : cat.name)}
                            className={cn(
                                'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                filterCategory === (cat.id === 'all' ? 'all' : cat.name)
                                    ? 'bg-amber-500 border-amber-500 text-white'
                                    : 'border-border text-muted-foreground hover:text-foreground bg-card'
                            )}>
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* ── Low-Stock Alert ────────────────────────────────────── */}
                {lowStockArticles.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-orange-500/25 bg-orange-500/8">
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <p className="text-xs text-orange-400 font-medium">
                            {lowStockArticles.length} Artikel unter Mindestbestand
                        </p>
                        <button
                            onClick={() => setFilterCategory('__low_stock__')}
                            className="ml-auto text-xs text-destructive font-semibold hover:underline"
                        >
                            Anzeigen
                        </button>
                    </div>
                )}

                {/* ── Artikel-Liste ─────────────────────────────────────── */}
                {groupedArticles.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-semibold text-foreground">Keine Artikel</p>
                        <p className="text-sm mt-1">Füge deinen ersten Artikel hinzu</p>
                    </div>
                ) : groupedArticles.map(({ cat, items }) => (
                    <div key={cat.id} className="space-y-2">
                        {/* Kategorie-Header */}
                        <div className="flex items-center gap-2 px-0.5">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                {cat.name}
                            </p>
                            <span className="text-[10px] text-muted-foreground/50">({items.length})</span>
                            <div className="flex-1 h-px bg-border/50" />
                        </div>

                        {/* Artikel */}
                        {items.map(article => (
                            <ArticleRow
                                key={article.id}
                                article={article}
                                isLowStock={lowStockIds.has(article.id)}
                                onEdit={handleEdit}
                                onToggleActive={handleToggleActive}
                                isManager={permissions.isManager}
                                assignments={assignmentMap[article.id] || []}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/* ── Modals & Dialoge ──────────────────────────────────────── */}
            <ArticleModal
                open={modalOpen}
                onClose={() => { setModalOpen(false); setSelectedArticle(null); }}
                article={selectedArticle}
                onNavigate={handleNavigateArticle}
                navPosition={articleNavPosition}
                onSave={handleSave}
            />

            <BarcodeScanner
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={handleScannerResult}
            />

            {/* Deaktivieren-Bestätigung */}
            <AlertDialog open={!!deactivateConfirm} onOpenChange={o => !o && setDeactivateConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Artikel deaktivieren?</AlertDialogTitle>
                        <AlertDialogDescription>
                            „{deactivateConfirm?.name}" wird ausgeblendet und erscheint nicht mehr in Listen.
                            Du kannst den Artikel jederzeit wieder reaktivieren.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeactivateConfirmed}
                            className="bg-secondary text-foreground hover:bg-secondary/80">
                            Deaktivieren
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}