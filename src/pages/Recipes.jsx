/**
 * Recipes — Rezeptverwaltung
 * - Semantische Theme-Tokens (kein slate-* hardcoding)
 * - Pill-Chips statt native <select>
 * - Kompakte Karten → Detail-Dialog
 * - ··· Menü für seltenere Aktionen
 * - toast() statt alert(), AlertDialog statt window.confirm()
 * - Kostenberechnung als Utility-Funktion (DRY)
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { CompanyInfo } from '@/api/entities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { calcIngredientCost as sharedCalcIngredientCost } from '@/lib/recipeCosting';
import {
    Plus, Search, Wine, Trash2, Edit, Settings, ShoppingCart,
    Lightbulb, CheckSquare, X, Sparkles, ChefHat, MoreVertical,
    FileText, Snowflake, GlassWater, UtensilsCrossed, StickyNote,
    Minus, CreditCard, Download
} from 'lucide-react';
import { usePermissions } from '@/components/auth/usePermissions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import IngredientSelector from '@/components/recipes/IngredientSelector';
import PDFExportButton from '@/components/export/PDFExportButton';
import SlushyRecipeCard from '@/components/recipes/SlushyRecipeCard';
import { unionAllergensAdditives } from '@/lib/allergenSync';

// ── Kategorien ────────────────────────────────────────────────────────────────
const DEFAULT_STANDARD_CATEGORIES = ['Cocktail', 'Shot', 'Longdrink', 'Mocktail', 'Moonshiner-Cocktails', 'Sonstiges'];
const DEFAULT_SLUSHY_CATEGORIES = ['Vodka', 'Rum', 'Gin', 'Whiskey', 'Likör', 'Alkoholfrei', 'Sonstiges'];

const CATEGORY_COLORS = {
    'Cocktail':             'bg-pink-500/12 text-pink-400 border-pink-500/25',
    'Shot':                 'bg-orange-500/12 text-orange-400 border-orange-500/25',
    'Longdrink':            'bg-blue-500/12 text-blue-400 border-blue-500/25',
    'Mocktail':             'bg-green-500/12 text-green-400 border-green-500/25',
    'Moonshiner-Cocktails': 'bg-amber-500/12 text-amber-400 border-amber-500/25',
    'Sonstiges':            'bg-secondary text-muted-foreground border-border',
};

// ── Kostenberechnung (DRY, zentrale Utility — siehe src/lib/recipeCosting.js) ──
function calcIngredientCost(ing, article) {
    return sharedCalcIngredientCost(article, ing.amount, ing.unit);
}

function calcTotalCost(ingredients, articles, scaleFactor = 1) {
    const list = Array.isArray(ingredients) ? ingredients : [];
    return list.reduce((sum, ing) => {
        const article = articles.find(a => a.id === ing.article_id);
        return sum + calcIngredientCost({ ...ing, amount: ing.amount * scaleFactor }, article);
    }, 0);
}

function getScaledIngredients(ingredients, originalServings, viewServings) {
    const factor = viewServings / (originalServings || 1);
    return (ingredients || []).map(ing => ({
        ...ing,
        amount: Math.round(ing.amount * factor * 10) / 10,
    }));
}

// ── Detail-Dialog ─────────────────────────────────────────────────────────────
function RecipeDetailDialog({ recipe, articles, permissions, open, onClose, onEdit, onDelete }) {
    const navigate = useNavigate();
    const [servings, setServings] = useState(recipe?.servings || 1);
    const [activeVariant, setActiveVariant] = useState(null); // null = Basis, index = Variante

    if (!recipe) return null;

    const scaleFactor = servings / (recipe.servings || 1);
    const isLongdrink = recipe.category === 'Longdrink';
    const hasVariants = isLongdrink && recipe.mix_variants?.length > 0;

    // Aktuelle Variante bestimmen
    const currentVariantIngredients = hasVariants && activeVariant !== null
        ? (recipe.mix_variants[activeVariant]?.ingredients || [])
        : [];
    // Basis = feste Zutaten (is_base oder wenn keine Varianten vorhanden: alle)
    const baseIngredients = hasVariants
        ? (recipe.ingredients || []).filter(i => i.is_base !== false)
        : (recipe.ingredients || []);
    // Angezeigte Zutaten = Basis + aktive Variante
    const displayIngredients = hasVariants && activeVariant !== null
        ? [...baseIngredients, ...currentVariantIngredients]
        : (recipe.ingredients || []);

    const scaledIngredients = getScaledIngredients(displayIngredients, recipe.servings || 1, servings);
    const totalCost = calcTotalCost(displayIngredients, articles, scaleFactor);
    const catColor  = CATEGORY_COLORS[recipe.category] || CATEGORY_COLORS['Sonstiges'];

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-start justify-between gap-3 pr-6">
                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-xl leading-snug">{recipe.name}</DialogTitle>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', catColor)}>
                                    {recipe.category}
                                </span>
                                {recipe.glass_type && (
                                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <GlassWater className="w-3 h-3" />{recipe.glass_type}
                                    </span>
                                )}
                                {recipe.garnish && (
                                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <UtensilsCrossed className="w-3 h-3" />{recipe.garnish}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    {/* Bild */}
                    {recipe.image_url && (
                        <img src={recipe.image_url} alt={recipe.name}
                            className="w-full h-44 object-cover rounded-xl border border-border/50" />
                    )}

                    {/* Varianten-Chips für Longdrinks */}
                    {hasVariants && (
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                                Mischvarianten
                            </p>
                            <div className="flex gap-1.5 flex-wrap">
                                <button
                                    onClick={() => setActiveVariant(null)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                        activeVariant === null
                                            ? 'bg-blue-500 border-blue-500 text-white'
                                            : 'border-border text-muted-foreground bg-card hover:text-foreground'
                                    )}>
                                    Nur Basis
                                </button>
                                {recipe.mix_variants.map((v, i) => (
                                    <button key={i}
                                        onClick={() => setActiveVariant(i)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                            activeVariant === i
                                                ? 'bg-blue-500 border-blue-500 text-white'
                                                : 'border-border text-muted-foreground bg-card hover:text-foreground'
                                        )}>
                                        {v.name || `Variante ${i + 1}`}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Zutaten + Skalierung */}
                    {recipe.ingredients?.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    {hasVariants ? (activeVariant !== null ? `Zutaten (${recipe.mix_variants[activeVariant]?.name || 'Variante'})` : 'Basis-Zutaten') : 'Zutaten'}
                                </p>
                                {/* Skalierung */}
                                <div className="flex items-center gap-1.5 bg-secondary rounded-full px-2 py-0.5">
                                    <button onClick={() => setServings(s => Math.max(1, s - 1))}
                                        className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="text-xs font-semibold text-foreground min-w-[24px] text-center">
                                        {servings}×
                                    </span>
                                    <button onClick={() => setServings(s => s + 1)}
                                        className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                {scaledIngredients.map((ing, idx) => {
                                    const article = articles.find(a => a.id === ing.article_id);
                                    const cost = calcIngredientCost(ing, article);
                                    return (
                                        <div key={idx} className="flex items-center justify-between text-sm">
                                            <span className="text-foreground">
                                                <span className="font-semibold text-amber-500">
                                                    {ing.amount}{ing.unit || 'ml'}
                                                </span>
                                                {' '}{ing.article_name}
                                            </span>
                                            {permissions.isManager && cost > 0 && (
                                                <span className="text-xs text-green-400 font-medium ml-2 shrink-0">
                                                    {cost.toFixed(2)} €
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Gesamtkosten */}
                            {permissions.isManager && totalCost > 0 && (
                                <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <CreditCard className="w-3 h-3" />EK gesamt
                                    </span>
                                    <span className="text-sm font-bold text-green-400">{totalCost.toFixed(2)} €</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Zubereitung */}
                    {recipe.preparation && (
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                                Zubereitung
                            </p>
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                                {recipe.preparation}
                            </p>
                        </div>
                    )}

                    {/* Notizen */}
                    {recipe.notes && (
                        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3">
                            <p className="text-xs font-bold text-amber-400 mb-1 flex items-center gap-1">
                                <StickyNote className="w-3 h-3" />Notiz
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{recipe.notes}</p>
                        </div>
                    )}
                </div>

                {permissions.isManager && (
                    <DialogFooter className="gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => { onClose(); onDelete(recipe.id); }}
                            className="text-destructive border-destructive/30 hover:bg-destructive/10">
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />Löschen
                        </Button>
                        <Button variant="outline" size="sm"
                            onClick={() => {
                                onClose();
                                const variantName = activeVariant !== null
                                    ? recipe.mix_variants[activeVariant]?.name
                                    : null;
                                const url = createPageUrl('DrinkMenu') + '?recipe=' + recipe.id
                                    + (variantName ? '&variant=' + encodeURIComponent(variantName) : '');
                                navigate(url);
                            }}
                            className="border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                        >
                            <Wine className="w-3.5 h-3.5 mr-1.5" />Zur Getränkekarte
                        </Button>
                        <Button size="sm" onClick={() => { onClose(); onEdit(recipe); }}
                            className="bg-amber-600 hover:bg-amber-700 text-white flex-1">
                            <Edit className="w-3.5 h-3.5 mr-1.5" />Bearbeiten
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── Kompakte Rezept-Karte ─────────────────────────────────────────────────────
function RecipeCard({ recipe, articles, permissions, onSelect, isSelected, onClick }) {
    const catColor  = CATEGORY_COLORS[recipe.category] || CATEGORY_COLORS['Sonstiges'];
    const totalCost = calcTotalCost(recipe.ingredients, articles);
    const ingCount  = recipe.ingredients?.length || 0;

    return (
        <div
            className={cn(
                'group relative border rounded-xl p-3.5 cursor-pointer transition-all bg-card',
                isSelected
                    ? 'border-amber-500 bg-amber-500/5'
                    : 'border-border/60 hover:border-border'
            )}
            onClick={onClick}
        >
            {/* Checkbox für Multi-Selektion */}
            {permissions.isManager && (
                <button
                    onClick={e => { e.stopPropagation(); onSelect(recipe.id); }}
                    className={cn(
                        'absolute top-3 right-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                        isSelected
                            ? 'bg-amber-500 border-amber-500'
                            : 'border-border opacity-0 group-hover:opacity-100 bg-card'
                    )}>
                    {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
                </button>
            )}

            {/* Bild */}
            {recipe.image_url && (
                <div className="w-full h-28 rounded-lg overflow-hidden mb-3 border border-border/40">
                    <img src={recipe.image_url} alt={recipe.name}
                        className="w-full h-full object-cover" />
                </div>
            )}

            {/* Name + Kategorie */}
            <p className="font-semibold text-sm text-foreground leading-snug mb-1.5 pr-6">
                {recipe.name}
            </p>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-block', catColor)}>
                {recipe.category}
            </span>

            {/* Meta-Infos */}
            <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground flex-wrap">
                {ingCount > 0 && <span>{ingCount} Zutat{ingCount !== 1 ? 'en' : ''}</span>}
                {recipe.glass_type && <span>· {recipe.glass_type}</span>}
                {permissions.isManager && totalCost > 0 && (
                    <span className="text-green-400 font-medium">· {totalCost.toFixed(2)} €</span>
                )}
            </div>

            {/* Notiz-Vorschau */}
            {recipe.notes && (
                <div className="mt-2.5 flex items-start gap-1.5 bg-amber-500/8 border border-amber-500/20 rounded-lg p-2">
                    <StickyNote className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{recipe.notes}</p>
                </div>
            )}
        </div>
    );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function Recipes() {
    const permissions  = usePermissions();
    const queryClient  = useQueryClient();

    // Modal-States
    const [modalOpen,          setModalOpen]          = useState(false);
    const [selectedRecipe,     setSelectedRecipe]     = useState(null);
    const [detailRecipe,       setDetailRecipe]       = useState(null);
    const [deleteTarget,       setDeleteTarget]       = useState(null);
    const [similarModal,       setSimilarModal]       = useState(false);
    const [similarRecipe,      setSimilarRecipe]      = useState(null);
    const [categoriesOpen,     setCategoriesOpen]     = useState(false);
    const [newCatInput,        setNewCatInput]        = useState('');
    const [standardCategories, setStandardCategories] = useState(DEFAULT_STANDARD_CATEGORIES);
    const [slushyCategories,   setSlushyCategories]   = useState(DEFAULT_SLUSHY_CATEGORIES);

    const persistCategories = async (nextStandard, nextSlushy) => {
        if (!companyInfo?.id) return;
        let currentStates = {};
        try { currentStates = companyInfo.module_states ? JSON.parse(companyInfo.module_states) : {}; } catch { currentStates = {}; }
        currentStates.recipe_categories = { standard: nextStandard, slushy: nextSlushy };
        await CompanyInfo.update(companyInfo.id, {
            module_states: JSON.stringify(currentStates)
        });
        queryClient.invalidateQueries({ queryKey: ['companyInfo'] });
    };



    const addCategory = (type) => {
        const name = newCatInput.trim();
        if (!name) return;
        if (type === 'standard' && !standardCategories.includes(name)) {
            const next = [...standardCategories, name];
            setStandardCategories(next);
            persistCategories(next, slushyCategories);
        } else if (type === 'slushy' && !slushyCategories.includes(name)) {
            const next = [...slushyCategories, name];
            setSlushyCategories(next);
            persistCategories(standardCategories, next);
        }
        setNewCatInput('');
    };

    const removeCategory = (type, cat) => {
        if (type === 'standard') {
            const next = standardCategories.filter(c => c !== cat);
            setStandardCategories(next);
            persistCategories(next, slushyCategories);
        } else {
            const next = slushyCategories.filter(c => c !== cat);
            setSlushyCategories(next);
            persistCategories(standardCategories, next);
        }
    };

    // Filter
    const [searchQuery,        setSearchQuery]        = useState('');
    const [categoryFilter,     setCategoryFilter]     = useState('alle');
    const [ingredientFilter,   setIngredientFilter]   = useState('');
    const [activeTab,          setActiveTab]          = useState('standard');

    // Multi-Selektion
    const [selectedRecipes,    setSelectedRecipes]    = useState(new Set());

    // Skalierung (pro Rezept-ID)
    const [viewServings,       setViewServings]       = useState({});

    // KI-Status
    const [suggestingIngredients,    setSuggestingIngredients]    = useState(false);
    const [generatingFromInventory,  setGeneratingFromInventory]  = useState(false);
    const [uploadingImage,           setUploadingImage]           = useState(false);

    const [formData, setFormData] = useState({
        name: '', category: 'Cocktail', recipe_type: 'standard',
        slushy_spirit_base: '', slushy_original_volume_liters: null,
        servings: 1, ingredients: [], mix_variants: [], preparation: '',
        glass_type: '', garnish: '', notes: '', image_url: '',
        alcohol_content: null,
    });

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: recipes  = [] } = useQuery({ queryKey: ['recipes'],  queryFn: () => base44.entities.Recipe.list('name', 500),   staleTime: STALE.SLOW });
    const { data: companyInfo } = useQuery({
        queryKey: ['companyInfo'],
        queryFn: async () => {
            const list = await CompanyInfo.list();
            return list[0] || null;
        },
        staleTime: STALE.SLOW,
    });

    // Gespeicherte Kategorien laden, sobald companyInfo verfügbar ist
    React.useEffect(() => {
        if (!companyInfo?.module_states) return;
        const saved = companyInfo.module_states?.recipe_categories;
        if (saved?.standard?.length) setStandardCategories(saved.standard);
        if (saved?.slushy?.length)   setSlushyCategories(saved.slushy);
    }, [companyInfo]);

    const { data: articles = [] } = useQuery({ queryKey: ['articles'], queryFn: () => base44.entities.Article.list('name', 500),  staleTime: STALE.SLOW });
    const { data: menuItems = [] } = useQuery({ queryKey: ['menu-items'], queryFn: () => base44.entities.MenuItem.list('name', 500), staleTime: STALE.SLOW });

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: d => base44.entities.Recipe.create(d),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recipes'] }); closeModal(); toast.success('Rezept erstellt'); },
        onError:   e => toast.error('Fehler: ' + (e?.message || 'Unbekannt')),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            // ── 1. Rezept speichern ──────────────────────────────────────────
            const updated = await base44.entities.Recipe.update(id, data);

            // ── 2. Verknüpfte MenuItems synchronisieren ──────────────────────
            try {
                const allMenuItems = await base44.entities.MenuItem.list('name', 500);
                const linked = allMenuItems.filter(mi => mi.linked_recipe_id === id);
                if (linked.length > 0) {
                    // EK-Preis aus Rezept-Zutaten neu berechnen (varianten-aware)
                    const allArticles = await base44.entities.Article.list('name', 500);
                    const hasVariants = (data.mix_variants || []).length > 0;
                    const baseIngs = hasVariants
                        ? (data.ingredients || []).filter(i => i.is_base !== false)
                        : (data.ingredients || []);
                    const calcEK = (ingredients) => {
                        if (!ingredients?.length) return null;
                        return ingredients.reduce((sum, ing) => {
                            const art = allArticles.find(a => a.id === ing.article_id);
                            return sum + (art?.purchase_price || 0) * (parseFloat(ing.amount) || 0);
                        }, 0);
                    };
                    const computeAllergensAdditives = (ingredients) => unionAllergensAdditives(
                        (ingredients || []).map(ing => allArticles.find(a => a.id === ing.article_id)).filter(Boolean)
                    );
                    await Promise.all(linked.map(mi => {
                        let effectiveIngs = baseIngs;
                        if (hasVariants && mi.linked_variant_name) {
                            const variant = (data.mix_variants || []).find(v => v.name === mi.linked_variant_name);
                            effectiveIngs = [...baseIngs, ...(variant?.ingredients || [])];
                        }
                        const newEK = calcEK(effectiveIngs);
                        const { allergens: mergedAllergens, additives: mergedAdditives } = computeAllergensAdditives(effectiveIngs);
                        const syncData = {
                            ...(data.name && { name: mi.linked_variant_name ? `${data.name} – ${mi.linked_variant_name}` : data.name }),
                            ...(newEK !== null && { purchase_price: newEK }),
                            allergens_list: mergedAllergens,
                            additives: mergedAdditives,
                            ...(data.alcohol_content != null && { alcohol_content: data.alcohol_content }),
                        };
                        return base44.entities.MenuItem.update(mi.id, syncData);
                    }));
                }
            } catch (syncErr) {
                console.warn('[Recipes] MenuItem-Sync fehlgeschlagen:', syncErr);
            }
            return updated;
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
            queryClient.invalidateQueries({ queryKey: ['menu-items'] });
            closeModal();
            toast.success('Rezept gespeichert & Karte aktualisiert');
        },
        onError: e => toast.error('Fehler: ' + (e?.message || 'Unbekannt')),
    });

    const deleteMutation = useMutation({
        mutationFn: id => base44.entities.Recipe.delete(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recipes'] }); toast.success('Rezept gelöscht'); setDeleteTarget(null); },
        onError:   () => toast.error('Löschen fehlgeschlagen'),
    });

    const createShoppingMutation = useMutation({
        mutationFn: d => base44.entities.ShoppingList.create(d),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-list'] }),
    });

    // ── Filter-Logik ──────────────────────────────────────────────────────────
    const standardRecipes = useMemo(() => recipes.filter(r => r.recipe_type !== 'slushy'), [recipes]);
    const slushyRecipes   = useMemo(() => recipes.filter(r => r.recipe_type === 'slushy'),  [recipes]);

    const filteredRecipes = useMemo(() => {
        const base = activeTab === 'slushy' ? slushyRecipes : standardRecipes;
        return base.filter(r => {
            if (categoryFilter !== 'alle' && r.category !== categoryFilter) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!r.name?.toLowerCase().includes(q) && !r.preparation?.toLowerCase().includes(q)) return false;
            }
            if (ingredientFilter) {
                const qI = ingredientFilter.toLowerCase();
                const hasIng = (r.ingredients || []).some(i => i.article_name?.toLowerCase().includes(qI));
                if (!hasIng) return false;
            }
            return true;
        });
    }, [recipes, activeTab, categoryFilter, searchQuery, ingredientFilter, standardRecipes, slushyRecipes]);

    const activeCategories = activeTab === 'slushy' ? slushyCategories : standardCategories;

    // ── Modal Helpers ─────────────────────────────────────────────────────────
    const openModal = (recipe = null) => {
        if (recipe) {
            setSelectedRecipe(recipe);
            setFormData({
                    name: recipe.name, category: recipe.category,
                    recipe_type: recipe.recipe_type || 'standard',
                    slushy_spirit_base: recipe.slushy_spirit_base || '',
                    slushy_original_volume_liters: recipe.slushy_original_volume_liters || '',
                    servings: recipe.servings || 1,
                    ingredients: recipe.ingredients || [],
                    mix_variants: recipe.mix_variants || [],
                    preparation: recipe.preparation || '',
                    glass_type: recipe.glass_type || '',
                    garnish: recipe.garnish || '',
                    notes: recipe.notes || '',
                    image_url: recipe.image_url || '',
                    alcohol_content: recipe.alcohol_content ?? null,
                });
        } else {
            setSelectedRecipe(null);
            setFormData({
                name: '', category: categoryFilter !== 'alle' ? categoryFilter : 'Cocktail',
                recipe_type: activeTab === 'slushy' ? 'slushy' : 'standard',
                slushy_spirit_base: '', slushy_original_volume_liters: '',
                servings: 1, ingredients: [], mix_variants: [], preparation: '',
                glass_type: '', garnish: '', notes: '', image_url: '',
                alcohol_content: null,
            });
        }
        setModalOpen(true);
    };

    const closeModal = () => { setModalOpen(false); setSelectedRecipe(null); };

    const handleSave = () => {
        // Numerische Felder: leerer String → null (API-Validierung)
        const cleanData = {
            ...formData,
            slushy_original_volume_liters:
                formData.slushy_original_volume_liters === '' || formData.slushy_original_volume_liters == null
                    ? null : Number(formData.slushy_original_volume_liters),
            alcohol_content:
                formData.alcohol_content === '' || formData.alcohol_content == null
                    ? null : Number(formData.alcohol_content),
        };
        if (!formData.name.trim()) { toast.error('Name ist erforderlich'); return; }
        if (selectedRecipe) {
            updateMutation.mutate({ id: selectedRecipe.id, data: cleanData });
        } else {
            createMutation.mutate(cleanData);
        }
    };

    // ── Bild-Upload ───────────────────────────────────────────────────────────
    const handleImageUpload = async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImage(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            setFormData(f => ({ ...f, image_url: file_url }));
            toast.success('Bild hochgeladen');
        } catch {
            toast.error('Fehler beim Hochladen');
        } finally {
            setUploadingImage(false);
        }
    };

    // ── KI-Aktionen ───────────────────────────────────────────────────────────
    const suggestIngredients = async () => {
        if (!formData.name) { toast.error('Bitte zuerst einen Namen eingeben'); return; }
        setSuggestingIngredients(true);
        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Du bist ein professioneller Barkeeper. Erstelle eine Zutatenliste für: "${formData.name}".
Verfügbare Artikel: ${JSON.stringify(articles.map(a => ({ id: a.id, name: a.name, category: a.category })))}
WICHTIG: Nutze NUR Artikel aus der Liste. Antworte mit JSON: {"ingredients":[{"article_id":"...","article_name":"...","amount":40,"unit":"ml"}]}`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        ingredients: { type: "array", items: { type: "object",
                            properties: { article_id: {type:"string"}, article_name: {type:"string"}, amount: {type:"number"}, unit: {type:"string"} }
                        }}
                    }
                }
            });
            if (result.ingredients?.length) {
                setFormData(f => ({ ...f, ingredients: result.ingredients }));
                toast.success(`${result.ingredients.length} Zutaten vorgeschlagen`);
            }
        } catch { toast.error('KI-Vorschlag fehlgeschlagen'); }
        finally  { setSuggestingIngredients(false); }
    };

    const generateRecipeFromInventory = async () => {
        setGeneratingFromInventory(true);
        try {
            const available = articles.filter(a => a.current_stock > 0).map(a => ({ id: a.id, name: a.name, category: a.category, stock: a.current_stock }));
            if (!available.length) { toast.error('Kein Bestand im Inventar'); return; }
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Du bist ein kreativer Barkeeper. Erstelle ein Cocktail-Rezept aus diesen Artikeln: ${JSON.stringify(available)}.
Antworte mit JSON: {"name":"...","category":"Cocktail","servings":1,"ingredients":[...],"preparation":"...","glass_type":"...","garnish":"..."}`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        name: {type:"string"}, category: {type:"string"}, servings: {type:"number"},
                        ingredients: {type:"array"}, preparation: {type:"string"},
                        glass_type: {type:"string"}, garnish: {type:"string"}
                    }
                }
            });
            if (result.name) {
                setSelectedRecipe(null);
                setFormData({ ...result, recipe_type: 'standard', slushy_spirit_base: '', slushy_original_volume_liters: '', notes: '', image_url: '' });
                setModalOpen(true);
                toast.success(`KI-Rezept „${result.name}" erstellt`);
            }
        } catch { toast.error('KI-Generierung fehlgeschlagen'); }
        finally  { setGeneratingFromInventory(false); }
    };

    // ── Einkaufsliste ─────────────────────────────────────────────────────────
    const generateShoppingList = async () => {
        const selected = recipes.filter(r => selectedRecipes.has(r.id));
        const map = new Map();
        selected.forEach(r => {
            (r.ingredients || []).forEach(ing => {
                if (map.has(ing.article_id)) {
                    map.get(ing.article_id).amount += ing.amount;
                } else {
                    map.set(ing.article_id, { ...ing });
                }
            });
        });
        try {
            for (const [, ing] of map) {
                await createShoppingMutation.mutateAsync({
                    item_name: ing.article_name, category: 'C+C',
                    quantity: Math.ceil(ing.amount / 100), unit: 'Stück', status: 'offen',
                    notes: `${ing.amount}ml gesamt · Für: ${selected.map(r => r.name).join(', ')}`
                });
            }
            toast.success(`${map.size} Artikel zur Einkaufsliste hinzugefügt`);
            setSelectedRecipes(new Set());
        } catch { toast.error('Fehler beim Erstellen der Einkaufsliste'); }
    };

    // ── CSV-Export ────────────────────────────────────────────────────────────
    const exportCSV = () => {
        const headers = ['Name', 'Kategorie', 'Typ', 'Portionen', 'Glas', 'Garnitur', 'Alkohol (%)', 'Zutaten', 'Zubereitung', 'Notizen'];
        const rows = filteredRecipes.map(r => [
            r.name || '',
            r.category || '',
            r.recipe_type || 'standard',
            r.servings ?? '',
            r.glass_type || '',
            r.garnish || '',
            r.alcohol_content ?? '',
            (r.ingredients || []).map(i => `${i.article_name || ''} ${i.amount}${i.unit || ''}`).join('; '),
            (r.preparation || '').replace(/\n/g, ' '),
            (r.notes || '').replace(/\n/g, ' '),
        ]);
        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rezepte_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${filteredRecipes.length} Rezepte exportiert`);
    };

    const exportAllCSV = () => {
        const headers = ['Name', 'Kategorie', 'Typ', 'Portionen', 'Glas', 'Garnitur', 'Alkohol (%)', 'Zutaten', 'Zubereitung', 'Notizen'];
        const rows = recipes.map(r => [
            r.name || '',
            r.category || '',
            r.recipe_type || 'standard',
            r.servings ?? '',
            r.glass_type || '',
            r.garnish || '',
            r.alcohol_content ?? '',
            (r.ingredients || []).map(i => `${i.article_name || ''} ${i.amount}${i.unit || ''}`).join('; '),
            (r.preparation || '').replace(/\n/g, ' '),
            (r.notes || '').replace(/\n/g, ' '),
        ]);
        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rezepte_alle_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${recipes.length} Rezepte exportiert`);
    };

    // ── Ähnliche Rezepte ──────────────────────────────────────────────────────
    const findSimilarRecipes = recipe => {
        if (!recipe) return [];
        const currIds = (recipe.ingredients || []).map(i => i.article_id);
        return recipes
            .filter(r => r.id !== recipe.id)
            .map(r => {
                let score = r.category === recipe.category ? 3 : 0;
                const otherIds = (r.ingredients || []).map(i => i.article_id);
                currIds.forEach(id => { if (otherIds.includes(id)) score += 2; });
                return { recipe: r, score };
            })
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(x => x.recipe);
    };

    const toggleSelect = id =>
        setSelectedRecipes(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Rezepte</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {recipes.length} Rezept{recipes.length !== 1 ? 'e' : ''}
                        </p>
                    </div>
                    {permissions.isManager && (
                        <div className="flex items-center gap-2">
                            {/* ··· Mehr-Menü */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9">
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuItem onClick={generateRecipeFromInventory} disabled={generatingFromInventory}>
                                        <ChefHat className="w-4 h-4 mr-2" />
                                        {generatingFromInventory ? 'Generiere…' : 'KI-Rezept aus Inventar'}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={e => { e.preventDefault(); setCategoriesOpen(true); }}>
                                        <Settings className="w-4 h-4 mr-2" />
                                        Kategorien verwalten
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <PDFExportButton
                                        data={filteredRecipes}
                                        filename="rezepte"
                                        title="Rezepte"
                                        columns={[
                                            { label: 'Name', field: 'name' },
                                            { label: 'Kategorie', field: 'category' },
                                            { label: 'Zutaten', render: r => r.ingredients?.length || 0 },
                                            { label: 'Glas', field: 'glass_type' },
                                        ]}
                                        variant="ghost"
                                        className="w-full justify-start px-2 text-sm font-normal h-8"
                                        label={<><FileText className="w-4 h-4 mr-2" />PDF exportieren</>}
                                    />
                                    <DropdownMenuItem onClick={exportCSV}>
                                        <Download className="w-4 h-4 mr-2" />
                                        CSV exportieren (gefiltert)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={exportAllCSV}>
                                        <Download className="w-4 h-4 mr-2" />
                                        CSV exportieren (alle)
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* + Neu */}
                            <Button size="sm" onClick={() => openModal()}
                                className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                                <Plus className="w-4 h-4" />
                                <span className="hidden sm:inline">Neues Rezept</span>
                            </Button>
                        </div>
                    )}
                </div>

                {/* ── Tab Switcher ────────────────────────────────────────── */}
                <div className="flex gap-1 p-1 bg-secondary border border-border rounded-xl">
                    <button onClick={() => { setActiveTab('standard'); setCategoryFilter('alle'); }}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all',
                            activeTab === 'standard' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}>
                        <Wine className="w-4 h-4" />
                        Cocktails <span className="opacity-60 text-xs">({standardRecipes.length})</span>
                    </button>
                    <button onClick={() => { setActiveTab('slushy'); setCategoryFilter('alle'); }}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all',
                            activeTab === 'slushy' ? 'bg-cyan-500/15 text-cyan-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}>
                        <Snowflake className="w-4 h-4" />
                        Slushy <span className="opacity-60 text-xs">({slushyRecipes.length})</span>
                    </button>
                </div>

                {/* ── Suche ───────────────────────────────────────────────── */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Rezept suchen…" value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 h-10" />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div className="relative w-40">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Zutat…" value={ingredientFilter}
                            onChange={e => setIngredientFilter(e.target.value)}
                            className="pl-9 h-10" />
                    </div>
                </div>

                {/* ── Kategorie-Chips ─────────────────────────────────────── */}
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                    <button onClick={() => setCategoryFilter('alle')}
                        className={cn('shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
                            categoryFilter === 'alle' ? 'bg-amber-500 border-amber-500 text-white' : 'border-border text-muted-foreground bg-card hover:text-foreground')}>
                        Alle
                    </button>
                    {activeCategories.map(cat => (
                        <button key={cat} onClick={() => setCategoryFilter(cat)}
                            className={cn('shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                categoryFilter === cat ? 'bg-amber-500 border-amber-500 text-white' : 'border-border text-muted-foreground bg-card hover:text-foreground')}>
                            {cat}
                            <span className="opacity-50 ml-1">
                                {(activeTab === 'slushy' ? slushyRecipes : standardRecipes).filter(r => r.category === cat).length}
                            </span>
                        </button>
                    ))}
                </div>

                {/* ── Multi-Select Banner ─────────────────────────────────── */}
                {selectedRecipes.size > 0 && (
                    <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                        <div className="flex items-center gap-2.5">
                            <CheckSquare className="w-4 h-4 text-amber-500" />
                            <div>
                                <p className="text-sm font-semibold text-foreground">
                                    {selectedRecipes.size} Rezept{selectedRecipes.size !== 1 ? 'e' : ''} ausgewählt
                                </p>
                                <p className="text-xs text-muted-foreground">Einkaufsliste mit allen Zutaten generieren</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedRecipes(new Set())} className="h-8">
                                Abbrechen
                            </Button>
                            <Button size="sm" onClick={generateShoppingList}
                                className="h-8 bg-amber-600 hover:bg-amber-700 text-white">
                                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Einkaufsliste
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── Rezept-Grid / Slushy-Liste ─────────────────────────── */}
                {filteredRecipes.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <Wine className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-semibold text-foreground">Keine Rezepte gefunden</p>
                        <p className="text-sm mt-1">
                            {searchQuery || ingredientFilter || categoryFilter !== 'alle'
                                ? 'Andere Filter probieren'
                                : 'Erstes Rezept anlegen'}
                        </p>
                        {permissions.isManager && !searchQuery && !ingredientFilter && categoryFilter === 'alle' && (
                            <Button size="sm" onClick={() => openModal()} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white">
                                <Plus className="w-4 h-4 mr-1.5" />Neues Rezept
                            </Button>
                        )}
                    </div>
                ) : activeTab === 'slushy' ? (
                    <div className="space-y-3">
                        {filteredRecipes.map(recipe => (
                            <SlushyRecipeCard key={recipe.id} recipe={recipe}
                                onEdit={permissions.isManager ? () => openModal(recipe) : undefined}
                                onDelete={permissions.isManager ? () => setDeleteTarget(recipe.id) : undefined}
                            />
                        ))}
                    </div>
                ) : (
                    /* Gruppiert nach Kategorie */
                    (() => {
                        const cats = activeCategories.filter(cat =>
                            filteredRecipes.some(r => r.category === cat)
                        );
                        // Rezepte ohne bekannte Kategorie ans Ende
                        const uncategorized = filteredRecipes.filter(
                            r => !activeCategories.includes(r.category)
                        );
                        const groups = [
                            ...cats.map(cat => ({
                                label: cat,
                                items: filteredRecipes.filter(r => r.category === cat),
                            })),
                            ...(uncategorized.length ? [{ label: 'Sonstiges', items: uncategorized }] : []),
                        ];
                        return (
                            <div className="space-y-6">
                                {groups.map(({ label, items }) => (
                                    <div key={label}>
                                        {/* Kategorie-Header mit Trennlinie */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide shrink-0">
                                                {label}
                                            </h2>
                                            <div className="flex-1 h-px bg-border/50" />
                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                                {items.length}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                            {items.map(recipe => (
                                                <RecipeCard
                                                    key={recipe.id}
                                                    recipe={recipe}
                                                    articles={articles}
                                                    permissions={permissions}
                                                    menuItems={menuItems}
                                                    isSelected={selectedRecipes.has(recipe.id)}
                                                    onSelect={toggleSelect}
                                                    onClick={() => setDetailRecipe(recipe)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()
                )}
            </div>

            {/* ── Detail-Dialog ───────────────────────────────────────────── */}
            {detailRecipe && (
                <RecipeDetailDialog
                    recipe={detailRecipe}
                    articles={articles}
                    permissions={permissions}
                    open={!!detailRecipe}
                    onClose={() => setDetailRecipe(null)}
                    onEdit={r => { setDetailRecipe(null); openModal(r); }}
                    onDelete={id => { setDetailRecipe(null); setDeleteTarget(id); }}
                />
            )}

            {/* ── Edit / Create Modal ─────────────────────────────────────── */}
            <Dialog open={modalOpen} onOpenChange={o => !o && closeModal()}>
                <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedRecipe ? 'Rezept bearbeiten' : 'Neues Rezept'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-1">

                        {/* ── Basisinfo ── */}
                        <div className="space-y-3">
                            {/* Name */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name *</Label>
                                <Input className="h-10 text-base" placeholder="z.B. Mojito, Aperol Spritz…"
                                    value={formData.name}
                                    onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} />
                            </div>

                            {/* Kategorie + Portionen / Slushy-Felder */}
                            {formData.recipe_type === 'slushy' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Spirituose</Label>
                                        <Select value={formData.slushy_spirit_base}
                                            onValueChange={v => setFormData(f => ({ ...f, slushy_spirit_base: v }))}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Wählen…" /></SelectTrigger>
                                            <SelectContent>
                                                {slushyCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Originalmenge (L)</Label>
                                        <Input className="h-9" type="number" step="0.1" placeholder="z.B. 9.5"
                                            value={formData.slushy_original_volume_liters ?? ''}
                                            onChange={e => setFormData(f => ({ ...f, slushy_original_volume_liters: e.target.value === '' ? null : parseFloat(e.target.value) || null }))} />
                                        <p className="text-[10px] text-muted-foreground">Wird auf 3,5L skaliert</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kategorie</Label>
                                        <Select value={formData.category}
                                            onValueChange={v => setFormData(f => ({ ...f, category: v }))}>
                                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {standardCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Portionen</Label>
                                        <Input className="h-9" type="number" min="1"
                                            value={formData.servings}
                                            onChange={e => setFormData(f => ({ ...f, servings: parseInt(e.target.value) || 1 }))} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Zutaten ── */}
                        <div className="pt-3 border-t border-border/60 space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zutaten</Label>
                                <Button type="button" variant="outline" size="sm"
                                    onClick={suggestIngredients}
                                    disabled={suggestingIngredients || !formData.name}
                                    className="h-7 text-xs gap-1.5 border-amber-500/40 text-amber-500 hover:bg-amber-500/10">
                                    <Sparkles className="w-3 h-3" />
                                    {suggestingIngredients ? 'Lädt…' : 'KI-Vorschlag'}
                                </Button>
                            </div>
                            <IngredientSelector
                                ingredients={formData.ingredients}
                                onChange={newIngredients => setFormData(f => ({ ...f, ingredients: newIngredients }))}
                                articles={articles}
                            />
                        </div>

                        {/* ── Mischvarianten (nur Longdrink) ── */}
                        {formData.recipe_type !== 'slushy' && (
                            <div className="pt-3 border-t border-border/60 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mischvarianten</Label>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Variable Softdrink-Optionen — Basis-Zutaten oben</p>
                                    </div>
                                    <Button type="button" variant="outline" size="sm"
                                        onClick={() => setFormData(f => ({
                                            ...f,
                                            mix_variants: [...(f.mix_variants || []), { name: '', ingredients: [] }]
                                        }))}
                                        className="h-7 text-xs gap-1 shrink-0">
                                        <Plus className="w-3 h-3" /> Variante
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {(formData.mix_variants || []).map((variant, vi) => (
                                        <div key={vi} className="border border-border/60 rounded-xl bg-secondary/20">
                                            {/* Varianten-Header */}
                                            <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-border/40">
                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Variante:</span>
                                                    <input
                                                        className="flex-1 min-w-0 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none border-b border-transparent focus:border-primary/50 transition-colors py-0.5"
                                                        placeholder="z.B. mit Cola, mit Sprite…"
                                                        value={variant.name}
                                                        onChange={e => setFormData(f => {
                                                            const v = [...(f.mix_variants || [])];
                                                            v[vi] = { ...v[vi], name: e.target.value };
                                                            return { ...f, mix_variants: v };
                                                        })}
                                                    />
                                                </div>
                                                <button type="button"
                                                    onClick={() => setFormData(f => ({
                                                        ...f,
                                                        mix_variants: (f.mix_variants || []).filter((_, i) => i !== vi)
                                                    }))}
                                                    title="Variante löschen"
                                                    className="ml-2 flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">Löschen</span>
                                                </button>
                                            </div>
                                            {/* Zutaten dieser Variante — compact */}
                                            <div className="px-3 pb-2.5">
                                                <IngredientSelector
                                                    ingredients={variant.ingredients || []}
                                                    onChange={newIngredients => setFormData(f => {
                                                        const v = [...(f.mix_variants || [])];
                                                        v[vi] = { ...v[vi], ingredients: newIngredients };
                                                        return { ...f, mix_variants: v };
                                                    })}
                                                    articles={articles}
                                                    compact
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Zubereitung ── */}
                        <div className="pt-3 border-t border-border/60 space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zubereitung</Label>
                            <Textarea placeholder="Minze muddeln, Eis hinzufügen, Limettensaft…" rows={3}
                                value={formData.preparation}
                                onChange={e => setFormData(f => ({ ...f, preparation: e.target.value }))} />
                        </div>

                        {/* ── Details ── */}
                        <div className="pt-3 border-t border-border/60 space-y-3">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Details</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {/* Glasart — Select */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Glasart</Label>
                                    <Select value={formData.glass_type || ''}
                                        onValueChange={v => setFormData(f => ({ ...f, glass_type: v }))}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Wählen…" /></SelectTrigger>
                                        <SelectContent>
                                            {['Highball', 'Longdrinkglas', 'Lowball / Old Fashioned', 'Cocktailglas', 'Martiniglas', 'Weinglas', 'Sektglas / Flöte', 'Bierglas', 'Shotglas', 'Kupferbecher', 'Hurricane', 'Tiki-Glas', 'Mason Jar', 'Sonstiges'].map(g => (
                                                <SelectItem key={g} value={g}>{g}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {/* Garnitur */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Garnitur</Label>
                                    <Input className="h-9" placeholder="z.B. Minzzweig, Zitronenscheibe"
                                        value={formData.garnish}
                                        onChange={e => setFormData(f => ({ ...f, garnish: e.target.value }))} />
                                </div>
                                {/* Alkoholgehalt */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Alkohol (% vol.)</Label>
                                    <Input className="h-9" type="number" step="0.1" min="0" max="100"
                                        placeholder="z.B. 5.2"
                                        value={formData.alcohol_content ?? ''}
                                        onChange={e => setFormData(f => ({ ...f, alcohol_content: e.target.value === '' ? null : parseFloat(e.target.value) || null }))} />
                                </div>
                                {/* Notizen */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Notizen</Label>
                                    <Input className="h-9" placeholder="Zusätzliche Hinweise…"
                                        value={formData.notes || ''}
                                        onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} />
                                </div>
                            </div>
                        </div>

                        {/* ── Bild ── */}
                        <div className="pt-3 border-t border-border/60 space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bild (optional)</Label>
                            {formData.image_url ? (
                                <div className="relative w-full h-36 rounded-xl overflow-hidden border border-border/50 group">
                                    <img src={formData.image_url} alt="Vorschau" className="w-full h-full object-cover" />
                                    <div className="absolute top-2 right-2">
                                        <Button type="button" variant="destructive" size="sm"
                                            onClick={() => setFormData(f => ({ ...f, image_url: '' }))}
                                            className="h-7 text-xs shadow-lg">
                                            Entfernen
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <label className="flex-1 cursor-pointer">
                                        <div className={cn(
                                            'flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all',
                                            uploadingImage && 'opacity-50 pointer-events-none'
                                        )}>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                            Datei hochladen
                                        </div>
                                        <Input type="file" accept="image/*" onChange={handleImageUpload}
                                            disabled={uploadingImage} className="hidden" />
                                    </label>
                                    <label className="flex-1 cursor-pointer">
                                        <div className={cn(
                                            'flex items-center justify-center gap-1.5 h-9 rounded-lg border border-amber-500/30 text-xs font-medium text-amber-500 hover:bg-amber-500/10 transition-all',
                                            uploadingImage && 'opacity-50 pointer-events-none'
                                        )}>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            Foto aufnehmen
                                        </div>
                                        <Input type="file" accept="image/*" capture="environment"
                                            onChange={handleImageUpload} disabled={uploadingImage} className="hidden" />
                                    </label>
                                </div>
                            )}
                            {uploadingImage && <p className="text-xs text-muted-foreground animate-pulse">Wird hochgeladen…</p>}
                        </div>

                    </div>

                    <DialogFooter className="gap-2 pt-2">
                        <Button variant="outline" onClick={closeModal}>Abbrechen</Button>
                        {selectedRecipe && (
                            <Button type="button" variant="ghost"
                                onClick={() => { setDeleteTarget(selectedRecipe.id); closeModal(); }}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto">
                                Löschen
                            </Button>
                        )}
                        <Button onClick={handleSave}
                            disabled={createMutation.isPending || updateMutation.isPending || !formData.name?.trim()}
                            className="bg-amber-600 hover:bg-amber-700 text-white min-w-24">
                            {(createMutation.isPending || updateMutation.isPending)
                                ? 'Speichert…' : selectedRecipe ? 'Speichern' : 'Erstellen'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm ──────────────────────────────────────────── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rezept löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dieser Vorgang kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(deleteTarget)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Kategorien verwalten ────────────────────────────────────── */}
            <Dialog open={categoriesOpen} onOpenChange={open => { setCategoriesOpen(open); if (!open) setNewCatInput(''); }}>
                <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Kategorien verwalten</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 py-2">

                        {/* Standard-Rezepte */}
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Standard-Rezepte</p>
                            <div className="flex flex-wrap gap-2">
                                {standardCategories.map(cat => (
                                    <span key={cat} className={cn(
                                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border group',
                                        CATEGORY_COLORS[cat] || 'bg-secondary text-muted-foreground border-border'
                                    )}>
                                        {cat}
                                        <span className="text-muted-foreground/70">
                                            ({recipes.filter(r => r.category === cat && r.recipe_type !== 'slushy').length})
                                        </span>
                                        {!DEFAULT_STANDARD_CATEGORIES.includes(cat) && (
                                            <button
                                                type="button"
                                                onClick={() => removeCategory('standard', cat)}
                                                className="ml-0.5 opacity-50 hover:opacity-100 hover:text-destructive transition-opacity"
                                                title="Kategorie entfernen"
                                            >✕</button>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Slushies */}
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Slushies</p>
                            <div className="flex flex-wrap gap-2">
                                {slushyCategories.map(cat => (
                                    <span key={cat} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/25">
                                        {cat}
                                        <span className="text-blue-400/60">
                                            ({recipes.filter(r => r.category === cat && r.recipe_type === 'slushy').length})
                                        </span>
                                        {!DEFAULT_SLUSHY_CATEGORIES.includes(cat) && (
                                            <button
                                                type="button"
                                                onClick={() => removeCategory('slushy', cat)}
                                                className="ml-0.5 opacity-50 hover:opacity-100 hover:text-destructive transition-opacity"
                                            >✕</button>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Neue Kategorie hinzufügen */}
                        <div className="pt-3 border-t border-border space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Neue Kategorie</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newCatInput}
                                    onChange={e => setNewCatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addCategory('standard')}
                                    placeholder="z.B. Aperitif"
                                    className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <button
                                    type="button"
                                    onClick={() => addCategory('standard')}
                                    disabled={!newCatInput.trim()}
                                    className="h-9 px-3 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-semibold disabled:opacity-40 hover:bg-amber-500/30 transition-colors"
                                >+ Standard</button>
                                <button
                                    type="button"
                                    onClick={() => addCategory('slushy')}
                                    disabled={!newCatInput.trim()}
                                    className="h-9 px-3 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-semibold disabled:opacity-40 hover:bg-blue-500/30 transition-colors"
                                >+ Slushy</button>
                            </div>
                            <p className="text-xs text-muted-foreground">Standard-Kategorien können nicht gelöscht werden. Eigene Kategorien (mit ✕) schon.</p>
                        </div>

                        {/* Rezepte ohne gültige Kategorie */}
                        {recipes.filter(r => !standardCategories.includes(r.category) && !slushyCategories.includes(r.category)).length > 0 && (
                            <div className="pt-2 border-t border-border">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ohne gültige Kategorie</p>
                                <div className="space-y-1">
                                    {recipes
                                        .filter(r => !standardCategories.includes(r.category) && !slushyCategories.includes(r.category))
                                        .map(r => (
                                            <p key={r.id} className="text-xs text-muted-foreground px-2">• {r.name} ({r.category || '—'})</p>
                                        ))
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCategoriesOpen(false)}>Schließen</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Ähnliche Rezepte ────────────────────────────────────────── */}
            <Dialog open={similarModal} onOpenChange={setSimilarModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Ähnliche Rezepte zu „{similarRecipe?.name}"</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 py-1">
                        {findSimilarRecipes(similarRecipe).map(r => (
                            <button key={r.id}
                                onClick={() => { setSimilarModal(false); setDetailRecipe(r); }}
                                className="w-full text-left p-3 rounded-xl border border-border/60 hover:border-border bg-card transition-all">
                                <p className="font-semibold text-sm text-foreground">{r.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{r.category} · {r.ingredients?.length || 0} Zutaten</p>
                            </button>
                        ))}
                        {findSimilarRecipes(similarRecipe).length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-6">Keine ähnlichen Rezepte gefunden</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}