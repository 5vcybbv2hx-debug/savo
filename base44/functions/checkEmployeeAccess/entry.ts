import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Zugriffsprüfung für Personaldaten (Employee).
 * Antwortet immer mit { allowed, reason } — kein 403, damit das Frontend
 * sauber entscheiden kann und Fehlkonfiguration nicht aussperrt.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ allowed: false, reason: 'unauthenticated' }, { status: 401 });

    const { employeeId, action = 'view' } = await req.json().catch(() => ({}));

    if (user.role === 'admin') {
      return Response.json({ allowed: true, reason: 'platform_admin' });
    }

    const mine = await base44.entities.Employee.filter({ email: user.email });
    const me = mine?.[0] || null;

    if (me && ['Manager', 'Admin'].includes(me.role)) {
      return Response.json({ allowed: true, reason: 'manager' });
    }
    if (me && (!employeeId || me.id === employeeId)) {
      return Response.json({ allowed: true, reason: 'owner' });
    }

    return Response.json({ allowed: false, reason: action === 'edit' ? 'not_owner_or_manager' : 'not_visible' });
  } catch (error) {
    // Fehloffen: ein Backend-Fehler darf niemanden aussperren.
    return Response.json({ allowed: true, reason: `fail_open: ${error.message}` });
  }
});
