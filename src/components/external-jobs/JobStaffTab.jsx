import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

export default function JobStaffTab({ job }) {
    const qc = useQueryClient();
    const [adding, setAdding] = useState(false);
    const [selEmp, setSelEmp] = useState('');

    const { data: staff = [] } = useQuery({
        queryKey: ['external-job-staff', job.id],
        queryFn: () => base44.entities.ExternalJobStaff.filter({ job_id: job.id }, '-created_date', 200),
        staleTime: STALE.SHORT,
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees-for-job-staff'],
        queryFn: () => base44.entities.Employee.list('name', 200),
        staleTime: STALE.LONG,
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ['external-job-staff', job.id] });

    const addStaff = useMutation({
        mutationFn: () => {
            const emp = employees.find(e => e.id === selEmp);
            if (!emp) throw new Error('Mitarbeiter wählen');
            return base44.entities.ExternalJobStaff.create({
                job_id: job.id,
                employee_id: emp.id,
                employee_name: emp.name,
                role_on_event: '',
                planned_arrival: '',
                planned_departure: '',
                actual_hours: null,
                notes: '',
            });
        },
        onSuccess: () => { invalidate(); setAdding(false); setSelEmp(''); },
        onError: e => toast.error(e.message),
    });
    const updateStaff = useMutation({
        mutationFn: ({ id, data }) => base44.entities.ExternalJobStaff.update(id, data),
        onSuccess: invalidate,
        onError: e => toast.error('Speichern fehlgeschlagen: ' + e.message),
    });
    const removeStaff = useMutation({
        mutationFn: (id) => base44.entities.ExternalJobStaff.delete(id),
        onSuccess: invalidate,
    });

    const availableEmployees = employees.filter(e => !staff.some(s => s.employee_id === e.id) && e.is_active !== false);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label>Personal</Label>
                {!adding && (
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setAdding(true)} disabled={availableEmployees.length === 0}>
                        <Plus className="w-3.5 h-3.5" /> Zuordnen
                    </Button>
                )}
            </div>

            {adding && (
                <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
                    <Select value={selEmp} onValueChange={setSelEmp}>
                        <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen" /></SelectTrigger>
                        <SelectContent>
                            {availableEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                        <Button type="button" size="sm" className="h-8 flex-1" disabled={!selEmp} onClick={() => addStaff.mutate()}>Hinzufügen</Button>
                        <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => { setAdding(false); setSelEmp(''); }}>Abbrechen</Button>
                    </div>
                </div>
            )}

            {staff.length === 0 && !adding ? (
                <p className="text-sm text-muted-foreground text-center py-8">Kein Personal zugeordnet.</p>
            ) : (
                <div className="space-y-2">
                    {staff.map(s => (
                        <div key={s.id} className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-foreground truncate">{s.employee_name}</span>
                                <button onClick={() => removeStaff.mutate(s.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label className="text-[10px] text-muted-foreground">Rolle beim Einsatz</Label>
                                    <Input value={s.role_on_event || ''} onChange={e => updateStaff.mutate({ id: s.id, data: { role_on_event: e.target.value } })} placeholder="Barkeeper" className="h-8 text-sm" />
                                </div>
                                <div>
                                    <Label className="text-[10px] text-muted-foreground">Tatsächl. Std</Label>
                                    <Input type="number" step="0.25" value={s.actual_hours ?? ''} onChange={e => updateStaff.mutate({ id: s.id, data: { actual_hours: e.target.value ? Number(e.target.value) : null } })} className="h-8 text-sm" />
                                </div>
                                <div>
                                    <Label className="text-[10px] text-muted-foreground">Ankunft</Label>
                                    <Input type="time" value={s.planned_arrival || ''} onChange={e => updateStaff.mutate({ id: s.id, data: { planned_arrival: e.target.value } })} className="h-8 text-sm" />
                                </div>
                                <div>
                                    <Label className="text-[10px] text-muted-foreground">Ende</Label>
                                    <Input type="time" value={s.planned_departure || ''} onChange={e => updateStaff.mutate({ id: s.id, data: { planned_departure: e.target.value } })} className="h-8 text-sm" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}