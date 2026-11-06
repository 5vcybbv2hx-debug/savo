import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, Delete, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const QUICK = [1, 6, 12, 24];

export default function QuantityInputModal({ open, onClose, onConfirm, articleName, existingQuantity = null }) {
    // "" = leeres Display, erster Tastendruck ersetzt
    const [display, setDisplay] = useState('');
    const [firstPress, setFirstPress] = useState(true);
    const confirmRef = useRef(null);

    useEffect(() => {
        if (open) {
            setDisplay(existingQuantity != null ? String(existingQuantity) : '');
            setFirstPress(true);
        }
    }, [open, existingQuantity]);

    const value = parseInt(display) || 0;
    const displayText = display === '' ? '—' : display;

    // Numpad: erster Druck ersetzt Placeholder, danach append
    const press = (digit) => {
        setDisplay(prev => {
            if (firstPress) {
                setFirstPress(false);
                return String(digit);
            }
            if (prev === '0' && digit === '0') return prev;
            const next = prev + String(digit);
            return next.length > 4 ? prev : next;
        });
        if (firstPress) setFirstPress(false);
    };

    const backspace = () => {
        setDisplay(prev => {
            if (prev.length <= 1) { setFirstPress(true); return ''; }
            return prev.slice(0, -1);
        });
    };

    const adjust = (delta) => {
        setDisplay(prev => {
            const cur = parseInt(prev) || 0;
            const next = Math.max(1, cur + delta);
            setFirstPress(false);
            return String(next);
        });
    };

    const setQuick = (q) => {
        setDisplay(String(q));
        setFirstPress(false);
    };

    const handleConfirm = () => {
        if (value < 1) return;
        onConfirm(value);
    };

    const handleKeyDown = (e) => {
        if (!open) return;
        if (e.key >= '0' && e.key <= '9') { e.preventDefault(); press(parseInt(e.key)); }
        else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
        else if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
        else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === '+') { e.preventDefault(); adjust(1); }
        else if (e.key === '-') { e.preventDefault(); adjust(-1); }
    };

    useEffect(() => {
        if (open) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, value, firstPress]);

    const digits = [
        ['7', '8', '9'],
        ['4', '5', '6'],
        ['1', '2', '3'],
    ];

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent
                className="sm:max-w-[320px] w-[92vw] p-0 overflow-hidden rounded-2xl"
                style={{ maxHeight: '95dvh' }}
            >
                {/* Header */}
                <div className="bg-status-warn/10 border-b border-status-warn/20 px-5 py-4">
                    <p className="text-[11px] font-semibold text-status-warn uppercase tracking-widest">
                        {existingQuantity != null ? 'Menge ändern' : 'Menge eingeben'}
                    </p>
                    <p className="font-semibold text-foreground text-base mt-1 truncate">{articleName}</p>
                    {existingQuantity != null && (
                        <p className="text-xs text-muted-foreground mt-0.5">Aktuell: {existingQuantity}×</p>
                    )}
                </div>

                <div className="p-4 space-y-3">
                    {/* Display */}
                    <div className="flex items-center gap-3 bg-secondary/60 rounded-2xl px-5 py-3">
                        <span className={cn(
                            "flex-1 text-6xl font-bold tracking-tight tabular-nums",
                            display === '' ? 'text-muted-foreground/40' : 'text-foreground'
                        )}>
                            {displayText}
                        </span>
                        <div className="flex flex-col gap-1.5">
                            <button
                                onClick={() => adjust(1)}
                                className="w-11 h-11 rounded-xl bg-status-ok/20 text-status-ok flex items-center justify-center active:scale-90 transition-transform"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => adjust(-1)}
                                disabled={value <= 1 && display !== ''}
                                className="w-11 h-11 rounded-xl bg-status-danger/20 text-status-danger flex items-center justify-center active:scale-90 transition-transform disabled:opacity-25"
                            >
                                <Minus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Quick-Select Buttons */}
                    <div className="grid grid-cols-4 gap-2">
                        {QUICK.map(q => (
                            <button
                                key={q}
                                onClick={() => setQuick(q)}
                                className={cn(
                                    'h-11 rounded-xl border text-sm font-bold transition-all active:scale-90',
                                    value === q && display !== ''
                                        ? 'bg-status-warn/70 text-muted-foreground border-status-warn/70 shadow-sm shadow-amber-500/30'
                                        : 'border-border/60 text-muted-foreground hover:text-foreground bg-card hover:border-status-warn/40'
                                )}
                            >
                                {q}×
                            </button>
                        ))}
                    </div>

                    {/* Numpad */}
                    <div className="grid grid-cols-3 gap-2">
                        {digits.flat().map(d => (
                            <button
                                key={d}
                                onClick={() => press(parseInt(d))}
                                className="h-14 rounded-xl bg-card border border-border/50 text-xl font-semibold text-foreground active:scale-90 active:bg-secondary transition-all"
                            >
                                {d}
                            </button>
                        ))}
                        {/* Bottom row: delete | 0 | confirm */}
                        <button
                            onClick={backspace}
                            className="h-14 rounded-xl bg-card border border-border/50 text-muted-foreground active:scale-90 active:bg-secondary transition-all flex items-center justify-center"
                        >
                            <Delete className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => press(0)}
                            className="h-14 rounded-xl bg-card border border-border/50 text-xl font-semibold text-foreground active:scale-90 active:bg-secondary transition-all"
                        >
                            0
                        </button>
                        <button
                            ref={confirmRef}
                            onClick={handleConfirm}
                            disabled={value < 1}
                            className="h-14 rounded-xl bg-status-warn/70 text-muted-foreground text-xl font-bold active:scale-90 transition-all disabled:opacity-30 flex items-center justify-center shadow-sm shadow-amber-500/20"
                        >
                            <Check className="w-6 h-6" strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Cancel */}
                    <button
                        onClick={onClose}
                        className="w-full h-11 rounded-xl bg-card border border-border/40 text-sm text-muted-foreground active:scale-95 transition-all hover:text-foreground"
                    >
                        Abbrechen
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
