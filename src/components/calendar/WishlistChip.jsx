import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Wartelisten-Eintrag im Kalender: gestrichelte Umrandung + "W"-Badge,
 * damit er nicht wie eine bestätigte Schicht aussieht.
 */
export default function WishlistChip({ wish, position = null, showName = true, className = '' }) {
    const label = showName ? (wish?.employee_name || 'Wunsch') : (wish?.shift_type || 'Wunsch');
    const time = wish?.start_time ? `${wish.start_time}–${wish.end_time || ''}` : '';

    return (
        <div
            title={`Warteliste${position ? ` · Platz ${position}` : ''} · ${label} ${time}`.trim()}
            className={cn(
                'flex items-center gap-1 min-w-0 rounded border border-dashed border-status-warn/70 bg-status-warn/5 px-1 py-0.5',
                className
            )}
        >
            <span className="shrink-0 w-3.5 h-3.5 rounded-sm border border-dashed border-status-warn/80 text-[8px] font-bold text-status-warn/25 flex items-center justify-center">
                W
            </span>
            <span className="truncate text-[10px] text-status-warn/25">
                {label}
                {position ? ` · ${position}.` : ''}
            </span>
        </div>
    );
}