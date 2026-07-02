/**
 * allergenSync.js
 * Single source of truth for deriving Allergene/Zusatzstoffe from Artikel-Daten.
 * Used by MenuItemModal, Recipes.jsx and Articles.jsx to keep Getränke/Rezepte
 * always in sync with the Artikel they are built from — no manual re-entry,
 * no stale data.
 */

/** Resolves the concrete Article records feeding a Recipe (respecting the selected mix variant). */
export function getRecipeSourceArticles(recipe, articles = [], variantName = null) {
    if (!recipe?.ingredients) return [];
    const hasVariants = (recipe.mix_variants || []).length > 0;
    const baseIngs = hasVariants
        ? recipe.ingredients.filter(i => i.is_base !== false)
        : recipe.ingredients;
    let effectiveIngs = baseIngs;
    if (hasVariants && variantName) {
        const variant = (recipe.mix_variants || []).find(v => v.name === variantName);
        effectiveIngs = [...baseIngs, ...(variant?.ingredients || [])];
    }
    return effectiveIngs.map(ing => articles.find(a => a.id === ing.article_id)).filter(Boolean);
}

/** Resolves the concrete Article records feeding a MenuItem (recipe-linked or directly article-linked). */
export function getMenuItemSourceArticles(menuItem, articles = [], recipes = []) {
    if (!menuItem) return [];
    if (menuItem.use_recipe_calculation && menuItem.linked_recipe_id) {
        const recipe = recipes.find(r => r.id === menuItem.linked_recipe_id);
        return getRecipeSourceArticles(recipe, articles, menuItem.linked_variant_name);
    }
    const linkedIds = menuItem.linked_article_ids?.length
        ? menuItem.linked_article_ids
        : menuItem.linked_article_id ? [menuItem.linked_article_id] : [];
    return linkedIds.map(id => articles.find(a => a.id === id)).filter(Boolean);
}

/** True if a MenuItem has ANY automatic allergen source (recipe or direct article link). */
export function hasAutoAllergenSource(menuItem) {
    if (!menuItem) return false;
    if (menuItem.use_recipe_calculation && menuItem.linked_recipe_id) return true;
    if (menuItem.linked_article_ids?.length) return true;
    if (menuItem.linked_article_id) return true;
    return false;
}

/** Union of allergens_list / additives across a list of source Article records. */
export function unionAllergensAdditives(sourceArticles = []) {
    return {
        allergens: [...new Set(sourceArticles.flatMap(a => a?.allergens_list || []))],
        additives: [...new Set(sourceArticles.flatMap(a => a?.additives || []))],
    };
}