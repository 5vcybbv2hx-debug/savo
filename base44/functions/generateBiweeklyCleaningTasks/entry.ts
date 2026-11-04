import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sonntag, 1 = Montag, 3 = Mittwoch, 4 = Donnerstag

        // Berechne, in welcher Woche des BiWeekly-Zyklus wir sind (0 oder 1)
        // Annahme: Zyklus startet bei Woche 0 am 6. Januar 2025 (Montag)
        const cycleStart = new Date(2025, 0, 6); // 6. Januar 2025
        const weeksDiff = Math.floor((today - cycleStart) / (7 * 24 * 60 * 60 * 1000));
        const cycleWeek = weeksDiff % 2; // 0 oder 1

        const pattern = (() => {
            if (dayOfWeek === 3) { // Mittwoch
                return cycleWeek === 0 ? 'mi_1' : 'mi_2';
            } else if (dayOfWeek === 4) { // Donnerstag
                return cycleWeek === 0 ? 'do_1' : 'do_2';
            }
            return null;
        })();

        if (!pattern) {
            return Response.json({
                success: true,
                message: 'Heute ist kein Putztag für BiWeekly-Aufgaben'
            });
        }

        // Betriebsferien / geschlossene Tage: keine automatischen Tagesaufgaben
        const todayStr = today.toISOString().split('T')[0];
        const closedRows = await base44.asServiceRole.entities.BusinessCalendarDay.filter({ date: todayStr });
        const closedDay = (closedRows || [])[0];
        if (closedDay && (closedDay.is_closed === true || closedDay.day_type === 'betriebsferien')) {
            return Response.json({
                success: true,
                skipped: true,
                message: `${closedDay.title || 'Betriebsferien'} am ${todayStr} — keine BiWeekly-Aufgaben aktiviert`,
                tasks: 0
            });
        }

        // Hole die Aufgaben mit dem heutigen Muster
        const tasks = await base44.entities.CleaningTask.filter({
            biweekly_pattern: pattern,
            is_active: true
        });

        // Prüfe, ob Aufgaben heute bereits aktiviert wurden
        const dateStr = today.toISOString().split('T')[0];
        const alreadyActivated = tasks.some(t => {
            return t.last_reset === dateStr && !t.is_completed;
        });

        if (alreadyActivated) {
            return Response.json({
                success: true,
                message: `Aufgaben für ${pattern} bereits aktiviert`,
                tasks: tasks.length
            });
        }

        // Setze alle Aufgaben für heute zurück (is_completed = false)
        for (const task of tasks) {
            await base44.entities.CleaningTask.update(task.id, {
                is_completed: false,
                completed_by: null,
                completed_at: null,
                last_reset: dateStr
            });
        }

        return Response.json({
            success: true,
            message: `${tasks.length} BiWeekly-Aufgaben aktiviert für ${pattern}`,
            tasks: tasks.length
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});