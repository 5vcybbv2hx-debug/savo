import { PUBLIC_DRINK_MENU_URL } from './publicRoutes';
import { createPageUrl } from '@/utils';

/**
 * Öffentlicher Gäste-Link zur Getränkekarte.
 * Zeigt auf die separate SAVO Lounge Website — kein Login nötig.
 * Optional: ?table=5 für Tischnummer.
 */
export function getMenuUrl(tableNumber = null) {
    return tableNumber ? `${PUBLIC_DRINK_MENU_URL}?table=${encodeURIComponent(tableNumber)}` : PUBLIC_DRINK_MENU_URL;
}

// Rückwärtskompatibilität
export const MENU_URL = PUBLIC_DRINK_MENU_URL;

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