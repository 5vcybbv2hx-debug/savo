import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FileDown, Loader2, PenLine, Save, CheckCircle2, Trash2, ShieldOff } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SignaturePad from './SignaturePad';

export default function RVBefreiungExport({ employee, onEmployeeUpdate }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [emailSent, setEmailSent] = useState(false);
    const [steuerberaterEmail, setSteuerberaterEmail] = useState('');
    const [showSigPanel, setShowSigPanel] = useState(false);
    const [sigSaved, setSigSaved] = useState(false);

    // Neu gezeichnete (noch nicht gespeicherte) Unterschriften
    const [sigEmployee, setSigEmployee] = useState(null);
    const [sigEmployer, setSigEmployer] = useState(null);

    // Datumsfelder
    const today = new Date().toLocaleDateString('de-DE');
    const [ortDatumAN, setOrtDatumAN] = useState(`Mannheim, ${today}`);
    const [ortDatumAG, setOrtDatumAG] = useState(`Mannheim, ${today}`);
    const [eingangsDatum, setEingangsDatum] = useState(today);
    const [wirkungsDatum, setWirkungsDatum] = useState(today);

    const savedSigEmployee = employee.sig_employee || null;
    const savedSigEmployer = employee.sig_employer || null;

    const nameParts = employee.name?.split(' ') || ['', ''];
    const vorname = nameParts[0] || '';
    const nachname = nameParts.slice(1).join(' ') || '';

    const handleOpen = () => {
        setOpen(true);
        setPdfUrl(null);
        setEmailSent(false);
        setSigEmployee(null);
        setSigEmployer(null);
        setSigSaved(false);
        setShowSigPanel(false);
    };

    const handleSaveSignatures = async () => {
        setLoading(true);
        try {
            const updates = {};
            if (sigEmployee) updates.sig_employee = sigEmployee;
            if (sigEmployer) updates.sig_employer = sigEmployer;
            await base44.entities.Employee.update(employee.id, updates);
            setSigSaved(true);
            if (onEmployeeUpdate) onEmployeeUpdate({ ...employee, ...updates });
        } catch (e) {
            alert('Fehler beim Speichern: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClearSignature = async (type) => {
        setLoading(true);
        try {
            const field = type === 'employee' ? 'sig_employee' : 'sig_employer';
            await base44.entities.Employee.update(employee.id, { [field]: null });
            if (onEmployeeUpdate) onEmployeeUpdate({ ...employee, [field]: null });
        } catch (e) {
            alert('Fehler: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        setPdfUrl(null);
        setEmailSent(false);
        try {
            const finalSigEmployee = sigEmployee || savedSigEmployee;
            const finalSigEmployer = sigEmployer || savedSigEmployer;

            const { data: result } = await base44.functions.invoke('generateRVBefreiungPDF', {
                employeeData: { vorname, nachname, pension_number: employee.pension_number || '' },
                sigEmployee: finalSigEmployee,
                sigEmployer: finalSigEmployer,
                ortDatumAN,
                ortDatumAG,
                eingangsDatum,
                wirkungsDatum,
            });
            setPdfUrl(result?.pdf_url);
        } catch (e) {
            alert('Fehler beim Generieren: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
        setLoading(true);
        try {
            await base44.integrations.Core.SendEmail({
                to: steuerberaterEmail,
                subject: `RV-Befreiungsantrag – ${employee.name}`,
                body: `Hallo,\n\nanbei der Befreiungsantrag von der Rentenversicherungspflicht für:\n\nName: ${employee.name}\nEintrittsdatum: ${employee.entry_date || '-'}\n\nDownload-Link: ${pdfUrl}\n\nMit freundlichen Grüßen\nSAVO Lounge-Club`.trim()
            });
            setEmailSent(true);
        } catch (e) {
            alert('Fehler: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={handleOpen}
                className="flex-1 border-border text-muted-foreground hover:bg-surface"
            >
                <ShieldOff className="w-4 h-4 mr-1" />
                RV-Befreiung
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>RV-Befreiungsantrag – {employee.name}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-2">

                        {/* Datumsfelder */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Ort, Datum (Arbeitnehmer)</Label>
                                <Input value={ortDatumAN} onChange={e => setOrtDatumAN(e.target.value)} className="text-sm mt-1" />
                            </div>
                            <div>
                                <Label className="text-xs">Ort, Datum (Arbeitgeber)</Label>
                                <Input value={ortDatumAG} onChange={e => setOrtDatumAG(e.target.value)} className="text-sm mt-1" />
                            </div>
                            <div>
                                <Label className="text-xs">Eingang des Antrags (TT.MM.JJJJ)</Label>
                                <Input value={eingangsDatum} onChange={e => setEingangsDatum(e.target.value)} className="text-sm mt-1" placeholder="z.B. 01.04.2026" />
                            </div>
                            <div>
                                <Label className="text-xs">Befreiung wirkt ab (TT.MM.JJJJ)</Label>
                                <Input value={wirkungsDatum} onChange={e => setWirkungsDatum(e.target.value)} className="text-sm mt-1" placeholder="z.B. 01.04.2026" />
                            </div>
                        </div>

                        {/* Unterschriften */}
                        <div className="border border-border rounded-lg overflow-hidden">
                            <button
                                onClick={() => setShowSigPanel(v => !v)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 text-sm transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <PenLine className="w-4 h-4 text-status-warn" />
                                    Unterschriften
                                    {(savedSigEmployee || savedSigEmployer) && (
                                        <span className="text-xs text-status-ok flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            {savedSigEmployee && savedSigEmployer ? 'beide hinterlegt' : 'teilweise hinterlegt'}
                                        </span>
                                    )}
                                </span>
                                <span className="text-muted-foreground">{showSigPanel ? '▲' : '▼'}</span>
                            </button>

                            {showSigPanel && (
                                <div className="p-4 space-y-5 border-t border-border">
                                    {/* AN */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-medium">Unterschrift Arbeitnehmer</p>
                                            {savedSigEmployee && (
                                                <button onClick={() => handleClearSignature('employee')} className="text-xs text-status-danger flex items-center gap-1 hover:text-status-danger/25">
                                                    <Trash2 className="w-3 h-3" /> Löschen
                                                </button>
                                            )}
                                        </div>
                                        {savedSigEmployee && !sigEmployee ? (
                                            <div className="space-y-2">
                                                <div className="border border-status-ok/30 rounded-lg bg-status-ok/5 p-2">
                                                    <img src={savedSigEmployee} alt="Unterschrift AN" className="max-h-16 w-full object-contain" />
                                                </div>
                                                <button onClick={() => setSigEmployee('__override__')} className="text-xs text-status-warn hover:text-status-warn/25">
                                                    Neue Unterschrift hinterlegen
                                                </button>
                                            </div>
                                        ) : (
                                            <SignaturePad label="" onSign={(v) => setSigEmployee(v)} />
                                        )}
                                    </div>

                                    {/* AG */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-medium">Unterschrift Arbeitgeber</p>
                                            {savedSigEmployer && (
                                                <button onClick={() => handleClearSignature('employer')} className="text-xs text-status-danger flex items-center gap-1 hover:text-status-danger/25">
                                                    <Trash2 className="w-3 h-3" /> Löschen
                                                </button>
                                            )}
                                        </div>
                                        {savedSigEmployer && !sigEmployer ? (
                                            <div className="space-y-2">
                                                <div className="border border-status-ok/30 rounded-lg bg-status-ok/5 p-2">
                                                    <img src={savedSigEmployer} alt="Unterschrift AG" className="max-h-16 w-full object-contain" />
                                                </div>
                                                <button onClick={() => setSigEmployer('__override__')} className="text-xs text-status-warn hover:text-status-warn/25">
                                                    Neue Unterschrift hinterlegen
                                                </button>
                                            </div>
                                        ) : (
                                            <SignaturePad label="" onSign={(v) => setSigEmployer(v)} />
                                        )}
                                    </div>

                                    {(sigEmployee || sigEmployer) && (
                                        <Button
                                            onClick={handleSaveSignatures}
                                            disabled={loading || sigSaved}
                                            className="w-full bg-status-ok/70 hover:bg-status-ok/70"
                                            size="sm"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                            {sigSaved ? '✓ Unterschriften gespeichert' : 'Unterschriften speichern'}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* PDF generieren */}
                        {!pdfUrl ? (
                            <Button onClick={handleGenerate} disabled={loading} className="w-full bg-primary/70 hover:bg-primary/70">
                                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />PDF wird generiert...</> : 'PDF generieren'}
                            </Button>
                        ) : (
                            <>
                                <div className="p-3 bg-status-ok/10 border border-status-ok/30 rounded-lg text-sm text-status-ok">
                                    ✓ PDF erfolgreich generiert
                                </div>
                                <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg bg-status-warn/70 hover:bg-status-warn/70 text-white font-medium transition-colors"
                                >
                                    <FileDown className="w-4 h-4" />
                                    PDF herunterladen
                                </a>

                                <div className="pt-3 border-t border-border space-y-2">
                                    <Label>Per E-Mail an Steuerberater senden</Label>
                                    <Input
                                        type="email"
                                        placeholder="steuerberater@example.com"
                                        value={steuerberaterEmail}
                                        onChange={e => setSteuerberaterEmail(e.target.value)}
                                    />
                                    <Button
                                        onClick={handleSendEmail}
                                        disabled={loading || !steuerberaterEmail || emailSent}
                                        className="w-full bg-status-ok/70 hover:bg-status-ok/70"
                                    >
                                        {emailSent ? '✓ E-Mail gesendet!' : 'E-Mail senden'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}