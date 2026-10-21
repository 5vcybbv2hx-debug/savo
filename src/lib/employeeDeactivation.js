import { base44 } from '@/api/base44Client';

/**
 * Stellt die übergebenen Schichten als offene Angebote in den Tauschmarkt.
 * Payload entspricht dem marketplace-Zweig aus ShiftSwapRequestModal.jsx.
 * Der Workflow "Push: Schichttausch-Events" (onShiftSwapEvent) verschickt die
 * Team-Benachrichtigung automatisch — hier ist keine Notification nötig.
 *
 * Schichten mit bereits offener/ausstehender Tauschanfrage werden übersprungen.
 *
 * @returns {{ requested: number, created: number, skipped: number }}
 */
export async function createMarketplaceOffers(shifts, reason) {
    if (!shifts?.length) return { requested: 0, created: 0, skipped: 0 };

    const existing = await base44.entities.ShiftSwapRequest.filter({
        shift_id: { $in: shifts.map(s => s.id) },
        status: { $in: ['offen', 'ausstehend'] }
    });
    const alreadyOffered = new Set((existing || []).map(r => r.shift_id));

    const offers = shifts
        .filter(s => !alreadyOffered.has(s.id))
        .map(s => ({
            shift_id: s.id,
            requesting_employee_id: s.employee_id,
            requesting_employee_name: s.employee_name,
            target_employee_id: null,
            target_employee_name: null,
            shift_date: s.date,
            shift_start_time: s.start_time,
            shift_end_time: s.end_time,
            shift_time: `${s.start_time} - ${s.end_time}`,
            shift_type: s.shift_type,
            reason,
            status: 'offen',
            marketplace: true
        }));

    for (const offer of offers) {
        await base44.entities.ShiftSwapRequest.create(offer);
    }

    return { requested: shifts.length, created: offers.length, skipped: shifts.length - offers.length };
}