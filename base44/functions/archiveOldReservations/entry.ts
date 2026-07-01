import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function addInterval(dateStr, pattern) {
    const d = new Date(dateStr + 'T00:00:00Z');
    if (pattern === 'weekly') {
        d.setUTCDate(d.getUTCDate() + 7);
    } else if (pattern === 'biweekly') {
        d.setUTCDate(d.getUTCDate() + 14);
    } else if (pattern === 'monthly') {
        d.setUTCMonth(d.getUTCMonth() + 1);
    } else {
        return null;
    }
    return d.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Alle Reservierungen holen
        const allReservations = await base44.asServiceRole.entities.Reservation.list('', 1000);

        // Datum vor 30 Tagen
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let archivedCount = 0;
        let generatedCount = 0;

        // Index existierender Reservierungen pro Serie+Datum, um Duplikate zu vermeiden
        const seriesDates = new Map();
        for (const r of allReservations) {
            if (r.recurring_series_id) {
                const key = `${r.recurring_series_id}__${r.date}`;
                seriesDates.set(key, true);
            }
        }

        for (const reservation of allReservations) {
            const isPast = new Date(reservation.date) < thirtyDaysAgo;

            // Vor dem Archivieren: falls Teil einer wiederkehrenden Serie,
            // sicherstellen dass der naechste Termin bereits existiert.
            if (reservation.is_recurring && reservation.recurring_pattern && reservation.recurring_series_id) {
                const nextDate = addInterval(reservation.date, reservation.recurring_pattern);
                const endOk = !reservation.recurring_end_date || (nextDate && nextDate <= reservation.recurring_end_date);
                const key = nextDate ? `${reservation.recurring_series_id}__${nextDate}` : null;

                if (nextDate && endOk && key && !seriesDates.has(key)) {
                    await base44.asServiceRole.entities.Reservation.create({
                        customer_name: reservation.customer_name,
                        phone: reservation.phone,
                        email: reservation.email,
                        date: nextDate,
                        time: reservation.time,
                        guests: reservation.guests,
                        table: reservation.table,
                        tables: reservation.tables,
                        notes: reservation.notes,
                        status: 'vorgemerkt',
                        is_archived: false,
                        is_recurring: true,
                        recurring_pattern: reservation.recurring_pattern,
                        recurring_end_date: reservation.recurring_end_date,
                        recurring_series_id: reservation.recurring_series_id,
                    });
                    seriesDates.set(key, true);
                    generatedCount++;
                }
            }

            // Alte Reservierungen archivieren
            if (!reservation.is_archived && isPast) {
                await base44.asServiceRole.entities.Reservation.update(reservation.id, {
                    is_archived: true
                });
                archivedCount++;
            }
        }

        return Response.json({
            success: true,
            message: `${archivedCount} Reservierungen archiviert, ${generatedCount} Folgetermine fuer wiederkehrende Serien erzeugt.`,
            archived_count: archivedCount,
            generated_count: generatedCount
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});
