import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import {
    Package, RefreshCw, ShoppingCart, Layers,
    Building2, TrendingDown, ClipboardCheck, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

    // Niedrigbestand-Counter
    const { data: articles = [] } = useQuery({
        queryKey: ['articles-warehouse'],
        queryFn: () => base44.entities.Article.filter({ is_active: true }, 'name', 500),
        staleTime: STALE.LONG,
        enabled: permissions.canViewWarehouse,
    });

    // Offene Bestellungen
    const { data: orders = [] } = useQuery({
        queryKey: ['shopping-open'],
        queryFn: () => base44.entities.ShoppingList.filter({ status: 'offen' }, '-created_date', 200),
        staleTime: STALE.MEDIUM,
        enabled: permissions.canViewShopping,
    });

    // Offene Einkaufsliste
    const { data: quickListItems = [] } = useQuery({
        queryKey: ['quick-list-open'],
        queryFn: () => base44.entities.QuickListItem.filter({ is_completed: false }, '-created_date', 100),
        staleTime: STALE.SHORT,
        enabled: permissions.canViewShopping,
    });
    const openQuickListCount = quickListItems.length;

    // Offene Auffüll-Items heute
    const today = new Date().toISOString().slice(0, 10);
    const { data: restockItems = [] } = useQuery({
        queryKey: ['restock-open'],
        queryFn: () => base44.entities.RestockItem.filter({ date: today }, '-created_date', 100),
        staleTime: STALE.SHORT,
        enabled: permissions.canViewRestock,
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
    const openRestockCount = restockItems.filter(i => !i.is_completed).length;


    return (
        <div className="max-w-2xl mx-auto px-3 py-4 pb-32 md:pb-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-xl font-bold text-foreground">Waren & Lager</h1>
                <p className="text-muted-foreground text-xs mt-0.5">Artikel, Bestellungen, Lagerplätze</p>
            </div>

            {/* Niedrigbestand-Alert */}
            {lowStockCount > 0 && (
                <div className="flex items-center gap-3 p-3 mb-5 rounded-xl border border-orange-500/30 bg-orange-500/5">
                    <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                    <p className="text-sm text-orange-400 font-medium">
                        {lowStockCount} {lowStockCount === 1 ? 'Artikel' : 'Artikel'} unter Mindestbestand
                    </p>
                    <button
                        onClick={() => navigate(createPageUrl('Articles'))}
                        className="ml-auto text-xs text-orange-400 underline underline-offset-2"
                    >
                        Ansehen
                    </button>
                </div>
            )}

            {/* Tagesgeschäft */}
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Tagesgeschäft</p>
            <div className="space-y-2 mb-6">
                {permissions.canViewRestock && (
                    <NavCard
                        icon={RefreshCw}
                        label="Auffüllen"
                        description="Keller → Theke, tägliche Liste"
                        page="Restock"
                        badge={openRestockCount || undefined}
                        badgeVariant="warning"
                    />
                )}
                {permissions.canViewShopping && (
                    <NavCard
                        icon={ShoppingCart}
                        label="Bestellungen"
                        description="Lieferanten-Bestellungen mit Live-Kosten"
                        page="Shopping"
                        badge={openOrdersCount || undefined}
                        badgeVariant="default"
                    />
                )}
                {permissions.canViewShopping && (
                    <NavCard
                        icon={ShoppingCart}
                        label="Einkaufsliste"
                        description="Schnelle Liste für alle Mitarbeiter"
                        page="QuickList"
                        badge={openQuickListCount || undefined}
                        badgeVariant="default"
                    />
                )}
                {permissions.canViewWastage && (
                    <NavCard
                        icon={TrendingDown}
                        label="Schwund"
                        description="Bruch, Verderb, Nachtwächter erfassen"
                        page="Wastage"
                    />
                )}
            </div>

            {/* Stammdaten */}
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Stammdaten</p>
            <div className="space-y-2 mb-6">
                {permissions.canViewWarehouse && (
                    <NavCard
                        icon={Package}
                        label="Artikeldatenbank"
                        description="Bestände, Mindestmengen, Preise, Inventur"
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
                        description="Bereiche, Möbel, Fächer, QR-Labels"
                        page="Storage"
                    />
                )}
                {permissions.canViewInventory && (
                    <NavCard
                        icon={ClipboardCheck}
                        label="Inventur"
                        description="Periodische Bestandsaufnahme"
                        page="Inventory"
                    />
                )}
            </div>
        </div>
    );
}