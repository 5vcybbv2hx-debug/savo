import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Feiertage Baden-Württemberg (inlined — cross-function imports not allowed) ──
function getEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function getHolidaysBW(year) {
    const easter = getEasterSunday(year);
    return [
        { date: new Date(year, 0, 1), name: 'Neujahr' },
        { date: new Date(year, 0, 6), name: 'Heilige Drei Könige' },
        { date: addDays(easter, -2), name: 'Karfreitag' },
        { date: addDays(easter, 1), name: 'Ostermontag' },
        { date: new Date(year, 4, 1), name: 'Tag der Arbeit' },
        { date: addDays(easter, 39), name: 'Christi Himmelfahrt' },
        { date: addDays(easter, 50), name: 'Pfingstmontag' },
        { date: addDays(easter, 60), name: 'Fronleichnam' },
        { date: new Date(year, 9, 3), name: 'Tag der Deutschen Einheit' },
        { date: new Date(year, 10, 1), name: 'Allerheiligen' },
        { date: new Date(year, 11, 25), name: '1. Weihnachtstag' },
        { date: new Date(year, 11, 26), name: '2. Weihnachtstag' }
    ];
}

function getHolidayName(date, holidays) {
    const holiday = holidays.find(h =>
        h.date.getFullYear() === date.getFullYear() &&
        h.date.getMonth() === date.getMonth() &&
        h.date.getDate() === date.getDate()
    );
    return holiday?.name || null;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { date, year, month } = await req.json();
        
        // Hole alle Vollzeitkräfte
        const employees = await base44.asServiceRole.entities.Employee.filter({ 
            is_active: true,
            contract_type: 'Vollzeit'
        });

        if (employees.length === 0) {
            return Response.json({ 
                success: true, 
                message: 'Keine Vollzeitkräfte gefunden',
                credited: []
            });
        }

        // Hole Öffnungszeiten
        const openingHours = await base44.asServiceRole.entities.OpeningHours.list();
        
        // Bestimme Feiertage
        let holidays;
        if (date) {
            // Einzelner Tag
            const targetDate = new Date(date);
            const targetYear = targetDate.getFullYear();
            holidays = getHolidaysBW(targetYear);
            const holidayName = getHolidayName(targetDate, holidays);
            
            if (!holidayName) {
                return Response.json({ 
                    success: false, 
                    error: 'Kein Feiertag an diesem Datum' 
                });
            }
            
            holidays = [{ date: targetDate, name: holidayName }];
        } else if (month && year) {
            // Ganzer Monat
            holidays = getHolidaysBW(parseInt(year));
            holidays = holidays.filter(h => {
                const m = h.date.getMonth() + 1;
                return m === parseInt(month) && h.date.getFullYear() === parseInt(year);
            });
        } else {
            return Response.json({ 
                success: false, 
                error: 'Bitte date oder year+month angeben' 
            });
        }

        const credited = [];
        const skipped = [];

        for (const holiday of holidays) {
            const dayName = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][holiday.date.getDay()];
            
            // Prüfe ob an diesem Tag normalerweise geöffnet ist
            const isOpeningDay = openingHours.some(oh => oh.day_of_week === dayName && oh.is_open);
            
            if (!isOpeningDay) {
                skipped.push({
                    date: holiday.date.toISOString().split('T')[0],
                    name: holiday.name,
                    reason: 'Kein Öffnungstag'
                });
                continue;
            }

            const dateStr = holiday.date.toISOString().split('T')[0];

            // Für jeden Vollzeitangestellten einen Eintrag erstellen
            for (const employee of employees) {
                // Prüfe ob bereits ein Eintrag existiert
                const existing = await base44.asServiceRole.entities.TimeEntry.filter({
                    employee_id: employee.id,
                    date: dateStr
                });

                if (existing.length > 0) {
                    skipped.push({
                        date: dateStr,
                        name: holiday.name,
                        employee: employee.name,
                        reason: 'Eintrag existiert bereits'
                    });
                    continue;
                }

                // Erstelle TimeEntry mit 8 Stunden
                await base44.asServiceRole.entities.TimeEntry.create({
                    employee_id: employee.id,
                    employee_name: employee.name,
                    date: dateStr,
                    start_time: '00:00',
                    end_time: '08:00',
                    break_minutes: 0,
                    total_hours: 8,
                    notes: `Feiertag: ${holiday.name}`,
                    status: 'genehmigt',
                    employee_confirmed: true,
                    employee_confirmed_at: new Date().toISOString(),
                    manager_approved_by: user.email,
                    manager_approved_at: new Date().toISOString()
                });

                credited.push({
                    date: dateStr,
                    name: holiday.name,
                    employee: employee.name,
                    hours: 8
                });
            }
        }

        return Response.json({ 
            success: true,
            credited,
            skipped,
            summary: `${credited.length} Einträge gutgeschrieben, ${skipped.length} übersprungen`
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});