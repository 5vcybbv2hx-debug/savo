import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function TableGrid({ tables, reservations, getTableReservation, onTableClick }) {
    return (
        <div className="bg-card rounded-2xl border border-border p-8 min-h-96 overflow-auto">
            <div className="relative w-full h-full" style={{ minHeight: '600px' }}>
                {tables.length === 0 ? (
                    <div className="flex items-center justify-center h-96 text-muted-foreground">
                        Keine Tische definiert
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-6 p-4">
                        {tables.map(table => {
                            const reservation = getTableReservation(table.id);
                            const shape = table.shape || 'square';
                            
                            let shapeClasses = "relative border-2 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer";
                            
                            if (shape === 'square') {
                                shapeClasses += " w-32 h-32 rounded-xl";
                            } else if (shape === 'rectangle_horizontal') {
                                shapeClasses += " w-40 h-28 rounded-lg";
                            } else if (shape === 'rectangle_vertical') {
                                shapeClasses += " w-28 h-40 rounded-lg";
                            } else if (shape === 'round') {
                                shapeClasses += " w-32 h-32 rounded-full";
                            }

                            return (
                                <button
                                    key={table.id}
                                    onClick={() => onTableClick(table)}
                                    className={cn(
                                        shapeClasses,
                                        reservation
                                            ? "bg-status-warn/20 border-status-warn/70 hover:bg-status-warn/30"
                                            : "bg-status-ok/20 border-status-ok/70 hover:bg-status-ok/30"
                                    )}
                                >
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-foreground">
                                            {table.table_number}
                                        </div>
                                        {table.name && (
                                            <div className="text-xs font-medium text-foreground/70 mt-0.5">
                                                {table.name}
                                            </div>
                                        )}
                                        <div className="text-sm text-muted-foreground mt-1">
                                            {table.capacity} Plätze
                                        </div>
                                        {reservation && (
                                            <div className="text-xs text-status-warn mt-2 font-semibold">
                                                Reserviert
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}