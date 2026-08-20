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
 *
 * ── Bridge zum neuen Permission-Registry (permissionRegistry.js) ──────────────
 * PermissionsNew speichert granulare Rechte als Registry-Section-Keys
 * (z.B. inventory_sessions: 'edit'). Diese Brücke leitet jeden alten canXxx-Flag
 * aus dem Registry-System ab, WENN ein expliziter Override vorliegt. Ohne
 * Override gilt weiterhin die alte Rollen-Matrix (kein Regress für Rollen ohne
 * Registry-Template wie Barkeeper/Vollzeit/Aushilfe/Orga).
 */
import { canAccessPermission } from '@/lib/permissionRegistry';

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
    // Aushilfe & Orga sehen Events (inkl. Umgebung-Tab für lokale Events)
    canViewEvents:               { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },
    canCreateEvents:             { roles: [M.MANAGER],                                       terminal: false },
    canEditEvents:               { roles: [M.MANAGER],                                       terminal: false },
    canDeleteEvents:             { roles: [M.MANAGER],                                       terminal: false },
    canViewEventIdeas:           { roles: [M.MANAGER, M.VOLLZEIT, M.BARKEEPER, M.AUSHILFE, M.ORGA], terminal: false },
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

// ── Bridge-Mapping: alter canXxx-Flag → Registry-Section-Key + Level ─────────────
// Wird nur aktiv, wenn employee.permissions den Registry-Key explizit gesetzt hat.
// Siehe can() für die Auflösungslogik.
const CAN_TO_REGISTRY = {
    // Dashboard
    canViewDashboard:            { key: 'dashboard_overview', level: 'view' },
    canViewMeinTag:              { key: 'dashboard_overview', level: 'view' },
    // Schichten
    canViewShifts:               { key: 'shifts_overview',   level: 'view' },
    canEditShifts:               { key: 'shifts_edit',       level: 'edit' },
    canPlanShifts:               { key: 'shifts_create',      level: 'edit' },
    canDeleteShifts:             { key: 'shifts_edit',       level: 'edit' },
    canExportShifts:             { key: 'shifts_export',     level: 'view' },
    canApproveShiftSwaps:        { key: 'shifts_swap',        level: 'edit' },
    canRequestShiftSwap:         { key: 'shifts_swap',        level: 'view' },
    canViewTeamCalendar:         { key: 'teamcalendar_view', level: 'view' },
    canViewTeamMeeting:          { key: 'meeting_topics',     level: 'view' },
    // Reservierungen
    canViewReservations:         { key: 'reservations_view',   level: 'view' },
    canCreateReservations:       { key: 'reservations_create', level: 'edit' },
    canEditReservations:         { key: 'reservations_edit',  level: 'edit' },
    canDeleteReservations:       { key: 'reservations_edit',   level: 'edit' },
    // Events
    canViewEvents:               { key: 'events_view',  level: 'view' },
    canCreateEvents:             { key: 'events_manage', level: 'edit' },
    canEditEvents:               { key: 'events_manage', level: 'edit' },
    canDeleteEvents:             { key: 'events_manage', level: 'edit' },
    canViewEventIdeas:           { key: 'events_ideas',  level: 'view' },
    canEditEventIdeas:           { key: 'events_ideas',  level: 'edit' },
    // Lager & Artikel
    canViewWarehouse:            { key: 'warehouse_overview', level: 'view' },
    canCreateArticles:           { key: 'shopping_articles',  level: 'edit' },
    canEditArticles:             { key: 'shopping_articles',  level: 'edit' },
    canDeleteArticles:           { key: 'shopping_articles',  level: 'edit' },
    canChangeArticlePrices:      { key: 'shopping_articles',  level: 'edit' },
    canViewPriceHistory:         { key: 'shopping_articles',  level: 'view' },
    canViewInventory:            { key: 'inventory_sessions', level: 'view' },
    canEditInventory:            { key: 'inventory_sessions', level: 'edit' },
    // Lieferanten
    canViewSuppliers:            { key: 'shopping_suppliers', level: 'view' },
    canEditSuppliers:            { key: 'shopping_suppliers', level: 'edit' },
    canLinkSuppliers:            { key: 'shopping_suppliers', level: 'edit' },
    // Einkauf / Auffüllen
    canViewShopping:             { key: 'shopping_list', level: 'view' },
    canEditShopping:             { key: 'shopping_list', level: 'edit' },
    canViewRestock:              { key: 'storage_stock', level: 'view' },
    canEditRestock:              { key: 'storage_stock', level: 'edit' },
    // Reinigung
    canViewCleaning:             { key: 'cleaning_tasks', level: 'view' },
    canEditCleaning:             { key: 'cleaning_manage', level: 'edit' },
    canDeleteCleaning:           { key: 'cleaning_manage', level: 'edit' },
    canManageCleaningAreas:      { key: 'cleaning_manage', level: 'edit' },
    // Aufgaben
    canViewTodos:                { key: 'todos_all',     level: 'view' },
    canViewAllTodos:             { key: 'todos_all',     level: 'view' },
    canCreateTodos:              { key: 'todos_create',  level: 'edit' },
    canEditTodos:                { key: 'todos_create',  level: 'edit' },
    canDeleteTodos:              { key: 'todos_create',  level: 'edit' },
    canAssignTodos:              { key: 'todos_create',  level: 'edit' },
    // Team-Notizen / Meeting
    canViewTeamNotes:            { key: 'meeting_topics', level: 'view' },
    canViewManagerNotes:         { key: 'dashboard_manager', level: 'view' },
    canCreateTeamNotes:          { key: 'meeting_topics', level: 'edit' },
    canEditTeamNotes:            { key: 'meeting_topics', level: 'edit' },
    canDeleteTeamNotes:          { key: 'meeting_manage', level: 'edit' },
    canPinTeamNotes:             { key: 'meeting_manage', level: 'edit' },
    // Mitarbeiter
    canViewEmployees:            { key: 'employees_list',        level: 'view' },
    canEditEmployees:            { key: 'employees_manage',      level: 'edit' },
    canViewEmployeeDetails:      { key: 'employees_list',        level: 'view' },
    canEditEmployeeShortName:    { key: 'employees_manage',      level: 'edit' },
    canEditEmployeePermissions:  { key: 'employees_permissions', level: 'edit' },
    canViewEmployeeHistory:      { key: 'employees_list',        level: 'view' },
    // Rezepte & Karte
    canViewRecipes:              { key: 'recipes_view',  level: 'view' },
    canCreateRecipes:            { key: 'recipes_manage', level: 'edit' },
    canEditRecipes:              { key: 'recipes_manage', level: 'edit' },
    canDeleteRecipes:            { key: 'recipes_manage', level: 'edit' },
    canViewDrinkMenu:            { key: 'menu_view',   level: 'view' },
    canEditDrinkMenu:            { key: 'menu_items',  level: 'edit' },
    // Zeiterfassung
    canViewOwnTimeEntries:       { key: 'time_own',         level: 'view' },
    canViewVacation:             { key: 'vacation_own',    level: 'view' },
    canViewTeamTimeEntries:      { key: 'time_team',       level: 'view' },
    canApproveTimeEntries:       { key: 'time_approvals',  level: 'edit' },
    canCorrectTimeEntries:       { key: 'time_corrections', level: 'edit' },
    canClockOutOthers:           { key: 'time_clockout',    level: 'edit' },
    canBulkClockIn:              { key: 'time_clockout',    level: 'edit' },
    // Analytik / Berichte
    canViewAnalytics:            { key: 'reports_analysis', level: 'view' },
    canExportReports:            { key: 'reports_export',   level: 'view' },
    canViewWastage:              { key: 'wastage_record',    level: 'view' },
    canEditWastage:              { key: 'wastage_record',    level: 'edit' },
    canViewAuditLog:             { key: 'auditlog_view',     level: 'view' },
    canViewPriceCalculator:      { key: 'pricecalc_use',     level: 'view' },
    // Einstellungen
    canViewSettings:             { key: 'settings_company',     level: 'view' },
    canEditSettings:             { key: 'settings_company',     level: 'edit' },
    canViewOnboarding:           { key: 'employees_forms',       level: 'view' },
    // Buchhaltung
    canViewAccounting:             { key: 'accounting_dashboard',         level: 'view' },
    canViewAccountingCashbook:      { key: 'accounting_cashbook_view',     level: 'view' },
    canEditAccountingCashbook:      { key: 'accounting_cashbook_edit',     level: 'edit' },
    canViewAccountingReceipts:     { key: 'accounting_receipts_view',     level: 'view' },
    canUploadAccountingReceipts:   { key: 'accounting_receipts_upload',   level: 'edit' },
    canApproveAccountingReceipts:  { key: 'accounting_receipts_approve',  level: 'edit' },
    canViewAccountingCreditors:    { key: 'accounting_creditors_view',    level: 'view' },
    canEditAccountingCreditors:    { key: 'accounting_creditors_edit',    level: 'edit' },
    canViewAccountingDebitors:     { key: 'accounting_debitors_view',     level: 'view' },
    canEditAccountingDebitors:     { key: 'accounting_debitors_edit',     level: 'edit' },
    canExportAccounting:           { key: 'accounting_export_run',        level: 'edit' },
    canCloseAccountingMonth:       { key: 'accounting_closing_close',     level: 'edit' },
    canViewDatevExport:            { key: 'accounting_datev_view',        level: 'view' },
    canViewTaxAdvisorArea:         { key: 'accounting_dashboard',         level: 'view' },
};

