/**
 * sidebarConfig.js — Sidebar-Einträge (NUR HIER ÄNDERN)
 * ⚠️  Diese Datei wird NICHT vom App Builder überschrieben.
 *     navigationConfig.jsx importiert von hier — niemals direkt in navigationConfig.jsx editieren.
 */
import {
    LayoutDashboard, Users, Store, Warehouse, Wine, Calculator, Settings,
} from 'lucide-react';

export const sidebarPages = [
    { page: 'Dashboard',    name: 'Dashboard',      icon: LayoutDashboard, permission: 'canViewDashboard' },
    { page: 'TeamHub',      name: 'Team',            icon: Users,           permission: 'canViewShifts' },
    { page: 'BetriebHub',   name: 'Betrieb',         icon: Store,           permission: 'canViewReservations' },
    { page: 'Warehouse',    name: 'Waren & Lager',   icon: Warehouse,       permission: 'canViewWarehouse' },
    { page: 'DrinkMenu',           name: 'Karte',           icon: Wine,            permission: 'canViewDrinkMenu' },
    { page: 'AccountingDashboard', name: 'Buchhaltung',     icon: Calculator,      permission: 'canViewAccounting' },
    { page: 'Settings',     name: 'Einstellungen',   icon: Settings,        permission: 'canViewSettings' },
];