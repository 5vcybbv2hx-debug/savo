import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Loader2, CheckCircle2, Mail } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export default function PersonalFormUploader({ onSuccess }) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState(null);
    const [steuerberaterEmail, setSteuerberaterEmail] = useState('');
    const [status, setStatus] = useState('idle'); // idle, uploading, extracting, creating, sending, success
    const [progress, setProgress] = useState(0);
    const [extractedData, setExtractedData] = useState(null);

    const processMutation = useMutation({
        mutationFn: async ({ file, email }) => {
            // Step 1: Upload PDF
            setStatus('uploading');
            setProgress(20);
            const { data: uploadData } = await base44.integrations.Core.UploadFile({ file });
            const fileUrl = uploadData.file_url;

            // Step 2: Extract Data
            setStatus('extracting');
            setProgress(40);
            const { data: extractResult } = await base44.integrations.Core.ExtractDataFromUploadedFile({
                file_url: fileUrl,
                json_schema: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        employee_number: { type: "string" },
                        role: { type: "string" },
                        phone: { type: "string" },
                        email: { type: "string" },
                        birthday: { type: "string" },
                        entry_date: { type: "string" },
                        street: { type: "string" },
                        postal_code: { type: "string" },
                        city: { type: "string" },
                        contract_type: { type: "string" },
                        hourly_rate: { type: "number" },
                        vacation_days_per_year: { type: "number" },
                        tshirt_size: { type: "string" },
                        pullover_size: { type: "string" }
                    }
                }
            });

            if (extractResult.status !== 'success' || !extractResult.output) {
                throw new Error(extractResult.details || 'Fehler beim Auslesen der PDF-Daten');
            }

            setExtractedData(extractResult.output);

            // Step 3: Create Employee
            setStatus('creating');
            setProgress(60);
            
            // Map extracted data to Employee entity
            const employeeData = {
                name: extractResult.output.name,
                employee_number: extractResult.output.employee_number,
                role: extractResult.output.role || 'Aushilfe',
                phone: extractResult.output.phone,
                email: extractResult.output.email,
                birthday: extractResult.output.birthday,
                entry_date: extractResult.output.entry_date,
                street: extractResult.output.street,
                postal_code: extractResult.output.postal_code,
                city: extractResult.output.city,
                contract_type: extractResult.output.contract_type,
                hourly_rate: extractResult.output.hourly_rate,
                vacation_days_per_year: extractResult.output.vacation_days_per_year,
                tshirt_size: extractResult.output.tshirt_size,
                pullover_size: extractResult.output.pullover_size,
                is_active: true
            };

            // Remove undefined values
            Object.keys(employeeData).forEach(key => 
                employeeData[key] === undefined && delete employeeData[key]
            );

            const employee = await base44.entities.Employee.create(employeeData);

            // Step 4: Send Email to Steuerberater
            setStatus('sending');
            setProgress(80);
            await base44.integrations.Core.SendEmail({
                to: email,
                subject: `Personalbogen - ${extractResult.output.name}`,
                body: `
Hallo,

im Anhang finden Sie den ausgefüllten und unterschriebenen Personalbogen für:

Name: ${extractResult.output.name}
Mitarbeiternummer: ${extractResult.output.employee_number || 'N/A'}
Eintrittsdatum: ${extractResult.output.entry_date || 'N/A'}

Der Mitarbeiter wurde im System erfasst.

Download-Link: ${fileUrl}

Mit freundlichen Grüßen
BarManager System
                `.trim()
            });

            setStatus('success');
            setProgress(100);

            return { employee, fileUrl };
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['employees']);
            setTimeout(() => {
                setOpen(false);
                resetForm();
                onSuccess?.();
            }, 2000);
        },
        onError: (error) => {
            alert('Fehler: ' + error.message);
            setStatus('idle');
            setProgress(0);
        }
    });

    const resetForm = () => {
        setFile(null);
        setSteuerberaterEmail('');
        setStatus('idle');
        setProgress(0);
        setExtractedData(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!file || !steuerberaterEmail) return;
        processMutation.mutate({ file, email: steuerberaterEmail });
    };

    const getStatusText = () => {
        switch (status) {
            case 'uploading': return 'PDF wird hochgeladen...';
            case 'extracting': return 'Daten werden ausgelesen...';
            case 'creating': return 'Mitarbeiter wird angelegt...';
            case 'sending': return 'E-Mail wird versendet...';
            case 'success': return 'Erfolgreich abgeschlossen!';
            default: return '';
        }
    };

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                variant="outline"
                className="border-status-warn/70 text-status-warn hover:bg-status-warn/15"
            >
                <Upload className="w-4 h-4 mr-2" />
                Personalbogen hochladen
            </Button>

            <Dialog open={open} onOpenChange={(o) => {
                if (!processMutation.isPending) {
                    setOpen(o);
                    if (!o) resetForm();
                }
            }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-status-warn" />
                            Personalbogen digitalisieren
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        {status === 'idle' ? (
                            <>
                                <div className="space-y-2">
                                    <Label>Personalbogen (PDF)</Label>
                                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-status-warn/70 transition-colors">
                                        <Input
                                            type="file"
                                            accept=".pdf"
                                            onChange={(e) => setFile(e.target.files[0])}
                                            className="hidden"
                                            id="pdf-upload"
                                            required
                                        />
                                        <label htmlFor="pdf-upload" className="cursor-pointer">
                                            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">
                                                {file ? file.name : 'PDF auswählen oder hierher ziehen'}
                                            </p>
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>E-Mail Steuerberater</Label>
                                    <div className="flex gap-2">
                                        <Mail className="w-5 h-5 text-muted-foreground mt-2" />
                                        <Input
                                            type="email"
                                            value={steuerberaterEmail}
                                            onChange={(e) => setSteuerberaterEmail(e.target.value)}
                                            placeholder="steuerberater@example.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="bg-primary/15 border border-primary/25 rounded-lg p-3">
                                    <p className="text-xs text-primary">
                                        <strong>Automatischer Ablauf:</strong>
                                    </p>
                                    <ol className="text-xs text-primary mt-2 space-y-1 list-decimal list-inside">
                                        <li>PDF wird hochgeladen und analysiert</li>
                                        <li>Daten werden ausgelesen</li>
                                        <li>Mitarbeiter wird im System angelegt</li>
                                        <li>PDF wird per E-Mail an Steuerberater gesendet</li>
                                    </ol>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setOpen(false)}
                                        className="flex-1"
                                    >
                                        Abbrechen
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-status-warn/70 hover:bg-status-warn/70"
                                        disabled={!file || !steuerberaterEmail}
                                    >
                                        Verarbeiten
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="py-6 space-y-4">
                                <div className="flex items-center justify-center mb-4">
                                    {status === 'success' ? (
                                        <div className="w-16 h-16 rounded-full bg-status-ok/15 flex items-center justify-center">
                                            <CheckCircle2 className="w-8 h-8 text-status-ok" />
                                        </div>
                                    ) : (
                                        <Loader2 className="w-12 h-12 text-status-warn animate-spin" />
                                    )}
                                </div>

                                <div className="text-center">
                                    <p className="text-lg font-semibold text-muted-foreground mb-2">
                                        {getStatusText()}
                                    </p>
                                    <Progress value={progress} className="h-2" />
                                </div>

                                {extractedData && status === 'success' && (
                                    <div className="bg-status-ok/15 border border-status-ok/25 rounded-lg p-4">
                                        <p className="text-sm font-semibold text-status-ok mb-2">
                                            Mitarbeiter erfolgreich angelegt:
                                        </p>
                                        <p className="text-sm text-status-ok">
                                            {extractedData.name}
                                        </p>
                                        {extractedData.employee_number && (
                                            <p className="text-xs text-status-ok mt-1">
                                                Mitarbeiternummer: {extractedData.employee_number}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}