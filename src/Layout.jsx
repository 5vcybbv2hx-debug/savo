import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { haptics } from '@/components/utils/haptics';
import { ArrowLeft, LogOut, Search, ScanLine, Settings, PanelLeftClose, PanelLeftOpen, Pin, PinOff } from 'lucide-react';
import BarcodeScanner from '@/components/restock/BarcodeScanner';
import { mainNavigation, additionalPages, allPages } from '@/components/navigation/navigationConfig';
import { useActiveNavigation } from '@/components/navigation/useActiveNavigation';
import { getTopPages } from '@/hooks/usePageTracking';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useSwapInboxCount } from '@/components/shifts/ShiftSwapInboxCard';
import { cn } from "@/lib/utils";
import { useState, useMemo } from 'react';
import { usePermissions } from '@/components/auth/usePermissions';
import PWAInstallPrompt from '@/components/pwa/PWAInstallPrompt';
import OfflineIndicator from '@/components/pwa/OfflineIndicator';
import OfflineSyncManager from '@/components/pwa/OfflineSyncManager';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import GlobalSearch from '@/components/search/GlobalSearch';
import { loadSavedColors } from '@/components/settings/ColorCustomizer';
import ErrorBoundary from '@/components/error/ErrorBoundary';
import { useAnalytics } from '@/components/analytics/useAnalytics';
import DesktopQuickBar from '@/components/navigation/DesktopQuickBar';
import { useOneSignal, oneSignalLogout } from '@/lib/useOneSignal';
import PushPermissionPrompt from '@/components/pwa/PushPermissionPrompt';

