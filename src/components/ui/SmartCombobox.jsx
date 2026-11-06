/**
 * SmartCombobox — zentrales, wiederverwendbares Autocomplete-System
 *
 * Props:
 *  value          string | string[]   aktueller Wert (single oder multi)
 *  onChange       (val) => void       Callback
 *  options        string[]            verfügbare Vorschläge
 *  placeholder    string
 *  allowCreate    boolean             "Neu anlegen"-Option anzeigen (default true)
 *  multi          boolean             Mehrfachauswahl (default false)
 *  label          string              optionales Label über dem Feld
 *  disabled       boolean
 *  className      string
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Plus, ChevronDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Einfache Ähnlichkeitsberechnung (normalisierter Levenshtein)
function similarity(a, b) {
    const s1 = a.toLowerCase().trim();
    const s2 = b.toLowerCase().trim();
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;
    const maxLen = Math.max(s1.length, s2.length);
    let dist = 0;
    const dp = Array.from({ length: s1.length + 1 }, (_, i) =>
        Array.from({ length: s2.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= s1.length; i++) {
        for (let j = 1; j <= s2.length; j++) {
            dp[i][j] = s1[i - 1] === s2[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return 1 - dp[s1.length][s2.length] / maxLen;
}

function filterOptions(options, query) {
    if (!query) return options.slice(0, 10);
    const q = query.toLowerCase();
    // Exact includes first, then similarity
    const exact = options.filter(o => o.toLowerCase().includes(q));
    const similar = options
        .filter(o => !exact.includes(o) && similarity(o, query) > 0.55)
        .sort((a, b) => similarity(b, query) - similarity(a, query));
    return [...exact, ...similar].slice(0, 10);
}

function SimilarityWarning({ query, options }) {
    if (!query || query.length < 3) return null;
    const q = query.toLowerCase().trim();
    const close = options.find(o => {
        const ol = o.toLowerCase().trim();
        return ol !== q && (similarity(ol, q) > 0.75 || ol.includes(q) || q.includes(ol));
    });
    if (!close) return null;
    return (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-status-warn/10 border border-status-warn/30 text-status-warn text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Ähnlicher Eintrag vorhanden: <span className="font-semibold">{close}</span>
        </div>
    );
}

export default function SmartCombobox({
    value,
    onChange,
    options = [],
    placeholder = 'Suchen oder eingeben...',
    allowCreate = true,
    multi = false,
    label,
    disabled = false,
    className,
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    // Normalize values
    const selectedValues = multi
        ? (Array.isArray(value) ? value : value ? [value] : [])
        : [];
    const singleValue = !multi ? (value || '') : '';

    const filtered = useMemo(() => filterOptions(options, query), [options, query]);

    // Exclude already-selected in multi mode
    const suggestions = multi
        ? filtered.filter(o => !selectedValues.includes(o))
        : filtered;

    const exactMatch = options.some(o => o.toLowerCase() === query.toLowerCase().trim());
    const showCreate = allowCreate && query.trim().length > 0 && !exactMatch;

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                if (!multi && !options.includes(singleValue)) {
                    // keep free text as-is for single mode
                }
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [singleValue, multi, options]);

    const select = (val) => {
        if (multi) {
            if (!selectedValues.includes(val)) {
                onChange([...selectedValues, val]);
            }
            setQuery('');
        } else {
            onChange(val);
            setQuery('');
            setOpen(false);
        }
    };

    const create = () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        select(trimmed);
    };

    const removeChip = (val) => {
        onChange(selectedValues.filter(v => v !== val));
    };

    const handleInputChange = (e) => {
        const v = e.target.value;
        setQuery(v);
        if (!multi) onChange(v);
        setOpen(true);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && query.trim()) {
            e.preventDefault();
            if (suggestions.length > 0) {
                select(suggestions[0]);
            } else if (showCreate) {
                create();
            }
        }
        if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    const displayValue = multi ? query : (singleValue || query);

    return (
        <div ref={containerRef} className={cn('relative w-full', className)}>
            {label && <p className="text-sm font-medium text-foreground mb-1.5">{label}</p>}

            {/* Chips for multi-select */}
            {multi && selectedValues.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedValues.map(v => (
                        <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-warn/15 border border-status-warn/30 text-status-warn text-sm font-medium">
                            {v}
                            <button
                                type="button"
                                onClick={() => removeChip(v)}
                                className="hover:text-status-danger transition-colors p-0.5"
                                disabled={disabled}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Input field */}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={displayValue}
                    onChange={handleInputChange}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        'w-full h-11 px-3 pr-9 rounded-md border border-input bg-transparent text-base shadow-sm transition-colors',
                        'placeholder:text-muted-foreground',
                        'focus:outline-none focus:ring-1 focus:ring-ring',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        'md:text-sm'
                    )}
                    autoComplete="off"
                />
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => { setOpen(o => !o); inputRef.current?.focus(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                    <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
                </button>
            </div>

            {/* Duplicate warning */}
            {open && !multi && query.trim().length >= 3 && (
                <div className="mt-1">
                    <SimilarityWarning query={query} options={options} />
                </div>
            )}

            {/* Suggestions dropdown */}
            {open && (suggestions.length > 0 || showCreate) && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                    <div className="max-h-56 overflow-y-auto">
                        {suggestions.map(opt => (
                            <button
                                key={opt}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); select(opt); }}
                                onTouchEnd={(e) => { e.preventDefault(); select(opt); }}
                                className="w-full flex items-center px-4 py-3 text-sm text-foreground hover:bg-accent active:bg-accent/80 transition-colors text-left min-h-[44px]"
                            >
                                {opt}
                            </button>
                        ))}
                        {showCreate && (
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); create(); }}
                                onTouchEnd={(e) => { e.preventDefault(); create(); }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-status-warn hover:bg-status-warn/10 active:bg-status-warn/20 transition-colors border-t border-border min-h-[44px]"
                            >
                                <Plus className="w-4 h-4 shrink-0" />
                                <span>Neu anlegen: <strong>{query.trim()}</strong></span>
                            </button>
                        )}
                        {suggestions.length === 0 && !showCreate && (
                            <div className="px-4 py-3 text-sm text-muted-foreground">
                                Kein passender Eintrag gefunden
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}