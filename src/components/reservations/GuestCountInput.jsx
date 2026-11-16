import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * GuestCountInput — Personenanzahl für Reservierungen (1 bis 50).
 *
 * Bewusst KEIN type="number": der Browser-Spinner ist auf dem Handy unbrauchbar
 * und ein sofortiges Zurückrechnen des Wertes (parseInt(x) || 1) verhindert,
 * dass man die Zahl überschreiben kann. Das Feld hält den Tipp-Text lokal und
 * meldet erst einen gültigen, geklemmten Wert an den Aufrufer.
 */
export default function GuestCountInput({
    value,
    onChange,
    min = 1,
    max = 50,
    disabled = false,
    id,
    className,
    label = 'Personen',
    showUnit = true,
}) {
    const numValue = Number.isFinite(Number(value)) ? Number(value) : min;
    const [text, setText] = useState(String(numValue));
    const focused = useRef(false);

    // Externe Änderungen übernehmen (z. B. geladene Reservierung) —
    // aber niemals, während gerade getippt wird.
    useEffect(() => {
        if (!focused.current) setText(String(numValue));
    }, [numValue]);

    const commit = (raw) => {
        const clamped = Math.min(max, Math.max(min, raw));
        setText(String(clamped));
        if (clamped !== numValue) onChange(clamped);
    };

    const handleInput = (e) => {
        const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
        setText(digits);
        if (digits === '') return; // leer tippen erlauben, geklemmt wird beim Verlassen
        const n = parseInt(digits, 10);
        if (n >= min && n <= max && n !== numValue) onChange(n);
    };

    const handleBlur = () => {
        focused.current = false;
        const n = parseInt(text, 10);
        commit(Number.isNaN(n) ? min : n);
    };

    const btn = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/50 text-foreground transition-colors hover:bg-secondary active:scale-95 disabled:opacity-30 disabled:pointer-events-none';

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <button
                type="button"
                className={btn}
                onClick={() => commit(numValue - 1)}
                disabled={disabled || numValue <= min}
                aria-label="Personen verringern"
            >
                <Minus className="w-4 h-4" />
            </button>

            <input
                id={id}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]*"
                value={text}
                onChange={handleInput}
                onFocus={() => { focused.current = true; }}
                onBlur={handleBlur}
                disabled={disabled}
                aria-label={label}
                className="h-11 w-14 rounded-xl border border-border bg-background/60 text-center text-base font-semibold tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <button
                type="button"
                className={btn}
                onClick={() => commit(numValue + 1)}
                disabled={disabled || numValue >= max}
                aria-label="Personen erhöhen"
            >
                <Plus className="w-4 h-4" />
            </button>

            {showUnit && (
                <span className="text-xs text-muted-foreground">{numValue === 1 ? 'Person' : 'Personen'}</span>
            )}
        </div>
    );
}