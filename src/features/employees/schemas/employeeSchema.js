/**
 * employeeSchema.js
 * Default values and field constants for Employee forms.
 * Keeps form components free of magic strings and hardcoded defaults.
 */

export const EMPLOYEE_ROLES   = ['Aushilfe', 'Vollzeit', 'Manager'];
export const CONTRACT_TYPES   = ['Minijob', 'Teilzeit', 'Vollzeit'];
export const SKILL_OPTIONS    = ['Barkeeper', 'Service', 'Sonderaufgaben'];
export const TSHIRT_SIZES     = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export const DEFAULT_EMPLOYEE = {
    name:              '',
    role:              'Aushilfe',
    contract_type:     'Minijob',
    hourly_rate:       '',
    email:             '',
    phone:             '',
    skills:            [],
    is_active:         true,
    permissions:       {},
};

export const DEFAULT_PERMISSIONS = {
    canViewDashboard:      true,
    canViewShifts:         true,
    canEditShifts:         false,
    canViewReservations:   true,
    canEditReservations:   true,
    canViewShopping:       true,
    canEditShopping:       true,
    canViewCleaning:       true,
    canEditCleaning:       true,
    canViewTodos:          true,
    canEditTodos:          true,
    canViewEmployees:      true,
    canEditEmployees:      false,
    canViewAnalytics:      false,
    canViewPriceCalculator:false,
    canClockOutOthers:     false,
    canViewOnboarding:     true,
    canViewInventory:      false,
    canViewWastage:        false,
};