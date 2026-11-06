import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Pencil, Check, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TABLE_SIZES = {
    square: { w: 60, h: 60 },
    rectangle_horizontal: { w: 90, h: 55 },
    rectangle_vertical: { w: 55, h: 90 },
    round: { w: 60, h: 60 }
};

function getDefaultPosition(index, total) {
    const cols = Math.ceil(Math.sqrt(Math.max(total, 1)));
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
        x: 70 + col * 110,
        y: 70 + row * 110
    };
}

function TableShape({ posX, posY, table, isReserved, isSelected, editMode, onMouseDown, onClick, onSizeChange }) {
    const baseSize = TABLE_SIZES[table.shape] || TABLE_SIZES.square;
    const multiplier = table.size_multiplier || 1;
    const size = {
        w: baseSize.w * multiplier,
        h: baseSize.h * multiplier
    };
    const isRound = table.shape === 'round';

    return (
        <div
            style={{
                position: 'absolute',
                left: posX,
                top: posY,
                width: size.w,
                height: size.h,
                transform: 'translate(-50%, -50%)',
                cursor: editMode ? 'grab' : 'pointer',
                zIndex: isSelected ? 20 : 10,
                userSelect: 'none'
            }}
            onMouseDown={editMode ? onMouseDown : undefined}
            onTouchStart={editMode ? onMouseDown : undefined}
            onClick={onClick}
        >
            <div className={cn(
                'w-full h-full flex flex-col items-center justify-center border select-none shadow-sm transition-all hover:shadow-md',
                isRound ? 'rounded-full' : 'rounded-lg',
                editMode && 'ring-2 ring-status-warn/40 border-dashed border-status-warn/60',
                isSelected ? 'ring-2 ring-status-warn/80 shadow-md' : '',
                isReserved
                    ? 'bg-gradient-to-br from-primary/25 to-primary/15 border-primary/50 text-primary'
                    : 'bg-gradient-to-br from-primary/15 to-primary/5 border-primary/40 text-primary/25'
            )}>
                <span className="text-sm font-semibold leading-tight text-center px-1">
                    {table.table_number}
                </span>
                <span className="text-[11px] opacity-70 font-medium">{table.capacity}P</span>
                {editMode && isSelected && (
                    <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        defaultValue={multiplier}
                        onChange={(e) => onSizeChange(parseFloat(e.target.value))}
                        className="w-10 h-1 mt-1 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    />
                )}
                {editMode && !isSelected && <Move className="w-3 h-3 opacity-50 mt-0.5" />}
            </div>
            {isReserved && !editMode && (
                <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-primary rounded-full border-2 border-background" />
            )}
        </div>
    );
}

