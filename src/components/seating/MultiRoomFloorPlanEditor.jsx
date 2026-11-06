import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MultiRoomFloorPlanEditor({ onTableSelect = null }) {
    const [pdfImage, setPdfImage] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [tablePositions, setTablePositions] = useState({});
    const [draggingTable, setDraggingTable] = useState(null);
    const [unsavedChanges, setUnsavedChanges] = useState(false);
    const queryClient = useQueryClient();

    // Lade erste PDF-basierte Seating Layout als Master-PDF
    const { data: masterLayout } = useQuery({
        queryKey: ['master-seating-layout'],
        queryFn: async () => {
            const layouts = await base44.entities.SeatingLayout.filter({});
            return layouts.find(l => l.floor_plan_url?.toLowerCase().endsWith('.pdf')) || layouts[0];
        }
    });

    // Lade alle Tische aus allen Räumen
    const { data: allTables = [] } = useQuery({
        queryKey: ['all-tables'],
        queryFn: () => base44.entities.Table.filter({ is_active: true })
    });

    // PDF zu Bild konvertieren
    useEffect(() => {
        if (!masterLayout?.floor_plan_url) return;

        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const renderPdf = async () => {
            try {
                setPdfLoading(true);
                const pdf = await pdfjsLib.getDocument(masterLayout.floor_plan_url).promise;
                const page = await pdf.getPage(1);
                
                const viewport = page.getViewport({ scale: 2 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({ canvasContext: context, viewport }).promise;
                setPdfImage(canvas.toDataURL('image/png'));
            } catch (error) {
                console.error('PDF rendering failed:', error);
            } finally {
                setPdfLoading(false);
            }
        };

        renderPdf();
    }, [masterLayout?.floor_plan_url]);

    // Initialisiere Tischpositionen aus bestehenden Layouts
    useEffect(() => {
        const positions = {};
        
        // Wenn ein Master Layout existiert, nutze dessen Positionen
        if (masterLayout?.tables && masterLayout.tables.length > 0) {
            masterLayout.tables.forEach(layoutTable => {
                const tableData = allTables.find(t => t.id === layoutTable.table_id);
                if (tableData) {
                    positions[layoutTable.table_id] = {
                        x: layoutTable.x,
                        y: layoutTable.y,
                        tableId: layoutTable.table_id,
                        tableNumber: layoutTable.table_number,
                        room: tableData.room,
                        capacity: tableData.capacity
                    };
                }
            });
        }
        
        // Füge fehlende Tische hinzu
        allTables.forEach(table => {
            if (!positions[table.id]) {
                positions[table.id] = {
                    x: table.position_x || Math.random() * 800,
                    y: table.position_y || Math.random() * 600,
                    tableId: table.id,
                    tableNumber: table.table_number,
                    room: table.room,
                    capacity: table.capacity
                };
            }
        });
        
        setTablePositions(positions);
    }, [allTables, masterLayout]);

    const handleTableMouseDown = (e, tableId) => {
        e.preventDefault();
        setDraggingTable(tableId);
    };

    const handleMouseMove = (e) => {
        if (!draggingTable) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setTablePositions(prev => ({
            ...prev,
            [draggingTable]: {
                ...prev[draggingTable],
                x: Math.max(0, Math.min(x, rect.width)),
                y: Math.max(0, Math.min(y, rect.height))
            }
        }));
        setUnsavedChanges(true);
    };

    const handleMouseUp = () => {
        setDraggingTable(null);
    };

    // Speichere Positionen
    const saveMutation = useMutation({
        mutationFn: async () => {
            for (const [tableId, pos] of Object.entries(tablePositions)) {
                const table = allTables.find(t => t.id === tableId);
                if (table) {
                    await base44.entities.Table.update(tableId, {
                        position_x: Math.round(pos.x),
                        position_y: Math.round(pos.y)
                    });
                }
            }
        },
        onSuccess: () => {
            setUnsavedChanges(false);
            queryClient.invalidateQueries({ queryKey: ['all-tables'] });
        }
    });

    if (!masterLayout?.floor_plan_url) {
        return (
            <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
                Keine PDF-basierte Grundrissvorlage konfiguriert
            </div>
        );
    }

    return (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                    {onTableSelect ? 'Tisch wählen' : 'Alle Tische auf Grundriss platzieren'}
                </h3>
                <div className="flex gap-2">
                    {!onTableSelect && (
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={!unsavedChanges || saveMutation.isPending}
                            className="gap-2"
                        >
                            <Save className="w-4 h-4" />
                            Speichern
                        </Button>
                    )}
                </div>
            </div>

            {pdfLoading && (
                <div className="text-center py-8 text-muted-foreground">PDF wird geladen...</div>
            )}

            <div
                className="relative bg-card border border-border rounded-lg overflow-hidden cursor-grab active:cursor-grabbing"
                style={{
                    height: '800px',
                    backgroundImage: pdfImage ? `url(${pdfImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {/* Tische mit absoluten Positionen */}
                {Object.entries(tablePositions).map(([tableId, pos]) => (
                    <button
                        key={tableId}
                        onMouseDown={(e) => {
                            if (onTableSelect) return; // Kein Drag wenn Auswahlmodus aktiv
                            handleTableMouseDown(e, tableId);
                        }}
                        onClick={() => {
                            if (onTableSelect) {
                                onTableSelect(pos.tableNumber);
                            }
                        }}
                        className={cn(
                            'absolute w-12 h-12 rounded-lg flex items-center justify-center text-xs font-bold transition-all shadow-md border-2',
                            onTableSelect
                                ? 'bg-status-warn/70 border-status-warn/70 hover:bg-status-warn/70 hover:scale-110 cursor-pointer'
                                : draggingTable === tableId
                                    ? 'bg-primary/70 border-primary/70 z-50 scale-110'
                                    : 'bg-status-ok/80 border-status-ok/70 hover:bg-status-ok/70 hover:scale-105 cursor-grab active:cursor-grabbing'
                        )}
                        style={{
                            left: `${pos.x}px`,
                            top: `${pos.y}px`,
                            transform: 'translate(-50%, -50%)'
                        }}
                        title={`${pos.tableNumber} (${pos.room}) - ${pos.capacity} Plätze`}
                    >
                        {pos.tableNumber}
                    </button>
                ))}
            </div>

            {!onTableSelect && unsavedChanges && (
                <div className="text-sm text-status-warn font-medium">
                    ⚠️ Ungespeicherte Änderungen – bitte Speichern klicken
                </div>
            )}
        </div>
    );
}