import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CalendarOff, Loader2 } from 'lucide-react';

export default function UnavailabilityForm({ open, onClose, currentUser, defaultDate }) {
    const queryClient = useQueryClient();
    const today = format(new Date(), 'yyyy-MM-dd');

    const [form, setForm] = useState({
        date: defaultDate || today,
        end_date: defaultDate || today,
        reason: ''
    });

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true })
    });

    const mutation = useMutation({
        mutationFn: (data) => base44.entities.UnavailabilityRequest.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['unavailability-requests-all']);
            queryClient.invalidateQueries(['unavailability-requests']);
            toast.success('Deine Meldung wurde übermittelt');
            setForm({ date: today, end_date: today, reason: '' });
            onClose();
        },
        onError: () => toast.error('Fehler beim Übermitteln')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.reason.trim()) { toast.error('Bitte einen Grund angeben'); return; }
        const matchedEmployee = employees.find(e => e.email === currentUser?.email);
        mutation.mutate({
            employee_id: matchedEmployee?.id || currentUser?.id || currentUser?.email || '',
            employee_name: matchedEmployee?.name || currentUser?.full_name || currentUser?.email || 'Unbekannt',
            date: form.date,
            end_date: form.end_date !== form.date ? form.end_date : form.date,
            reason: form.reason.trim(),
            status: 'ausstehend'
        });
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarOff className="w-5 h-5 text-status-warn" />
                        Nicht verfügbar melden
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Von</Label>
                            <Input type="date" value={form.date} min={today}
                                onChange={e => { set('date', e.target.value); if (e.target.value > form.end_date) set('end_date', e.target.value); }}
                                className="h-12 text-base" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Bis</Label>
                            <Input type="date" value={form.end_date} min={form.date}
                                onChange={e => set('end_date', e.target.value)}
                                className="h-12 text-base" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Grund *</Label>
                        <Textarea
                            value={form.reason}
                            onChange={e => set('reason', e.target.value)}
                            placeholder="z.B. Arzttermin, Prüfung, Familienangelegenheit..."
                            rows={3}
                            className="text-base resize-none"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Deine Meldung wird dem Manager angezeigt und berücksichtigt.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <Button type="button" variant="outline" onClick={onClose} className="h-12">Abbrechen</Button>
                        <Button type="submit" disabled={mutation.isPending}
                            className="h-12 bg-status-warn/70 hover:bg-status-warn/70 text-foreground font-bold">
                            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Melden'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}