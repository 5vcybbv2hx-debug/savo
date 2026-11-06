import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Loader2 } from 'lucide-react';

export default function MonthlyReportExport({ isVisible }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    if (!isVisible) return null;

    const handleExport = async (format) => {
        setLoading(true);
        try {
            const isPdf = format === 'pdf';
            const mimeType = isPdf ? 'application/pdf' : 'text/csv';
            const ext = isPdf ? 'pdf' : 'csv';

            const response = await base44.functions.invoke('exportTimeReport', {
                month: selectedMonth,
                year: selectedYear,
                format: format
            }, { responseType: 'arraybuffer' });

            const blob = new Blob([response.data], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Zeiterfassung_${selectedMonth}_${selectedYear}.${ext}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            setOpen(false);
        } catch (error) {
            alert('Fehler beim Exportieren: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const months = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                className="bg-primary hover:bg-primary"
            >
                <FileText className="w-4 h-4 mr-2" />
                Monatsbericht erstellen
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Zeiterfassungsbericht</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        <Card className="p-4 bg-primary/15 border-primary/25">
                            <p className="text-sm text-primary">
                                📊 Der Bericht enthält alle Zeiteinträge des Monats mit Stundensätzen, 
                                Gesamtstunden und Lohnkosten pro Mitarbeiter - perfekt für das Lohnbüro.
                            </p>
                        </Card>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Monat</label>
                            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {months.map((month, idx) => (
                                        <SelectItem key={idx} value={String(idx + 1)}>
                                            {month}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Jahr</label>
                            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map(year => (
                                        <SelectItem key={year} value={String(year)}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button
                                onClick={() => handleExport('pdf')}
                                disabled={loading}
                                className="flex-1 bg-status-danger/70 hover:bg-status-danger/70"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4 mr-2" />
                                )}
                                PDF
                            </Button>
                            <Button
                                onClick={() => handleExport('csv')}
                                disabled={loading}
                                className="flex-1 bg-status-ok/70 hover:bg-status-ok/70"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4 mr-2" />
                                )}
                                CSV
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}