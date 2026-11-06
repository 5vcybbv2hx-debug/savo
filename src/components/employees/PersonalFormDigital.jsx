import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, CheckCircle2, User } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import SignaturePad from './SignaturePad';

export default function PersonalFormDigital({ onSuccess }) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(1);
    const [status, setStatus] = useState('idle');
    const [progress, setProgress] = useState(0);
    const [formData, setFormData] = useState({
        // Persönliche Daten
        name: '',
        vorname: '',
        street: '',
        postal_code: '',
        city: '',
        nationality: 'Deutsch',
        
        // Personalakte (nicht an Steuerberater)
        employee_email: '',
        employee_phone: '',
        tshirt_size: '',
        pullover_size: '',
        
        // Beschäftigung
        entry_date: '',
        activity: '',
        education: '',
        weekly_hours: '',
        hourly_rate: '15.00',
        
        // Arbeitszeiten
        monday: '',
        tuesday: '',
        wednesday: '',
        thursday: '',
        friday: '',
        saturday: '',
        sunday: '',
        
        // Steuer & Versicherung
        tax_id: '',
        pension_number: '',
        birthday: '',
        birth_name: '',
        birth_place: '',
        health_insurance: '',
        
        // Befreiung & Beschäftigungen
        pension_exemption: false,
        has_main_job: false,
        has_other_minijob: false,
        other_minijob_details: '',
        
        // Bankverbindung
        bank_name: '',
        iban: '',
        bic: '',
        
        // E-Mail für Steuerberater
        steuerberater_email: '',
        
        // Unterschriften
        sig_employee: null,
        sig_employer: null,
        
        // Bestätigung
        confirmed: false
    });

    const processMutation = useMutation({
        mutationFn: async (data) => {
            setStatus('generating');
            setProgress(30);
            
            // Schritt 1: PDF generieren (Backend-Funktion)
            const { data: pdfResult } = await base44.functions.invoke('generatePersonalFormPDF', {
                formData: data
            });
            
            setProgress(60);
            setStatus('creating');
            
            // Schritt 2: Mitarbeiter im System anlegen
            const employeeData = {
                name: `${data.vorname} ${data.name}`,
                role: 'Aushilfe',
                contract_type: 'Minijob',
                hourly_rate: parseFloat(data.hourly_rate),
                email: data.employee_email || '',
                phone: data.employee_phone || '',
                birthday: data.birthday,
                entry_date: data.entry_date,
                street: data.street,
                postal_code: data.postal_code,
                city: data.city,
                tshirt_size: data.tshirt_size || '',
                pullover_size: data.pullover_size || '',
                is_active: true
            };
            
            await base44.entities.Employee.create(employeeData);
            
            setProgress(80);
            setStatus('sending');
            
            // Schritt 3: PDF per E-Mail an Steuerberater senden
            await base44.integrations.Core.SendEmail({
                to: data.steuerberater_email,
                subject: `Personalbogen - ${data.vorname} ${data.name}`,
                body: `
Hallo,

im Anhang finden Sie den ausgefüllten Personalbogen für:

Name: ${data.vorname} ${data.name}
Eintrittsdatum: ${data.entry_date}
Tätigkeit: ${data.activity}

Der Mitarbeiter wurde im System erfasst.

Download-Link: ${pdfResult.pdf_url}

Mit freundlichen Grüßen
BarManager System
                `.trim()
            });
            
            setStatus('success');
            setProgress(100);
            
            return pdfResult;
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
        setStep(1);
        setStatus('idle');
        setProgress(0);
        setFormData({
            name: '',
            vorname: '',
            street: '',
            postal_code: '',
            city: '',
            nationality: 'Deutsch',
            employee_email: '',
            employee_phone: '',
            tshirt_size: '',
            pullover_size: '',
            entry_date: '',
            activity: '',
            education: '',
            weekly_hours: '',
            hourly_rate: '15.00',
            monday: '',
            tuesday: '',
            wednesday: '',
            thursday: '',
            friday: '',
            saturday: '',
            sunday: '',
            tax_id: '',
            pension_number: '',
            birthday: '',
            birth_name: '',
            birth_place: '',
            health_insurance: '',
            pension_exemption: false,
            has_main_job: false,
            has_other_minijob: false,
            other_minijob_details: '',
            bank_name: '',
            iban: '',
            bic: '',
            steuerberater_email: '',
            sig_employee: null,
            sig_employer: null,
            confirmed: false
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.confirmed) {
            alert('Bitte bestätigen Sie die Richtigkeit der Angaben.');
            return;
        }
        if (!formData.sig_employee || !formData.sig_employer) {
            alert('Bitte sammeln Sie beide Unterschriften (Arbeitnehmer und Arbeitgeber).');
            return;
        }
        processMutation.mutate(formData);
    };

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const getStatusText = () => {
        switch (status) {
            case 'generating': return 'PDF wird generiert...';
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
                className="bg-primary/70 hover:bg-primary/70"
            >
                <User className="w-4 h-4 mr-2" />
                Digitaler Personalbogen
            </Button>

            <Dialog open={open} onOpenChange={(o) => {
                if (!processMutation.isPending) {
                    setOpen(o);
                    if (!o) resetForm();
                }
            }}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            Personalbogen Minijob - Schritt {step} von 5
                        </DialogTitle>
                    </DialogHeader>

                    {status === 'idle' ? (
                        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                            {/* Schritt 1: Persönliche Daten */}
                            {step === 1 && (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg border-b pb-2">Persönliche Daten</h3>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Vorname *</Label>
                                            <Input
                                                value={formData.vorname}
                                                onChange={(e) => setFormData({...formData, vorname: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Nachname *</Label>
                                            <Input
                                                value={formData.name}
                                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Straße und Hausnummer *</Label>
                                        <Input
                                            value={formData.street}
                                            onChange={(e) => setFormData({...formData, street: e.target.value})}
                                            placeholder="Musterstraße 123"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>PLZ *</Label>
                                            <Input
                                                value={formData.postal_code}
                                                onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Wohnort *</Label>
                                            <Input
                                                value={formData.city}
                                                onChange={(e) => setFormData({...formData, city: e.target.value})}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Nationalität *</Label>
                                        <Input
                                            value={formData.nationality}
                                            onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Geburtsdatum *</Label>
                                        <Input
                                            type="date"
                                            value={formData.birthday}
                                            onChange={(e) => setFormData({...formData, birthday: e.target.value})}
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Geburtsname</Label>
                                            <Input
                                                value={formData.birth_name}
                                                onChange={(e) => setFormData({...formData, birth_name: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Geburtsort</Label>
                                            <Input
                                                value={formData.birth_place}
                                                onChange={(e) => setFormData({...formData, birth_place: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t">
                                        <h4 className="font-semibold mb-3 text-sm text-muted-foreground">Für Personalakte (nicht an Steuerberater)</h4>
                                        
                                        <div className="space-y-3">
                                            <div className="space-y-2">
                                                <Label>E-Mail Adresse</Label>
                                                <Input
                                                    type="email"
                                                    value={formData.employee_email}
                                                    onChange={(e) => setFormData({...formData, employee_email: e.target.value})}
                                                    placeholder="mitarbeiter@example.com"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Telefonnummer</Label>
                                                <Input
                                                    value={formData.employee_phone}
                                                    onChange={(e) => setFormData({...formData, employee_phone: e.target.value})}
                                                    placeholder="+49 123 456789"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <Label>T-Shirt Größe (Dienstkleidung)</Label>
                                                    <Select
                                                        value={formData.tshirt_size}
                                                        onValueChange={(value) => setFormData({...formData, tshirt_size: value})}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Auswählen..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="XS">XS</SelectItem>
                                                            <SelectItem value="S">S</SelectItem>
                                                            <SelectItem value="M">M</SelectItem>
                                                            <SelectItem value="L">L</SelectItem>
                                                            <SelectItem value="XL">XL</SelectItem>
                                                            <SelectItem value="XXL">XXL</SelectItem>
                                                            <SelectItem value="XXXL">XXXL</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Pullover Größe (Dienstkleidung)</Label>
                                                    <Select
                                                        value={formData.pullover_size}
                                                        onValueChange={(value) => setFormData({...formData, pullover_size: value})}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Auswählen..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="XS">XS</SelectItem>
                                                            <SelectItem value="S">S</SelectItem>
                                                            <SelectItem value="M">M</SelectItem>
                                                            <SelectItem value="L">L</SelectItem>
                                                            <SelectItem value="XL">XL</SelectItem>
                                                            <SelectItem value="XXL">XXL</SelectItem>
                                                            <SelectItem value="XXXL">XXXL</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <Button type="button" onClick={nextStep} className="w-full bg-primary/70 hover:bg-primary/70">
                                        Weiter
                                    </Button>
                                </div>
                            )}

                            {/* Schritt 2: Beschäftigung Teil 1 */}
                            {step === 2 && (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg border-b pb-2">Beschäftigung</h3>
                                    
                                    <div className="space-y-2">
                                        <Label>Eintrittsdatum *</Label>
                                        <Input
                                            type="date"
                                            value={formData.entry_date}
                                            onChange={(e) => setFormData({...formData, entry_date: e.target.value})}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Tätigkeit *</Label>
                                        <Input
                                            value={formData.activity}
                                            onChange={(e) => setFormData({...formData, activity: e.target.value})}
                                            placeholder="z.B. Barkeeper, Servicekraft"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Schul- und Berufsausbildung</Label>
                                        <Input
                                            value={formData.education}
                                            onChange={(e) => setFormData({...formData, education: e.target.value})}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Wöchentliche Arbeitszeit (Stunden) *</Label>
                                        <Input
                                            type="number"
                                            value={formData.weekly_hours}
                                            onChange={(e) => setFormData({...formData, weekly_hours: e.target.value})}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Arbeitstage (Stunden pro Tag)</Label>
                                        <div className="grid grid-cols-4 gap-2">
                                            <div>
                                                <Label className="text-xs">Mo</Label>
                                                <Input
                                                    type="number"
                                                    value={formData.monday}
                                                    onChange={(e) => setFormData({...formData, monday: e.target.value})}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Di</Label>
                                                <Input
                                                    type="number"
                                                    value={formData.tuesday}
                                                    onChange={(e) => setFormData({...formData, tuesday: e.target.value})}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Mi</Label>
                                                <Input
                                                    type="number"
                                                    value={formData.wednesday}
                                                    onChange={(e) => setFormData({...formData, wednesday: e.target.value})}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Do</Label>
                                                <Input
                                                    type="number"
                                                    value={formData.thursday}
                                                    onChange={(e) => setFormData({...formData, thursday: e.target.value})}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Fr</Label>
                                                <Input
                                                    type="number"
                                                    value={formData.friday}
                                                    onChange={(e) => setFormData({...formData, friday: e.target.value})}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Sa</Label>
                                                <Input
                                                    type="number"
                                                    value={formData.saturday}
                                                    onChange={(e) => setFormData({...formData, saturday: e.target.value})}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">So</Label>
                                                <Input
                                                    type="number"
                                                    value={formData.sunday}
                                                    onChange={(e) => setFormData({...formData, sunday: e.target.value})}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Stundenlohn (€) *</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.hourly_rate}
                                            onChange={(e) => setFormData({...formData, hourly_rate: e.target.value})}
                                            required
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
                                            Zurück
                                        </Button>
                                        <Button type="button" onClick={nextStep} className="flex-1 bg-primary/70 hover:bg-primary/70">
                                            Weiter
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Schritt 3: Versicherung & Weitere Beschäftigungen */}
                            {step === 3 && (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg border-b pb-2">Versicherung & Weitere Beschäftigungen</h3>
                                    
                                    <div className="space-y-2">
                                        <Label>Steuer-Identifikationsnummer *</Label>
                                        <Input
                                            value={formData.tax_id}
                                            onChange={(e) => setFormData({...formData, tax_id: e.target.value})}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Rentenversicherungsnummer</Label>
                                        <Input
                                            value={formData.pension_number}
                                            onChange={(e) => setFormData({...formData, pension_number: e.target.value})}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Krankenkasse</Label>
                                        <Input
                                            value={formData.health_insurance}
                                            onChange={(e) => setFormData({...formData, health_insurance: e.target.value})}
                                        />
                                    </div>

                                    <div className="space-y-3 p-4 bg-card rounded-lg">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <Checkbox
                                                checked={formData.pension_exemption}
                                                onCheckedChange={(checked) => setFormData({...formData, pension_exemption: checked})}
                                            />
                                            <span className="text-sm text-muted-foreground">Befreiungsantrag Rentenversicherung wird gestellt</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <Checkbox
                                                checked={formData.has_main_job}
                                                onCheckedChange={(checked) => setFormData({...formData, has_main_job: checked})}
                                            />
                                            <span className="text-sm text-muted-foreground">Versicherungspflichtige Beschäftigung wird ausgeübt</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <Checkbox
                                                checked={formData.has_other_minijob}
                                                onCheckedChange={(checked) => setFormData({...formData, has_other_minijob: checked})}
                                            />
                                            <span className="text-sm text-muted-foreground">Weitere geringfügige Beschäftigung wird ausgeübt</span>
                                        </label>

                                        {formData.has_other_minijob && (
                                            <Input
                                                value={formData.other_minijob_details}
                                                onChange={(e) => setFormData({...formData, other_minijob_details: e.target.value})}
                                                placeholder="Seit wann und mit welchem Verdienst?"
                                                className="mt-2"
                                            />
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
                                            Zurück
                                        </Button>
                                        <Button type="button" onClick={nextStep} className="flex-1 bg-primary/70 hover:bg-primary/70">
                                            Weiter
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Schritt 4: Bankverbindung */}
                            {step === 4 && (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg border-b pb-2">Bankverbindung</h3>
                                    
                                    <div className="space-y-2">
                                        <Label>Kreditinstitut *</Label>
                                        <Input
                                            value={formData.bank_name}
                                            onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>IBAN *</Label>
                                        <Input
                                            value={formData.iban}
                                            onChange={(e) => setFormData({...formData, iban: e.target.value})}
                                            placeholder="DE89 3704 0044 0532 0130 00"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>BIC</Label>
                                        <Input
                                            value={formData.bic}
                                            onChange={(e) => setFormData({...formData, bic: e.target.value})}
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
                                            Zurück
                                        </Button>
                                        <Button type="button" onClick={nextStep} className="flex-1 bg-primary/70 hover:bg-primary/70">
                                            Weiter
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Schritt 5: Unterschriften & Bestätigung */}
                            {step === 5 && (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg border-b pb-2">Unterschriften & Bestätigung</h3>
                                    
                                    <div className="bg-primary/15 p-4 rounded-lg border border-primary/25 mb-4">
                                        <p className="text-sm text-primary font-semibold mb-2">Unterschriften erforderlich:</p>
                                        <p className="text-xs text-primary">Bitte sammeln Sie die Unterschriften des Arbeitnehmers und des Arbeitgebers (Manager).</p>
                                    </div>

                                    <SignaturePad 
                                        label="Unterschrift Arbeitnehmer *"
                                        onSign={(signature) => setFormData({...formData, sig_employee: signature})}
                                    />

                                    <SignaturePad 
                                        label="Unterschrift Arbeitgeber (Manager) *"
                                        onSign={(signature) => setFormData({...formData, sig_employer: signature})}
                                    />

                                    <div className="space-y-2 pt-4 border-t">
                                        <Label>E-Mail Steuerberater *</Label>
                                        <Input
                                            type="email"
                                            value={formData.steuerberater_email}
                                            onChange={(e) => setFormData({...formData, steuerberater_email: e.target.value})}
                                            placeholder="steuerberater@example.com"
                                            required
                                        />
                                    </div>

                                    <div className="bg-primary/15 border border-primary/25 rounded-lg p-4">
                                        <p className="text-sm text-primary font-semibold mb-2">Zusammenfassung:</p>
                                        <ul className="text-xs text-primary space-y-1">
                                            <li>• Name: {formData.vorname} {formData.name}</li>
                                            <li>• Eintrittsdatum: {formData.entry_date}</li>
                                            <li>• Tätigkeit: {formData.activity}</li>
                                            <li>• Stundenlohn: {formData.hourly_rate} €</li>
                                            <li>• Wöchentliche Arbeitszeit: {formData.weekly_hours} Std.</li>
                                        </ul>
                                    </div>

                                    <div className="p-4 bg-card rounded-lg border">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <Checkbox
                                                checked={formData.confirmed}
                                                onCheckedChange={(checked) => setFormData({...formData, confirmed: checked})}
                                            />
                                            <span className="text-sm text-muted-foreground font-medium">
                                                Ich versichere, dass ich die vorstehenden Angaben nach bestem Wissen und Gewissen gemacht habe. 
                                                Ich verpflichte mich, alle Veränderungen unverzüglich meinem Arbeitgeber mitzuteilen.
                                            </span>
                                        </label>
                                    </div>

                                    <div className="bg-status-ok/15 border border-status-ok/25 rounded-lg p-3">
                                        <p className="text-xs text-status-ok">
                                            <strong>Nach dem Absenden:</strong>
                                        </p>
                                        <ol className="text-xs text-status-ok mt-2 space-y-1 list-decimal list-inside">
                                            <li>Das PDF wird automatisch ausgefüllt und generiert</li>
                                            <li>Der Mitarbeiter wird im System angelegt</li>
                                            <li>Das PDF wird per E-Mail an den Steuerberater gesendet</li>
                                        </ol>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
                                            Zurück
                                        </Button>
                                        <Button 
                                            type="submit" 
                                            className="flex-1 bg-status-ok/70 hover:bg-status-ok/70"
                                            disabled={!formData.confirmed}
                                        >
                                            Absenden & Anlegen
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </form>
                    ) : (
                        <div className="py-6 space-y-4">
                            <div className="flex items-center justify-center mb-4">
                                {status === 'success' ? (
                                    <div className="w-16 h-16 rounded-full bg-status-ok/15 flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8 text-status-ok" />
                                    </div>
                                ) : (
                                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                )}
                            </div>

                            <div className="text-center">
                                <p className="text-lg font-semibold text-muted-foreground mb-2">
                                    {getStatusText()}
                                </p>
                                <Progress value={progress} className="h-2" />
                            </div>

                            {status === 'success' && (
                                <div className="bg-status-ok/15 border border-status-ok/25 rounded-lg p-4">
                                    <p className="text-sm font-semibold text-status-ok mb-2">
                                        Mitarbeiter erfolgreich angelegt:
                                    </p>
                                    <p className="text-sm text-status-ok">
                                        {formData.vorname} {formData.name}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}