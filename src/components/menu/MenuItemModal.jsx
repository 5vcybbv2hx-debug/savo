import React, { useState, useEffect } from "react";
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
import { Calculator, ExternalLink, Trash2, X, ChevronRight } from "lucide-react";
import { toast } from 'sonner';
import InlineError from '@/components/ui/InlineError';
import AllergenSelector from './AllergenSelector';
import ArticleLinker from './ArticleLinker';
import RecipeSearchSelect from './RecipeSearchSelect';
import { haptics } from "@/components/utils/haptics";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

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

export default function MenuItemModal({ item, open, onClose }) {
    const queryClient = useQueryClient();
    const navigate    = useNavigate();
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError(null);
        if (!formData.name?.trim()) { setFormError('Name ist erforderlich.'); return; }
        if (!formData.price || isNaN(parseFloat(formData.price))) { setFormError('Bitte einen gültigen Preis eingeben.'); return; }

        let effectiveFormData = { ...formData };
        let calculatedPurchasePrice = formData.purchase_price ? parseFloat(formData.purchase_price) : undefined;

        if (formData.use_recipe_calculation && formData.linked_recipe_id) {
            const recipe = recipes.find(r => r.id === formData.linked_recipe_id);
            if (recipe?.ingredients) {
                const hasVariants = (recipe.mix_variants || []).length > 0;
                const baseIngs = hasVariants
                    ? recipe.ingredients.filter(i => i.is_base !== false)
                    : recipe.ingredients;
                let effectiveIngs = baseIngs;
                if (hasVariants && formData.linked_variant_name) {
                    const variant = (recipe.mix_variants || []).find(v => v.name === formData.linked_variant_name);
                    effectiveIngs = [...baseIngs, ...(variant?.ingredients || [])];
                }
                const mergedAllergens = new Set(formData.allergens_list || []);
                const mergedAdditives = new Set(formData.additives || []);
                let totalCost = 0;
                effectiveIngs.forEach(ingredient => {
                    const article = articles.find(a => a.id === ingredient.article_id);
                    (article?.allergens_list || []).forEach(a => mergedAllergens.add(a));
                    (article?.additives || []).forEach(d => mergedAdditives.add(d));
                    if (article?.price_per_liter && ingredient.amount) {
                        const unit = ingredient.unit || 'ml';
                        let liters = 0;
                        switch (unit.toLowerCase()) {
                            case 'ml':  liters = ingredient.amount / 1000; break;
                            case 'cl':  liters = ingredient.amount / 100;  break;
                            case 'l':   liters = ingredient.amount;        break;
                            case 'g':   liters = ingredient.amount / 1000; break;
                            case 'kg':  liters = ingredient.amount;        break;
                            case 'stk': case 'stück':
                                totalCost += (article.purchase_price || 0) * ingredient.amount; return;
                        }
                        if (liters > 0) totalCost += liters * article.price_per_liter;
                    }
                });
                calculatedPurchasePrice = totalCost;
                effectiveFormData = { ...effectiveFormData, allergens_list: [...mergedAllergens], additives: [...mergedAdditives] };
            }
        } else if (formData.linked_article_id && !formData.use_recipe_calculation) {
            const linkedArticle = articles.find(a => a.id === formData.linked_article_id);
            if (linkedArticle?.purchase_price) {
                const parseServingSize = (s) => {
                    if (!s) return 0;
                    const v = s.toLowerCase().replace(',', '.');
                    if (v.includes('ml')) return (parseFloat(v) || 0) / 1000;
                    if (v.includes('cl')) return (parseFloat(v) || 0) / 100;
                    if (v.includes('l'))  return parseFloat(v) || 0;
                    return 0;
                };
                const serving = parseServingSize(formData.size);
                calculatedPurchasePrice = serving > 0
                    ? (linkedArticle.purchase_price / (linkedArticle.unit_size || 1)) * serving
                    : linkedArticle.purchase_price;
            }
        }

        // eslint-disable-next-line no-unused-vars
        const { margin_percentage, margin_absolute, allergens, linked_article_id, linked_article_name, ...cleanData } = effectiveFormData;
        saveMutation.mutate({
            ...cleanData,
            price:          parseFloat(formData.price),
            purchase_price: calculatedPurchasePrice,
            alcohol_content: formData.alcohol_content ? parseFloat(formData.alcohol_content) : undefined,
            order_position:  formData.order_position  ? parseInt(formData.order_position)    : undefined,
        });
    };

    const isBusy = saveMutation.isPending || deleteMutation.isPending;

    // Verknüpftes Rezept + Mischvarianten
    const linkedRecipe = formData.use_recipe_calculation && formData.linked_recipe_id
        ? recipes.find(r => r.id === formData.linked_recipe_id)
        : null;
    const recipeHasVariants = linkedRecipe?.mix_variants?.length > 0;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <MobileModalHeader onClose={onClose}>
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

                    {/* — Margenberechnung — */}
                    <Section title="Margenberechnung" icon={<Calculator className="w-4 h-4" />}>
                        <div className="flex items-center justify-between">
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
                        </div>

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
                                hint="Manueller EK — für einfache Getränke ohne Rezept."
                            >
                                <Input
                                    className={fieldClass}
                                    type="number" step="0.01"
                                    value={formData.purchase_price}
                                    onChange={e => set('purchase_price', e.target.value)}
                                    placeholder="2.50"
                                />
                            </Field>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                navigate(createPageUrl('PriceCalculator') + (formData.linked_recipe_id ? '?recipe=' + formData.linked_recipe_id : ''));
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted/50 hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border border-border/40"
                        >
                            <span className="flex items-center gap-2">
                                <ExternalLink className="w-4 h-4" />
                                Zum Preisrechner
                            </span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </Section>

                    {/* — Status — */}
                    <Section title="Status & Anzeige">
                        <div className="divide-y divide-border/40">
                            <div className="pb-3">
                                <SwitchRow
                                    label="Verfügbar"
                                    description="Getränk wird in der Karte angezeigt"
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