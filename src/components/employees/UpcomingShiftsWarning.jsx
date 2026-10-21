/**
 * UpcomingShiftsWarning — Warnblock im EmployeeDeleteDialog.
 * Zeigt die kommenden Schichten eines Mitarbeiters, die beim Inaktiv-Setzen
 * in den Tauschmarkt gegeben werden können. Alle Zeilen sind per Default
 * ausgewählt.
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const MAX_VISIBLE = 10;

export default function UpcomingShiftsWarning({ employeeName, shifts = [], selectedIds = [], onToggle, onToggleAll }) {
    if (shifts.length === 0) return null;

    const visible = shifts.slice(0, MAX_VISIBLE);
    const rest = shifts.length - visible.length;
    const allSelected = selectedIds.length === shifts.length;

    return (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
            <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-amber-200">
                    ⚠️ {employeeName} hat noch {shifts.length} kommende {shifts.length === 1 ? 'Schicht' : 'Schichten'} (bis {format(parseISO(shifts[shifts.length - 1].date), 'dd.MM.yyyy')}).
                </p>
            </div>

            <div className="flex items-center justify-between px-1">
                <button
                    type="button"
                    onClick={onToggleAll}
                    className="text-[11px] text-amber-300 underline underline-offset-2 min-h-[32px]"
                >
                    {allSelected ? 'Alle abwählen' : 'Alle auswählen'}
                </button>
                <span className="text-[11px] text-amber-300/80">{selectedIds.length} von {shifts.length} gewählt</span>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1">
                {visible.map(s => (
                    <label
                        key={s.id}
                        className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-black/20 border border-amber-500/20 cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            checked={selectedIds.includes(s.id)}
                            onChange={() => onToggle(s.id)}
                            className="w-4 h-4 accent-amber-500 shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-semibold text-foreground">
                                    {format(parseISO(s.date), 'EEEE, dd.MM.yyyy', { locale: de })}
                                </span>
                                {s.shift_type && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30">
                                        {s.shift_type}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                {s.start_time}–{s.end_time} Uhr
                            </p>
                        </div>
                    </label>
                ))}
            </div>

            {rest > 0 && (
                <p className="text-[11px] text-amber-300/80 px-1">
                    +{rest} weitere {rest === 1 ? 'Schicht' : 'Schichten'} — alle werden berücksichtigt.
                </p>
            )}
        </div>
    );
}