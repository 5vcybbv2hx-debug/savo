/**
 * navigationConfig.js — Navigationskonfiguration
 * ⚠️  sidebarPages wird aus sidebarConfig.js importiert — NICHT hier editieren!
 *     Nur additionalPages (Mehr-Drawer) hier pflegen.
 */
import {
    LayoutDashboard, Users, Calendar, ShoppingCart, ClipboardList,
    Sparkles, BookOpen, Package, Boxes, Store, Calculator,
    Wine, Receipt, Euro, Settings, FileText, Wrench, HelpCircle,
    CalendarDays, Clock, Plane, RefreshCw, Shield,
    MapPin, BarChart3, CreditCard, Scale, Trash2, ListChecks,
    LayoutGrid, Database, CalendarClock, Truck, MessageSquare,
    Banknote, BookCopy, Tv, Warehouse, Utensils,
} from 'lucide-react';

// ── SIDEBAR — aus sidebarConfig.js (Builder-sicher) ─────────────────────────
import { sidebarPages } from './sidebarConfig.js';

export const mainNavigation = [
    {
        id: 'main',
        name: 'Navigation',
        pages: sidebarPages,
    },
];

export const additionalPages = [
    // Betrieb
    { page: 'Todos',          name: 'Aufgaben',           icon: ClipboardList, permission: 'canViewTodos' },
    { page: 'WeeklyTasks',    name: 'Wochenaufgaben',     icon: ListChecks,    permission: 'canViewSettings' },
    { page: 'Cleaning',       name: 'Putzliste',          icon: Sparkles,      permission: 'canViewCleaning' },
    { page: 'Events',         name: 'Events',             icon: CalendarDays,  permission: 'canViewEvents' },
    { page: 'DisplayManager', name: 'TV-Display',         icon: Tv,            permission: 'isManager' },
    { page: 'Wusa',           name: 'Wurstsalat',        icon: Utensils,      permission: 'canViewDashboard' },

    // Waren & Lager
    { page: 'Restock',    name: 'Auffüllen',    icon: Package,       permission: 'canViewRestock' },
    { page: 'Shopping',   name: 'Bestellung',   icon: ShoppingCart,  permission: 'canViewShopping' },
    { page: 'QuickList',  name: 'Einkaufsliste', icon: ListChecks,   permission: 'canViewShopping' },
    { page: 'Articles',   name: 'Artikel',      icon: Boxes,         permission: 'canViewWarehouse' },
    { page: 'Storage',    name: 'Lagerorte',    icon: MapPin,        permission: 'canViewWarehouse' },
    { page: 'Inventory',  name: 'Inventur',     icon: ClipboardList, permission: 'canViewInventory' },
    { page: 'Suppliers',  name: 'Lieferanten',  icon: Truck,         permission: 'canViewSuppliers' },
    { page: 'Wastage',    name: 'Schwund',       icon: Trash2,        permission: 'canViewWastage' },

    // Karte & Rezepte
    { page: 'DrinkMenu',       name: 'Getränkekarte', icon: Wine,       permission: 'canViewDrinkMenu' },
    { page: 'Recipes',         name: 'Rezepte',       icon: BookOpen,   permission: 'canViewRecipes' },
    { page: 'PriceCalculator', name: 'Schnellkalkulation',  icon: Calculator, permission: 'canViewPriceCalculator' },

    // Buchhaltung
    { page: 'AccountingDashboard',   name: 'Buchhaltung',       icon: Calculator, permission: 'canViewAccounting' },
    { page: 'AccountingCashbook',    name: 'Kassenbuch',        icon: BookCopy,   permission: 'canViewAccountingCashbook' },
    { page: 'AccountingReceipts',    name: 'Belege',            icon: Receipt,    permission: 'canViewAccountingReceipts' },
    { page: 'AccountingCreditors',   name: 'Kreditoren',        icon: CreditCard, permission: 'canViewAccountingCreditors' },
    { page: 'AccountingExport',      name: 'Export',            icon: FileText,   permission: 'canExportAccounting' },
    { page: 'AccountingFixedCosts',  name: 'Fixkosten',         icon: Euro,       permission: 'canViewAccounting' },
    { page: 'AccountingLiabilities', name: 'Verbindlichkeiten', icon: Scale,      permission: 'canViewLiabilities' },
    { page: 'AccountingBank',        name: 'Bankkonten',        icon: Banknote,   permission: 'canViewAccounting' },
    { page: 'DailyAnalysis',         name: 'Tagesanalyse',      icon: BarChart3,  permission: 'canViewAnalytics' },

    // Team
    { page: 'Employees',      name: 'Mitarbeiter',     icon: Users,         permission: 'canViewEmployees' },
    { page: 'Calendar',       name: 'Schichtplan',     icon: Calendar,      permission: 'canViewShifts' },
    { page: 'TeamCalendar',   name: 'Teamkalender',    icon: CalendarDays,  permission: 'canViewTeamCalendar' },
    { page: 'TimeManagement', name: 'Zeiterfassung',   icon: Clock,         permission: 'canViewOwnTimeEntries' },
    { page: 'Vacation',       name: 'Urlaub',          icon: Plane,         permission: 'canViewVacation' },
    { page: 'MyShifts',       name: 'Meine Schichten', icon: CalendarClock, permission: 'canViewShifts' },
    { page: 'ShiftSwaps',     name: 'Schichttausch',   icon: RefreshCw,     permission: 'canRequestShiftSwap' },
    { page: 'PermissionsNew', name: 'Berechtigungen',  icon: Shield,        permission: 'canEditEmployeePermissions' },
    { page: 'TeamMeeting',    name: 'Teamsitzung',     icon: MessageSquare, permission: 'canViewTeamMeeting' },
    { page: 'Stationsplan',   name: 'Stationsplan',    icon: LayoutGrid,    permission: 'canViewShifts' },
    { page: 'Onboarding',       name: 'Onboarding',       icon: HelpCircle,   permission: 'canViewOnboarding' },

    // Einstellungen & Mehr
    { page: 'Documents',        name: 'Dokumente',       icon: FileText,     permission: 'canViewSettings' },
    { page: 'BusinessCard',     name: 'Visitenkarte',     icon: CreditCard,   permission: 'canViewDashboard' },
    { page: 'ModuleCenter',     name: 'Modulcenter',      icon: LayoutGrid,   permission: 'canViewSettings' },
    { page: 'BusinessCalendar', name: 'Betriebskalender', icon: CalendarDays, permission: 'canViewSettings' },
    { page: 'DataQuality',      name: 'Datenqualität',    icon: Database,     permission: 'isManager' },
];

// ── KOMBINIERT ────────────────────────────────────────────────────────────────
export const allPages = [
    ...mainNavigation.flatMap(s => s.pages),
    ...additionalPages,
];