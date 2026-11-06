import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (value) => {
    const v = Math.round((Number(value) || 0) * 10) / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
};

export default function VacationBalanceCard({ balance, year }) {
    if (!balance) return null;

    const {
        entitlement, carryover, total, used, pending,
        available, available_hours,
    } = balance;
    const negative = available < 0;
    const low = !negative && available < 5;

    return (
        <Card className="p-5 mb-6 bg-card border-border">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                        <Wallet className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">Dein Urlaubskonto</p>
                        <p className="text-xs text-muted-foreground">{year}</p>
                    </div>
                </div>
                {carryover > 0 && (
                    <Badge className="bg-primary/15 text-primary border border-primary/25 rounded-lg text-[10px]">
                        +{fmt(carryover)} Übertrag
                    </Badge>
                )}
            </div>

            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
                <span className={cn(
                    'text-4xl font-bold tabular-nums leading-none',
                    negative ? 'text-status-danger' : 'text-primary',
                )}>
                    {fmt(available)}
                </span>
                <span className="text-sm text-muted-foreground">
                    Tage · {fmt(available_hours)} h verfügbar
                </span>
            </div>

            <p className="text-xs text-foreground tabular-nums">
                {fmt(entitlement)} Anspruch{carryover > 0 ? ` + ${fmt(carryover)} Übertrag` : ''} = {fmt(total)} Tage
                {' · '}genommen {fmt(used)}
                {pending > 0 ? ` · beantragt ${fmt(pending)}` : ''}
            </p>
            {carryover > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                    davon {fmt(carryover)} Tage Übertrag (verfällt nicht)
                </p>
            )}

            {negative && (
                <div className="mt-4 flex items-start gap-2 text-xs text-status-danger">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Konto überzogen — neuer Urlaub nur nach Rücksprache.</span>
                </div>
            )}
            {low && (
                <div className="mt-4 flex items-start gap-2 text-xs text-status-warn">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Weniger als 5 Tage verfügbar.</span>
                </div>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
                1 Urlaubstag = 8 h · Ruhetage zählen nicht als Urlaubstag. Übertrag wird zuerst verbraucht.
            </p>
        </Card>
    );
}