import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { X } from 'lucide-react';

const fieldClass = "h-12 text-base rounded-xl border-border/70 bg-background focus:border-primary";
const labelClass = "text-sm font-semibold text-foreground mb-1.5 block";

export default function ContactForm({ contact, onSave, onCancel, isPrimary, onTogglePrimary }) {
    const [formData, setFormData] = useState({
        id: contact?.id || Math.random().toString(36).substr(2, 9),
        company_name: contact?.company_name || '',
        contact_person: contact?.contact_person || '',
        phone: contact?.phone || '',
        mobile: contact?.mobile || '',
        email: contact?.email || '',
        role: contact?.role || 'Service',
        note: contact?.note || '',
        is_primary: contact?.is_primary || false
    });

    const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.company_name.trim()) return;
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-[13.5px] font-medium text-foreground tracking-tight">
                    {contact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
                </h4>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Firmenname */}
            <div>
                <label className={labelClass}>Firmenname *</label>
                <Input
                    className={fieldClass}
                    value={formData.company_name}
                    onChange={e => set('company_name', e.target.value)}
                    placeholder="z.B. ABC Wartungsservice"
                    required
                />
            </div>

            {/* Ansprechpartner */}
            <div>
                <label className={labelClass}>Ansprechpartner</label>
                <Input
                    className={fieldClass}
                    value={formData.contact_person}
                    onChange={e => set('contact_person', e.target.value)}
                    placeholder="Name"
                />
            </div>

            {/* Telefon / Mobil */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Telefon</label>
                    <Input
                        className={fieldClass}
                        value={formData.phone}
                        onChange={e => set('phone', e.target.value)}
                        placeholder="+49 123 456789"
                        type="tel"
                    />
                </div>
                <div>
                    <label className={labelClass}>Mobilnummer</label>
                    <Input
                        className={fieldClass}
                        value={formData.mobile}
                        onChange={e => set('mobile', e.target.value)}
                        placeholder="+49 123 987654"
                        type="tel"
                    />
                </div>
            </div>

            {/* E-Mail */}
            <div>
                <label className={labelClass}>E-Mail</label>
                <Input
                    className={fieldClass}
                    value={formData.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="kontakt@example.com"
                    type="email"
                />
            </div>

            {/* Rolle */}
            <div>
                <label className={labelClass}>Funktion / Rolle</label>
                <Select value={formData.role} onValueChange={v => set('role', v)}>
                    <SelectTrigger className={fieldClass}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Service">Service</SelectItem>
                        <SelectItem value="Notdienst">Notdienst</SelectItem>
                        <SelectItem value="Vertrieb">Vertrieb</SelectItem>
                        <SelectItem value="Wartung">Wartung</SelectItem>
                        <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Notiz */}
            <div>
                <label className={labelClass}>Notiz</label>
                <Textarea
                    className="text-base rounded-xl border-border/70 min-h-[70px] resize-none"
                    value={formData.note}
                    onChange={e => set('note', e.target.value)}
                    placeholder="z.B. Nur Werktags erreichbar"
                />
            </div>

            {/* Hauptkontakt */}
            {onTogglePrimary && (
                <div className="flex items-center justify-between py-2 border-t border-border/30">
                    <div>
                        <p className="text-sm font-medium text-foreground">Hauptkontakt</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Als Primäranlaufstelle markieren</p>
                    </div>
                    <Switch checked={formData.is_primary} onCheckedChange={v => set('is_primary', v)} />
                </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
                <Button
                    type="submit"
                    disabled={!formData.company_name.trim()}
                    className="flex-1 h-11"
                >
                    Speichern
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    className="flex-1 h-11"
                >
                    Abbrechen
                </Button>
            </div>
        </form>
    );
}