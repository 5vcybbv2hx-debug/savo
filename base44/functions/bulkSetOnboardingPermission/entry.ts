// bulkSetOnboardingPermission.ts
// Einmalig: Setzt canViewOnboarding=true für alle Mitarbeiter die es noch nicht haben.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    const employees = await db.Employee.list(null, 500);
    let updated = 0;

    for (const emp of employees) {
      if (!emp.canViewOnboarding) {
        await db.Employee.update(emp.id, { canViewOnboarding: true });
        updated++;
      }
    }

    return new Response(JSON.stringify({ success: true, total: employees.length, updated }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
