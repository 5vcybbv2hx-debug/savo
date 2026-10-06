/**
 * ZENTRALE ÖFFENTLICHE ROUTES
 * 
 * Alle öffentlichen/Gäste-Links werden hier zentral definiert.
 * Single Source of Truth für externe Links.
 */

/**
 * Öffentliche Getränkekarte — jetzt auf der separaten SAVO Lounge Website.
 * Diese URL ist die Single Source of Truth für alle Gäste-Links, QR-Codes
 * und TV-Display-Verweise. Alte /PublicDrinkMenu-Pfade leiten per Redirect
 * hierher weiter (siehe src/App.jsx), damit bereits gedruckte QR-Codes
 * weiterhin funktionieren.
 */
export const PUBLIC_DRINK_MENU_URL = 'https://savo-lounge-live.base44.app/getraenke';

/**
 * Basis-URL der App (sicherheitshalber vollständig)
 * In Produktionsumgebung ändert sich der Origin je nach Deployment
 */
function getBaseURL() {
  if (typeof window === 'undefined') {
    return 'https://barmanager.app'; // Fallback für SSR
  }
  return `${window.location.origin}`;
}

/**
 * Öffentliche Getränkekarte für Gäste
 * Keine Authentifizierung erforderlich
 */
export function getPublicDrinkMenuURL() {
  return PUBLIC_DRINK_MENU_URL;
}

/**
 * Öffentliche Wochenspecial-Anzeigeansicht (für externen Bildschirm/TV)
 * Keine Authentifizierung erforderlich
 */
export function getPublicWeeklySpecialDisplayURL() {
  return `${getBaseURL()}/PublicWeeklySpecialDisplay`;
}

/**
 * QR-Code Link für Lagerplatz-Scan
 * Öffentlich erreichbar, keine Auth erforderlich
 */
export function getStorageLocationScanURL(slotId) {
  if (!slotId) return null;
  return `${getBaseURL()}/StorageLocationScan/${slotId}`;
}

/**
 * Kopiere Link zur Zwischenablage
 */
export async function copyToClipboard(url) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch (err) {
    console.error('Fehler beim Kopieren:', err);
    return false;
  }
}

/**
 * Teile Link (Native Share API, Fallback auf Clipboard)
 */
export async function shareLink(url, title = 'BarManager Link') {
  try {
    if (navigator.share) {
      await navigator.share({
        title,
        url,
      });
      return true;
    } else {
      // Fallback: Clipboard
      return await copyToClipboard(url);
    }
  } catch (err) {
    console.error('Fehler beim Teilen:', err);
    return false;
  }
}

/**
 * Validiere, dass eine URL öffentlich erreichbar ist
 */
export function isPublicRoute(pathname) {
  const publicRoutes = [
    '/PublicWeeklySpecialDisplay',
    '/StorageLocationScan',
  ];

  return publicRoutes.some(route => pathname.startsWith(route));
}

export default {
  getPublicDrinkMenuURL,
  getPublicWeeklySpecialDisplayURL,
  getStorageLocationScanURL,
  copyToClipboard,
  shareLink,
  isPublicRoute,
};