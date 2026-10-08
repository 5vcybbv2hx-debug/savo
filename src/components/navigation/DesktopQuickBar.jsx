import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getTopPages } from '@/hooks/usePageTracking';
import { additionalPages } from './navigationConfig';
import { usePermissions } from '@/components/auth/usePermissions';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { BarChart3 } from 'lucide-react';
import ClockChip from '@/components/navigation/ClockChip';

// Nur Unterseiten — Hub-Einträge sind über die Sidebar direkt erreichbar
const ALL_NAV_PAGES = additionalPages;

export default function DesktopQuickBar() {
    const [quickPages, setQuickPages] = useState([]);
    const [sidebarWidth, setSidebarWidth] = useState('4rem'); // collapsed default
    const permissions = usePermissions();
    const location = useLocation();

    // Sidebar-Breite aus localStorage lesen (sync mit Layout.jsx)
    useEffect(() => {
        const collapsed = localStorage.getItem('sidebar_collapsed');
        setSidebarWidth(collapsed === 'false' ? '18rem' : '4rem');

        // Storage-Event lauschen falls Sidebar getoggelt wird
        const handler = () => {
            const c = localStorage.getItem('sidebar_collapsed');
            setSidebarWidth(c === 'false' ? '18rem' : '4rem');
        };
        window.addEventListener('storage', handler);
        // Auch custom event für same-tab toggle
        window.addEventListener('sidebar-toggle', handler);
        return () => {
            window.removeEventListener('storage', handler);
            window.removeEventListener('sidebar-toggle', handler);
        };
    }, []);

    useEffect(() => {
        base44.auth.me().then(user => {
            if (!user?.email) return;
            const allowed = ALL_NAV_PAGES
                .filter(p => permissions[p.permission])
                .map(p => p.page);
            const top = getTopPages(user.email, 6, allowed);
            if (top.length >= 3) {
                setQuickPages(
                    top.map(t => ALL_NAV_PAGES.find(p => p.page === t.page)).filter(Boolean)
                );
            }
        }).catch(() => {});
    }, [location.pathname]);

    // Tagesabschluss-Status für Manager (canViewAnalytics)
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: todayRevenue = [] } = useQuery({
        queryKey: ['daily-revenue-today', today],
        queryFn: () => base44.entities.DailyRevenue.filter({ date: today }),
        staleTime: 60000,
        enabled: permissions.canViewAnalytics,
    });
    const dailyClosingDone = todayRevenue.length > 0;

    if (quickPages.length < 3) return null;

    return (
        <div
            className="hidden md:flex fixed bottom-0 right-0 z-40 items-center justify-center gap-1 px-6 py-2 bg-card/90 border-t border-border/50 backdrop-blur-xl transition-all duration-300"
            style={{ left: sidebarWidth }}
        >
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest mr-3 shrink-0">Schnellzugriff</span>
            <ClockChip />
            {permissions.canViewAnalytics && (
                <Link
                    to={createPageUrl('DailyAnalysis')}
                    title={dailyClosingDone ? 'Tagesabschluss erledigt' : 'Tagesabschluss — noch offen'}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all relative',
                        dailyClosingDone
                            ? 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                            : 'text-amber-400 hover:bg-amber-500/10'
                    )}
                >
                    <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                    {!dailyClosingDone && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse-dot" />
                    )}
                </Link>
            )}
            {quickPages.map(item => {
                const isActive = location.pathname === `/${item.page}` || location.pathname === '/';
                return (
                    <Link
                        key={item.page}
                        to={createPageUrl(item.page)}
                        className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                            isActive
                                ? 'text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                        )}
                        style={isActive ? {
                            background: 'linear-gradient(to right, var(--brand-from), var(--brand-via))',
                            color: 'var(--brand-fg)'
                        } : {}}
                    >
                        <item.icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.name}</span>
                    </Link>
                );
            })}
        </div>
    );
}