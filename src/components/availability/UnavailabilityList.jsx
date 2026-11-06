import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, Trash2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const statusConfig = {
    ausstehend: { label: 'Ausstehend – wird eingeplant wenn möglich', color: 'bg-status-warn/20 text-status-warn border-status-warn/30', icon: Clock },
    genehmigt: { label: 'Eingeplant ✓', color: 'bg-status-ok/20 text-status-ok border-status-ok/30', icon: CheckCircle2 },
    abgelehnt: { label: 'Leider nicht möglich', color: 'bg-status-danger/20 text-status-danger border-status-danger/30', icon: XCircle },
};

export default function UnavailabilityList() {
    const queryClient = useQueryClient();
    const [currentEmployee, setCurrentEmployee] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({ date: '', end_date: '', shift_type: '', notes: '' });

    const { data: shiftTypes = [] } = useQuery({
        queryKey: ['shift-types'],
        queryFn: () => base44.entities.ShiftType.filter({ is_active: true }, 'order')
    });

    useEffect(() => {
        base44.auth.me().then(async (user) => {
            const emps = await base44.entities.Employee.filter({ email: user.email, is_active: true });
            if (emps[0]) setCurrentEmployee(emps[0]);
        });
    }, []);

    const { data: requests = [] } = useQuery({
        queryKey: ['unavailability-requests', currentEmployee?.id],
        queryFn: () => base44.entities.UnavailabilityRequest.filter({ employee_id: currentEmployee.id }, '-date'),
        enabled: !!currentEmployee?.id
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.UnavailabilityRequest.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['unavailability-requests']);
            setModalOpen(false);
            setFormData({ date: '', end_date: '', shift_type: '', notes: '' });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.UnavailabilityRequest.delete(id),
        onSuccess: () => queryClient.invalidateQueries(['unavailability-requests'])
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!currentEmployee) return;
        createMutation.mutate({
            employee_id: currentEmployee.id,
            employee_name: currentEmployee.name,
            date: formData.date,
            end_date: formData.end_date || formData.date,
            reason: [formData.shift_type, formData.notes].filter(Boolean).join(' | ') || 'Keine weiteren Angaben',
            status: 'ausstehend'
        });
    };

    const sorted = [...requests].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    Trage Tage ein, an denen du gerne arbeiten würdest. Der Manager berücksichtigt deine Wünsche bei der Schichtplanung.
                </p>
                <Button onClick={() => setModalOpen(true)} size="sm" className="bg-status-warn/70 hover:bg-status-warn/70 gap-2 shrink-0">
                    <Plus className="w-4 h-4" /> Wunschtag eintragen
                </Button>
            </div>

            {sorted.length === 0 ? (
                <Card className="p-8 text-center bg-background border-border">
                    <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">Noch keine Wunschtage eingetragen</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {sorted.map(req => {
                        const config = statusConfig[req.status] || statusConfig.ausstehend;
                        const StatusIcon = config.icon;
                        return (
                            <Card key={req.id} className="p-4 bg-background border-border">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <p className="font-semibold text-foreground text-sm">
                                                {format(parseISO(req.date), 'EEE, dd. MMM yyyy', { locale: de })}
                                                {req.end_date && req.end_date !== req.date && (
                                                    <span className="text-muted-foreground"> – {format(parseISO(req.end_date), 'dd. MMM yyyy', { locale: de })}</span>
                                                )}
                                            </p>
                                        </div>
                                        <p className="text-sm text-foreground/75 mb-2">{req.reason}</p>
                                        <Badge className={`text-xs border flex items-center gap-1 w-fit ${config.color}`}>
                                            <StatusIcon className="w-3 h-3" />
                                            {config.label}
                                        </Badge>
                                        {req.response_note && (
                                            <p className="text-xs text-muted-foreground mt-1 italic">Notiz: {req.response_note}</p>
                                        )}
                                    </div>
                                    {req.status === 'ausstehend' && (
                                        <Button variant="ghost" size="sm" className="text-status-danger hover:bg-status-danger/10 shrink-0"
                                            onClick={() => deleteMutation.mutate(req.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Wunschtag eintragen</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Datum *</Label>
                                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Bis (optional)</Label>
                                <Input type="date" value={formData.end_date} min={formData.date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Gewünschte Schicht (optional)</Label>
                            <Select value={formData.shift_type} onValueChange={v => setFormData({ ...formData, shift_type: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Schicht auswählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {shiftTypes.map(st => (
                                        <SelectItem key={st.id} value={st.name}>
                                            {st.name}{st.start_time && st.end_time ? ` (${st.start_time}–${st.end_time})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Anmerkung (optional)</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="z.B. lieber Abendschicht, kann auch länger bleiben..."
                                rows={2}
                            />
                        </div>
                        <div className="flex gap-2 pt-1">
                            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Abbrechen</Button>
                            <Button type="submit" className="flex-1 bg-status-warn/70 hover:bg-status-warn/70" disabled={createMutation.isPending}>
                                Eintragen
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}