import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import JobOverviewTab from './JobOverviewTab';
import { format } from 'date-fns';

export default function JobCreate() {
    const navigate = useNavigate();
    const qc = useQueryClient();
    const [job, setJob] = useState({
        customer_name: '',
        customer_contact: '',
        customer_phone: '',
        customer_email: '',
        event_date: format(new Date(), 'yyyy-MM-dd'),
        event_name: '',
        location: '',
        setup_time: '',
        teardown_time: '',
        status: 'anfrage',
        pricing_model: 'pauschal',
        offer_number: '',
        offer_date: '',
        fixed_price: null,
        deposit_amount: null,
        notes: '',
    });
    const set = (k, v) => setJob(d => ({ ...d, [k]: v }));

    const create = useMutation({
        mutationFn: () => base44.entities.ExternalJob.create(job),
        onSuccess: (created) => {
            qc.invalidateQueries({ queryKey: ['external-jobs'] });
            navigate(`/ExternalJobs?id=${created.id}`, { replace: true });
        },
        onError: e => toast.error('Erstellen fehlgeschlagen: ' + e.message),
    });

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 md:pb-8">
            <button onClick={() => navigate('/ExternalJobs')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
            </button>
            <div className="mb-5">
                <h1 className="text-xl font-bold text-foreground">Neuer Außeneinsatz</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Kundendaten & Termin erfassen</p>
            </div>

            <JobOverviewTab job={job} set={set} />

            <div className="fixed bottom-20 md:bottom-6 left-0 right-0 px-4 z-30 md:max-w-2xl md:mx-auto md:left-1/2 md:-translate-x-1/2">
                <Button className="w-full shadow-lg" onClick={() => create.mutate()} disabled={create.isPending || !job.customer_name?.trim()}>
                    {create.isPending ? 'Wird erstellt…' : 'Außeneinsatz anlegen'}
                </Button>
            </div>
        </div>
    );
}