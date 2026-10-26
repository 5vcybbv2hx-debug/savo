import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Prozentuale Abweichung zum Vorjahr — grüner Pfeil aufwärts, roter abwärts. */
export default function CockpitDelta({ pct }) {
    if (pct == null) return null;

    const up = pct >= 0;
    const Icon = up ? ArrowUpRight : ArrowDownRight;
    const sign = up ? '+' : '';

    return (
        <span className={cn(
            'inline-flex items-center gap-0.5 font-semibold',
            up ? 'text-emerald-600' : 'text-red-600'
        )}>
            <Icon className="w-3.5 h-3.5" />
            {`${sign}${pct.toFixed(1).replace('.', ',')} %`}
        </span>
    );
}