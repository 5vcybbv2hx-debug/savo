import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Users, Settings, Tag } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export default function ShiftRequirementsManager({ open: extOpen, onOpenChange: extOnOpenChange, hideTrigger }) {
    const queryClient = useQueryClient();
    const [intModalOpen, setIntModalOpen] = useState(false);
    const modalOpen = extOpen !== undefined ? extOpen : intModalOpen;
    const setModalOpen = (v) => { if (extOnOpenChange) extOnOpenChange(v); setIntModalOpen(v); };
    const [editingReq, setEditingReq] = useState(null);
    const [typesModalOpen, setTypesModalOpen] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [formData, setFormData] = useState({
        day_of_week: 'Montag',
        shift_type: '',
        required_employees: 2,
        notes: ''
    });
    const [typeFormData, setTypeFormData] = useState({
        name: '',
        start_time: '',
        end_time: '',
        order: 0
    });

    const getColorForOrder = (order, totalTypes) => {
        // Grün (120°) nach Rot (0°) in HSL
        const hue = 120 - (order / Math.max(totalTypes - 1, 1)) * 120;
        return `hsl(${hue}, 70%, 50%)`;
    };

    const { data: requirements = [] } = useQuery({
        queryKey: ['shift-requirements'],
        queryFn: () => base44.entities.ShiftRequirement.list()
    });

    const { data: shiftTypes = [] } = useQuery({
        queryKey: ['shift-types'],
        queryFn: () => base44.entities.ShiftType.filter({ is_active: true }, 'order')
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.ShiftRequirement.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['shift-requirements']);
            closeModal();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.ShiftRequirement.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['shift-requirements']);
            closeModal();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.ShiftRequirement.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['shift-requirements']);
        }
    });

    const createTypeMutation = useMutation({
        mutationFn: (data) => base44.entities.ShiftType.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['shift-types']);
            closeTypeModal();
        }
    });

    const updateTypeMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.ShiftType.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['shift-types']);
            closeTypeModal();
        }
    });

    const deleteTypeMutation = useMutation({
        mutationFn: (id) => base44.entities.ShiftType.update(id, { is_active: false }),
        onSuccess: () => {
            queryClient.invalidateQueries(['shift-types']);
        }
    });

    const openModal = (req = null, dayOfWeek = null) => {
        if (req) {
            setEditingReq(req);
            setFormData({
                day_of_week: req.day_of_week,
                shift_type: req.shift_type || '',
                required_employees: req.required_employees,
                notes: req.notes || ''
            });
        } else {
            setEditingReq(null);
            setFormData({
                day_of_week: dayOfWeek || 'Montag',
                shift_type: '',
                required_employees: 2,
                notes: ''
            });
        }
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingReq(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingReq) {
            updateMutation.mutate({ id: editingReq.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (id) => {
        if (confirm('Anforderung wirklich löschen?')) {
            deleteMutation.mutate(id);
        }
    };

    const openTypeModal = (type = null) => {
        if (type) {
            setEditingType(type);
            setTypeFormData({
                name: type.name,
                start_time: type.start_time || '',
                end_time: type.end_time || '',
                order: type.order || 0
            });
        } else {
            setEditingType(null);
            setTypeFormData({
                name: '',
                start_time: '',
                end_time: '',
                order: shiftTypes.length
            });
        }
        setTypesModalOpen(true);
    };

    const closeTypeModal = () => {
        setTypesModalOpen(false);
        setEditingType(null);
    };

    const handleTypeSubmit = (e) => {
        e.preventDefault();
        if (editingType) {
            updateTypeMutation.mutate({ id: editingType.id, data: typeFormData });
        } else {
            createTypeMutation.mutate(typeFormData);
        }
    };

    const handleTypeDelete = (id) => {
        if (confirm('Schichtart wirklich löschen?')) {
            deleteTypeMutation.mutate(id);
        }
    };

    const groupedRequirements = WEEKDAYS.map(day => ({
        day,
        requirements: requirements.filter(r => r.day_of_week === day)
    }));

    return (
        <>
            {!hideTrigger && (
                <Button 
                    variant="outline" 
                    onClick={() => {
                        setEditingReq(null);
                        setModalOpen(true);
                    }}
                    className="border-slate-600 hover:bg-slate-700 text-slate-300"
                >
                    <Users className="w-4 h-4 mr-2" />
                    Soll-Besetzung
                </Button>
            )}

            <Dialog open={modalOpen} onOpenChange={(open) => {
                setModalOpen(open);
                if (!open) {
                    setEditingReq(null);
                }
            }}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle>Soll-Besetzung pro Schicht</DialogTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setModalOpen(false);
                                    setTimeout(() => openTypeModal(), 100);
                                }}
                                className="text-xs"
                            >
                                <Tag className="w-3 h-3 mr-1" />
                                Schichtarten
                            </Button>
                        </div>
                    </DialogHeader>

                    {!editingReq ? (
                        <div className="space-y-4 mt-4">
                            {groupedRequirements.map(({ day, requirements: dayReqs }) => (
                                <Card key={day} className="p-4 bg-slate-50">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-slate-800">{day}</h4>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openModal(null, day)}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    {dayReqs.length > 0 ? (
                                        <div className="space-y-2">
                                            {dayReqs.map(req => (
                                                <div key={req.id} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                                                    <div className="flex items-center gap-3">
                                                        <Users className="w-4 h-4 text-blue-500" />
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-800">
                                                                {req.shift_type || 'Allgemein'}: {req.required_employees} MA
                                                            </p>
                                                            {req.notes && (
                                                                <p className="text-xs text-slate-500">{req.notes}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openModal(req)}
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-500"
                                                            onClick={() => handleDelete(req.id)}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500">Keine Anforderungen</p>
                                    )}
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Wochentag</Label>
                                <Select value={formData.day_of_week} onValueChange={(v) => setFormData({ ...formData, day_of_week: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {WEEKDAYS.map(day => (
                                            <SelectItem key={day} value={day}>{day}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Schichttyp (optional)</Label>
                                <Select value={formData.shift_type || ""} onValueChange={(v) => setFormData({ ...formData, shift_type: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Alle Schichten" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={null}>Alle Schichten</SelectItem>
                                        {shiftTypes.map(type => (
                                            <SelectItem key={type.id} value={type.name}>
                                                <div className="flex items-center gap-2">
                                                    <div 
                                                        className="w-3 h-3 rounded"
                                                        style={{ backgroundColor: getColorForOrder(type.order || 0, shiftTypes.length) }}
                                                    />
                                                    {type.name}
                                                    {type.start_time && ` (${type.start_time}${type.end_time ? ` - ${type.end_time}` : ''})`}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Benötigte Mitarbeiter *</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={formData.required_employees}
                                    onChange={(e) => setFormData({ ...formData, required_employees: parseInt(e.target.value) })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Notizen</Label>
                                <Input
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="z.B. Stoßzeiten, Events..."
                                />
                            </div>

                            <div className="flex gap-2 pt-4">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={closeModal}
                                    className="flex-1"
                                >
                                    Abbrechen
                                </Button>
                                <Button 
                                    type="submit"
                                    className="flex-1 bg-amber-600 hover:bg-amber-700"
                                >
                                    Speichern
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Schichtarten Modal */}
            <Dialog open={typesModalOpen} onOpenChange={(open) => {
                setTypesModalOpen(open);
                if (!open) {
                    setEditingType(null);
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Schichtarten verwalten</DialogTitle>
                    </DialogHeader>

                    {!editingType ? (
                        <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                                {shiftTypes.map(type => (
                                    <div key={type.id} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="w-4 h-4 rounded"
                                                style={{ backgroundColor: getColorForOrder(type.order || 0, shiftTypes.length) }}
                                            />
                                            <div>
                                                <span className="font-medium text-slate-800">{type.name}</span>
                                                {type.start_time && (
                                                    <p className="text-xs text-slate-500">
                                                        {type.start_time}{type.end_time && ` - ${type.end_time}`}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openTypeModal(type)}
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500"
                                                onClick={() => handleTypeDelete(type.id)}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Button
                                onClick={() => openTypeModal()}
                                className="w-full bg-amber-600 hover:bg-amber-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Neue Schichtart
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleTypeSubmit} className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Name *</Label>
                                <Input
                                    value={typeFormData.name}
                                    onChange={(e) => setTypeFormData({ ...typeFormData, name: e.target.value })}
                                    placeholder="z.B. Frühschicht"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Startzeit</Label>
                                    <Input
                                        type="time"
                                        value={typeFormData.start_time}
                                        onChange={(e) => setTypeFormData({ ...typeFormData, start_time: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Endzeit</Label>
                                    <Input
                                        type="time"
                                        value={typeFormData.end_time}
                                        onChange={(e) => setTypeFormData({ ...typeFormData, end_time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Sortierung (Farbe: Grün → Rot)</Label>
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="number"
                                        value={typeFormData.order}
                                        onChange={(e) => setTypeFormData({ ...typeFormData, order: parseInt(e.target.value) || 0 })}
                                        className="flex-1"
                                    />
                                    <div 
                                        className="w-8 h-8 rounded border border-slate-300"
                                        style={{ backgroundColor: getColorForOrder(typeFormData.order, shiftTypes.length + 1) }}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={closeTypeModal}
                                    className="flex-1"
                                >
                                    Abbrechen
                                </Button>
                                <Button 
                                    type="submit"
                                    className="flex-1 bg-amber-600 hover:bg-amber-700"
                                >
                                    Speichern
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}