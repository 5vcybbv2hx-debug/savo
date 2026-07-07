import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Generates a random token and saves it to the employee record
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { employee_id } = await req.json();
        if (!employee_id) {
            return Response.json({ error: 'employee_id is required' }, { status: 400 });
        }

        // Only admins/App-Managern erlaubt, Tokens fuer ANDERE zu generieren.
        // WICHTIG: user.role ist die Base44-PLATTFORM-Rolle (nur 'admin'/'user') —
        // NICHT die App-interne Employee.role ('Manager'/'Aushilfe'/...). Der alte
        // Check `user.role === 'manager'` war deshalb IMMER false (diese Plattform-
        // Rolle existiert gar nicht), wodurch nur der Base44-Account-Owner (admin)
        // Tokens fuer andere Mitarbeiter erzeugen konnte — jeder App-interne Manager
        // bekam hier faelschlich 403 und damit einen kaputten Kalender-Link ohne Token.
        let isPrivileged = user.role === 'admin';
        if (!isPrivileged) {
            const requesterMatches = await base44.asServiceRole.entities.Employee.filter({
                email: (user.email || '').toLowerCase().trim(),
            });
            const requesterEmployee = requesterMatches.find(e => e.is_active !== false);
            isPrivileged = requesterEmployee?.role === 'Manager';
        }
        if (!isPrivileged) {
            // Regular users: verify they own this employee record
            const emp = await base44.asServiceRole.entities.Employee.get(employee_id);
            if (!emp || emp.email?.toLowerCase() !== user.email?.toLowerCase()) {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Generate a secure random token
        const tokenBytes = new Uint8Array(24);
        crypto.getRandomValues(tokenBytes);
        const token = btoa(String.fromCharCode(...tokenBytes))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        // Save token to employee record
        await base44.asServiceRole.entities.Employee.update(employee_id, {
            calendar_token: token
        });

        return Response.json({ token });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});