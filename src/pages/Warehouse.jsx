import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { format } from 'date-fns';
import {
    Package, RefreshCw, ShoppingCart, ShoppingBasket, Layers,
    Building2, TrendingDown, ClipboardCheck, AlertTriangle,
    PackageCheck, Square, Inbox, CheckCircle2, AlertTriangle as AlertTriangleIcon, Minus, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sendPushNotification } from '@/lib/pushService';

function StatBadge({ count, variant = 'default' }) {
    if (!count) return null;
    return (
        <span className={cn(
            'ml-auto text-xs font-bold px-2 py-0.5 rounded-full',
            variant === 'warning' ? 'bg-orange-500/20 text-orange-400' :
            variant === 'danger'  ? 'bg-destructive/20 text-destructive' :
                                    'bg-primary/20 text-primary'
        )}>
            {count}
        </span>
    );
}

function NavCard({ icon: Icon, label, description, page, badge, badgeVariant, disabled, onClick }) {
    const navigate = useNavigate();
    return (
        <button
            onClick={onClick || (() => navigate(createPageUrl(page)))}
            disabled={disabled}
            className={cn(
                'flex items-center gap-4 w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98]',
                disabled
                    ? 'opacity-40 cursor-not-allowed bg-card border-border/30'
                    : 'bg-card border-border/50 hover:border-border hover:bg-accent/20 cursor-pointer'
            )}
        >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            {badge !== undefined && (
                <StatBadge count={badge} variant={badgeVariant} />
            )}
        </button>
    );
}

