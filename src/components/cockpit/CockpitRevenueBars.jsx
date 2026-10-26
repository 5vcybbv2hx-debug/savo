import { Card } from '@/components/ui/card';
import { SAVO_BLUE, fmtEUR } from '@/lib/cockpitMetrics';
import { cn } from '@/lib/utils';

/** Kleine Balkenübersicht der Tagesumsätze — SAVO-Blau als einzige Farbe. */
export default function CockpitRevenueBars({ series, periodLabel }) {
    const max = Math.max(...series.map(d => d.value), 1);
    const activeDays = series.filter(d => d.value > 0).length;
    const total = series.reduce((sum, d) => sum + d.value, 0);
    const showLabels = series.length <= 10;

    return (
        <Card className="p-4 md:p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Umsatz pro Tag</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {activeDays} von {series.length} Tagen mit Umsatz
                        {activeDays > 0 && ` · Ø ${fmtEUR(total / activeDays)}`}
                    </p>
                </div>
                <p className="text-xs font-semibold shrink-0" style={{ color: SAVO_BLUE }}>{periodLabel}</p>
            </div>

            <div className="flex items-end gap-[3px] h-32 md:h-40">
                {series.map(day => (
                    <div
                        key={day.date}
                        className="flex-1 h-full flex items-end"
                        title={`${day.label}: ${fmtEUR(day.value)}`}
                    >
                        <div
                            className="w-full rounded-t"
                            style={{
                                height: day.value > 0 ? `${Math.max(4, (day.value / max) * 100)}%` : '3px',
                                backgroundColor: day.value > 0 ? SAVO_BLUE : 'hsl(var(--muted))',
                            }}
                        />
                    </div>
                ))}
            </div>

            <div className="flex gap-[3px] mt-2">
                {series.map(day => (
                    <span
                        key={day.date}
                        className={cn(
                            'flex-1 text-center text-[10px] text-muted-foreground',
                            !showLabels && 'hidden sm:block'
                        )}
                    >
                        {day.label}
                    </span>
                ))}
            </div>
        </Card>
    );
}