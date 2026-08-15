import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useIsMobile } from '@/components/utils/useIsMobile';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * BottomSheetSelect — Mobile-first select that opens as a slide-up
 * Vaul drawer on mobile and falls back to a Radix Select dropdown on desktop.
 *
 * Props:
 *  - value: string | undefined
 *  - onValueChange: (value: string) => void
 *  - options: [{ value, label }]
 *  - placeholder: string
 *  - className: wrapper class
 *  - triggerClassName: trigger button class (mobile + desktop)
 */
export default function BottomSheetSelect({
    value,
    onValueChange,
    options = [],
    placeholder = 'Auswählen…',
    className,
    triggerClassName,
}) {
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);

    // ── Desktop: Radix Select dropdown ──────────────────────────────────
    if (!isMobile) {
        return (
            <div className={className}>
                <Select value={value} onValueChange={onValueChange}>
                    <SelectTrigger className={triggerClassName}>
                        <SelectValue placeholder={placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        );
    }

    // ── Mobile: Vaul slide-up drawer ────────────────────────────────────
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <div className={className}>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                    'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                    triggerClassName
                )}
            >
                <span className={cn('truncate', !value && 'text-muted-foreground')}>
                    {selectedLabel}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
            </button>
            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerContent className="max-h-[65vh]">
                    <DrawerHeader className="pb-2">
                        <DrawerTitle className="text-base text-center">{placeholder}</DrawerTitle>
                    </DrawerHeader>
                    <div className="overflow-y-auto px-2 pb-safe">
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    onValueChange(opt.value);
                                    setOpen(false);
                                }}
                                className={cn(
                                    'w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm text-left transition-colors active:scale-[0.98] mb-1',
                                    opt.value === value
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'text-foreground hover:bg-accent'
                                )}
                            >
                                <span>{opt.label}</span>
                                {opt.value === value && <Check className="w-4 h-4 shrink-0" />}
                            </button>
                        ))}
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    );
}