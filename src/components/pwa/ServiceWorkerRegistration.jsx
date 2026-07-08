import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            // Service Worker Registration
            const registerServiceWorker = async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/api/functions/sw', {
                        scope: '/'
                    });
                    console.log('[App] Service Worker registered:', registration);

                    // Warte auf Installation
                    if (registration.installing) {
                        console.log('[App] Service Worker installing...');
                    } else if (registration.waiting) {
                        console.log('[App] Service Worker waiting...');
                    } else if (registration.active) {
                        console.log('[App] Service Worker active');
                    }

                    // Aktiv nach einer neuen SW-Version fragen, sobald die App wieder in den
                    // Vordergrund kommt (z.B. Handy entsperrt / App-Wechsel) — verhindert, dass
                    // eine lang geöffnete Session unbemerkt tage-/stundenlang auf altem Code hängt.
                    // Die eigentliche "immer frische App-Hülle"-Garantie kommt zusätzlich aus dem
                    // Network-First-Fetch-Handler im Service Worker selbst.
                    const checkForUpdate = () => registration.update().catch(() => {});
                    document.addEventListener('visibilitychange', () => {
                        if (document.visibilityState === 'visible') checkForUpdate();
                    });
                    window.addEventListener('focus', checkForUpdate);
                } catch (error) {
                    // SW registration can fail in sandboxed/preview environments — not critical
                }
            };

            registerServiceWorker();
        }

        // Manifest Link hinzufügen
        const manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        manifestLink.href = '/api/functions/pwa-manifest';
        document.head.appendChild(manifestLink);

        // Theme Color Meta Tag
        const themeColorMeta = document.createElement('meta');
        themeColorMeta.name = 'theme-color';
        themeColorMeta.content = '#d97706';
        document.head.appendChild(themeColorMeta);

        // Apple Mobile Web App Tags
        const appleMobileWebAppCapable = document.createElement('meta');
        appleMobileWebAppCapable.name = 'apple-mobile-web-app-capable';
        appleMobileWebAppCapable.content = 'yes';
        document.head.appendChild(appleMobileWebAppCapable);

        const appleMobileWebAppStatus = document.createElement('meta');
        appleMobileWebAppStatus.name = 'apple-mobile-web-app-status-bar-style';
        appleMobileWebAppStatus.content = 'black-translucent';
        document.head.appendChild(appleMobileWebAppStatus);

        const appleMobileWebAppTitle = document.createElement('meta');
        appleMobileWebAppTitle.name = 'apple-mobile-web-app-title';
        appleMobileWebAppTitle.content = 'BarManager';
        document.head.appendChild(appleMobileWebAppTitle);

        // Viewport Meta
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        }

        return () => {
            document.head.removeChild(manifestLink);
            document.head.removeChild(themeColorMeta);
            document.head.removeChild(appleMobileWebAppCapable);
            document.head.removeChild(appleMobileWebAppStatus);
            document.head.removeChild(appleMobileWebAppTitle);
        };
    }, []);

    return null;
}