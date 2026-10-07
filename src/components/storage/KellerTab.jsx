import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { format } from 'date-fns';
import { Inbox, Minus, Plus, Square, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sendPushNotification } from '@/lib/pushService';
import { transferKellerToTheke, reduceCurrentStock } from '@/lib/stockSync';

/**
 * Keller-Entnahme — reine Extraktion aus Warehouse.jsx.
 * Selbst-contained: fetches eigene RestockItems, verwaltet kellerQtys-State,
 * führt completeArticleMutation mit transferKellerToTheke/reduceCurrentStock aus.
 * Wird eingebettet in Warehouse (keller-Tab) und Restock (Keller-Entnahme-Modus).
 */
export default function KellerTab() {
    const queryClient = useQueryClient();
    const [kellerQtys, setKellerQtys] = useState({});
    const today = format(new Date(), 'yyyy-MM-dd');

    // Auffüll-Items heute
    const { data: restockItems = [] } = useQuery({
        queryKey: ['restock-open'],
        queryFn: () => base44.entities.RestockItem.filter({ date: today }, '-created_date', 200),
        staleTime: STALE.SHORT,
    });

    // Abhaken aller Items eines Artikels im Keller (mit tatsächlicher Menge)
    // → Überträgt den Bestand physisch vom Keller-Fach ins Theken-Fach
    // → Wenn Menge < Bedarf: automatisch Push an Manager
    const completeArticleMutation = useMutation({
        mutationFn: async ({ itemsToComplete, actualQty, totalNeeded, articleName }) => {
            const transferQty = actualQty ?? itemsToComplete.reduce((sum, item) =>
                sum + (item.needed_quantity != null ? parseFloat(item.needed_quantity) : parseFloat(item.quantity) || 0), 0);

            // 1. Alle Items als erledigt markieren
            await Promise.all(
                itemsToComplete.map(item =>
                    base44.entities.RestockItem.update(item.id, {
                        is_completed: true,
                        stock_reduced: true,
                        quantity: actualQty ?? item.needed_quantity ?? item.quantity ?? 0,
                    })
                )
            );

            // 2. current_stock reduzieren für Items die noch nicht über Rundgang erfasst wurden
            const unreducedItems = itemsToComplete.filter(item => !item.stock_reduced);
            if (unreducedItems.length > 0) {
                const totalUnreduced = unreducedItems.reduce((sum, item) =>
                    sum + (item.needed_quantity != null ? parseFloat(item.needed_quantity) : parseFloat(item.quantity) || 0), 0);
                await reduceCurrentStock(itemsToComplete[0].article_id, totalUnreduced);
            }

            // 3. Keller → Theke Umbuchung (physische Übertragung)
            if (itemsToComplete[0]?.article_id && transferQty > 0) {
                await transferKellerToTheke({
                    articleId: itemsToComplete[0].article_id,
                    transferQty,
                    thekeAssignmentId: itemsToComplete[0].assignment_id || null,
                });
            }

            // 4. "Zu wenig" automatisch: wenn geholte Menge < Bedarf → Manager benachrichtigen
            if (totalNeeded != null && actualQty < totalNeeded) {
                try {
                    await sendPushNotification({
                        title: '⚠️ Keller-Bestand kritisch',
                        message: `${articleName}: nur ${actualQty} von ${totalNeeded} Stück verfügbar — bitte nachbestellen.`,
                        target_role: 'Manager',
                    });
                } catch (e) { console.warn('[Keller] Push fehlgeschlagen:', e); }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['restock-open'] });
            queryClient.invalidateQueries({ queryKey: ['restock-items'] });
            queryClient.invalidateQueries({ queryKey: ['articles-warehouse'] });
            queryClient.invalidateQueries({ queryKey: ['articles'] });
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
        },
    });

    const openRestockItems = restockItems.filter(i => !i.is_completed);

    // Keller-Ansicht: Aggregierung nach Artikel
    const kellerGroups = (() => {
        const groups = {};
        openRestockItems.forEach(item => {
            const artId = item.article_id || 'unknown';
            if (!groups[artId]) {
                groups[artId] = {
                    article_id: artId,
                    article_name: item.article_name || 'Unbekannter Artikel',
                    total_needed: 0,
                    items: [],
                };
            }
            const qty = item.needed_quantity != null ? parseFloat(item.needed_quantity) : (parseFloat(item.quantity) || 0);
            groups[artId].total_needed += qty;
            groups[artId].items.push(item);
        });
        return Object.values(groups)
            .filter(g => g.total_needed > 0)
            .sort((a, b) => a.article_name.localeCompare(b.article_name));
    })();

    return (
        <div className="space-y-4">
            {/* Info-Header */}
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/50">
                <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Heute</p>
                    <p className="text-sm font-bold text-foreground">{format(new Date(), 'dd.MM.yyyy')}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Offene Artikel</p>
                    <div className="flex items-center gap-1.5 justify-end mt-0.5">
                        {kellerGroups.length > 0 && (
                            <span className="inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                        )}
                        <p className="text-sm font-bold text-foreground">{kellerGroups.length}</p>
                    </div>
                </div>
            </div>

            <p className="text-[11px] text-muted-foreground/70 px-1">
                Jeden Artikel abhaken wenn du ihn aus dem Keller geholt hast.
            </p>

            {kellerGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-card">
                    <Inbox className="w-12 h-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-semibold text-foreground">Keine offenen Bestellungen</p>
                    <p className="text-xs text-muted-foreground mt-1">Für heute ist alles vorbereitet.</p>
                </div>
            ) : (
                <div className="divide-y divide-border/60 border border-border/50 rounded-xl bg-card overflow-hidden">
                    {kellerGroups.map(group => {
                        const isPending = completeArticleMutation.isPending &&
                            completeArticleMutation.variables?.itemsToComplete?.[0]?.article_id === group.article_id;
                        const qty = kellerQtys[group.article_id] ?? group.total_needed;
                        const missing = Math.max(0, group.total_needed - qty);
                        const setQty = (v) => {
                            const parsed = parseInt(v);
                            setKellerQtys(prev => ({ ...prev, [group.article_id]: isNaN(parsed) || parsed < 0 ? 0 : parsed }));
                        };
                        return (
                            <div
                                key={group.article_id}
                                className={cn(
                                    'p-4 transition-all',
                                    isPending && 'opacity-50 pointer-events-none'
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-bold text-foreground leading-tight">
                                            {group.article_name}
                                        </p>
                                        {group.total_needed > 0 && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Bedarf:{' '}
                                                <span className="font-semibold text-foreground">
                                                    {group.total_needed} Stück
                                                </span>
                                                {group.items.length > 1 && (
                                                    <span className="text-muted-foreground/60"> · {group.items.length} Fächer</span>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Mengen-Stepper */}
                                <div className="flex items-center gap-2 mt-3">
                                    <button
                                        onClick={() => setQty(Math.max(0, qty - 1))}
                                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary active:scale-95 transition-all shrink-0"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        value={qty}
                                        onChange={e => setQty(e.target.value)}
                                        className="w-16 text-center font-bold text-lg h-10 rounded-lg border border-border bg-background focus:outline-none focus:border-primary transition-colors"
                                    />
                                    <button
                                        onClick={() => setQty(qty + 1)}
                                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary active:scale-95 transition-all shrink-0"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs text-muted-foreground ml-1">Stück geholt</span>

                                    {/* Erledigt-Button — automatisch "Zu wenig" wenn Menge < Bedarf */}
                                    <button
                                        onClick={() => completeArticleMutation.mutate({
                                            itemsToComplete: group.items,
                                            actualQty: qty,
                                            totalNeeded: group.total_needed,
                                            articleName: group.article_name,
                                        })}
                                        className={cn(
                                            'ml-auto w-12 h-10 flex items-center justify-center rounded-lg border-2 transition-all active:scale-95 shrink-0',
                                            missing > 0
                                                ? 'border-amber-500/60 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10'
                                                : 'border-border bg-card text-muted-foreground hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/5'
                                        )}
                                        title={missing > 0 ? `Erledigt — ${missing} Stück fehlen, Manager wird benachrichtigt` : 'Erledigt — Menge geholt'}
                                    >
                                        {missing > 0 ? <AlertTriangle className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                    </button>
                                </div>

                                {/* Hinweis: fehlende Menge */}
                                {missing > 0 && (
                                    <p className="text-xs text-amber-500 dark:text-amber-400 font-medium mt-2">
                                        ⚠ {missing} Stück fehlen im Keller
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}