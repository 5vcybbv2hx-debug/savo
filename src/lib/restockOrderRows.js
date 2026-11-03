/**
 * Bündelt Auffülllisten-Positionen (RestockItem — eine Zeile pro Fach) zu
 * Bestellzeilen für die Bestellliste (ShoppingList): genau EINE Zeile pro
 * Artikel und Lieferant.
 *
 * Menge = Summe des Fachbedarfs über alle betroffenen StorageAssignments,
 * Gebinde/A-Preis werden einmal vom Standard-Lieferanten gesetzt.
 */
import { format } from 'date-fns';

/** Vergleichs-Schlüssel für Namen (Kleinschreibung, Satzzeichen raus). */
export const normalizeKey = (value) =>
    (value || '')
        .toLowerCase()
        .replace(/[`´'’]/g, '')
        .replace(/[^a-z0-9äöüß]+/g, ' ')
        .trim();

/** Benötigte Einheiten einer Auffüll-Position. */
export const itemNeededUnits = (item) => {
    if (item.needed_quantity != null) return parseFloat(item.needed_quantity) || 0;
    return parseFloat(item.quantity) || 0;
};

const supplierOf = (article) => {
    const primary = article?.supplier_details?.find(s => s.is_primary) || article?.supplier_details?.[0];
    return { primary, name: primary?.supplier_name || article?.suppliers?.[0] || '' };
};

const articleOf = (item, articles) => articles.find(a => a.id === item.article_id);

/** Gruppierungs-Schlüssel: article_id (Fallback: normalisierter Name) + Lieferant. */
export const restockItemKey = (item, articles) => {
    const article = articleOf(item, articles);
    const { name: supplier } = supplierOf(article);
    return `${item.article_id || 'name:' + normalizeKey(item.article_name)}::${normalizeKey(supplier)}`;
};

/** Schlüssel einer bereits gespeicherten Bestellzeile (für Duplikat-Prüfung). */
export const orderRowKey = (row) =>
    `${row.article_id || 'name:' + normalizeKey(row.item_name)}::${normalizeKey(row.supplier_name || row.category)}`;

/**
 * Erzeugt aus Auffüll-Positionen gebündelte Bestellzeilen.
 * @returns Array von { key, item_name, article_id, supplier_name, quantity, quantity_units, … }
 */
export function buildOrderRows(restockItems, articles, dateLabel = format(new Date(), 'dd.MM.yyyy')) {
    const groups = new Map();

    (restockItems || []).forEach(item => {
        const article = articleOf(item, articles);
        const { primary, name: supplierName } = supplierOf(article);
        const key = `${item.article_id || 'name:' + normalizeKey(item.article_name)}::${normalizeKey(supplierName)}`;

        const group = groups.get(key) || {
            key,
            article,
            primarySupplier: primary,
            article_id: item.article_id || null,
            item_name: article?.name || item.article_name,
            supplierName,
            units: 0,
            slots: new Set(),
        };
        group.units += itemNeededUnits(item);
        if (item.slot_name && item.slot_name.trim()) group.slots.add(item.slot_name.trim());
        groups.set(key, group);
    });

    return Array.from(groups.values()).map(g => {
        const options = g.primarySupplier?.packaging_options || [];
        const defaultOpt = options.find(o => o.is_default) || options[0];
        const unitsPerPack = parseFloat(defaultOpt?.units_per_pack) || 1;
        const neededUnits = Math.round(g.units * 100) / 100;
        const quantity = neededUnits > 0 ? Math.max(1, Math.ceil(neededUnits / unitsPerPack)) : 1;
        const slots = Array.from(g.slots);
        const notes = [
            `Auffüllliste ${dateLabel}`,
            slots.length ? `Fächer: ${slots.join(', ')}` : null,
        ].filter(Boolean).join(' · ');

        return {
            key: g.key,
            item_name: g.item_name,
            article_id: g.article_id,
            category: g.supplierName,
            supplier_name: g.supplierName,
            packaging_option_id: defaultOpt?.id || null,
            packaging_label: defaultOpt ? `${defaultOpt.packaging_type} ${defaultOpt.units_per_pack}×` : null,
            price_per_pack: defaultOpt?.price_per_pack || null,
            price_per_unit: defaultOpt?.price_per_unit || g.article?.purchase_price || null,
            quantity,
            quantity_units: neededUnits,
            unit: defaultOpt?.packaging_type || 'Stück',
            status: 'offen',
            notes,
            slots,
            wasRounded: unitsPerPack > 1 && quantity * unitsPerPack !== neededUnits,
        };
    });
}

/** Liegt für diese Zeile bereits eine offene/bestellte Bestellzeile vor? */
export const hasOpenOrderRow = (shoppingItems, row) =>
    (shoppingItems || []).some(s =>
        (s.status === 'offen' || s.status === 'bestellt') && orderRowKey(s) === row.key
    );

/** Payload für ShoppingList.create — ohne reine Hilfsfelder. */
export const toShoppingPayload = (row) => {
    const { key, wasRounded, slots, ...payload } = row;
    return payload;
};