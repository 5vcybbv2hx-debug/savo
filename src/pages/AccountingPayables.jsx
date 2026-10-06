/**
 * AccountingPayables — Offene Posten
 *
 * Vereint die ehemaligen Seiten AccountingCreditors (Lieferantenrechnungen)
 * und AccountingLiabilities (Sonstige Verbindlichkeiten) in einer Seite
 * mit vertikalen Abschnitten — nach dem Events-Muster (keine Tabs).
 *
 * Oben: kombinierte Summary-Kachel (Summe offener Beträge beider Bereiche
 *       + Anzahl überfälliger Posten gesamt).
 * Abschnitt 1: Lieferantenrechnungen (CreditorsSection)
 * Abschnitt 2: Sonstige Verbindlichkeiten (LiabilitiesSection)
 */
import React, { useState, useCallback } from 'react';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Scale, AlertTriangle, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import CreditorsSection from '@/components/accounting/CreditorsSection';
import LiabilitiesSection from '@/components/accounting/LiabilitiesSection';

const fmt = n => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AccountingPayables() {
    const permissions = usePermissions();
    const [creditorTotals, setCreditorTotals] = useState({ open: 0, overdue: 0, overdueCount: 0, counts: {} });
    const [liabilityTotals, setLiabilityTotals] = useState({ total: 0, overdue: 0, overdueCount: 0, counts: {} });

    // Stabile Callbacks — verhindern Endlos-Loops im useEffect der Sections
    const onCreditorTotals = useCallback(setCreditorTotals, []);
    const onLiabilityTotals = useCallback(setLiabilityTotals, []);

    if (!permissions.canViewAccountingCreditors) {
        return <PermissionDenied message="Kein Zugriff auf offene Posten." />;
    }

    const combinedOpen    = (creditorTotals.open || 0) + (liabilityTotals.total || 0);
    const combinedOverdue = (creditorTotals.overdue || 0) + (liabilityTotals.overdue || 0);
    const combinedOverdueCount = (creditorTotals.overdueCount || 0) + (liabilityTotals.overdueCount || 0);

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div>
                    <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Scale className="w-5 h-5 text-primary" />
                        Offene Posten
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Lieferantenrechnungen & Verbindlichkeiten an einem Ort
                    </p>
                </div>

                {/* ── Kombinierte Summary-Kachel ──────────────────────────── */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-3.5">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide flex items-center gap-1">
                            <Wallet className="w-3 h-3" /> Offene Posten gesamt
                        </p>
                        <p className="text-lg font-bold text-blue-400 tabular-nums mt-0.5">{fmt(combinedOpen)} €</p>
                        <p className="text-[10px] text-muted-foreground">
                            {(creditorTotals.counts?.offen || 0) + (creditorTotals.counts?.teilbezahlt || 0) + (creditorTotals.counts?.überfällig || 0) + (liabilityTotals.counts?.aktiv || 0)} Positionen
                        </p>
                    </div>
                    <div className={cn('border rounded-xl p-3.5', combinedOverdue > 0
                        ? 'bg-red-500/8 border-red-500/20'
                        : 'bg-secondary/30 border-border/40'
                    )}>
                        <p className={cn('text-[10px] font-bold uppercase tracking-wide flex items-center gap-1', combinedOverdue > 0 ? 'text-red-400' : 'text-muted-foreground')}>
                            <AlertTriangle className="w-3 h-3" /> Überfällig
                        </p>
                        <p className={cn('text-lg font-bold tabular-nums mt-0.5', combinedOverdue > 0 ? 'text-red-400' : 'text-muted-foreground')}>
                            {fmt(combinedOverdue)} €
                        </p>
                        <p className="text-[10px] text-muted-foreground">{combinedOverdueCount} Posten</p>
                    </div>
                </div>

                {/* ── Abschnitt 1: Lieferantenrechnungen ──────────────────── */}
                <div className="border-t border-border/50 pt-4">
                    <CreditorsSection onTotalsChange={onCreditorTotals} />
                </div>

                {/* ── Abschnitt 2: Sonstige Verbindlichkeiten ─────────────── */}
                <div className="border-t border-border/50 pt-4">
                    <LiabilitiesSection onTotalsChange={onLiabilityTotals} />
                </div>
            </div>
        </div>
    );
}