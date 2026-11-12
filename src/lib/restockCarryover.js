import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';

/**
 * Die Auffüllliste ist eine offene Aufgabe: was am letzten Rundgang-Tag nicht
 * erledigt wurde, muss auch am Folgetag sichtbar sein. Beim Laden werden darum
 * die offenen Positionen der jüngsten Vortagesliste auf heute übernommen.
 *
 * Bewusst nur die jüngste Liste: ältere, nie abgeschlossene Einträge sollen
 * nicht wieder auftauchen. Erledigte Positionen behalten ihr Datum (Historie).
 */
export async function loadRestockItemsForToday(limit = 200) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const items = await base44.entities.RestockItem.list('-created_date', limit);

    const pastDates = items.map(i => i.date).filter(d => d && d < today);
    if (pastDates.length === 0) return items;

    const lastPastDay = pastDates.reduce((max, d) => (d > max ? d : max), '');
    const carry = items.filter(i => i.date === lastPastDay && !i.is_completed);
    if (carry.length === 0) return items;

    await base44.entities.RestockItem.bulkUpdate(carry.map(i => ({ id: i.id, date: today })));

    const carriedIds = new Set(carry.map(i => i.id));
    return items.map(i => (carriedIds.has(i.id) ? { ...i, date: today } : i));
}