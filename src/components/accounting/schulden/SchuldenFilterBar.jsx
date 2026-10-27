import { cn } from '@/lib/utils';
import { SCHULDNER_FILTER, STATUS_FILTER } from '@/lib/offenePosten';

function SegmentRow({ options, value, onChange }) {
    return (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {options.map(opt => (
                <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange(opt.id)}
                    className={cn(
                        'px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors',
                        value === opt.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-muted-foreground border-border hover:text-foreground'
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

/** Segment-Filter: Schuldner und Status. */
export default function SchuldenFilterBar({ schuldner, status, onSchuldner, onStatus }) {
    return (
        <div className="space-y-2">
            <SegmentRow options={SCHULDNER_FILTER} value={schuldner} onChange={onSchuldner} />
            <SegmentRow options={STATUS_FILTER} value={status} onChange={onStatus} />
        </div>
    );
}