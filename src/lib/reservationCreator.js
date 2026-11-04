/**
 * Ermittelt den Namen des Eintragenden aus created_by (E-Mail).
 * Reihenfolge: Employee.short_name → Employee.name → E-Mail.
 */
export function resolveCreatorName(employees, email) {
    if (!email) return '—';
    const key = String(email).toLowerCase();
    const emp = (employees || []).find(e => e?.email && String(e.email).toLowerCase() === key);
    if (!emp) return email;
    return emp.short_name || emp.name || email;
}