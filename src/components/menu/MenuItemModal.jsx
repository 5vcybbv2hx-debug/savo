import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/mobile-dialog";
import { MobileModalHeader, MobileModalContent, MobileModalFooter, MobileModalForm } from "@/components/modals/MobileModalWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/mobile-select";
import { Switch } from "@/components/ui/switch";
import { Calculator, Trash2, X, TrendingUp } from "lucide-react";
import { toast } from 'sonner';
import InlineError from '@/components/ui/InlineError';
import AllergenSelector from './AllergenSelector';
import ArticleLinker from './ArticleLinker';
import RecipeSearchSelect from './RecipeSearchSelect';
import { getMenuItemSourceArticles, unionAllergensAdditives, hasAutoAllergenSource } from '@/lib/allergenSync';
import { haptics } from "@/components/utils/haptics";
import { calcRecipeCost, calcIngredientCost as calcArticleIngredientCost, roundPrice, foodCostRating } from '@/lib/recipeCosting';
import { cn } from '@/lib/utils';

// ── Shared field styling ────────────────────────────────────────────────────
const fieldClass = "h-12 text-base rounded-xl border-border/70 bg-background focus:border-primary";
const labelClass = "text-sm font-semibold text-foreground mb-1.5 block";
const hintClass  = "text-xs text-muted-foreground mt-1.5 leading-snug";

function Field({ label, hint, children, className = "" }) {
    return (
        <div className={`flex flex-col ${className}`}>
            {label && <label className={labelClass}>{label}</label>}
            {children}
            {hint && <p className={hintClass}>{hint}</p>}
        </div>
    );
}

function Section({ title, icon, children, className = "" }) {
    return (
        <div className={`rounded-2xl border border-border/60 bg-card overflow-hidden ${className}`}>
            {title && (
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/40 bg-muted/30">
                    {icon && <span className="text-muted-foreground">{icon}</span>}
                    <span className="text-sm font-bold text-foreground uppercase tracking-wide">{title}</span>
                </div>
            )}
            <div className="p-4 space-y-4">
                {children}
            </div>
        </div>
    );
}

