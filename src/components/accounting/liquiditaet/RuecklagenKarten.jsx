import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { euro0 } from '@/lib/liquidityPlan';

const POTS = ['USt', 'Einkommensteuer', 'AOK'];

function Pot({ bucket }) {
    const target = bucket.target_balance || 0;
    const current = bucket.current_balance || 0;
    const ratio = target > 0 ? current / target : 0;
    const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    const reached = ratio > 0.8;

    return (
        <div className="rounded-xl bg-surface p-3">
            <p className="text-[11.5px] text-muted-foreground">{bucket.name}</p>
            <p className="mt-1.5 text-[20px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                {euro0(current)}
            </p>
            <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
                Ziel {target > 0 ? euro0(target) : '—'}
            </p>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-track">
                <div
                    className={cn('h-full rounded-full transition-all', reached ? 'bg-status-ok' : 'bg-primary')}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <p className="mt-1.5 text-[10.5px] tabular-nums text-muted-foreground">{percent} %</p>
        </div>
    );
}

export default function RuecklagenKarten({ buckets, stand }) {
    const pots = POTS.map((name) => (buckets || []).find((b) => b.name === name)).filter(Boolean);

    return (
        <Card className="p-4">
            <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13.5px] font-medium leading-snug tracking-tight text-foreground">Rücklagen</p>
                <p className="text-[11.5px] tabular-nums text-muted-foreground">Stand {stand}</p>
            </div>
            {pots.length === 0 ? (
                <p className="mt-2 text-[12px] text-muted-foreground">Noch keine Rücklagen-Töpfe angelegt.</p>
            ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {pots.map((b) => <Pot key={b.id} bucket={b} />)}
                </div>
            )}
        </Card>
    );
}