import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { eur } from './format';

const STATUS = [
    { v: 'anfrage', l: 'Anfrage' },
    { v: 'angebot', l: 'Angebot' },
    { v: 'auftrag', l: 'Auftrag' },
    { v: 'durchgefuehrt', l: 'Durchgeführt' },
    { v: 'abgerechnet', l: 'Abgerechnet' },
    { v: 'storniert', l: 'Storniert' },
];

const PRICING = [
    { v: 'pauschal', l: 'Pauschal (Festpreis)' },
    { v: 'kommission', l: 'Kommission (pro Einheit)' },
    { v: 'verbrauchsabrechnung', l: 'Verbrauchsabrechnung' },
];

export default function JobOverviewTab({ job, set }) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                    <Label>Kunde / Veranstalter *</Label>
                    <Input value={job.customer_name || ''} onChange={e => set('customer_name', e.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-2">
                    <Label>Ansprechpartner</Label>
                    <Input value={job.customer_contact || ''} onChange={e => set('customer_contact', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Telefon</Label>
                    <Input value={job.customer_phone || ''} onChange={e => set('customer_phone', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>E-Mail</Label>
                    <Input type="email" value={job.customer_email || ''} onChange={e => set('customer_email', e.target.value)} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label>Veranstaltungsdatum *</Label>
                    <Input type="date" value={job.event_date || ''} onChange={e => set('event_date', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Veranstaltung</Label>
                    <Input value={job.event_name || ''} onChange={e => set('event_name', e.target.value)} placeholder="z.B. Firmenfeier" />
                </div>
                <div className="space-y-1.5 col-span-2">
                    <Label>Ort / Adresse</Label>
                    <Input value={job.location || ''} onChange={e => set('location', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Aufbauzeit</Label>
                    <Input type="time" value={job.setup_time || ''} onChange={e => set('setup_time', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Abbauzeit</Label>
                    <Input type="time" value={job.teardown_time || ''} onChange={e => set('teardown_time', e.target.value)} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={job.status || 'anfrage'} onValueChange={v => set('status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Preismodell</Label>
                    <Select value={job.pricing_model || 'pauschal'} onValueChange={v => set('pricing_model', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {PRICING.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Angebotsnummer</Label>
                    <Input value={job.offer_number || ''} onChange={e => set('offer_number', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Angebotsdatum</Label>
                    <Input type="date" value={job.offer_date || ''} onChange={e => set('offer_date', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Festpreis (Pauschale) €</Label>
                    <Input type="number" step="0.01" value={job.fixed_price ?? ''} onChange={e => set('fixed_price', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Anzahlung €</Label>
                    <Input type="number" step="0.01" value={job.deposit_amount ?? ''} onChange={e => set('deposit_amount', e.target.value ? Number(e.target.value) : null)} />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label>Notizen</Label>
                <Textarea value={job.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} />
            </div>

            {job.fixed_price != null && (
                <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 flex justify-between text-sm">
                    <span className="text-muted-foreground">Festpreis</span>
                    <span className="font-bold text-foreground">{eur(job.fixed_price)} €</span>
                </div>
            )}
        </div>
    );
}