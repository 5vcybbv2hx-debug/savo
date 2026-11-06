import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, Plus, GripHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VisualFloorPlanEditor({ roomId, roomName, onTablePositionsChange }) {
    const [floorPlanUrl, setFloorPlanUrl] = useState('');
    const [tablePositions, setTablePositions] = useState([]);
    const [draggingTableId, setDraggingTableId] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const canvasRef = useRef(null);
    const queryClient = useQueryClient();

    // Lade vorhandenes Layout
    const { data: layout } = useQuery({
        queryKey: ['seating-layout', roomId],
        queryFn: async () => {
            const layouts = await base44.entities.SeatingLayout.filter({ room_id: roomId });
            return layouts[0] || null;
        },
        enabled: !!roomId
    });

    // Lade verfügbare Tische für diesen Raum
    const { data: tables = [] } = useQuery({
        queryKey: ['tables', roomId],
        queryFn: async () => {
            const allTables = await base44.entities.Table.list();
            return allTables.filter(t => t.room === roomName && t.is_active);
        },
        enabled: !!roomName
    });

    useEffect(() => {
        if (layout?.floor_plan_url) {
            setFloorPlanUrl(layout.floor_plan_url);
            if (layout.tables) {
                setTablePositions(layout.tables);
                onTablePositionsChange?.(layout.tables);
            }
        }
    }, [layout, onTablePositionsChange]);

    const handleFloorPlanUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            setFloorPlanUrl(file_url);
            setImageLoaded(false);
        } catch (error) {
            console.error('Upload fehlgeschlagen:', error);
        }
    };

    const addTableToLayout = (table) => {
        if (tablePositions.some(t => t.table_id === table.id)) return;

        const newPosition = {
            table_id: table.id,
            table_number: table.table_number,
            x: 50 + Math.random() * 300,
            y: 50 + Math.random() * 200
        };

        const updated = [...tablePositions, newPosition];
        setTablePositions(updated);
        onTablePositionsChange?.(updated);
    };

    const updateTablePosition = (tableId, x, y) => {
        const updated = tablePositions.map(t =>
            t.table_id === tableId ? { ...t, x, y } : t
        );
        setTablePositions(updated);
        onTablePositionsChange?.(updated);
    };

    const removeTableFromLayout = (tableId) => {
        const updated = tablePositions.filter(t => t.table_id !== tableId);
        setTablePositions(updated);
        onTablePositionsChange?.(updated);
    };

    const handleMouseDown = (e, tableId) => {
        setDraggingTableId(tableId);
        e.preventDefault();
    };

    const handleMouseMove = (e) => {
        if (!draggingTableId || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width - 40));
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height - 40));

        updateTablePosition(draggingTableId, x, y);
    };

    const handleMouseUp = () => {
        setDraggingTableId(null);
    };

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingTableId]);

    const placedTableIds = tablePositions.map(t => t.table_id);
    const unplacedTables = tables.filter(t => !placedTableIds.includes(t.id));

    return (
        <div className="space-y-4">
            {/* Floor Plan Upload */}
            <div className="space-y-2">
                <label className="block">
                    <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={handleFloorPlanUpload}
                        className="hidden"
                    />
                    <Button variant="outline" className="w-full" asChild>
                        <span><Upload className="w-4 h-4 mr-2" />Raumfoto hochladen</span>
                    </Button>
                </label>
            </div>

            {/* Canvas mit Foto und Tischen */}
            {floorPlanUrl && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Tische platzieren – Drag & Drop</p>
                    <div
                        ref={canvasRef}
                        className="relative bg-surface border-2 border-border rounded-lg overflow-hidden"
                        style={{ height: '400px', cursor: draggingTableId ? 'grabbing' : 'grab' }}
                    >
                        <img
                            src={floorPlanUrl}
                            alt="Raumfoto"
                            className="w-full h-full object-cover"
                            onLoad={() => setImageLoaded(true)}
                        />

                        {imageLoaded && tablePositions.map(tp => {
                            const table = tables.find(t => t.id === tp.table_id);
                            return (
                                <div
                                    key={tp.table_id}
                                    className={cn(
                                        "absolute w-12 h-12 rounded-lg flex flex-col items-center justify-center text-xs font-bold transition-all shadow-lg",
                                        "bg-status-warn/70 text-white hover:bg-status-warn/70",
                                        draggingTableId === tp.table_id && "ring-2 ring-white scale-110"
                                    )}
                                    style={{
                                        left: `${tp.x}px`,
                                        top: `${tp.y}px`,
                                        transform: 'translate(-50%, -50%)',
                                        cursor: 'grab'
                                    }}
                                    onMouseDown={(e) => handleMouseDown(e, tp.table_id)}
                                >
                                    <GripHorizontal className="w-3 h-3 mb-0.5" />
                                    <span>{tp.table_number}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {tablePositions.length} Tisch(e) platziert
                    </p>
                </div>
            )}

            {/* Unplatzierte Tische */}
            {unplacedTables.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Verfügbare Tische</p>
                    <div className="grid grid-cols-2 gap-2">
                        {unplacedTables.map(table => (
                            <button
                                key={table.id}
                                type="button"
                                onClick={() => addTableToLayout(table)}
                                className="p-2 rounded border border-border bg-card hover:bg-accent text-sm transition-all"
                            >
                                <Plus className="w-3 h-3 inline mr-1" />
                                {table.table_number} ({table.capacity}P)
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Platzierte Tische (zum Entfernen) */}
            {tablePositions.length > 0 && (
                <div className="space-y-2 p-3 bg-secondary/30 rounded-lg border border-border">
                    <p className="text-xs font-medium text-muted-foreground">Platzierte Tische entfernen</p>
                    <div className="flex flex-wrap gap-2">
                        {tablePositions.map(tp => (
                            <button
                                key={tp.table_id}
                                onClick={() => removeTableFromLayout(tp.table_id)}
                                className="flex items-center gap-1 px-2 py-1 bg-card border border-border rounded hover:bg-destructive/20 text-xs transition-all"
                            >
                                {tp.table_number}
                                <Trash2 className="w-3 h-3" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}