import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { AlertCircle, Save, Trash2, Check, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROOM_SHAPES = [
    {
        key: 'rectangle',
        label: 'Rechteckig',
        svg: (
            <rect x="4" y="8" width="40" height="32" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        )
    },
    {
        key: 'l_shape',
        label: 'L-förmig',
        svg: (
            <path d="M4 8 L4 40 L36 40 L36 28 L20 28 L20 8 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        )
    },
    {
        key: 'u_shape',
        label: 'U-förmig',
        svg: (
            <path d="M4 8 L4 40 L16 40 L16 24 L32 24 L32 40 L44 40 L44 8 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        )
    }
];

function calculatePositions(tables, roomShape, spacing, canvasW = 560, canvasH = 380) {
    if (tables.length === 0) return {};
    const pad = 50;

    if (roomShape === 'rectangle') {
        const cols = Math.ceil(Math.sqrt(tables.length));
        return Object.fromEntries(tables.map((t, i) => [
            t.id,
            {
                x: pad + (i % cols) * spacing,
                y: pad + Math.floor(i / cols) * spacing
            }
        ]));
    }

    if (roomShape === 'l_shape') {
        // Vertical arm (left column), then horizontal arm (bottom row)
        const vertCount = Math.ceil(tables.length * 0.5);
        const horizCount = tables.length - vertCount;
        const result = {};
        tables.slice(0, vertCount).forEach((t, i) => {
            result[t.id] = { x: pad, y: pad + i * spacing };
        });
        tables.slice(vertCount).forEach((t, i) => {
            result[t.id] = { x: pad + (i + 1) * spacing, y: pad + (vertCount - 1) * spacing };
        });
        return result;
    }

    if (roomShape === 'u_shape') {
        // Left arm, bottom row, right arm
        const armCount = Math.ceil(tables.length / 3);
        const bottomCount = tables.length - armCount * 2;
        const result = {};
        let idx = 0;
        tables.slice(0, armCount).forEach((t, i) => {
            result[t.id] = { x: pad, y: pad + i * spacing };
            idx++;
        });
        tables.slice(armCount, armCount + Math.max(0, bottomCount)).forEach((t, i) => {
            result[t.id] = { x: pad + (i + 1) * spacing, y: pad + (armCount - 1) * spacing };
            idx++;
        });
        tables.slice(idx).forEach((t, i) => {
            result[t.id] = { x: pad + (Math.max(0, bottomCount) + 1) * spacing, y: pad + (armCount - 1 - i) * spacing };
        });
        return result;
    }

    return {};
}

function TableSVG({ table, pos }) {
    const isRound = table.shape === 'round';
    const isH = table.shape === 'rectangle_horizontal';
    const isV = table.shape === 'rectangle_vertical';
    const w = isH ? 48 : isV ? 28 : 36;
    const h = isV ? 48 : isH ? 28 : 36;

    return isRound ? (
        <>
            <circle cx={pos.x} cy={pos.y} r={18} fill="rgba(59,130,246,0.25)" stroke="rgb(59,130,246)" strokeWidth="2" />
            <text x={pos.x} y={pos.y} textAnchor="middle" dy="0.35em" fontSize="11" fill="rgb(219,234,254)" fontWeight="bold">{table.table_number}</text>
        </>
    ) : (
        <>
            <rect x={pos.x - w / 2} y={pos.y - h / 2} width={w} height={h} rx="4" fill="rgba(59,130,246,0.25)" stroke="rgb(59,130,246)" strokeWidth="2" />
            <text x={pos.x} y={pos.y} textAnchor="middle" dy="0.35em" fontSize="11" fill="rgb(219,234,254)" fontWeight="bold">{table.table_number}</text>
        </>
    );
}

export default function LayoutSuggestion({ room, tables, onClose, open }) {
    const queryClient = useQueryClient();
    const svgRef = useRef(null);
    const [spacing, setSpacing] = useState(90);
    const [roomShape, setRoomShape] = useState(room.room_shape || 'rectangle');
    const [overrides, setOverrides] = useState({});
    const [variantName, setVariantName] = useState('');
    const [savedVariants, setSavedVariants] = useState(room.layout_variants || []);

    const roomTables = useMemo(() => tables.filter(t => t.room === room.name), [tables, room]);

    const basePositions = useMemo(
        () => calculatePositions(roomTables, roomShape, spacing),
        [roomTables, roomShape, spacing]
    );

    const positions = useMemo(() => {
        const result = { ...basePositions };
        Object.entries(overrides).forEach(([id, pos]) => { result[id] = pos; });
        return result;
    }, [basePositions, overrides]);

    const updateTablesMutation = useMutation({
        mutationFn: (updates) => Promise.all(updates.map(({ id, x, y }) =>
            base44.entities.Table.update(id, { position_x: Math.round(x), position_y: Math.round(y) })
        )),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tables'] });
            onClose();
        }
    });

    const updateRoomMutation = useMutation({
        mutationFn: (data) => base44.entities.Room.update(room.id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] })
    });

    const handleDragStart = (e, tableId) => {
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        const startPos = positions[tableId];

        const handleMove = (mv) => {
            const rect = svg.getBoundingClientRect();
            const scaleX = 560 / rect.width;
            const scaleY = 380 / rect.height;
            const x = (mv.clientX - rect.left) * scaleX;
            const y = (mv.clientY - rect.top) * scaleY;
            setOverrides(prev => ({ ...prev, [tableId]: { x: Math.max(20, Math.min(540, x)), y: Math.max(20, Math.min(360, y)) } }));
        };
        const handleUp = () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    };

    const handleApply = () => {
        // Also save room_shape
        updateRoomMutation.mutate({ room_shape: roomShape });
        updateTablesMutation.mutate(
            roomTables.map(t => ({ id: t.id, ...positions[t.id] }))
        );
    };

    const handleSaveVariant = () => {
        if (!variantName.trim()) return;
        const newVariant = {
            name: variantName.trim(),
            positions: roomTables.map(t => ({ table_id: t.id, ...positions[t.id] }))
        };
        const updated = [...savedVariants.filter(v => v.name !== newVariant.name), newVariant];
        setSavedVariants(updated);
        updateRoomMutation.mutate({ room_shape: roomShape, layout_variants: updated });
        setVariantName('');
    };

    const handleLoadVariant = (variant) => {
        const newOverrides = {};
        variant.positions.forEach(p => {
            newOverrides[p.table_id] = { x: p.x, y: p.y };
        });
        setOverrides(newOverrides);
    };

    const handleDeleteVariant = (name) => {
        const updated = savedVariants.filter(v => v.name !== name);
        setSavedVariants(updated);
        updateRoomMutation.mutate({ layout_variants: updated });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Layout-Assistent: {room.name}</DialogTitle>
                </DialogHeader>

                {roomTables.length === 0 ? (
                    <div className="flex items-center gap-3 p-4 bg-status-warn/10 border border-status-warn/30 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-status-warn" />
                        <p className="text-sm text-status-warn">Keine Tische in diesem Raum vorhanden</p>
                    </div>
                ) : (
                    <div className="space-y-5">

                        {/* Room shape */}
                        <div>
                            <label className="text-sm font-medium text-foreground mb-2 block">Raumform</label>
                            <div className="grid grid-cols-3 gap-3">
                                {ROOM_SHAPES.map(s => (
                                    <button
                                        key={s.key}
                                        onClick={() => { setRoomShape(s.key); setOverrides({}); }}
                                        className={cn(
                                            'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                                            roomShape === s.key
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border text-muted-foreground hover:border-primary/50'
                                        )}
                                    >
                                        <svg viewBox="0 0 48 48" width="48" height="48">{s.svg}</svg>
                                        <span className="text-xs font-medium">{s.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Spacing */}
                        <div>
                            <label className="text-sm font-medium text-foreground mb-2 block">
                                Tischabstand: {spacing}px
                            </label>
                            <Slider
                                value={[spacing]}
                                onValueChange={([v]) => { setSpacing(v); setOverrides({}); }}
                                min={55} max={160} step={5}
                            />
                        </div>

                        {/* Canvas */}
                        <div className="border border-border rounded-xl overflow-hidden bg-card">
                            <svg
                                ref={svgRef}
                                viewBox="0 0 560 380"
                                className="w-full"
                                style={{ display: 'block' }}
                            >
                                <defs>
                                    <pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse">
                                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--foreground))" strokeWidth="0.3" opacity="0.2" />
                                    </pattern>
                                </defs>
                                <rect width="560" height="380" fill="url(#grid2)" />
                                {roomTables.map(table => {
                                    const pos = positions[table.id];
                                    if (!pos) return null;
                                    return (
                                        <g
                                            key={table.id}
                                            style={{ cursor: 'grab' }}
                                            onMouseDown={(e) => handleDragStart(e, table.id)}
                                        >
                                            <TableSVG table={table} pos={pos} />
                                        </g>
                                    );
                                })}
                            </svg>
                            <p className="text-xs text-muted-foreground text-center py-1 border-t border-border/50">
                                Tische per Drag anpassen
                            </p>
                        </div>

                        {/* Variants */}
                        <div>
                            <label className="text-sm font-medium text-foreground mb-2 block">Layout-Varianten</label>
                            {savedVariants.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {savedVariants.map(v => (
                                        <div key={v.name} className="flex items-center gap-1 bg-secondary rounded-lg px-2 py-1">
                                            <button
                                                onClick={() => handleLoadVariant(v)}
                                                className="text-sm text-foreground hover:text-primary"
                                            >
                                                <LayoutGrid className="h-3 w-3 inline mr-1" />
                                                {v.name}
                                            </button>
                                            <button onClick={() => handleDeleteVariant(v.name)} className="ml-1 text-muted-foreground hover:text-destructive">
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Input
                                    value={variantName}
                                    onChange={(e) => setVariantName(e.target.value)}
                                    placeholder="Varianten-Name (z.B. Sommeraufstellung)"
                                    className="bg-background border-border"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveVariant()}
                                />
                                <Button onClick={handleSaveVariant} variant="outline" disabled={!variantName.trim()}>
                                    <Save className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <Button type="button" onClick={onClose} variant="outline" className="flex-1">
                                Abbrechen
                            </Button>
                            <Button
                                onClick={handleApply}
                                className="flex-1 bg-primary hover:bg-primary/90"
                                disabled={updateTablesMutation.isPending}
                            >
                                <Check className="h-4 w-4 mr-2" />
                                {updateTablesMutation.isPending ? 'Speichert...' : 'Layout auf Tische anwenden'}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}