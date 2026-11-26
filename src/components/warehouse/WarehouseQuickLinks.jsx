import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Boxes, Truck, Warehouse as WarehouseIcon, ClipboardList, Trash2, ShoppingCart, ListChecks } from 'lucide-react';
import { usePermissions } from '@/components/auth/usePermissions';

const QUICK_LINKS = [
    { page: 'Articles',            label: 'Artikel',        desc: 'Bestände & Preise',      icon: Boxes,         permission: 'canViewWarehouse' },
    { page: 'LieferscheinScanner', label: 'Lieferschein',  desc: 'Scannen & buchen',       icon: Truck,         permission: 'canViewWarehouse' },
    { page: 'Storage',             label: 'Lagerplätze',    desc: 'Fächer & Etiketten',     icon: WarehouseIcon, permission: 'canViewWarehouse' },
    { page: 'Inventory',           label: 'Inventur',       desc: 'Zählung & Kontrolle',    icon: ClipboardList, permission: 'canViewInventory' },
    { page: 'Suppliers',           label: 'Lieferanten',    desc: 'Kontakte & Konditionen', icon: Truck,         permission: 'canViewSuppliers' },
    { page: 'Wastage',             label: 'Schwund',        desc: 'Bruch & Verlust',        icon: Trash2,        permission: 'canViewWastage' },
    { page: 'Shopping',            label: 'Bestellung',     desc: 'Wareneingang',           icon: ShoppingCart,  permission: 'canViewShopping' },
    { page: 'QuickList',           label: 'Einkaufsliste',  desc: 'Spontane Besorgung',     icon: ListChecks,    permission: 'canViewShopping' },
];

export default function WarehouseQuickLinks() {
    const permissions = usePermissions();
    const items = QUICK_LINKS.filter(i => permissions[i.permission]);

    if (!items.length) return null;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
            {items.map(item => (
                <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className="flex flex-col gap-1.5 p-3 rounded-xl border border-border/50 bg-card hover:border-border hover:bg-accent/20 active:scale-[0.98] transition-all"
                >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-[12.5px] font-semibold text-foreground leading-tight">{item.label}</p>
                    <p className="text-[10.5px] text-muted-foreground leading-tight truncate">{item.desc}</p>
                </Link>
            ))}
        </div>
    );
}