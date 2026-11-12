import React, { Fragment } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { euro0, dmy, kwLabel } from '@/lib/liquidityPlan';
import { AMPEL_CLASS, toneFor } from './tokens';
import WochenDetails from './WochenDetails';

/** Wochenzeile für schmale Bildschirme — Karte statt Tabellenzeile. */
export default function WochenKarte({ row, expanded, isCurrent, onToggle, onToggleLock }) {
    return (
        <Fragment>
            <button
                type="button"
                onClick={onToggle}
                className={cn(
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                    isCurrent && 'bg-primary/[0.09]'
                )}
            >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', AMPEL_CLASS[row.traffic_light] || 'bg-muted')} />
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium tabular-nums text-foreground">{kwLabel(row)}</p>
                    <p className="text-[11px] text-muted-foreground">
                        {dmy(row.week_start).slice(0, 6)}–{dmy(row.week_end)}
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <p className={cn('text-[13px] font-semibold tabular-nums', toneFor(row.balance_cum))}>
                        {euro0(row.balance_cum)}
                    </p>
                    <p className="text-[11px] tabular-nums text-muted-foreground">Saldo {euro0(row.balance_end)}</p>
                </div>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
            </button>
            {expanded && (
                <div className="bg-surface/40 px-3 pb-3 pt-1">
                    <WochenDetails row={row} onToggleLock={onToggleLock} />
                </div>
            )}
        </Fragment>
    );
}