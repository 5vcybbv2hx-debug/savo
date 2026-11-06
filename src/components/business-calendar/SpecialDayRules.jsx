/**
 * SpecialDayRules.jsx
 * Optionaler erweiterter Regelblock für Aufgaben (Cleaning, OperativeListen, etc.)
 * Einfache Checkboxen — eingeklappt, damit normale Nutzer nicht überfordert werden.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export const SPECIAL_RULE_OPTIONS = [
    { key: 'include_special_openings',     label: 'Auch an Sonderöffnungen'         },
    { key: 'include_pre_holidays',         label: 'Auch an Vorfeiertagen'            },
    { key: 'include_holidays',             label: 'Auch an Feiertagen'               },
    { key: 'include_event_days',           label: 'Auch an Eventtagen'               },
    { key: 'include_long_nights',          label: 'Auch bei langer Nacht'            },
    { key: 'include_inventory_days',       label: 'Auch an Inventurtagen'            },
    { key: 'include_cleaning_only_days',   label: 'Auch bei Geschlossen + Reinigung' },
    { key: 'only_special_days',            label: 'Nur an Sondertagen (kein Wochentag)' },
    { key: 'exclude_closed_days',          label: 'Nicht an geschlossenen Tagen'     },
];

/**
 * rules: object { include_special_openings: bool, ... }
 * onChange: (newRules) => void
 */
export default function SpecialDayRules({ rules = {}, onChange }) {
    const [open, setOpen] = useState(false);

    const activeCount = SPECIAL_RULE_OPTIONS.filter(o => rules[o.key]).length;

    const toggle = (key) => {
        onChange({ ...rules, [key]: !rules[key] });
    };

    return (
        <div className="mt-3">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm font-medium',
                    activeCount > 0
                        ? 'bg-status-warn/10 border-status-warn/30 text-status-warn/25'
                        : 'bg-secondary/30 border-border text-muted-foreground hover:border-primary/30'
                )}
            >
                <span className="flex items-center gap-2">
                    <Zap className={cn('w-4 h-4', activeCount > 0 ? 'text-status-warn' : '')} />
                    Erweiterte Bedingungen
                    {activeCount > 0 && (
                        <span className="bg-status-warn/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {activeCount}
                        </span>
                    )}
                </span>
                {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {open && (
                <div className="mt-2 px-3 py-3 rounded-xl bg-secondary/20 border border-border space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-bold mb-3">
                        Aufgabe erscheint zusätzlich wenn…
                    </p>
                    {SPECIAL_RULE_OPTIONS.map(opt => (
                        <label
                            key={opt.key}
                            className="flex items-center gap-3 py-1.5 cursor-pointer group"
                        >
                            <div
                                onClick={() => toggle(opt.key)}
                                className={cn(
                                    'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                                    rules[opt.key]
                                        ? 'bg-status-warn/70 border-status-warn/70'
                                        : 'border-border group-hover:border-status-warn/50'
                                )}
                            >
                                {rules[opt.key] && (
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                                        <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                            <span className={cn('text-sm', rules[opt.key] ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                                {opt.label}
                            </span>
                        </label>
                    ))}

                    {rules.only_special_days && (
                        <p className="text-[10px] text-status-warn bg-status-warn/10 rounded-lg px-2 py-1.5 mt-2">
                            ⚠ „Nur an Sondertagen" überschreibt die Wochentags-Auswahl
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}