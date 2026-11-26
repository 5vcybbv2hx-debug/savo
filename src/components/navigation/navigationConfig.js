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
    LayoutGrid, Database, CalendarClock, Truck, MessageSquare, Target,
    Banknote, BookCopy, Warehouse, Utensils, Siren, User, TrendingUp, Ticket,
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
    // Gutscheine: für alle Rollen sichtbar — Manager sehen die Vollansicht,
    // alle anderen die Einlöse-Ansicht (Gating in Vouchers.jsx).
    // Ganz oben, direkt nach den Modulen der Bottom-Nav — am Tresen am häufigsten gebraucht.
    { page: 'Vouchers',       name: 'Gutscheine',        icon: Ticket,        permission: 'canViewDashboard' },

    // Waren & Lager — "Auffüllen" führt direkt in die eine Keller-Auffüllliste
    // (Warehouse?tab=keller). Die separate Tages-Auffüllliste ist kein eigener Einstieg mehr.
    { page: 'Warehouse?tab=keller', name: 'Auffüllen', icon: Package, permission: 'canViewRestock' },

    // Einstellungen & Mehr
    { page: 'ModuleCenter',     name: 'Modulcenter',      icon: LayoutGrid,   permission: 'canViewSettings' },
];

// Seiten ohne eigenen Drawer-Eintrag (über TeamHub/BetriebHub/Sidebar erreichbar),
// die aber in der Bottom-Navigation als Tab auflösbar bleiben müssen.
export const tabPages = [
    { page: 'GuestHub',       name: 'Gäste & Tische',    icon: Users,         permission: 'canViewReservations' },
    { page: 'Todos',          name: 'Aufgaben',           icon: ClipboardList, permission: 'canViewTodos' },
    { page: 'Cleaning',       name: 'Putzliste',          icon: Sparkles,      permission: 'canViewCleaning' },
    { page: 'Events',         name: 'Events',             icon: CalendarDays,  permission: 'canViewEvents' },
    { page: 'Wusa',           name: 'Wurstsalat',        icon: Utensils,      permission: 'canViewDashboard' },
    { page: 'DrinkMenu',      name: 'Getränkekarte',      icon: Wine,          permission: 'canViewDrinkMenu' },
    { page: 'AccountingDashboard', name: 'Buchhaltung',   icon: Calculator,    permission: 'canViewAccounting' },
    { page: 'Employees',      name: 'Mitarbeiter',        icon: Users,         permission: 'canViewEmployees' },
    { page: 'Calendar',       name: 'Schichtplan',        icon: Calendar,      permission: 'canViewShifts' },
    { page: 'TimeManagement', name: 'Zeiterfassung',      icon: Clock,         permission: 'canViewOwnTimeEntries' },
    { page: 'MyArea',         name: 'Mein Bereich',       icon: User,          permission: 'canViewDashboard' },
    { page: 'MyShifts',       name: 'Meine Schichten',    icon: CalendarClock, permission: 'canViewShifts' },
    { page: 'PermissionsNew', name: 'Berechtigungen',     icon: Shield,        permission: 'canEditEmployeePermissions' },
    { page: 'TeamMeeting',    name: 'Teamsitzung',        icon: MessageSquare, permission: 'canViewTeamMeeting' },
];

// ── KOMBINIERT ────────────────────────────────────────────────────────────────
export const allPages = [
    ...mainNavigation.flatMap(s => s.pages),
    ...additionalPages,
];