// ── Core permission resolver ──────────────────────────────────────────────────
/**
 * Resolve a single permission for a given session context.
 *
 * @param {string} permKey        - key from PERMISSION_MATRIX
 * @param {object} ctx            - { userRole, employeeRole, isTerminal, customPerms }
 * @returns {boolean}
 */
export function can(permKey, ctx) {
    const { userRole, employeeRole, isTerminal = false, customPerms = {}, employee } = ctx || {};
    if (userRole === USER_ROLES.ADMIN) return true;

    const rule = PERMISSION_MATRIX[permKey];
    if (!rule) {
        console.warn(`[permissions] Unknown permission key: "${permKey}"`);
        return false;
    }

    if (rule.adminOnly) return false;
    if (isTerminal && !rule.terminal) return false;

    // 1) Legacy boolean override (canXxx: true/false direkt in employee.permissions)
    if (typeof customPerms[permKey] === 'boolean') return customPerms[permKey];

    // 2) Bridge ins neue Registry-System: nur aktiv, wenn ein expliziter Override
    //    für den zugehörigen Registry-Key vorliegt. Kein Override → alte Rollen-Matrix
    //    (verhindert Regress für Rollen ohne Registry-Template wie Barkeeper/Vollzeit).
    const map = CAN_TO_REGISTRY[permKey];
    if (map && customPerms && map.key in customPerms && employee) {
        try {
            return canAccessPermission(employee, map.key, map.level);
        } catch {
            // Fällt durch zur Rollen-Matrix
        }
    }

    // 3) Rollen-Matrix (Default)
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