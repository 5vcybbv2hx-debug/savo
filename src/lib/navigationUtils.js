/**
 * Navigation Utilities
 * Zentrale Route-Verwaltung, Link-Generierung, Breadcrumbs
 */

// ── Route Registry ────────────────────────────────────────────────────
// Alle Seiten mit Metadaten für konsistente Navigation
export const ROUTES = {
  // Core
  DASHBOARD: '/',
  SHOPPING: '/Shopping',
  TODOS: '/Todos',
  CALENDAR: '/Calendar',
  TEAM_CALENDAR: '/TeamCalendar',
  
  // Employee
  EMPLOYEES: '/Employees',
  EMPLOYEE_PROFILE: (id) => `/EmployeeProfile/${id}`,
  MY_SHIFTS: '/MyShifts',
  
  // Time & Shifts
  SHIFTS: '/Shifts',
  SHIFT_SWAPS: '/MyShifts',
  TIME_TRACKING: '/TimeTracking',
  
  // Operations
  DRINK_MENU: '/DrinkMenu',
  RECIPES: '/Recipes',
  ARTICLES: '/Articles',
  PRICE_CALCULATOR: '/PriceCalculator',
  RESERVATIONS: '/Reservations',
  CLEANING: '/Cleaning',
  CLEANING_CHECKLIST: '/CleaningChecklist',
  
  // Reports & Analytics
  SALES_ANALYSIS: '/SalesAnalysis',
  DAILY_ANALYSIS: '/DailyAnalysis',
  REPORTS: '/Reports',
  WASTAGE: '/Wastage',
  INVENTORY: '/Inventory',
  
  // Settings
  SETTINGS: '/Settings',
  PERMISSIONS: '/Permissions',
  
  // Public
  PUBLIC_DRINK_MENU: '/PublicDrinkMenu',
  PUBLIC_WEEKLY_SPECIAL: '/PublicWeeklySpecialDisplay',
  STORAGE_LOCATION_SCAN: (id) => `/StorageLocationScan/${id}`,
};

/**
 * Generiere eine konsistente URL für eine Seite
 * @param {string} pageName - z.B. "Dashboard", "My Shifts"
 * @returns {string} - z.B. "/Dashboard", "/my-shifts"
 */
export function createPageUrl(pageName) {
  if (!pageName) return '/';
  return '/' + pageName.replace(/\s+/g, '-').toLowerCase();
}

/**
 * Definiere Breadcrumb-Pfade für Seiten
 * Format: { path: label }
 */
export const BREADCRUMB_PATHS = {
  '/': 'Dashboard',
  '/Shopping': 'Einkaufen',
  '/Todos': 'Aufgaben',
  '/Employees': 'Mitarbeiter',
  '/Shifts': 'Schichten',
  '/MyShifts': 'Meine Schichten',
  '/Settings': 'Einstellungen',
  '/DrinkMenu': 'Getränkekarte',
  '/Articles': 'Artikel',
  '/Reservations': 'Reservierungen',
};

/**
 * Extrahiere Breadcrumb-Pfad aus aktueller Route
 * @param {string} currentPath - z.B. "/Storage"
 * @returns {Array<{path: string, label: string}>} - Breadcrumb-Trail
 */
export function getBreadcrumbs(currentPath) {
  const breadcrumbs = [{ path: '/', label: 'Dashboard' }];
  
  if (currentPath === '/') return breadcrumbs;
  
  // Für dynamische Routen (z.B. /EmployeeProfile/123)
  const segments = currentPath.split('/').filter(Boolean);
  let path = '';
  
  segments.forEach((segment, i) => {
    path += '/' + segment;
    
    // Skip IDs
    if (/^[a-f0-9-]{20,}$/.test(segment)) return;
    
    const label = BREADCRUMB_PATHS[path] || segment
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase());
    
    breadcrumbs.push({ path, label });
  });
  
  return breadcrumbs;
}

/**
 * Generiere sichere Link-Klassen mit Status-Styles
 * @param {boolean} isActive - Ist die Seite aktiv?
 * @returns {string} - Tailwind-Klassen
 */
export function getLinkClasses(isActive) {
  return isActive
    ? 'text-foreground font-semibold'
    : 'text-muted-foreground hover:text-foreground transition-colors';
}

/**
 * Navigation Item Definition
 */
export const NAVIGATION_ITEMS = [
  {
    section: 'Core',
    items: [
      { name: 'Dashboard', path: ROUTES.DASHBOARD, icon: 'Home' },

      { name: 'Shopping', path: ROUTES.SHOPPING, icon: 'ShoppingCart' },
      { name: 'Todos', path: ROUTES.TODOS, icon: 'CheckSquare' },
    ],
  },
  {
    section: 'Team',
    items: [
      { name: 'Calendar', path: ROUTES.CALENDAR, icon: 'Calendar' },
      { name: 'Employees', path: ROUTES.EMPLOYEES, icon: 'Users' },
      { name: 'Shifts', path: ROUTES.SHIFTS, icon: 'Clock' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { name: 'Menu', path: ROUTES.DRINK_MENU, icon: 'Wine' },
      { name: 'Articles', path: ROUTES.ARTICLES, icon: 'Package' },
      { name: 'Reservations', path: ROUTES.RESERVATIONS, icon: 'Calendar' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { name: 'Settings', path: ROUTES.SETTINGS, icon: 'Settings' },
      { name: 'Company', path: ROUTES.COMPANY_SETTINGS, icon: 'Building' },
    ],
  },
];

export default ROUTES;