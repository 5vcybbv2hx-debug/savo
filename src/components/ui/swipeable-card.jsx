import React, { useRef, useState } from 'react';
import { Trash2, Edit, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SwipeableCard({ 
    children, 
    onEdit, 
    onDelete, 
    onComplete,
    className,
    editLabel = "Bearbeiten",
    deleteLabel = "Löschen",
    completeLabel = "Erledigen"
}) {
    const [offset, setOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);
    const currentX = useRef(0);

    const handleTouchStart = (e) => {
        startX.current = e.touches[0].clientX;
        setIsDragging(true);
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        currentX.current = e.touches[0].clientX;
        const diff = currentX.current - startX.current;
        setOffset(diff);
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        
        // Swipe left (delete)
        if (offset < -100 && onDelete) {
            if ('vibrate' in navigator) navigator.vibrate(50);
            onDelete();
        }
        // Swipe right (edit or complete)
        else if (offset > 100) {
            if ('vibrate' in navigator) navigator.vibrate(50);
            if (onComplete) {
                onComplete();
            } else if (onEdit) {
                onEdit();
            }
        }
        
        // Reset
        setOffset(0);
    };

    return (
        <div className="relative overflow-hidden">
            {/* Left action (complete/edit) */}
            {(onComplete || onEdit) && (
                <div className={cn(
                    "absolute left-0 top-0 h-full flex items-center px-6 transition-opacity",
                    offset > 50 ? "opacity-100" : "opacity-0",
                    onComplete ? "bg-status-ok/70" : "bg-primary/70"
                )}>
                    {onComplete ? (
                        <>
                            <Check className="w-5 h-5 text-white mr-2" />
                            <span className="text-white font-medium">{completeLabel}</span>
                        </>
                    ) : (
                        <>
                            <Edit className="w-5 h-5 text-white mr-2" />
                            <span className="text-white font-medium">{editLabel}</span>
                        </>
                    )}
                </div>
            )}

            {/* Right action (delete) */}
            {onDelete && (
                <div className={cn(
                    "absolute right-0 top-0 h-full flex items-center px-6 bg-status-danger/70 transition-opacity",
                    offset < -50 ? "opacity-100" : "opacity-0"
                )}>
                    <Trash2 className="w-5 h-5 text-white mr-2" />
                    <span className="text-white font-medium">{deleteLabel}</span>
                </div>
            )}

            {/* Card content */}
            <div
                className={cn(
                    "transition-transform duration-200",
                    className
                )}
                style={{
                    transform: `translateX(${offset}px)`,
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    );
}