import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export default function FloorPlanViewer({ floorPlanUrl, tablePositions, selectedTableIds = [], onTableSelect, readOnly = false }) {
    const [hoveredTable, setHoveredTable] = useState(null);

    const getTableColor = (tableId, isSelected, isHovered) => {
        if (isSelected) return 'bg-status-warn/70 text-white ring-2 ring-offset-2 ring-status-warn/70';
        if (isHovered) return 'bg-primary/70 text-white';
        return 'bg-primary/70 text-white';
    };

    return (
        <div className="relative bg-card border-2 border-border rounded-lg overflow-hidden" style={{ height: '500px' }}>
            {floorPlanUrl && (
                <img
                    src={floorPlanUrl}
                    alt="Grundriss"
                    className="w-full h-full object-contain"
                />
            )}

            {/* Tische */}
            {tablePositions.map(tp => {
                const isSelected = selectedTableIds.includes(tp.table_id);
                const isHovered = hoveredTable === tp.table_id;

                return (
                    <button
                        key={tp.table_id}
                        type="button"
                        onClick={() => !readOnly && onTableSelect?.(tp.table_id)}
                        onMouseEnter={() => setHoveredTable(tp.table_id)}
                        onMouseLeave={() => setHoveredTable(null)}
                        disabled={readOnly}
                        className={cn(
                            "absolute w-12 h-12 rounded flex items-center justify-center text-xs font-bold transition-all",
                            getTableColor(tp.table_id, isSelected, isHovered),
                            !readOnly && "cursor-pointer hover:scale-110"
                        )}
                        style={{
                            left: `${tp.x}px`,
                            top: `${tp.y}px`,
                            transform: `translate(-50%, -50%) rotate(${tp.rotation}deg)`
                        }}
                    >
                        {tp.table_number}
                    </button>
                );
            })}
        </div>
    );
}