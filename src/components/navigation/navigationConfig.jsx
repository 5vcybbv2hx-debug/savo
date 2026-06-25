import {
    Home, Utensils, Package, Wine, Users,
    Calendar, Clock, Shield, BookOpen, TrendingUp,
    CheckSquare, MapPin, ShoppingCart, ShoppingBasket, RefreshCw, ClipboardCheck,
    Settings, FileText, BarChart2, Trash2,
    ArrowLeftRight, Star, Brush, FolderOpen, Wrench,
    Palmtree, ListChecks, Video, QrCode, Layers, Zap,
    Receipt, TrendingDown, Download, Euro, Building2, AlertTriangle, Trophy
} from 'lucide-react';

export const mainNavigation = [
    {
        id: 'dashboard',
        name: 'Dashboard',
        icon: Home,
        pages: [
            { name: 'Übersicht', page: 'Dashboard', icon: Home, permission: 'canViewDashboard' },
        ]
    },
    {
        id: 'betrieb',
        name: 'Betrieb',
        icon: Utensils,
        pages: [
            { name: 'Betrieb', page: 'BetriebHub', icon: Utensils, permission: 'canViewReservations' },
        ]
    },
    {
        id: 'waren',
        name: 'Waren & Lager',
        icon: Package,
        pages: [
            { name: 'Waren & Lager', page: 'Warehouse', icon: Package, permission: 'canViewWarehouse' },
        ]
    },
    {
        id: 'karte',
        name: 'Karte & Rezepte',
        icon: Wine,
        pages: [
            { name: 'Karte & Rezepte', page: 'KarteHub', icon: Wine, permission: 'canViewDrinkMenu' },
        ]
    },
    {
        id: 'buchhaltung',
        name: 'Buchhaltung',
        icon: Euro,
        pages: [
            { name: 'Buchhaltung', page: 'AccountingHub', icon: Euro, permission: 'canViewAccounting' },
        ]
    },
    {
        id: 'team',
        name: 'Team',
        icon: Users,
        pages: [
            { name: 'Team', page: 'TeamHub', icon: Users, permission: 'canViewShifts' },
        ]
    },
    {
        id: 'einstellungen',
        name: 'Einstellungen',
        icon: Settings,
        pages: [
            { name: 'Einstellungen', page: 'Settings', icon: Settings, permission: 'canViewSettings' },
        ]
    },
];

