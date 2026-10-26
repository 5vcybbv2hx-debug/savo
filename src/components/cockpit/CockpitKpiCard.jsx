import { Card } from '@/components/ui/card';
import { SAVO_BLUE } from '@/lib/cockpitMetrics';
import { cn } from '@/lib/utils';

/** KPI-Kachel — ruhige Card, SAVO-Blau als einziger Akzent. */
export default function CockpitKpiCard({ label, value, sub, icon: Icon, prominent = false }) {
    return (
        <Card
            className={cn('p-4 md:p-5', prominent && 'p-5 md:p-6 border-2')}
            style={prominent ? { borderColor: SAVO_BLUE } : undefined}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: SAVO_BLUE }} />}
            </div>

            <p
                className={cn(
                    'font-bold mt-2 leading-tight',
                    prominent ? 'text-3xl md:text-4xl' : 'text-xl md:text-2xl'
                )}
                style={prominent ? { color: SAVO_BLUE } : undefined}
            >
                {value}
            </p>

            {sub && (
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {sub}
                </div>
            )}
        </Card>
    );
}