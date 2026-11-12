import React from 'react';
import { addDays } from 'date-fns';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { euro, parseDate, dmy } from '@/lib/liquidityPlan';
import { cn } from '@/lib/utils';
import { toneFor } from './tokens';

function Row({ label, date, amount, sub }) {
    if (!amount) return null;
    return (
        <div className="flex items-baseline gap-2 border-b border-border/40 py-1 last:border-0">
            <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-foreground">{label}</p>
                {sub && <p className="truncate text-[10.5px] text-muted-foreground">{sub}</p>}
            </div>
            {date && <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">{date}</span>}
            <span className="w-24 shrink-0 text-right text-[12px] font-medium tabular-nums text-foreground">
                − {euro(amount)}
            </span>
        </div>
    );
}

function InRow({ label, amount, sub }) {
    if (!amount) return null;
    return (
        <div className="flex items-baseline gap-2 border-b border-border/40 py-1 last:border-0">
            <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-foreground">{label}</p>
                {sub && <p className="truncate text-[10.5px] text-muted-foreground">{sub}</p>}
            </div>
            <span className="w-24 shrink-0 text-right text-[12px] font-medium tabular-nums text-foreground">
                + {euro(amount)}
            </span>
        </div>
    );
}

function Group({ title, children }) {
    const hasChild = React.Children.toArray(children).some(Boolean);
    if (!hasChild) return null;
    return (
        <div>
            <p className="pb-1 pt-2.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
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
        <div className="rounded-xl bg-surface/60 px-3 py-1">
            <Group title="Einnahmen">
                <InRow label="Kartengutschrift (55 % − 1,5 %)" amount={row.inflow_card} sub={`Basis Umsatz ${euro(row.revenue_plan)}`} />
                <InRow label="Bareinzahlung (12,5 %)" amount={row.inflow_cash} />
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

            <div className="mt-1 flex items-center justify-between border-t border-border pt-2.5">
                <span className="text-[11px] font-medium text-muted-foreground">Saldo der Woche</span>
                <span className={cn('text-[12.5px] font-semibold tabular-nums', toneFor(row.balance_end))}>
                    {euro(row.balance_end)}
                </span>
            </div>
            <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-medium text-muted-foreground">Kumuliert</span>
                <span className={cn('text-[12.5px] font-semibold tabular-nums', toneFor(row.balance_cum))}>
                    {euro(row.balance_cum)}
                </span>
            </div>

            {onToggleLock && row.id && (
                <div className="pb-2.5">
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-[11px]" onClick={() => onToggleLock(row)}>
                        <Lock className="h-3 w-3" />
                        {row.is_locked ? 'Woche entsperren' : 'Woche sperren'}
                    </Button>
                </div>
            )}
        </div>
    );
}