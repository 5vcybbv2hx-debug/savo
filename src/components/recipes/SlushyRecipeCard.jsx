import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Snowflake, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';

const TARGET_VOLUME = 3.5; // Liter

// Normalize any amount to liters for scaling, then convert back
function normalizeToLiters(amount, unit) {
    switch ((unit || 'l').toLowerCase()) {
        case 'ml':   return amount / 1000;
        case 'cl':   return amount / 100;
        case 'dl':   return amount / 10;
        case 'l':    return amount;
        case 'g':    return amount / 1000;
        case 'kg':   return amount;
        default:     return amount;
    }
}
function litersToUnit(liters, unit) {
    switch ((unit || 'l').toLowerCase()) {
        case 'ml':   return liters * 1000;
        case 'cl':   return liters * 100;
        case 'dl':   return liters * 10;
        case 'l':    return liters;
        case 'g':    return liters * 1000;
        case 'kg':   return liters;
        default:     return liters;
    }
}
function smartRound(value) {
    if (value === 0) return 0;
    if (value >= 100) return Math.round(value);
    if (value >= 10)  return Math.round(value * 10) / 10;
    return Math.round(value * 100) / 100;
}

const spiritColors = {
    'Vodka': 'bg-primary/20 text-primary/25 border-primary/30',
    'Rum': 'bg-status-warn/20 text-status-warn/25 border-status-warn/30',
    'Gin': 'bg-status-ok/20 text-status-ok/25 border-status-ok/30',
    'Whiskey': 'bg-status-warn/20 text-status-warn/25 border-status-warn/30',
    'Likör': 'bg-primary/20 text-primary border-primary/30',
    'Alkoholfrei': 'bg-status-ok/20 text-status-ok/25 border-status-ok/30',
    'Sonstiges': 'bg-surface text-muted-foreground border-border',
};

const spiritDots = {
    'Vodka': 'bg-primary/70',
    'Rum': 'bg-status-warn/70',
    'Gin': 'bg-status-ok/70',
    'Whiskey': 'bg-status-warn/70',
    'Likör': 'bg-primary',
    'Alkoholfrei': 'bg-status-ok/70',
    'Sonstiges': 'bg-muted',
};

