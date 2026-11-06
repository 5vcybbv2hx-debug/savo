import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { calculateCompletion, getMissingFields, SECTIONS } from '@/lib/employeeCompleteness';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
    Users, Package, AlertTriangle, CheckCircle2, ChevronRight,
    TrendingDown, ImageOff, DollarSign, Hash, Tag, RefreshCw,
    Shield, Wine, Truck
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';

// ── Artikel-Checks (korrekte Feldnamen laut Schema) ──────────────────────

const ARTICLE_CHECKS = [
    {
        key: 'no_price',
        label: 'Kein Einkaufspreis',
        icon: DollarSign,
        // purchase_price ist das korrekte Feld im Article-Schema
        check: a => !a.purchase_price && a.purchase_price !== 0,
    },
    {
        key: 'no_category',
        label: 'Keine Kategorie',
        icon: Tag,
        check: a => !a.category,
    },
    {
        key: 'no_unit',
        label: 'Keine Einheit',
        icon: Hash,
        // content_unit ist das korrekte Feld, nicht 'unit'
        check: a => !a.content_unit,
    },
    {
        key: 'no_image',
        label: 'Kein Bild',
        icon: ImageOff,
        check: a => !a.image_url,
    },
    {
        key: 'no_supplier',
        label: 'Kein Lieferant',
        icon: Truck,
        // suppliers ist ein Array im Article-Schema
        check: a => !a.suppliers?.length && !a.supplier_details,
    },
    {
        key: 'no_min_stock',
        label: 'Kein Mindestbestand',
        icon: RefreshCw,
        check: a => a.min_stock === undefined || a.min_stock === null || a.min_stock === '',
    },
];

// ── MenuItem-Checks ───────────────────────────────────────────────────────

const MENU_CHECKS = [
    { key: 'no_price',    label: 'Kein Preis',      icon: DollarSign, check: m => !m.price && m.price !== 0 },
    { key: 'no_category', label: 'Keine Kategorie', icon: Tag,        check: m => !m.category },
    { key: 'no_allergens',label: 'Keine Allergene', icon: AlertTriangle, check: m => !m.allergens_list?.length && !m.allergens },
];

// ── Mitarbeiter-Check ─────────────────────────────────────────────────────

