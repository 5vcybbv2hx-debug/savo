import React, { useMemo } from 'react';
import {
    ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { euro } from '@/lib/liquidityPlan';
import { ACCENT, GRID } from './tokens';

const TICK = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };

export default function LiquiditaetsChart({ rows, actualByWeek, stand }) {
    const hasActual = Object.keys(actualByWeek || {}).length > 0;

    const data = useMemo(() => {
        let istCum = null;
        return (rows || []).map((row) => {
            const key = `${row.year}-${row.week}`;
            const actual = actualByWeek?.[key];
            if (actual !== undefined) {
                istCum = (istCum ?? (row.opening_balance || 0)) + actual;
            }
            return {
                label: `${row.week}`,
                soll: row.balance_cum,
                ist: actual !== undefined ? Math.round(istCum) : null,
            };
        });
    }, [rows, actualByWeek]);

    return (
        <Card className="p-4">
            <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13.5px] font-medium leading-snug tracking-tight text-foreground">Kumulierte Liquidität</p>
                <p className="text-[11.5px] tabular-nums text-muted-foreground">Stand {stand}</p>
            </div>

            <div className="-ml-3 mt-3 h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient id="liqArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.1} />
                                <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke={GRID} />
                        <XAxis
                            dataKey="label"
                            tick={TICK}
                            tickLine={false}
                            axisLine={{ stroke: GRID }}
                            tickFormatter={(v) => `KW${v}`}
                            interval="preserveStartEnd"
                            minTickGap={16}
                        />
                        <YAxis
                            tick={TICK}
                            tickLine={false}
                            axisLine={false}
                            width={44}
                            tickFormatter={(v) => (v === 0 ? '0' : `${Math.round(v / 1000)}k`)}
                        />
                        <Tooltip
                            cursor={{ stroke: GRID }}
                            contentStyle={{
                                background: 'hsl(var(--card))',
                                border: '1px solid rgba(255,255,255,0.085)',
                                borderRadius: 12,
                                fontSize: 11.5,
                                padding: '8px 10px',
                            }}
                            labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: 2 }}
                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                            formatter={(value, name) => [euro(value), name === 'soll' ? 'Soll' : 'Ist']}
                            labelFormatter={(label) => `KW ${label}`}
                        />
                        <ReferenceLine y={0} stroke="#E2574C" strokeOpacity={0.55} strokeDasharray="4 4" />
                        <Area
                            type="monotone"
                            dataKey="soll"
                            stroke="none"
                            fill="url(#liqArea)"
                            tooltipType="none"
                            isAnimationActive={false}
                        />
                        <Line type="monotone" dataKey="soll" stroke={ACCENT} strokeWidth={2.4} dot={false} isAnimationActive={false} />
                        {hasActual && (
                            <Line
                                type="monotone"
                                dataKey="ist"
                                stroke="hsl(var(--muted-foreground))"
                                strokeWidth={2}
                                strokeDasharray="5 4"
                                dot={false}
                                connectNulls={false}
                                isAnimationActive={false}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <span className="h-[2.5px] w-5 rounded-full" style={{ backgroundColor: ACCENT }} />Soll
                </span>
                {hasActual && (
                    <span className="flex items-center gap-1.5">
                        <span className="w-5 border-t-2 border-dashed border-muted-foreground" />Ist
                    </span>
                )}
                <span className="flex items-center gap-1.5">
                    <span className="w-5 border-t-2 border-dashed" style={{ borderColor: 'rgba(226,87,76,0.55)' }} />Nulllinie
                </span>
            </div>
        </Card>
    );
}