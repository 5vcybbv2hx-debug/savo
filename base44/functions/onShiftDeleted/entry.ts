import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { parseShiftPayload, notifyShiftChange } from '../../shared/shiftNotify.ts';

/**
 * Push + In-App-Meldung, wenn eine Schicht gelöscht wird.
 * Empfänger: ausschließlich der Mitarbeiter der gelöschten Schicht.
 * Undo-Fall (Löschung < 5 Minuten nach dem Anlegen) erzeugt keine Push —
 * die Regel steckt in shared/shiftNotify.ts.
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();

        const { data } = parseShiftPayload(body);

        if (!data) {
            return Response.json({ message: 'Invalid payload' }, { status: 400 });
        }

        const employeeId = data.employee_id;
        if (!employeeId) {
            return Response.json({ message: 'No employee_id in shift — keine Push' });
        }

        const result = await notifyShiftChange(base44, { shift: data, kind: 'delete' });

        return Response.json({ success: true, kind: 'delete', ...result });
    } catch (error) {
        console.error('[onShiftDeleted] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});