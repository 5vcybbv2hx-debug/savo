import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
    parseShiftPayload,
    formatShiftMessage,
    notifyShiftEmployee,
} from '../../shared/shiftNotify.ts';

/**
 * Push + In-App-Meldung, wenn eine Schicht gelöscht wird.
 * Empfänger: ausschließlich der Mitarbeiter der gelöschten Schicht.
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

        const title = 'Schicht gelöscht';

        const result = await notifyShiftEmployee(base44, {
            shift: data,
            title,
            message: formatShiftMessage(data),
        });

        return Response.json({ success: true, title, ...result });
    } catch (error) {
        console.error('[onShiftDeleted] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});