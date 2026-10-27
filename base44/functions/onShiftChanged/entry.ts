import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
    parseShiftPayload,
    isRelevantShiftChange,
    formatShiftMessage,
    notifyShiftEmployee,
} from '../../shared/shiftNotify.ts';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();

        const { eventType, data, oldData, changedFields } = parseShiftPayload(body);

        if (!eventType || !data) {
            return Response.json({ message: 'Invalid payload' }, { status: 400 });
        }

        // Empfänger ist immer der Mitarbeiter der geänderten Schicht
        const employeeId = data.employee_id;
        if (!employeeId) {
            return Response.json({ message: 'No employee_id in shift — keine Push' });
        }

        // Technische Feld-Writes (z.B. clockin_reminder_sent) lösen keine Meldung aus
        if (!isRelevantShiftChange(eventType, data, oldData, changedFields)) {
            return Response.json({
                skipped: true,
                reason: 'irrelevant_change',
                changed_fields: changedFields || null,
            });
        }

        const isCreate = eventType === 'create';
        const title = isCreate ? 'Neue Schicht eingeplant' : 'Schicht geändert';

        const result = await notifyShiftEmployee(base44, {
            shift: data,
            title,
            message: formatShiftMessage(data),
        });

        return Response.json({ success: true, title, ...result });
    } catch (error) {
        console.error('[onShiftChanged] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});