import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from 'lucide-react';

export default function EmployeesCSVExport({ employees }) {
    const handleExport = () => {
        if (!employees || employees.length === 0) {
            alert('Keine Mitarbeiter zum Exportieren vorhanden.');
            return;
        }

        const headers = [
            'Name',
            'E-Mail',
            'Telefon',
            'Geburtsdatum',
            'Geburtsname',
            'Geburtsort',
            'Nationalität',
            'Eintrittsdatum',
            'Tätigkeit',
            'Ausbildung',
            'Vertragtyp',
            'Wöchentliche Arbeitszeit',
            'Stundensatz',
            'T-Shirt Größe',
            'Pullover Größe',
            'Straße',
            'PLZ',
            'Wohnort',
            'Steuer-ID',
            'Rentenversicherungsnr.',
            'Krankenkasse',
            'Befreiungsantrag Rentenversicherung',
            'Versicherungspflichtige Hauptbeschäftigung',
            'Weitere geringfügige Beschäftigung',
            'Weitere Beschäftigung Details',
            'Kreditinstitut',
            'IBAN',
            'BIC'
        ];

        const rows = employees.map(emp => [
            emp.name || '',
            emp.email || '',
            emp.phone || '',
            emp.birthday || '',
            emp.birth_name || '',
            emp.birth_place || '',
            emp.nationality || '',
            emp.entry_date || '',
            emp.activity || '',
            emp.education || '',
            emp.contract_type || '',
            emp.weekly_hours || '',
            emp.hourly_rate || '',
            emp.tshirt_size || '',
            emp.pullover_size || '',
            emp.street || '',
            emp.postal_code || '',
            emp.city || '',
            emp.tax_id || '',
            emp.pension_number || '',
            emp.health_insurance || '',
            emp.pension_exemption ? 'Ja' : 'Nein',
            emp.has_main_job ? 'Ja' : 'Nein',
            emp.has_other_minijob ? 'Ja' : 'Nein',
            emp.other_minijob_details || '',
            emp.bank_name || '',
            emp.iban || '',
            emp.bic || ''
        ]);

        // CSV erstellen
        const csvContent = [
            headers.map(h => `"${h}"`).join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `mitarbeiter_steuerberater_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Button
            onClick={handleExport}
            variant="outline"
            className="border-border text-muted-foreground hover:bg-surface"
        >
            <Download className="w-4 h-4 mr-2" />
            CSV für Steuerberater
        </Button>
    );
}