import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Settings, GripVertical } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const DEFAULT_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', 
    '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'
];

export default function AreasManager({ trigger, open: openProp, onOpenChange }) {
    const queryClient = useQueryClient();
    const isControlled = openProp !== undefined;
    const [internalOpen, setInternalOpen] = useState(false);
    const modalOpen = isControlled ? openProp : internalOpen;
    const setModalOpen = isControlled ? onOpenChange : setInternalOpen;
    const [editingArea, setEditingArea] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        color: DEFAULT_COLORS[0],
        order: 0
    });

    const { data: areas = [] } = useQuery({
        queryKey: ['cleaning-areas'],
        queryFn: () => base44.entities.CleaningArea.list('order')
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.CleaningArea.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['cleaning-areas']);
            closeModal();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.CleaningArea.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['cleaning-areas']);
            closeModal();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.CleaningArea.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['cleaning-areas']);
        }
    });

    const openModal = (area = null) => {
        if (area) {
            setEditingArea(area);
            setFormData({
                name: area.name,
                color: area.color || DEFAULT_COLORS[0],
                order: area.order || 0
            });
        } else {
            setEditingArea(null);
            setFormData({
                name: '',
                color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
                order: areas.length
            });
        }
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingArea(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingArea) {
            updateMutation.mutate({ id: editingArea.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (id) => {
        if (confirm('Bereich wirklich löschen?')) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <>
            {!isControlled && (
                <Button variant="outline" onClick={() => setModalOpen(true)} className="gap-2">
                    <Settings className="w-4 h-4" />
                    Bereiche verwalten
                </Button>
            )}

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Bereiche verwalten</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        {/* Bereiche Liste */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-foreground">Vorhandene Bereiche</h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {areas.length === 0 ? (
                                    <p className="text-sm text-foreground0 text-center py-4">Noch keine Bereiche vorhanden</p>
                                ) : (
                                    areas.map((area) => (
                                        <div 
                                            key={area.id}
                                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                                        >
                                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                                            <div 
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: area.color }}
                                            />
                                            <span className="flex-1 font-medium text-slate-800">
                                                {area.name}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openModal(area)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-600"
                                                onClick={() => handleDelete(area.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Neuer Bereich Formular */}
                        <div className="space-y-3 pt-4 border-t border-slate-200">
                            <h3 className="text-sm font-semibold text-foreground">
                                {editingArea ? 'Bereich bearbeiten' : 'Neuer Bereich'}
                            </h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="z.B. Theke"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Farbe</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {DEFAULT_COLORS.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, color })}
                                                className={cn(
                                                    "w-8 h-8 rounded-full transition-transform",
                                                    formData.color === color && "ring-2 ring-offset-2 ring-slate-400 scale-110"
                                                )}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    {editingArea && (
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            onClick={closeModal}
                                            className="flex-1"
                                        >
                                            Abbrechen
                                        </Button>
                                    )}
                                    <Button 
                                        type="submit"
                                        className="flex-1 bg-amber-600 hover:bg-amber-700"
                                    >
                                        {editingArea ? 'Speichern' : 'Hinzufügen'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}