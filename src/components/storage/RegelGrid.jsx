import { useMemo, useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { GripVertical, X, ChevronRight, ChevronDown, Expand } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * RegelGrid — Visuelles Regal-Grid (View + Edit-Modus mit Drag & Drop)
 *
 * Props:
 *   furniture        — Möbel-Objekt (grid_rows, grid_cols)
 *   slots            — StorageSlot-Array dieses Möbels
 *   assignments      — StorageAssignment-Array (alle aktiven)
 *   activeSlotId     — ID des aktiven Fachs im Rundgang (Highlight)
 *   onSlotTap        — (slot, slotAssignments) => void
 *   readOnly         — boolean (Ansicht, kein Drag & Drop)
 *   editMode         — boolean (Drag & Drop + Resize aktiv)
 *   onSlotUpdate     — (slotId, {grid_row, grid_col, grid_rowspan, grid_colspan}) => Promise
 *   onGridSizeChange — (furnitureId, {grid_rows, grid_cols}) => Promise
 */
export default function RegelGrid({
    furniture,
    slots = [],
    assignments = [],
    activeSlotId = null,
    onSlotTap,
    readOnly = false,
    editMode = false,
    onSlotUpdate,
    onGridSizeChange,
    restockItems = [],
}) {
    const rows = furniture?.grid_rows || 3;
    const cols = furniture?.grid_cols || 4;

    // Drag state
    const [dragSlotId, setDragSlotId] = useState(null);
    const [dragOverCell, setDragOverCell] = useState(null); // {r, c}
    const [resizeSlotId, setResizeSlotId] = useState(null);
    const [resizeStart, setResizeStart] = useState(null); // {r, c, origRowspan, origColspan}
    const [pendingUpdates, setPendingUpdates] = useState({}); // slotId -> {grid_row,grid_col,grid_rowspan,grid_colspan}
    const dragTypeRef = useRef(null); // 'move' | 'resize'

    // Assignments pro Slot
    const assignmentsBySlot = useMemo(() => {
        const map = {};
        assignments.forEach(a => {
            if (!map[a.storage_slot_id]) map[a.storage_slot_id] = [];
            map[a.storage_slot_id].push(a);
        });
        return map;
    }, [assignments]);

    // Slot-Daten inkl. pending overrides
    const getSlotPos = useCallback((slot) => {
        const p = pendingUpdates[slot.id];
        return {
            grid_row:     p?.grid_row     ?? slot.grid_row,
            grid_col:     p?.grid_col     ?? slot.grid_col,
            grid_rowspan: p?.grid_rowspan ?? slot.grid_rowspan ?? 1,
            grid_colspan: p?.grid_colspan ?? slot.grid_colspan ?? 1,
        };
    }, [pendingUpdates]);

    // Platzierte vs. nicht-platzierte Slots
    const placed = useMemo(() =>
        slots.filter(s => {
            const pos = getSlotPos(s);
            return pos.grid_row != null && pos.grid_col != null;
        }),
        [slots, getSlotPos]
    );
    const unplaced = useMemo(() =>
        slots.filter(s => {
            const pos = getSlotPos(s);
            return pos.grid_row == null || pos.grid_col == null;
        }),
        [slots, getSlotPos]
    );

    // Belegte Zellen-Map: "r-c" -> slotId
    const occupiedMap = useMemo(() => {
        const map = {};
        placed.forEach(s => {
            const pos = getSlotPos(s);
            const r = pos.grid_row ?? 0;
            const c = pos.grid_col ?? 0;
            const rs = pos.grid_rowspan || 1;
            const cs = pos.grid_colspan || 1;
            for (let ri = r; ri < r + rs; ri++) {
                for (let ci = c; ci < c + cs; ci++) {
                    map[`${ri}-${ci}`] = s.id;
                }
            }
        });
        return map;
    }, [placed, getSlotPos]);

    // Farb-Status
    // ── Ampel-Status: rot = nicht erfasst, gelb = IST gespeichert, grün = Keller abgearbeitet ──
    const today = new Date().toISOString().slice(0, 10);

    const getWorkflowStatus = (slotAssignments) => {
        if (!slotAssignments?.length) return 'empty';
        // Prüfe für alle Assignments dieses Fachs ob heute schon RestockItems existieren
        const allDone = slotAssignments.every(a => {
            const items = restockItems.filter(r => r.assignment_id === a.id && r.date === today);
            return items.length > 0 && items.every(i => i.is_completed);
        });
        if (allDone) return 'done'; // grün

        const anySaved = slotAssignments.some(a => {
            const items = restockItems.filter(r => r.assignment_id === a.id && r.date === today);
            return items.length > 0;
        });
        if (anySaved) return 'saved'; // gelb

        return 'pending'; // rot
    };

    const getStatusClasses = (slotAssignments) => {
        if (editMode) return 'bg-muted/20 border-border/30'; // im Edit-Modus keine Ampel
        const status = getWorkflowStatus(slotAssignments);
        switch (status) {
            case 'done':    return 'bg-emerald-500/15 border-emerald-500/40';
            case 'saved':   return 'bg-amber-500/15 border-amber-500/40';
            case 'pending': return 'bg-destructive/10 border-destructive/30';
            default:        return 'bg-muted/20 border-border/30';
        }
    };

    const getStatusDot = (slotAssignments) => {
        if (editMode) return null;
        const status = getWorkflowStatus(slotAssignments);
        switch (status) {
            case 'done':    return 'bg-emerald-500';
            case 'saved':   return 'bg-amber-500';
            case 'pending': return 'bg-destructive';
            default:        return null;
        }
    };

    // ── Drag & Drop Handlers ──────────────────────────────────────────────────

    const handleDragStartSlot = (e, slotId) => {
        dragTypeRef.current = 'move';
        setDragSlotId(slotId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('slotId', slotId);
    };

    const handleDragStartUnplaced = (e, slotId) => {
        dragTypeRef.current = 'move';
        setDragSlotId(slotId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('slotId', slotId);
    };

    const handleDragOverCell = (e, r, c) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverCell({ r, c });
    };

    const handleDropOnCell = async (e, r, c) => {
        e.preventDefault();
        const slotId = e.dataTransfer.getData('slotId');
        if (!slotId || !onSlotUpdate) return;

        const slot = slots.find(s => s.id === slotId);
        if (!slot) return;

        const pos = getSlotPos(slot);
        const rs = pos.grid_rowspan || 1;
        const cs = pos.grid_colspan || 1;

        // Prüfe ob alle Zellen frei (oder vom gleichen Slot belegt)
        let conflict = false;
        for (let ri = r; ri < r + rs && !conflict; ri++) {
            for (let ci = c; ci < c + cs && !conflict; ci++) {
                const occupant = occupiedMap[`${ri}-${ci}`];
                if (occupant && occupant !== slotId) conflict = true;
            }
        }

        // Bei Konflikt: tausche mit dem anderen Slot
        if (conflict) {
            // Finde den anderen Slot
            const otherSlotId = occupiedMap[`${r}-${c}`];
            if (otherSlotId && otherSlotId !== slotId) {
                const otherSlot = slots.find(s => s.id === otherSlotId);
                const otherPos = getSlotPos(otherSlot);
                // Tausche Positionen
                setPendingUpdates(prev => ({
                    ...prev,
                    [slotId]: { grid_row: otherPos.grid_row, grid_col: otherPos.grid_col, grid_rowspan: rs, grid_colspan: cs },
                    [otherSlotId]: { grid_row: pos.grid_row, grid_col: pos.grid_col, grid_rowspan: otherPos.grid_rowspan, grid_colspan: otherPos.grid_colspan },
                }));
                try {
                    await onSlotUpdate(slotId, { grid_row: otherPos.grid_row, grid_col: otherPos.grid_col, grid_rowspan: rs, grid_colspan: cs });
                    await onSlotUpdate(otherSlotId, { grid_row: pos.grid_row, grid_col: pos.grid_col, grid_rowspan: otherPos.grid_rowspan, grid_colspan: otherPos.grid_colspan });
                } catch {}
            }
        } else {
            setPendingUpdates(prev => ({
                ...prev,
                [slotId]: { ...(prev[slotId] || {}), grid_row: r, grid_col: c },
            }));
            try {
                await onSlotUpdate(slotId, { grid_row: r, grid_col: c, grid_rowspan: rs, grid_colspan: cs });
            } catch {}
        }

        setDragSlotId(null);
        setDragOverCell(null);
    };

    // Drop auf "nicht platziert" Zone — entfernt Grid-Position
    const handleDropUnplace = async (e) => {
        e.preventDefault();
        const slotId = e.dataTransfer.getData('slotId');
        if (!slotId || !onSlotUpdate) return;

        setPendingUpdates(prev => ({
            ...prev,
            [slotId]: { grid_row: null, grid_col: null, grid_rowspan: 1, grid_colspan: 1 },
        }));
        try {
            await onSlotUpdate(slotId, { grid_row: null, grid_col: null, grid_rowspan: 1, grid_colspan: 1 });
        } catch {}
        setDragSlotId(null);
    };

    // ── Resize via Expand-Button (klick-basiert, einfacher als Drag-Resize) ───
    // Klick auf Expand öffnet ein kleines Popover mit rowspan/colspan Eingabe
    const [resizePopover, setResizePopover] = useState(null); // {slotId, rowspan, colspan}

    const handleResizeSave = async () => {
        if (!resizePopover || !onSlotUpdate) return;
        const slot = slots.find(s => s.id === resizePopover.slotId);
        if (!slot) return;
        const pos = getSlotPos(slot);
        const rs = Math.max(1, Math.min(rows, parseInt(resizePopover.rowspan) || 1));
        const cs = Math.max(1, Math.min(cols, parseInt(resizePopover.colspan) || 1));
        setPendingUpdates(prev => ({
            ...prev,
            [resizePopover.slotId]: { ...(prev[resizePopover.slotId] || {}), grid_rowspan: rs, grid_colspan: cs },
        }));
        try {
            await onSlotUpdate(resizePopover.slotId, { ...pos, grid_rowspan: rs, grid_colspan: cs });
        } catch {}
        setResizePopover(null);
    };

    if (!furniture) return null;

    // ── Leere Zellen berechnen ────────────────────────────────────────────────
    const emptyCells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!occupiedMap[`${r}-${c}`]) {
                emptyCells.push({ r, c });
            }
        }
    }

    const isDragOver = (r, c) => dragOverCell?.r === r && dragOverCell?.c === c;

    // Mindestbreite pro Spalte — auf Mobile zu schmal zum Lesen
    const MIN_CELL_WIDTH = 90; // px — genug für Artikelnamen + Bestand
    const gridMinWidth = cols * MIN_CELL_WIDTH + (cols - 1) * 4; // gap=4px
    const needsHorizontalScroll = gridMinWidth > 320; // typische Mobile-Breite

    return (
        <div className="space-y-3">
            {/* ── Haupt-Grid (horizontal scroll auf Portrait-Mobile) ── */}
            <div className={cn(
                'relative',
                needsHorizontalScroll && 'overflow-x-auto scrollbar-thin'
            )}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateRows: `repeat(${rows}, minmax(60px, auto))`,
                        gridTemplateColumns: `repeat(${cols}, minmax(${MIN_CELL_WIDTH}px, 1fr))`,
                        gap: '4px',
                        minWidth: needsHorizontalScroll ? `${gridMinWidth}px` : '100%',
                    }}
                    onDragLeave={() => setDragOverCell(null)}
                >
                {/* Platzierte Slots */}
                {placed.map(slot => {
                    const pos = getSlotPos(slot);
                    const slotAssignments = assignmentsBySlot[slot.id] || [];
                    const isActive = activeSlotId === slot.id;
                    const isDragging = dragSlotId === slot.id;
                    const statusClasses = getStatusClasses(slotAssignments);
                    const dotColor = getStatusDot(slotAssignments);
                    const isClickable = !readOnly && !editMode && slotAssignments.length > 0 && onSlotTap;

                    return (
                        <div
                            key={slot.id}
                            draggable={editMode}
                            style={{
                                gridRow: `${(pos.grid_row ?? 0) + 1} / span ${pos.grid_rowspan || 1}`,
                                gridColumn: `${(pos.grid_col ?? 0) + 1} / span ${pos.grid_colspan || 1}`,
                            }}
                            className={cn(
                                'relative rounded-lg border p-1.5 flex flex-col gap-0.5 transition-all select-none',
                                statusClasses,
                                isActive && 'ring-2 ring-primary shadow-sm',
                                editMode && 'cursor-grab active:cursor-grabbing',
                                isDragging && 'opacity-40 scale-95',
                                isClickable && 'cursor-pointer hover:brightness-95 active:scale-95',
                            )}
                            onDragStart={editMode ? (e) => handleDragStartSlot(e, slot.id) : undefined}
                            onDragEnd={() => { setDragSlotId(null); setDragOverCell(null); }}
                            onClick={isClickable ? () => {
                                onSlotTap(slot, slotAssignments);
                            } : undefined}
                        >
                            {/* Aktiv-Badge */}
                            {isActive && (
                                <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-primary rounded-full border-2 border-background z-10" />
                            )}
                            {/* Status-Dot (Ampel) */}
                            {dotColor && (
                                <div className={cn('absolute top-1 left-1 w-2 h-2 rounded-full shadow-sm', dotColor)} />
                            )}
                            {/* Drag-Handle im Edit-Modus */}
                            {editMode && (
                                <div className="absolute top-1 right-1 z-10 flex gap-0.5">
                                    <GripVertical className="w-3 h-3 text-muted-foreground/60" />
                                </div>
                            )}
                            {/* Resize-Button im Edit-Modus */}
                            {editMode && (
                                <button
                                    className="absolute bottom-0.5 right-0.5 z-10 p-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setResizePopover({
                                            slotId: slot.id,
                                            rowspan: pos.grid_rowspan || 1,
                                            colspan: pos.grid_colspan || 1,
                                        });
                                    }}
                                    title="Größe anpassen"
                                >
                                    <Expand className="w-2.5 h-2.5" />
                                </button>
                            )}

                            {/* Fach-Name */}
                            <p className="text-[10px] text-muted-foreground font-medium leading-tight pl-2 truncate pr-4">
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
                                        <p className="text-[10px] text-muted-foreground">+{slotAssignments.length - 3}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-[10px] text-muted-foreground/40 italic flex-1 flex items-center">leer</p>
                            )}
                            {/* Bestand */}
                            {slotAssignments.length > 0 && !editMode && (() => {
                                const totalQty = slotAssignments.reduce((acc, a) => acc + (a.quantity ?? 0), 0);
                                const hasAllMinStock = slotAssignments.every(a => a.min_stock != null);
                                if (hasAllMinStock) {
                                    const totalMin = slotAssignments.reduce((acc, a) => acc + a.min_stock, 0);
                                    return (
                                        <div className="absolute bottom-1 right-1">
                                            <span className="text-[9px] bg-background/60 rounded px-1 py-0.5 text-foreground font-medium">
                                                {totalQty}/{totalMin}
                                            </span>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="absolute bottom-1 right-1">
                                            <span className="text-[9px] bg-background/60 rounded px-1 py-0.5 text-foreground font-medium">
                                                IST: {totalQty}
                                            </span>
                                        </div>
                                    );
                                }
                            })()}
                            {/* Span-Anzeige im Edit-Modus */}
                            {editMode && (pos.grid_rowspan > 1 || pos.grid_colspan > 1) && (
                                <span className="text-[9px] text-muted-foreground/50 mt-0.5">
                                    {pos.grid_colspan}×{pos.grid_rowspan}
                                </span>
                            )}
                        </div>
                    );
                })}

                {/* Leere / Drop-Zellen */}
                {emptyCells.map(({ r, c }) => (
                    <div
                        key={`empty-${r}-${c}`}
                        style={{ gridRow: `${r + 1}`, gridColumn: `${c + 1}` }}
                        className={cn(
                            'rounded-lg border transition-all min-h-[60px] flex items-center justify-center',
                            editMode
                                ? 'border-dashed border-primary/30 bg-primary/5 cursor-pointer'
                                : 'border-dashed border-border/25 bg-muted/5',
                            isDragOver(r, c) && editMode && 'border-primary bg-primary/15 scale-95',
                        )}
                        onDragOver={editMode ? (e) => handleDragOverCell(e, r, c) : undefined}
                        onDrop={editMode ? (e) => handleDropOnCell(e, r, c) : undefined}
                    >
                        <span className={cn(
                            'text-[9px]',
                            editMode ? 'text-primary/40' : 'text-muted-foreground/25',
                        )}>
                            {editMode ? `${r + 1}/${c + 1}` : 'leer'}
                        </span>
                    </div>
                ))}
                </div>
            </div>

            {/* ── Nicht-platzierte Slots ── */}
            {editMode ? (
                <div
                    className={cn(
                        'rounded-xl border-2 border-dashed p-3 transition-all',
                        dragSlotId && !placed.find(s => s.id === dragSlotId)
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border/30 bg-muted/10',
                    )}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDropUnplace}
                >
                    <p className="text-[10px] font-medium text-muted-foreground mb-2">
                        Noch nicht platziert {unplaced.length > 0 ? `(${unplaced.length})` : ''} — hierher ziehen zum Entfernen
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {unplaced.map(slot => (
                            <div
                                key={slot.id}
                                draggable
                                onDragStart={(e) => handleDragStartUnplaced(e, slot.id)}
                                onDragEnd={() => { setDragSlotId(null); setDragOverCell(null); }}
                                className={cn(
                                    'flex items-center gap-1 px-2 py-1 rounded-lg border bg-card text-xs font-medium cursor-grab active:cursor-grabbing transition-all select-none',
                                    dragSlotId === slot.id && 'opacity-40 scale-95',
                                    'border-border hover:border-primary/50 hover:bg-primary/5',
                                )}
                            >
                                <GripVertical className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                                <span className="truncate max-w-[100px]">{slot.name || slot.full_name}</span>
                            </div>
                        ))}
                        {unplaced.length === 0 && (
                            <p className="text-[10px] text-muted-foreground/40 italic">Alle Fächer platziert ✓</p>
                        )}
                    </div>
                </div>
            ) : unplaced.length > 0 ? (
                <div className="pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground/60 mb-1.5">Noch nicht im Regal platziert:</p>
                    <div className="flex flex-wrap gap-1">
                        {unplaced.map(slot => (
                            <span key={slot.id} className="text-[10px] bg-muted/30 border border-border/40 rounded px-1.5 py-0.5 text-muted-foreground">
                                {slot.name || slot.full_name}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* ── Resize Popover ── */}
            {resizePopover && (() => {
                const slot = slots.find(s => s.id === resizePopover.slotId);
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4"
                        onClick={() => setResizePopover(null)}>
                        <div className="bg-card border border-border rounded-2xl p-4 w-72 shadow-xl space-y-3"
                            onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold">Fach-Größe: {slot?.name}</p>
                                <button onClick={() => setResizePopover(null)} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Wie viele Zellen soll dieses Fach im Regal einnehmen?
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] text-muted-foreground font-medium block mb-1">Breite (Spalten)</label>
                                    <div className="flex items-center gap-1">
                                        <button
                                            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-sm font-bold hover:bg-muted/50"
                                            onClick={() => setResizePopover(p => ({ ...p, colspan: Math.max(1, (p.colspan || 1) - 1) }))}
                                        >−</button>
                                        <span className="flex-1 text-center text-base font-semibold">{resizePopover.colspan}</span>
                                        <button
                                            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-sm font-bold hover:bg-muted/50"
                                            onClick={() => setResizePopover(p => ({ ...p, colspan: Math.min(cols, (p.colspan || 1) + 1) }))}
                                        >+</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] text-muted-foreground font-medium block mb-1">Höhe (Reihen)</label>
                                    <div className="flex items-center gap-1">
                                        <button
                                            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-sm font-bold hover:bg-muted/50"
                                            onClick={() => setResizePopover(p => ({ ...p, rowspan: Math.max(1, (p.rowspan || 1) - 1) }))}
                                        >−</button>
                                        <span className="flex-1 text-center text-base font-semibold">{resizePopover.rowspan}</span>
                                        <button
                                            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-sm font-bold hover:bg-muted/50"
                                            onClick={() => setResizePopover(p => ({ ...p, rowspan: Math.min(rows, (p.rowspan || 1) + 1) }))}
                                        >+</button>
                                    </div>
                                </div>
                            </div>
                            {/* Vorschau */}
                            <div className="bg-muted/20 rounded-lg p-2 text-center">
                                <p className="text-[11px] text-muted-foreground">
                                    Belegt {resizePopover.colspan} Spalte{resizePopover.colspan > 1 ? 'n' : ''} × {resizePopover.rowspan} Reihe{resizePopover.rowspan > 1 ? 'n' : ''}
                                </p>
                            </div>
                            <Button className="w-full h-9 text-sm" onClick={handleResizeSave}>
                                Speichern
                            </Button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
