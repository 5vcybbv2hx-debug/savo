import React from 'react';
import { formatHours } from '@/lib/provisionalShiftHours';

// Kompakte Übersicht „Wer hat wie viel" vor dem Durchbestätigen (Meeting-Queue)
export default function WunschUebersicht({ rows = [], totalCount = 0, totalHours = 0 }) {
    if (rows.length === 0) return null;

    return (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-3">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-1">
                Übersicht vor Bestätigung
            </p>
            <div className="max-h-56 overflow-y-auto">
                {rows.map(row => (
                    <div
                        key={row.key}
                        className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 py-1.5 px-1 border-b border-border/30 last:border-0"
                    >
                        <span className="text-sm font-semibold text-foreground truncate max-w-[50%]">{row.name}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                            · {row.count} {row.count === 1 ? 'Wunsch' : 'Wünsche'}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">· {formatHours(row.hours)} Std</span>
                        {row.weeklyHours != null && row.weeklyHours !== '' && (
                            <span className="text-xs text-muted-foreground/70 whitespace-nowrap">
                                · Vertrag {row.weeklyHours} Std/Wo
                            </span>
                        )}
                    </div>
                ))}
            </div>
            <div className="flex items-baseline justify-between gap-2 border-t border-border/50 mt-1 pt-2 px-1">
                <span className="text-xs font-bold text-foreground">Gesamt</span>
                <span className="text-xs font-bold text-foreground whitespace-nowrap">
                    {totalCount} {totalCount === 1 ? 'Wunsch' : 'Wünsche'} · {formatHours(totalHours)} Std
                </span>
            </div>
        </div>
    );
}