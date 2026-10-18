/**
 * useTabNavigation — Bottom-Tab-Navigation mit Stack-Erhaltung pro Tab.
 *
 * Jeder Tab hat seinen eigenen History-Stack. Beim Wechsel zwischen Tabs
 * wird die zuletzt besuchte Seite des jeweiligen Tabs wiederhergestellt —
 * inkl. Unterseiten (Sub-Routes), nicht nur der Tab-Root.
 *
 * WICHTIG (Bugfix): Ein gespeicherter Stack-Pfad darf NUR dann für Tab X
 * gespeichert/wiederhergestellt werden, wenn er zu X gehört — also exakt der
 * Root von X ist ODER ein echter Sub-Pfad davon (startsWith(root + '/')).
 * Der Root eines ANDEREN Tabs (z.B. /Calendar) wird nie als Stack von X
 * gespeichert. Das verhindert, dass ein Tab nach Besuch einer fremden Seite
 * dauerhaft auf dieser Seite hängen bleibt.
 *
 * Funktionsweise:
 *  - lastActiveTabRef merkt sich den aktiven Tab, auch wenn man auf einer
 *    Unterseite ist (wo die URL nicht exakt dem Tab-Root entspricht).
 *  - getActiveTab ermittelt den aktiven Tab anhand der URL: exakter Match
 *    auf Tab-Root, dann Match gegen gültige gespeicherte Stack-Pfade, dann
 *    lastActiveTabRef.
 *  - Beim Tab-Wechsel wird zum gespeicherten Pfad des Ziel-Tabs navigiert
 *    (falls er zu diesem Tab gehört), sonst zum Tab-Root.
 *  - Antippen des aktiven Tabs auf einer Unterseite → navigiert zum Tab-Root.
 */

import { useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Statische Fallback-Root-Seiten für jeden Tab (erste Seite beim erstmaligen
// Besuch). Wird mit den dynamisch übergebenen tabPages ergänzt.
const TAB_ROOTS = {
    Dashboard:       '/',
    GuestHub:        createPageUrl('GuestHub'),
    Todos:           createPageUrl('Todos'),
    TeamCalendar:    createPageUrl('TeamCalendar'),
    TeamHub:         createPageUrl('TeamHub'),
    Calendar:        createPageUrl('Calendar'),
    Restock:         createPageUrl('Restock'),
    MyShifts:        createPageUrl('MyShifts'),
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

/**
 * Baut eine Map page → rootUrl aus den übergebenen tabPages und den
 * statischen TAB_ROOTS. tabPages hat Vorrang (aktuelle Navigation-Konfig).
 */
function buildRootMap(tabPages) {
    const map = {};
    for (const item of tabPages) {
        map[item.page] = item.page === 'Dashboard' ? '/' : createPageUrl(item.page);
    }
    // Statische Fallbacks ergänzen (falls ein Tab nicht in tabPages enthalten)
    for (const [page, url] of Object.entries(TAB_ROOTS)) {
        if (!(page in map)) map[page] = url;
    }
    return map;
}

/**
 * Exakter Tab-Match: gibt den Tab zurück dessen Root exakt auf path passt,
 * oder null bei keiner Übereinstimmung (z.B. Unterseite).
 */
function matchExactTab(path, rootMap) {
    for (const [page, root] of Object.entries(rootMap)) {
        if (path === root) return page;
    }
    return null;
}

/**
 * Prüft, ob ein Pfad zu einem bestimmten Tab gehört — also exakt der Root
 * ist ODER ein echter Sub-Pfad davon (startsWith(root + '/')).
 * Dashboard (root '/') ist ein Sonderfall: nur exakt '/' gehört zu Dashboard,
 * da jeder Pfad mit '/' beginnt.
 */
function isOwnPath(tabPage, path, rootMap) {
    const root = rootMap[tabPage];
    if (!root) return false;
    if (root === '/') return path === '/';
    return path === root || path.startsWith(root + '/');
}

export function useTabNavigation(tabPages) {
    const navigate = useNavigate();
    const location = useLocation();
    const rootMap = buildRootMap(tabPages);
    const stacksRef = useRef(loadStacks());
    const lastActiveTabRef = useRef(null);

    // ── Einmalige Migration: korrupte Stack-Einträge bereinigen ──────────────
    // Entfernt Einträge, deren Pfad der Root eines ANDEREN Tabs ist oder die
    // nicht zum eigenen Tab-Root gehören. Repariert z.B. Pierre's Stand, bei
    // dem /Calendar als Stack von TeamHub gespeichert war.
    useEffect(() => {
        const stacks = stacksRef.current;
        let changed = false;
        for (const [page, path] of Object.entries(stacks)) {
            const exactOwner = matchExactTab(path, rootMap);
            // Pfad ist Root eines anderen Tabs → gehört nicht hierher
            if (exactOwner && exactOwner !== page) {
                delete stacks[page];
                changed = true;
                continue;
            }
            // Pfad gehört nicht zu diesem Tab (weder Root noch Sub-Pfad) → raus
            if (!isOwnPath(page, path, rootMap)) {
                delete stacks[page];
                changed = true;
            }
        }
        if (changed) {
            stacksRef.current = stacks;
            saveStacks(stacks);
        }
        // Nur einmal beim Mount ausführen
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Aktiven Tab anhand der aktuellen URL bestimmen.
    // 1. Exakter Match → Tab-Root.
    // 2. Match gegen gültige gespeicherte Stack-Pfade (nur eigene Pfade).
    // 3. Fallback auf zuletzt bekannten Tab (lastActiveTabRef).
    const getActiveTab = useCallback(() => {
        const path = location.pathname;
        const exact = matchExactTab(path, rootMap);
        if (exact) {
            lastActiveTabRef.current = exact;
            return exact;
        }
        // Unterseite: prüfe ob der aktuelle Pfad als gültiger Stack-Pfad eines
        // Tabs existiert — dann gehört die Seite eindeutig zu diesem Tab.
        const stacks = stacksRef.current;
        for (const item of tabPages) {
            if (stacks[item.page] === path && isOwnPath(item.page, path, rootMap)) {
                lastActiveTabRef.current = item.page;
                return item.page;
            }
        }
        return lastActiveTabRef.current;
    }, [location.pathname, tabPages, rootMap]);

    // Bei jeder Navigation: aktiven Tab ermitteln und aktuellen Pfad im Stack
    // speichern — aber NUR wenn der Pfad wirklich zu diesem Tab gehört.
    useEffect(() => {
        const exactTab = matchExactTab(location.pathname, rootMap);

        if (exactTab) {
            lastActiveTabRef.current = exactTab;
            // Exakter Root → nur für diesen Tab speichern
            const stacks = stacksRef.current;
            stacks[exactTab] = location.pathname;
            stacksRef.current = stacks;
            saveStacks(stacks);
            return;
        }

        // Unterseite: nur speichern wenn der Pfad zum aktiven Tab gehört.
        // Ein fremder Tab-Root (z.B. /Calendar) wird nie als Stack von X gespeichert.
        const activeTab = lastActiveTabRef.current;
        if (activeTab && isOwnPath(activeTab, location.pathname, rootMap)) {
            const stacks = stacksRef.current;
            stacks[activeTab] = location.pathname;
            stacksRef.current = stacks;
            saveStacks(stacks);
        }
    }, [location.pathname, rootMap]);

    /**
     * Zu einem Tab navigieren.
     * - Wenn schon auf dem exakten Tab-Root → keine Aktion.
     * - Antippen des aktiven Tabs auf einer Unterseite → navigiert zum Tab-Root.
     * - Sonst → zum gespeicherten Pfad des Ziel-Tabs (falls er zu diesem Tab
     *   gehört), sonst zum Tab-Root.
     */
    const navigateToTab = useCallback((tabPage) => {
        const exactTab = matchExactTab(location.pathname, rootMap);
        const activeTab = exactTab || lastActiveTabRef.current;

        // Schon auf dem exakten Tab-Root → nichts zu tun
        if (exactTab === tabPage) return;

        // Aktuellen Pfad im Stack des aktiven Tabs speichern (nur wenn er
        // dorthin gehört und wir einen anderen Tab ansteuern)
        if (activeTab && activeTab !== tabPage && isOwnPath(activeTab, location.pathname, rootMap)) {
            const stacks = stacksRef.current;
            stacks[activeTab] = location.pathname;
            stacksRef.current = stacks;
            saveStacks(stacks);
        }

        lastActiveTabRef.current = tabPage;

        const stacks = stacksRef.current;
        const rootUrl = rootMap[tabPage] || createPageUrl(tabPage);
        // Antippen des aktiven Tabs (auf einer Unterseite) → zum Root navigieren.
        // Tab-Wechsel → gespeicherte Unterseite wiederherstellen (nur falls sie
        // zu diesem Tab gehört), sonst Root.
        let targetUrl = rootUrl;
        if (activeTab !== tabPage) {
            const stored = stacks[tabPage];
            if (stored && isOwnPath(tabPage, stored, rootMap)) {
                targetUrl = stored;
            }
        }

        navigate(targetUrl);
    }, [location.pathname, navigate, rootMap]);

    /**
     * Speichert den aktuellen Pfad im Stack des aktiven Tabs.
     * Wird automatisch via useEffect aufgerufen; kann aber manuell getriggert
     * werden (z.B. vor kritischen Navigationen).
     */
    const recordCurrentPath = useCallback(() => {
        const activeTab = getActiveTab();
        if (!activeTab) return;
        if (!isOwnPath(activeTab, location.pathname, rootMap)) return;
        const stacks = stacksRef.current;
        stacks[activeTab] = location.pathname;
        stacksRef.current = stacks;
        saveStacks(stacks);
    }, [getActiveTab, location.pathname, rootMap]);

    return { navigateToTab, getActiveTab, recordCurrentPath };
}