function StarRating({ recipe, isManager }) {
    const queryClient = useQueryClient();
    const [hovered, setHovered] = useState(0);
    const [saving, setSaving] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [notesValue, setNotesValue] = useState(recipe.slushy_rating_notes || '');
    const current = recipe.slushy_rating || 0;

    const handleRate = async (stars) => {
        if (!isManager) return;
        setSaving(true);
        await base44.entities.Recipe.update(recipe.id, { slushy_rating: stars });
        queryClient.invalidateQueries(['recipes']);
        setSaving(false);
    };

    const handleSaveNotes = async () => {
        setSaving(true);
        await base44.entities.Recipe.update(recipe.id, { slushy_rating_notes: notesValue });
        queryClient.invalidateQueries(['recipes']);
        setSaving(false);
        setShowNotes(false);
    };

    return (
        <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Bewertung:</span>
                <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                        <button
                            key={star}
                            disabled={!isManager || saving}
                            onMouseEnter={() => isManager && setHovered(star)}
                            onMouseLeave={() => setHovered(0)}
                            onClick={() => handleRate(star)}
                            className={cn('transition-colors', isManager ? 'cursor-pointer' : 'cursor-default')}
                        >
                            <Star className={cn(
                                'w-4 h-4 transition-colors',
                                (hovered || current) >= star
                                    ? 'fill-status-warn text-status-warn'
                                    : 'text-muted-foreground/40'
                            )} />
                        </button>
                    ))}
                </div>
                {current > 0 && (
                    <span className="text-xs text-status-warn font-semibold">{current}/5</span>
                )}
                {isManager && (
                    <button
                        onClick={() => setShowNotes(v => !v)}
                        className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showNotes ? 'Schließen' : '+ Notiz'}
                    </button>
                )}
            </div>
            {recipe.slushy_rating_notes && !showNotes && (
                <p className="text-xs text-muted-foreground mt-1.5 italic">📝 {recipe.slushy_rating_notes}</p>
            )}
            {showNotes && (
                <div className="mt-2 space-y-2">
                    <Textarea
                        value={notesValue}
                        onChange={e => setNotesValue(e.target.value)}
                        placeholder="Feedback zum Rezept, z.B. zu süß, mehr Zitrone, Gäste mochten es sehr..."
                        className="text-xs min-h-[60px]"
                    />
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveNotes} disabled={saving}
                            className="h-7 text-xs bg-status-warn/70 hover:bg-status-warn/70 text-white">
                            Speichern
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowNotes(false)}
                            className="h-7 text-xs">
                            Abbrechen
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SlushyRecipeCard({ recipe, onEdit, onDelete, isManager }) {
    const [expanded, setExpanded] = useState(false);
    const originalVolume = recipe.slushy_original_volume_liters;
    const factor = originalVolume ? (TARGET_VOLUME / originalVolume) : 1;

    const scaledIngredients = (recipe.ingredients || []).map(ing => {
        if (!ing.amount) return ing;
        const inLiters = normalizeToLiters(ing.amount, ing.unit || 'l');
        const scaledLiters = inLiters * factor;
        const scaledAmount = smartRound(litersToUnit(scaledLiters, ing.unit || 'l'));
        return { ...ing, scaledAmount };
    });

    const spirit = recipe.slushy_spirit_base || 'Sonstiges';

    return (
        <Card className={cn(
            'bg-card border-border overflow-hidden transition-all',
            'hover:border-primary/30'
        )}>
            {/* Color bar top */}
            <div className={cn('h-1 w-full', spiritDots[spirit] || 'bg-muted')} />

            <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', spiritDots[spirit])} />
                            <h3 className="font-semibold text-foreground text-sm leading-tight">{recipe.name}</h3>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                            {spirit && (
                                <Badge className={cn('text-[10px] border', spiritColors[spirit])}>
                                    {spirit}
                                </Badge>
                            )}
                            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                <Snowflake className="w-2.5 h-2.5 mr-1" />
                                Slushy
                            </Badge>
                        </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        {isManager && (
                            <>
                                <Button variant="ghost" size="icon" onClick={() => onEdit(recipe)}
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent">
                                    <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => onDelete(recipe.id)}
                                    className="h-7 w-7 text-status-danger hover:text-status-danger hover:bg-status-danger/10">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Scaling info */}
                {originalVolume && (
                    <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-2.5 py-1.5">
                        <Snowflake className="w-3 h-3 text-primary shrink-0" />
                        <span>Original: <strong className="text-foreground">{originalVolume}L</strong></span>
                        <span className="text-border">→</span>
                        <span className="text-primary font-semibold">{TARGET_VOLUME}L (Faktor {factor.toFixed(2)})</span>
                    </div>
                )}

                {/* Ingredients */}
                {scaledIngredients.length > 0 && (
                    <div className="space-y-1">
                        {(expanded ? scaledIngredients : scaledIngredients.slice(0, 4)).map((ing, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">{ing.article_name}</span>
                                <span className="text-primary font-semibold tabular-nums">
                                    {originalVolume
                                        ? `${ing.scaledAmount} ${ing.unit || 'L'}`
                                        : `${ing.amount} ${ing.unit || 'L'}`
                                    }
                                </span>
                            </div>
                        ))}
                        {scaledIngredients.length > 4 && (
                            <button
                                onClick={() => setExpanded(v => !v)}
                                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-1 w-full"
                            >
                                {expanded
                                    ? <><ChevronUp className="w-3 h-3" /> Weniger anzeigen</>
                                    : <><ChevronDown className="w-3 h-3" /> +{scaledIngredients.length - 4} weitere Zutaten</>
                                }
                            </button>
                        )}
                    </div>
                )}

                {/* Garnish & Notes */}
                {recipe.garnish && (
                    <p className="text-xs text-status-warn mt-2">🍋 {recipe.garnish}</p>
                )}
                {recipe.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">💡 {recipe.notes}</p>
                )}
                {recipe.preparation && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed border-t border-border pt-2">
                        {recipe.preparation}
                    </p>
                )}

                <StarRating recipe={recipe} isManager={isManager} />
            </div>
        </Card>
    );
}