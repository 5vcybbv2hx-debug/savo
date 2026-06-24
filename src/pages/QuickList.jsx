import { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { LoadingState } from '@/components/ui/StateDisplay';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import { format } from 'date-fns';
import { Check, Trash2, CheckCheck, Plus, ClipboardList } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import AddItemModal from '@/components/quicklist/AddItemModal';

export default function QuickList() {
    const queryClient = useQueryClient();

    // ── Offline sync ──────────────────────────────────────────────────────────
    useEffect(() => {
        const handleOnline = () => syncMutations(base44).catch(console.error);
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    // ── State ──────────────────────────────────────────────────────────────────
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [deleteCompletedOpen, setDeleteCompletedOpen] = useState(false);
    const [recentIds, setRecentIds] = useState([]);
    const recentTimers = useRef({});

    // ── Queries ────────────────────────────────────────────────────────────────
    const { data: items = [], isLoading } = useQuery({
        queryKey: ['quick-list'],
        queryFn: () => base44.entities.QuickListItem.list('-created_date', 200),
        staleTime: STALE.MEDIUM,
    });

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list('name', 500),
        staleTime: STALE.SLOW,
    });

    // ── Recent highlight ───────────────────────────────────────────────────────
    const markRecent = (id) => {
        setRecentIds(prev => [...prev.filter(x => x !== id), id]);
        if (recentTimers.current[id]) clearTimeout(recentTimers.current[id]);
        recentTimers.current[id] = setTimeout(() => {
            setRecentIds(prev => prev.filter(x => x !== id));
        }, 8000);
    };

    // ── Mutations ──────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: async (data) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'QuickListItem', type: 'create', data });
                const fakeId = `offline-${Date.now()}`;
                queryClient.setQueryData(['quick-list'], (old) => [{ ...data, id: fakeId, _offline: true }, ...(old || [])]);
                return { id: fakeId, ...data, _offline: true };
            }
            return base44.entities.QuickListItem.create(data);
        },
        onSuccess: (newItem) => {
            if (!newItem?._offline) queryClient.invalidateQueries({ queryKey: ['quick-list'] });
            if (newItem?.id) markRecent(newItem.id);
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'QuickListItem', type: 'update', id, data });
                queryClient.setQueryData(['quick-list'], (old) => old?.map(item => item.id === id ? { ...item, ...data } : item) || old);
                return { queued: true, id };
            }
            return base44.entities.QuickListItem.update(id, data);
        },
        onSuccess: (result, variables) => {
            if (!result?.queued) queryClient.invalidateQueries({ queryKey: ['quick-list'] });
            markRecent(result?.id || variables.id);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'QuickListItem', type: 'delete', id });
                queryClient.setQueryData(['quick-list'], (old) => old?.filter(item => item.id !== id) || old);
                return { queued: true };
            }
            return base44.entities.QuickListItem.delete(id);
        },
        onSuccess: (result) => {
            if (!result?.queued) queryClient.invalidateQueries({ queryKey: ['quick-list'] });
        },
    });

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleAdd = async (data) => {
        const user = await base44.auth.me();
        createMutation.mutate({
            ...data,
            added_by_name: user?.full_name || user?.email || 'Unbekannt',
        });
        setAddModalOpen(false);
    };

    const toggleComplete = (item) => {
        updateMutation.mutate({ id: item.id, data: { is_completed: !item.is_completed } });
    };

    const handleDelete = (id) => {
        deleteMutation.mutate(id);
    };

    const handleDeleteCompleted = async () => {
        const completed = items.filter(i => i.is_completed);
        for (const item of completed) {
            await deleteMutation.mutateAsync(item.id);
        }
    };

    // ── Sorted / grouped items ──────────────────────────────────────────────────
    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
            if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
            const aRecent = recentIds.indexOf(a.id);
            const bRecent = recentIds.indexOf(b.id);
            if (aRecent !== -1 || bRecent !== -1) {
                if (aRecent === -1) return 1;
                if (bRecent === -1) return -1;
                return bRecent - aRecent;
            }
            return 0;
        });
    }, [items, recentIds]);

    const groupedItems = useMemo(() => {
        return sortedItems.reduce((groups, item) => {
            const cat = item.category || 'Sonstiges';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
            return groups;
        }, {});
    }, [sortedItems]);

    const openCount = items.filter(i => !i.is_completed).length;
    const completedCount = items.filter(i => i.is_completed).length;

    // ── Loading ─────────────────────────────────────────────────────────────────
    if (isLoading) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <LoadingState />
        </div>
    );

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-2xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Einkaufsliste</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {openCount} offen{completedCount > 0 && ` · ${completedCount} erledigt`}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mb-6">
                    <Button
                        onClick={() => setAddModalOpen(true)}
                        className="flex-1 h-12"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Hinzufügen
                    </Button>
                    {completedCount > 0 && (
                        <Button
                            variant="outline"
                            onClick={() => setDeleteCompletedOpen(true)}
                            className="h-12"
                        >
                            <CheckCheck className="w-4 h-4 mr-2" />
                            Erledigte löschen
                        </Button>
                    )}
                </div>

                {/* List */}
                {items.length === 0 ? (
                    <Card className="p-10 text-center border-border/40">
                        <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-muted-foreground font-medium">Liste ist leer</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            Füge Artikel hinzu, die besorgt werden müssen
                        </p>
                    </Card>
                ) : (
                    <div className="space-y-5">
                        {Object.entries(groupedItems).map(([category, catItems]) => (
                            <div key={category}>
                                {/* Kategorie-Trennlinie */}
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-px bg-border/40 flex-1" />
                                    <span className="text-xs font-semibold text-primary uppercase tracking-wider px-1">
                                        {category}
                                    </span>
                                    <div className="h-px bg-border/40 flex-1" />
                                </div>

                                <div className="space-y-2">
                                    {catItems.map(item => (
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
                                                        alt={item.item_name}
                                                        className="w-11 h-11 rounded-lg object-cover border border-border/40 shrink-0"
                                                        loading="lazy"
                                                    />
                                                )}

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        "font-medium text-sm truncate",
                                                        item.is_completed
                                                            ? "text-muted-foreground line-through"
                                                            : "text-foreground"
                                                    )}>
                                                        {item.item_name}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                        <span className="font-semibold">
                                                            {item.quantity} {item.unit}
                                                        </span>
                                                        <span>·</span>
                                                        <span>{item.added_by_name}</span>
                                                        {item._offline && (
                                                            <span className="text-yellow-500">⚡ offline</span>
                                                        )}
                                                    </div>
                                                    {item.notes && !item.is_completed && (
                                                        <p className="text-xs text-muted-foreground mt-1 italic">
                                                            {item.notes}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Delete */}
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-900/20 active:scale-90 transition-all shrink-0"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Item Modal */}
            <AddItemModal
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onConfirm={handleAdd}
                articles={articles}
            />

            {/* Delete Completed Confirmation */}
            <AlertDialog open={deleteCompletedOpen} onOpenChange={setDeleteCompletedOpen}>
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
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}