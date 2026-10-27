import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fmtEUR, schuldenKpi, SAVO_BLUE } from '@/lib/offenePosten';

/** Kopf-Kacheln: offene Summen je Schuldner, Anzahl offener Posten, Abgebautes. */
export default function SchuldenKopfKacheln({ posten }) {
    const kpi = schuldenKpi(posten);

    const tiles = [
        { label: 'Gesamt offen',    value: fmtEUR(kpi.gesamtOffen), wide: true, accent: true },
        { label: 'Pierre offen',    value: fmtEUR(kpi.pierre) },
        { label: 'Sandra offen',    value: fmtEUR(kpi.sandra) },
        { label: 'Offene Posten',   value: String(kpi.anzahlOffen) },
        { label: 'Abgebaut',        value: fmtEUR(kpi.abgebaut), positive: true },
    ];

    return (
        <div className="grid grid-cols-2 gap-2.5">
            {tiles.map(t => (
                <Card
                    key={t.label}
                    className={cn('p-3.5', t.wide && 'col-span-2')}
                    style={t.accent ? { borderColor: 'rgba(0,153,219,0.4)' } : undefined}
                >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.label}</p>
                    <p
                        className={cn(
                            'font-bold tabular-nums mt-1 leading-tight',
                            t.wide ? 'text-2xl' : 'text-lg',
                            t.positive && 'text-emerald-600 dark:text-emerald-400'
                        )}
                        style={t.accent ? { color: SAVO_BLUE } : undefined}
                    >
                        {t.value}
                    </p>
                </Card>
            ))}
        </div>
    );
}