/**
 * roleConfig.js
 * Central source of truth for all roles, permissions, and access rules.
 *
 * Architecture:
 *  - ROLES:             all possible user/employee role values
 *  - PERMISSION_MATRIX: maps every permission key → which roles have it by default
 *  - can():             single function to check a permission at runtime
 *  - buildPermissions(): build the full map for a session (used by permissionsCache)
 *
 * Rule: every permission check in the app must trace back to this file.
 * Never hardcode role strings (e.g. 'admin', 'Manager') outside this module.
 */

// ── Role constants ────────────────────────────────────────────────────────────
export const USER_ROLES = {
    ADMIN: 'admin',  // Full access — base44 platform admin
    USER:  'user',   // Regular authenticated user — access controlled by employeeRole
};

export const EMPLOYEE_ROLES = {
    MANAGER:   'Manager',
    VOLLZEIT:  'Vollzeit',
    BARKEEPER: 'Barkeeper',
    AUSHILFE:  'Aushilfe',
    ORGA:      'Orga',
    TERMINAL:  'terminal',  // kiosk/clock-in terminal — severely restricted
};

export const ROLES = { ...USER_ROLES, ...EMPLOYEE_ROLES };

// ── Role hierarchy helpers ────────────────────────────────────────────────────
export function isAdmin(userRole) {
    return userRole === USER_ROLES.ADMIN;
}

export function isManagerOrAdmin(userRole, employeeRole) {
    return isAdmin(userRole) || employeeRole === EMPLOYEE_ROLES.MANAGER;
}

export function isTerminalSession(userMeta) {
    return userMeta?.is_terminal === true || userMeta?.employeeRole === EMPLOYEE_ROLES.TERMINAL;
}

// ── Permission matrix ─────────────────────────────────────────────────────────
// Format: permKey → { roles: string[], terminal?: bool, sensitive?: bool, adminOnly?: bool }
// roles: employee roles that have this permission by default (Admin always has everything)
// terminal: whether a terminal kiosk session may use this permission
// sensitive: marks high-risk actions (highlighted in UI)
// adminOnly: only platform admin can grant this (not even managers)

const M = EMPLOYEE_ROLES;

