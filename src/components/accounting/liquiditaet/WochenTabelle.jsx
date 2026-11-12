import React, { Fragment } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { euro, euro0, dmy, kwLabel } from '@/lib/liquidityPlan';
import { AMPEL_CLASS, toneFor } from './tokens';
import WochenDetails from './WochenDetails';
import WochenKarte from './WochenKarte';

const HEAD = 'px-2.5 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground';
const CELL = 'h-11 px-2.5 whitespace-nowrap';

const num = (value, className) => (
    <td className={cn(CELL, 'text-right tabular-nums', className)}>{euro0(value)}</td>
);

function WeekRow({ row, expanded, onToggle, onToggleLock, isCurrent }) {
    return (
        <Fragment>
            <tr
                onClick={onToggle}
                className={cn(
                    'cursor-pointer border-b border-border/60 transition-colors hover:bg-surface/60',
                    isCurrent && 'bg-primary/[0.09]'
                )}
            >
                <td className={CELL}>
                    <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', AMPEL_CLASS[row.traffic_light] || 'bg-muted')} />
                        <span className="font-medium tabular-nums text-foreground">{kwLabel(row)}</span>
                    </div>
                </td>
                <td className={cn(CELL, 'text-muted-foreground')}>
                    {dmy(row.week_start).slice(0, 6)}–{dmy(row.week_end)}
                </td>
                {num(row.revenue_plan, 'text-muted-foreground')}
                {num((row.inflow_card || 0) + (row.inflow_cash || 0), 'text-muted-foreground')}
                {num(row.cost_fixed, 'text-muted-foreground')}
                {num(row.cost_staff, 'text-muted-foreground')}
                {num(row.cost_sv, 'text-muted-foreground')}
                {num(row.cost_vat, 'text-muted-foreground')}
                {num(row.reserve_tax, 'text-muted-foreground')}
                {num(row.debt_rate, 'text-muted-foreground')}
                <td className={cn(CELL, 'text-right font-semibold tabular-nums', toneFor(row.balance_end))}>
                    {euro0(row.balance_end)}
                </td>
                <td className={cn(CELL, 'text-right font-semibold tabular-nums', toneFor(row.balance_cum))}>
                    {euro0(row.balance_cum)}
                </td>
                <td className={CELL}>
                    <div className="flex items-center justify-end gap-2">
                        {row.is_locked && <span className="text-[10px] text-muted-foreground">gesperrt</span>}
                        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr className="border-b border-border/60">
                    <td colSpan={13} className="bg-surface/40 px-3 py-3">
                        <WochenDetails row={row} onToggleLock={onToggleLock} />
                    </td>
                </tr>
            )}
        </Fragment>
    );
}

export default function WochenTabelle({ rows, expandedKey, onToggle, onToggleLock }) {
    const today = new Date().toISOString().slice(0, 10);
    const isCurrent = (row) => row.week_start <= today && today <= row.week_end;

    return (
        <Card className="overflow-hidden">
            {/* Mobil: Kartenliste */}
            <div className="divide-y divide-border/60 md:hidden">
                {rows.map((row) => (
                    <WochenKarte
                        key={row.key}
                        row={row}
                        expanded={expandedKey === row.key}
                        isCurrent={isCurrent(row)}
                        onToggle={() => onToggle(row.key)}
                        onToggleLock={onToggleLock}
                    />
                ))}
            </div>

            {/* Desktop: Tabelle */}
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-[11.5px]">
                    <thead>
                        <tr className="border-b border-border/60">
                            <th className={cn(HEAD, 'text-left')}>KW</th>
                            <th className={cn(HEAD, 'text-left')}>Zeitraum</th>
                            <th className={cn(HEAD, 'text-right')}>Umsatz</th>
                            <th className={cn(HEAD, 'text-right')}>Einnahmen</th>
                            <th className={cn(HEAD, 'text-right')}>Fixkosten</th>
                            <th className={cn(HEAD, 'text-right')}>Personal</th>
                            <th className={cn(HEAD, 'text-right')}>SV</th>
                            <th className={cn(HEAD, 'text-right')}>USt</th>
                            <th className={cn(HEAD, 'text-right')}>Rücklage</th>
                            <th className={cn(HEAD, 'text-right')}>Tilgung</th>
                            <th className={cn(HEAD, 'text-right')}>Saldo</th>
                            <th className={cn(HEAD, 'text-right')}>Kumuliert</th>
                            <th className={HEAD} />
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
                                isCurrent={isCurrent(row)}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 px-4 py-2.5 text-[10.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', AMPEL_CLASS.gruen)} /> ab 2.000 €</span>
                <span className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', AMPEL_CLASS.gelb)} /> unter 2.000 €</span>
                <span className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', AMPEL_CLASS.rot)} /> negativ</span>
                <span className="ml-auto tabular-nums">
                    {euro(rows.reduce((s, r) => s + (r.balance_end || 0), 0))} Saldo gesamt
                </span>
            </div>
        </Card>
    );
}