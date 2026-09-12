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
 *  - getActiveTab ermittelt den aktiven Tab anhand der URL: exakter Match
 *    auf Tab-Root, dann Match gegen gespeicherte Stack-Pfade (fixt falschen
 *    Highlight nach Zurück-Button auf eine Unterseite), dann lastActiveTabRef.
 *  - Beim Tab-Wechsel wird zum gespeicherten Pfad des Ziel-Tabs navigiert.
 *  - Antippen des aktiven Tabs auf einer Unterseite → navigiert zum Tab-Root.
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

// Exakte Tab-Match-Hilfsfunktion: gibt den Tab zurück dessen Root exakt
// auf path passt, oder null bei keiner Übereinstimmung (z.B. Unterseite).
function matchExactTab(path, tabPages) {
    for (const item of tabPages) {
        const url = item.page === 'Dashboard' ? '/' : createPageUrl(item.page);
        if (path === url || (item.page === 'Dashboard' && path === '/')) {
            return item.page;
        }
    }
    return null;
}

export function useTabNavigation(tabPages) {
    const navigate = useNavigate();
    const location = useLocation();
    const stacksRef = useRef(loadStacks());
    const lastActiveTabRef = useRef(null);

    // Aktiven Tab anhand der aktuellen URL bestimmen.
    // 1. Exakter Match → Tab-Root.
    // 2. Match gegen gespeicherte Stack-Pfade → Unterseite eindeutig zuordenbar
    //    (fixt falschen Highlight nach Zurück-Button auf eine Unterseite).
    // 3. Fallback auf zuletzt bekannten Tab (lastActiveTabRef).
    const getActiveTab = useCallback(() => {
        const path = location.pathname;
        const exact = matchExactTab(path, tabPages);
        if (exact) {
            lastActiveTabRef.current = exact;
            return exact;
        }
        // Unterseite: prüfe ob der aktuelle Pfad als gespeicherter Stack-Pfad
        // eines Tabs existiert — dann gehört die Seite eindeutig zu diesem Tab.
        const stacks = stacksRef.current;
        for (const item of tabPages) {
            if (stacks[item.page] === path) {
                lastActiveTabRef.current = item.page;
                return item.page;
            }
        }
        return lastActiveTabRef.current;
    }, [location.pathname, tabPages]);

    // Bei jeder Navigation: aktiven Tab ermitteln und aktuellen Pfad im Stack
    // speichern. Das ist entscheidend für die Erhaltung von Unterseiten.
    useEffect(() => {
        const exactTab = matchExactTab(location.pathname, tabPages);

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
     * - Wenn schon auf dem exakten Tab-Root → keine Aktion.
     * - Aktuellen Pfad im Stack des aktiven Tabs sichern.
     * - Antippen des aktiven Tabs auf einer Unterseite → navigiert zum Tab-Root.
     * - Sonst → zum gespeicherten Pfad des Ziel-Tabs (oder Root).
     */
    const navigateToTab = useCallback((tabPage) => {
        const exactTab = matchExactTab(location.pathname, tabPages);
        const activeTab = exactTab || lastActiveTabRef.current;

        // Schon auf dem exakten Tab-Root → nichts zu tun
        if (exactTab === tabPage) return;

        // Aktuellen Pfad im Stack des aktiven Tabs speichern (nur beim Verlassen
        // eines anderen Tabs)
        if (activeTab && activeTab !== tabPage) {
            const stacks = stacksRef.current;
            stacks[activeTab] = location.pathname;
            stacksRef.current = stacks;
            saveStacks(stacks);
        }

        lastActiveTabRef.current = tabPage;

        const stacks = stacksRef.current;
        const rootUrl = TAB_ROOTS[tabPage] || createPageUrl(tabPage);
        // Antippen des aktiven Tabs (auf einer Unterseite) → zum Root navigieren.
        // Tab-Wechsel → gespeicherte Unterseite wiederherstellen, sonst Root.
        const targetUrl = (activeTab === tabPage) ? rootUrl : (stacks[tabPage] || rootUrl);

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