/**
 * Buchhaltung Dashboard — fokussiert & schlank
 *
 * Zeigt nur was wirklich wichtig ist:
 *  1. Rohgewinn des Monats (Einnahmen − Ausgaben)
 *  2. Was noch zu tun ist (Alerts)
 *  3. Schnellzugriff auf die 4 Kernbereiche
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    BookOpen, Receipt, TrendingDown, Download,
    RefreshCw, AlertTriangle, CheckCircle2, ChevronRight,
    Euro, ArrowDownUp, Wallet
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isAfter, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const fmt = n => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Hauptseite ────────────────────────────────────────────────────────────────
export default function AccountingDashboard() {
    const permissions = usePermissions();
    const navigate    = useNavigate();
    const now         = new Date();
    const monthStart  = startOfMonth(now);
    const monthEnd    = endOfMonth(now);
    const monthLabel  = format(now, 'MMMM yyyy', { locale: de });
    const thisMonthKey = format(now, 'yyyy-MM');

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: cashbookEntries = [] } = useQuery({
        queryKey: ['cashbook-entries'],
        queryFn: async () => {
            const from = format(subMonths(now, 1), 'yyyy-MM-dd');
            const all = await base44.entities.CashbookEntry.list('-date', 500);
            return all.filter(e => e.date >= from);
        },
        staleTime: STALE.MEDIUM,
    });

    const { data: receipts = [] } = useQuery({
        queryKey: ['accounting-receipts'],
        queryFn: async () => {
            const from = format(subMonths(now, 1), 'yyyy-MM-dd');
            const all = await base44.entities.AccountingReceipt.list('-receipt_date', 300);
            return all.filter(e => (e.receipt_date || '') >= from);
        },
        staleTime: STALE.MEDIUM,
    });

    const { data: creditorInvoices = [] } = useQuery({
        queryKey: ['creditor-invoices'],
        queryFn: async () => {
            const from = format(subMonths(now, 3), 'yyyy-MM-dd');
            const all = await base44.entities.CreditorInvoice.list('-invoice_date', 300);
            return all.filter(e => (e.invoice_date || '') >= from);
        },
        staleTime: STALE.MEDIUM,
    });

    const { data: dailyRevenues = [] } = useQuery({
        queryKey: ['daily-revenues'],
        queryFn: async () => {
            const from = format(subMonths(now, 1), 'yyyy-MM-dd');
            const all = await base44.entities.DailyRevenue.list('-date', 200);
            return all.filter(e => e.date >= from);
        },
        staleTime: STALE.MEDIUM,
    });

    const { data: liabilities = [] } = useQuery({
        queryKey: ['liabilities'],
        queryFn: () => base44.entities.Liability.list('-due_date'),
        staleTime: STALE.MEDIUM,
    });

    // ── Berechnungen ──────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        // Einnahmen aus Tagesabschlüssen diesen Monat
        const thisMonthRevenues = dailyRevenues.filter(r => r.date?.startsWith(thisMonthKey));
        const totalRevenue = thisMonthRevenues.reduce((s, r) => s + (r.revenue || 0), 0);

        // Ausgaben aus Kassenbuch diesen Monat
        const thisMonthCashbook = cashbookEntries.filter(e => e.date?.startsWith(thisMonthKey));
        const totalExpenses = thisMonthCashbook
            .filter(e => e.entry_type === 'Ausgabe')
            .reduce((s, e) => s + (e.amount || 0), 0);

        const rohgewinn = totalRevenue - totalExpenses;

        // Belege ohne Bild oder ohne Betrag
        const openReceipts = receipts.filter(r =>
            r.receipt_date?.startsWith(thisMonthKey) && (!r.amount_gross || r.amount_gross === 0)
        ).length;

        // Überfällige Kreditoren
        const overdueCreditors = creditorInvoices.filter(i =>
            i.payment_status === 'überfällig' ||
            (i.payment_status === 'offen' && i.due_date && isAfter(now, new Date(i.due_date)))
        );

        // Offene Verbindlichkeiten
        const overdueLiabilities = liabilities.filter(l =>
            l.status !== 'bezahlt' && l.due_date && isAfter(now, new Date(l.due_date))
        );

        // Z-Abschlüsse noch nicht ins Kassenbuch übertragen
        const transferredDates = new Set(
            thisMonthCashbook.filter(e => e.source === 'z_abschlag').map(e => e.date)
        );
        const missingTransfers = thisMonthRevenues.filter(r => !transferredDates.has(r.date)).length;

        return {
            totalRevenue, totalExpenses, rohgewinn,
            openReceipts,
            overdueCreditors: overdueCreditors.length,
            overdueCreditorAmount: overdueCreditors.reduce((s, i) => s + ((i.amount_gross || 0) - (i.paid_amount || 0)), 0),
            overdueLiabilities: overdueLiabilities.length,
            missingTransfers,
            tagesabschluesse: thisMonthRevenues.length,
        };
    }, [cashbookEntries, receipts, creditorInvoices, dailyRevenues, liabilities, thisMonthKey]);

    // ── Alerts zusammenbauen ──────────────────────────────────────────────────
    const alerts = useMemo(() => {
        const list = [];
        if (stats.missingTransfers > 0)
            list.push({
                type: 'warn',
                label: `${stats.missingTransfers} Tagesabschluss${stats.missingTransfers > 1 ? 'läge' : ''} noch nicht ins Kassenbuch übertragen`,
                href: '/DailyAnalysis',
            });
        if (stats.openReceipts > 0)
            list.push({
                type: 'warn',
                label: `${stats.openReceipts} Beleg${stats.openReceipts > 1 ? 'e' : ''} ohne Betrag`,
                href: '/AccountingReceipts',
            });
        if (stats.overdueCreditors > 0)
            list.push({
                type: 'error',
                label: `${stats.overdueCreditors} überfällige Kreditorenrechnung${stats.overdueCreditors > 1 ? 'en' : ''} · ${fmt(stats.overdueCreditorAmount)} €`,
                href: '/AccountingCreditors',
            });
        if (stats.overdueLiabilities > 0)
            list.push({
                type: 'error',
                label: `${stats.overdueLiabilities} überfällige Verbindlichkeit${stats.overdueLiabilities > 1 ? 'en' : ''}`,
                href: '/AccountingLiabilities',
            });
        return list;
    }, [stats]);

    if (!permissions.canViewAccounting) {
        return <PermissionDenied message="Kein Zugriff auf das Buchhaltungsmodul." />;
    }

    // ── Schnellzugriff ────────────────────────────────────────────────────────
    const QUICK_LINKS = [
        { label: 'Belege',          icon: Receipt,      href: '/AccountingReceipts',   color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
        { label: 'Kassenbuch',      icon: BookOpen,     href: '/AccountingCashbook',   color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
        { label: 'Kreditoren',      icon: TrendingDown, href: '/AccountingCreditors',  color: 'text-red-400',    bg: 'bg-red-500/10'    },
        { label: 'Export',          icon: Download,     href: '/AccountingExport',     color: 'text-purple-400', bg: 'bg-purple-500/10' },
    ];

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Buchhaltung</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">{monthLabel}</p>
                    </div>
                    <Link to="/AccountingExport">
                        <Button size="sm" className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                            <Download className="w-4 h-4" />
                            DATEV Export
                        </Button>
                    </Link>
                </div>

                {/* ── Rohgewinn — die wichtigste Zahl ─────────────────────── */}
                <Card className={cn(
                    'p-5 border-2 transition-all',
                    stats.rohgewinn >= 0
                        ? 'bg-green-500/5 border-green-500/30'
                        : 'bg-red-500/5 border-red-500/30'
                )}>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                        Rohgewinn {monthLabel}
                    </p>
                    <p className={cn(
                        'text-4xl font-bold tabular-nums tracking-tight',
                        stats.rohgewinn >= 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                        {stats.rohgewinn >= 0 ? '+' : ''}{fmt(stats.rohgewinn)} €
                    </p>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                            <span className="text-xs text-muted-foreground">
                                Einnahmen <span className="font-semibold text-foreground">{fmt(stats.totalRevenue)} €</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-400" />
                            <span className="text-xs text-muted-foreground">
                                Ausgaben <span className="font-semibold text-foreground">{fmt(stats.totalExpenses)} €</span>
                            </span>
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                        Basiert auf {stats.tagesabschluesse} Tagesabschlüssen + Kassenbuch-Ausgaben
                    </p>
                </Card>

                {/* ── Alerts — nur wenn nötig ──────────────────────────────── */}
                {alerts.length > 0 ? (
                    <div className="space-y-2">
                        {alerts.map((a, i) => (
                            <Link key={i} to={a.href}>
                                <div className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all hover:opacity-80',
                                    a.type === 'error'
                                        ? 'bg-red-500/8 border-red-500/25 text-red-400'
                                        : 'bg-amber-500/8 border-amber-500/25 text-amber-400'
                                )}>
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <p className="text-xs font-semibold flex-1">{a.label}</p>
                                    <ChevronRight className="w-4 h-4 shrink-0 opacity-60" />
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-green-500/8 border border-green-500/20 text-green-400">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <p className="text-xs font-semibold">Alles erledigt — keine offenen Punkte</p>
                    </div>
                )}

                {/* ── Schnellzugriff ───────────────────────────────────────── */}
                <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5 px-0.5">
                        Schnellzugriff
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                        {QUICK_LINKS.map(item => (
                            <Link key={item.href} to={item.href}>
                                <Card className="flex items-center gap-3 p-4 bg-card border-border hover:border-border/80 hover:bg-accent/20 active:scale-[0.98] transition-all cursor-pointer group">
                                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', item.bg)}>
                                        <item.icon className={cn('w-4.5 h-4.5', item.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors shrink-0" />
                                </Card>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* ── Weitere Bereiche — kompakt ───────────────────────────── */}
                <div className="space-y-1">
                    {[
                        { label: 'Fixkosten',         icon: RefreshCw,   href: '/AccountingFixedCosts',    color: 'text-orange-400' },
                        { label: 'Verbindlichkeiten', icon: Wallet,      href: '/AccountingLiabilities',   color: 'text-rose-400'   },
                        { label: 'Tagesabschluss',    icon: ArrowDownUp, href: '/DailyAnalysis',           color: 'text-cyan-400'   },
                    ].map(item => (
                        <Link key={item.href} to={item.href}>
                            <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border/40 bg-card hover:border-border hover:bg-accent/10 transition-all cursor-pointer group">
                                <item.icon className={cn('w-4 h-4 shrink-0', item.color)} />
                                <span className="text-sm text-foreground flex-1">{item.label}</span>
                                <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                            </div>
                        </Link>
                    ))}
                </div>

            </div>
        </div>
    );
}