export default function Layout({ children, currentPageName }) {
    // ── State ────────────────────────────────────────────────────────────────
    const [searchOpen, setSearchOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try { const stored = localStorage.getItem('sidebar_collapsed'); return stored !== null ? stored === 'true' : true; } catch { return true; }
    });
    const toggleSidebar = () => {
        setSidebarCollapsed(prev => {
            const next = !prev;
            try {
                localStorage.setItem('sidebar_collapsed', next ? 'true' : 'false');
                window.dispatchEvent(new Event('sidebar-toggle'));
            } catch {}
            return next;
        });
    };
    const [scannerOpen, setScannerOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [currentUser, setCurrentUser] = React.useState(null);
    const [company, setCompany] = React.useState(null);
    const [mobileNavPages, setMobileNavPages] = React.useState([]);
    // Optimistic active tab — sofortiges Highlighting beim Tap (vor URL-Wechsel)
    const [optimisticTab, setOptimisticTab] = React.useState(null);

    // ── Pinned Nav (user-customizable bottom tabs) ────────────────────────────
    const PINNED_KEY = 'bm_pinned_nav';
    const MAX_PINS = 4;
    const [pinnedPages, setPinnedPages] = React.useState(() => {
        try { return JSON.parse(localStorage.getItem(PINNED_KEY) || 'null'); } catch { return null; }
    });
    const isPinned = (page) => !!pinnedPages && pinnedPages.includes(page);
    const canPin = !!pinnedPages ? pinnedPages.length < MAX_PINS : false;
    const togglePin = (page) => {
        setPinnedPages(prev => {
            const current = prev || [];
            let next;
            if (current.includes(page)) {
                next = current.filter(p => p !== page);
                // Wenn alle entfernt → null (zurück zu Auto)
                if (next.length === 0) next = null;
            } else {
                if (current.length >= MAX_PINS) return prev; // voll
                next = [...current, page];
            }
            try { localStorage.setItem(PINNED_KEY, JSON.stringify(next)); } catch {}
            return next;
        });
    };

    // ── Hooks (all hooks before any early returns) ────────────────────────────
    const { isPageActive } = useActiveNavigation();
    const permissions = usePermissions();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { track } = useAnalytics();

    // Badge-Counter für Schichttausch-Posteingang
    const swapInboxCount = useSwapInboxCount(
        permissions.employeeId ? { id: permissions.employeeId } : null
    );
    // Badge-Counter für Mehr-Button (ungelesene Notifications) — teilt Query mit NotificationBell
    const { data: notifData = [] } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => base44.entities.Notification.list('-created_date', 100),
        enabled: !!currentUser?.email,
        staleTime: 5 * 60_000,
        refetchInterval: 60_000,
    });
    const unreadNotifCount = React.useMemo(() => {
        if (!currentUser?.email) return 0;
        return notifData.filter(n => !n.read_by?.includes(currentUser.email)).length;
    }, [notifData, currentUser?.email]);

    // OneSignal: mit Employee-ID initialisieren sobald eingeloggt
    useOneSignal({
        employeeId: permissions.employeeId,
        isAuthenticated: !!currentUser
    });

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleScan = (code) => {
        setScannerOpen(false);

        // 1. Vollständige URL vom Lagerplatz-Etikett (z.B. https://…/StorageLocationScan/abc123)
        try {
            const url = new URL(code);
            const storageMatch = url.pathname.match(/\/StorageLocationScan\/(.+)/);
            if (storageMatch) {
                navigate(`/StorageLocationScan/${storageMatch[1]}`);
                return;
            }
        } catch (_) {
            // kein gültiger URL — weiter mit Barcode-Logik
        }

        // 2. Rohe ID (UUID-Format oder Länge > 20) → Lagerplatz
        const isStorageQR = /^[a-f0-9]{8}-[a-f0-9]{4}/.test(code) || code.length > 20;
        if (isStorageQR) {
            navigate(`/StorageLocationScan/${code}`);
        } else {
            navigate(createPageUrl('Shopping') + `?scan=${code}`);
        }
    };

    const handleRefresh = async () => {
        // Only refetch queries that are currently active (mounted on screen).
        // invalidateQueries() with no args marks ALL queries stale and refetches
        // every active one simultaneously — 20+ parallel API calls can exceed
        // the platform rate limit. refetchQueries({ type: 'active' }) limits
        // the burst to just what's visible, and skips near-static data
        // (employees, articles) that hasn't changed.
        await queryClient.refetchQueries({ type: 'active' });
    };

    // ── Effects ──────────────────────────────────────────────────────────────
    React.useEffect(() => {
        // CompanyInfo is already fetched by App.jsx BrandingLoader and cached in
        // React Query under ['company-info']. Reuse the cache instead of making
        // a duplicate API call on every Layout mount.
        const cachedCompany = queryClient.getQueryData(['company-info']);
        if (cachedCompany?.[0]) {
            setCompany(cachedCompany[0]);
        } else {
            base44.entities.CompanyInfo.list().then(records => {
                if (records?.[0]) setCompany(records[0]);
            }).catch(() => {});
        }

        // User is already fetched via useQuery in Dashboard; reuse if available
        const cachedUser = queryClient.getQueryData(['user']);
        if (cachedUser) {
            setCurrentUser(cachedUser);
            if (cachedUser?.email) {
                const updateNav = () => {
                    const allNavPages = mainNavigation.flatMap(a => a.pages).concat(additionalPages);
                    const allowed = allNavPages.map(p => p.page);
                    const top = getTopPages(cachedUser.email, 4, allowed);
                    if (top.length >= 2) {
                        setMobileNavPages(top.map(t => allNavPages.find(p => p.page === t.page)).filter(Boolean));
                    }
                };
                updateNav();
            }
        } else {
            base44.auth.me().then(user => {
                setCurrentUser(user);
                queryClient.setQueryData(['user'], user);
                if (user?.email) {
                    const updateNav = () => {
                        const allNavPages = mainNavigation.flatMap(a => a.pages).concat(additionalPages);
                        const allowed = allNavPages.map(p => p.page);
                        const top = getTopPages(user.email, 4, allowed);
                        if (top.length >= 2) {
                            setMobileNavPages(top.map(t => allNavPages.find(p => p.page === t.page)).filter(Boolean));
                        }
                    };
                    updateNav();
                }
            }).catch(() => {});
        }

        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [queryClient]);

    React.useEffect(() => { loadSavedColors(); }, []);

    // Theme sync (index.html script handles initial flash-prevention;
    // this effect handles runtime theme changes e.g. from Settings page)
    React.useEffect(() => {
        const applyTheme = () => {
            const t = localStorage.getItem('theme') || 'dark';
            const root = document.documentElement;
            if (t === 'light') {
                root.classList.remove('dark');
            } else if (t === 'dark') {
                root.classList.add('dark');
            } else {
                root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
            }
        };
        applyTheme();
        // Listen for storage events (theme changed in another tab)
        window.addEventListener('storage', applyTheme);
        return () => window.removeEventListener('storage', applyTheme);
    }, []);


    // Drawer: strukturierte Bereiche mit Unterseiten (nicht Hub-Einträge)
    const drawerSections = useMemo(() => [
        {
            id: 'betrieb', name: 'Betrieb',
            pages: additionalPages.filter(p => ['GuestHub','Todos','WeeklyTasks','Cleaning','Maintenance','Events','DisplayManager','Wusa'].includes(p.page))
        },
        {
            id: 'waren', name: 'Waren & Lager',
            pages: additionalPages.filter(p => ['Restock','Shopping','QuickList','Articles','Storage','Inventory','Suppliers','Wastage'].includes(p.page))
        },
        {
            id: 'karte', name: 'Karte & Rezepte',
            pages: additionalPages.filter(p => ['DrinkMenu','Recipes','PriceCalculator'].includes(p.page))
        },
        {
            id: 'buchhaltung', name: 'Buchhaltung',
            pages: additionalPages.filter(p => ['AccountingDashboard','AccountingCashbook','AccountingReceipts','AccountingCreditors','AccountingExport','AccountingFixedCosts','AccountingLiabilities','DailyAnalysis','StaffingAnalysis'].includes(p.page))
        },
        {
            id: 'team', name: 'Team',
            pages: additionalPages.filter(p => ['Employees','Calendar','TeamCalendar','TimeManagement','Vacation','MyShifts','ShiftSwaps','PermissionsNew','TeamMeeting','Stationsplan'].includes(p.page))
        },
        {
            id: 'sonstiges', name: 'Einstellungen & Mehr',
            pages: additionalPages.filter(p => ['Settings','Documents','Onboarding','BusinessCard','ModuleCenter','BusinessCalendar','DataQuality'].includes(p.page))
        },
    ], [additionalPages]);
    const getPageName = (pageName) => allPages.find(p => p.page === pageName)?.name || 'BarManager';
    const primaryPages = mainNavigation.flatMap(a => a.pages).map(p => p.page);
    const isRootPage = primaryPages.includes(currentPageName);

    // Build current mobile nav items for tab navigation hook
    const allNavPages = mainNavigation.flatMap(a => a.pages).concat(additionalPages);

    // Role-based default bottom tabs
    const getRoleDefaultTabs = () => {
        if (permissions.isAdmin) {
            // Admin: Übersicht, Gäste & Tische, Schichtplan, Aufgaben
            return ['Dashboard', 'GuestHub', 'Calendar', 'Todos'];
        }
        if (permissions.isManager) {
            // Manager: Übersicht, Gäste & Tische, Schichtplan, Aufgaben
            return ['Dashboard', 'GuestHub', 'Calendar', 'Todos'];
        }
        if (permissions.canViewTodos) {
            // Barkeeper: Übersicht, Schichtplan, Aufgaben, Putzliste
            return ['Dashboard', 'Calendar', 'Todos', 'Cleaning'];
        }
        // Aushilfe: Übersicht, Meine Schichten, Zeiterfassung, Schichttausch
        return ['Dashboard', 'MyShifts', 'TimeManagement', 'ShiftSwaps'];
    };

    const defaultPages = getRoleDefaultTabs();
    // Priorität: 1. Manuell gepinnt  2. Automatisch (meistbesucht)  3. Rolle-Default
    const currentNavItems = (() => {
        if (pinnedPages && pinnedPages.length > 0) {
            return pinnedPages.map(p => allNavPages.find(i => i.page === p)).filter(Boolean);
        }
        if (mobileNavPages.length >= 2) return mobileNavPages;
        return defaultPages.map(p => allNavPages.find(i => i.page === p)).filter(Boolean);
    })();

    const { navigateToTab, getActiveTab } = useTabNavigation(currentNavItems);

    // Clear optimistic state when the real URL settles
    React.useEffect(() => {
        setOptimisticTab(null);
    }, [currentPageName]);

    // Determine active tab: use optimistic value first, then real URL
    const activeTabPage = optimisticTab || getActiveTab();
    const isTabActive = (page) => activeTabPage === page || (!activeTabPage && isPageActive(page));

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-background" onContextMenu={(e) => e.preventDefault()}>
                <ServiceWorkerRegistration />
                <PWAInstallPrompt />
                <OfflineIndicator />
                <OfflineSyncManager />

                {/* Fixed Top Header */}
                <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card/95 border-b border-border/50 backdrop-blur-xl pt-safe">
                    <div className="flex items-center gap-3 px-3 py-3">

                        {/* Mobile: Zurück-Button */}
                        {!isRootPage && (
                            <button
                                onClick={() => navigate(-1)}
                                className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent/50 active:bg-accent text-muted-foreground hover:text-foreground transition-all"
                                title="Zurück"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <h1 className="text-lg font-bold text-foreground flex-1">
                            {getPageName(currentPageName)}
                        </h1>
                        {currentUser && (
                            <NotificationBell userEmail={currentUser.email} userRole={currentUser.role} employeeId={permissions.employeeId} />
                        )}
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent/50 active:bg-accent text-muted-foreground hover:text-foreground transition-all"
                            title="Suche (Strg+K)"
                        >
                            <Search className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setScannerOpen(true)}
                            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent/50 active:bg-accent text-muted-foreground hover:text-foreground transition-all"
                            title="Scannen"
                        >
                            <ScanLine className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setSettingsOpen(true)}
                            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent/50 active:bg-accent text-muted-foreground hover:text-foreground transition-all"
                            title="Einstellungen"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Global Search */}
                <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

                {/* Barcode Scanner */}
                <BarcodeScanner
                    open={scannerOpen}
                    onClose={() => setScannerOpen(false)}
                    onScan={handleScan}
                    title="Artikel scannen"
                    mode="default"
                />

                {/* Desktop Sidebar */}
                <aside className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 transition-all duration-300 ${sidebarCollapsed ? 'md:w-16' : 'md:w-72'}`}>
                    <div className="flex flex-col flex-grow bg-card border-r border-border/50 pt-8 overflow-y-auto backdrop-blur-xl">
                        {/* Logo + Collapse-Toggle */}
                        <div className="flex items-center justify-between px-3 mb-6">
                            <Link to={createPageUrl('Dashboard')} className={`flex items-center gap-3 group transition-all ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
                                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                                    style={{ background: 'linear-gradient(135deg, var(--brand-from), var(--brand-via))', boxShadow: '0 4px 20px color-mix(in srgb, var(--brand-from) 30%, transparent)' }}>
                                    {currentUser && company?.logo_url
                                        ? <img src={company.logo_url} alt="Logo" className="w-8 h-8 object-contain rounded" />
                                        : <span className="font-bold text-lg" style={{ color: 'var(--brand-fg)' }}>{company?.company_name?.[0] || 'B'}</span>
                                    }
                                </div>
                                {!sidebarCollapsed && <span className="text-lg font-bold text-foreground tracking-tight">BarManager</span>}
                            </Link>
                            {!sidebarCollapsed && (
                                <button onClick={toggleSidebar} title="Sidebar einklappen"
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                                    <PanelLeftClose className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        {sidebarCollapsed && (
                            <div className="flex justify-center mb-4">
                                <button onClick={toggleSidebar} title="Sidebar ausklappen"
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                                    <PanelLeftOpen className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Search Bar */}
                        <div className={`px-4 mb-6 ${sidebarCollapsed ? 'hidden' : ''}`}>
                            <button
                                onClick={() => setSearchOpen(true)}
                                className="w-full flex items-center gap-3 px-4 py-2 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all border border-border/50"
                            >
                                <Search className="w-4 h-4" />
                                <span className="text-sm flex-1 text-left">Suche...</span>
                                <kbd className="px-2 py-1 text-xs bg-background border border-border/50 rounded">⌘K</kbd>
                            </button>
                        </div>

                        {/* Navigation Sections */}
                        <nav className="flex-1 px-4 space-y-6 overflow-y-auto">
                            {mainNavigation.map((section) => {
                                const visibleItems = section.pages.filter(item => permissions[item.permission]);
                                if (visibleItems.length === 0) return null;

                                return (
                                    <div key={section.id}>
                                        {!sidebarCollapsed && visibleItems.length > 1 && (
                                            <h3 className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                                                {section.name}
                                            </h3>
                                        )}
                                        <div className="space-y-1">
                                            {visibleItems.map((item) => {
                                                const isActive = isPageActive(item.page);
                                                return (
                                                    <Link
                                                        key={item.name}
                                                        to={createPageUrl(item.page)}
                                                        title={sidebarCollapsed ? item.name : undefined}
                                                        className={cn(
                                                            "flex items-center gap-3 rounded-xl text-sm font-medium transition-all",
                                                            sidebarCollapsed ? "justify-center px-2 py-3" : "px-4 py-3",
                                                            isActive 
                                                                ? "shadow-lg" 
                                                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                                        )}
                                                        style={isActive ? {
                                                            background: 'linear-gradient(to right, var(--brand-from), var(--brand-via))',
                                                            color: 'var(--brand-fg)'
                                                        } : {}}
                                                    >
                                                        <item.icon className="w-5 h-5 shrink-0" />
                                                        {!sidebarCollapsed && item.name}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {/* Weitere Seiten nur im Mehr-Drawer — nicht in der Sidebar */}
                        </nav>

                        {/* Footer */}
                        <div className={`border-t border-border/50 space-y-3 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
                            {currentUser && (
                                <div className={`flex ${sidebarCollapsed ? "justify-center" : "justify-center"}`}>
                                    <NotificationBell userEmail={currentUser.email} userRole={currentUser.role} employeeId={permissions.employeeId} />
                                </div>
                            )}
                            {!sidebarCollapsed && (
                                <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 backdrop-blur">
                                    <p className="text-sm font-bold text-amber-500">Bar Management</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {permissions.employeeRole || 'Alles im Griff'}
                                    </p>
                                </div>
                            )}
                            <button
                                onClick={async () => { await oneSignalLogout(); base44.auth.logout(); }}
                                title="Abmelden"
                                className={`w-full flex items-center justify-center gap-2 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all text-sm font-medium border border-border/50 ${sidebarCollapsed ? 'px-2 py-3' : 'px-4 py-3'}`}
                            >
                                <LogOut className="w-4 h-4" />
                                {!sidebarCollapsed && 'Abmelden'}
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Mobile Bottom Navigation — Stack-aware + Optimistic */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 border-t border-border/50 pb-safe shadow-2xl backdrop-blur-xl">
                    <div className="flex items-stretch justify-around px-1 pt-1.5 pb-1">
                        {currentNavItems.map(item => {
                            if (!permissions[item.permission]) return null;
                            const active = isTabActive(item.page);
                            return (
                                <button
                                    key={item.page}
                                    onClick={() => {
                                        haptics.selection();
                                        setOptimisticTab(item.page);
                                        navigateToTab(item.page);
                                    }}
                                    aria-label={item.name}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'relative flex flex-col items-center justify-center gap-1 py-1.5 flex-1 rounded-xl transition-all duration-150 min-h-[52px] min-w-0 active:scale-95',
                                        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {/* Active indicator pill */}
                                    {active && (
                                        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-primary" />
                                    )}
                                    <div className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150">
                                        <item.icon className={cn(
                                            'transition-all duration-150',
                                            active ? 'w-[22px] h-[22px]' : 'w-5 h-5'
                                        )} />
                                        {/* Badge: ShiftSwap */}
                                        {item.page === 'ShiftSwaps' && swapInboxCount > 0 && (
                                            <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-destructive rounded-full text-[9px] text-destructive-foreground flex items-center justify-center font-bold leading-none px-1">
                                                {swapInboxCount > 9 ? '9+' : swapInboxCount}
                                            </span>
                                        )}
                                    </div>
                                    <span className={cn(
                                        'text-[10px] leading-none tracking-tight truncate max-w-full px-1 transition-all duration-150',
                                        active ? 'font-semibold' : 'font-medium'
                                    )}>
                                        {item.name}
                                    </span>
                                </button>
                            );
                        })}

                        {/* Mehr-Button */}
                        <button
                            onClick={() => { haptics.selection(); setSettingsOpen(true); }}
                            aria-label="Mehr"
                            className={cn(
                                'relative flex flex-col items-center justify-center gap-1 py-1.5 flex-1 rounded-xl transition-all duration-150 min-h-[52px] min-w-0 active:scale-95',
                                settingsOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl">
                                <Settings className="w-5 h-5" />
                                {unreadNotifCount > 0 && (
                                    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-destructive rounded-full text-[9px] text-destructive-foreground flex items-center justify-center font-bold leading-none px-1">
                                        {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] leading-none tracking-tight font-medium">Mehr</span>
                        </button>
                    </div>
                </nav>

                {/* Mehr-Drawer — alle Bereiche geordnet */}
                <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <DrawerContent className="bg-card border-border max-h-[85vh]">
                        <DrawerHeader className="border-b border-border pb-3">
                            <div className="flex items-center justify-between">
                                <DrawerTitle className="text-foreground text-base">Alle Bereiche</DrawerTitle>
                                {pinnedPages && pinnedPages.length > 0 && (
                                    <button
                                        onClick={() => {
                                            setPinnedPages(null);
                                            try { localStorage.removeItem(PINNED_KEY); } catch {}
                                        }}
                                        className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-destructive/10"
                                    >
                                        <PinOff className="w-3 h-3" />
                                        Pins zurücksetzen
                                    </button>
                                )}
                            </div>
                            {pinnedPages && pinnedPages.length > 0 ? (
                                <p className="text-[11px] text-primary mt-1 flex items-center gap-1">
                                    <Pin className="w-3 h-3" />
                                    {pinnedPages.length}/{MAX_PINS} Tabs angepinnt — Tippe <Pin className="w-3 h-3 inline" /> zum An-/Abheften
                                </p>
                            ) : (
                                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                                    <Pin className="w-3 h-3" />
                                    Tippe <Pin className="w-3 h-3 inline" /> neben einer Seite um sie in der Nav anzuheften
                                </p>
                            )}
                        </DrawerHeader>
                        <div className="overflow-y-auto">
                            {/* Drawer-Kacheln: pro Bereich die passenden Unterseiten */}
                            {drawerSections.map((section) => {
                                const visibleItems = section.pages.filter(item => permissions[item.permission]);
                                if (visibleItems.length === 0) return null;
                                return (
                                    <div key={section.id} className="px-4 pt-4">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">{section.name}</p>
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            {visibleItems.map((item) => {
                                                const pinned = isPinned(item.page);
                                                const active = isPageActive(item.page);
                                                return (
                                                    <div key={item.page} className="relative">
                                                        <Link
                                                            to={createPageUrl(item.page)}
                                                            onClick={() => { haptics.selection(); setSettingsOpen(false); }}
                                                            className={cn(
                                                                'flex flex-col items-center gap-1.5 p-3 pt-4 rounded-xl active:scale-95 transition-all text-center w-full',
                                                                pinned
                                                                    ? 'bg-primary/10 border border-primary/30'
                                                                    : active
                                                                        ? 'bg-amber-500/20 border border-amber-500/40'
                                                                        : 'bg-secondary/40 hover:bg-secondary'
                                                            )}
                                                        >
                                                            <item.icon className={cn('w-5 h-5', pinned ? 'text-primary' : active ? 'text-amber-400' : 'text-foreground')} />
                                                            <span className={cn('text-[10px] font-medium leading-tight', pinned ? 'text-primary font-semibold' : active ? 'text-amber-400 font-bold' : 'text-foreground')}>{item.name}</span>
                                                        </Link>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); haptics.selection(); togglePin(item.page); }}
                                                            title={pinned ? 'Aus Nav entfernen' : canPin ? 'In Nav anheften' : 'Nav voll (max. 4)'}
                                                            className={cn(
                                                                'absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all shadow-sm border',
                                                                pinned
                                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                                    : canPin
                                                                        ? 'bg-card text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/50'
                                                                        : 'bg-card text-muted-foreground/30 border-border/30 cursor-not-allowed'
                                                            )}
                                                        >
                                                            <Pin className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Abmelden */}
                            <div className="px-4 pt-3 pb-6 mt-2 border-t border-border">
                                <button
                                    onClick={async () => { haptics.light(); await oneSignalLogout(); base44.auth.logout(); setSettingsOpen(false); }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary/50 text-muted-foreground text-sm font-medium border border-border/50"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Abmelden
                                </button>
                            </div>
                        </div>
                    </DrawerContent>
                </Drawer>

                {/* Push-Benachrichtigungen Einmal-Prompt */}
                <PushPermissionPrompt employeeId={permissions.employeeId} isAuthenticated={!!currentUser} />

                {/* KI-Assistent (nur Manager) */}
                

                {/* Desktop Schnellzugriff-Leiste */}
                <DesktopQuickBar />

                {/* Main Content */}
                <main className={`transition-all duration-300 ${sidebarCollapsed ? 'md:pl-16' : 'md:pl-72'} pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12`}>
                    <PullToRefresh onRefresh={handleRefresh}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentPageName}
                                initial={{ opacity: 0, y: isRootPage ? 8 : 12, x: isRootPage ? 0 : 16 }}
                                animate={{ opacity: 1, y: 0, x: 0 }}
                                exit={{ opacity: 0, y: isRootPage ? -4 : 0, x: isRootPage ? 0 : -16 }}
                                transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                                className="pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0"
                            >
                                {children}
                            </motion.div>
                        </AnimatePresence>
                    </PullToRefresh>
                </main>
            </div>
        </ErrorBoundary>
    );
}