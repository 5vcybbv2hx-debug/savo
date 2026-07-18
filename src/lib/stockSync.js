/**
 * Stock Transfer Utility — Keller → Theke Umbuchung
 * 
 * Wird aufgerufen wenn Keller-Person Artikel abhakt (Keller-Tab oder flache Auffüllliste).
 * Überträgt die physische Menge vom Keller-Fach ins Theken-Fach.
 * 
 * Zusätzlich: current_stock Reduzierung für Items die noch nicht über den Rundgang
 * erfasst wurden (stock_reduced=false).
 */
import { base44 } from '@/api/base44Client';

/**
 * Findet Theke- und Keller-StorageAssignments für einen Artikel.
 */
async function findAssignments(articleId, thekeAssignmentId) {
    const [allAssignments, allSlots, allAreas] = await Promise.all([
        base44.entities.StorageAssignment.filter({ is_active: true }, null, 1000),
        base44.entities.StorageSlot.list(null, 1000),
        base44.entities.Area.list(null, 100),
    ]);

    // Theke: entweder bekannt via assignmentId, oder per area_type !== 'lager'
    const thekeAssignment = thekeAssignmentId
        ? allAssignments.find(a => a.id === thekeAssignmentId)
        : allAssignments.find(a => {
            if (a.article_id !== articleId) return false;
            const slot = allSlots.find(s => s.id === a.storage_slot_id);
            const area = allAreas.find(ar => ar.id === slot?.area_id);
            return area?.area_type !== 'lager';
        });

    // Keller: area_type === 'lager', gleicher Artikel, anderes Assignment
    const kellerAssignment = allAssignments.find(a => {
        if (a.article_id !== articleId) return false;
        if (thekeAssignment && a.id === thekeAssignment.id) return false;
        const slot = allSlots.find(s => s.id === a.storage_slot_id);
        const area = allAreas.find(ar => ar.id === slot?.area_id);
        return area?.area_type === 'lager';
    });

    return { thekeAssignment, kellerAssignment };
}

/**
 * Transferiert Menge vom Keller ins Theken-Fach.
 * 
 * @param {string} articleId - Article ID
 * @param {number} transferQty - Menge die physisch umgebucht wird
 * @param {string|null} thekeAssignmentId - Bekannte Theke-Assignment-ID (optional)
 * @param {boolean} revert - Wenn true: revertiert die Umbuchung (Theke-=, Keller+=)
 */
export async function transferKellerToTheke({ articleId, transferQty, thekeAssignmentId, revert = false }) {
    if (!articleId || !transferQty || transferQty <= 0) return;

    const qty = revert ? -transferQty : transferQty;
    const { thekeAssignment, kellerAssignment } = await findAssignments(articleId, thekeAssignmentId);

    const updates = [];

    if (thekeAssignment) {
        let newThekeQty = (parseFloat(thekeAssignment.quantity) || 0) + qty;
        // Nur beim Transfer (positiv) auf Soll deckeln — beim Revert nicht
        if (qty > 0 && thekeAssignment.min_stock != null) {
            newThekeQty = Math.min(newThekeQty, parseFloat(thekeAssignment.min_stock));
        }
        updates.push(
            base44.entities.StorageAssignment.update(thekeAssignment.id, { quantity: Math.max(0, newThekeQty) })
        );
    }

    if (kellerAssignment) {
        const newKellerQty = Math.max(0, (parseFloat(kellerAssignment.quantity) || 0) - qty);
        updates.push(
            base44.entities.StorageAssignment.update(kellerAssignment.id, { quantity: newKellerQty })
        );
    }

    await Promise.all(updates);
}

/**
 * Reduziert Article.current_stock um den Verbrauch.
 * Nur aufrufen wenn stock_reduced=false (noch nicht über Rundgang erfasst).
 * 
 * @param {string} articleId
 * @param {number} consumedQty - Verbrauchte Menge
 */
export async function reduceCurrentStock(articleId, consumedQty) {
    if (!articleId || !consumedQty || consumedQty <= 0) return;
    try {
        const article = await base44.entities.Article.get(articleId);
        if (article?.current_stock != null) {
            const newStock = Math.max(0, (parseFloat(article.current_stock) || 0) - consumedQty);
            await base44.entities.Article.update(articleId, { current_stock: newStock });
        }
    } catch (e) { console.warn('[stockSync] current_stock Reduzierung fehlgeschlagen:', e); }
}

/**
 * Stellt Article.current_stock wieder her (beim Un-Complete).
 * 
 * @param {string} articleId
 * @param {number} restoreQty - Wiederherzustellende Menge
 */
export async function restoreCurrentStock(articleId, restoreQty) {
    if (!articleId || !restoreQty || restoreQty <= 0) return;
    try {
        const article = await base44.entities.Article.get(articleId);
        if (article?.current_stock != null) {
            const newStock = (parseFloat(article.current_stock) || 0) + restoreQty;
            await base44.entities.Article.update(articleId, { current_stock: newStock });
        }
    } catch (e) { console.warn('[stockSync] current_stock Restore fehlgeschlagen:', e); }
}