export default function FloorPlanView({ tables, getTableReservation, onTableClick }) {
    const queryClient = useQueryClient();
    const canvasRef = useRef(null);
    const [selectedTableId, setSelectedTableId] = useState(null);
    const [positions, setPositions] = useState({});
    const positionsRef = useRef({});
    const [editMode, setEditMode] = useState(false);
    const [zoom, setZoom] = useState(1.2);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const touchRef = useRef({ startDistance: 0, startZoom: 1.2 });

    // Hole den Grundriss aus dem ersten aktiven Layout
    const { data: layouts = [] } = useQuery({
        queryKey: ['seating-layout'],
        queryFn: () => base44.entities.SeatingLayout.filter({ is_active: true })
    });
    const floorPlan = layouts[0];

    const tableIds = tables.map(t => t.id).join(',');

    // Initialize positions from table data whenever the table list changes
    useEffect(() => {
        const init = {};
        tables.forEach((t, i) => {
            init[t.id] = {
                x: t.position_x ?? getDefaultPosition(i, tables.length).x,
                y: t.position_y ?? getDefaultPosition(i, tables.length).y
            };
        });
        positionsRef.current = init;
        setPositions({ ...init });
        setSelectedTableId(null);
        
        // Zentrieren und Pan zurücksetzen
        setZoom(1.2);
        setPan({ x: 0, y: 0 });
    }, [tableIds]);

    const updateMutation = useMutation({
        mutationFn: ({ id, position_x, position_y, size_multiplier }) =>
            base44.entities.Table.update(id, { position_x, position_y, size_multiplier }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tables'] })
    });

    const handleDragStart = (e, tableId) => {
        if (!editMode) return;
        e.preventDefault();
        e.stopPropagation();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const isTouch = e.type === 'touchstart';
        const getClientPos = (ev) => isTouch
            ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
            : { x: ev.clientX, y: ev.clientY };

        const startPos = getClientPos(e);
        const origPos = { ...positionsRef.current[tableId] };
        const rect = canvas.getBoundingClientRect();
        let hasMoved = false;

        const onMove = (mv) => {
            mv.preventDefault();
            const cur = getClientPos(mv);
            // Berechne die Delta basierend auf Canvas-Position und Zoom
            const dx = (cur.x - startPos.x) / zoom;
            const dy = (cur.y - startPos.y) / zoom;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;

            // Snap to 10px Grid
            const GRID = 10;
            let newX = origPos.x + dx;
            let newY = origPos.y + dy;
            newX = Math.round(newX / GRID) * GRID;
            newY = Math.round(newY / GRID) * GRID;

            // Bounds checking
            newX = Math.max(30, Math.min(1200, newX));
            newY = Math.max(30, Math.min(2000, newY));

            positionsRef.current[tableId] = { x: newX, y: newY };
            setPositions(prev => ({ ...prev, [tableId]: { x: newX, y: newY } }));
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);

            if (hasMoved) {
                const pos = positionsRef.current[tableId];
                updateMutation.mutate({
                    id: tableId,
                    position_x: Math.round(pos.x),
                    position_y: Math.round(pos.y)
                });
            }
        };

        if (isTouch) {
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        } else {
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        }
    };

    const today = format(new Date(), 'EEEE, d. MMMM', { locale: de });

    const handleWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 5));
    };

    const handleMouseDown = (e) => {
        if (e.button !== 2 && !editMode) { // Rechtsklick zum Pan
            setIsPanning(true);
            panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        }
    };

    const handleMouseMove = (e) => {
        if (isPanning && !editMode) {
            setPan({
                x: e.clientX - panStartRef.current.x,
                y: e.clientY - panStartRef.current.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    const getTouchDistance = (touches) => {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    };

    const handleTouchStart = (e) => {
        if (e.touches.length === 2 && !editMode) {
            // Pinch-to-zoom
            e.preventDefault();
            touchRef.current.startDistance = getTouchDistance(e.touches);
            touchRef.current.startZoom = zoom;
        } else if (e.touches.length === 1 && !editMode) {
            // Single touch pan
            setIsPanning(true);
            panStartRef.current = {
                x: e.touches[0].clientX - pan.x,
                y: e.touches[0].clientY - pan.y
            };
        }
    };

    const handleTouchMove = (e) => {
        if (e.touches.length === 2 && !editMode) {
            // Pinch-to-zoom
            e.preventDefault();
            const currentDistance = getTouchDistance(e.touches);
            const scale = currentDistance / touchRef.current.startDistance;
            const newZoom = Math.min(Math.max(touchRef.current.startZoom * scale, 0.5), 5);
            setZoom(newZoom);
        } else if (e.touches.length === 1 && isPanning && !editMode) {
            // Single touch pan
            e.preventDefault();
            setPan({
                x: e.touches[0].clientX - panStartRef.current.x,
                y: e.touches[0].clientY - panStartRef.current.y
            });
        }
    };

    const handleTouchEnd = () => {
        setIsPanning(false);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    {editMode ? (
                        <p className="text-xs text-status-warn flex items-center gap-1.5">
                            <Move className="w-3.5 h-3.5" />
                            Bearbeitungsmodus: Tische per Drag verschieben (Snap-to-Grid). PDF bleibt als Referenz.
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">Auf Tisch klicken für Details. Zoomen: Scrollrad (Desktop) oder zwei Finger (Handy). Verschieben: Mitteltaste (Desktop) oder ein Finger (Handy).</p>
                    )}
                    <Button
                        size="sm"
                        variant={editMode ? 'default' : 'outline'}
                        className={cn("gap-1.5 text-xs h-7", editMode && "bg-status-warn/70 hover:bg-status-warn/70 text-foreground")}
                        onClick={() => setEditMode(v => !v)}
                    >
                        {editMode ? <><Check className="w-3.5 h-3.5" /> Fertig</> : <><Pencil className="w-3.5 h-3.5" /> Layout bearbeiten</>}
                    </Button>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="text-foreground font-medium">{today}</span>
                    {!editMode && <>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-primary/60 border border-primary/70 inline-block" />
                            Frei
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-primary/60 border border-primary inline-block" />
                            Reserviert
                        </span>
                    </>}
                </div>
            </div>
            <div
                ref={canvasRef}
                className={cn(
                    "relative w-full bg-card border rounded-xl overflow-hidden touch-none",
                    editMode ? "border-status-warn/50 border-2" : "border-border",
                    isPanning && "cursor-grabbing"
                )}
                style={{ height: '600px' }}
                onClick={() => !editMode && setSelectedTableId(null)}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Container für Grundriss und Tische mit gemeinsamer Transformation */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'top left'
                    }}
                >
                    {/* Grundriss als Hintergrund */}
                    {floorPlan?.floor_plan_url && (
                        <img
                            src={floorPlan.floor_plan_url}
                            alt="Grundriss"
                            className="absolute inset-0 w-full h-full object-contain opacity-40 pointer-events-none"
                        />
                    )}

                    <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
                        <defs>
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--foreground))" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>

                    {tables.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                            Keine Tische in diesem Raum. Bitte zuerst Tische anlegen.
                        </div>
                    )}

                    {tables.map((table) => {
                        const pos = positions[table.id];
                        if (!pos) return null;
                        const reservation = getTableReservation(table.id);
                        return (
                            <TableShape
                                key={table.id}
                                table={table}
                                posX={pos.x}
                                posY={pos.y}
                                isReserved={!!reservation}
                                isSelected={selectedTableId === table.id}
                                editMode={editMode}
                                onMouseDown={(e) => handleDragStart(e, table.id)}
                                onTouchStart={(e) => handleDragStart(e, table.id)}
                                onSizeChange={(multiplier) => {
                                    updateMutation.mutate({
                                        id: table.id,
                                        position_x: Math.round(pos.x),
                                        position_y: Math.round(pos.y),
                                        size_multiplier: multiplier
                                    });
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!editMode) {
                                        setSelectedTableId(table.id);
                                        onTableClick(table);
                                    } else {
                                        setSelectedTableId(table.id);
                                    }
                                }}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}