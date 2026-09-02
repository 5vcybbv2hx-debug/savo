import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SAVO Atlas Export — Backend Function
 * Schema: SAVO_ATLAS_EXPORT_V1
 * Deployed: Atlas Export page wiring
 * 
 * Exportiert operative Tagesdaten für die Controlling-App "Atlas".
 * Reiner Lese-Export — keine Datenänderung.
 */

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateExportId() {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const t = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SAVO-EXP-${d}-${t}-${r}`;
}

function getWeekday(dateStr) {
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
}

function filterByDate(records, dateStr, field = 'date') {
  return records.filter(r => {
    const val = r[field];
    if (!val) return false;
    if (field === 'clock_in') return val.startsWith(dateStr);
    return val === dateStr;
  });
}

function calculateEmployeeCost(hours, hourlyRate, monthlySalary, weeklyHours) {
  if (hourlyRate && hourlyRate > 0) return Math.round(hours * hourlyRate * 100) / 100;
  if (monthlySalary && monthlySalary > 0 && weeklyHours && weeklyHours > 0) {
    const dayRate = monthlySalary / 30;
    const dailyHours = weeklyHours / 7;
    return Math.round(dayRate * (hours / dailyHours) * 100) / 100;
  }
  return null;
}

// ── Hauptfunktion ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const { period_from, period_to, preview_only = false } = await req.json();
    if (!period_from || !period_to) return Response.json({ error: 'period_from and period_to are required' }, { status: 400 });

    // ── 1. DailyRevenue im Zeitraum ──────────────────────────────────────────
    const allRevenue = await base44.asServiceRole.entities.DailyRevenue.list('-date', 2000);
    const revenueRecords = allRevenue.filter(r => r.date >= period_from && r.date <= period_to);

    if (revenueRecords.length === 0) {
      return Response.json({
        success: true,
        preview: { operating_days: 0, gross_revenue: 0, personnel_hours: 0, personnel_cost: 0, keg_changes: 0, events: 0, warnings: ['Keine Tagesabschlüsse im gewählten Zeitraum gefunden.'] }
      });
    }

    // ── 2. Verknüpfte Daten ───────────────────────────────────────────────────
    const allEmployees = await base44.asServiceRole.entities.Employee.list('-created_date', 500);
    const employeeMap = {};
    allEmployees.forEach(emp => { employeeMap[emp.id] = emp; });

    const allClockEntries = await base44.asServiceRole.entities.ClockEntry.list('-clock_in', 2000);
    const allTimeEntries = await base44.asServiceRole.entities.TimeEntry.list('-date', 2000);
    const allEvents = await base44.asServiceRole.entities.Event.list('-date', 500);
    const allClosingSessions = await base44.asServiceRole.entities.ClosingSession.list('-date', 2000);
    const allWastage = await base44.asServiceRole.entities.Wastage.list('-date', 2000);
    const allTips = await base44.asServiceRole.entities.TipDistribution.list('-date', 2000);
    const allInventory = await base44.asServiceRole.entities.InventorySession.list('-date', 500);
    const allSalesData = await base44.asServiceRole.entities.SalesDataItem.list('-date', 2000);

    // ── 3. Preview ───────────────────────────────────────────────────────────
    if (preview_only) {
      let totalRevenue = 0, totalHours = 0, totalCost = 0, eventCount = 0, kegCount = 0;
      const warnings = [];

      for (const rev of revenueRecords) {
        totalRevenue += rev.revenue || 0;
        totalCost += rev.labor_cost_total || 0;
        const dayClock = filterByDate(allClockEntries, rev.date, 'clock_in');
        totalHours += dayClock.reduce((s, c) => s + (c.total_hours || 0), 0);
        eventCount += allEvents.filter(e => e.date === rev.date).length;
        kegCount += allWastage.filter(w => w.date === rev.date && w.type === 'Nachtwächter').length;

        if (!rev.revenue || rev.revenue <= 0) warnings.push(`${rev.date}: Umsatz fehlt oder 0`);
        if (dayClock.length === 0) warnings.push(`${rev.date}: Keine Arbeitszeitdaten (ClockEntry)`);
        if (!rev.labor_cost_total && !rev.manual_labor_cost_daily) warnings.push(`${rev.date}: Keine Personalkosten erfasst`);
      }

      const dateCounts = {};
      revenueRecords.forEach(r => { dateCounts[r.date] = (dateCounts[r.date] || 0) + 1; });
      Object.entries(dateCounts).forEach(([date, count]) => {
        if (count > 1) warnings.push(`${date}: ${count} Tagesabschlüsse (Duplikat!)`);
      });

      return Response.json({
        success: true,
        preview: {
          operating_days: revenueRecords.length,
          gross_revenue: Math.round(totalRevenue * 100) / 100,
          personnel_hours: Math.round(totalHours * 100) / 100,
          personnel_cost: Math.round(totalCost * 100) / 100,
          keg_changes: kegCount,
          events: eventCount,
          warnings
        }
      });
    }

    // ── 4. Vollständiger Export ──────────────────────────────────────────────
    const days = [];
    let totalRevenue = 0, totalHours = 0, totalCost = 0, totalEvents = 0, totalKegChanges = 0;

    for (const rev of revenueRecords) {
      const dateStr = rev.date;

      // SalesDataItem: Umsatz nach Warengruppen
      const daySales = filterByDate(allSalesData, dateStr, 'date');
      const revenueByCategory = {};
      daySales.forEach(s => {
        const cat = s.category || 'Sonstiges';
        if (!revenueByCategory[cat]) revenueByCategory[cat] = { revenue: 0, quantity: 0, items: 0 };
        revenueByCategory[cat].revenue += s.revenue || 0;
        revenueByCategory[cat].quantity += s.quantity_sold || 0;
        revenueByCategory[cat].items += 1;
      });
      Object.keys(revenueByCategory).forEach(cat => {
        revenueByCategory[cat].revenue = Math.round(revenueByCategory[cat].revenue * 100) / 100;
      });

      // Fasswechsel: Wastage type="Nachtwächter" als Proxy
      const dayKegWastage = allWastage.filter(w => w.date === dateStr && w.type === 'Nachtwächter');
      const kegChanges = dayKegWastage.map(w => ({
        product_name: w.article_name || null,
        quantity: w.quantity || null,
        unit: w.unit || null,
      }));

      const dayData = {
        source_record_id: rev.id,
        date: dateStr,
        weekday: getWeekday(dateStr),
        revision: 1,
        updated_at: rev.updated_date || rev.created_date,

        operations: {
          is_operating_day: true,
          busyness_level: rev.busyness_level || null,
          guest_count: rev.guest_count || null,
          staff_count: rev.staff_count || null,
          weather: {
            temp_max: rev.weather_temp_max || null,
            temp_mean: rev.weather_temp_mean || null,
            precipitation: rev.weather_precipitation || null,
            code: rev.weather_code || null,
            description: rev.weather_description || null,
          },
          is_holiday: rev.is_holiday || false,
          is_holiday_eve: rev.is_holiday_eve || false,
          is_bridge_day: rev.is_bridge_day || false,
          is_school_vacation: rev.is_school_vacation || false,
          holiday_name: rev.holiday_name || null,
          season: rev.season || null,
          local_event_impact: rev.local_event_impact || null,
        },

        sales: {
          gross_revenue: rev.revenue || null,
          net_revenue: rev.revenue && rev.vat ? Math.round((rev.revenue - rev.vat) * 100) / 100 : null,
          vat: rev.vat || null,
          own_consumption: rev.own_consumption || null,
          cash: rev.revenue_cash || null,
          card: rev.revenue_ec || null,
          other: null,
          transaction_count: daySales.length > 0 ? daySales.length : null,
          revenue_by_category: Object.keys(revenueByCategory).length > 0 ? revenueByCategory : null,
          revenue_by_area: null,
        },

        payments: {
          cash: rev.revenue_cash || null,
          card: rev.revenue_ec || null,
          other: null,
        },

        personnel: {
          total_hours: null,
          total_cost: rev.labor_cost_total || rev.manual_labor_cost_daily || null,
          employees: [],
        },

        beer_and_kegs: {
          keg_changes: kegChanges,
        },

        events: [],

        inventory: {
          sessions: [],
          wastage: [],
        },

        notes: [],
      };

      // ── Personal pro Tag ─────────────────────────────────────────────────────
      const dayClockEntries = filterByDate(allClockEntries, dateStr, 'clock_in');
      const dayTimeEntries = filterByDate(allTimeEntries, dateStr, 'date');
      const employeeHours = {};

      dayClockEntries.forEach(ce => {
        const empId = ce.employee_id;
        if (!empId) return;
        if (!employeeHours[empId]) {
          employeeHours[empId] = { employee_id: empId, name: ce.employee_name || employeeMap[empId]?.name || 'Unbekannt', hours: 0 };
        }
        employeeHours[empId].hours += ce.total_hours || 0;
      });

      if (Object.keys(employeeHours).length === 0) {
        dayTimeEntries.forEach(te => {
          const empId = te.employee_id;
          if (!empId) return;
          if (!employeeHours[empId]) {
            employeeHours[empId] = { employee_id: empId, name: te.employee_name || employeeMap[empId]?.name || 'Unbekannt', hours: 0 };
          }
          employeeHours[empId].hours += te.total_hours || 0;
        });
      }

      let dayTotalHours = 0;
      const employeeList = [];
      Object.values(employeeHours).forEach(eh => {
        const emp = employeeMap[eh.employee_id];
        const hours = Math.round(eh.hours * 100) / 100;
        dayTotalHours += hours;
        const cost = calculateEmployeeCost(hours, emp?.hourly_rate, emp?.monthly_salary, emp?.weekly_hours);
        employeeList.push({
          employee_id: eh.employee_id,
          name: eh.name,
          role: emp?.role || null,
          hours,
          hourly_rate: emp?.hourly_rate || null,
          cost,
        });
      });

      dayData.personnel.total_hours = Math.round(dayTotalHours * 100) / 100;
      dayData.personnel.employees = employeeList;
      totalHours += dayTotalHours;
      totalCost += dayData.personnel.total_cost || 0;

      // ── Events ──────────────────────────────────────────────────────────────
      const dayEvents = allEvents.filter(e => e.date === dateStr);
      dayEvents.forEach(ev => {
        dayData.events.push({
          event_id: ev.id,
          name: ev.title || null,
          type: ev.event_type || null,
          status: ev.status || null,
          expected_guests: ev.expected_guests || null,
          actual_guests: ev.actual_guests || null,
          entry_fee: ev.entry_fee || null,
          budget: ev.budget || null,
          revenue: null,
          personnel_hours: null,
        });
      });
      totalEvents += dayEvents.length;

      // ── ClosingSession ──────────────────────────────────────────────────────
      const dayClosing = allClosingSessions.filter(cs => cs.date === dateStr);
      if (dayClosing.length > 0) {
        const cs = dayClosing[0];
        dayData.operations.closing_session = {
          started_by: cs.started_by || null,
          completed_by: cs.completed_by || null,
          started_at: cs.started_at || null,
          completed_at: cs.completed_at || null,
          is_complete: cs.is_complete || false,
          completion_rate: cs.completion_rate || null,
          cash_amount: cs.cash_amount || null,
        };
        if (cs.notes) dayData.notes.push({ type: 'closing_session', text: cs.notes });
      }

      // ── Wastage (Schwund, ohne Nachtwächter — die sind bei keg_changes) ──────
      const dayWastage = allWastage.filter(w => w.date === dateStr && w.type !== 'Nachtwächter');
      dayWastage.forEach(w => {
        dayData.inventory.wastage.push({
          article_name: w.article_name || null,
          barcode: w.barcode || null,
          quantity: w.quantity || null,
          unit: w.unit || null,
          type: w.type || null,
          noted_by: w.noted_by || null,
          notes: w.notes || null,
        });
      });

      // ── Inventory Sessions ─────────────────────────────────────────────────
      const dayInventory = allInventory.filter(inv => inv.date && inv.date.startsWith(dateStr));
      dayInventory.forEach(inv => {
        dayData.inventory.sessions.push({
          session_id: inv.id,
          counted_by: inv.counted_by || null,
          total_items: inv.total_items || null,
          total_difference: inv.total_difference || null,
        });
      });

      // ── TipDistribution ────────────────────────────────────────────────────
      const dayTips = allTips.filter(t => t.date === dateStr);
      if (dayTips.length > 0) {
        const tip = dayTips[0];
        dayData.operations.tips = {
          total_tips: tip.total_tips || null,
          tip_percentage: tip.tip_percentage || null,
          employee_count: tip.employee_count || null,
          tip_per_person: tip.tip_per_person || null,
        };
      }

      // ── Notizen & PDF ───────────────────────────────────────────────────────
      if (rev.notes) dayData.notes.push({ type: 'daily_closing', text: rev.notes });
      if (rev.pdf_url) dayData.operations.pdf_url = rev.pdf_url;

      // ── Content Hash ─────────────────────────────────────────────────────────
      const hashContent = JSON.stringify({
        date: dayData.date,
        sales: dayData.sales,
        personnel: { total_hours: dayData.personnel.total_hours, total_cost: dayData.personnel.total_cost, employee_count: dayData.personnel.employees.length },
        beer_and_kegs: dayData.beer_and_kegs,
        events: dayData.events.length,
        notes: dayData.notes.length,
        updated_at: dayData.updated_at,
      });
      dayData.content_hash = await sha256(hashContent);

      totalRevenue += rev.revenue || 0;
      totalKegChanges += kegChanges.length;
      days.push(dayData);
    }

    // ── 5. Summary & Export ───────────────────────────────────────────────────
    const exportData = {
      schema_name: 'SAVO_ATLAS_EXPORT',
      schema_version: '1.0',
      export_id: generateExportId(),
      source_system: 'SAVO',
      organisation_id: 'savo',
      organisation_name: 'SAVO Lounge Club',
      created_at: new Date().toISOString(),
      period_from,
      period_to,
      summary: {
        operating_days: days.length,
        gross_revenue: Math.round(totalRevenue * 100) / 100,
        personnel_hours: Math.round(totalHours * 100) / 100,
        personnel_cost: Math.round(totalCost * 100) / 100,
        keg_changes: totalKegChanges,
        events: totalEvents,
      },
      days,
    };

    return Response.json({
      success: true,
      export_data: exportData,
      filename: `SAVO_ATLAS_${period_from}_${period_to}.json`,
    });

  } catch (error) {
    console.error('atlasExport error:', error);
    return Response.json({ error: 'Failed to generate export: ' + error.message }, { status: 500 });
  }
});