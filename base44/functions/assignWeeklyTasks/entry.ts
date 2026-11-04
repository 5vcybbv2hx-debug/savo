import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Automatische Zuweisung von Wochenaufgaben an die Aushilfe mit frühester Schicht
 * Wird täglich um 17:00 Uhr (Vortag) und 16:00 Uhr (Stichtag) ausgeführt
 * 
 * @param {Object} req - Request object
 * @param {string} req.body.daysOffset - (optional) 0=heute, 1=morgen (default: 1)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin-Check
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body for daysOffset (default: 1 = morgen)
    let daysOffset = 1;
    try {
      const body = await req.json();
      if (body.daysOffset !== undefined) daysOffset = body.daysOffset;
    } catch (e) {
      // Kein Body oder JSON-Parse-Fehler — nutze Default
    }

    // Zieldatum (0 = heute, 1 = morgen)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    targetDate.setHours(0, 0, 0, 0);
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    // Wochentag (0=Sonntag, 1=Montag, etc.)
    const targetDayOfWeek = targetDate.getDay();
    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const targetDayName = dayNames[targetDayOfWeek];

    // 0. Betriebsferien / geschlossene Tage: keine automatischen Tagesaufgaben
    const closedOnTarget = await base44.entities.BusinessCalendarDay.filter({ date: targetDateStr });
    const closedDay = closedOnTarget?.[0];
    if (closedDay && (closedDay.is_closed === true || closedDay.day_type === 'betriebsferien')) {
      return Response.json({
        success: true,
        skipped: true,
        message: `${closedDay.title || 'Betriebsferien'} am ${targetDateStr} — keine Tagesaufgaben zugewiesen`,
        assigned: 0,
        date: targetDateStr,
      });
    }

    // 1. Finde alle Schichten am Zieldatum
    const shiftsForTarget = await base44.entities.Shift.filter({
      date: targetDateStr
    });

    if (shiftsForTarget.length === 0) {
      return Response.json({ 
        message: `Keine Schichten am ${targetDateStr}`, 
        assigned: 0,
        date: targetDateStr 
      });
    }

    // 2. Finde alle Aushilfen mit Schichten am Zieldatum
    const aushilfen = await base44.entities.Employee.filter({
      role: 'Aushilfe'
    });

    const aushilfeShifts = shiftsForTarget
      .filter(s => aushilfen.some(a => a.id === s.employee_id))
      .sort((a, b) => a.start_time.localeCompare(b.start_time)); // Nach Startzeit sortieren

    if (aushilfeShifts.length === 0) {
      return Response.json({ 
        message: `Keine Aushilfen am ${targetDateStr} eingeplant`, 
        assigned: 0,
        date: targetDateStr 
      });
    }

    // 3. Die Aushilfe mit frühester Schicht
    const earliestAushilfe = aushilfeShifts[0];
    const targetEmployee = aushilfen.find(a => a.id === earliestAushilfe.employee_id);

    // 4. Finde alle Wochenaufgaben (CleaningTasks), die am Zieldatum fällig sind
    const allTasks = await base44.entities.CleaningTask.filter({
      is_active: true
    });

    let assignedCount = 0;
    const tasksToAssign = [];

    for (const task of allTasks) {
      const shouldAssignToday = (
        (task.frequency === 'täglich') ||
        (task.frequency === 'am Wochenende' && (targetDayOfWeek === 0 || targetDayOfWeek === 6)) ||
        (task.frequency === 'wöchentlich' && task.due_date === targetDateStr) ||
        (task.frequency === 'alle zwei Wochen' && task.biweekly_pattern) ||
        (task.frequency === 'monatlich' && parseInt(task.due_date?.split('-')[2]) === targetDate.getDate())
      );

      if (shouldAssignToday) {
        tasksToAssign.push(task);
      }
    }

    // 5. Weise alle Tasks direkt in der CleaningTask-Entity zu (kein Todo-Duplikat)
    for (const task of tasksToAssign) {
      await base44.entities.CleaningTask.update(task.id, {
        assigned_to: targetEmployee.id,
        assigned_to_name: targetEmployee.name
      });
      assignedCount++;
    }

    return Response.json({
      success: true,
      message: `${assignedCount} Aufgaben zugewiesen an ${targetEmployee.name} (${targetDateStr})`,
      assigned_to: targetEmployee.name,
      assigned_count: assignedCount,
      date: targetDateStr,
      shift_start: earliestAushilfe.start_time,
      offset: daysOffset
    });

  } catch (error) {
    console.error('Error in assignWeeklyTasks:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});