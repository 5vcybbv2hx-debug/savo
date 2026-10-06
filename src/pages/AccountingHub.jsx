import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { usePermissions } from '@/components/auth/usePermissions';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { cn } from '@/lib/utils';
import {
    Euro, BookOpen, Receipt, TrendingDown, Download,
    RefreshCw, BarChart2, AlertTriangle, Database, Banknote, Scale
} from 'lucide-react';
import { format, startOfMonth } from 'date-fns';

function StatBadge({ count, variant = 'default' }) {
    if (!count) return null;
    return (
        <span className={cn(
            'ml-auto text-xs font-bold px-2 py-0.5 rounded-full',
            variant === 'warning' ? 'bg-orange-500/20 text-orange-400' :
            variant === 'danger'  ? 'bg-destructive/20 text-destructive' :
                                    'bg-primary/20 text-primary'
        )}>
            {count}
        </span>
    );
}

function NavCard({ icon: Icon, label, description, page, badge, badgeVariant, permission }) {
    const navigate = useNavigate();
    const permissions = usePermissions();
    if (permission && !permissions[permission]) return null;
    return (
        <button
            onClick={() => navigate(createPageUrl(page))}
            className="flex items-center gap-4 w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98] bg-card border-border/50 hover:border-border hover:bg-accent/20 cursor-pointer"
        >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            {badge !== undefined && <StatBadge count={badge} variant={badgeVariant} />}
        </button>
    );
}

export default function AccountingHub() {
    // Offene Ausgangsrechnungen (Außenaufträge) für Badge
    const { data: openOutInvoices = [] } = useQuery({
        queryKey: ['external-invoices'],
        queryFn: async () => {
            const all = await base44.entities.DebitorInvoice.list('-invoice_date', 200);
            return all.filter(i => i.doc_status !== 'Storniert' && i.payment_status !== 'bezahlt');
        },
        staleTime: 5 * 60 * 1000,
    });
    const permissions = usePermissions();
    const thisMonth = format(startOfMonth(new Date()), 'yyyy-MM');

    // Offene Belege (ohne Kategorie)
    const { data: receipts = [] } = useQuery({
        queryKey: ['receipts-uncategorized'],
        queryFn: async () => {
            const all = await base44.entities.AccountingReceipt.list('-date', 300);
            return all.filter(r => !r.category || r.category.trim() === '');
        },
        staleTime: STALE.MEDIUM,
        enabled: permissions.canViewAccountingReceipts,
    });

    // Offene Verbindlichkeiten
    const { data: liabilities = [] } = useQuery({
        queryKey: ['liabilities-open'],
        queryFn: () => base44.entities.Liability.filter({ status: 'offen' }, '-due_date', 50),
        staleTime: STALE.MEDIUM,
        enabled: permissions.canViewLiabilities,
    });

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 md:pb-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Buchhaltung</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Finanzen, Belege & DATEV-Export
                </p>
            </div>

            {/* Tagesgeschäft */}
            <div className="mb-6">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Tagesgeschäft</p>
                <div className="space-y-2">
                    <NavCard icon={Euro}        label="Übersicht"      description="Dashboard & Kennzahlen"            page="AccountingDashboard"  permission="canViewAccounting" />
                    <NavCard icon={BarChart2}   label="Tagesabschluss" description="Umsatz erfassen & abschließen"     page="DailyAnalysis"        permission="canViewAnalytics" />
                    <NavCard icon={BookOpen}    label="Kassenbuch"     description="Einnahmen & Ausgaben"              page="AccountingCashbook"   permission="canViewAccountingCashbook" />
                    <NavCard icon={Banknote}   label="Bankkonten"    description="Konten & Umsätze verwalten"        page="AccountingBank"       permission="canViewAccounting" />
                </div>
            </div>

            {/* Belege & Kosten */}
            <div className="mb-6">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Belege & Kosten</p>
                <div className="space-y-2">
                    <NavCard icon={Receipt}     label="Belege"             description="Rechnungen & Quittungen"       page="AccountingReceipts"    badge={receipts.length || undefined} badgeVariant="warning" permission="canViewAccountingReceipts" />
                    <NavCard icon={Scale}       label="Offene Posten"       description="Kreditoren & Verbindlichkeiten" page="AccountingPayables"    badge={(liabilities.length + (permissions.canViewAccountingCreditors ? openOutInvoices.length : 0)) || undefined} badgeVariant="danger" permission="canViewAccountingCreditors" />
                    <NavCard icon={Receipt}  label="Außenaufträge"  description="Angebote & Rechnungen — Events, WKZ" page="ExternalBusiness" badge={openOutInvoices.length || undefined} badgeVariant="warning" permission="canViewAccounting" />
                    <NavCard icon={RefreshCw}   label="Fixkosten"          description="Monatliche Fixkosten verwalten" page="AccountingFixedCosts"  permission="canViewAccounting" />
                </div>
            </div>

            {/* Export */}
            {(permissions.canExportAccounting || permissions.canViewAnalytics) && (
                <div className="mb-6">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Export</p>
                    <div className="space-y-2">
                        {permissions.canExportAccounting && (
                            <NavCard icon={Download} label="DATEV Export" description="CSV & Exportdaten für den Steuerberater" page="AccountingExport" permission="canExportAccounting" />
                        )}
                        <NavCard icon={Database} label="Atlas Export" description="Betriebsdaten für Atlas exportieren" page="AtlasExport" permission="canViewAnalytics" />
                    </div>
                </div>
            )}
        </div>
    );
}