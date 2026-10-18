import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';

// ── Module-level state for diagnostic access (MyArea Push-Status) ──────────
let _pushState = {
    status: 'idle',          // 'idle' | 'active' | 'error'
    error: null,             // genauer Fehlertext
    subscriptionId: null,    // OneSignal PushSubscription.id
    externalId: null,         // eingeloggte External-ID (employeeId)
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
};

export function getOneSignalStatus() {
    return { ..._pushState };
}

/**
 * Initializes OneSignal and logs in the employee by their Employee entity ID.
 * - Requests permission only once (tracked in localStorage)
 * - Uses employeeId (Employee entity ID) as External User ID
 * - Visible toast feedback on success / failure
 * - Login retry once after 3s on failure
 * - Call logout() on app sign-out
 */
export function useOneSignal({ employeeId, isAuthenticated }) {
    const initialized = useRef(false);

    useEffect(() => {
        if (!isAuthenticated || !employeeId) return;
        if (initialized.current) return;
        initialized.current = true;

        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function (OneSignal) {
            try {
                // 1) Init — idempotent: 'already initialized' ist OK (main.jsx initiiert bereits)
                try {
                    await OneSignal.init({
                        appId: ONESIGNAL_APP_ID,
                        serviceWorkerPath: '/OneSignalSDKWorker.js',
                        notifyButton: { enable: false },
                        allowLocalhostAsSecureOrigin: true,
                    });
                } catch (initErr) {
                    const msg = String(initErr?.message || initErr || '');
                    if (!/already initialized/i.test(msg)) {
                        throw initErr;
                    }
                    // SDK läuft bereits → weitermachen
                }

                // 2) Subscription sicherstellen
                const sub = OneSignal.User?.PushSubscription;
                if (sub && !sub.id && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    try {
                        await sub.optIn();
                    } catch (optErr) {
                        console.warn('[OneSignal] optIn fehlgeschlagen:', optErr);
                    }
                }

                // 3) Login mit Retry (1x nach 3s)
                let loginOk = false;
                let loginErr = null;
                try {
                    await OneSignal.login(String(employeeId));
                    loginOk = true;
                } catch (err1) {
                    console.warn('[OneSignal] Login Versuch 1 fehlgeschlagen, Retry in 3s…', err1);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    try {
                        await OneSignal.login(String(employeeId));
                        loginOk = true;
                    } catch (err2) {
                        loginErr = err2;
                    }
                }

                // 4) Status-Verifikation
                const subId = sub?.id || null;
                const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
                let externalId = null;
                let onesignalId = null;
                try { onesignalId = await OneSignal.User?.getOnesignalId?.(); } catch {}
                try { externalId = OneSignal.User?.getExternalId?.() || null; } catch {}

                _pushState = {
                    status: loginOk ? 'active' : 'error',
                    error: loginErr?.message || null,
                    subscriptionId: subId,
                    externalId: externalId || onesignalId || (loginOk ? String(employeeId) : null),
                    permission: perm,
                };

                // 5) Sichtbares Feedback
                if (loginOk) {
                    const displayId = externalId || onesignalId || String(employeeId);
                    const shortId = String(displayId).slice(0, 8);
                    toast.success(`Push aktiv ✓ (ID: ${shortId}…)`);
                } else {
                    toast.error(`Push fehlgeschlagen: ${loginErr?.message || 'unbekannt'}`);
                }
            } catch (err) {
                console.error('[OneSignal] Init error:', err);
                _pushState = {
                    status: 'error',
                    error: err?.message || String(err),
                    subscriptionId: null,
                    externalId: null,
                    permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
                };
                toast.error(`Push fehlgeschlagen: ${err?.message || 'unbekannt'}`);
            }
        });
    }, [isAuthenticated, employeeId]);
}

/**
 * Meldet den aktuellen Nutzer bei OneSignal ab.
 * Aufruf beim App-Logout.
 */
export async function oneSignalLogout() {
    try {
        if (window.OneSignal?.logout) {
            await window.OneSignal.logout();
        }
    } catch (err) {
        console.error('[OneSignal] Logout error:', err);
    }
}