/**
 * PriceCalculator — verbunden mit Artikeln, Rezepten und Getränkekarte
 *
 * Verbesserungen:
 *  - Sticky-Preis-Footer (immer sichtbar)
 *  - Rückwärts-Modus: Zielpreis → Wareneinsatz
 *  - Fehlende EK-Warnung
 *  - Name-Feld direkt bei Rezept-Auswahl
 *  - Zutaten-UX: Menge direkt beim Hinzufügen
 *  - Klare Erklärung Multiplikator / Szenarien
 */
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Calculator, Package, ArrowRight,
    CheckCircle, Info, AlertTriangle, ArrowLeftRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import SmartCombobox from '@/components/ui/SmartCombobox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return (n ?? 0).toFixed(2); }

/** Preis auf nächste 0,10 € runden */
function roundPrice(n) {
    if (n == null) return null;
    return Math.round(n * 10) / 10;
}

function contentToBase(article) {
    if (!article?.content_amount) return null;
    const u = (article.content_unit || 'ml').toLowerCase();
    if (u === 'l' || u === 'kg') return article.content_amount * 1000;
    return article.content_amount;
}

function ingredientToBase(amount, unit) {
    const a = parseFloat(amount) || 0;
    switch ((unit || 'ml').toLowerCase()) {
        case 'cl':    return a * 10;
        case 'l':     return a * 1000;
        case 'kg':    return a * 1000;
        case 'stk':
        case 'stück': return a;
        default:      return a;
    }
}

function calcIngredientCost(article, amount, unit) {
    if (!article?.purchase_price || !amount) return 0;
    const base = contentToBase(article);
    const u = (unit || 'ml').toLowerCase();
    if (u === 'stk' || u === 'stück') {
        return article.purchase_price * (parseFloat(amount) || 0);
    }
    if (!base) return 0;
    return (article.purchase_price / base) * ingredientToBase(amount, unit);
}

