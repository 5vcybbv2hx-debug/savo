import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { X, Pencil, Trash2, Clock, Calendar, Tag, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/components/utils/haptics';

export default function ShiftBottomSheet({ shift, open, onClose, onEdit, onDelete, canEdit }) {
    const overlayRef = useRef(null);
    const sheetRef = useRef(null);

    // Close on overlay click
    const handleOverlayClick = (e) => {
        if (e.target === overlayRef.current) onClose();
    };

    // Swipe down to close
    const touchStartY = useRef(null);
    const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
    const handleTouchEnd = (e) => {
        if (touchStartY.current === null) return;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        if (dy > 80) { haptics.selection(); onClose(); }
        touchStartY.current = null;
    };

    if (!shift) return null;

    const dateFormatted = shift.date
        ? format(new Date(shift.date), 'EEEE, d. MMMM yyyy', { locale: de })
        : '';

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className={cn(
                'fixed inset-0 z-50 transition-all duration-300',
                open ? 'bg-black/50 pointer-events-auto' : 'bg-transparent pointer-events-none'
            )}
        >
            <div
                ref={sheetRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className={cn(
                    'absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl shadow-2xl transition-transform duration-300 pb-safe',
                    open ? 'translate-y-0' : 'translate-y-full'
                )}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                            style={{ backgroundColor: shift._color || '#64748b' }}
                        >
                            {shift.employee_name?.charAt(0)}
                        </div>
                        <div>
                            <p className="font-bold text-foreground text-base leading-tight">{shift.employee_name}</p>
                            {shift.shift_type && (
                                <span className="text-xs text-muted-foreground">{shift.shift_type}</span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-accent text-muted-foreground"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Detail rows */}
                <div className="px-4 py-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-foreground">{dateFormatted}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-mono text-foreground">
                            {shift.start_time?.slice(0, 5)} – {shift.end_time?.slice(0, 5)}
                        </span>
                    </div>
                    {shift.shift_type && (
                        <div className="flex items-center gap-3">
                            <Tag className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm text-foreground">{shift.shift_type}</span>
                        </div>
                    )}
                    {shift.notes && (
                        <div className="flex items-start gap-3">
                            <StickyNote className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-muted-foreground italic">{shift.notes}</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                {canEdit && (
                    <div className="flex gap-3 px-4 pb-6">
                        <button
                            onClick={() => { haptics.light(); onDelete(shift.id); }}
                            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors font-medium text-sm"
                        >
                            <Trash2 className="w-4 h-4" />
                            Löschen
                        </button>
                        <button
                            onClick={() => { haptics.light(); onEdit(shift); }}
                            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium text-sm"
                        >
                            <Pencil className="w-4 h-4" />
                            Bearbeiten
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}