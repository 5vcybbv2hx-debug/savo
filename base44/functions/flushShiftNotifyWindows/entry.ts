import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { flushShiftNotifyWindows } from '../../shared/shiftNotify.ts';

/**
 * Schließt abgelaufene Schicht-Push-Fenster (60 s) ab und sendet pro Mitarbeiter
 * EINE Sammelnachricht. Wird vom Workflow "Schicht-Push Sammelnachrichten"
 * aufgerufen — nur für Admins bzw. den Workflow bestimmt.
 */
export default async function (req: Request): Promise<Response> {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

        const result = await flushShiftNotifyWindows(base44);

        return Response.json({ success: true, ...result });
    } catch (error) {
        console.error('[flushShiftNotifyWindows] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}