// ── Szenarien ─────────────────────────────────────────────────────────────────
const SCENARIOS = [
    { label: 'Günstig',  foodCostPct: 35, color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30' },
    { label: 'Standard', foodCostPct: 28, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30' },
    { label: 'Premium',  foodCostPct: 20, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
];

// ── Sticky Ergebnis-Footer ────────────────────────────────────────────────────
function StickyPriceFooter({ label, grossPrice, costPrice, foodCostPct, visible }) {
    if (!visible || grossPrice == null) return null;
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border shadow-lg px-4 py-3">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{label}</p>
                    <p className="text-xs text-muted-foreground">
                        EK {fmt(costPrice)} € · Wareneinsatz {foodCostPct?.toFixed(1)}%
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Verkaufspreis</p>
                    <p className="text-2xl font-bold text-amber-500">{fmt(grossPrice)} €</p>
                </div>
            </div>
        </div>
    );
}

// ── Einzelartikel-Modus ───────────────────────────────────────────────────────
function SingleMode({ articles, onResult }) {
    const queryClient = useQueryClient();
    const navigate    = useNavigate();
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [portionMl,  setPortionMl]  = useState('40');
    const [foodCostPct, setFoodCostPct] = useState('28');
    const [vatRate,    setVatRate]    = useState('19');
    const [targetPrice, setTargetPrice] = useState('');
    const [reverseMode, setReverseMode] = useState(false);
    const [saving,     setSaving]     = useState(false);

    const articleNames = useMemo(() => articles.map(a => a.name), [articles]);

    const { data: menuItems = [] } = useQuery({
        queryKey: ['menu-items'],
        queryFn: () => base44.entities.MenuItem.list('name', 500),
    });

    const selectByName = name => setSelectedArticle(articles.find(x => x.name === name) || null);

    const linkedMenuItems = useMemo(() => {
        if (!selectedArticle) return [];
        return menuItems.filter(m => {
            const ids = m.linked_article_ids?.length
                ? m.linked_article_ids
                : m.linked_article_id ? [m.linked_article_id] : [];
            return ids.includes(selectedArticle.id);
        });
    }, [menuItems, selectedArticle]);

    // Kalkulation
    const totalBase       = selectedArticle ? contentToBase(selectedArticle) : null;
    const portionNum      = parseFloat(portionMl) || 0;
    const portions        = (totalBase && portionNum > 0) ? totalBase / portionNum : null;
    const ekTotal         = selectedArticle?.purchase_price ?? null;
    const costPerPortion  = (ekTotal != null && portions) ? ekTotal / portions : null;
    const fcPct           = parseFloat(foodCostPct) || 28;
    const vat             = parseFloat(vatRate) || 0;

    // Vorwärts: Kosten → Preis
    const sellNet         = costPerPortion != null ? (costPerPortion / fcPct) * 100 : null;
    const sellGross       = sellNet != null ? roundPrice(sellNet * (1 + vat / 100)) : null;
    const profit          = sellNet != null && costPerPortion != null ? sellNet - costPerPortion : null;
    const actualFoodCost  = (costPerPortion != null && sellNet != null && sellNet > 0)
        ? (costPerPortion / sellNet) * 100 : null;

    // Rückwärts: Zielpreis → Wareneinsatz
    const targetNum       = parseFloat(targetPrice) || 0;
    const targetNet       = targetNum / (1 + vat / 100);
    const reverseFoodCost = (costPerPortion != null && targetNet > 0)
        ? (costPerPortion / targetNet) * 100 : null;
    const reverseProfit   = costPerPortion != null ? targetNet - costPerPortion : null;

    const displayGross    = reverseMode ? (targetNum ? roundPrice(targetNum) : null) : sellGross;
    const displayCost     = costPerPortion;
    const displayFoodCost = reverseMode ? reverseFoodCost : actualFoodCost;

    useEffect(() => {
        onResult({ grossPrice: displayGross, costPrice: displayCost, foodCostPct: displayFoodCost, label: selectedArticle?.name || '' });
    }, [displayGross, displayCost, displayFoodCost, selectedArticle]);

    const handleSaveToMenuItem = async (menuItem) => {
        if (displayGross == null) return;
        setSaving(true);
        try {
            await base44.entities.MenuItem.update(menuItem.id, {
                price: parseFloat(fmt(displayGross)),
                purchase_price: costPerPortion != null ? parseFloat(fmt(costPerPortion)) : undefined,
            });
            queryClient.invalidateQueries({ queryKey: ['menu-items'] });
            toast.success(`Preis ${fmt(displayGross)} € in „${menuItem.name}" übernommen`);
        } catch (e) {
            toast.error('Fehler: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 pb-28">
            {/* Artikel */}
            <Card className="p-5 bg-card border-border space-y-3">
                <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-400" />
                    <h3 className="font-semibold text-foreground text-sm">Artikel wählen</h3>
                </div>
                <SmartCombobox
                    value={selectedArticle?.name || ''}
                    onChange={selectByName}
                    options={articleNames}
                    placeholder="Artikel suchen…"
                    allowCreate={false}
                />
                {selectedArticle && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {selectedArticle.purchase_price ? (
                            <Badge variant="secondary">EK: {fmt(selectedArticle.purchase_price)} €</Badge>
                        ) : (
                            <Badge className="bg-red-500/12 text-red-400 border-red-500/25 gap-1">
                                <AlertTriangle className="w-3 h-3" />Kein EK hinterlegt
                            </Badge>
                        )}
                        {selectedArticle.content_amount && (
                            <Badge variant="outline">
                                {selectedArticle.content_amount} {selectedArticle.content_unit || 'ml'}
                            </Badge>
                        )}
                        {!selectedArticle.content_amount && (
                            <Badge className="bg-orange-500/12 text-orange-400 border-orange-500/25 gap-1">
                                <AlertTriangle className="w-3 h-3" />Keine Inhaltsmenge
                            </Badge>
                        )}
                    </div>
                )}
            </Card>

            {/* Kalkulation */}
            <Card className="p-5 bg-card border-border space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-blue-400" />
                        <h3 className="font-semibold text-foreground text-sm">Kalkulation</h3>
                    </div>
                    {/* Vorwärts / Rückwärts Toggle */}
                    <button onClick={() => setReverseMode(r => !r)}
                        className={cn(
                            'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-all',
                            reverseMode
                                ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                                : 'border-border text-muted-foreground hover:text-foreground'
                        )}>
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        {reverseMode ? 'Rückwärts' : 'Vorwärts'}
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Portionsgröße (ml/g)</Label>
                        <Input type="number" value={portionMl}
                            onChange={e => setPortionMl(e.target.value)}
                            placeholder="z.B. 40" className="h-11" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">MwSt.</Label>
                        <Select value={vatRate} onValueChange={setVatRate}>
                            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="19">19% (Außer-Haus)</SelectItem>
                                <SelectItem value="7">7% (Inhouse)</SelectItem>
                                <SelectItem value="0">0%</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Vorwärts: Wareneinsatz-Slider */}
                {!reverseMode && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">
                                Wareneinsatz — Gastro-Standard 20–35%
                            </Label>
                            <span className="text-sm font-bold text-amber-500">{foodCostPct}%</span>
                        </div>
                        <input type="range" min="10" max="60" value={foodCostPct}
                            onChange={e => setFoodCostPct(e.target.value)}
                            className="w-full accent-amber-500" />
                        {/* Szenarien */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                            {SCENARIOS.map(s => (
                                <button key={s.label}
                                    onClick={() => setFoodCostPct(String(s.foodCostPct))}
                                    className={cn(
                                        'rounded-xl p-2.5 text-center border transition-all',
                                        String(foodCostPct) === String(s.foodCostPct)
                                            ? s.bg : 'bg-secondary/20 border-border hover:bg-secondary/50'
                                    )}>
                                    <p className={cn('text-[10px] font-semibold', String(foodCostPct) === String(s.foodCostPct) ? s.color : 'text-muted-foreground')}>
                                        {s.label}
                                    </p>
                                    <p className="text-xs font-bold text-foreground">{s.foodCostPct}%</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Rückwärts: Zielpreis eingeben */}
                {reverseMode && (
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                            Zielpreis (brutto) — Wareneinsatz wird berechnet
                        </Label>
                        <div className="relative">
                            <Input type="number" step="0.10" value={targetPrice}
                                onChange={e => setTargetPrice(e.target.value)}
                                placeholder="z.B. 8.90" className="h-11 pr-8" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">€</span>
                        </div>
                    </div>
                )}
            </Card>

            {/* Ergebnis */}
            {selectedArticle && costPerPortion != null && (
                <Card className="p-5 bg-card border-border space-y-4">
                    {/* Hauptpreis */}
                    <div className={cn(
                        'rounded-xl p-4 text-center',
                        reverseMode && reverseFoodCost != null
                            ? reverseFoodCost > 40
                                ? 'bg-red-500/10 border border-red-500/30'
                                : reverseFoodCost > 30
                                    ? 'bg-amber-500/10 border border-amber-500/30'
                                    : 'bg-green-500/10 border border-green-500/30'
                            : 'bg-amber-500/10 border border-amber-500/30'
                    )}>
                        {reverseMode ? (
                            <>
                                <p className="text-xs text-muted-foreground mb-1">Wareneinsatz bei {fmt(targetNum)} € Zielpreis</p>
                                <p className="text-4xl font-bold text-foreground">
                                    {reverseFoodCost != null ? `${reverseFoodCost.toFixed(1)}%` : '—'}
                                </p>
                                {reverseFoodCost != null && (
                                    <p className={cn('text-xs mt-1 font-medium',
                                        reverseFoodCost > 40 ? 'text-red-400' : reverseFoodCost > 30 ? 'text-amber-400' : 'text-green-400')}>
                                        {reverseFoodCost > 40 ? '⚠ Zu hoch — Verlust möglich'
                                            : reverseFoodCost > 30 ? 'Akzeptabel'
                                            : '✓ Sehr gut'}
                                    </p>
                                )}
                            </>
                        ) : (
                            <>
                                <p className="text-xs text-amber-400 mb-1">Empfohlener Verkaufspreis (brutto)</p>
                                <p className="text-4xl font-bold text-foreground">{fmt(sellGross)} €</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Wareneinsatz: {actualFoodCost?.toFixed(1)}%
                                </p>
                            </>
                        )}
                    </div>

                    {/* Kennzahlen */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-secondary/40 rounded-xl p-3 text-center">
                            <p className="text-[10px] text-muted-foreground mb-1">EK / Portion</p>
                            <p className="text-sm font-bold text-foreground">{fmt(costPerPortion)} €</p>
                        </div>
                        <div className="bg-secondary/40 rounded-xl p-3 text-center">
                            <p className="text-[10px] text-muted-foreground mb-1">Portionen</p>
                            <p className="text-sm font-bold text-foreground">{portions?.toFixed(1)}</p>
                        </div>
                        <div className="bg-secondary/40 rounded-xl p-3 text-center">
                            <p className="text-[10px] text-muted-foreground mb-1">Gewinn netto</p>
                            <p className="text-sm font-bold text-green-400">
                                +{fmt(reverseMode ? reverseProfit : profit)} €
                            </p>
                        </div>
                    </div>

                    {/* Übernahme in Getränkekarte */}
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            In Getränkekarte übernehmen
                        </p>
                        {linkedMenuItems.length > 0 ? (
                            <div className="space-y-2">
                                {linkedMenuItems.map(m => (
                                    <div key={m.id} className="flex items-center justify-between bg-secondary/30 rounded-xl px-4 py-3 gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                                            <p className="text-xs text-muted-foreground">Aktuell: {fmt(m.price)} €</p>
                                        </div>
                                        <Button size="sm" onClick={() => handleSaveToMenuItem(m)}
                                            disabled={saving || displayGross == null}
                                            className="shrink-0 h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs">
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            {fmt(displayGross)} € setzen
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center bg-secondary/20 rounded-xl p-4">
                                <p className="text-sm text-muted-foreground mb-2">
                                    Kein verknüpftes Getränk gefunden.
                                </p>
                                <Button variant="outline" size="sm"
                                    onClick={() => navigate(createPageUrl('DrinkMenu'))}>
                                    <ArrowRight className="w-4 h-4 mr-1.5" />
                                    Zur Getränkekarte
                                </Button>
                            </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-2 flex items-start gap-1">
                            <Info className="w-3 h-3 mt-0.5 shrink-0" />
                            Einkaufspreis des Artikels wird dabei nicht verändert.
                        </p>
                    </div>
                </Card>
            )}

            {/* Kein EK / keine Inhaltsmenge */}
            {selectedArticle && costPerPortion == null && (
                <Card className="p-5 bg-card border-border text-center space-y-2">
                    <AlertTriangle className="w-8 h-8 text-orange-400 mx-auto" />
                    <p className="text-sm font-semibold text-foreground">Kalkulation nicht möglich</p>
                    <p className="text-xs text-muted-foreground">
                        {!selectedArticle.purchase_price
                            ? 'Kein Einkaufspreis beim Artikel hinterlegt.'
                            : 'Keine Inhaltsmenge beim Artikel hinterlegt (z.B. 700 ml).'}
                    </p>
                    <Button variant="outline" size="sm"
                        onClick={() => navigate(createPageUrl('Articles'))}>
                        <ArrowRight className="w-3.5 h-3.5 mr-1.5" />Artikel bearbeiten
                    </Button>
                </Card>
            )}
        </div>
    );
}

// ── Hauptseite ────────────────────────────────────────────────────────────────
// Hinweis: Der frühere "Cocktail/Rezept"-Modus wurde entfernt — er hat parallel zum
// Getränkekarte-Modal (MenuItemModal) eigenständig neue MenuItems angelegt, was zu
// Duplikaten und einem inkonsistenten EK-Berechnungsmodell führte. Rezept-basierte
// Getränke werden jetzt ausschließlich über "Rezepte → Zur Getränkekarte" bzw. direkt
// im Getränkekarte-Modal kalkuliert & veröffentlicht (ein Workflow statt zwei Wegen).
// Dieser Rechner bleibt als schnelles Nachschlage-Tool für einzelne Artikel bestehen.
export default function PriceCalculator() {
    const permissions = usePermissions();
    const [result, setResult] = useState({ grossPrice: null, costPrice: null, foodCostPct: null, label: '' });

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn:  () => base44.entities.Article.list('name'),
    });

    if (permissions.isLoading) return null;
    if (!permissions.canViewPriceCalculator) {
        return <PermissionDenied message="Nur Administratoren haben Zugriff auf die Preiskalkulation." />;
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-2xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-5">
                    <h1 className="text-xl font-bold text-foreground">Schnellkalkulation</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Einzelartikel-Check — für Getränke aus Rezepten: Getränkekarte-Modal nutzen
                    </p>
                </div>

                <SingleMode articles={articles} onResult={setResult} />
            </div>

            {/* Sticky Footer */}
            <StickyPriceFooter
                label={result.label}
                grossPrice={result.grossPrice}
                costPrice={result.costPrice}
                foodCostPct={result.foodCostPct}
                visible={result.grossPrice != null}
            />
        </div>
    );
}