export default function Warehouse() {
    const permissions = usePermissions();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'keller' ? 'keller' : 'bereiche'); // 'bereiche' | 'keller'
    const [kellerQtys, setKellerQtys] = useState({}); // { [article_id]: number } editierbare Mengen

    const today = format(new Date(), 'yyyy-MM-dd');

    // Artikel (Niedrigbestand)
    const { data: articles = [] } = useQuery({
        queryKey: ['articles-warehouse'],
        queryFn: () => base44.entities.Article.filter({ is_active: true }, 'name', 500),
        staleTime: STALE.LONG,
        enabled: permissions.canViewWarehouse,
    });

    // Offene Bestellungen
    const { data: orders = [] } = useQuery({
        queryKey: ['shopping-open'],
        queryFn: async () => {
            const [offen, bestellt] = await Promise.all([
                base44.entities.ShoppingList.filter({ status: 'offen' }),
                base44.entities.ShoppingList.filter({ status: 'bestellt' }),
            ]);
            return [...offen, ...bestellt];
        },
        staleTime: STALE.MEDIUM,
        enabled: permissions.canViewShopping,
    });

    // Offene Einkaufsliste
    const { data: quickListItems = [] } = useQuery({
        queryKey: ['quick-list-open'],
        queryFn: () => base44.entities.QuickListItem.filter({ date: today, is_completed: false }, '-created_date', 100),
        staleTime: STALE.FAST,
        enabled: permissions.canViewShopping,
    });

    // Auffüll-Items heute
    const { data: restockItems = [] } = useQuery({
        queryKey: ['restock-open'],
        queryFn: () => base44.entities.RestockItem.filter({ date: today }, '-created_date', 200),
        staleTime: STALE.SHORT,
        enabled: permissions.canViewRestock,
    });

    // Abhaken aller Items eines Artikels im Keller (mit tatsächlicher Menge)
    const completeArticleMutation = useMutation({
        mutationFn: async ({ itemsToComplete, actualQty }) => {
            await Promise.all(
                itemsToComplete.map(item =>
                    base44.entities.RestockItem.update(item.id, {
                        is_completed: true,
                        quantity: actualQty ?? item.needed_quantity ?? item.quantity ?? 0,
                    })
                )
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['restock-open'] });
            queryClient.invalidateQueries({ queryKey: ['restock-items'] });
        },
    });

    // "Zu wenig im Keller" — erledigt mit tatsächlicher Menge + Push an Manager
    const lowStockMutation = useMutation({
        mutationFn: async ({ group, actualQty }) => {
            // Items als erledigt markieren mit tatsächlicher Menge
            await Promise.all(
                group.items.map(item =>
                    base44.entities.RestockItem.update(item.id, {
                        is_completed: true,
                        quantity: actualQty,
                    })
                )
            );
            // Push an alle Manager
            await sendPushNotification({
                title: '⚠️ Keller-Bestand kritisch',
                message: `${group.article_name}: nur ${actualQty} von ${group.total_needed} Stück verfügbar — bitte nachbestellen.`,
                target_role: 'Manager',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['restock-open'] });
            queryClient.invalidateQueries({ queryKey: ['restock-items'] });
        },
    });

    if (permissions.isLoading) return (
        <div className="flex items-center justify-center min-h-[40vh]">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
    );

    if (!permissions.canViewWarehouse && !permissions.canViewShopping && !permissions.canViewRestock) {
        return <PermissionDenied />;
    }

    const lowStockCount = articles.filter(a =>
        a.min_stock > 0 && (a.current_stock ?? 0) < a.min_stock
    ).length;

    const openOrdersCount = orders.length;
    const openQuickListCount = quickListItems.length;
    const openRestockItems = restockItems.filter(i => !i.is_completed);
    const openRestockCount = openRestockItems.length;

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
        return Object.values(groups).sort((a, b) => a.article_name.localeCompare(b.article_name));
    })();

    return (
        <div className="max-w-2xl mx-auto px-3 py-4 pb-32 md:pb-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-xl font-bold text-foreground">Waren & Lager</h1>
                <p className="text-muted-foreground text-xs mt-0.5">Artikel, Bestellungen, Lagerplätze</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-border mb-6">
                <button
                    onClick={() => setActiveTab('bereiche')}
                    className={cn(
                        'flex-1 py-2.5 text-center text-sm font-medium border-b-2 transition-all',
                        activeTab === 'bereiche'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                >
                    Bereiche
                </button>
                {permissions.canViewRestock && (
                    <button
                        onClick={() => setActiveTab('keller')}
                        className={cn(
                            'flex-1 py-2.5 text-center text-sm font-medium border-b-2 transition-all flex items-center justify-center gap-1.5',
                            activeTab === 'keller'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <PackageCheck className="w-4 h-4" />
                        Keller
                        {openRestockCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-primary/20 text-primary rounded-full">
                                {openRestockCount}
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* ── Bereiche-Tab ── */}
            {activeTab === 'bereiche' && (
                <>
                    {lowStockCount > 0 && (
                        <div className="flex items-center gap-3 p-3 mb-5 rounded-xl border border-orange-500/30 bg-orange-500/5">
                            <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                            <p className="text-sm text-orange-400 font-medium">
                                {lowStockCount} Artikel unter Mindestbestand
                            </p>
                            <button
                                onClick={() => navigate(createPageUrl('Articles'))}
                                className="ml-auto text-xs text-orange-400 underline underline-offset-2"
                            >
                                Ansehen
                            </button>
                        </div>
                    )}

                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Tagesgeschäft</p>
                    <div className="space-y-2 mb-6">
                        {permissions.canViewRestock && (
                            <NavCard
                                icon={RefreshCw}
                                label="Auffüllen"
                                description="Keller → Theke · nach Bereichen (NR / Raucher)"
                                page="Restock"
                                badge={openRestockCount || undefined}
                                badgeVariant="warning"
                            />
                        )}
                        {permissions.canViewShopping && (
                            <NavCard
                                icon={ShoppingCart}
                                label="Bestellungen"
                                description="Lieferantenbestellungen · Wareneingang · Archiv"
                                page="Shopping"
                                badge={openOrdersCount || undefined}
                                badgeVariant="default"
                            />
                        )}
                        {permissions.canViewShopping && (
                            <NavCard
                                icon={ShoppingBasket}
                                label="Einkaufsliste"
                                description="Spontane Besorgungen · tagesaktuelle Teamliste"
                                page="QuickList"
                                badge={openQuickListCount || undefined}
                                badgeVariant="default"
                            />
                        )}
                        {permissions.canViewWastage && (
                            <NavCard
                                icon={TrendingDown}
                                label="Schwund"
                                description="Bruch, Verderb, Verlust protokollieren"
                                page="Wastage"
                            />
                        )}
                    </div>

                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Stammdaten</p>
                    <div className="space-y-2 mb-6">
                        {permissions.canViewWarehouse && (
                            <NavCard
                                icon={Package}
                                label="Artikeldatenbank"
                                description="Artikel, Bestände, Mindestmengen, Einkaufspreise"
                                page="Articles"
                                badge={lowStockCount || undefined}
                                badgeVariant="warning"
                            />
                        )}
                        {permissions.canViewSuppliers && (
                            <NavCard
                                icon={Building2}
                                label="Lieferanten"
                                description="Kontakte, Konditionen, Bestellkontakte"
                                page="Suppliers"
                            />
                        )}
                        {permissions.canViewWarehouse && (
                            <NavCard
                                icon={Layers}
                                label="Lagerplätze"
                                description="Theken & Lager · Fächer · QR-Etiketten drucken"
                                page="Storage"
                            />
                        )}
                        {permissions.canViewInventory && (
                            <NavCard
                                icon={ClipboardCheck}
                                label="Inventur"
                                description="Monatliche Zählung · Bestandskontrolle"
                                page="Inventory"
                            />
                        )}
                    </div>
                </>
            )}

            {/* ── Keller-Tab ── */}
            {activeTab === 'keller' && (
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
                                const isPending = (completeArticleMutation.isPending || lowStockMutation.isPending) &&
                                    (completeArticleMutation.variables?.itemsToComplete?.[0]?.article_id === group.article_id ||
                                     lowStockMutation.variables?.group?.article_id === group.article_id);
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

                                            {/* Erledigt-Button */}
                                            <button
                                                onClick={() => completeArticleMutation.mutate({ itemsToComplete: group.items, actualQty: qty })}
                                                className="ml-auto w-12 h-10 flex items-center justify-center rounded-lg border-2 border-border bg-card text-muted-foreground hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/5 active:scale-95 transition-all shrink-0"
                                                title="Erledigt — Menge geholt"
                                            >
                                                <Square className="w-5 h-5" />
                                            </button>

                                            {/* Zu-wenig-Button */}
                                            <button
                                                onClick={() => lowStockMutation.mutate({ group, actualQty: qty })}
                                                className="w-12 h-10 flex items-center justify-center rounded-lg border-2 border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 active:scale-95 transition-all shrink-0"
                                                title="Zu wenig im Keller — Manager benachrichtigen"
                                            >
                                                <AlertTriangle className="w-5 h-5" />
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
            )}
        </div>
    );
}