import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@2.5.1';
import * as XLSX from 'npm:xlsx@0.18.5';

// HIGH FIX: Added admin role check — previously any authenticated user could export
// all employee hourly rates, salary costs, and time data.
// Pause-Deckel: max. 45 Min pro Schicht mitbezahlt (Redeploy 0f90d145)

function getOpeningDays(startStr, endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
        if (cur.getDay() !== 0) count++;
        cur.setDate(cur.getDate() + 1);
    }
    return count;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins may export salary/time data of ALL employees
        if (user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { month, year, format = 'pdf' } = await req.json();

        if (!month || !year) {
            return Response.json({ error: 'Month and year are required' }, { status: 400 });
        }

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

        const allEntries = await base44.asServiceRole.entities.TimeEntry.list('-date');
        const entries = allEntries.filter(e => e.date >= startDate && e.date <= endDate);

        const employees = await base44.asServiceRole.entities.Employee.filter({ is_active: true });

        const allVacations = await base44.asServiceRole.entities.VacationRequest.list('-start_date');
        const vacations = allVacations.filter(v =>
            v.status === 'genehmigt' &&
            v.start_date <= endDate &&
            v.end_date >= startDate
        );

        const employeeData = {};
        employees.forEach(emp => {
            const empEntries = entries.filter(e => e.employee_id === emp.id);
            const empVacations = vacations.filter(v => v.employee_id === emp.id);

            const vacationOpenDays = empVacations.reduce((sum, v) => {
                const vs = v.start_date < startDate ? startDate : v.start_date;
                const ve = v.end_date > endDate ? endDate : v.end_date;
                return sum + getOpeningDays(vs, ve);
            }, 0);

            if (empEntries.length > 0 || empVacations.length > 0) {
                // Pause wird bei SAVO bis 45 Min pro Schicht mitbezahlt (total_hours bleibt netto in DB)
                const totalHours = empEntries.reduce((sum, e) => sum + (e.total_hours || 0) + Math.min(e.break_minutes || 0, 45) / 60, 0);
                const approvedHours = empEntries.filter(e => e.status === 'genehmigt').reduce((sum, e) => sum + (e.total_hours || 0) + Math.min(e.break_minutes || 0, 45) / 60, 0);

                const vacationDaysPerYear = emp.vacation_days_per_year || 0;
                const allYearVacations = [];
                const usedVacationDays = allYearVacations
                    .filter(v => v.status === 'genehmigt' && v.type === 'Urlaub' && v.start_date && v.start_date.startsWith(String(year)))
                    .reduce((sum, v) => sum + (v.days_count || 0), 0);
                const remainingVacationDays = vacationDaysPerYear - usedVacationDays;

                employeeData[emp.id] = {
                    name: emp.name,
                    employee_number: emp.employee_number || '-',
                    hourly_rate: emp.hourly_rate || 0,
                    contract_type: emp.contract_type || '-',
                    vacation_days_per_year: vacationDaysPerYear,
                    used_vacation_days: usedVacationDays,
                    remaining_vacation_days: remainingVacationDays,
                    entries: empEntries.sort((a, b) => a.date.localeCompare(b.date)),
                    vacations: empVacations,
                    vacationOpenDays,
                    totalHours,
                    approvedHours,
                    totalCost: approvedHours * (emp.hourly_rate || 0)
                };
            }
        });

        const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        const monthName = monthNames[month - 1];

        if (format === 'pdf') {
            return generatePDF(employeeData, monthName, year);
        } else if (format === 'csv') {
            return generateCSV(employeeData, monthName, year);
        } else {
            return Response.json({ error: 'Invalid format' }, { status: 400 });
        }

    } catch (error) {
        console.error('Error generating report:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function generatePDF(employeeData, monthName, year) {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(18);
    doc.text(`Zeiterfassungsbericht ${monthName} ${year}`, 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 20, y);
    y += 15;

    const totalHours = Object.values(employeeData).reduce((sum, emp) => sum + emp.approvedHours, 0);
    const totalCost = Object.values(employeeData).reduce((sum, emp) => sum + emp.totalCost, 0);
    const totalVacationDays = Object.values(employeeData).reduce((sum, emp) => sum + emp.vacationOpenDays, 0);

    doc.setFontSize(12);
    doc.text('Zusammenfassung:', 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(`Gesamtstunden (genehmigt): ${totalHours.toFixed(2)}h`, 25, y);
    y += 6;
    doc.text(`Gesamtkosten: ${totalCost.toFixed(2)} EUR`, 25, y);
    y += 6;
    doc.text(`Urlaubstage gesamt (Öffnungstage Mo-Sa): ${totalVacationDays}`, 25, y);
    y += 6;
    doc.text(`Anzahl Mitarbeiter: ${Object.keys(employeeData).length}`, 25, y);
    y += 15;

    Object.values(employeeData).forEach(emp => {
        let headerHeight = 7 + 5 + 5 + 5;
        if (emp.vacation_days_per_year > 0) headerHeight += 5;
        if (emp.vacationOpenDays > 0) headerHeight += 5;
        headerHeight += 3;
        if (emp.entries.length > 0) headerHeight += 5;
        headerHeight += Math.min(emp.entries.length, 3) * 5;

        if (y + headerHeight > 270) { doc.addPage(); y = 20; }

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`${emp.name} (${emp.employee_number})`, 20, y);
        doc.setFont(undefined, 'normal');
        y += 7;

        doc.setFontSize(9);
        doc.text(`Stundensatz: ${emp.hourly_rate.toFixed(2)} EUR | Vertragsart: ${emp.contract_type}`, 25, y);
        y += 5;
        doc.text(`Stunden (gesamt, inkl. Pause): ${emp.totalHours.toFixed(2)}h | Stunden (genehmigt, inkl. Pause): ${emp.approvedHours.toFixed(2)}h`, 25, y);
        y += 5;
        doc.text(`Lohnkosten: ${emp.totalCost.toFixed(2)} EUR`, 25, y);
        y += 5;
        if (emp.vacation_days_per_year > 0) {
            doc.text(`Urlaub: ${emp.vacation_days_per_year} Tage/Jahr | Genommen: ${emp.used_vacation_days} | Verbleibend: ${emp.remaining_vacation_days}`, 25, y);
            y += 5;
        }
        if (emp.vacationOpenDays > 0) {
            doc.text(`Urlaubstage im Monat (Öffnungstage Mo-Sa): ${emp.vacationOpenDays}`, 25, y);
            y += 5;
        }
        y += 3;

        if (emp.entries.length > 0) {
            doc.setFontSize(8);
            doc.text('Datum', 25, y); doc.text('Start', 55, y); doc.text('Ende', 75, y);
            doc.text('Pause', 95, y); doc.text('Stunden', 115, y); doc.text('Status', 140, y);
            y += 5;

            emp.entries.forEach(entry => {
                if (y > 280) { doc.addPage(); y = 20; }
                const date = new Date(entry.date).toLocaleDateString('de-DE');
                const status = entry.status === 'genehmigt' ? 'Gen.' : entry.status === 'eingereicht' ? 'Eing.' : 'Entw.';
                doc.text(date, 25, y); doc.text(entry.start_time, 55, y); doc.text(entry.end_time, 75, y);
                doc.text(`${entry.break_minutes}m`, 95, y); doc.text(`${((entry.total_hours || 0) + Math.min(entry.break_minutes || 0, 45) / 60).toFixed(2)}h`, 115, y);
                doc.text(status, 140, y);
                y += 5;
            });
        }

        if (emp.vacations.length > 0) {
            y += 3;
            doc.setFontSize(8);
            doc.setFont(undefined, 'italic');
            doc.text('Urlaub / Abwesenheit:', 25, y);
            doc.setFont(undefined, 'normal');
            y += 5;
            emp.vacations.forEach(v => {
                if (y > 280) { doc.addPage(); y = 20; }
                doc.text(`${new Date(v.start_date).toLocaleDateString('de-DE')} - ${new Date(v.end_date).toLocaleDateString('de-DE')} | ${v.type} | ${v.days_count} Tage`, 25, y);
                y += 5;
            });
        }

        y += 10;
    });

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=Zeiterfassung_${monthName}_${year}.pdf`
        }
    });
}

function generateCSV(employeeData, monthName, year) {
    const rows = [];
    rows.push(['Zeiterfassungsbericht', `${monthName} ${year}`]);
    rows.push(['Erstellt am', new Date().toLocaleDateString('de-DE')]);
    rows.push([]);
    rows.push(['=== Zusammenfassung ===']);
    rows.push(['Gesamtstunden (genehmigt)', Object.values(employeeData).reduce((sum, emp) => sum + emp.approvedHours, 0).toFixed(2)]);
    rows.push(['Gesamtkosten (EUR)', Object.values(employeeData).reduce((sum, emp) => sum + emp.totalCost, 0).toFixed(2)]);
    rows.push(['Urlaubstage gesamt (Oeffnungstage Mo-Sa)', Object.values(employeeData).reduce((sum, emp) => sum + emp.vacationOpenDays, 0)]);
    rows.push(['Anzahl Mitarbeiter', Object.keys(employeeData).length]);
    rows.push([]);
    rows.push(['=== Mitarbeiteruebersicht ===']);
    rows.push(['Mitarbeiter', 'MA-Nr.', 'Vertragsart', 'Stundensatz (EUR)', 'Stunden (gesamt)', 'Stunden (genehmigt)', 'Lohnkosten (EUR)', 'Urlaubstage/Jahr', 'Urlaubstage genommen', 'Urlaubstage verbleibend', 'Urlaubstage Monat (Oeffnungstage)']);
    Object.values(employeeData).forEach(emp => {
        rows.push([emp.name, emp.employee_number, emp.contract_type, emp.hourly_rate.toFixed(2), emp.totalHours.toFixed(2), emp.approvedHours.toFixed(2), emp.totalCost.toFixed(2), emp.vacation_days_per_year, emp.used_vacation_days, emp.remaining_vacation_days, emp.vacationOpenDays]);
    });
    rows.push([]);
    rows.push(['=== Zeiteintraege ===']);
    rows.push(['Mitarbeiter', 'MA-Nr.', 'Datum', 'Start', 'Ende', 'Pause (Min)', 'Stunden', 'Status', 'Notizen']);
    Object.values(employeeData).forEach(emp => {
        emp.entries.forEach(entry => {
            rows.push([emp.name, emp.employee_number, entry.date, entry.start_time, entry.end_time, entry.break_minutes, ((entry.total_hours || 0) + Math.min(entry.break_minutes || 0, 45) / 60).toFixed(2), entry.status, entry.notes || '']);
        });
    });
    rows.push([]);
    rows.push(['=== Urlaub / Abwesenheit ===']);
    rows.push(['Mitarbeiter', 'MA-Nr.', 'Vertragsart', 'Von', 'Bis', 'Art', 'Tage (gesamt)', 'Oeffnungstage (Mo-Sa)', 'Genehmigt von']);
    Object.values(employeeData).forEach(emp => {
        emp.vacations.forEach(v => {
            rows.push([emp.name, emp.employee_number, emp.contract_type, v.start_date, v.end_date, v.type, v.days_count, emp.vacationOpenDays, v.approved_by || '-']);
        });
    });

    const csvContent = rows.map(row =>
        row.map(cell => {
            const val = String(cell ?? '');
            return val.includes(';') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(';')
    ).join('\r\n');

    const bom = '\uFEFF';
    const csvBytes = new TextEncoder().encode(bom + csvContent);

    return new Response(csvBytes, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename=Zeiterfassung_${monthName}_${year}.csv`
        }
    });
}