export const PERMISSION_MATRIX = {

    // ── Dashboard ─────────────────────────────────────────────────────────────
    // Aushilfe bekommt kein volles Dashboard — sie sehen nur MeinTag
    canViewDashboard:            { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },
    // MeinTag ist in Dashboard integriert — bleibt für Rückwärtskompatibilität
    canViewMeinTag:              { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },

    // ── Schichten & Kalender ──────────────────────────────────────────────────
    canViewShifts:               { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: true  },
    canEditShifts:               { roles: [M.MANAGER],                                       terminal: false },
    canPlanShifts:               { roles: [M.MANAGER],                                       terminal: false },
    canDeleteShifts:             { roles: [M.MANAGER],                                       terminal: false },
    canExportShifts:             { roles: [M.MANAGER],                                       terminal: false },
    canApproveShiftSwaps:        { roles: [M.MANAGER],                                       terminal: false },
    canRequestShiftSwap:         { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },
    canViewTeamCalendar:         { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },
    canViewTeamMeeting:          { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },

    // ── Reservierungen ────────────────────────────────────────────────────────
    // Alle Mitarbeiterrollen können Reservierungen ansehen, anlegen und bearbeiten. Löschen bleibt Manager-only.
    canViewReservations:         { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: true  },
    canCreateReservations:       { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },
    canEditReservations:         { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },
    canDeleteReservations:       { roles: [M.MANAGER],                                       terminal: false },

    // ── Events ───────────────────────────────────────────────────────────────
    // Aushilfe sieht keine Events
    canViewEvents:               { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },
    canCreateEvents:             { roles: [M.MANAGER],                                       terminal: false },
    canEditEvents:               { roles: [M.MANAGER],                                       terminal: false },
    canDeleteEvents:             { roles: [M.MANAGER],                                       terminal: false },
    canViewEventIdeas:           { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },
    canEditEventIdeas:           { roles: [M.MANAGER],                                       terminal: false },

    // ── Lager & Artikel ───────────────────────────────────────────────────────
    canViewWarehouse:            { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },
    canCreateArticles:           { roles: [M.MANAGER, M.BARKEEPER],                          terminal: false },
    canEditArticles:             { roles: [M.MANAGER, M.BARKEEPER],                          terminal: false },
    canDeleteArticles:           { roles: [M.MANAGER],                                       terminal: false },
    canChangeArticlePrices:      { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canViewPriceHistory:         { roles: [M.MANAGER, M.BARKEEPER],                          terminal: false },
    canViewInventory:            { roles: [M.MANAGER, M.BARKEEPER],                          terminal: false },
    canEditInventory:            { roles: [M.MANAGER, M.BARKEEPER],                          terminal: false },

    // ── Lieferanten & Hersteller ──────────────────────────────────────────────
    canViewSuppliers:            { roles: [M.MANAGER, M.BARKEEPER],                          terminal: false },
    canEditSuppliers:            { roles: [M.MANAGER],                                       terminal: false },
    canLinkSuppliers:            { roles: [M.MANAGER, M.BARKEEPER],                          terminal: false },

    // ── Einkauf / Auffüllen ───────────────────────────────────────────────────
    // Aushilfe hat keinen Zugriff auf Einkauf/Auffüllen
    canViewShopping:             { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },
    canEditShopping:             { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },
    canViewRestock:              { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },
    canEditRestock:              { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },

    // ── Reinigung ────────────────────────────────────────────────────────────
    // Aushilfe hat keinen Zugriff auf Reinigung
    canViewCleaning:             { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },
    canEditCleaning:             { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },
    canDeleteCleaning:           { roles: [M.MANAGER],                                       terminal: false },
    canManageCleaningAreas:      { roles: [M.MANAGER],                                       terminal: false },

    // ── Aufgaben ──────────────────────────────────────────────────────────────
    // Aushilfe sieht keine Aufgaben (nur Barkeeper+ und höher)
    canViewTodos:                { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },
    canViewAllTodos:             { roles: [M.MANAGER],                                       terminal: false },
    canCreateTodos:              { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },
    canEditTodos:                { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },
    canDeleteTodos:              { roles: [M.MANAGER],                                       terminal: false },
    canAssignTodos:              { roles: [M.MANAGER],                                       terminal: false },

    // ── Team-Notizen ─────────────────────────────────────────────────────────
    canViewTeamNotes:            { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },
    canViewManagerNotes:         { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canCreateTeamNotes:          { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },
    canEditTeamNotes:            { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],              terminal: false },
    canDeleteTeamNotes:          { roles: [M.MANAGER],                                       terminal: false },
    canPinTeamNotes:             { roles: [M.MANAGER],                                       terminal: false },

    // ── Mitarbeiter ───────────────────────────────────────────────────────────
    canViewEmployees:            { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },
    canEditEmployees:            { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canViewEmployeeDetails:      { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canEditEmployeeShortName:    { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canEditEmployeePermissions:  { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canViewEmployeeHistory:      { roles: [M.MANAGER],                                       terminal: false },

    // ── Rezepte & Getränkekarte ───────────────────────────────────────────────
    canViewRecipes:              { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: true  },
    canCreateRecipes:            { roles: [M.MANAGER, M.BARKEEPER],                          terminal: false },
    canEditRecipes:              { roles: [M.MANAGER, M.BARKEEPER],                          terminal: false },
    canDeleteRecipes:            { roles: [M.MANAGER],                                       terminal: false },
    canViewDrinkMenu:            { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: true  },
    canEditDrinkMenu:            { roles: [M.MANAGER, M.BARKEEPER],                          terminal: false },

    // ── Zeiterfassung ─────────────────────────────────────────────────────────
    canViewOwnTimeEntries:       { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },
    canViewVacation:             { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER],             terminal: false },
    canViewTeamTimeEntries:      { roles: [M.MANAGER],                                       terminal: false },
    canApproveTimeEntries:       { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canCorrectTimeEntries:       { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canClockOutOthers:           { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canBulkClockIn:              { roles: [M.MANAGER],      sensitive: true,                 terminal: false },

    // ── Analytik / Berichte ───────────────────────────────────────────────────
    canViewAnalytics:            { roles: [M.MANAGER],                                       terminal: false },
    canExportReports:            { roles: [M.MANAGER],                                       terminal: false },
    canViewWastage:              { roles: [M.MANAGER, M.BARKEEPER],                          terminal: false },
    canEditWastage:              { roles: [M.MANAGER, M.BARKEEPER],                          terminal: false },
    canViewAuditLog:             { roles: [M.MANAGER],                                       terminal: false },
    canViewSalaryData:           { roles: [],   adminOnly: true,                              terminal: false },
    canViewPriceCalculator:      { roles: [],   adminOnly: true,                              terminal: false },

    // ── Einstellungen ─────────────────────────────────────────────────────────
    canViewSettings:             { roles: [M.MANAGER],                                       terminal: false },
    canEditSettings:             { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canEditCompanySettings:      { roles: [],   adminOnly: true,                              terminal: false },

    // ── Einarbeitung ──────────────────────────────────────────────────────────
    canViewOnboarding:           { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },

    // ── Buchhaltung ───────────────────────────────────────────────────────────
    canViewAccounting:           { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canViewAccountingCashbook:   { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canEditAccountingCashbook:   { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canViewAccountingReceipts:   { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canUploadAccountingReceipts: { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canApproveAccountingReceipts:{ roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canViewAccountingCreditors:  { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canEditAccountingCreditors:  { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canViewAccountingDebitors:   { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canEditAccountingDebitors:   { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canExportAccounting:         { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canCloseAccountingMonth:     { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canLockAccountingMonth:      { roles: [],   adminOnly: true,                              terminal: false },
    canViewDatevExport:          { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canViewTaxAdvisorArea:       { roles: [M.MANAGER],      sensitive: true,                 terminal: false },

    // ── Verbindlichkeiten ─────────────────────────────────────────────────────
    canViewLiabilities:          { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canEditLiabilities:          { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canCreatePaymentPlans:       { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canMarkLiabilityPaid:        { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
    canExportLiabilities:        { roles: [M.MANAGER],      sensitive: true,                 terminal: false },
};

// ── Core permission resolver ──────────────────────────────────────────────────
/**
 * Resolve a single permission for a given session context.
 *
 * @param {string} permKey        - key from PERMISSION_MATRIX
 * @param {object} ctx            - { userRole, employeeRole, isTerminal, customPerms }
 * @returns {boolean}
 */
export function can(permKey, { userRole, employeeRole, isTerminal = false, customPerms = {} }) {
    if (userRole === USER_ROLES.ADMIN) return true;

    const rule = PERMISSION_MATRIX[permKey];
    if (!rule) {
        console.warn(`[permissions] Unknown permission key: "${permKey}"`);
        return false;
    }

    if (rule.adminOnly) return false;
    if (isTerminal && !rule.terminal) return false;

    // Per-employee override takes precedence over role defaults
    if (typeof customPerms[permKey] === 'boolean') return customPerms[permKey];

    return rule.roles.includes(employeeRole);
}

/**
 * Build the full permissions map for a session.
 * Used by permissionsCache — call once, cache the result.
 */
export function buildPermissions(ctx) {
    const map = {};
    for (const key of Object.keys(PERMISSION_MATRIX)) {
        map[key] = can(key, ctx);
    }
    return map;
}