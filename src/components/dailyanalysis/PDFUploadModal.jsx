import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Upload, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PDFUploadModal({ open, onOpenChange, selectedDate, onSuccess }) {
    const [date, setDate] = useState(selectedDate || '');
    const [file, setFile] = useState(null);
    const [revenue, setRevenue] = useState('');
    const [revenueCash, setRevenueCash] = useState('');
    const [revenueEC, setRevenueEC] = useState('');
    const [vat, setVat] = useState('');
    const [ownConsumption, setOwnConsumption] = useState('');
    const [notes, setNotes] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState(null);
    const [activeTab, setActiveTab] = useState('manual');
    const [error, setError] = useState(null);

    // Sync date when selectedDate changes or modal opens
    useEffect(() => {
        if (open) {
            setDate(selectedDate || '');
            setFile(null);
            setRevenue('');
            setRevenueCash('');
            setRevenueEC('');
            setVat('');
            setOwnConsumption('');
            setNotes('');
            setError(null);
            setAnalysisError(null);
            setActiveTab('manual');
        }
    }, [open, selectedDate]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!date) throw new Error('Bitte ein Datum auswählen.');
            if (!revenue || parseFloat(revenue) <= 0) throw new Error('Bitte einen gültigen Umsatz eingeben.');

            let pdfUrl = null;
            if (file) {
                const uploadResponse = await base44.integrations.Core.UploadFile({ file });
                pdfUrl = uploadResponse.file_url;
            }

            await base44.entities.DailyRevenue.create({
                date: date,
                revenue: parseFloat(revenue),
                revenue_cash: revenueCash ? parseFloat(revenueCash) : undefined,
                revenue_ec: revenueEC ? parseFloat(revenueEC) : undefined,
                vat: vat ? parseFloat(vat) : undefined,
                own_consumption: ownConsumption ? parseFloat(ownConsumption) : undefined,
                pdf_url: pdfUrl,
                notes: notes || undefined
            });
        },
        onSuccess: () => {
            onOpenChange(false);
            onSuccess?.();
        },
        onError: (e) => setError(e.message),
    });

    const handleAnalyzePDF = async () => {
        if (!file) {
            setAnalysisError('Bitte wählen Sie eine PDF-Datei aus.');
            return;
        }

        setAnalyzing(true);
        setAnalysisError(null);

        try {
            const uploadResponse = await base44.integrations.Core.UploadFile({ file });
            const analysisResponse = await base44.integrations.Core.InvokeLLM({
                prompt: `Analysiere diese Z-Abschlag PDF von einer Bar/Lokal. Extrahiere die folgenden Informationen:
                - Gesamtumsatz / Tagesumsatz (in Euro, Brutto)
                - Umsatz Bar (Bargeld-Umsatz)
                - Umsatz EC / Kartenzahlung
                - Umsatzsteuer (MwSt.)
                - Eigenbedarf / Eigenverbrauch
                - Besondere Notizen

                Gib die Antwort als JSON zurück.`,
                file_urls: [uploadResponse.file_url],
                response_json_schema: {
                    type: 'object',
                    properties: {
                        revenue: { type: 'number', description: 'Gesamtumsatz in Euro' },
                        revenue_cash: { type: 'number', description: 'Umsatz Bar (Bargeld) in Euro' },
                        revenue_ec: { type: 'number', description: 'Umsatz EC/Karte in Euro' },
                        vat: { type: 'number', description: 'Umsatzsteuer in Euro' },
                        own_consumption: { type: 'number', description: 'Eigenbedarf/Eigenverbrauch in Euro' },
                        notes: { type: 'string', description: 'Zusätzliche Notizen' }
                    },
                    required: ['revenue']
                }
            });

            if (analysisResponse.revenue) {
                setRevenue(analysisResponse.revenue.toString());
                if (analysisResponse.revenue_cash) setRevenueCash(analysisResponse.revenue_cash.toString());
                if (analysisResponse.revenue_ec) setRevenueEC(analysisResponse.revenue_ec.toString());
                if (analysisResponse.vat) setVat(analysisResponse.vat.toString());
                if (analysisResponse.own_consumption) setOwnConsumption(analysisResponse.own_consumption.toString());
                if (analysisResponse.notes) setNotes(analysisResponse.notes);
                setActiveTab('review');
            } else {
                setAnalysisError('Konnte keinen Umsatz in der PDF finden. Bitte manuell eingeben.');
            }
        } catch (error) {
            setAnalysisError(`Analyse fehlgeschlagen: ${error.message}`);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSave = () => {
        setError(null);
        mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-foreground">Z-Abschlag hochladen</DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-secondary">
                        <TabsTrigger value="manual" className="text-foreground/75">Manuell</TabsTrigger>
                        <TabsTrigger value="ai" className="text-foreground/75">KI-Analyse</TabsTrigger>
                    </TabsList>

                    <TabsContent value="manual" className="mt-4 space-y-4">
                        {/* Datum */}
                        <div>
                            <Label htmlFor="date" className="text-foreground/75">Datum</Label>
                            <Input
                                id="date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="bg-secondary border-border/70 text-foreground mt-1"
                                required
                            />
                        </div>

                        {/* Gesamtumsatz */}
                        <div>
                            <Label htmlFor="revenue" className="text-foreground/75">Gesamtumsatz (€) *</Label>
                            <Input
                                id="revenue"
                                type="number"
                                step="0.01"
                                placeholder="z.B. 1500.50"
                                value={revenue}
                                onChange={(e) => setRevenue(e.target.value)}
                                className="bg-secondary border-border/70 text-foreground mt-1"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-foreground/75 text-sm">Umsatz Bar (€)</Label>
                                <Input type="number" step="0.01" placeholder="optional" value={revenueCash} onChange={(e) => setRevenueCash(e.target.value)} className="bg-secondary border-border/70 text-foreground mt-1" />
                            </div>
                            <div>
                                <Label className="text-foreground/75 text-sm">Umsatz EC (€)</Label>
                                <Input type="number" step="0.01" placeholder="optional" value={revenueEC} onChange={(e) => setRevenueEC(e.target.value)} className="bg-secondary border-border/70 text-foreground mt-1" />
                            </div>
                            <div>
                                <Label className="text-foreground/75 text-sm">Umsatzsteuer (€)</Label>
                                <Input type="number" step="0.01" placeholder="optional" value={vat} onChange={(e) => setVat(e.target.value)} className="bg-secondary border-border/70 text-foreground mt-1" />
                            </div>
                            <div>
                                <Label className="text-foreground/75 text-sm">Eigenbedarf (€)</Label>
                                <Input type="number" step="0.01" placeholder="optional" value={ownConsumption} onChange={(e) => setOwnConsumption(e.target.value)} className="bg-secondary border-border/70 text-foreground mt-1" />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="pdf" className="text-foreground/75">PDF hochladen (optional)</Label>
                            <div className="mt-1 border-2 border-dashed border-border/70 rounded-lg p-4">
                                <input
                                    id="pdf"
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="text-sm text-muted-foreground w-full"
                                />
                                {file && <p className="text-sm text-green-400 mt-2">✓ {file.name}</p>}
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="notes" className="text-foreground/75">Notizen (optional)</Label>
                            <Input
                                id="notes"
                                type="text"
                                placeholder="z.B. Besonderheiten des Tages"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="bg-secondary border-border/70 text-foreground mt-1"
                            />
                        </div>

                        {error && (
                            <Alert className="bg-red-900/20 border-red-800">
                                <AlertCircle className="h-4 w-4 text-red-400" />
                                <AlertDescription className="text-red-300">{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                                Abbrechen
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={mutation.isPending || !date || !revenue}
                                className="flex-1 bg-amber-600 hover:bg-amber-700"
                            >
                                {mutation.isPending ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Wird gespeichert...</>
                                ) : 'Speichern'}
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="ai" className="mt-4 space-y-4">
                        {/* Datum auch im KI-Tab */}
                        <div>
                            <Label htmlFor="ai-date" className="text-foreground/75">Datum</Label>
                            <Input
                                id="ai-date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="bg-secondary border-border/70 text-foreground mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="ai-pdf" className="text-foreground/75">PDF-Datei</Label>
                            <div className="mt-1 border-2 border-dashed border-border/70 rounded-lg p-4">
                                <input
                                    id="ai-pdf"
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => {
                                        setFile(e.target.files?.[0] || null);
                                        setAnalysisError(null);
                                    }}
                                    className="text-sm text-muted-foreground w-full"
                                />
                                {file && (
                                    <p className="text-sm text-green-400 mt-2 flex items-center gap-1">
                                        <CheckCircle2 className="w-4 h-4" />{file.name}
                                    </p>
                                )}
                            </div>
                        </div>

                        {analysisError && (
                            <Alert className="bg-red-900/20 border-red-800">
                                <AlertCircle className="h-4 w-4 text-red-400" />
                                <AlertDescription className="text-red-300">{analysisError}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-3">
                            <Label className="text-foreground/75">Analysierte Daten</Label>
                            <div className="bg-secondary rounded-lg p-4 space-y-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Gesamtumsatz (€)</Label>
                                    <Input type="number" step="0.01" placeholder="Wird automatisch gefüllt" value={revenue} onChange={(e) => setRevenue(e.target.value)} className="bg-card border-border/70 text-foreground mt-1" disabled={analyzing} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Umsatz Bar (€)</Label>
                                        <Input type="number" step="0.01" placeholder="optional" value={revenueCash} onChange={(e) => setRevenueCash(e.target.value)} className="bg-card border-border/70 text-foreground mt-1" disabled={analyzing} />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Umsatz EC (€)</Label>
                                        <Input type="number" step="0.01" placeholder="optional" value={revenueEC} onChange={(e) => setRevenueEC(e.target.value)} className="bg-card border-border/70 text-foreground mt-1" disabled={analyzing} />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Umsatzsteuer (€)</Label>
                                        <Input type="number" step="0.01" placeholder="optional" value={vat} onChange={(e) => setVat(e.target.value)} className="bg-card border-border/70 text-foreground mt-1" disabled={analyzing} />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Eigenbedarf (€)</Label>
                                        <Input type="number" step="0.01" placeholder="optional" value={ownConsumption} onChange={(e) => setOwnConsumption(e.target.value)} className="bg-card border-border/70 text-foreground mt-1" disabled={analyzing} />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Notizen</Label>
                                    <Input type="text" placeholder="Zusätzliche Notizen" value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-card border-border/70 text-foreground mt-1" disabled={analyzing} />
                                </div>
                            </div>
                        </div>

                        {revenue && (
                            <div className="bg-secondary rounded-lg p-4 space-y-2 border border-green-600/30">
                                <h3 className="font-semibold text-green-400 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" />Vorschau
                                </h3>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Datum:</span>
                                        <span className="text-foreground font-medium">{date || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Tagesumsatz:</span>
                                        <span className="text-green-400 font-bold text-lg">{parseFloat(revenue).toFixed(2)} €</span>
                                    </div>
                                    {notes && (
                                        <div className="flex justify-between pt-2 border-t border-border/70">
                                            <span className="text-muted-foreground">Notizen:</span>
                                            <span className="text-foreground/75 text-right">{notes}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {error && (
                            <Alert className="bg-red-900/20 border-red-800">
                                <AlertCircle className="h-4 w-4 text-red-400" />
                                <AlertDescription className="text-red-300">{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => { setActiveTab('manual'); setAnalysisError(null); }}
                                className="flex-1"
                                disabled={analyzing}
                            >
                                Zurück
                            </Button>
                            <Button
                                type="button"
                                onClick={handleAnalyzePDF}
                                disabled={analyzing || !file}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                {analyzing ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analysiert...</>
                                ) : 'PDF analysieren'}
                            </Button>
                        </div>

                        {revenue && (
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={mutation.isPending || !date || !revenue}
                                className="w-full bg-amber-600 hover:bg-amber-700"
                            >
                                {mutation.isPending ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Wird gespeichert...</>
                                ) : 'Speichern'}
                            </Button>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}