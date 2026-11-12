import React from 'react';
import { Card } from '@/components/ui/card';
import { Wallet, TrendingDown, Target, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { euro0, kwLabel } from '@/lib/liquidityPlan';

const TONE = {
    neutral: 'text-foreground',
    ok: 'text-status-ok',
    warn: 'text-status-warn',
    danger: 'text-status-danger',
};

function Kpi({ icon: Icon, label, value, hint, tone = 'neutral' }) {
    return (
        <Card className="p-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
            </div>
            <p className={cn('text-lg font-semibold tabular-nums tracking-tight', TONE[tone])}>{value}</p>
            {hint && <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
        </Card>
    );
}

export default function LiquiditaetsKpi({ kpis }) {
    const { openingBalance, lowest, turningPoint, restDebt } = kpis;
    return (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Kpi
                icon={Wallet}
                label="Kontostand heute"
                value={euro0(openingBalance)}
                tone={openingBalance < 0 ? 'danger' : 'neutral'}
                hint="Summe aktiver Konten"
            />
            <Kpi
                icon={TrendingDown}
                label="Tiefststand"
                value={euro0(lowest)}
                tone={lowest < 0 ? 'danger' : lowest < 2000 ? 'warn' : 'ok'}
                hint="niedrigster kumulierter Stand"
            />
            <Kpi
                icon={Target}
                label="Drehpunkt"
                value={turningPoint ? kwLabel(turningPoint) : '—'}
                tone={turningPoint ? 'ok' : 'danger'}
                hint={
                    turningPoint
                        ? `erstmals positiv ab ${turningPoint.week_start.slice(8, 10)}.${turningPoint.week_start.slice(5, 7)}.`
                        : 'kein positiver Stand im Zeitraum'
                }
            />
            <Kpi icon={Landmark} label="Restschulden" value={euro0(restDebt)} tone="danger" hint="offene Posten gesamt" />
        </div>
    );
}