/**
 * useTabNavigation — Bottom-Tab-Navigation mit Stack-Erhaltung pro Tab.
 *
 * Jeder Tab hat seinen eigenen History-Stack. Beim Wechsel zwischen Tabs
 * wird die zuletzt besuchte Seite des jeweiligen Tabs wiederhergestellt —
 * inkl. Unterseiten (Sub-Routes), nicht nur der Tab-Root.
 *
 * Funktionsweise:
 *  - lastActiveTabRef merkt sich den aktiven Tab, auch wenn man auf einer
 *    Unterseite ist (wo die URL nicht exakt dem Tab-Root entspricht).
 *  - Ein useEffect speichert bei jeder Navigation den aktuellen Pfad im
 *    Stack des aktiven Tabs, sodass auch tiefe Unterseiten erhalten bleiben.
 *  - Beim Tab-Wechsel wird zum gespeicherten Pfad des Ziel-Tabs navigiert.
 */

import { useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Fallback-Root-Seiten für jeden Tab (erste Seite beim erstmaligen Besuch)
const TAB_ROOTS = {
    Dashboard:       '/',
    GuestHub:        createPageUrl('GuestHub'),
    Todos:           createPageUrl('Todos'),
    TeamCalendar:    createPageUrl('TeamCalendar'),
    OperativeListen: createPageUrl('OperativeListen'),
    Cleaning:        createPageUrl('Cleaning'),
    MeinTag:         createPageUrl('MeinTag'),
};

const STORAGE_KEY = 'bm_tab_stacks';

function loadStacks() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function saveStacks(stacks) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stacks));
    } catch {}
}

export function useTabNavigation(tabPages) {
    const navigate = useNavigate();
    const location = useLocation();
    const stacksRef = useRef(loadStacks());
    const lastActiveTabRef = useRef(null);

    // Aktiven Tab anhand der aktuellen URL bestimmen.
    // Bei exaktem Match → Tab-Root. Auf Unterseiten → Fallback auf zuletzt
    // bekannten Tab (lastActiveTabRef), damit Sub-Routes erhalten bleiben.
    const getActiveTab = useCallback(() => {
        const path = location.pathname;
        for (const item of tabPages) {
            const url = item.page === 'Dashboard' ? '/' : createPageUrl(item.page);
            if (path === url || (item.page === 'Dashboard' && path === '/')) {
                return item.page;
            }
        }
        return lastActiveTabRef.current;
    }, [location.pathname, tabPages]);

    // Bei jeder Navigation: aktiven Tab ermitteln und aktuellen Pfad im Stack
    // speichern. Das ist entscheidend für die Erhaltung von Unterseiten.
    useEffect(() => {
        const exactTab = (() => {
            const path = location.pathname;
            for (const item of tabPages) {
                const url = item.page === 'Dashboard' ? '/' : createPageUrl(item.page);
                if (path === url || (item.page === 'Dashboard' && path === '/')) {
                    return item.page;
                }
            }
            return null;
        })();

        if (exactTab) {
            lastActiveTabRef.current = exactTab;
        }

        const activeTab = exactTab || lastActiveTabRef.current;
        if (activeTab) {
            const stacks = stacksRef.current;
            stacks[activeTab] = location.pathname;
            stacksRef.current = stacks;
            saveStacks(stacks);
        }
    }, [location.pathname, tabPages]);

    /**
     * Zu einem Tab navigieren.
     * - Wenn der Tab schon aktiv ist → keine Aktion.
     * - Aktuellen Pfad im Stack des aktiven Tabs sichern.
     * - Zum zuletzt gespeicherten Pfad des Ziel-Tabs navigieren (oder Root).
     */
    const navigateToTab = useCallback((tabPage) => {
        const exactTab = (() => {
            const path = location.pathname;
            for (const item of tabPages) {
                const url = item.page === 'Dashboard' ? '/' : createPageUrl(item.page);
                if (path === url || (item.page === 'Dashboard' && path === '/')) {
                    return item.page;
                }
            }
            return null;
        })();
        const activeTab = exactTab || lastActiveTabRef.current;

        if (activeTab === tabPage) return;

        // Aktuellen Pfad im Stack des aktiven Tabs speichern
        if (activeTab) {
            const stacks = stacksRef.current;
            stacks[activeTab] = location.pathname;
            stacksRef.current = stacks;
            saveStacks(stacks);
        }

        lastActiveTabRef.current = tabPage;

        // Zum letzten bekannten Pfad des Ziel-Tabs navigieren
        const stacks = stacksRef.current;
        const savedPath = stacks[tabPage];
        const rootUrl = TAB_ROOTS[tabPage] || createPageUrl(tabPage);
        const targetUrl = savedPath || rootUrl;

        navigate(targetUrl);
    }, [location.pathname, navigate, tabPages]);

    /**
     * Speichert den aktuellen Pfad im Stack des aktiven Tabs.
     * Wird automatisch via useEffect aufgerufen; kann aber manuell getriggert
     * werden (z.B. vor kritischen Navigationen).
     */
    const recordCurrentPath = useCallback(() => {
        const activeTab = getActiveTab();
        if (!activeTab) return;
        const stacks = stacksRef.current;
        stacks[activeTab] = location.pathname;
        stacksRef.current = stacks;
        saveStacks(stacks);
    }, [getActiveTab, location.pathname]);

    return { navigateToTab, getActiveTab, recordCurrentPath };
}