import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Camera, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const TYPE_OPTIONS = [
    { value: 'medizinisch', label: 'Medizinischer Notfall' },
    { value: 'gewalt', label: 'Gewalt / Schlägerei' },
    { value: 'feuer', label: 'Feuer' },
    { value: 'ueberfall', label: 'Überfall' },
    { value: 'diebstahl', label: 'Diebstahl' },
    { value: 'drogen', label: 'Drogen' },
    { value: 'arbeitsunfall', label: 'Arbeitsunfall' },
];

const WHERE_OPTIONS = ['Innen', 'Außen / Raucherbereich', 'WC', 'Eingang', 'Theke', 'Sonstiges'];

export default function IncidentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const permissions = usePermissions();

    const { data: incident, isLoading } = useQuery({
        queryKey: ['incident', id],
        queryFn: () => base44.entities.Incident.get(id),
        enabled: !!id && permissions.isManager,
    });

    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (incident) setForm(incident);
    }, [incident]);

    if (permissions.isLoading) return <div className="max-w-2xl mx-auto px-4 py-6"><div className="h-40 rounded-xl animate-shimmer bg-muted" /></div>;
    if (!permissions.isManager) return <PermissionDenied />;

    const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await base44.entities.Incident.update(id, form);
            queryClient.invalidateQueries({ queryKey: ['incident', id] });
            queryClient.invalidateQueries({ queryKey: ['incidents'] });
            toast.success('Vorfall aktualisiert');
        } catch (err) {
            toast.error(`Speichern fehlgeschlagen: ${err?.message || 'Unbekannt'}`);
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            setForm(f => ({ ...f, photos: [...(f?.photos || []), file_url] }));
            toast.success('Foto hinzugefügt');
        } catch (err) {
            toast.error(`Upload fehlgeschlagen: ${err?.message || 'Unbekannt'}`);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removePhoto = (idx) => {
        setForm(f => ({ ...f, photos: (f?.photos || []).filter((_, i) => i !== idx) }));
    };

    if (isLoading || !form) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
                <div className="h-10 rounded-xl animate-shimmer bg-muted" />
                <div className="h-64 rounded-xl animate-shimmer bg-muted" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Link to="/incidents" className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-foreground">Vorfall-Detail</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {form.incident_time ? format(parseISO(form.incident_time), 'dd.MM.yyyy HH:mm', { locale: de }) : '—'}
                        </p>
                    </div>
                    {form.is_training && (
                        <span className="text-[10px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded px-2 py-1 font-bold">TRAINING</span>
                    )}
                </div>

                {/* Status-Wechsel */}
                <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Status:</Label>
                    <Select value={form.status} onValueChange={v => set('status', v)}>
                        <SelectTrigger className="h-8 text-sm flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="aktiv">aktiv</SelectItem>
                            <SelectItem value="dokumentiert">dokumentiert</SelectItem>
                            <SelectItem value="abgeschlossen">abgeschlossen</SelectItem>
                            <SelectItem value="archiviert">archiviert</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Kern-Info */}
                <Section title="Vorfall">
                    <Field label="Typ">
                        <Select value={form.type} onValueChange={v => set('type', v)}>
                            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Wer? (Betroffene)">
                        <Input value={form.who || ''} onChange={e => set('who', e.target.value)} placeholder="Gast, Mitarbeiter, Unbekannt..." />
                    </Field>
                    <Field label="Was ist passiert?">
                        <Textarea value={form.what || ''} onChange={e => set('what', e.target.value)} rows={3} placeholder="Beschreibung..." />
                    </Field>
                    <Field label="Wo?">
                        <Select value={form.where || ''} onValueChange={v => set('where', v)}>
                            <SelectTrigger className="h-10"><SelectValue placeholder="— wählen —" /></SelectTrigger>
                            <SelectContent>
                                {WHERE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Schwere">
                            <Select value={form.severity || 'mittel'} onValueChange={v => set('severity', v)}>
                                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gering">gering</SelectItem>
                                    <SelectItem value="mittel">mittel</SelectItem>
                                    <SelectItem value="schwer">schwer</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Vorfall-Zeit">
                            <Input
                                type="datetime-local"
                                value={form.incident_time ? format(parseISO(form.incident_time), "yyyy-MM-dd'T'HH:mm") : ''}
                                onChange={e => set('incident_time', e.target.value ? new Date(e.target.value).toISOString() : null)}
                            />
                        </Field>
                    </div>
                    <div className="flex gap-4 pt-1">
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={!!form.alcohol_involved} onChange={e => set('alcohol_involved', e.target.checked)} className="rounded" />
                            Alkohol im Spiel
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={!!form.injured} onChange={e => set('injured', e.target.checked)} className="rounded" />
                            Person verletzt
                        </label>
                    </div>
                    {form.injured && (
                        <Field label="Verletzungsschwere">
                            <Input value={form.injury_severity || ''} onChange={e => set('injury_severity', e.target.value)} placeholder="z.B. Schnittwunde am Arm" />
                        </Field>
                    )}
                </Section>

                {/* Maßnahmen & Zeugen */}
                <Section title="Maßnahmen & Zeugen">
                    <Field label="Maßnahmen ergriffen">
                        <Textarea value={form.measures_taken || ''} onChange={e => set('measures_taken', e.target.value)} rows={2} placeholder="112 gerufen, Erste Hilfe, Person rausgeworfen..." />
                    </Field>
                    <Field label="Zeugen (Namen + Handynummern)">
                        <Textarea value={form.witnesses || ''} onChange={e => set('witnesses', e.target.value)} rows={2} placeholder="Max Mustermann, 0170..." />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Polizei-Aktenzeichen">
                            <Input value={form.police_report_number || ''} onChange={e => set('police_report_number', e.target.value)} />
                        </Field>
                        <Field label="Krankenhaus">
                            <Input value={form.hospital || ''} onChange={e => set('hospital', e.target.value)} />
                        </Field>
                    </div>
                    <Field label="Kamera-Zeitstempel (Band-Sicherung)">
                        <Input value={form.camera_timestamp || ''} onChange={e => set('camera_timestamp', e.target.value)} placeholder="z.B. Cam 3, 02:34:12" />
                    </Field>
                    <Field label="Mitarbeiter auf Schicht">
                        <Input value={form.shift_staff || ''} onChange={e => set('shift_staff', e.target.value)} />
                    </Field>
                </Section>

                {/* Fotos */}
                <Section title="Fotos">
                    <div className="grid grid-cols-3 gap-2">
                        {(form.photos || []).map((url, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                                <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                                <button onClick={() => removePhoto(idx)}
                                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-foreground/30 cursor-pointer transition-all">
                            <Camera className="w-5 h-5" />
                            <span className="text-[10px] font-medium">{uploading ? '...' : 'Foto'}</span>
                            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                        </label>
                    </div>
                </Section>

                {/* Nachbereitung */}
                <Section title="Nachbereitung">
                    <Field label="Folgen (Versicherung, Anzeige, Debriefing, Hausverbot)">
                        <Textarea value={form.follow_up || ''} onChange={e => set('follow_up', e.target.value)} rows={2} />
                    </Field>
                    <Field label="Lessons Learned — was können wir besser machen?">
                        <Textarea value={form.lessons_learned || ''} onChange={e => set('lessons_learned', e.target.value)} rows={2} />
                    </Field>
                </Section>

                {/* Save */}
                <div className="flex gap-2 pt-2">
                    <Button onClick={handleSave} disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
                        {saving ? 'Speichern…' : 'Speichern'}
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/incidents')} className="px-6">
                        Zurück
                    </Button>
                </div>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <h2 className="text-sm font-bold text-foreground">{title}</h2>
            {children}
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
            {children}
        </div>
    );
}