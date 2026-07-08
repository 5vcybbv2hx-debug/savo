/**
 * ZENTRALE PAGE-KONFIGURATION
 * Single Source of Truth für Routing, Labels, Meta-Daten
 * 
 * Verwendung:
 * - Navigation (Sidebar, Bottom Nav)
 * - Seitentitel / Breadcrumbs
 * - Meta-Daten
 * - Rollensichtbarkeit
 */

import {
  Home, Utensils, Package, Wine, Users,
  Calendar, Clock, Shield, BookOpen, TrendingUp,
  CheckSquare, MapPin, ShoppingCart, RefreshCw,
  Settings, FileText, BarChart2, Trash2, ClipboardList,
  ArrowLeftRight, Star, Brush, FolderOpen, Wrench,
  Palmtree, ListChecks, Video, Euro, Receipt, TrendingDown, Download
} from 'lucide-react';

/**
 * Alle Seiten zentral definiert.
 * Format: { path, displayName, shortName, icon, section, permission }
 */
export const PAGE_REGISTRY = {
  // Dashboard
  dashboard: {
    path: 'Dashboard',
    displayName: 'Übersicht',
    shortName: 'Dashboard',
    icon: Home,
    section: 'dashboard',
    permission: 'canViewDashboard',
  },

  // Betrieb
  guests: {
    path: 'GuestHub',
    displayName: 'Gäste & Tische',
    shortName: 'Gäste',
    icon: MapPin,
    section: 'betrieb',
    permission: 'canViewReservations',
  },
  restock: {
    path: 'Restock',
    displayName: 'Auffüllliste',
    shortName: 'Restock',
    icon: RefreshCw,
    section: 'betrieb',
    permission: 'canViewRestock',
  },
  todos: {
    path: 'Todos',
    displayName: 'Aufgaben',
    shortName: 'Todos',
    icon: CheckSquare,
    section: 'betrieb',
    permission: 'canViewTodos',
  },
  cleaning: {
    path: 'Cleaning',
    displayName: 'Putzliste',
    shortName: 'Putzen',
    icon: Brush,
    section: 'betrieb',
    permission: 'canViewCleaning',
  },
  weeklyTasks: {
    path: 'WeeklyTasks',
    displayName: 'Wochenaufgaben',
    shortName: 'Wochenaufgaben',
    icon: ListChecks,
    section: 'betrieb',
    permission: 'canViewCleaning',
  },
  shopping: {
    path: 'Shopping',
    displayName: 'Einkaufsliste',
    shortName: 'Einkauf',
    icon: ShoppingCart,
    section: 'betrieb',
    permission: 'canViewShopping',
  },
  events: {
    path: 'Events',
    displayName: 'Events',
    shortName: 'Events',
    icon: Star,
    section: 'betrieb',
    permission: 'canViewEvents',
  },

  // Lager
  articles: {
    path: 'Articles',
    displayName: 'Artikel',
    shortName: 'Artikel',
    icon: Package,
    section: 'lager',
    permission: 'canViewWarehouse',
  },
  warehouse: {
    path: 'Warehouse',
    displayName: 'Bestand',
    shortName: 'Bestand',
    icon: Package,
    section: 'lager',
    permission: 'canViewWarehouse',
  },
  inventory: {
    path: 'Inventory',
    displayName: 'Inventur',
    shortName: 'Inventur',
    icon: ClipboardList,
    section: 'lager',
    permission: 'canViewInventory',
  },
  wastage: {
    path: 'Wastage',
    displayName: 'Schwund',
    shortName: 'Schwund',
    icon: Trash2,
    section: 'lager',
    permission: 'canViewWastage',
  },
  suppliers: {
    path: 'Suppliers',
    displayName: 'Lieferanten',
    shortName: 'Lieferanten',
    icon: Package,
    section: 'lager',
    permission: 'canViewSuppliers',
  },
  storage: {
    path: 'Storage',
    displayName: 'Lagerplätze',
    shortName: 'Lager',
    icon: Package,
    section: 'lager',
    permission: 'canViewWarehouse',
  },

  // Karte & Rezepte
  drinkMenu: {
    path: 'DrinkMenu',
    displayName: 'Getränkekarte',
    shortName: 'Karte',
    icon: Wine,
    section: 'karte',
    permission: 'canViewDrinkMenu',
  },
  recipes: {
    path: 'Recipes',
    displayName: 'Rezepte',
    shortName: 'Rezepte',
    icon: BookOpen,
    section: 'karte',
    permission: 'canViewRecipes',
  },
  priceCalculator: {
    path: 'PriceCalculator',
    displayName: 'Schnellkalkulation',
    shortName: 'Kalkulation',
    icon: TrendingUp,
    section: 'karte',
    permission: 'canViewPriceCalculator',
  },

  // Team
  employees: {
    path: 'Employees',
    displayName: 'Mitarbeiter',
    shortName: 'Team',
    icon: Users,
    section: 'team',
    permission: 'canViewEmployees',
  },
  calendar: {
    path: 'Calendar',
    displayName: 'Schichtplan',
    shortName: 'Schichten',
    icon: Calendar,
    section: 'team',
    permission: 'canViewShifts',
  },
  teamCalendar: {
    path: 'TeamCalendar',
    displayName: 'Teamkalender',
    shortName: 'Team-Kalender',
    icon: Calendar,
    section: 'team',
    permission: 'canViewShifts',
  },
  timeManagement: {
    path: 'TimeManagement',
    displayName: 'Zeiterfassung',
    shortName: 'Zeiten',
    icon: Clock,
    section: 'team',
    permission: 'canViewOwnTimeEntries',
  },
  vacation: {
    path: 'Vacation',
    displayName: 'Urlaub',
    shortName: 'Urlaub',
    icon: Palmtree,
    section: 'team',
    permission: 'canViewOwnTimeEntries',
  },
  shiftSwaps: {
    path: 'ShiftSwaps',
    displayName: 'Schichttausch',
    shortName: 'Tausch',
    icon: ArrowLeftRight,
    section: 'team',
    permission: 'canRequestShiftSwap',
  },
  permissions: {
    path: 'Permissions',
    displayName: 'Berechtigungen',
    shortName: 'Rollen',
    icon: Shield,
    section: 'team',
    permission: 'canEditEmployeePermissions',
  },
  teamMeeting: {
    path: 'TeamMeeting',
    displayName: 'Teamsitzung',
    shortName: 'Meeting',
    icon: Video,
    section: 'team',
    permission: 'canViewShifts',
  },

  // Zusätzliche Pages
  stationsplan: {
    path: 'Stationsplan',
    displayName: 'Stationsplan',
    shortName: 'Stationen',
    icon: MapPin,
    section: 'additional',
    permission: 'canViewShifts',
  },
  dailyAnalysis: {
    path: 'DailyAnalysis',
    displayName: 'Tagesabschluss',
    shortName: 'Abschluss',
    icon: BarChart2,
    section: 'additional',
    permission: 'canViewAnalytics',
  },
  reports: {
    path: 'Reports',
    displayName: 'Berichte',
    shortName: 'Reports',
    icon: FileText,
    section: 'additional',
    permission: 'canViewAnalytics',
  },
  salesAnalysis: {
    path: 'SalesAnalysis',
    displayName: 'Umsatz',
    shortName: 'Umsatz',
    icon: TrendingUp,
    section: 'additional',
    permission: 'canViewAnalytics',
  },
  documents: {
    path: 'Documents',
    displayName: 'Dokumente',
    shortName: 'Docs',
    icon: FolderOpen,
    section: 'additional',
    permission: 'canViewSettings',
  },
  maintenance: {
    path: 'Maintenance',
    displayName: 'Wartung',
    shortName: 'Wartung',
    icon: Wrench,
    section: 'additional',
    permission: 'canViewSettings',
  },
  settings: {
    path: 'Settings',
    displayName: 'Einstellungen',
    shortName: 'Settings',
    icon: Settings,
    section: 'additional',
    permission: 'canViewSettings',
  },
  companySettings: {
    path: 'CompanySettings',
    displayName: 'Firmendaten',
    shortName: 'Firma',
    icon: FileText,
    section: 'additional',
    permission: 'canEditCompanySettings',
  },
  onboarding: {
    path: 'Onboarding',
    displayName: 'Einarbeitung',
    shortName: 'Onboarding',
    icon: Users,
    section: 'additional',
    permission: 'canViewOnboarding',
  },

  // Buchhaltung
  accountingDashboard: {
    path: 'AccountingDashboard',
    displayName: 'Buchhaltung',
    shortName: 'Buchhaltung',
    icon: Euro,
    section: 'accounting',
    permission: 'canViewAccounting',
  },
  accountingCashbook: {
    path: 'AccountingCashbook',
    displayName: 'Kassenbuch',
    shortName: 'Kasse',
    icon: BookOpen,
    section: 'accounting',
    permission: 'canViewAccountingCashbook',
  },
  accountingReceipts: {
    path: 'AccountingReceipts',
    displayName: 'Belege',
    shortName: 'Belege',
    icon: Receipt,
    section: 'accounting',
    permission: 'canViewAccountingReceipts',
  },
  accountingCreditors: {
    path: 'AccountingCreditors',
    displayName: 'Kreditoren',
    shortName: 'Kreditoren',
    icon: TrendingDown,
    section: 'accounting',
    permission: 'canViewAccountingCreditors',
  },
  accountingDebitors: {
    path: 'AccountingDebitors',
    displayName: 'Debitoren',
    shortName: 'Debitoren',
    icon: TrendingUp,
    section: 'accounting',
    permission: 'canViewAccountingDebitors',
  },
  accountingExport: {
    path: 'AccountingExport',
    displayName: 'Exportcenter',
    shortName: 'Export',
    icon: Download,
    section: 'accounting',
    permission: 'canExportAccounting',
  },
  accountingMonthlyClosing: {
    path: 'AccountingMonthlyClosing',
    displayName: 'Monatsabschluss',
    shortName: 'Abschluss',
    icon: Calendar,
    section: 'accounting',
    permission: 'canCloseAccountingMonth',
  },
};

