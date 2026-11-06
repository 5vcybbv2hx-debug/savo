import React, { useMemo } from 'react';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from 'lucide-react';

// Öffnungstage = Mo-Sa (kein Sonntag)
function getOpeningDays(start, end) {
    const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
    return days.filter(d => d.getDay() !== 0); // 0 = Sonntag
}

function exportCSV(rows, year) {
    const header = ['Mitarbeiter', 'Vertragsart', 'Von', 'Bis', 'Art', 'Urlaubstage (Öffnungstage)', 'Genehmigt von', 'Status'];
    const csvRows = [header.join(';')];
    rows.forEach(r => {
        csvRows.push([
            r.employee_name,
            r.contract_type || 'Vollzeit',
            format(parseISO(r.start_date), 'dd.MM.yyyy'),
            format(parseISO(r.end_date), 'dd.MM.yyyy'),
            r.type,
            r.opening_days,
            r.approved_by || '-',
            r.status === 'genehmigt' ? 'Genehmigt' : r.status
        ].join(';'));
    });

    // Summary rows
    csvRows.push('');
    csvRows.push(['ZUSAMMENFASSUNG', '', '', '', '', '', '', ''].join(';'));
    csvRows.push(['Mitarbeiter', 'Urlaubstage gesamt (Öffnungstage)', '', '', '', '', '', ''].join(';'));

    const summary = {};
    rows.forEach(r => {
        if (!summary[r.employee_name]) summary[r.employee_name] = 0;
        summary[r.employee_name] += r.opening_days;
    });
    Object.entries(summary).forEach(([name, days]) => {
        csvRows.push([name, days, '', '', '', '', '', ''].join(';'));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Urlaubsauswertung_Steuerberater_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function VacationTaxReport({ vacationRequests, employees, selectedYear }) {
    const reportRows = useMemo(() => {
        // Nur genehmigte Anträge von Vollzeit-Mitarbeitern
        const fullTimeIds = new Set(employees.filter(e => e.contract_type === 'Vollzeit').map(e => e.id));
        const employeeMap = {};
        employees.forEach(e => { employeeMap[e.id] = e; });

        return vacationRequests
            .filter(r => r.status === 'genehmigt' && fullTimeIds.has(r.employee_id))
            .map(r => {
                const openDays = getOpeningDays(r.start_date, r.end_date);
                return {
                    ...r,
                    opening_days: openDays.length,
                    contract_type: employeeMap[r.employee_id]?.contract_type || 'Vollzeit',
                    vacation_days_per_year: employeeMap[r.employee_id]?.vacation_days_per_year || 30,
                };
            })
            .sort((a, b) => a.employee_name.localeCompare(b.employee_name) || a.start_date.localeCompare(b.start_date));
    }, [vacationRequests, employees]);

    // Zusammenfassung pro Mitarbeiter
    const summary = useMemo(() => {
        const map = {};
        reportRows.forEach(r => {
            if (!map[r.employee_id]) {
                map[r.employee_id] = {
                    name: r.employee_name,
                    total: r.vacation_days_per_year,
                    usedOpenDays: 0,
                    entries: 0,
                };
            }
            map[r.employee_id].usedOpenDays += r.opening_days;
            map[r.employee_id].entries += 1;
        });
        return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
    }, [reportRows]);

    if (reportRows.length === 0) {
        return (
            <Card className="p-6 bg-surface border-border">
                <p className="text-muted-foreground text-sm text-center">
                    Keine genehmigten Urlaubsanträge von Vollzeitmitarbeitern in {selectedYear}.
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Zusammenfassung */}
            <Card className="p-5 bg-surface border-border">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-status-warn" />
                        <h3 className="font-semibold text-white">Zusammenfassung Vollzeitmitarbeiter {selectedYear}</h3>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => exportCSV(reportRows, selectedYear)}
                        className="border-border text-muted-foreground hover:bg-surface"
                    >
                        <Download className="w-4 h-4 mr-1" />
                        CSV Export
                    </Button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {summary.map(emp => (
                        <div key={emp.name} className="p-3 bg-surface rounded-lg border border-border">
                            <p className="font-semibold text-white text-sm mb-2">{emp.name}</p>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Genehm. Urlaubstage (Öffnungstage):</span>
                                <span className="font-bold text-status-warn">{emp.usedOpenDays}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>Anspruch gesamt:</span>
                                <span className="text-white">{emp.total} Tage</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>Verbleibend:</span>
                                <span className={emp.total - emp.usedOpenDays < 5 ? 'text-status-warn font-semibold' : 'text-status-ok font-semibold'}>
                                    {emp.total - emp.usedOpenDays} Tage
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Detailtabelle */}
            <Card className="p-5 bg-surface border-border">
                <h3 className="font-semibold text-white mb-4 text-sm">
                    Detailauflistung (für Steuerberater)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Mitarbeiter</th>
                                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Art</th>
                                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Von</th>
                                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Bis</th>
                                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Öffnungstage</th>
                                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Genehmigt von</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportRows.map((row, idx) => (
                                <tr key={idx} className="border-b border-border hover:bg-surface">
                                    <td className="py-2 px-3 text-white font-medium">{row.employee_name}</td>
                                    <td className="py-2 px-3">
                                        <Badge className={
                                            row.type === 'Urlaub' ? 'bg-status-warn/15 text-status-warn' :
                                            row.type === 'Krankheit' ? 'bg-status-danger/15 text-status-danger' :
                                            'bg-primary text-primary'
                                        }>
                                            {row.type}
                                        </Badge>
                                    </td>
                                    <td className="py-2 px-3 text-muted-foreground">
                                        {format(parseISO(row.start_date), 'dd.MM.yyyy')}
                                    </td>
                                    <td className="py-2 px-3 text-muted-foreground">
                                        {format(parseISO(row.end_date), 'dd.MM.yyyy')}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-status-warn">
                                        {row.opening_days}
                                    </td>
                                    <td className="py-2 px-3 text-muted-foreground text-xs">
                                        {row.approved_by || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-border">
                                <td colSpan={4} className="py-2 px-3 text-muted-foreground font-semibold text-right">Gesamt:</td>
                                <td className="py-2 px-3 text-right font-bold text-white">
                                    {reportRows.reduce((s, r) => s + r.opening_days, 0)} Tage
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                    * Öffnungstage = Montag bis Samstag (Sonntage ausgeschlossen)
                </p>
            </Card>
        </div>
    );
}