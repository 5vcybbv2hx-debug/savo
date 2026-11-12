import React from 'react';
import { Card } from '@/components/ui/card';
import { Wallet, TrendingDown, Target, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { euro0, kwLabel } from '@/lib/liquidityPlan';
import { toneFor } from './tokens';

function Kpi({ icon: Icon, label, value, hint, tone }) {
    return (
        <Card className="p-4">
            <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.6} />
                <p className="truncate text-[11.5px] text-muted-foreground">{label}</p>
            </div>
            <p className={cn('mt-2 text-[20px] font-semibold leading-none tracking-tight tabular-nums', tone)}>{value}</p>
            {hint && <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
        </Card>
    );
}

export default function LiquiditaetsKpi({ kpis }) {
    const { openingBalance, lowest, turningPoint, restDebt } = kpis;

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
                icon={Wallet}
                label="Konto jetzt"
                value={euro0(openingBalance)}
                tone={toneFor(openingBalance)}
                hint="Summe aktiver Konten"
            />
            <Kpi
                icon={TrendingDown}
                label="Tiefststand"
                value={euro0(lowest)}
                tone={toneFor(lowest)}
                hint="niedrigster kumulierter Stand"
            />
            <Kpi
                icon={Target}
                label="Drehpunkt"
                value={turningPoint ? kwLabel(turningPoint) : '—'}
                tone={turningPoint ? 'text-foreground' : 'text-status-danger'}
                hint={
                    turningPoint
                        ? `erstmals im Plus ab ${turningPoint.week_start.slice(8, 10)}.${turningPoint.week_start.slice(5, 7)}.`
                        : 'kein positiver Stand im Zeitraum'
                }
            />
            <Kpi
                icon={Landmark}
                label="Restschulden"
                value={euro0(restDebt)}
                tone="text-foreground"
                hint="offene Posten gesamt"
            />
        </div>
    );
}