/**
 * Navigationsgruppen für Sidebar/Navigation
 */
export const NAVIGATION_GROUPS = [
  {
    id: 'dashboard',
    groupName: 'Dashboard',
    pages: ['dashboard'],
  },
  {
    id: 'betrieb',
    groupName: 'Betrieb',
    pages: ['guests', 'restock', 'todos', 'cleaning', 'weeklyTasks', 'shopping', 'events'],
  },
  {
    id: 'lager',
    groupName: 'Lager',
    pages: ['articles', 'warehouse', 'inventory', 'wastage', 'suppliers', 'storage'],
  },
  {
    id: 'karte',
    groupName: 'Karte & Rezepte',
    pages: ['drinkMenu', 'recipes', 'priceCalculator'],
  },
  {
    id: 'team',
    groupName: 'Team',
    pages: ['employees', 'calendar', 'teamCalendar', 'timeManagement', 'vacation', 'shiftSwaps', 'permissions', 'teamMeeting'],
  },
  {
    id: 'accounting',
    groupName: 'Buchhaltung',
    pages: ['accountingDashboard', 'accountingCashbook', 'accountingReceipts', 'accountingCreditors', 'accountingDebitors', 'accountingExport', 'accountingMonthlyClosing'],
  },
];

/**
 * Zusätzliche Pages (im "Mehr"-Menü)
 */
export const ADDITIONAL_PAGES_GROUP = {
  groupName: 'Einstellungen & Tools',
  pages: ['stationsplan', 'dailyAnalysis', 'reports', 'salesAnalysis', 'documents', 'maintenance', 'settings', 'companySettings', 'onboarding'],
};

/**
 * Getter-Funktionen
 */
export function getPageByPath(path) {
  return Object.values(PAGE_REGISTRY).find(p => p.path === path);
}

export function getPageByKey(key) {
  return PAGE_REGISTRY[key];
}

export function getDisplayName(path) {
  const page = getPageByPath(path);
  return page?.displayName || path;
}

export function getShortName(path) {
  const page = getPageByPath(path);
  return page?.shortName || path;
}

export default PAGE_REGISTRY;