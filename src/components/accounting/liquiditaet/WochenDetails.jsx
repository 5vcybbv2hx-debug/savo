import React from 'react';
import { addDays } from 'date-fns';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { euro, parseDate, dmy } from '@/lib/liquidityPlan';
import { cn } from '@/lib/utils';

function Row({ label, date, amount, tone, sub }) {
    if (!amount) return null;
    return (
        <div className="flex items-baseline gap-2 py-1 border-b border-border/40 last:border-0">
            <div className="min-w-0 flex-1">
                <p className="text-[12px] text-foreground truncate">{label}</p>
                {sub && <p className="text-[10.5px] text-muted-foreground truncate">{sub}</p>}
            </div>
            {date && <span className="text-[10.5px] text-muted-foreground tabular-nums shrink-0">{date}</span>}
            <span
                className={cn(
                    'text-[12px] font-medium tabular-nums shrink-0 w-24 text-right',
                    tone === 'in' ? 'text-status-ok' : 'text-foreground'
                )}
            >
                {tone === 'in' ? '+' : '−'} {euro(amount)}
            </span>
        </div>
    );
}

function Group({ title, children }) {
    const hasChild = React.Children.toArray(children).some(Boolean);
    if (!hasChild) return null;
    return (
        <div className="space-y-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground pt-2.5 pb-1">{title}</p>
            {children}
        </div>
    );
}

export default function WochenDetails({ row, onToggleLock }) {
    const monday = parseDate(row.week_start);
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const duty = (n) => {
        const d = days.find((x) => x.getDate() === n);
        return d ? dmy(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`) : null;
    };

    const fixedStart = 435 + 440 + 1270;
    const vatDay = duty(10);

    return (
        <div className="bg-surface/60 rounded-xl px-3 py-1">
            <Group title="Einnahmen">
                <Row label="Kartengutschrift (55 % − 1,5 %)" amount={row.inflow_card} tone="in" sub={`Basis Umsatz ${euro(row.revenue_plan)}`} />
                <Row label="Bareinzahlung (12,5 %)" amount={row.inflow_cash} tone="in" />
            </Group>

            <Group title="Ausgaben">
                <Row label="Gewerbemiete + Wohnungsmiete + Strom" date={duty(1)} amount={duty(1) ? fixedStart : 0} />
                <Row label="Pacht" date={duty(10)} amount={duty(10) ? 2570.4 : 0} />
                <Row label="Personal (TimeEntry Vorwoche)" amount={row.cost_staff ? row.cost_staff - (duty(1) ? 1500 : 0) - (duty(15) ? 350 : 0) : 0} />
                <Row label="Marco — feste Zahlung" date={duty(1)} amount={duty(1) ? 1500 : 0} />
                <Row label="Marco — feste Zahlung" date={duty(15)} amount={duty(15) ? 350 : 0} />
                <Row label="Sozialversicherung" date={duty(15)} amount={row.cost_sv} sub="AOK, Fälligkeit 15." />
                <Row label="Umsatzsteuer-Voranmeldung" date={vatDay} amount={row.cost_vat} sub="Vormonat, 15,97 % auf den Überschuss" />
            </Group>

            <Group title="Rücklagen">
                <Row label="Einkommensteuer (10 % des Überschusses)" amount={row.reserve_tax} />
            </Group>

            <Group title="Tilgung">
                {(row.debt_payments || []).map((p, i) => (
                    <Row
                        key={`${p.rechnung}-${i}`}
                        label={p.glaeubiger}
                        sub={`Rechnung ${p.rechnung}`}
                        amount={p.betrag}
                    />
                ))}
            </Group>

            <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-border">
                <span className="text-[11px] font-semibold text-muted-foreground">Saldo der Woche</span>
                <span className={cn('text-[12.5px] font-semibold tabular-nums', row.balance_end >= 0 ? 'text-status-ok' : 'text-status-danger')}>
                    {euro(row.balance_end)}
                </span>
            </div>
            <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-semibold text-muted-foreground">Kumuliert</span>
                <span className={cn('text-[12.5px] font-semibold tabular-nums', row.balance_cum >= 0 ? 'text-foreground' : 'text-status-danger')}>
                    {euro(row.balance_cum)}
                </span>
            </div>
            {onToggleLock && row.id && (
                <div className="pb-2.5">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1.5" onClick={() => onToggleLock(row)}>
                        <Lock className="w-3 h-3" />
                        {row.is_locked ? 'Woche entsperren' : 'Woche sperren (nicht mehr fortschreiben)'}
                    </Button>
                </div>
            )}
        </div>
    );
}