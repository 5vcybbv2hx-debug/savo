import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Only managers can send reports' }, { status: 403 });
        }
        // Pause-Deckel: max. 45 Min pro Schicht mitbezahlt (Redeploy 0f90d145)

        const body = await req.json();
        const { year, month, pdf_url } = body;

        if (!year || !month || !pdf_url) {
            return Response.json(
                { error: 'Missing required parameters: year, month, pdf_url' },
                { status: 400 }
            );
        }

        // Fetch company info
        const companyList = await base44.asServiceRole.entities.CompanyInfo.list('last_updated', 1);
        if (!companyList || companyList.length === 0) {
            return Response.json({ error: 'Company info not configured' }, { status: 400 });
        }

        const company = companyList[0];
        if (!company.payroll_email) {
            return Response.json({ error: 'Payroll email not configured in company settings' }, { status: 400 });
        }

        // Fetch all time entries for the month
        const allTimeEntries = await base44.asServiceRole.entities.TimeEntry.list('-date', 500);
        const monthEntries = allTimeEntries.filter(e => {
            const [y, m] = e.date.split('-');
            return parseInt(y) === year && parseInt(m) === month;
        });

        // Calculate summary
        const monthDate = new Date(year, month - 1);
        const monthName = monthDate.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
        // Pause wird bei SAVO bis 45 Min pro Schicht mitbezahlt (total_hours bleibt netto in DB)
        const totalHours = monthEntries.reduce((sum, e) => sum + (e.total_hours || 0) + Math.min(e.break_minutes || 0, 45) / 60, 0);
        const employeeCount = new Set(monthEntries.map(e => e.employee_id)).size;
        const entryCount = monthEntries.length;

        // Generate CSV
        const csvLines = [
            ['Mitarbeiter', 'Datum', 'Startzeit', 'Endzeit', 'Stunden (inkl. Pause, max. 45min mitbezahlt)', 'Status'],
            ...monthEntries.map(e => [
                e.employee_name,
                e.date,
                e.start_time || '',
                e.end_time || '',
                ((e.total_hours || 0) + Math.min(e.break_minutes || 0, 45) / 60).toFixed(2),
                e.status || ''
            ])
        ];
        const csv = csvLines.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const csvBlob = new TextEncoder().encode(csv);
        
        // Upload CSV as private file to get signed download URL
        const csvFile = new File([csvBlob], `payroll-${year}-${String(month).padStart(2, '0')}.csv`, { type: 'text/csv' });
        const csvPrivateRes = await base44.integrations.Core.UploadPrivateFile({ file: csvFile });
        const csvSignedUrl = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: csvPrivateRes.file_uri, expires_in: 2592000 });
        const csvUrl = csvSignedUrl.signed_url;

        // Build HTML email with professional design
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #f9f9f9; }
        .header { background: linear-gradient(135deg, #f59e0b, #f97316); padding: 30px 20px; text-align: center; color: white; }
        .header img { max-height: 60px; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
        .content { padding: 30px 20px; background-color: white; }
        .summary { background-color: #f5f5f5; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .summary-item { display: inline-block; width: 45%; margin-right: 5%; vertical-align: top; }
        .summary-label { color: #888; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
        .summary-value { font-size: 20px; font-weight: bold; color: #333; }
        .attachment-info { background-color: #e8f4f8; border: 1px solid #b3dfe8; padding: 12px; border-radius: 4px; margin: 15px 0; }
        .attachment-info p { margin: 5px 0; font-size: 13px; }
        .footer { background-color: #1a1a1a; color: #ccc; padding: 20px; text-align: center; font-size: 12px; }
        .footer-divider { border-top: 1px solid #444; margin: 15px 0; padding-top: 15px; }
        .footer p { margin: 5px 0; }
        .footer-contact { color: #f59e0b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${company.logo_url ? `<img src="${company.logo_url}" alt="${company.company_name}">` : ''}
            <h1>Monatsbericht Zeiterfassung</h1>
        </div>

        <div class="content">
            <p>Guten Tag,</p>
            
            <p>anbei erhalten Sie den Monatsbericht zur Zeiterfassung für <strong>${monthName}</strong>.</p>

            <div class="summary">
                <div class="summary-item">
                    <div class="summary-label">Gesamtstunden</div>
                    <div class="summary-value">${totalHours.toFixed(1)}h</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Mitarbeiter</div>
                    <div class="summary-value">${employeeCount}</div>
                </div>
                <div style="clear: both;"></div>
                <div class="summary-item">
                    <div class="summary-label">Einträge</div>
                    <div class="summary-value">${entryCount}</div>
                </div>
            </div>

            <p>Die detaillierte Übersicht finden Sie in den folgenden Dateien:</p>
            
            <div class="attachment-info">
                <p><a href="${pdf_url}" style="color: #f59e0b; text-decoration: none; font-weight: bold;">📄 PDF-Bericht herunterladen</a></p>
                <p><a href="${csvUrl}" style="color: #f59e0b; text-decoration: none; font-weight: bold;">📊 CSV-Datei herunterladen</a></p>
            </div>

            <p>Bei Fragen oder Unstimmigkeiten kontaktieren Sie uns gerne.</p>

            <p>Mit freundlichen Grüßen,<br><strong>${company.company_name}</strong></p>
        </div>

        <div class="footer">
            <p><strong>${company.company_name}</strong></p>
            ${company.street ? `<p>${company.street}</p>` : ''}
            ${company.postal_code ? `<p>${company.postal_code} ${company.city || ''}</p>` : ''}
            
            <div class="footer-divider"></div>
            
            ${company.phone ? `<p><span class="footer-contact">☎</span> ${company.phone}</p>` : ''}
            ${company.email ? `<p><span class="footer-contact">✉</span> ${company.email}</p>` : ''}
            ${company.website ? `<p><span class="footer-contact">🌐</span> ${company.website}</p>` : ''}
            
            ${company.vat_id || company.tax_id ? `
            <div class="footer-divider"></div>
            ${company.vat_id ? `<p>USt-IdNr.: ${company.vat_id}</p>` : ''}
            ${company.tax_id ? `<p>Steuernummer: ${company.tax_id}</p>` : ''}
            ` : ''}
        </div>
    </div>
</body>
</html>
        `;

        // Send email
        try {
            await base44.integrations.Core.SendEmail({
                to: company.payroll_email,
                subject: `Monatsbericht Zeiterfassung – ${monthName}`,
                body: htmlBody,
                from_name: company.company_name,
            });

            // Log successful send
            await base44.asServiceRole.entities.PayrollReportLog.create({
                year,
                month,
                day: body.day || null,
                report_type: body.day ? 'daily' : 'monthly',
                recipient_email: company.payroll_email,
                company_name: company.company_name,
                status: 'success',
                sent_by: user.email,
                sent_at: new Date().toISOString(),
            });

            return Response.json({
                success: true,
                message: `Report erfolgreich an ${company.payroll_email} versendet`,
                month: monthName,
                recipient: company.payroll_email,
            });
        } catch (emailError) {
            // Log failed send
            await base44.asServiceRole.entities.PayrollReportLog.create({
                year,
                month,
                day: body.day || null,
                report_type: body.day ? 'daily' : 'monthly',
                recipient_email: company.payroll_email,
                company_name: company.company_name,
                status: 'failed',
                error_message: emailError.message,
                sent_by: user.email,
                sent_at: new Date().toISOString(),
            });
            throw emailError;
        }

    } catch (error) {
        console.error('Payroll report error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});