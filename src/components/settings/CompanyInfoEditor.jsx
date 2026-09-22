import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Mail, AlertCircle, AlertTriangle, Save, Building2, CreditCard,
    Clock, FileText, Upload, X, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function parseOpeningHours(jsonStr) {
    if (!jsonStr) return {};
    try { return JSON.parse(jsonStr); } catch { return {}; }
}

export default function CompanyInfoEditor() {
    const queryClient  = useQueryClient();
    const fileInputRef = useRef(null);

    const [form, setForm]               = useState({ whatsapp_group_link: '' });
    const [openingHours, setOpeningHours] = useState({});
    const [isDirty, setIsDirty]         = useState(false);
    const [uploading, setUploading]     = useState(false);
    const [dragOver, setDragOver]       = useState(false);

    const { data: companies = [], isLoading } = useQuery({
        queryKey: ['company-info'],
        queryFn: () => base44.entities.CompanyInfo.list(),
    });

    const company      = companies?.[0] || null;
    const hasDuplicates = companies.length > 1;

    useEffect(() => {
        if (company) {
            setForm({
                company_name:              company.company_name              || '',
                street:                    company.street                    || '',
                postal_code:               company.postal_code               || '',
                city:                      company.city                      || '',
                country:                   company.country                   || 'Deutschland',
                email:                     company.email                     || '',
                phone:                     company.phone                     || '',
                website:                   company.website                   || '',
                description:               company.description               || '',
                logo_url:                  company.logo_url                  || '',
                tax_id:                    company.tax_id                    || '',
                tax_office:                company.tax_office                || '',
                vat_id:                    company.vat_id                    || '',
                is_small_business:         company.is_small_business         ?? false,
                bank_name:                 company.bank_name                 || '',
                iban:                      company.iban                      || '',
                bic:                       company.bic                       || '',
                payroll_email:             company.payroll_email             || '',
                datev_beraternummer:       company.datev_beraternummer       || '',
                datev_mandantennummer:     company.datev_mandantennummer     || '',
                whatsapp_group_link:       company.whatsapp_group_link       || '',
                owner_name:               company.owner_name                || '',
                legal_form:               company.legal_form                || '',
                data_protection_contact:  company.data_protection_contact   || '',
                datenschutz_version:      company.datenschutz_version       || '1.0',
                agb_version:              company.agb_version               || '1.0',
                impressum_version:        company.impressum_version         || '1.0',
            });
            setOpeningHours(parseOpeningHours(company.opening_hours));
            setIsDirty(false);
        }
    }, [company]);

    const set = (key, value) => {
        setForm(f => ({ ...f, [key]: value }));
        setIsDirty(true);
    };

    const setHours = (day, field, value) => {
        setOpeningHours(h => ({ ...h, [day]: { ...(h[day] || {}), [field]: value } }));
        setIsDirty(true);
    };

    const updateMutation = useMutation({
        mutationFn: async () => {
            const payload = { ...form, opening_hours: JSON.stringify(openingHours) };
            if (!payload.company_name?.trim()) throw new Error('Firmenname ist Pflicht');
            if (company?.id) return base44.entities.CompanyInfo.update(company.id, payload);
            return base44.entities.CompanyInfo.create(payload);
        },
        onSuccess: (saved) => {
            queryClient.setQueryData(['company-info'], [saved]);
            setIsDirty(false);
            toast.success('Firmendaten gespeichert');
        },
        onError: (err) => toast.error('Fehler: ' + err.message),
    });

    // Logo upload
    const uploadLogo = async (file) => {
        if (!file?.type.startsWith('image/')) { toast.error('Nur Bilddateien erlaubt'); return; }
        setUploading(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            set('logo_url', file_url);
            toast.success('Logo hochgeladen');
        } catch (err) {
            toast.error('Fehler beim Hochladen: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) uploadLogo(file);
    };

    const lastSaved = company?.updated_date
        ? format(new Date(company.updated_date), "dd. MMM, HH:mm 'Uhr'", { locale: de })
        : null;

    if (isLoading) return (
        <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Lade Betriebsdaten…</span>
            </div>
        </Card>
    );

    if (!company) return (
        <Card className="p-4 bg-amber-500/10 border-amber-500/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
                <p className="text-sm font-semibold text-amber-600">Betriebsdaten nicht gefunden</p>
                <p className="text-xs text-amber-600/80 mt-1">Lege hier die ersten Firmendaten an.</p>
            </div>
        </Card>
    );

    return (
        <div className="space-y-3">

            {/* ── Duplikat-Banner ────────────────────────────────────────── */}
            {hasDuplicates && (
                <Card className="p-3 bg-amber-500/10 border-amber-500/30 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-600">
                            ⚠️ Mehrere Firmendatensätze gefunden ({companies.length} Einträge)
                        </p>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs shrink-0"
                        onClick={async () => {
                            try {
                                for (const c of companies.slice(1)) await base44.entities.CompanyInfo.delete(c.id);
                                toast.success('Duplikat entfernt');
                                queryClient.invalidateQueries({ queryKey: ['company-info'] });
                            } catch (err) { toast.error('Fehler: ' + err.message); }
                        }}>
                        Duplikat löschen
                    </Button>
                </Card>
            )}

            <Card className="bg-card border-border overflow-hidden">

                {/* ── Sticky Save-Bar ───────────────────────────────────── */}
                <div className={`
                    px-4 py-3 flex items-center justify-between gap-3 border-b border-border
                    transition-colors ${isDirty ? 'bg-amber-500/10' : 'bg-muted/30'}
                `}>
                    <div className="flex items-center gap-2 text-xs min-w-0">
                        {isDirty ? (
                            <>
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="text-amber-600 font-medium">Ungespeicherte Änderungen</span>
                            </>
                        ) : lastSaved ? (
                            <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                <span className="text-muted-foreground">Gespeichert: {lastSaved}</span>
                            </>
                        ) : (
                            <span className="text-muted-foreground">Firmendaten</span>
                        )}
                    </div>
                    <Button
                        onClick={() => updateMutation.mutate()}
                        disabled={updateMutation.isPending || !isDirty}
                        size="sm"
                        className="gap-1.5 shrink-0 min-h-[36px]"
                    >
                        <Save className="w-3.5 h-3.5" />
                        {updateMutation.isPending ? 'Speichert…' : 'Speichern'}
                    </Button>
                </div>

                {/* ── Tabs ──────────────────────────────────────────────── */}
                <div className="p-4">
                    <Tabs defaultValue="general">
                        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto p-1 mb-5">
                            <TabsTrigger value="general" className="py-2 text-xs flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5" />
                                <span>Allgemein</span>
                            </TabsTrigger>
                            <TabsTrigger value="logo" className="py-2 text-xs flex items-center gap-1">
                                <Upload className="w-3.5 h-3.5" />
                                <span>Logo</span>
                                {form.logo_url && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                            </TabsTrigger>
                            <TabsTrigger value="finance" className="py-2 text-xs flex items-center gap-1">
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Finanzen</span>
                            </TabsTrigger>
                            <TabsTrigger value="hours" className="py-2 text-xs flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Öffnungszeiten</span>
                            </TabsTrigger>
                            <TabsTrigger value="legal" className="py-2 text-xs flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5" />
                                <span>Rechtliches</span>
                            </TabsTrigger>
                        </TabsList>

                        {/* ── Allgemein ───────────────────────────────── */}
                        <TabsContent value="general" className="space-y-3">
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Firmenname <span className="text-destructive">*</span></Label>
                                <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Muster GmbH" />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Straße & Hausnummer</Label>
                                <Input value={form.street} onChange={e => set('street', e.target.value)} placeholder="Musterstraße 1" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">PLZ</Label>
                                    <Input value={form.postal_code} onChange={e => set('postal_code', e.target.value)} placeholder="12345" maxLength={5} />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Stadt</Label>
                                    <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Berlin" />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Land</Label>
                                <Input value={form.country} onChange={e => set('country', e.target.value)} placeholder="Deutschland" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">E-Mail</Label>
                                    <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@example.com" />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Telefon</Label>
                                    <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+49 30 123456" />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Webseite</Label>
                                <Input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://example.com" />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Beschreibung</Label>
                                <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Kurze Beschreibung" />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">WhatsApp-Gruppenlink</Label>
                                <Input value={form.whatsapp_group_link || ''} onChange={e => set('whatsapp_group_link', e.target.value)} placeholder="https://chat.whatsapp.com/..." />
                                <p className="text-xs text-muted-foreground mt-1">Wird als Team-Gruppe-Button auf der Mitarbeiter-Seite angezeigt</p>
                            </div>
                        </TabsContent>

                        {/* ── Logo ────────────────────────────────────── */}
                        <TabsContent value="logo">
                            <div className="space-y-4">
                                {form.logo_url ? (
                                    <div className="relative group max-w-xs mx-auto">
                                        <div className="aspect-square bg-muted rounded-xl p-6 flex items-center justify-center border border-border">
                                            <img src={form.logo_url} alt="Firmenlogo" className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <button
                                            onClick={() => set('logo_url', '')}
                                            className="absolute top-2 right-2 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Logo entfernen"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={handleDrop}
                                        className={`
                                            max-w-xs mx-auto aspect-square rounded-xl border-2 border-dashed cursor-pointer
                                            flex flex-col items-center justify-center gap-3 transition-colors
                                            ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}
                                        `}
                                    >
                                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                                            <Upload className={`w-6 h-6 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                                        </div>
                                        <div className="text-center px-4">
                                            <p className="text-sm font-medium text-foreground">
                                                {dragOver ? 'Loslassen zum Hochladen' : 'Logo hochladen'}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">Drag & Drop oder antippen</p>
                                            <p className="text-xs text-muted-foreground">PNG, JPG, SVG</p>
                                        </div>
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) uploadLogo(f);
                                        e.target.value = '';
                                    }}
                                />

                                {uploading && (
                                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        Wird hochgeladen…
                                    </div>
                                )}

                                {form.logo_url && (
                                    <Button variant="outline" size="sm" className="w-full max-w-xs mx-auto flex"
                                        onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                        <Upload className="w-3.5 h-3.5 mr-2" />
                                        Logo ersetzen
                                    </Button>
                                )}
                            </div>
                        </TabsContent>

                        {/* ── Finanzen ────────────────────────────────── */}
                        <TabsContent value="finance" className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Steuernummer</Label>
                                    <Input value={form.tax_id} onChange={e => set('tax_id', e.target.value)} placeholder="12/345/67890" />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Finanzamt</Label>
                                    <Input value={form.tax_office} onChange={e => set('tax_office', e.target.value)} placeholder="z.B. Finanzamt Balingen" />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">USt-IdNr. (§27a UStG)</Label>
                                    <Input value={form.vat_id} onChange={e => set('vat_id', e.target.value)} placeholder="Nur bei bestätigter USt-IdNr. — leer lassen, falls keine vorliegt" />
                                    <p className="text-[10px] text-muted-foreground mt-1">Nur eintragen, wenn eine bestätigte Umsatzsteuer-Identifikationsnummer vorliegt.</p>
                                </div>
                            </div>
                            <label className="flex items-center gap-2.5 cursor-pointer mt-1">
                                <input
                                    type="checkbox"
                                    checked={!!form.is_small_business}
                                    onChange={e => set('is_small_business', e.target.checked)}
                                    className="w-4 h-4 rounded border-border accent-primary"
                                />
                                <div>
                                    <span className="text-sm font-medium text-foreground">Kleinunternehmer (§19 UStG)</span>
                                    <p className="text-xs text-muted-foreground">Kein USt-Ausweis auf Rechnungen — Umsatz unter €22.000/Jahr</p>
                                </div>
                            </label>
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Kreditinstitut</Label>
                                <Input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="Sparkasse Berlin" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">IBAN</Label>
                                    <Input value={form.iban} onChange={e => set('iban', e.target.value)} placeholder="DE89 3704 0044 …" />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">BIC</Label>
                                    <Input value={form.bic} onChange={e => set('bic', e.target.value)} placeholder="COBADEFFXXX" />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                                    <Mail className="w-3.5 h-3.5" /> Lohnbüro-E-Mail
                                </Label>
                                <Input type="email" value={form.payroll_email} onChange={e => set('payroll_email', e.target.value)} placeholder="payroll@example.com" />
                                <p className="text-xs text-muted-foreground mt-1">Empfänger der monatlichen Zeiterfassungs-Reports</p>
                            </div>
                            <div className="border-t border-border pt-3 mt-3">
                                <h4 className="text-xs font-semibold text-foreground mb-3">DATEV-Integration</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs text-muted-foreground mb-1 block">Beraternummer</Label>
                                        <Input value={form.datev_beraternummer} onChange={e => set('datev_beraternummer', e.target.value)} placeholder="123456" />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground mb-1 block">Mandantennummer</Label>
                                        <Input value={form.datev_mandantennummer} onChange={e => set('datev_mandantennummer', e.target.value)} placeholder="1" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">Wird beim DATEV-Export verwendet</p>
                            </div>
                        </TabsContent>

                        {/* ── Öffnungszeiten ──────────────────────────── */}
                        <TabsContent value="hours" className="space-y-2">
                            <p className="text-xs text-muted-foreground mb-3">Leer lassen = geschlossen.</p>
                            <div className="space-y-2">
                                {WEEKDAYS.map(day => (
                                    <div key={day} className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-foreground w-20 shrink-0">{day.slice(0, 2)}.</span>
                                        <Input className="h-8 text-xs" placeholder="10:00"
                                            value={openingHours[day]?.open || ''}
                                            onChange={e => setHours(day, 'open', e.target.value)} />
                                        <span className="text-xs text-muted-foreground shrink-0">–</span>
                                        <Input className="h-8 text-xs" placeholder="23:00"
                                            value={openingHours[day]?.close || ''}
                                            onChange={e => setHours(day, 'close', e.target.value)} />
                                        <Input className="h-8 text-xs flex-1" placeholder="Notiz"
                                            value={openingHours[day]?.note || ''}
                                            onChange={e => setHours(day, 'note', e.target.value)} />
                                    </div>
                                ))}
                            </div>
                        </TabsContent>

                        {/* ── Rechtliches ─────────────────────────────── */}
                        <TabsContent value="legal" className="space-y-3">
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Betreiber / Verantwortlicher</Label>
                                <Input value={form.owner_name} onChange={e => set('owner_name', e.target.value)} placeholder="Max Mustermann" />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Rechtsform</Label>
                                <Select value={form.legal_form} onValueChange={v => set('legal_form', v)}>
                                    <SelectTrigger><SelectValue placeholder="Rechtsform wählen" /></SelectTrigger>
                                    <SelectContent>
                                        {['Einzelunternehmer', 'GbR', 'oHG', 'KG', 'GmbH', 'AG', 'Ltd.', 'Sonstiges'].map(v => (
                                            <SelectItem key={v} value={v}>{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Datenschutz-Kontakt</Label>
                                <Input value={form.data_protection_contact} onChange={e => set('data_protection_contact', e.target.value)} placeholder="datenschutz@example.com" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Datenschutz v.</Label>
                                    <Input value={form.datenschutz_version} onChange={e => set('datenschutz_version', e.target.value)} placeholder="1.0" />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">AGB v.</Label>
                                    <Input value={form.agb_version} onChange={e => set('agb_version', e.target.value)} placeholder="1.0" />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Impressum v.</Label>
                                    <Input value={form.impressum_version} onChange={e => set('impressum_version', e.target.value)} placeholder="1.0" />
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </Card>
        </div>
    );
}