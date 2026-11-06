import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import FloorPlanViewer from './FloorPlanViewer';
import { Badge } from '@/components/ui/badge';

export default function ReservationTableSelector({ open, onClose, roomName, guestCount, onTablesSelected }) {
    const [selectedTableIds, setSelectedTableIds] = useState([]);

    const { data: rooms = [] } = useQuery({
        queryKey: ['rooms'],
        queryFn: () => base44.entities.Room.list()
    });

    const { data: tables = [] } = useQuery({
        queryKey: ['tables', roomName],
        queryFn: () => base44.entities.Table.filter({ room: roomName, is_active: true }),
        enabled: !!roomName
    });

    const { data: layout } = useQuery({
        queryKey: ['seating-layout', roomName],
        queryFn: async () => {
            const layouts = await base44.entities.SeatingLayout.filter({ room_name: roomName });
            return layouts[0] || null;
        },
        enabled: !!roomName
    });

    const selectedTables = tables.filter(t => selectedTableIds.includes(t.id));
    const totalCapacity = selectedTables.reduce((sum, t) => sum + t.capacity, 0);
    const minCapacity = selectedTables.reduce((sum, t) => sum + (t.capacity - (t.tolerance || 0)), 0);
    const isValid = guestCount >= minCapacity && guestCount <= totalCapacity + selectedTables.reduce((sum, t) => sum + (t.tolerance || 0), 0);

    const handleTableSelect = (tableId) => {
        setSelectedTableIds(prev =>
            prev.includes(tableId)
                ? prev.filter(id => id !== tableId)
                : [...prev, tableId]
        );
    };

    const handleConfirm = () => {
        if (selectedTables.length === 0) {
            alert('Bitte wähle mindestens einen Tisch aus');
            return;
        }
        
        onTablesSelected(selectedTables);
        setSelectedTableIds([]);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Tische für {guestCount} Personen wählen</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Floor Plan */}
                    {layout?.floor_plan_url && (
                        <div className="space-y-2">
                            <Label>Tischplan</Label>
                            <FloorPlanViewer
                                floorPlanUrl={layout.floor_plan_url}
                                tablePositions={layout.tables || []}
                                selectedTableIds={selectedTableIds}
                                onTableSelect={handleTableSelect}
                            />
                        </div>
                    )}

                    {/* Ausgewählte Tische */}
                    {selectedTables.length > 0 && (
                        <div className="space-y-2">
                            <Label>Ausgewählte Tische</Label>
                            <div className="flex flex-wrap gap-2">
                                {selectedTables.map(table => (
                                    <Badge key={table.id} variant="secondary" className="text-base py-2 px-3">
                                        Tisch {table.table_number} ({table.capacity}P)
                                        <button
                                            type="button"
                                            onClick={() => handleTableSelect(table.id)}
                                            className="ml-2 hover:opacity-70"
                                        >
                                            ✕
                                        </button>
                                    </Badge>
                                ))}
                            </div>

                            {/* Kapazität Info */}
                            <div className="text-sm space-y-1 bg-card p-3 rounded">
                                <div className="flex justify-between">
                                    <span>Anfrage:</span>
                                    <span className="font-medium">{guestCount} Personen</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Kapazität (min-max):</span>
                                    <span className={isValid ? 'text-status-ok font-medium' : 'text-status-danger font-medium'}>
                                        {minCapacity} - {totalCapacity + selectedTables.reduce((sum, t) => sum + (t.tolerance || 0), 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Aktionen */}
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} className="flex-1">
                            Abbrechen
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={selectedTables.length === 0 || !isValid}
                            className="flex-1"
                        >
                            Tische bestätigen
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}