export const additionalPages = [
    // Betrieb
    { name: 'Gäste & Tische',  page: 'GuestHub',     icon: MapPin,         permission: 'canViewReservations'        },
    { name: 'Aufgaben',        page: 'Todos',         icon: CheckSquare,    permission: 'canViewTodos'               },
    { name: 'Wochenaufgaben',  page: 'WeeklyTasks',   icon: ListChecks,     permission: 'canViewTodos'               },
    { name: 'Putzliste',       page: 'Cleaning',      icon: Brush,          permission: 'canViewCleaning'            },
    { name: 'Events',          page: 'Events',        icon: Star,           permission: 'canViewEvents'              },
    // Waren
    { name: 'Auffüllen',        page: 'Restock',      icon: RefreshCw,      permission: 'canViewRestock'             },
    { name: 'Bestellungen',     page: 'Shopping',     icon: ShoppingCart,   permission: 'canViewShopping'            },
    { name: 'Einkaufsliste',    page: 'QuickList',    icon: ShoppingBasket, permission: 'canViewShopping'            },
    { name: 'Artikeldatenbank', page: 'Articles',     icon: Package,        permission: 'canViewWarehouse'           },
    { name: 'Lagerplätze',      page: 'Storage',      icon: Layers,         permission: 'canViewWarehouse'           },
    { name: 'Inventur',         page: 'Inventory',    icon: ClipboardCheck, permission: 'canViewInventory'           },
    { name: 'Lieferanten',      page: 'Suppliers',    icon: Building2,      permission: 'canViewSuppliers'           },
    { name: 'Schwund',          page: 'Wastage',      icon: Trash2,         permission: 'canViewWastage'             },
    // Karte
    { name: 'Getränkekarte',   page: 'DrinkMenu',       icon: Wine,       permission: 'canViewDrinkMenu'       },
    { name: 'Rezepte',         page: 'Recipes',         icon: BookOpen,   permission: 'canViewRecipes'         },
    { name: 'Preisrechner',    page: 'PriceCalculator', icon: TrendingUp, permission: 'canViewPriceCalculator' },
    // Team
    { name: 'Mitarbeiter',     page: 'Employees',         icon: Users,          permission: 'canViewEmployees'           },
    { name: 'Schichtplan',     page: 'Calendar',          icon: Calendar,       permission: 'canViewShifts'              },
    { name: 'Teamkalender',    page: 'TeamCalendar',      icon: Calendar,       permission: 'canViewTeamCalendar'        },
    { name: 'Zeiterfassung',   page: 'TimeManagement',    icon: Clock,          permission: 'canViewOwnTimeEntries'      },
    { name: 'Urlaub',          page: 'Vacation',          icon: Palmtree,       permission: 'canViewVacation'            },
    { name: 'Meine Schichten', page: 'MyShifts',          icon: Clock,          permission: 'canViewShifts'              },
    { name: 'Schichttausch',   page: 'ShiftSwaps',        icon: ArrowLeftRight, permission: 'canRequestShiftSwap'        },
    { name: 'Berechtigungen',  page: 'Permissions',       icon: Shield,         permission: 'canEditEmployeePermissions' },
    { name: 'Teamsitzung',     page: 'TeamMeeting',       icon: Video,          permission: 'canViewTeamMeeting'         },
    { name: 'WM-Spielplan',    page: 'WorldCupSchedule',  icon: Trophy,         permission: 'canViewTeamMeeting'         },
    // Buchhaltung
    { name: 'Kassenbuch',        page: 'AccountingCashbook',    icon: BookOpen,     permission: 'canViewAccountingCashbook'  },
    { name: 'Belege',            page: 'AccountingReceipts',    icon: Receipt,      permission: 'canViewAccountingReceipts'  },
    { name: 'Kreditoren',        page: 'AccountingCreditors',   icon: TrendingDown, permission: 'canViewAccountingCreditors' },
    { name: 'Export',            page: 'AccountingExport',      icon: Download,     permission: 'canExportAccounting'        },
    { name: 'Fixkosten',         page: 'AccountingFixedCosts',  icon: RefreshCw,    permission: 'canViewAccounting'          },
    { name: 'Verbindlichkeiten', page: 'AccountingLiabilities', icon: TrendingDown, permission: 'canViewLiabilities'         },
    { name: 'Tagesabschluss',    page: 'DailyAnalysis',         icon: BarChart2,    permission: 'canViewAnalytics'           },
    // Einstellungen & Sonstiges
    { name: 'Stationsplan',      page: 'Stationsplan',     icon: MapPin,        permission: 'canViewShifts'    },
    { name: 'Dokumente',         page: 'Documents',        icon: FolderOpen,    permission: 'canViewSettings'  },
    { name: 'Wartung',           page: 'Maintenance',      icon: Wrench,        permission: 'canViewSettings'  },
    { name: 'Einarbeitung',      page: 'Onboarding',       icon: Users,         permission: 'canViewOnboarding'},
    { name: 'Visitenkarte',      page: 'BusinessCard',     icon: QrCode,        permission: 'canViewMeinTag'   },
    { name: 'Modulcenter',       page: 'ModuleCenter',     icon: Layers,        permission: 'canViewSettings'  },
    { name: 'Betriebskalender',  page: 'BusinessCalendar', icon: Calendar,      permission: 'canViewSettings'  },
    { name: 'Datenqualität',     page: 'DataQuality',      icon: AlertTriangle, permission: 'isManager'        },
];

export const allPages = mainNavigation.flatMap(a => a.pages).concat(additionalPages);
