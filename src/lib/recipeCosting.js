/**
 * recipeCosting.js — zentrale, einheitliche Wareneinsatz-Berechnung.
 *
 * WICHTIG: Basiert ausschließlich auf Article.purchase_price + Article.content_amount/
 * content_unit. Das alte Feld Article.price_per_liter wird NIRGENDS im System befüllt
 * (Legacy-Rest) und darf daher nie mehr als primäre Berechnungsgrundlage verwendet werden —
 * das führte bisher dazu, dass Rezept-Kosten in Recipes.jsx/IngredientSelector.jsx/
 * MenuItemModal.jsx faktisch immer 0,00 € anzeigten, während nur der Preisrechner (der
 * bereits content_amount/content_unit nutzte) korrekte Werte lieferte.
 *
 * Jede neue Kostenberechnung für Zutaten/Rezepte MUSS diese Utility verwenden — nie erneut
 * eine eigene Kopie der Umrechnungslogik anlegen (DRY, ein einziges Berechnungsmodell).
 */

/** Gebindegröße eines Artikels in Basis-Einheit (ml für Flüssigkeiten, g für Gewicht). */
export function contentToBase(article) {
    if (!article?.content_amount) return null;
    const unit = (article.content_unit || 'ml').toLowerCase();
    if (unit === 'l' || unit === 'kg') return article.content_amount * 1000;
    return article.content_amount;
}

/** Wandelt eine Zutatenmenge (beliebige Einheit) in Basis-Einheit (ml/g) um. */
export function ingredientToBase(amount, unit) {
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

/** Wareneinsatz einer einzelnen Zutatenmenge, basierend auf dem Artikel-Einkaufspreis. */
export function calcIngredientCost(article, amount, unit) {
    if (!article?.purchase_price || !amount) return 0;
    const u = (unit || 'ml').toLowerCase();
    if (u === 'stk' || u === 'stück') {
        return article.purchase_price * (parseFloat(amount) || 0);
    }
    const base = contentToBase(article);
    if (!base) return 0;
    return (article.purchase_price / base) * ingredientToBase(amount, unit);
}

/** Rundet einen Preis auf 0,10 €-Schritte (Gastro-Standard-Konvention). */
export function roundPrice(n) {
    if (n == null || isNaN(n)) return null;
    return Math.round(n * 10) / 10;
}

/**
 * Gesamter Wareneinsatz einer Zutatenliste (z.B. Recipe.ingredients + optionale
 * Mischvariante), inkl. optionalem Skalierungsfaktor (z.B. bei geänderter Portionszahl).
 */
export function calcRecipeCost(ingredients, articles, { variantIngredients = [], scaleFactor = 1 } = {}) {
    const list = [
        ...(Array.isArray(ingredients) ? ingredients : []),
        ...(Array.isArray(variantIngredients) ? variantIngredients : []),
    ];
    const safeArticles = Array.isArray(articles) ? articles : [];
    return list.reduce((sum, ing) => {
        const article = safeArticles.find(a => a.id === ing.article_id);
        return sum + calcIngredientCost(article, (parseFloat(ing.amount) || 0) * scaleFactor, ing.unit);
    }, 0);
}

/** Wareneinsatz-%-Bewertung (Gastro-Ampel: gut / ok / schlecht). */
export function foodCostRating(pct) {
    if (pct == null || isNaN(pct)) return null;
    if (pct > 40) return 'bad';
    if (pct > 30) return 'ok';
    return 'good';
}

/**
 * Ermittelt einen Preisvorschlag aus einem einzelnen verknüpften Artikel (z.B. Wein/Spirituose
 * pur), wenn KEIN Rezept genutzt wird und die MenuItem.size (z.B. "4cl", "0,2l") auswertbar ist.
 * Gibt null zurück, wenn Größe nicht parsbar oder kein passender Artikel gefunden wurde.
 */
export function calcSingleArticleSuggestion(menuItem, articles) {
    const linkedIds = menuItem?.linked_article_ids || [];
    if (linkedIds.length !== 1 || !menuItem?.size) return null;
    const article = (articles || []).find(a => a.id === linkedIds[0]);
    if (!article) return null;
    const v = menuItem.size.toLowerCase().replace(',', '.').trim();
    const num = parseFloat(v);
    if (isNaN(num)) return null;
    let unit = null;
    if (v.includes('ml')) unit = 'ml';
    else if (v.includes('cl')) unit = 'cl';
    else if (v.includes('kg')) unit = 'kg';
    else if (v.includes('l'))  unit = 'l';
    else if (v.includes('g'))  unit = 'g';
    if (!unit) return null;
    const cost = calcIngredientCost(article, num, unit);
    return cost > 0 ? cost : null;
}

/**
 * Einzige Quelle der Wahrheit für "was kostet dieses Getränk effektiv im Einkauf" —
 * von MenuItemModal (Live-Kalkulation beim Bearbeiten) UND MenuReview (Karten-Review-Modus)
 * gleichermaßen genutzt, damit beide Stellen niemals auseinanderlaufen können.
 *
 * Reihenfolge: 1) Rezept-Berechnung (falls use_recipe_calculation), 2) manuell gepflegter
 * MenuItem.purchase_price, 3) Auto-Vorschlag aus einzelnem verknüpften Artikel + Größe.
 */
export function getEffectivePurchasePrice(menuItem, { articles = [], recipes = [] } = {}) {
    if (menuItem?.use_recipe_calculation && menuItem?.linked_recipe_id) {
        const recipe = recipes.find(r => r.id === menuItem.linked_recipe_id);
        if (recipe?.ingredients) {
            const hasVariants = (recipe.mix_variants || []).length > 0;
            const baseIngs = hasVariants
                ? recipe.ingredients.filter(i => i.is_base !== false)
                : recipe.ingredients;
            let variantIngredients = [];
            if (hasVariants && menuItem.linked_variant_name) {
                const variant = (recipe.mix_variants || []).find(v => v.name === menuItem.linked_variant_name);
                variantIngredients = variant?.ingredients || [];
            }
            const cost = calcRecipeCost(baseIngs, articles, { variantIngredients });
            return cost > 0 ? cost : null;
        }
        return null;
    }
    if (menuItem?.purchase_price != null && menuItem.purchase_price !== '') {
        return parseFloat(menuItem.purchase_price);
    }
    return calcSingleArticleSuggestion(menuItem, articles);
}
