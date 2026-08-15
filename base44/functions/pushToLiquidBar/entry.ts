import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const barshift = createClientFromRequest(req);
    const user = await barshift.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Lade alle benötigten Daten parallel
    const [reports, timeEntries, employees] = await Promise.all([
      barshift.asServiceRole.entities.DailyRevenue.list('-date', 90),
      barshift.asServiceRole.entities.TimeEntry.list('-date', 500),
      barshift.asServiceRole.entities.Employee.list(),
    ]);

    // Erstelle eine Map: employee_id → { hourly_rate, contract_type, role }
    const employeeMap = {};
    for (const emp of employees) {
      employeeMap[emp.id] = {
        hourly_rate: emp.hourly_rate || 0,
        contract_type: emp.contract_type || '',
        role: emp.role || '',
      };
    }

    // Hilfsfunktion: Ist Mitarbeiter eine Aushilfe/Minijob?
    const isDaily = (emp) => {
      const ct = (emp.contract_type || '').toLowerCase();
      const r = (emp.role || '').toLowerCase();
      return ct === 'minijob' || r === 'aushilfe';
    };

    // Hilfsfunktion: Ist Mitarbeiter Vollzeit/Teilzeit?
    const isFulltime = (emp) => {
      const ct = (emp.contract_type || '').toLowerCase();
      return ct === 'vollzeit' || ct === 'teilzeit';
    };

    // Gruppiere TimeEntries nach Datum
    const timeByDate = {};
    for (const entry of timeEntries) {
      const date = entry.date;
      if (!date) continue;
      if (!timeByDate[date]) timeByDate[date] = [];
      timeByDate[date].push(entry);
    }

    // Berechne Personalkosten pro Datum und baue die Datensätze
    const enrichedRecords = reports.map((report) => {
      const date = report.date;
      const entries = timeByDate[date] || [];

      let laborCostDaily = 0;
      let laborCostFulltime = 0;

      for (const entry of entries) {
        const paidHours = (entry.total_hours || 0) + (entry.break_minutes || 0) / 60;
        const emp = employeeMap[entry.employee_id];
        if (!emp) continue;
        const rate = emp.hourly_rate || 0;
        const cost = paidHours * rate;

        if (isDaily(emp)) {
          laborCostDaily += cost;
        } else if (isFulltime(emp)) {
          laborCostFulltime += cost;
        }
      }

      return {
        date: report.date,
        revenue: report.revenue,
        revenue_cash: report.revenue_cash,
        revenue_ec: report.revenue_ec,
        vat: report.vat,
        own_consumption: report.own_consumption,
        manual_labor_cost_daily: report.manual_labor_cost_daily != null
          ? report.manual_labor_cost_daily
          : Math.round(laborCostDaily * 100) / 100,
        manual_labor_cost_fulltime: report.manual_labor_cost_fulltime != null
          ? report.manual_labor_cost_fulltime
          : Math.round(laborCostFulltime * 100) / 100,
        pdf_url: report.pdf_url,
        notes: report.notes,
      };
    });

    const response = await fetch("https://bar-flow-plan.base44.app/api/functions/receiveDailyRevenue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: secrets.get("LIQUIDBAR_API_SECRET"),
        records: enrichedRecords
      })
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) {
      const text = await response.text();
      return Response.json({ error: `LiquidBar API Fehler (${response.status}): ${text.slice(0, 200)}` }, { status: 502 });
    }
    const result = await response.json();
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});