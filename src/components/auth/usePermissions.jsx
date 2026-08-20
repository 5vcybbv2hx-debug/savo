import { useState, useEffect } from 'react';
import { loadPermissions, clearPermissionsCache, invalidatePermissionsCache } from './permissionsCache';
import { PERMISSION_MATRIX } from './roleConfig';

export { clearPermissionsCache, invalidatePermissionsCache };

// Build default (all-false) state from the matrix so it stays in sync automatically
const defaultPermissions = Object.fromEntries(
    Object.keys(PERMISSION_MATRIX).map(k => [k, false])
);
Object.assign(defaultPermissions, {
    role: null, employeeRole: null, employeeName: null, employeeId: null,
    employee: null, isLoading: true, isAdmin: false, isManager: false, isTerminal: false,
    can: () => false,
});

export function usePermissions() {
    const [permissions, setPermissions] = useState(defaultPermissions);

    useEffect(() => {
        const loadUserPermissions = async () => {
            const loaded = await loadPermissions();
            setPermissions(loaded || defaultPermissions);
        };
        loadUserPermissions();
    }, []);

    return permissions;
}