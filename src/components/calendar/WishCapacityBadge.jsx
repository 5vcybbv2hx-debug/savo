import React from 'react';
import { cn } from '@/lib/utils';

/** Auslastung einer Schichtart als "3/4" — rot, wenn voll. */
export default function WishCapacityBadge({ label, taken = 0, capacity = 0, className = '' }) {
    if (!capacity) return null;
    const full = taken >= capacity;

    return (
        <span
            title={`${label ? `${label}: ` : ''}${taken} von ${capacity} Wunschplätzen belegt`}
            className={cn(
                'inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-mono leading-none',
                full ? 'bg-rose-500/15 text-rose-300' : 'bg-secondary/70 text-muted-foreground',
                className
            )}
        >
            {label && <span className="opacity-70">{label}</span>}
            <span className="font-semibold">{taken}/{capacity}</span>
        </span>
    );
}