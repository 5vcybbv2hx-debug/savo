import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportUploader({ onUploadComplete }) {
    const [files, setFiles] = useState([]);
    const [reportType, setReportType] = useState('');
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        const pdfFiles = selectedFiles.filter(f => f.type === 'application/pdf');
        
        if (pdfFiles.length !== selectedFiles.length) {
            toast.error('Bitte nur PDF-Dateien hochladen');
        }
        
        if (pdfFiles.length > 0) {
            setFiles(pdfFiles);
        }
    };

    const handleUpload = async () => {
        if (files.length === 0 || !reportType) {
            toast.error('Bitte Dateien und Berichtstyp auswählen');
            return;
        }

        setUploading(true);
        let successCount = 0;
        let errorCount = 0;

        try {
            for (const file of files) {
                try {
                    // 1. Upload file
                    const { file_url } = await base44.integrations.Core.UploadFile({ file });

                    // 2. Extract data from PDF (including date)
                    const extractionSchema = getExtractionSchema(reportType);
                    const extractionResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
                        file_url: file_url,
                        json_schema: extractionSchema
                    });

                    if (extractionResult.status === 'success') {
                        // Extrahiere Datum aus dem Bericht und konvertiere zu ISO Format
                        // Für Artikelverkäufe auch aus den Daten oder Dateiname ableiten
                        const reportDate = formatDateToISO(extractionResult.output.date || extractionResult.output.report_date);

                        // 3. Create report record
                        const report = await base44.entities.SalesReport.create({
                            report_type: reportType,
                            report_date: reportDate,
                            file_url: file_url,
                            processing_status: 'processing'
                        });

                        // 4. Process extracted data
                        await processExtractedData(report.id, extractionResult.output, reportType, reportDate);

                        // 5. Update report with extracted summary
                        await base44.entities.SalesReport.update(report.id, {
                            extracted_data: extractionResult.output,
                            processing_status: 'completed',
                            ...calculateSummary(extractionResult.output, reportType)
                        });

                        // 6. Bei niedriger Confidence Score ein To-Do erstellen
                        const confidenceScore = extractionResult.output.confidence_score || 100;
                        if (confidenceScore < 80) {
                            await base44.entities.TodoItem.create({
                                title: `Z-Bericht vom ${reportDate} manuell überprüfen`,
                                description: `Automatische Datenextraktion hat niedrige Konfidenz (${confidenceScore}%). Bitte Zahlungsarten und Umsätze manuell überprüfen.`,
                                priority: 'hoch',
                                status: 'offen',
                                category: 'Sonstiges',
                                due_date: reportDate
                            });
                        }

                        successCount++;
                    } else {
                        errorCount++;
                        console.error(`Fehler bei ${file.name}:`, extractionResult.details);
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`Fehler beim Verarbeiten von ${file.name}:`, error);
                }
            }

            if (successCount > 0) {
                toast.success(`${successCount} Berichte erfolgreich hochgeladen!`);
            }
            if (errorCount > 0) {
                toast.error(`${errorCount} Berichte konnten nicht verarbeitet werden`);
            }

            setFiles([]);
            setReportType('');
            if (onUploadComplete) onUploadComplete();
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Fehler beim Hochladen: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const formatDateToISO = (dateString) => {
        if (!dateString) return new Date().toISOString().split('T')[0];
        
        // Versuche verschiedene Formate zu erkennen
        // Format 1: DD.MM.YYYY
        const germanMatch = dateString.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        if (germanMatch) {
            const day = String(germanMatch[1]).padStart(2, '0');
            const month = String(germanMatch[2]).padStart(2, '0');
            const year = germanMatch[3];
            return `${year}-${month}-${day}`;
        }
        
        // Format 2: YYYY-MM-DD (bereits korrekt)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return dateString;
        }
        
        // Format 3: ISO String
        if (dateString.includes('T')) {
            return dateString.split('T')[0];
        }
        
        return new Date().toISOString().split('T')[0];
    };

    const getExtractionSchema = (type) => {
        const schemas = {
            'Z-Abschlag': {
                type: 'object',
                properties: {
                    date: { type: 'string', description: 'Datum im Format DD.MM.YYYY oder YYYY-MM-DD' },
                    total_revenue: { type: 'number' },
                    total_transactions: { type: 'number' },
                    cash_revenue: { type: 'number' },
                    card_revenue: { type: 'number' },
                    payment_methods: {
                        type: 'object',
                        properties: {
                            cash: { type: 'number' },
                            card: { type: 'number' },
                            ec: { type: 'number' },
                            credit_card: { type: 'number' },
                            other: { type: 'number' }
                        }
                    },
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                quantity: { type: 'number' },
                                revenue: { type: 'number' }
                            }
                        }
                    },
                    confidence_score: { 
                        type: 'number',
                        description: 'Confidence score 0-100 for data extraction quality'
                    }
                }
            },
            'Artikelverkäufe': {
                type: 'object',
                properties: {
                    date: { type: 'string', description: 'Datum des Berichts im Format DD.MM.YYYY oder YYYY-MM-DD' },
                    items: {
                        type: 'array',
                        description: 'Liste aller Artikel. WICHTIG: Wenn ein Artikelname das Wort "Favoriten" enthält und danach etwas in Klammern steht (z.B. "Mojito Favoriten (Mojito Classic)"), dann verwende NUR den Text in den Klammern als name (also "Mojito Classic"). Wenn kein "Favoriten" im Namen steht, verwende den vollständigen Artikelnamen.',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string', description: 'Artikelname. Bei "X Favoriten (Y)" nur Y verwenden.' },
                                category: { type: 'string' },
                                quantity: { type: 'number' },
                                price: { type: 'number' },
                                revenue: { type: 'number' }
                            }
                        }
                    }
                }
            },
            'Warengruppen': {
                type: 'object',
                properties: {
                    categories: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                revenue: { type: 'number' },
                                quantity: { type: 'number' }
                            }
                        }
                    }
                }
            },
            'Stundenauswertung': {
                type: 'object',
                properties: {
                    hourly_data: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                hour: { type: 'number' },
                                revenue: { type: 'number' },
                                transactions: { type: 'number' }
                            }
                        }
                    }
                }
            }
        };
        return schemas[type] || schemas['Artikelverkäufe'];
    };

    const processExtractedData = async (reportId, data, reportType, reportDate) => {
        const items = [];

        if (reportType === 'Z-Abschlag' && data.items) {
            data.items.forEach(item => {
                items.push({
                    report_id: reportId,
                    date: reportDate,
                    item_name: item.name,
                    quantity_sold: item.quantity,
                    revenue: item.revenue,
                    price: item.quantity > 0 ? item.revenue / item.quantity : 0
                });
            });
        } else if (reportType === 'Artikelverkäufe' && data.items) {
            data.items.forEach(item => {
                // Fallback: Falls Name "Favoriten" enthält und Klammern vorhanden sind,
                // nur den Inhalt der Klammern verwenden
                let cleanName = item.name || '';
                if (/favoriten/i.test(cleanName)) {
                    const bracketMatch = cleanName.match(/\(([^)]+)\)/);
                    if (bracketMatch) {
                        cleanName = bracketMatch[1].trim();
                    }
                }
                items.push({
                    report_id: reportId,
                    date: reportDate,
                    item_name: cleanName,
                    category: item.category,
                    quantity_sold: item.quantity,
                    revenue: item.revenue,
                    price: item.price
                });
            });
        } else if (reportType === 'Stundenauswertung' && data.hourly_data) {
            data.hourly_data.forEach(hourData => {
                items.push({
                    report_id: reportId,
                    date: reportDate,
                    hour: hourData.hour,
                    revenue: hourData.revenue,
                    quantity_sold: hourData.transactions
                });
            });
        }

        if (items.length > 0) {
            await base44.entities.SalesDataItem.bulkCreate(items);
        }
    };

    const calculateSummary = (data, reportType) => {
        const summary = {};

        if (reportType === 'Z-Abschlag') {
            summary.total_revenue = data.total_revenue || 0;
            summary.total_transactions = data.total_transactions || 0;
            summary.average_transaction = data.total_transactions > 0 
                ? data.total_revenue / data.total_transactions 
                : 0;
        } else if (reportType === 'Artikelverkäufe' && data.items) {
            summary.total_revenue = data.items.reduce((sum, item) => sum + (item.revenue || 0), 0);
            summary.total_transactions = data.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        }

        return summary;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-status-warn" />
                    PDF-Bericht hochladen
                </CardTitle>
                <CardDescription>
                    Laden Sie Berichte von Ihrem Kassensystem hoch für automatische Analyse
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label>Berichtstyp</Label>
                    <Select value={reportType} onValueChange={setReportType}>
                        <SelectTrigger>
                            <SelectValue placeholder="Typ auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Z-Abschlag">Z-Abschlag / Tagesabschluss</SelectItem>
                            <SelectItem value="Artikelverkäufe">Artikelverkäufe</SelectItem>
                            <SelectItem value="Warengruppen">Warengruppen</SelectItem>
                            <SelectItem value="Stundenauswertung">Stundenauswertung</SelectItem>
                            <SelectItem value="Wochenauswertung">Wochenauswertung</SelectItem>
                            <SelectItem value="Zahlungsarten">Zahlungsarten</SelectItem>
                            <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>PDF-Dateien (mehrere möglich)</Label>
                    <Input
                        type="file"
                        accept=".pdf"
                        multiple
                        onChange={handleFileChange}
                        className="cursor-pointer"
                    />
                    {files.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {files.map((file, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <FileText className="w-4 h-4" />
                                    {file.name}
                                </div>
                            ))}
                            <p className="text-xs text-muted-foreground mt-2">
                                {files.length} Datei(en) ausgewählt
                            </p>
                        </div>
                    )}
                </div>

                <Button
                    onClick={handleUpload}
                    disabled={files.length === 0 || !reportType || uploading}
                    className="w-full bg-status-warn/70 hover:bg-status-warn/70"
                >
                    {uploading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {files.length > 1 ? `${files.length} Berichte werden verarbeitet...` : 'Wird verarbeitet...'}
                        </>
                    ) : (
                        <>
                            <Upload className="w-4 h-4 mr-2" />
                            {files.length > 1 ? `${files.length} Berichte hochladen` : 'Hochladen & Analysieren'}
                        </>
                    )}
                </Button>

                <div className="p-3 bg-primary/15 rounded-lg border border-primary/25">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-primary">
                            <strong>Bulk-Upload:</strong> Wähle mehrere PDFs gleichzeitig aus. Das Datum wird automatisch aus dem Bericht selbst extrahiert (perfekt für nach-Mitternacht-Berichte).
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}