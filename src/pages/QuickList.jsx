import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Trash2, ClipboardList, ShoppingCart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import QuickInput from '@/components/quicklist/QuickInput';
import QuickListRow from '@/components/quicklist/QuickListRow';

export default function QuickList() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const today = format(new Date(), 'yyyy-MM-dd');
    const dateDisplay = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

    const [showCompleted, setShowCompleted] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    // ── Offline sync ──────────────────────────────────────────────────
    useEffect(() => {
        const handleOnline = () => syncMutations(base44).catch(console.error);
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    // ── Queries ────────────────────────────────────────────────────────
    const { data: items = [], isLoading } = useQuery({
        queryKey: ['quicklist-items'],
        queryFn: () => base44.entities.QuickListItem.list('-created_date', 500),
        staleTime: 30 * 1000,
    });

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list('name', 500),
        staleTime: STALE.SLOW,
    });

    // ── Mutations (offline-aware) ─────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: async (data) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'QuickListItem', type: 'create', data });
                return { ...data, id: `offline-${Date.now()}`, _offline: true };
            }
            return base44.entities.QuickListItem.create(data);
        },
        onSuccess: (newItem) => {
            if (newItem?._offline) {
                queryClient.setQueryData(['quicklist-items'], (old = []) => [newItem, ...old]);
                toast.success('Offline hinzugefügt ⚡');
            } else {
                queryClient.invalidateQueries({ queryKey: ['quicklist-items'] });
                toast.success('Hinzugefügt');
            }
        },
        onError: () => toast.error('Fehler beim Hinzufügen'),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'QuickListItem', type: 'update', id, data });
                return { queued: true, id, data };
            }
            return base44.entities.QuickListItem.update(id, data);
        },
        onSuccess: (result) => {
            if (result?.queued) {
                queryClient.setQueryData(['quicklist-items'], (old = []) =>
                    old.map(item => item.id === result.id ? { ...item, ...result.data } : item)
                );
            } else {
                queryClient.invalidateQueries({ queryKey: ['quicklist-items'] });
            }
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'QuickListItem', type: 'delete', id });
                return { queued: true, id };
            }
            return base44.entities.QuickListItem.delete(id);
        },
        onSuccess: (result) => {
            if (result?.queued) {
                queryClient.setQueryData(['quicklist-items'], (old = []) =>
                    old.filter(item => item.id !== result.id)
                );
            } else {
                queryClient.invalidateQueries({ queryKey: ['quicklist-items'] });
            }
        },
    });

    // ── Derived ────────────────────────────────────────────────────────
    const openItems = useMemo(() => items.filter(i => !i.is_completed), [items]);
    const completedItems = useMemo(() => items.filter(i => i.is_completed), [items]);
    const total = items.length;
    const completedCount = completedItems.length;
    const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    const grouped = useMemo(() => {
        return openItems.reduce((acc, item) => {
            const cat = item.category || 'Sonstiges';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {});
    }, [openItems]);

    const sortedCategories = useMemo(() =>
        Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)),
    [grouped]);

    // ── Handlers ──────────────────────────────────────────────────────
    const handleAdd = async (data) => {
        const user = await base44.auth.me();
        createMutation.mutate({
            ...data,
            added_by_name: user?.full_name || 'Unbekannt',
            date: today,
            is_completed: false,
        });
    };

    const handleToggle = (item) => {
        updateMutation.mutate({ id: item.id, data: { is_completed: !item.is_completed } });
    };

    const handleUpdate = (id, data) => {
        updateMutation.mutate({ id, data });
    };

    const handleDelete = (id) => {
        deleteMutation.mutate(id);
    };

    const handleDeleteCompleted = () => {
        for (const item of completedItems) {
            deleteMutation.mutate(item.id);
        }
        setDeleteOpen(false);
        toast.success(`${completedItems.length} Einträge gelöscht`);
    };

    // ── Zur Bestellung: alle offenen Items → ShoppingList ───────────
    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => base44.entities.Supplier.filter({ is_active: true }, 'order'),
        staleTime: STALE.SLOW,
    });

    const handleAddAllToOrder = async () => {
        if (openItems.length === 0) return;
        // Existierende offene Bestellungen laden
        const existing = await base44.entities.ShoppingList.filter({ status: 'offen' });
        let added = 0, skipped = 0;

        for (const item of openItems) {
            const alreadyOrdered = existing.some(
                e => e.item_name === item.item_name
            );
            if (alreadyOrdered) { skipped++; continue; }

            const article = articles.find(a => a.id === item.article_id || a.name === item.item_name);
            const primarySupplierQL = article?.supplier_details?.find(s => s.is_primary) || article?.supplier_details?.[0];
            const supplierNameQL = primarySupplierQL?.supplier_name || article?.suppliers?.[0] || suppliers[0]?.name || '';
            const defaultOptQL = (primarySupplierQL?.packaging_options || []).find(o => o.is_default) || (primarySupplierQL?.packaging_options || [])[0];
            await base44.entities.ShoppingList.create({
                item_name:           item.item_name,
                article_id:          item.article_id || null,
                category:            supplierNameQL,
                supplier_name:       supplierNameQL,
                packaging_option_id: defaultOptQL?.id || null,
                packaging_label:     defaultOptQL ? `${defaultOptQL.packaging_type} ${defaultOptQL.units_per_pack}×` : null,
                price_per_unit:      defaultOptQL?.price_per_unit || article?.purchase_price || null,
                price_per_pack:      defaultOptQL?.price_per_pack || null,
                quantity:            item.quantity || 1,
                unit:                item.unit || article?.content_unit || 'Stück',
                status:              'offen',
                notes:               `Einkaufsliste ${format(new Date(), 'dd.MM.yyyy')}`,
            });
            added++;
        }

        if (added > 0) {
            toast.success(`${added} Artikel zur Bestellliste hinzugefügt${skipped > 0 ? ` · ${skipped} übersprungen` : ''}`);
        } else {
            toast.info('Alle Artikel bereits in der Bestellliste');
        }
    };

    // ── Loading ───────────────────────────────────────────────────────
    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[40vh]">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto px-3 py-4 pb-32 md:pb-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h1 className="text-xl font-bold text-foreground">Einkaufsliste</h1>
                    <p className="text-muted-foreground text-xs mt-0.5">
                        Heute, {dateDisplay} — {openItems.length} offen
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {openItems.length > 0 && (
                        <Button size="sm" onClick={handleAddAllToOrder} className="h-8 gap-1.5 text-xs">
                            <ShoppingCart className="w-3.5 h-3.5" />
                            Bestellen
                        </Button>
                    )}
                    {completedCount > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="h-8">
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Progress */}
            {total > 0 && (
                <div className="mb-4">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {completedCount} von {total} erledigt
                    </p>
                </div>
            )}

            {/* Quick Input (sticky) */}
            <QuickInput articles={articles} onAdd={handleAdd} isAdding={createMutation.isPending} />

            {/* Open items grouped by category */}
            <div className="space-y-4 mt-3">
                {sortedCategories.map(([category, catItems]) => (
                    <div key={category}>
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                {category}
                            </span>
                            <span className="text-[11px] text-muted-foreground">({catItems.length})</span>
                            <div className="h-px bg-border/40 flex-1" />
                        </div>
                        <div className="space-y-2">
                            {catItems.map(item => (
                                <QuickListRow
                                    key={item.id}
                                    item={item}
                                    onToggle={handleToggle}
                                    onUpdate={handleUpdate}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    </div>
                ))}

                {openItems.length === 0 && (
                    <Card className="p-8 text-center border-border/40">
                        <ClipboardList className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                            {total === 0 ? 'Liste ist leer — Artikel oben hinzufügen' : 'Alles erledigt! 🎉'}
                        </p>
                    </Card>
                )}
            </div>

            {/* Completed section (collapsible) */}
            {completedCount > 0 && (
                <div className="mt-6">
                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full min-h-[44px]"
                    >
                        {showCompleted
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />
                        }
                        <span className="font-medium">Erledigt ({completedCount})</span>
                    </button>
                    {showCompleted && (
                        <div className="space-y-2 mt-2">
                            {completedItems.map(item => (
                                <QuickListRow
                                    key={item.id}
                                    item={item}
                                    onToggle={handleToggle}
                                    onUpdate={handleUpdate}
                                    onDelete={handleDelete}
                                />
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteOpen(true)}
                                className="w-full mt-2 text-destructive hover:text-destructive"
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1" /> Alle erledigten löschen
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Delete confirmation */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {completedCount} erledigte Einträge löschen?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Alle abgehakten Artikel werden unwiderruflich gelöscht.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCompleted}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}