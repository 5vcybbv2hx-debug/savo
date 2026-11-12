import React, { Fragment } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { euro, euro0, dmy, kwLabel } from '@/lib/liquidityPlan';
import WochenDetails from './WochenDetails';

const LIGHT_COLOR = {
    gruen: 'bg-status-ok',
    gelb: 'bg-status-warn',
    rot: 'bg-status-danger',
};

const num = (value, className) => (
    <td className={cn('px-2 py-2 text-right tabular-nums whitespace-nowrap', className)}>{euro0(value)}</td>
);

function WeekRow({ row, expanded, onToggle, onToggleLock, isCurrent }) {
    return (
        <Fragment>
            <tr
                onClick={onToggle}
                className={cn(
                    'border-b border-border/50 cursor-pointer transition-colors hover:bg-surface/70',
                    expanded && 'bg-surface/70',
                    isCurrent && 'bg-primary/5'
                )}
            >
                <td className="px-2 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                        <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                        <span className="font-semibold text-foreground">{kwLabel(row)}</span>
                    </div>
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">
                    {dmy(row.week_start).slice(0, 6)}–{dmy(row.week_end)}
                </td>
                {num(row.revenue_plan, 'text-muted-foreground')}
                {num((row.inflow_card || 0) + (row.inflow_cash || 0), 'text-status-ok')}
                {num(row.cost_fixed, 'text-muted-foreground')}
                {num(row.cost_staff, 'text-muted-foreground')}
                {num(row.cost_sv, 'text-muted-foreground')}
                {num(row.cost_vat, 'text-muted-foreground')}
                {num(row.reserve_tax, 'text-muted-foreground')}
                {num(row.debt_rate, 'text-muted-foreground')}
                <td className={cn('px-2 py-2 text-right tabular-nums font-semibold whitespace-nowrap', row.balance_end >= 0 ? 'text-status-ok' : 'text-status-danger')}>
                    {euro0(row.balance_end)}
                </td>
                <td className={cn('px-2 py-2 text-right tabular-nums font-semibold whitespace-nowrap', row.balance_cum >= 0 ? 'text-foreground' : 'text-status-danger')}>
                    {euro0(row.balance_cum)}
                </td>
                <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', LIGHT_COLOR[row.traffic_light] || 'bg-muted')} />
                        {row.is_locked && <span className="text-[9.5px] text-muted-foreground">gesperrt</span>}
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr className="border-b border-border/50">
                    <td colSpan={13} className="px-2 py-2.5">
                        <WochenDetails row={row} onToggleLock={onToggleLock} />
                    </td>
                </tr>
            )}
        </Fragment>
    );
}

export default function WochenTabelle({ rows, expandedKey, onToggle, onToggleLock }) {
    const today = new Date().toISOString().slice(0, 10);
    return (
        <Card className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-[11.5px]">
                    <thead>
                        <tr className="border-b border-border bg-surface/60 text-muted-foreground">
                            <th className="px-2 py-2 text-left font-medium">KW</th>
                            <th className="px-2 py-2 text-left font-medium">Zeitraum</th>
                            <th className="px-2 py-2 text-right font-medium">Umsatz</th>
                            <th className="px-2 py-2 text-right font-medium">Einnahmen</th>
                            <th className="px-2 py-2 text-right font-medium">Fixkosten</th>
                            <th className="px-2 py-2 text-right font-medium">Personal</th>
                            <th className="px-2 py-2 text-right font-medium">SV</th>
                            <th className="px-2 py-2 text-right font-medium">USt</th>
                            <th className="px-2 py-2 text-right font-medium">Rücklagen</th>
                            <th className="px-2 py-2 text-right font-medium">Tilgung</th>
                            <th className="px-2 py-2 text-right font-medium">Saldo</th>
                            <th className="px-2 py-2 text-right font-medium">Kumuliert</th>
                            <th className="px-2 py-2 text-left font-medium">Ampel</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <WeekRow
                                key={row.key}
                                row={row}
                                expanded={expandedKey === row.key}
                                onToggle={() => onToggle(row.key)}
                                onToggleLock={onToggleLock}
                                isCurrent={row.week_start <= today && today <= row.week_end}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="px-3 py-2 border-t border-border/60 flex items-center gap-3 text-[10.5px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-status-ok" /> ≥ 2.000 €</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-status-warn" /> unter 2.000 €</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-status-danger" /> negativ</span>
                <span className="ml-auto">{euro(rows.reduce((s, r) => s + (r.balance_end || 0), 0))} Saldo gesamt</span>
            </div>
        </Card>
    );
}