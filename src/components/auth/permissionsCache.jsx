/**
 * permissionsCache.js
 * Loads, caches, and exposes the resolved permission map for the current user.
 * All permission logic is delegated to roleConfig.buildPermissions — no inline checks here.
 */
import { base44 } from '@/api/base44Client';
import { buildPermissions, isManagerOrAdmin, isTerminalSession, USER_ROLES } from './roleConfig';

let cachedPermissions = null;
let loadingPromise    = null;

export function clearPermissionsCache() {
    cachedPermissions = null;
    loadingPromise    = null;
}

export function invalidatePermissionsCache() {
    clearPermissionsCache();
}

if (import.meta.env.DEV) {
    window.__clearPermissions = clearPermissionsCache;
}

export async function loadPermissions() {
    if (cachedPermissions) return cachedPermissions;
    if (loadingPromise)    return loadingPromise;

    loadingPromise = (async () => {
        // 1. Fetch auth user
        const user = await base44.auth.me();

        // 2. Fetch matching employee record (by email)
        const normalizedEmail = (user.email || '').toLowerCase().trim();
        const employees = await base44.entities.Employee.filter({
            email: normalizedEmail,
        });
        let employee = employees.find(e => e.is_active !== false) ?? null;

        // 3. Build context
        const ctx = {
            userRole:    user.role,
            employeeRole: employee?.role ?? null,
            isTerminal:  isTerminalSession(user),
            customPerms: employee?.permissions ?? {},
        };

        // 4. Derive all permission flags from the matrix — no ad-hoc logic
        const permFlags = buildPermissions(ctx);

        cachedPermissions = {
            // ── Identity ──────────────────────────────────────────────────
            role:          user.role,
            employeeRole:  ctx.employeeRole,
            employeeName:  employee?.name ?? user.full_name,
            employeeId:    employee?.id ?? null,
            isLoading:     false,
            isAdmin:       user.role === USER_ROLES.ADMIN,
            isManager:     isManagerOrAdmin(user.role, ctx.employeeRole),
            isTerminal:    ctx.isTerminal,

            // ── All resolved permission flags ─────────────────────────────
            ...permFlags,
        };

        loadingPromise = null;
        return cachedPermissions;
    })();

    return loadingPromise;
}