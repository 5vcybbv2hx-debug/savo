import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { eur } from './format';
import { format, parseISO } from 'date-fns';

const PRICING_LABELS = {
    pauschal: 'Pauschal (Festpreis)',
    kommission: 'Kommission (pro Einheit)',
    verbrauchsabrechnung: 'Verbrauchsabrechnung',
};

export default function JobBillingTab({ job }) {
    const { data: lines = [] } = useQuery({
        queryKey: ['external-job-lines', job.id],
        queryFn: () => base44.entities.ExternalJobLine.filter({ job_id: job.id }, '-created_date', 500),
        staleTime: STALE.SHORT,
    });
    const { data: consumption = [] } = useQuery({
        queryKey: ['external-job-consumption', job.id],
        queryFn: () => base44.entities.ExternalJobConsumption.filter({ job_id: job.id }, '-created_date', 500),
        staleTime: STALE.SHORT,
    });
    const { data: staff = [] } = useQuery({
        queryKey: ['external-job-staff', job.id],
        queryFn: () => base44.entities.ExternalJobStaff.filter({ job_id: job.id }, '-created_date', 200),
        staleTime: STALE.SHORT,
    });

    const plannedTotal = lines.reduce((s, l) => s + (Number(l.planned_qty) || 0) * (Number(l.price_per_unit) || 0), 0);
    const consumptionTotal = consumption.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
    const staffHours = staff.reduce((s, x) => s + (Number(x.actual_hours) || 0), 0);
    const deposit = Number(job.deposit_amount) || 0;

    let billingBasis = null;
    if (job.pricing_model === 'pauschal') billingBasis = Number(job.fixed_price) || 0;
    else if (job.pricing_model === 'kommission') billingBasis = plannedTotal;
    else if (job.pricing_model === 'verbrauchsabrechnung') billingBasis = consumptionTotal;

    const total = billingBasis != null ? billingBasis : 0;

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Preismodell</p>
                <p className="text-sm font-semibold text-foreground">{PRICING_LABELS[job.pricing_model] || job.pricing_model}</p>
                {job.pricing_model === 'pauschal' && job.offer_number && (
                    <p className="text-xs text-muted-foreground">Angebot {job.offer_number}{job.offer_date ? ` · ${format(parseISO(job.offer_date), 'dd.MM.yyyy')}` : ''}</p>
                )}
            </div>

            <div className="rounded-xl border border-border/50 bg-card divide-y divide-border/30">
                <div className="p-3 flex justify-between text-sm">
                    <span className="text-muted-foreground">Geplanter Umsatz (Getränkeplanung)</span>
                    <span className="text-foreground font-medium num">{eur(plannedTotal)} €</span>
                </div>
                <div className="p-3 flex justify-between text-sm">
                    <span className="text-muted-foreground">Verbrauch gesamt</span>
                    <span className="text-foreground font-medium num">{eur(consumptionTotal)} €</span>
                </div>
                <div className="p-3 flex justify-between text-sm">
                    <span className="text-muted-foreground">Personal (tatsächl. Std)</span>
                    <span className="text-foreground font-medium num">{staffHours > 0 ? `${staffHours} Std` : '—'}</span>
                </div>
                {job.pricing_model === 'pauschal' && (
                    <div className="p-3 flex justify-between text-sm">
                        <span className="text-muted-foreground">Festpreis</span>
                        <span className="text-foreground font-medium num">{eur(Number(job.fixed_price) || 0)} €</span>
                    </div>
                )}
                {deposit > 0 && (
                    <div className="p-3 flex justify-between text-sm">
                        <span className="text-muted-foreground">Anzahlung</span>
                        <span className="text-emerald-500 font-medium num">− {eur(deposit)} €</span>
                    </div>
                )}
                <div className="p-4 flex justify-between">
                    <span className="text-sm font-bold text-foreground">Abrechnung gesamt</span>
                    <span className="text-base font-bold text-primary num">{eur(total)} €</span>
                </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
                Rechnungserstellung folgt in V2 — hier nur Übersicht, keine Beleg-Module.
            </p>
        </div>
    );
}