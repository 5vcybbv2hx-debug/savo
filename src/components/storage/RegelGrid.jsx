import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

/**
 * RegelGrid — Visuelles Regal-Grid für ein Möbel.
 *
 * Props:
 *   furniture      — Möbel-Objekt (grid_rows, grid_cols)
 *   slots          — StorageSlot-Array dieses Möbels (mit grid_row/col/rowspan/colspan)
 *   assignments    — StorageAssignment-Array (alle, gefiltert auf is_active)
 *   activeSlotId   — ID des aktuell aktiven Fachs im Rundgang (Highlight)
 *   onAddToRestock — (slot, assignment) => void — Callback "zur Auffüllliste"
 *   readOnly       — boolean — wenn true, kein Klick-Callback
 */
export default function RegelGrid({
    furniture,
    slots = [],
    assignments = [],
    activeSlotId = null,
    onAddToRestock,
    readOnly = false,
}) {
    const rows = furniture?.grid_rows || 3;
    const cols = furniture?.grid_cols || 4;

    // Assignments pro Slot
    const assignmentsBySlot = useMemo(() => {
        const map = {};
        assignments.forEach(a => {
            if (!map[a.storage_slot_id]) map[a.storage_slot_id] = [];
            map[a.storage_slot_id].push(a);
        });
        return map;
    }, [assignments]);

    // Platzierte vs. nicht-platzierte Slots
    const placed = useMemo(
        () => slots.filter(s => s.grid_row != null && s.grid_col != null),
        [slots]
    );
    const unplaced = useMemo(
        () => slots.filter(s => s.grid_row == null || s.grid_col == null),
        [slots]
    );

    // Belegte Grid-Zellen berechnen (um leere Zellen korrekt zu rendern)
    const occupiedCells = useMemo(() => {
        const set = new Set();
        placed.forEach(s => {
            const r = s.grid_row ?? 0;
            const c = s.grid_col ?? 0;
            const rs = s.grid_rowspan || 1;
            const cs = s.grid_colspan || 1;
            for (let ri = r; ri < r + rs; ri++) {
                for (let ci = c; ci < c + cs; ci++) {
                    set.add(`${ri}-${ci}`);
                }
            }
        });
        return set;
    }, [placed]);

    // Leere Zellen: alle grid-Positionen die nicht belegt sind
    const emptyCells = useMemo(() => {
        const cells = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!occupiedCells.has(`${r}-${c}`)) {
                    cells.push({ r, c });
                }
            }
        }
        return cells;
    }, [rows, cols, occupiedCells]);

    // Farb-Klassen je nach Bestandsstatus
    const getStatusClasses = (slotAssignments) => {
        if (!slotAssignments?.length) return 'bg-muted/20 border-border/30';
        // Berechne Gesamt-Soll und Gesamt-Bestand
        let totalQty = 0, totalMin = 0, hasMin = false;
        slotAssignments.forEach(a => {
            totalQty += (a.quantity ?? 0);
            if (a.min_stock != null) { totalMin += a.min_stock; hasMin = true; }
        });
        if (!hasMin) return 'bg-muted/20 border-border/40';
        if (totalMin === 0) return 'bg-muted/20 border-border/40';
        const ratio = totalQty / totalMin;
        if (ratio >= 1)   return 'bg-emerald-500/15 border-emerald-500/40';
        if (ratio >= 0.5) return 'bg-amber-500/15 border-amber-500/40';
        return 'bg-destructive/15 border-destructive/40';
    };

    const getStatusDot = (slotAssignments) => {
        if (!slotAssignments?.length) return null;
        let totalQty = 0, totalMin = 0, hasMin = false;
        slotAssignments.forEach(a => {
            totalQty += (a.quantity ?? 0);
            if (a.min_stock != null) { totalMin += a.min_stock; hasMin = true; }
        });
        if (!hasMin || totalMin === 0) return null;
        const ratio = totalQty / totalMin;
        if (ratio >= 1)   return 'bg-emerald-500';
        if (ratio >= 0.5) return 'bg-amber-500';
        return 'bg-destructive';
    };

    if (!furniture) return null;

    return (
        <div className="space-y-3">
            {/* ── Haupt-Grid ── */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateRows: `repeat(${rows}, minmax(64px, auto))`,
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gap: '4px',
                }}
            >
                {/* Platzierte Slots */}
                {placed.map(slot => {
                    const slotAssignments = assignmentsBySlot[slot.id] || [];
                    const isActive = activeSlotId === slot.id;
                    const statusClasses = getStatusClasses(slotAssignments);
                    const dotColor = getStatusDot(slotAssignments);
                    const isClickable = !readOnly && slotAssignments.length > 0 && onAddToRestock;

                    return (
                        <div
                            key={slot.id}
                            style={{
                                gridRow: `${(slot.grid_row ?? 0) + 1} / span ${slot.grid_rowspan || 1}`,
                                gridColumn: `${(slot.grid_col ?? 0) + 1} / span ${slot.grid_colspan || 1}`,
                            }}
                            className={cn(
                                'relative rounded-lg border p-1.5 flex flex-col gap-0.5 transition-all',
                                statusClasses,
                                isActive && 'ring-2 ring-primary shadow-sm',
                                isClickable && 'cursor-pointer hover:brightness-95 active:scale-95',
                            )}
                            onClick={isClickable ? () => {
                                // Jeden Artikel einzeln klickbar, bei mehreren Artikeln alle anbieten
                                slotAssignments.forEach(a => onAddToRestock(slot, a));
                            } : undefined}
                        >
                            {/* Aktiv-Badge */}
                            {isActive && (
                                <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-primary rounded-full border-2 border-background" />
                            )}

                            {/* Status-Dot */}
                            {dotColor && (
                                <div className={cn('absolute top-1 left-1 w-1.5 h-1.5 rounded-full', dotColor)} />
                            )}

                            {/* Fach-Name */}
                            <p className="text-[10px] text-muted-foreground font-medium leading-tight pl-2 truncate">
                                {slot.name || slot.full_name}
                            </p>

                            {/* Artikel */}
                            {slotAssignments.length > 0 ? (
                                <div className="flex-1 flex flex-col gap-0.5 justify-center">
                                    {slotAssignments.slice(0, 3).map(a => (
                                        <p key={a.id} className="text-[11px] font-semibold text-foreground leading-tight truncate">
                                            {a.article_name}
                                        </p>
                                    ))}
                                    {slotAssignments.length > 3 && (
                                        <p className="text-[10px] text-muted-foreground">+{slotAssignments.length - 3} weitere</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-[10px] text-muted-foreground/40 italic flex-1 flex items-center">leer</p>
                            )}

                            {/* Bestand */}
                            {slotAssignments.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 mt-0.5">
                                    {slotAssignments.slice(0, 2).map(a => (
                                        a.min_stock != null ? (
                                            <span key={a.id} className="text-[9px] text-muted-foreground bg-background/50 rounded px-1 py-0.5">
                                                {a.quantity ?? '?'}/{a.min_stock}
                                            </span>
                                        ) : null
                                    ))}
                                </div>
                            )}

                            {/* Auffüllen-Hint */}
                            {isClickable && (
                                <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Plus className="w-3 h-3 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Leere Zellen */}
                {emptyCells.map(({ r, c }) => (
                    <div
                        key={`empty-${r}-${c}`}
                        style={{
                            gridRow: `${r + 1}`,
                            gridColumn: `${c + 1}`,
                        }}
                        className="rounded-lg border border-dashed border-border/25 bg-muted/5 flex items-center justify-center min-h-[64px]"
                    >
                        <span className="text-[9px] text-muted-foreground/25">leer</span>
                    </div>
                ))}
            </div>

            {/* ── Nicht platzierte Slots ── */}
            {unplaced.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground/60 mb-1.5">Noch nicht im Regal platziert:</p>
                    <div className="flex flex-wrap gap-1">
                        {unplaced.map(slot => (
                            <span
                                key={slot.id}
                                className="text-[10px] bg-muted/30 border border-border/40 rounded px-1.5 py-0.5 text-muted-foreground"
                            >
                                {slot.name || slot.full_name}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
