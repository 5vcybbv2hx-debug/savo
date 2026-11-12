import React, { useMemo } from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { euro } from '@/lib/liquidityPlan';

export default function LiquiditaetsChart({ rows, actualByWeek }) {
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
            <p className="text-[13px] font-medium text-foreground tracking-tight mb-3">
                Kumulierte Liquidität
            </p>
            <div className="h-[240px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                            tickFormatter={(v) => `KW${v}`} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={52}
                            tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                        <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid hsl(var(--border))' }}
                            formatter={(value, name) => [euro(value), name === 'soll' ? 'Soll' : 'Ist']}
                            labelFormatter={(label) => `KW ${label}`}
                        />
                        <ReferenceLine y={0} stroke="hsl(var(--status-danger))" strokeDasharray="4 3" />
                        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => (value === 'soll' ? 'Soll (Plan)' : 'Ist (gebucht)')} />
                        <Line type="monotone" dataKey="soll" stroke="#0099db" strokeWidth={2} dot={false} />
                        {hasActual && (
                            <Line type="monotone" dataKey="ist" stroke="hsl(var(--muted-foreground))" strokeWidth={2}
                                strokeDasharray="5 4" dot={false} connectNulls={false} />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <p className="text-[10.5px] text-muted-foreground mt-1">
                Soll durchgezogen · Ist gestrichelt. Nulllinie rot.
            </p>
        </Card>
    );
}