function SwitchRow({ label, description, checked, onCheckedChange }) {
    return (
        <div className="flex items-center justify-between gap-3 py-1">
            <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}

// ───────────────────────────────────────────────────────────────────────────

export default function MenuItemModal({ item, open, onClose, onNavigate, navPosition }) {
    const queryClient = useQueryClient();
    const [formError, setFormError] = useState(null);
    const [formData, setFormData]   = useState({
        name: "", category: "Cocktails", subcategory: "", description: "",
        price: "", size: "", purchase_price: "",
        use_recipe_calculation: false, linked_recipe_id: "", linked_variant_name: null,
        is_available: true, is_seasonal: false, is_special: false,
        order_position: "", allergens_list: [], additives: [],
        alcohol_content: "", image_url: "",
        linked_article_ids: []
    });

    const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

    const { data: articles = [] } = useQuery({
        queryKey: ['articles-for-linking'],
        queryFn: () => base44.entities.Article.list('-name', 500),
        placeholderData: []
    });
    const { data: recipes = [] } = useQuery({
        queryKey: ['recipes-for-linking'],
        queryFn: () => base44.entities.Recipe.list('-name', 500),
        placeholderData: []
    });

    const sourceArticles = useMemo(
        () => getMenuItemSourceArticles(formData, articles, recipes),
        [formData.use_recipe_calculation, formData.linked_recipe_id, formData.linked_variant_name, formData.linked_article_ids, formData.linked_article_id, articles, recipes]
    );
    const autoAllergenSource = hasAutoAllergenSource(formData);
    const { allergens: autoAllergens, additives: autoAdditives } = useMemo(
        () => unionAllergensAdditives(sourceArticles),
        [sourceArticles]
    );

    useEffect(() => {
        if (!autoAllergenSource) return;
        setFormData(prev => {
            const sameA = JSON.stringify([...(prev.allergens_list || [])].sort()) === JSON.stringify([...autoAllergens].sort());
            const sameD = JSON.stringify([...(prev.additives || [])].sort()) === JSON.stringify([...autoAdditives].sort());
            if (sameA && sameD) return prev;
            return { ...prev, allergens_list: autoAllergens, additives: autoAdditives };
        });
    }, [autoAllergenSource, autoAllergens, autoAdditives]);

    useEffect(() => {
        if (item) {
            setFormData({
                ...item,
                linked_article_ids: item.linked_article_ids?.length
                    ? item.linked_article_ids
                    : item.linked_article_id ? [item.linked_article_id] : []
            });
        } else {
            // reset for new item
            setFormData({
                name: "", category: "Cocktails", subcategory: "", description: "",
                price: "", size: "", purchase_price: "",
                use_recipe_calculation: false, linked_recipe_id: "", linked_variant_name: null,
                is_available: true, is_seasonal: false, is_special: false,
                order_position: "", allergens_list: [], additives: [],
                alcohol_content: "", image_url: "",
                linked_article_ids: []
            });
        }
    }, [item, open]);

    const saveMutation = useMutation({
        mutationFn: async (data) => item?.id
            ? base44.entities.MenuItem.update(item.id, data)
            : base44.entities.MenuItem.create(data),
        onSuccess: () => {
            haptics.light();
            toast.success(item ? 'Getränk aktualisiert' : 'Getränk gespeichert');
            queryClient.invalidateQueries(['menu-items']);
            onClose();
        },
        onError: (error) => toast.error('Speichern fehlgeschlagen')
    });

    const deleteMutation = useMutation({
        mutationFn: () => base44.entities.MenuItem.delete(item.id),
        onSuccess: () => {
            haptics.light();
            toast.success('Getränk gelöscht');
            queryClient.invalidateQueries(['menu-items']);
            onClose();
        },
        onError: (error) => toast.error('Löschen fehlgeschlagen')
    });

    // ── Verknüpftes Rezept + Mischvarianten ─────────────────────────────────
    const linkedRecipe = formData.use_recipe_calculation && formData.linked_recipe_id
        ? recipes.find(r => r.id === formData.linked_recipe_id)
        : null;
    const recipeHasVariants = linkedRecipe?.mix_variants?.length > 0;

    // ── Einheitliche, live Kalkulation (eine Quelle der Wahrheit für Anzeige + Speichern) ──
    const recipeCalculatedCost = useMemo(() => {
        if (!formData.use_recipe_calculation || !linkedRecipe?.ingredients) return null;
        const hasVariants = (linkedRecipe.mix_variants || []).length > 0;
        const baseIngs = hasVariants
            ? linkedRecipe.ingredients.filter(i => i.is_base !== false)
            : linkedRecipe.ingredients;
        let variantIngredients = [];
        if (hasVariants && formData.linked_variant_name) {
            const variant = (linkedRecipe.mix_variants || []).find(v => v.name === formData.linked_variant_name);
            variantIngredients = variant?.ingredients || [];
        }
        return calcRecipeCost(baseIngs, articles, { variantIngredients });
    }, [formData.use_recipe_calculation, linkedRecipe, formData.linked_variant_name, articles]);

    // Auto-Vorschlag aus einem einzelnen verknüpften Artikel (z.B. Wein/Spirituose pur),
    // wenn kein Rezept genutzt wird und die Größe (z.B. "4cl", "0,2l") auswertbar ist.
    const singleLinkedArticle = (!formData.use_recipe_calculation && (formData.linked_article_ids || []).length === 1)
        ? articles.find(a => a.id === formData.linked_article_ids[0])
        : null;
    const articleSuggestedCost = useMemo(() => {
        if (!singleLinkedArticle || !formData.size) return null;
        const v = formData.size.toLowerCase().replace(',', '.').trim();
        const num = parseFloat(v);
        if (isNaN(num)) return null;
        let unit = null;
        if (v.includes('ml')) unit = 'ml';
        else if (v.includes('cl')) unit = 'cl';
        else if (v.includes('kg')) unit = 'kg';
        else if (v.includes('l'))  unit = 'l';
        else if (v.includes('g'))  unit = 'g';
        if (!unit) return null;
        const cost = calcArticleIngredientCost(singleLinkedArticle, num, unit);
        return cost > 0 ? cost : null;
    }, [singleLinkedArticle, formData.size]);

    const effectivePurchasePrice = formData.use_recipe_calculation
        ? recipeCalculatedCost
        : (formData.purchase_price !== '' && formData.purchase_price != null
            ? parseFloat(formData.purchase_price)
            : articleSuggestedCost);

    const currentSellPrice = formData.price ? parseFloat(formData.price) : null;
    const foodCostPct = (effectivePurchasePrice != null && currentSellPrice > 0)
        ? (effectivePurchasePrice / currentSellPrice) * 100
        : null;
    const marginAbsolute = (effectivePurchasePrice != null && currentSellPrice != null)
        ? currentSellPrice - effectivePurchasePrice
        : null;
    const rating = foodCostRating(foodCostPct);

    const applyScenario = (pct) => {
        if (effectivePurchasePrice == null || effectivePurchasePrice <= 0) return;
        const suggested = roundPrice(effectivePurchasePrice / (pct / 100));
        if (suggested != null) set('price', String(suggested));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError(null);
        if (!formData.name?.trim()) { setFormError('Name ist erforderlich.'); return; }
        if (!formData.price || isNaN(parseFloat(formData.price))) { setFormError('Bitte einen gültigen Preis eingeben.'); return; }

        let effectiveFormData = { ...formData };
        if (autoAllergenSource) {
            effectiveFormData = { ...effectiveFormData, allergens_list: autoAllergens, additives: autoAdditives };
        }
        // eslint-disable-next-line no-unused-vars
        const { margin_percentage, margin_absolute, allergens, linked_article_id, linked_article_name, ...cleanData } = effectiveFormData;
        saveMutation.mutate({
            ...cleanData,
            price:          parseFloat(formData.price),
            purchase_price: effectivePurchasePrice != null ? parseFloat(effectivePurchasePrice.toFixed(4)) : undefined,
            alcohol_content: formData.alcohol_content ? parseFloat(formData.alcohol_content) : undefined,
            order_position:  formData.order_position  ? parseInt(formData.order_position)    : undefined,
        });
    };

    const isBusy = saveMutation.isPending || deleteMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <MobileModalHeader onClose={onClose} onNavigate={item?.id ? onNavigate : undefined} navPosition={navPosition}>
                    {item?.id ? 'Getränk bearbeiten' : 'Neues Getränk'}
                </MobileModalHeader>

                <MobileModalContent>
                    <MobileModalForm
                        id="menu-item-form"
                        onSubmit={handleSubmit}
                    >
                    {formError && <InlineError message={formError} onDismiss={() => setFormError(null)} />}

                    {/* — Grunddaten — */}
                    <Section title="Grunddaten">
                        <Field label="Name *">
                            <Input
                                className={fieldClass}
                                value={formData.name}
                                onChange={e => set('name', e.target.value)}
                                placeholder="z.B. Mojito"
                                required
                            />
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Kategorie *">
                                <Select value={formData.category} onValueChange={v => set('category', v)}>
                                    <SelectTrigger className={fieldClass}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['Bier','Wein','Sekt & Champagner','Spirituosen','Longdrinks','Cocktails','Shots','Softdrinks','Heißgetränke','Moonshiner-Cocktails'].map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field label="Unterkategorie">
                                <Input
                                    className={fieldClass}
                                    value={formData.subcategory}
                                    onChange={e => set('subcategory', e.target.value)}
                                    placeholder="z.B. Rum, IPA"
                                />
                            </Field>

                            <Field label="Verkaufspreis (€) *">
                                <Input
                                    className={fieldClass}
                                    type="number" step="0.01"
                                    value={formData.price}
                                    onChange={e => set('price', e.target.value)}
                                    placeholder="7.50"
                                    required
                                />
                            </Field>

                            <Field label="Größe / Menge">
                                <Input
                                    className={fieldClass}
                                    value={formData.size}
                                    onChange={e => set('size', e.target.value)}
                                    placeholder="z.B. 0,3l · 4cl"
                                />
                            </Field>

                            <Field label="Alkoholgehalt (%)">
                                <Input
                                    className={fieldClass}
                                    type="number" step="0.1"
                                    value={formData.alcohol_content}
                                    onChange={e => set('alcohol_content', e.target.value)}
                                    placeholder="z.B. 5.2"
                                />
                            </Field>

                            <Field label="Reihenfolge">
                                <Input
                                    className={fieldClass}
                                    type="number"
                                    value={formData.order_position}
                                    onChange={e => set('order_position', e.target.value)}
                                    placeholder="1 · 2 · 3 …"
                                />
                            </Field>
                        </div>

                        <Field label="Beschreibung / Zutaten">
                            <Textarea
                                className="text-base rounded-xl border-border/70 min-h-[80px] resize-none"
                                value={formData.description}
                                onChange={e => set('description', e.target.value)}
                                placeholder="Kurze Beschreibung oder Zutatenliste"
                            />
                        </Field>

                        <Field label="Bild-URL">
                            <Input
                                className={fieldClass}
                                value={formData.image_url}
                                onChange={e => set('image_url', e.target.value)}
                                placeholder="https://..."
                            />
                        </Field>
                    </Section>

                    {/* — Kalkulation & Preis — */}
                    <Section title="Kalkulation & Preis" icon={<Calculator className="w-4 h-4" />}>
                        <SwitchRow
                            label="EK aus Rezept berechnen"
                            description="Einkaufspreis automatisch aus verknüpftem Rezept ermitteln"
                            checked={formData.use_recipe_calculation}
                            onCheckedChange={checked => setFormData(prev => ({
                                ...prev,
                                use_recipe_calculation: checked,
                                purchase_price: checked ? "" : prev.purchase_price
                            }))}
                        />

                        {formData.use_recipe_calculation ? (
                            <>
                            <Field
                                label="Rezept verknüpfen"
                                hint="EK wird automatisch aus den Artikelpreisen berechnet."
                            >
                                <RecipeSearchSelect
                                    recipes={recipes}
                                    value={formData.linked_recipe_id}
                                    onChange={v => set('linked_recipe_id', v)}
                                />
                            </Field>

                            {recipeHasVariants && (
                                <Field
                                    label="Mischvariante"
                                    hint="Basis-Zutaten + ausgewählte Variante für EK-Berechnung"
                                >
                                    <Select
                                        value={formData.linked_variant_name || "__none__"}
                                        onValueChange={v => set('linked_variant_name', v === "__none__" ? null : v)}
                                    >
                                        <SelectTrigger className={fieldClass}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Nur Basis</SelectItem>
                                            {linkedRecipe.mix_variants.map((v, i) => (
                                                <SelectItem key={i} value={v.name}>{v.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            )}
                            </>
                        ) : (
                            <Field
                                label="Einkaufspreis (€)"
                                hint={
                                    articleSuggestedCost != null && !formData.purchase_price
                                        ? `Vorschlag aus verknüpftem Artikel: ${articleSuggestedCost.toFixed(2)} € (${formData.size})`
                                        : "Manueller EK — für einfache Getränke ohne Rezept."
                                }
                            >
                                <div className="flex gap-2">
                                    <Input
                                        className={fieldClass}
                                        type="number" step="0.01"
                                        value={formData.purchase_price}
                                        onChange={e => set('purchase_price', e.target.value)}
                                        placeholder={articleSuggestedCost != null ? articleSuggestedCost.toFixed(2) : "2.50"}
                                    />
                                    {articleSuggestedCost != null && !formData.purchase_price && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-12 px-3 shrink-0 text-xs"
                                            onClick={() => set('purchase_price', articleSuggestedCost.toFixed(2))}
                                        >
                                            Übernehmen
                                        </Button>
                                    )}
                                </div>
                            </Field>
                        )}

                        {/* — Live-Kalkulation: EK, Marge, Wareneinsatz + Preisvorschläge — */}
                        {effectivePurchasePrice != null && effectivePurchasePrice > 0 && (
                            <div className={cn(
                                "rounded-xl border p-3.5 space-y-3",
                                rating === 'bad'  && "bg-destructive/10 border-destructive/30",
                                rating === 'ok'   && "bg-amber-500/10 border-amber-500/30",
                                rating === 'good' && "bg-emerald-500/10 border-emerald-500/30",
                                rating == null    && "bg-muted/40 border-border/60"
                            )}>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Einkaufspreis</span>
                                    <span className="font-semibold text-foreground">{effectivePurchasePrice.toFixed(2)} €</span>
                                </div>

                                {foodCostPct != null ? (
                                    <>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Marge</span>
                                            <span className="font-semibold text-foreground">{marginAbsolute.toFixed(2)} €</span>
                                        </div>
                                        <div className="flex items-center justify-between pt-1 border-t border-border/40">
                                            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                                <TrendingUp className="w-3.5 h-3.5" />Wareneinsatz
                                            </span>
                                            <span className={cn(
                                                "text-lg font-bold",
                                                rating === 'bad'  && "text-destructive",
                                                rating === 'ok'   && "text-amber-500",
                                                rating === 'good' && "text-emerald-600 dark:text-emerald-400"
                                            )}>
                                                {foodCostPct.toFixed(1)}%
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Verkaufspreis eingeben, um Marge & Wareneinsatz zu sehen.</p>
                                )}

                                <div className="grid grid-cols-3 gap-2 pt-1">
                                    {[{ label: 'Günstig', pct: 35 }, { label: 'Standard', pct: 28 }, { label: 'Premium', pct: 20 }].map(s => {
                                        const suggested = roundPrice(effectivePurchasePrice / (s.pct / 100));
                                        return (
                                            <button
                                                key={s.label}
                                                type="button"
                                                onClick={() => applyScenario(s.pct)}
                                                className="rounded-lg border border-border/60 bg-background/70 hover:bg-background hover:border-border px-2 py-2 text-center transition-colors"
                                            >
                                                <p className="text-[10px] font-semibold text-muted-foreground">{s.label} · {s.pct}%</p>
                                                <p className="text-xs font-bold text-foreground">{suggested != null ? suggested.toFixed(2) : '—'} €</p>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[11px] text-muted-foreground text-center">Vorschlag antippen übernimmt den Verkaufspreis oben</p>
                            </div>
                        )}
                    </Section>

                    {/* — Status — */}
                    <Section title="Veröffentlichung & Status">
                        <div className="divide-y divide-border/40">
                            <div className="pb-3">
                                <SwitchRow
                                    label="Auf Gästekarte veröffentlichen"
                                    description="Sofort sichtbar in der öffentlichen Gästekarte"
                                    checked={formData.is_available}
                                    onCheckedChange={v => set('is_available', v)}
                                />
                            </div>
                            <div className="py-3">
                                <SwitchRow
                                    label="Saisonales Angebot"
                                    description="Nur zu bestimmten Zeiten verfügbar"
                                    checked={formData.is_seasonal}
                                    onCheckedChange={v => set('is_seasonal', v)}
                                />
                            </div>
                            <div className="pt-3">
                                <SwitchRow
                                    label="Special / Tagesangebot"
                                    description="Als Highlight hervorgehoben"
                                    checked={formData.is_special}
                                    onCheckedChange={v => set('is_special', v)}
                                />
                            </div>
                        </div>
                    </Section>

                    {/* — Allergene — */}
                    <Section title="Allergene & Zusatzstoffe">
                        <AllergenSelector
                            allergensList={formData.allergens_list || []}
                            additives={formData.additives || []}
                            category={formData.category}
                            onChange={(key, val) => setFormData(prev => ({ ...prev, [key]: val }))}
                            locked={autoAllergenSource}
                        />
                    </Section>

                    {/* — Artikel verknüpfen — */}
                    <Section title="Lagerbestand verknüpfen">
                        <ArticleLinker
                            articles={articles}
                            linkedIds={formData.linked_article_ids || []}
                            onChange={ids => setFormData(prev => ({ ...prev, linked_article_ids: ids }))}
                        />
                    </Section>
                    </MobileModalForm>
                </MobileModalContent>

                <MobileModalFooter>
                    <Button
                        form="menu-item-form"
                        type="submit"
                        disabled={isBusy}
                        className="h-12 text-base font-semibold w-full rounded-xl"
                    >
                        {saveMutation.isPending ? 'Speichern…' : 'Speichern'}
                    </Button>

                    {item?.id && (
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={isBusy}
                            onClick={() => deleteMutation.mutate()}
                            className="w-full h-11 gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            {deleteMutation.isPending ? 'Löschen…' : 'Löschen'}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isBusy}
                        className="w-full h-11"
                    >
                        Abbrechen
                    </Button>
                </MobileModalFooter>

            </DialogContent>
        </Dialog>
    );
}