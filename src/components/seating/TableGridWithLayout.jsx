import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

export default function TableGridWithLayout({ tables, reservations, getTableReservation, onTableClick, roomName }) {
    const [pdfImage, setPdfImage] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(false);

    // Lade das Layout für den aktuellen Raum
    const { data: layout } = useQuery({
        queryKey: ['seating-layout', roomName],
        queryFn: async () => {
            const layouts = await base44.entities.SeatingLayout.filter({ room_name: roomName });
            return layouts[0] || null;
        },
        enabled: !!roomName
    });

    // PDF zu Bild konvertieren
    useEffect(() => {
        if (!layout?.floor_plan_url) return;

        const isPdf = layout.floor_plan_url.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            setPdfImage(null);
            return;
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const renderPdf = async () => {
            try {
                setPdfLoading(true);
                const pdf = await pdfjsLib.getDocument(layout.floor_plan_url).promise;
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
                setPdfImage(null);
            } finally {
                setPdfLoading(false);
            }
        };

        renderPdf();
    }, [layout?.floor_plan_url]);

    const tablePositions = layout?.tables || [];
    const hasLayout = tablePositions.length > 0;
    const backgroundUrl = pdfImage || layout?.floor_plan_url;

    if (!hasLayout) {
        // Fallback zu normalem Grid wenn kein Layout vorhanden
        return (
            <div className="bg-card rounded-2xl border border-border p-8 min-h-96">
                <div className="flex items-center justify-center h-96 text-muted-foreground">
                    {tables.length === 0 ? 'Keine Tische definiert' : 'Kein Layout konfiguriert'}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-2xl border border-border p-4 min-h-96 overflow-auto">
            {/* Background-Foto/PDF wenn vorhanden */}
            {backgroundUrl && (
                <div
                    className="relative bg-card border border-border rounded-lg overflow-hidden mb-4"
                    style={{
                        height: '500px',
                        backgroundImage: `url(${backgroundUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                >
                    {/* Tische mit absoluten Positionen */}
                    {tablePositions.map(tp => {
                        const table = tables.find(t => t.id === tp.table_id);
                        if (!table) return null;

                        const reservation = getTableReservation(table.id);
                        const shape = table.shape || 'square';

                        let sizeClasses = 'w-12 h-12';
                        if (shape === 'rectangle_horizontal') {
                            sizeClasses = 'w-16 h-10';
                        } else if (shape === 'rectangle_vertical') {
                            sizeClasses = 'w-10 h-16';
                        } else if (shape === 'round') {
                            sizeClasses = 'w-12 h-12 rounded-full';
                        }

                        return (
                            <button
                                key={tp.table_id}
                                onClick={() => onTableClick(table)}
                                className={cn(
                                    'absolute rounded-lg flex items-center justify-center text-xs font-bold transition-all shadow-md border-2',
                                    sizeClasses,
                                    reservation
                                        ? 'bg-status-warn/80 border-status-warn/70 hover:bg-status-warn/70 text-white'
                                        : 'bg-status-ok/80 border-status-ok/70 hover:bg-status-ok/70 text-white'
                                )}
                                style={{
                                    left: `${tp.x}px`,
                                    top: `${tp.y}px`,
                                    transform: 'translate(-50%, -50%)'
                                }}
                                title={`Tisch ${tp.table_number}${reservation ? ' - Reserviert' : ''}`}
                            >
                                {tp.table_number}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Fallback ohne Foto – einfache Anordnung */}
            {!layout?.floor_plan_url && (
                <div className="relative w-full" style={{ height: '400px' }}>
                    {tablePositions.map(tp => {
                        const table = tables.find(t => t.id === tp.table_id);
                        if (!table) return null;

                        const reservation = getTableReservation(table.id);
                        const shape = table.shape || 'square';

                        let sizeClasses = 'w-16 h-16';
                        if (shape === 'rectangle_horizontal') {
                            sizeClasses = 'w-20 h-12';
                        } else if (shape === 'rectangle_vertical') {
                            sizeClasses = 'w-12 h-20';
                        } else if (shape === 'round') {
                            sizeClasses = 'w-16 h-16 rounded-full';
                        }

                        return (
                            <button
                                key={tp.table_id}
                                onClick={() => onTableClick(table)}
                                className={cn(
                                    'absolute rounded-lg flex items-center justify-center text-xs font-bold transition-all shadow-md border-2',
                                    sizeClasses,
                                    reservation
                                        ? 'bg-status-warn/80 border-status-warn/70 hover:bg-status-warn/70 text-white'
                                        : 'bg-status-ok/80 border-status-ok/70 hover:bg-status-ok/70 text-white'
                                )}
                                style={{
                                    left: `${tp.x}px`,
                                    top: `${tp.y}px`,
                                    transform: 'translate(-50%, -50%)'
                                }}
                                title={`Tisch ${tp.table_number}${reservation ? ' - Reserviert' : ''}`}
                            >
                                {tp.table_number}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}