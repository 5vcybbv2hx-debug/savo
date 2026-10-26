/**
 * Finanz-Cockpit — wichtigste Kennzahlen mit Vorjahresvergleich.
 *
 * Zeitraum: Woche (laufende KW, Mo–So) oder Monat (laufender Kalendermonat).
 * Kennzahlen: Umsatz, Personalkosten, Fixkosten, Deckungsbeitrag, Tagesumsätze.
 * Zugriff: nur Manager & Admin (Umsatzdaten sind manager-only).
 */
import { useState } from 'react';
import { AlertTriangle, Gauge, Loader2, Receipt, TrendingUp, Users, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import CockpitPeriodSwitch from '@/components/cockpit/CockpitPeriodSwitch';
import CockpitKpiCard from '@/components/cockpit/CockpitKpiCard';
import CockpitDelta from '@/components/cockpit/CockpitDelta';
import CockpitRevenueBars from '@/components/cockpit/CockpitRevenueBars';
import { useCockpitData } from '@/hooks/useCockpitData';
import { fmtEUR, fmtHours } from '@/lib/cockpitMetrics';

export default function Cockpit() {
    const [periodType, setPeriodType] = useState('month');
    const { period, kpis, isLoading, error } = useCockpitData(periodType);

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
            {/* ── Kopf ── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                        <Gauge className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                        Finanz-Cockpit
                    </h1>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                        {period.label} · Vorjahresvergleich
                        {period.isRunning && ' (laufende Periode)'}
                    </p>
                </div>
                <CockpitPeriodSwitch value={periodType} onChange={setPeriodType} />
            </div>

            {error && (
                <Card className="p-5 border-destructive/40">
                    <div className="flex items-center gap-2 text-destructive mb-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <p className="text-sm font-semibold">Kennzahlen konnten nicht geladen werden</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{String(error.message || error)}</p>
                </Card>
            )}

            {isLoading && !error && (
                <div className="flex items-center justify-center py-24 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Kennzahlen werden geladen …
                </div>
            )}

            {!isLoading && !error && (
                <>
                    {/* ── Deckungsbeitrag — prominenteste Kachel ── */}
                    <CockpitKpiCard
                        prominent
                        label="Deckungsbeitrag"
                        value={fmtEUR(kpis.contribution)}
                        icon={Wallet}
                        sub={
                            <>
                                <p>
                                    {kpis.prevContribution != null ? (
                                        <span className="inline-flex flex-wrap items-center gap-1.5">
                                            <span>Vorjahr: {fmtEUR(kpis.prevContribution)}</span>
                                            <CockpitDelta pct={kpis.contributionDelta} />
                                        </span>
                                    ) : (
                                        'Vorjahr: keine vollständige Datenbasis'
                                    )}
                                </p>
                                <p className="text-[11px]">
                                    Umsatz {fmtEUR(kpis.revenue)} · Personal {fmtEUR(kpis.labor.cost)} · Fixkosten {fmtEUR(kpis.fixed)}
                                </p>
                            </>
                        }
                    />

                    {/* ── Umsatz · Personalkosten · Fixkosten ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <CockpitKpiCard
                            label="Umsatz"
                            value={fmtEUR(kpis.revenue)}
                            icon={TrendingUp}
                            sub={
                                <p>
                                    {kpis.hasRevenueData ? (
                                        <span className="inline-flex flex-wrap items-center gap-1.5">
                                            <span>Vorjahr: {fmtEUR(kpis.prevRevenue)}</span>
                                            <CockpitDelta pct={kpis.revenueDelta} />
                                        </span>
                                    ) : (
                                        'Keine Umsatzdaten im Zeitraum'
                                    )}
                                </p>
                            }
                        />

                        <CockpitKpiCard
                            label="Personalkosten"
                            value={fmtEUR(kpis.labor.cost)}
                            icon={Users}
                            sub={<p>{fmtHours(kpis.labor.hours)} erfasste Stunden</p>}
                        />

                        <CockpitKpiCard
                            label="Fixkosten"
                            value={fmtEUR(kpis.fixed)}
                            icon={Receipt}
                            sub={
                                <p>
                                    {periodType === 'week'
                                        ? `Monatsbasis ${fmtEUR(kpis.fixedMonthly)} × 12/52`
                                        : `aktive monatliche Posten (${fmtEUR(kpis.fixedMonthly)})`}
                                </p>
                            }
                        />
                    </div>

                    {/* ── Umsatz pro Tag ── */}
                    <CockpitRevenueBars series={kpis.series} periodLabel={period.label} />

                    <p className="text-[11px] text-muted-foreground px-1">
                        Deckungsbeitrag = Umsatz − Personalkosten − Fixkosten. Personalkosten rechnen mit dem
                        Stundensatz je Mitarbeiter (16 €, falls kein Satz hinterlegt ist). Fixkosten sind nicht
                        historisiert — im Vorjahr gilt daher derselbe Stand wie heute.
                    </p>
                </>
            )}
        </div>
    );
}