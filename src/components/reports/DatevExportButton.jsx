import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from 'lucide-react';
import { format, getDaysInMonth } from 'date-fns';

/**
 * DATEV Lohnbuchführung Export (ASCII/CSV Format)
 * Kompatibel mit DATEV Lohn und Gehalt sowie gängigen Steuerberater-Tools.
 *
 * Felder laut DATEV-Standard Lohnbuchführung:
 * Beraternummer, Mandantennummer, Abrechnungsmonat, Abrechnungsjahr,
 * Personalnummer, Name, Vorname, Lohnart, Betrag/Stunden, Kostenstelle
 */
export default function DatevExportButton({ hoursByEmployee, employees, selectedMonth, beraternummer = '12345', mandantennummer = '1' }) {
    // Ensure beraternummer and mandantennummer have default values
    const finalBeraternummer = beraternummer || '12345';
    const finalMandantennummer = mandantennummer || '1';

    const exportDatev = () => {
        if (!hoursByEmployee.length) {
            alert('Keine Daten für den DATEV-Export vorhanden.');
            return;
        }

        const monat = format(selectedMonth, 'MM');
        const jahr  = format(selectedMonth, 'yyyy');

        // DATEV Kopfzeile (vereinfacht, kompatibel mit meisten Steuerberater-Tools)
        const header = [
            '"EXTF";700;21;"DTVF";1;0;"Buchungsstapel";8;1;;;"RE";;;0;',
            `"Beraternummer";"Mandantennummer";"Datum von";"Datum bis";"Bezeichnung";"Festschreibung";"WKZ";;;`,
            `${finalBeraternummer};${finalMandantennummer};"01.${monat}.${jahr}";"${getDaysInMonth(selectedMonth)}.${monat}.${jahr}";"Lohn ${format(selectedMonth, 'MMMM yyyy')}";;EUR;;;`,
            '',
        ].join('\n');

        // Spaltenheader für Lohndaten
        const cols = [
            'Personalnummer',
            'Nachname',
            'Vorname',
            'Lohnart',
            'Betrag',
            'Stunden gesamt',
            'Stunden genehmigt',
            'Stundenlohn EUR',
            'Vertragsart',
            'Kostenstelle',
            'Abrechnungsmonat',
            'Abrechnungsjahr',
        ];

        // Mitarbeiter-Mapping für Personalnummer
        const empMap = {};
        employees.forEach(e => { empMap[e.name] = e; });

        const rows = hoursByEmployee.map(row => {
            const emp = empMap[row.employee] || {};
            const nameParts = row.employee.trim().split(' ');
            const vorname   = nameParts.slice(0, -1).join(' ') || row.employee;
            const nachname  = nameParts.slice(-1)[0] || '';

            // Lohnart: 100 = Stundenlohn, 200 = Minijob-Gehalt (DATEV Standard-Lohnarten)
            const lohnart = emp.contract_type === 'Minijob' ? '200' : '100';

            return [
                emp.employee_number || emp.id?.slice(0, 8) || '',
                `"${nachname}"`,
                `"${vorname}"`,
                lohnart,
                row.estimatedSalary.toFixed(2).replace('.', ','),
                row.totalHours.toFixed(2).replace('.', ','),
                row.approvedHours.toFixed(2).replace('.', ','),
                row.hourlyRate.toFixed(2).replace('.', ','),
                `"${row.contractType}"`,
                '"Bar"',
                monat,
                jahr,
            ].join(';');
        });

        const csv = [
            header,
            cols.join(';'),
            ...rows,
        ].join('\n');

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `DATEV_Lohn_${format(selectedMonth, 'yyyy-MM')}.csv`;
        a.click();
    };

    return (
        <Button
            onClick={exportDatev}
            variant="outline"
            size="sm"
            className="shrink-0 h-8 text-xs gap-1 border-status-warn/40 text-status-warn hover:bg-status-warn/10"
        >
            <Download className="w-3 h-3" />
            DATEV
        </Button>
    );
}