function EmployeeQualitySection({ employees }) {
    const issues = employees
        .filter(e => e.is_active !== false)
        .map(e => {
            const missing    = getMissingFields(e);
            const completion = calculateCompletion(e);
            return { ...e, missing, completion };
        })
        .filter(e => Object.keys(e.missing).length > 0)
        .sort((a, b) => a.completion - b.completion);

    const complete = employees.filter(e => e.is_active !== false).length - issues.length;

    return (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-border">
                <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                    <h2 className="text-sm font-bold text-foreground">Mitarbeiter-Personalbögen</h2>
                    <p className="text-xs text-muted-foreground">
                        {issues.length} mit fehlenden Angaben · {complete} vollständig
                    </p>
                </div>
                {issues.length === 0 && <CheckCircle2 className="w-5 h-5 text-status-ok" />}
            </div>

            {issues.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Alle Mitarbeiter vollständig ✓</div>
            ) : (
                <div className="divide-y divide-border">
                    {issues.map(emp => (
                        <div key={emp.id} className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-foreground">{emp.name}</p>
                                    <p className="text-xs text-muted-foreground">{emp.role}</p>
                                </div>
                                <Link
                                    to={`/EmployeeProfile/${emp.id}`}
                                    className="text-xs text-primary hover:underline shrink-0 mr-2 min-h-[44px] flex items-center"
                                >
                                    Öffnen →
                                </Link>
                                <span className={cn(
                                    'text-xs font-bold px-2 py-0.5 rounded-full',
                                    emp.completion >= 75 ? 'bg-status-warn/20 text-status-warn' :
                                    emp.completion >= 50 ? 'bg-status-warn/20 text-status-warn' :
                                    'bg-status-danger/20 text-status-danger'
                                )}>{emp.completion}%</span>
                            </div>
                            <Progress value={emp.completion} className="h-1.5 mb-2" />
                            <div className="flex flex-wrap gap-1.5">
                                {Object.entries(emp.missing).map(([section, fields]) => (
                                    <span key={section} className={cn(
                                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                                        section === 'lohn'
                                            ? 'bg-status-warn/20 text-status-warn'
                                            : 'bg-secondary text-muted-foreground'
                                    )}>
                                        {section === 'lohn'
                                            ? '💶 Kein Lohn hinterlegt'
                                            : `${SECTIONS[section]?.label}: ${fields.length} Feld${fields.length > 1 ? 'er' : ''}`
                                        }
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Generische Check-Sektion (für Artikel + MenuItem) ─────────────────────

function CheckSection({ title, icon: Icon, iconColor, bgColor, items, checks, linkFn, linkLabel }) {
    const [activeFilter, setActiveFilter] = useState(null);

    const stats = checks.map(c => ({
        ...c,
        count: items.filter(c.check).length,
    }));

    const filtered = activeFilter
        ? items.filter(checks.find(c => c.key === activeFilter)?.check || (() => false))
        : [];

    const totalOk = items.filter(a => !checks.some(c => c.check(a))).length;

    return (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-border">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', bgColor)}>
                    <Icon className={cn('w-5 h-5', iconColor)} />
                </div>
                <div className="flex-1">
                    <h2 className="text-sm font-bold text-foreground">{title}</h2>
                    <p className="text-xs text-muted-foreground">
                        {items.length} Einträge · {totalOk} ohne Probleme
                    </p>
                </div>
                {totalOk === items.length && items.length > 0 && (
                    <CheckCircle2 className="w-5 h-5 text-status-ok" />
                )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4">
                {stats.map(stat => (
                    <button
                        key={stat.key}
                        onClick={() => stat.count > 0 && setActiveFilter(activeFilter === stat.key ? null : stat.key)}
                        className={cn(
                            'flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all min-h-[44px]',
                            stat.count === 0
                                ? 'border-status-ok/20 bg-status-ok/5 opacity-60 cursor-default'
                                : activeFilter === stat.key
                                    ? 'border-status-warn/50 bg-status-warn/15'
                                    : 'border-border hover:border-status-warn/30 hover:bg-accent/50 cursor-pointer'
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <stat.icon className={cn('w-4 h-4', stat.count === 0 ? 'text-status-ok' : 'text-status-warn')} />
                            <span className={cn('text-lg font-bold', stat.count === 0 ? 'text-status-ok' : 'text-foreground')}>
                                {stat.count}
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">{stat.label}</p>
                    </button>
                ))}
            </div>

            {activeFilter && filtered.length > 0 && (
                <div className="border-t border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-1">
                        {stats.find(s => s.key === activeFilter)?.label} ({filtered.length})
                    </p>
                    <div className="divide-y divide-border max-h-72 overflow-y-auto">
                        {filtered.map(item => (
                            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                                {item.image_url ? (
                                    <img src={item.image_url} className="w-8 h-8 rounded-lg object-cover shrink-0" alt="" />
                                ) : (
                                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                                        <Icon className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{item.category || '–'}</p>
                                </div>
                                {linkFn && (
                                    <Link
                                        to={linkFn(item)}
                                        className="text-xs text-primary hover:underline shrink-0 min-h-[44px] flex items-center"
                                    >
                                        {linkLabel || 'Bearbeiten'}
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Summary KPI Card ──────────────────────────────────────────────────────

function SummaryCard({ label, value, icon: Icon, color }) {
    return (
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
        </div>
    );
}

// ── MAIN ──────────────────────────────────────────────────────────────────

export default function DataQuality() {
    const permissions = usePermissions();

    const { data: employees = [], isLoading: loadingEmp } = useQuery({
        queryKey: ['employees-quality'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name', 200),
        staleTime: STALE.SLOW,
    });

    const { data: articles = [], isLoading: loadingArt } = useQuery({
        queryKey: ['articles-quality'],
        queryFn: () => base44.entities.Article.filter({ is_active: true }, 'name', 500),
        staleTime: STALE.SLOW,
    });

    const { data: menuItems = [], isLoading: loadingMenu } = useQuery({
        queryKey: ['menu-items-quality'],
        queryFn: () => base44.entities.MenuItem.list('name', 500),
        staleTime: STALE.SLOW,
    });

    // Nur Manager/Admin dürfen Datenqualität sehen
    if (!permissions.isManager) {
        return <PermissionDenied message="Die Datenqualitäts-Übersicht ist nur für Manager zugänglich." />;
    }

    const empWithIssues  = employees.filter(e => Object.keys(getMissingFields(e)).length > 0).length;
    const artWithIssues  = articles.filter(a => ARTICLE_CHECKS.some(c => c.check(a))).length;
    const menuWithIssues = menuItems.filter(m => MENU_CHECKS.some(c => c.check(m))).length;

    const isLoading = loadingEmp || loadingArt || loadingMenu;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
                <div>
                    <h1 className="page-title">Datenqualität</h1>
                    <p className="text-sm text-muted-foreground">Übersicht über fehlende oder unvollständige Stammdaten</p>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-4 border-border border-t-amber-500 rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* KPIs */}
                        <div className="grid grid-cols-3 gap-3">
                            <SummaryCard
                                label="Mitarbeiter mit Lücken"
                                value={empWithIssues}
                                icon={Users}
                                color={empWithIssues === 0 ? 'bg-status-ok/20 text-status-ok' : 'bg-status-danger/20 text-status-danger'}
                            />
                            <SummaryCard
                                label="Artikel mit Problemen"
                                value={artWithIssues}
                                icon={Package}
                                color={artWithIssues === 0 ? 'bg-status-ok/20 text-status-ok' : 'bg-status-warn/20 text-status-warn'}
                            />
                            <SummaryCard
                                label="Menüpunkte unvollständig"
                                value={menuWithIssues}
                                icon={Wine}
                                color={menuWithIssues === 0 ? 'bg-status-ok/20 text-status-ok' : 'bg-status-warn/20 text-status-warn'}
                            />
                        </div>

                        {/* Sektionen */}
                        <EmployeeQualitySection employees={employees} />

                        <CheckSection
                            title="Artikel-Datenqualität"
                            icon={Package}
                            iconColor="text-status-warn"
                            bgColor="bg-status-warn/20"
                            items={articles}
                            checks={ARTICLE_CHECKS}
                            linkFn={(item) => `/Warehouse?search=${encodeURIComponent(item.name)}`}
                            linkLabel="Öffnen"
                        />

                        <CheckSection
                            title="Getränkekarte — Menüpunkte"
                            icon={Wine}
                            iconColor="text-status-danger"
                            bgColor="bg-status-danger/20"
                            items={menuItems}
                            checks={MENU_CHECKS}
                            linkFn={(item) => `/DrinkMenu?highlight=${encodeURIComponent(item.name)}`}
                            linkLabel="Öffnen"
                        />
                    </>
                )}
            </div>
        </div>
    );
}