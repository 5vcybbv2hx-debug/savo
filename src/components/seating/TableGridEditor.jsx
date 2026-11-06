import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const GRID_COLS = 16;
const GRID_ROWS = 12;
const CELL_SIZE = 50; // px

export default function TableGridEditor({ roomId, roomName }) {
    const queryClient = useQueryClient();
    const [selectedTableId, setSelectedTableId] = useState(null);

    // Fetch all tables for this room
    const { data: tables = [] } = useQuery({
        queryKey: ['tables', roomId],
        queryFn: () => base44.entities.Table.filter({ room: roomName })
    });

    // Map tables to their grid positions
    const tablesByPosition = useMemo(() => {
        const map = {};
        tables.forEach(t => {
            if (t.position_x !== undefined && t.position_y !== undefined) {
                const col = Math.floor(t.position_x / CELL_SIZE);
                const row = Math.floor(t.position_y / CELL_SIZE);
                map[`${col}-${row}`] = t;
            }
        });
        return map;
    }, [tables]);

    const unplacedTables = tables.filter(t => t.position_x === undefined || t.position_y === undefined);

    const updateTableMutation = useMutation({
        mutationFn: ({ tableId, position_x, position_y }) =>
            base44.entities.Table.update(tableId, { position_x, position_y }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tables', roomId] });
        }
    });

    const deleteTableMutation = useMutation({
        mutationFn: (tableId) => base44.entities.Table.delete(tableId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tables', roomId] });
            setSelectedTableId(null);
        }
    });

    const handleCellClick = (col, row) => {
        if (selectedTableId && !tablesByPosition[`${col}-${row}`]) {
            updateTableMutation.mutate({
                tableId: selectedTableId,
                position_x: col * CELL_SIZE,
                position_y: row * CELL_SIZE
            });
            setSelectedTableId(null);
        }
    };

    const handleDeleteTable = (tableId) => {
        if (confirm('Tisch wirklich löschen?')) {
            deleteTableMutation.mutate(tableId);
        }
    };

    const getTableColor = (table) => {
        if (table.color) return table.color;
        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
        const idx = tables.indexOf(table) % colors.length;
        return colors[idx];
    };

    return (
        <div className="space-y-4">
            {/* Grid Editor */}
            <Card className="p-4 overflow-x-auto">
                <div className="inline-block border border-border rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-2">
                    <div
                        className="grid gap-0.5 bg-muted dark:bg-surface p-1 rounded"
                        style={{
                            gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_SIZE}px)`,
                            gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL_SIZE}px)`
                        }}
                    >
                        {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
                            const col = idx % GRID_COLS;
                            const row = Math.floor(idx / GRID_COLS);
                            const table = tablesByPosition[`${col}-${row}`];
                            const isSelectable = selectedTableId && !table;

                            return (
                                <button
                                    key={`${col}-${row}`}
                                    onClick={() => handleCellClick(col, row)}
                                    className={cn(
                                        'rounded-md text-xs font-bold text-white transition-all',
                                        table
                                            ? 'shadow-md hover:shadow-lg'
                                            : isSelectable
                                            ? 'bg-status-warn/50 hover:bg-status-warn/70 border-2 border-dashed border-status-warn/70 cursor-pointer'
                                            : 'bg-card dark:bg-surface hover:bg-muted dark:hover:bg-surface cursor-default'
                                    )}
                                    style={table ? { backgroundColor: getTableColor(table) } : {}}
                                    title={table ? `Tisch ${table.table_number}` : ''}
                                >
                                    {table && <span>{table.table_number}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 max-w-sm">
                    {selectedTableId
                        ? 'Klicke auf ein leeres Feld, um den Tisch zu platzieren'
                        : 'Wähle einen Tisch aus der Liste, um ihn zu platzieren'}
                </p>
            </Card>

            {/* Unplaced Tables */}
            {unplacedTables.length > 0 && (
                <Card className="p-4 border-status-warn/50 bg-status-warn/15 dark:bg-status-warn/30">
                    <h4 className="font-semibold text-sm mb-3 text-status-warn dark:text-status-warn">
                        Nicht platzierte Tische ({unplacedTables.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {unplacedTables.map(table => (
                            <button
                                key={table.id}
                                onClick={() => setSelectedTableId(selectedTableId === table.id ? null : table.id)}
                                className={cn(
                                    'px-3 py-2 rounded-lg text-sm font-medium transition-all border-2',
                                    selectedTableId === table.id
                                        ? 'bg-status-warn/70 text-white border-status-warn/70 shadow-lg'
                                        : 'bg-card dark:bg-surface text-foreground border-status-warn/25 dark:border-status-warn/70 hover:bg-status-warn/15 dark:hover:bg-status-warn/30'
                                )}
                            >
                                {table.table_number} ({table.capacity}P)
                            </button>
                        ))}
                    </div>
                </Card>
            )}

            {/* Placed Tables List */}
            {tables.length > 0 && (
                <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-3">Alle Tische ({tables.length})</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {tables.map(table => {
                            const col = Math.floor((table.position_x || 0) / CELL_SIZE);
                            const row = Math.floor((table.position_y || 0) / CELL_SIZE);
                            const isPlaced = table.position_x !== undefined && table.position_y !== undefined;

                            return (
                                <div
                                    key={table.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-card dark:bg-surface text-sm"
                                >
                                    <div>
                                        <span className="font-medium">Tisch {table.table_number}</span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                            {isPlaced ? `Position: ${col}/${row}` : 'Nicht platziert'}
                                        </span>
                                        {table.section && (
                                            <span className="text-xs text-muted-foreground ml-2">• {table.section}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDeleteTable(table.id)}
                                        className="p-2 rounded-lg text-status-danger hover:bg-status-danger/15 dark:hover:bg-status-danger/30 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}
        </div>
    );
}