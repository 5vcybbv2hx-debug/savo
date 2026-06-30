import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

export const ALLERGENS = [
    'Glutenhaltiges Getreide',
    'Krebstiere',
    'Eier',
    'Fisch',
    'Erdnüsse',
    'Soja',
    'Milch / Laktose',
    'Schalenfrüchte',
    'Sellerie',
    'Senf',
    'Sesam',
    'Schwefeldioxid / Sulfite',
    'Lupinen',
    'Weichtiere',
];

export const ADDITIVES = [
    'mit Farbstoff',
    'mit Konservierungsstoffen',
    'mit Antioxidationsmittel',
    'mit Geschmacksverstärker',
    'geschwefelt',
    'geschwärzt',
    'gewachst',
    'mit Phosphat',
    'mit Süßungsmittel',
    'enthält eine Phenylalaninquelle',
    'koffeinhaltig',
    'chininhaltig',
];

// Quick presets per category
const PRESETS = {
    Bier:       { allergens: ['Glutenhaltiges Getreide'], additives: [] },
    Wein:       { allergens: [], additives: ['geschwefelt'] },
    'Sekt & Champagner': { allergens: [], additives: ['geschwefelt'] },
    Cocktails:  { allergens: [], additives: ['mit Farbstoff'] },
    Longdrinks: { allergens: [], additives: ['chininhaltig'] },
    Shots:      { allergens: [], additives: [] },
    Softdrinks: { allergens: [], additives: ['mit Farbstoff', 'koffeinhaltig'] },
    Heißgetränke: { allergens: ['Milch / Laktose'], additives: ['koffeinhaltig'] },
};

function ChipToggle({ label, selected, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer touch-manipulation',
                selected
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-secondary border-border text-muted-foreground hover:border-amber-500/30 hover:text-foreground'
            )}
        >
            {label}
        </button>
    );
}

export default function AllergenSelector({ allergensList = [], additives = [], category, onChange }) {
    const toggle = (list, item, key) => {
        const next = list.includes(item) ? list.filter(x => x !== item) : [...list, item];
        onChange(key, next);
    };

    const applyPreset = () => {
        const preset = PRESETS[category] || { allergens: [], additives: [] };
        onChange('allergens_list', preset.allergens);
        onChange('additives', preset.additives);
    };

    return (
        <div className="space-y-4 p-4 rounded-xl bg-secondary/40 border border-border">
            <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Allergene & Zusatzstoffe</span>
                {PRESETS[category] && (
                    <Button type="button" variant="outline" size="sm" onClick={applyPreset} className="h-7 text-xs gap-1.5">
                        <Zap className="w-3 h-3" /> Typische Werte
                    </Button>
                )}
            </div>

            <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Allergene</p>
                <div className="flex flex-wrap gap-1.5">
                    {ALLERGENS.map(a => (
                        <ChipToggle
                            key={a}
                            label={a}
                            selected={allergensList.includes(a)}
                            onClick={() => toggle(allergensList, a, 'allergens_list')}
                        />
                    ))}
                </div>
            </div>

            <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Zusatzstoffe</p>
                <div className="flex flex-wrap gap-1.5">
                    {ADDITIVES.map(d => (
                        <ChipToggle
                            key={d}
                            label={d}
                            selected={additives.includes(d)}
                            onClick={() => toggle(additives, d, 'additives')}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}