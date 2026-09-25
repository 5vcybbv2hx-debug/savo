import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, ArrowLeft, CalendarDays } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import JobDetail from '@/components/external-jobs/JobDetail';
import JobCreate from '@/components/external-jobs/JobCreate';

const STATUS_STYLES = {
    anfrage: 'bg-secondary text-muted-foreground border-border',
    angebot: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    auftrag: 'bg-primary/10 text-primary border-primary/30',
    durchgefuehrt: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    abgerechnet: 'bg-emerald-600/10 text-emerald-600 border-emerald-600/30',
    storniert: 'bg-destructive/10 text-destructive border-destructive/30',
};

const STATUS_LABELS = {
    anfrage: 'Anfrage',
    angebot: 'Angebot',
    auftrag: 'Auftrag',
    durchgefuehrt: 'Durchgeführt',
    abgerechnet: 'Abgerechnet',
    storniert: 'Storniert',
};

const PRICING_LABELS = {
    pauschal: 'Pauschal',
    kommission: 'Kommission',
    verbrauchsabrechnung: 'Verbrauch',
};

export default function ExternalJobs() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const jobId = params.get('id');
    const isNew = params.get('new') === '1';
    const [filter, setFilter] = useState('alle');

    const { data: jobs = [], isLoading } = useQuery({
        queryKey: ['external-jobs'],
        queryFn: () => base44.entities.ExternalJob.list('-event_date', 300),
        staleTime: STALE.MEDIUM,
    });

    const filtered = useMemo(() =>
        filter === 'alle' ? jobs : jobs.filter(j => (j.status || 'anfrage') === filter),
        [jobs, filter]);

    if (isNew) return <JobCreate />;
    if (jobId) {
        return <JobDetail jobId={jobId} onBack={() => setParams({})} />;
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 md:pb-8">
            <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Außeneinsätze</h1>
                    <p className="text-muted-foreground text-sm mt-1">Externe Veranstaltungen & Catering</p>
                </div>
                <Button size="sm" onClick={() => setParams({ new: '1' })} className="gap-1.5 shrink-0">
                    <Plus className="w-4 h-4" /> Neu
                </Button>
            </div>

            {/* Status-Filter */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-4 -mx-4 px-4">
                <button
                    onClick={() => setFilter('alle')}
                    className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        filter === 'alle' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border/50 hover:border-border')}
                >
                    Alle ({jobs.length})
                </button>
                {Object.keys(STATUS_LABELS).map(s => {
                    const count = jobs.filter(j => (j.status || 'anfrage') === s).length;
                    return (
                        <button
                            key={s}
                            onClick={() => setFilter(s)}
                            className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                                filter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border/50 hover:border-border')}
                        >
                            {STATUS_LABELS[s]} ({count})
                        </button>
                    );
                })}
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-secondary/30 animate-pulse" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">{filter === 'alle' ? 'Noch keine Außeneinsätze' : `Keine Einträge im Status "${STATUS_LABELS[filter]}"`}</p>
                    <p className="text-xs mt-1 opacity-70">Erstelle den ersten mit „Neu"</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(j => (
                        <button
                            key={j.id}
                            onClick={() => setParams({ id: j.id })}
                            className="w-full text-left p-4 rounded-xl border bg-card border-border/50 hover:border-border active:scale-[0.99] transition-all space-y-1.5"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{j.customer_name || 'Ohne Kunden'}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                        {j.event_name || 'Außeneinsatz'}
                                        {j.event_date ? ` · ${format(parseISO(j.event_date), 'dd.MM.yyyy')}` : ''}
                                        {j.location ? ` · ${j.location}` : ''}
                                    </p>
                                </div>
                                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0', STATUS_STYLES[j.status || 'anfrage'])}>
                                    {STATUS_LABELS[j.status || 'anfrage']}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                                <span className="text-[10px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">
                                    {PRICING_LABELS[j.pricing_model] || j.pricing_model}
                                </span>
                                {j.fixed_price != null && j.pricing_model === 'pauschal' && (
                                    <span className="text-[11px] font-semibold text-foreground ml-auto">{j.fixed_price.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}