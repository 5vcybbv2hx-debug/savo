import { createPageUrl } from '@/utils';

/**
 * Öffentlicher Gäste-Link zur Getränkekarte.
 * Zeigt auf die PublicDrinkMenu-Seite — kein Login nötig.
 * Optional: ?table=5 für Tischnummer.
 */
export function getMenuUrl(tableNumber = null) {
    const base = `${window.location.origin}${createPageUrl('PublicDrinkMenu')}`;
    return tableNumber ? `${base}?table=${encodeURIComponent(tableNumber)}` : base;
}

// Rückwärtskompatibilität
export const MENU_URL = typeof window !== 'undefined'
    ? `${window.location.origin}${createPageUrl('PublicDrinkMenu')}`
    : '/PublicDrinkMenu';

export function getGuestMenuLink(tableNumber = null) {
    return getMenuUrl(tableNumber);
}

/**
 * Öffentlicher Gäste-Link zur Online-Reservierung.
 */
export function getGuestReservationLink() {
    return `${window.location.origin}${createPageUrl('PublicReservation')}`;
}

/**
 * Link in Zwischenablage kopieren (mit Fallback für ältere Browser).
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        return true;
    }
}

/**
 * Link teilen (Web Share API oder Fallback auf Copy).
 */
export async function shareLink(url, title = 'Getränkekarte') {
    if (navigator.share) {
        try {
            await navigator.share({ title, url });
            return true;
        } catch { /* abgebrochen */ }
    }
    return copyToClipboard(url);
}
