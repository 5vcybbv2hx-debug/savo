import { SAVO_BLUE } from '@/lib/cockpitMetrics';
import { cn } from '@/lib/utils';

const OPTIONS = [
    { value: 'week', label: 'Woche' },
    { value: 'month', label: 'Monat' },
];

export default function CockpitPeriodSwitch({ value, onChange }) {
    return (
        <div className="inline-flex rounded-full border border-border bg-muted/40 p-0.5" role="tablist">
            {OPTIONS.map(option => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(option.value)}
                        style={active ? { backgroundColor: SAVO_BLUE, borderColor: SAVO_BLUE } : undefined}
                        className={cn(
                            'px-4 py-1.5 text-xs font-semibold rounded-full transition-colors',
                            active ? 'text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}