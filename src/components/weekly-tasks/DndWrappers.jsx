import { useDraggable, useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

/** Droppable calendar column — id is the dateStr (yyyy-MM-dd) */
export function DroppableColumn({ id, children, className, style, ...props }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={cn(className, isOver && 'ring-2 ring-amber-400/40')}
            style={style}
            {...props}
        >
            {children}
        </div>
    );
}

/** Generic draggable wrapper — data carries { type, item } for onDragEnd */
export function DraggableItem({ id, data, children, className, style, onClick, ...props }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={cn(className, isDragging && 'opacity-40')}
            style={style}
            onClick={onClick}
            {...props}
        >
            {children}
        </div>
    );
}