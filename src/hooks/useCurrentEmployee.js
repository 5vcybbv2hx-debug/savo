import { useQuery } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';
import { base44 } from '@/api/base44Client';

/**
 * Returns the Employee entity record for the currently logged-in user.
 * Normalizes email (lowercase + trim) to avoid mismatch due to casing or whitespace.
 */
export function useCurrentEmployee() {
    return useQuery({
        queryKey: ['current-employee'],
        queryFn: async () => {
            const user = await base44.auth.me();
            const normalizedEmail = (user.email || '').toLowerCase().trim();

            // Primary: exact match (case-insensitive via normalization)
            const employees = await base44.entities.Employee.filter({
                email: normalizedEmail,
                is_active: true
            });
            if (employees[0]) return employees[0];

            // Fallback: load all active employees and do a loose match
            // (handles cases where stored email has trailing spaces or different casing)
            const all = await base44.entities.Employee.filter({ is_active: true }, 'name', 200);
            return all.find(e => (e.email || '').toLowerCase().trim() === normalizedEmail) || null;
        },
        staleTime: STALE.SLOW,
        retry: 1,
    });
}