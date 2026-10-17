/**
 * SheetMenu — kompaktes Kontext-Menü als Bottom-Sheet (mobile-friendly).
 * Nutzt die bestehende Sheet-Komponente (Radix Dialog).
 *
 * Props:
 *   open, onOpenChange
 *   title (optional)
 *   items: [{ icon, label, onClick, variant: 'default'|'destructive', disabled }]
 */
import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { haptics } from '@/components/utils/haptics';

export default function SheetMenu({ open, onOpenChange, title, items = [] }) {
    const handleSelect = (item) => {
        haptics.selection();
        onOpenChange(false);
        if (item.onClick) item.onClick();
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-2xl pb-8 px-0 pt-0 max-w-md mx-auto">
                {title && (
                    <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
                        <SheetTitle className="text-base">{title}</SheetTitle>
                    </SheetHeader>
                )}
                <div className="py-2">
                    {items.filter(Boolean).map((item, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleSelect(item)}
                            disabled={item.disabled}
                            className={cn(
                                'w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors min-h-[48px]',
                                item.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent/50 active:bg-accent',
                                item.variant === 'destructive' ? 'text-destructive' : 'text-foreground'
                            )}
                        >
                            {item.icon && <item.icon className="w-4 h-4 shrink-0" />}
                            <span className="text-sm font-medium">{item.label}</span>
                        </button>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
}