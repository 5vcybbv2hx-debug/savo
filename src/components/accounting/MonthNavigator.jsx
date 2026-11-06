import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { format, addMonths, subMonths, parseISO, addYears, subYears } from 'date-fns';
import { de } from 'date-fns/locale';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/**
 * Erweiterte Monatsnavigation für alle Buchhaltungsseiten.
 * Props:
 *   value: string — aktueller Monat im Format "yyyy-MM"
 *   onChange: (value: string) => void
 */
export default function MonthNavigator({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef();
    const current = parseISO(value + '-01');
    const isCurrentMonth = value === format(new Date(), 'yyyy-MM');
    const [pickerYear, setPickerYear] = useState(current.getFullYear());

    // Close on outside click
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
    }, []);

    // Sync picker year when value changes externally
    useEffect(() => { setPickerYear(current.getFullYear()); }, [value]);

    const prev = () => onChange(format(subMonths(current, 1), 'yyyy-MM'));
    const next = () => onChange(format(addMonths(current, 1), 'yyyy-MM'));

    const selectMonth = (monthIndex) => {
        const newVal = `${pickerYear}-${String(monthIndex + 1).padStart(2, '0')}`;
        onChange(newVal);
        setOpen(false);
    };

    const currentYear = current.getFullYear();
    const currentMonthIndex = current.getMonth();
    const todayYear = new Date().getFullYear();
    const todayMonth = new Date().getMonth();

    return (
        <div className="relative flex items-center gap-1" ref={ref}>
            {/* Prev */}
            <button
                onClick={prev}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Month label — opens picker */}
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1 px-2.5 h-8 rounded-lg text-sm font-semibold text-foreground hover:bg-accent/50 transition-colors min-w-[120px] justify-center"
            >
                {format(current, 'MMM yyyy', { locale: de })}
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Next */}
            <button
                onClick={next}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            >
                <ChevronRight className="w-4 h-4" />
            </button>

            {/* Picker Dropdown */}
            {open && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-2xl shadow-2xl p-3 w-64">
                    {/* Year navigation */}
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => setPickerYear(y => y - 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-bold text-foreground">{pickerYear}</span>
                        <button
                            onClick={() => setPickerYear(y => y + 1)}
                            disabled={pickerYear >= todayYear}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Month grid */}
                    <div className="grid grid-cols-4 gap-1">
                        {MONTHS_SHORT.map((label, i) => {
                            const isFuture = pickerYear > todayYear || (pickerYear === todayYear && i > todayMonth);
                            const isSelected = pickerYear === currentYear && i === currentMonthIndex;
                            const isToday = pickerYear === todayYear && i === todayMonth;
                            return (
                                <button
                                    key={i}
                                    onClick={() => !isFuture && selectMonth(i)}
                                    disabled={isFuture}
                                    className={`h-9 rounded-xl text-xs font-medium transition-all
                                        ${isSelected ? 'bg-primary/70 text-foreground' : ''}
                                        ${!isSelected && isToday ? 'border border-primary/50 text-primary' : ''}
                                        ${!isSelected && !isToday && !isFuture ? 'hover:bg-accent text-foreground' : ''}
                                        ${isFuture ? 'opacity-25 cursor-not-allowed text-muted-foreground' : ''}
                                    `}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Quick: Heute */}
                    {!isCurrentMonth && (
                        <button
                            onClick={() => { onChange(format(new Date(), 'yyyy-MM')); setOpen(false); }}
                            className="w-full mt-2 py-1.5 rounded-xl text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        >
                            → Aktueller Monat
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}