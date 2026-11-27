/**
 * Kette Außeneinsatz → Angebot → Rechnung
 *
 * Ein ExternalJob kann genau ein Angebot (Offer) referenzieren; das Angebot
 * trägt umgekehrt external_job_id. Alle Schreibvorgänge hier sind Beiwerk:
 * schlägt die Verknüpfung fehl, darf der eigentliche Vorgang nie scheitern.
 */
import { base44 } from '@/api/base44Client';

// Fortlaufende Angebotsnummer AN-JJJJ-NNN
export function nextOfferNumber(offers = []) {
    const year = new Date().getFullYear();
    const re = new RegExp(`^AN-${year}-(\\d+)$`);
    const max = offers.reduce((m, o) => {
        const match = String(o.offer_number || '').match(re);
        return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 0);
    return `AN-${year}-${String(max + 1).padStart(3, '0')}`;
}

// Badge im Außeneinsatz: Angebot / Rechnung / nichts
export function offerBadge(job) {
    if (job?.invoice_id || job?.offer_status === 'Rechnung erstellt') {
        return { label: 'Rechnung erstellt', className: 'bg-status-ok/10 text-status-ok border-status-ok/30' };
    }
    if (job?.offer_id) {
        return {
            label: job.offer_number ? `Angebot ${job.offer_number}` : 'Angebot',
            className: 'bg-primary/10 text-primary border-primary/30',
        };
    }
    if (job?.offer_status === 'storniert') {
        return { label: 'Angebot storniert', className: 'bg-destructive/10 text-destructive border-destructive/30' };
    }
    return { label: 'Kein Angebot', className: 'bg-secondary text-muted-foreground border-border' };
}

// Angebot → Einsatz: offer_id, offer_number, offer_status nachziehen
export async function syncJobFromOffer(offer) {
    const jobId = offer?.external_job_id;
    if (!jobId) return;
    try {
        await base44.entities.ExternalJob.update(jobId, {
            offer_id: offer.id,
            offer_number: offer.offer_number || '',
            offer_status: offer.status || 'Entwurf',
        });
    } catch {
        // Verknüpfung ist Beiwerk — nie den Angebots-Vorgang blockieren
    }
}

// Angebot storniert/gelöscht → Einsatz löst die Verknüpfung
export async function clearJobOfferLink(offer) {
    const jobId = offer?.external_job_id;
    if (!jobId) return;
    try {
        await base44.entities.ExternalJob.update(jobId, {
            offer_id: '',
            offer_status: 'storniert',
        });
    } catch {
        // siehe oben
    }
}