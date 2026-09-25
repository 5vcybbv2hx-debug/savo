import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function JobEquipmentTab({ job }) {
    const qc = useQueryClient();
    const [newItem, setNewItem] = useState('');
    const [newQty, setNewQty] = useState(1);

    const { data: items = [] } = useQuery({
        queryKey: ['external-job-equipment', job.id],
        queryFn: () => base44.entities.ExternalJobEquipment.filter({ job_id: job.id }, '-created_date', 200),
        staleTime: STALE.SHORT,
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ['external-job-equipment', job.id] });

    const addItem = useMutation({
        mutationFn: () => base44.entities.ExternalJobEquipment.create({
            job_id: job.id,
            item_name: newItem.trim(),
            quantity: Number(newQty) || 1,
            is_checked: false,
            notes: '',
        }),
        onSuccess: () => { invalidate(); setNewItem(''); setNewQty(1); },
        onError: e => toast.error('Hinzufügen fehlgeschlagen: ' + e.message),
    });
    const updateItem = useMutation({
        mutationFn: ({ id, data }) => base44.entities.ExternalJobEquipment.update(id, data),
        onSuccess: invalidate,
        onError: e => toast.error('Speichern fehlgeschlagen: ' + e.message),
    });
    const removeItem = useMutation({
        mutationFn: (id) => base44.entities.ExternalJobEquipment.delete(id),
        onSuccess: invalidate,
    });

    const checkedCount = items.filter(i => i.is_checked).length;

    return (
        <div className="space-y-3">
            <Label>Zubehör-Checkliste</Label>

            <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <Label className="text-[10px] text-muted-foreground">Bezeichnung</Label>
                        <Input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="z.B. Zapfanlage" className="h-8 text-sm" />
                    </div>
                    <div className="w-20">
                        <Label className="text-[10px] text-muted-foreground">Menge</Label>
                        <Input type="number" value={newQty} onChange={e => setNewQty(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <Button type="button" size="sm" className="h-8" disabled={!newItem.trim()} onClick={() => addItem.mutate()}>
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Noch keine Zubehör-Teile.</p>
            ) : (
                <div className="space-y-2">
                    {items.map(it => (
                        <div key={it.id} className={cn('rounded-xl border bg-card p-3 flex items-center gap-3', it.is_checked ? 'border-emerald-500/30' : 'border-border/50')}>
                            <button
                                onClick={() => updateItem.mutate({ id: it.id, data: { is_checked: !it.is_checked } })}
                                className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors',
                                    it.is_checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border text-transparent hover:border-emerald-500/50')}
                            >
                                <Check className="w-4 h-4" />
                            </button>
                            <div className="flex-1 min-w-0">
                                <p className={cn('text-sm font-medium truncate', it.is_checked ? 'text-muted-foreground line-through' : 'text-foreground')}>{it.item_name}</p>
                                <Input type="number" value={it.quantity ?? ''} onChange={e => updateItem.mutate({ id: it.id, data: { quantity: Number(e.target.value) || 0 } })} className="h-6 text-[11px] w-20 mt-1" />
                            </div>
                            <button onClick={() => removeItem.mutate(it.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Abgehakt</span>
                <span className="font-bold text-foreground">{checkedCount} / {items.length}</span>
            </div>
        </div>
    );
}