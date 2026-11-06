import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, Calendar } from 'lucide-react';

export default function TableModal({ table, open, onClose, reservation }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(!table);

    const { data: rooms = [] } = useQuery({
        queryKey: ['rooms'],
        queryFn: () => base44.entities.Room.filter({ is_active: true })
    });

    const [formData, setFormData] = useState({
        name: table?.name || '',
        room: table?.room || '',
        table_number: table?.table_number || '',
        capacity: table?.capacity || '',
        section: table?.section || '',
        shape: table?.shape || 'square',
        notes: table?.notes || ''
    });

    const saveMutation = useMutation({
        mutationFn: (data) => 
            table 
                ? base44.entities.Table.update(table.id, data)
                : base44.entities.Table.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tables'] });
            onClose();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: () => base44.entities.Table.delete(table.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tables'] });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {table ? (table.name ? `${table.name}` : `Tisch ${table.table_number}`) : 'Neuer Tisch'}
                    </DialogTitle>
                </DialogHeader>

                {!isEditing && table ? (
                    <div className="space-y-4">
                        {table.name && (
                            <div>
                                <p className="text-sm text-muted-foreground">Tischname</p>
                                <p className="text-lg font-semibold text-foreground">{table.name}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-sm text-muted-foreground">Raum</p>
                            <p className="text-lg font-semibold text-foreground">{table.room}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Tischnummer</p>
                            <p className="text-lg font-semibold text-foreground">{table.table_number}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Kapazität</p>
                            <p className="text-lg font-semibold text-foreground">{table.capacity} Plätze</p>
                        </div>
                        {table.section && (
                            <div>
                                <p className="text-sm text-muted-foreground">Bereich</p>
                                <p className="text-lg text-foreground">{table.section}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-sm text-muted-foreground">Form</p>
                            <p className="text-lg text-foreground">
                                {table.shape === 'square' ? 'Quadratisch' : 
                                 table.shape === 'rectangle_horizontal' ? 'Rechteckig (Quer)' :
                                 table.shape === 'rectangle_vertical' ? 'Rechteckig (Längs)' :
                                 table.shape === 'round' ? 'Rund' : 'Standard'}
                            </p>
                        </div>
                        {table.notes && (
                            <div>
                                <p className="text-sm text-muted-foreground">Notizen</p>
                                <p className="text-foreground">{table.notes}</p>
                            </div>
                        )}

                        {reservation && (
                            <div className="bg-status-warn/10 border border-status-warn/30 rounded-lg p-4 mt-4">
                                <p className="text-sm font-semibold text-status-warn mb-2">Heutige Reservierung</p>
                                <p className="text-sm text-status-warn">
                                    <strong>{reservation.customer_name}</strong> • {reservation.guests} Personen<br/>
                                    {reservation.time} Uhr
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2 pt-4">
                            <Button
                                onClick={() => setIsEditing(true)}
                                variant="outline"
                                className="flex-1"
                            >
                                Bearbeiten
                            </Button>
                            <Button
                                onClick={() => deleteMutation.mutate()}
                                variant="outline"
                                className="border-destructive text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            {reservation && (
                                <Button
                                    onClick={() => navigate(createPageUrl('Reservations'))}
                                    className="flex-1 bg-primary hover:bg-primary/90"
                                >
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Reservierung
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-foreground">Tischname (z.B. 'Hochtisch Fenster')</label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                placeholder="optional, z.B. Hochtisch Fenster"
                                className="mt-1 bg-background border-border"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground">Raum</label>
                            <Select
                                value={formData.room}
                                onValueChange={(value) => setFormData({...formData, room: value})}
                                required
                            >
                                <SelectTrigger className="mt-1 bg-background border-border">
                                    <SelectValue placeholder="Raum auswählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {rooms.map(room => (
                                        <SelectItem key={room.id} value={room.name}>
                                            {room.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground">Tischnummer</label>
                            <Input
                                value={formData.table_number}
                                onChange={(e) => setFormData({...formData, table_number: e.target.value})}
                                placeholder="z.B. T1, T2, T3"
                                className="mt-1 bg-background border-border"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground">Kapazität (Personen)</label>
                            <Input
                                type="number"
                                value={formData.capacity}
                                onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value)})}
                                placeholder="z.B. 4"
                                className="mt-1 bg-background border-border"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground">Bereich (optional)</label>
                            <Input
                                value={formData.section}
                                onChange={(e) => setFormData({...formData, section: e.target.value})}
                                placeholder="z.B. Innen, Terrasse"
                                className="mt-1 bg-background border-border"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground">Form</label>
                            <Select value={formData.shape} onValueChange={(value) => setFormData({...formData, shape: value})}>
                                <SelectTrigger className="mt-1 bg-background border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="square">Quadratisch</SelectItem>
                                    <SelectItem value="rectangle_horizontal">Rechteckig (Quer)</SelectItem>
                                    <SelectItem value="rectangle_vertical">Rechteckig (Längs)</SelectItem>
                                    <SelectItem value="round">Rund</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground">Notizen (optional)</label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                placeholder="z.B. Fensterplatz, hohe Rücklehne"
                                className="mt-1 bg-background border-border h-20"
                            />
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button
                                type="button"
                                onClick={onClose}
                                variant="outline"
                                className="flex-1"
                            >
                                Abbrechen
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1 bg-primary hover:bg-primary/90"
                            >
                                Speichern
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}