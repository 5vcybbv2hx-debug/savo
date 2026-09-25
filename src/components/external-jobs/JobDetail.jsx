import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import JobOverviewTab from './JobOverviewTab';
import JobDrinksTab from './JobDrinksTab';
import JobStaffTab from './JobStaffTab';
import JobEquipmentTab from './JobEquipmentTab';
import JobConsumptionTab from './JobConsumptionTab';
import JobBillingTab from './JobBillingTab';

const STATUS_STYLES = {
    anfrage: 'bg-secondary text-muted-foreground border-border',
    angebot: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    auftrag: 'bg-primary/10 text-primary border-primary/30',
    durchgefuehrt: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    abgerechnet: 'bg-emerald-600/10 text-emerald-600 border-emerald-600/30',
    storniert: 'bg-destructive/10 text-destructive border-destructive/30',
};

export default function JobDetail({ jobId, onBack }) {
    const qc = useQueryClient();
    const [draft, setDraft] = useState(null);
    const [tab, setTab] = useState('overview');

    const { data: job, isLoading } = useQuery({
        queryKey: ['external-job', jobId],
        queryFn: () => base44.entities.ExternalJob.get(jobId),
        staleTime: STALE.SHORT,
    });

    useEffect(() => {
        if (job) setDraft({ ...job });
    }, [job]);

    const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

    const save = useMutation({
        mutationFn: () => base44.entities.ExternalJob.update(jobId, {
            customer_name: draft.customer_name || '',
            customer_contact: draft.customer_contact || '',
            customer_phone: draft.customer_phone || '',
            customer_email: draft.customer_email || '',
            event_date: draft.event_date || '',
            event_name: draft.event_name || '',
            location: draft.location || '',
            setup_time: draft.setup_time || '',
            teardown_time: draft.teardown_time || '',
            status: draft.status || 'anfrage',
            pricing_model: draft.pricing_model || 'pauschal',
            offer_number: draft.offer_number || '',
            offer_date: draft.offer_date || '',
            fixed_price: draft.fixed_price ?? null,
            deposit_amount: draft.deposit_amount ?? null,
            notes: draft.notes || '',
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['external-job', jobId] });
            qc.invalidateQueries({ queryKey: ['external-jobs'] });
            toast.success('Gespeichert');
        },
        onError: e => toast.error('Speichern fehlgeschlagen: ' + e.message),
    });

    if (isLoading || !draft) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-6">
                <div className="h-8 w-40 bg-secondary/50 rounded-xl animate-pulse mb-4" />
                <div className="h-64 bg-secondary/30 rounded-2xl animate-pulse" />
            </div>
        );
    }

    const isDirty = JSON.stringify(draft) !== JSON.stringify({ ...job });
    const statusKey = draft.status || 'anfrage';

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 md:pb-8">
            <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
            </button>

            <div className="mb-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-foreground truncate">{draft.customer_name || 'Ohne Kunden'}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {draft.event_name || 'Außeneinsatz'}
                            {draft.event_date ? ` · ${format(parseISO(draft.event_date), 'dd.MM.yyyy')}` : ''}
                        </p>
                    </div>
                    <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border shrink-0', STATUS_STYLES[statusKey])}>
                        {statusKey === 'durchgefuehrt' ? 'Durchgeführt' : statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
                    </span>
                </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                    <TabsList className="grid w-max min-w-full grid-flow-col gap-1 mb-4">
                        <TabsTrigger value="overview">Überblick</TabsTrigger>
                        <TabsTrigger value="drinks">Getränkeplanung</TabsTrigger>
                        <TabsTrigger value="staff">Personal</TabsTrigger>
                        <TabsTrigger value="equipment">Zubehör</TabsTrigger>
                        <TabsTrigger value="consumption">Abwicklung</TabsTrigger>
                        <TabsTrigger value="billing">Abrechnung</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview"><JobOverviewTab job={draft} set={set} /></TabsContent>
                <TabsContent value="drinks"><JobDrinksTab job={job} /></TabsContent>
                <TabsContent value="staff"><JobStaffTab job={job} /></TabsContent>
                <TabsContent value="equipment"><JobEquipmentTab job={job} /></TabsContent>
                <TabsContent value="consumption"><JobConsumptionTab job={job} /></TabsContent>
                <TabsContent value="billing"><JobBillingTab job={draft} /></TabsContent>
            </Tabs>

            {tab === 'overview' && (
                <div className="fixed bottom-20 md:bottom-6 left-0 right-0 px-4 z-30 md:max-w-2xl md:mx-auto md:left-1/2 md:-translate-x-1/2">
                    <Button className="w-full gap-2 shadow-lg" onClick={() => save.mutate()} disabled={save.isPending || !isDirty}>
                        <Save className="w-4 h-4" />
                        {save.isPending ? 'Speichern…' : 'Änderungen speichern'}
                    </Button>
                </div>
            )}
        </div>
    );
}