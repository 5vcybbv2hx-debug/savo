import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function ShiftTypeManager() {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', start_time: '06:00', end_time: '14:00', order: 0, is_active: true, wish_capacity: '' });

    const { data: types = [] } = useQuery({
        queryKey: ['shift-types'],
        queryFn: () => base44.entities.ShiftType.list(),
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.ShiftType.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shift-types'] });
            setOpen(false);
            setForm({ name: '', start_time: '06:00', end_time: '14:00', order: 0, is_active: true, wish_capacity: '' });
            toast.success('Schichttyp erstellt');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.ShiftType.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shift-types'] });
            setOpen(false);
            setEditing(null);
            setForm({ name: '', start_time: '06:00', end_time: '14:00', order: 0, is_active: true, wish_capacity: '' });
            toast.success('Schichttyp aktualisiert');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.ShiftType.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shift-types'] });
            toast.success('Schichttyp gelöscht');
        }
    });

    const handleOpen = (type = null) => {
        if (type) {
            setEditing(type);
            setForm({
                name: type.name,
                start_time: type.start_time || '06:00',
                end_time: type.end_time || '14:00',
                order: type.order || 0,
                is_active: type.is_active !== false,
                wish_capacity: type.wish_capacity ?? '',
            });
        } else {
            setEditing(null);
            setForm({ name: '', start_time: '06:00', end_time: '14:00', order: 0, is_active: true, wish_capacity: '' });
        }
        setOpen(true);
    };

    const handleSave = () => {
        if (!form.name.trim()) {
            toast.error('Name erforderlich');
            return;
        }
        // Leeres Feld → null (= Standardkapazität 2)
        const payload = {
            ...form,
            wish_capacity: form.wish_capacity === '' || form.wish_capacity === null ? null : Number(form.wish_capacity),
        };
        if (editing) {
            updateMutation.mutate({ id: editing.id, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    return (
        <>
            <Button variant="outline" onClick={() => handleOpen()} className="gap-2">
                <Clock className="w-4 h-4" />
                Schichttypen
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Schichttyp bearbeiten' : 'Neuer Schichttyp'}</DialogTitle>
                    </DialogHeader>

                    {/* List */}
                    <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
                        {types.map((t) => (
                            <Card key={t.id} className="p-3 flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="font-semibold text-foreground">{t.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{t.start_time || '—'} – {t.end_time || '—'}</span>
                                        {!t.is_active && <Badge variant="secondary" className="text-[10px]">Inaktiv</Badge>}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleOpen(t)} className="p-2 hover:bg-accent rounded-lg transition-colors">
                                        <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                    </button>
                                    <button onClick={() => { if (confirm('Löschen?')) deleteMutation.mutate(t.id); }} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-400" />
                                    </button>
                                </div>
                            </Card>
                        ))}
                        {types.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Noch keine Schichttypen</p>}
                    </div>

                    {/* Form */}
                    {open && (
                        <div className="space-y-4 pt-4 border-t border-border">
                            <div>
                                <Label className="text-sm">Name</Label>
                                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Frühschicht" className="mt-1.5" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-sm">Von</Label>
                                    <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="mt-1.5" />
                                </div>
                                <div>
                                    <Label className="text-sm">Bis</Label>
                                    <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="mt-1.5" />
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm">Wunsch-Plätze pro Tag</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={form.wish_capacity}
                                    onChange={(e) => setForm({ ...form, wish_capacity: e.target.value })}
                                    placeholder="2"
                                    className="mt-1.5"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Leer = 2 Plätze</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded border-border" />
                                <Label htmlFor="active" className="text-sm cursor-pointer">Aktiv</Label>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Abbrechen</Button>
                                <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 bg-amber-600 hover:bg-amber-700">
                                    {editing ? 'Speichern' : 'Erstellen'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}