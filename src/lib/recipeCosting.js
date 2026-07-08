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
