/**
 * pagePermissions.js
 * Maps every page name to the permission key required to access it.
 * Used by RoleGuard to protect routes from unauthorized direct URL access.
 *
 * If a page is NOT listed here, it is considered publicly accessible to all
 * authenticated users (no guard applied).
 */
export const PAGE_PERMISSIONS = {
    // ── Dashboard ──────────────────────────────────────────────────────────────
    Dashboard:               'canViewDashboard',
    MeinTag:                 'canViewMeinTag',

    // ── Betrieb ────────────────────────────────────────────────────────────────
    GuestHub:                'canViewReservations',
    Todos:                   'canViewTodos',
    Cleaning:                'canViewCleaning',
    CleaningChecklist:       'canViewCleaning',
    Restock:                 'canViewRestock',
    Shopping:                'canViewShopping',
    QuickList:               'canViewShopping',
    Events:                  'canViewEvents',
    ExternalJobs:            'canViewEvents',

    // ── Lager ──────────────────────────────────────────────────────────────────
    Articles:                'canViewWarehouse',
    ArticleEdit:             'canViewWarehouse',
    Warehouse:               'canViewWarehouse',
    Wastage:                 'canViewWastage',
    Suppliers:               'canViewSuppliers',
    Storage:                 'canViewWarehouse',

    // ── Karte & Rezepte ────────────────────────────────────────────────────────
    DrinkMenu:               'canViewDrinkMenu',
    MenuReview:              'canViewDrinkMenu',
    Recipes:                 'canViewRecipes',
    PriceCalculator:         'canViewPriceCalculator',

    // ── Buchhaltung ────────────────────────────────────────────────────────────
    AccountingDashboard:     'canViewAccounting',
    AccountingCashbook:      'canViewAccountingCashbook',
    AccountingReceipts:      'canViewAccountingReceipts',
    AccountingCreditors:     'canViewAccountingCreditors',
    AccountingDebitors:      'canViewAccountingDebitors',
    AccountingExport:        'canExportAccounting',
    AccountingMonthlyClosing:'canCloseAccountingMonth',
    AccountingFixedCosts:    'canViewAccounting',
    AccountingLiabilities:   'canViewLiabilities',
    AccountingBank:          'canViewAccounting',

    // ── Team ───────────────────────────────────────────────────────────────────
    Employees:               'canViewEmployees',
    EmployeeProfile:         'canViewEmployees',
    Calendar:                'canViewShifts',
    Shifts:                  'canViewShifts',
    TeamCalendar:            'canViewTeamCalendar',
    TimeManagement:          'canViewOwnTimeEntries',
    TimeTracking:            'canViewOwnTimeEntries',
    MyShifts:                'canViewShifts',
    Vacation:                'canViewVacation',
    ShiftSwaps:              'canRequestShiftSwap',
    Permissions:             'canEditEmployeePermissions',
    PermissionsNew:          'canEditEmployeePermissions',
    TeamMeeting:             'canViewTeamMeeting',
    WorldCupSchedule:        'canViewTeamMeeting',
    Stationsplan:            'canViewShifts',

    // ── Analytik ───────────────────────────────────────────────────────────────
    DailyAnalysis:           'canViewAnalytics',
    Reports:                 'canViewAnalytics',
    LazyReports:             'canViewAnalytics',
    SalesAnalysis:           'canViewAnalytics',
    LazySalesAnalysis:       'canViewAnalytics',
    ShiftAnalytics:          'canViewAnalytics',

    // ── Einstellungen ──────────────────────────────────────────────────────────
    Settings:                'canViewSettings',
    CompanySettings:         'canEditCompanySettings',
    Documents:               'canViewSettings',
    Maintenance:             'canViewSettings',
    ModuleCenter:            'canViewSettings',
    BusinessCalendar:        'canViewSettings',
    DataQuality:             'isManager',
    DataExport:              'canViewSettings',
    AdminTimeEditor:         'canViewSettings',
    Onboarding:              'canViewOnboarding',
    AuditLog:                'canViewAuditLog',

    // ── Öffnung / Schließung ───────────────────────────────────────────────────

    // ── Betriebsinternes ──────────────────────────────────────────────────────
    OperatorDashboard:       'isAdmin',
    WeeklyTasks:             'canViewSettings',
};