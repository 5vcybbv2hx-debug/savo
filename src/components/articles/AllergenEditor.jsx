import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

const STANDARD_ALLERGENS = [
    'Gluten', 'Weizen', 'Roggen', 'Gerste', 'Hafer',
    'Krebstiere', 'Eier', 'Fisch', 'Erdnüsse', 'Soja',
    'Milch', 'Laktose', 'Schalenfrüchte', 'Nüsse',
    'Sellerie', 'Senf', 'Sesam', 'Sulfite', 'Schwefeldioxid',
    'Lupinen', 'Weichtiere'
];

export default function AllergenEditor({ value, onChange, articleName }) {
    const [detecting, setDetecting] = useState(false);
    const [customInput, setCustomInput] = useState('');

    // Parse current allergens string into array
    const selected = value
        ? value.split(',').map(a => a.trim()).filter(Boolean)
        : [];

    const toggle = (allergen) => {
        const isSelected = selected.some(a => a.toLowerCase() === allergen.toLowerCase());
        let next;
        if (isSelected) {
            next = selected.filter(a => a.toLowerCase() !== allergen.toLowerCase());
        } else {
            next = [...selected, allergen];
        }
        onChange(next.join(', '));
    };

    const addCustom = () => {
        const trimmed = customInput.trim();
        if (!trimmed) return;
        if (!selected.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
            onChange([...selected, trimmed].join(', '));
        }
        setCustomInput('');
    };

    const remove = (allergen) => {
        onChange(selected.filter(a => a.toLowerCase() !== allergen.toLowerCase()).join(', '));
    };

    const detectFromAI = async () => {
        if (!articleName) {
            toast.error('Bitte zuerst Artikelname eingeben');
            return;
        }
        setDetecting(true);
        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Analysiere den folgenden Artikel und liste NUR die enthaltenen Allergene auf: "${articleName}". 
Gib nur die Allergene als kommaseparierte Liste zurück (z.B. "Gluten, Milch, Sulfite"). 
Wenn keine Allergene vorhanden sind, antworte mit "Keine".
Berücksichtige typische Allergene: Gluten, Krebstiere, Eier, Fisch, Erdnüsse, Soja, Milch, Schalenfrüchte, Sellerie, Senf, Sesam, Sulfite, Lupinen, Weichtiere.`,
                response_json_schema: {
                    type: "object",
                    properties: { allergens: { type: "string" } }
                }
            });

            if (result.allergens && result.allergens !== "Keine") {
                const detected = result.allergens.split(',').map(a => a.trim()).filter(Boolean);
                // Merge with existing, avoid duplicates
                const merged = [...new Set([...selected, ...detected])];
                onChange(merged.join(', '));
                toast.success(`${detected.length} Allergen(e) erkannt und hinzugefügt`);
            } else {
                toast.info('Keine Allergene erkannt');
            }
        } catch {
            toast.error('Fehler bei der KI-Erkennung');
        } finally {
            setDetecting(false);
        }
    };

    // Allergens that are selected but not in the standard list (custom ones)
    const customSelected = selected.filter(
        a => !STANDARD_ALLERGENS.some(s => s.toLowerCase() === a.toLowerCase())
    );

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label>Allergene</Label>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={detectFromAI}
                    disabled={detecting}
                    className="h-7 text-xs gap-1"
                >
                    <Sparkles className="w-3 h-3" />
                    {detecting ? 'Erkenne...' : 'KI-Erkennung'}
                </Button>
            </div>

            {/* Standard allergen checkboxes */}
            <div className="flex flex-wrap gap-2">
                {STANDARD_ALLERGENS.map(allergen => {
                    const isSelected = selected.some(a => a.toLowerCase() === allergen.toLowerCase());
                    return (
                        <button
                            key={allergen}
                            type="button"
                            onClick={() => toggle(allergen)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                isSelected
                                    ? 'bg-status-warn/20 border-status-warn/60 text-status-warn/25'
                                    : 'bg-transparent border-border/70 text-muted-foreground hover:border-border hover:text-foreground/75'
                            }`}
                        >
                            {isSelected && <span className="mr-1">✓</span>}
                            {allergen}
                        </button>
                    );
                })}
            </div>

            {/* Custom allergens */}
            {customSelected.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {customSelected.map(a => (
                        <Badge key={a} className="bg-primary/20 text-primary/25 border-primary/40 gap-1">
                            {a}
                            <button type="button" onClick={() => remove(a)}>
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Add custom allergen */}
            <div className="flex gap-2">
                <Input
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
                    placeholder="Weiteres Allergen hinzufügen..."
                    className="text-sm h-8"
                />
                <Button type="button" variant="outline" size="sm" onClick={addCustom} className="h-8 px-3">
                    <Plus className="w-3.5 h-3.5" />
                </Button>
            </div>

            {/* Summary */}
            {selected.length > 0 && (
                <p className="text-xs text-muted-foreground">
                    Eingetragen: <span className="text-foreground">{selected.join(', ')}</span>
                </p>
            )}
        </div>
    );
}