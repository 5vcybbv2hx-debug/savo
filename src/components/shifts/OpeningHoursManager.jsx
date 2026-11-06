import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Pencil, Trash2, Calendar, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export default function OpeningHoursManager() {
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingHour, setEditingHour] = useState(null);
    const [activeTab, setActiveTab] = useState('regular');
    const [formData, setFormData] = useState({
        day_of_week: 'Montag',
        open_time: '18:00',
        close_time: '02:00',
        is_closed: false,
        is_special_day: false,
        special_date: '',
        special_name: '',
        notes: ''
    });

    const { data: openingHours = [] } = useQuery({
        queryKey: ['opening-hours'],
        queryFn: () => base44.entities.OpeningHours.list()
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.OpeningHours.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['opening-hours']);
            closeModal();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.OpeningHours.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['opening-hours']);
            closeModal();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.OpeningHours.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['opening-hours']);
        }
    });

    const regularHours = openingHours.filter(h => !h.is_special_day);
    const specialDays = openingHours.filter(h => h.is_special_day).sort((a, b) => 
        (a.special_date || '').localeCompare(b.special_date || '')
    );

    const openModal = (hour = null, isSpecial = false) => {
        if (hour) {
            setEditingHour(hour);
            setFormData({
                day_of_week: hour.day_of_week || 'Montag',
                open_time: hour.open_time || '18:00',
                close_time: hour.close_time || '02:00',
                is_closed: hour.is_closed || false,
                is_special_day: hour.is_special_day || false,
                special_date: hour.special_date || '',
                special_name: hour.special_name || '',
                notes: hour.notes || ''
            });
        } else {
            setFormData({
                day_of_week: 'Montag',
                open_time: '18:00',
                close_time: '02:00',
                is_closed: false,
                is_special_day: isSpecial,
                special_date: '',
                special_name: '',
                notes: ''
            });
            setEditingHour('new');
        }
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingHour(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingHour && editingHour !== 'new') {
            updateMutation.mutate({ id: editingHour.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (id) => {
        if (confirm('Eintrag wirklich löschen?')) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <>
            <Button 
                variant="outline" 
                onClick={() => setModalOpen(true)}
                className="border-slate-600 hover:bg-slate-700 text-slate-300"
            >
                <Clock className="w-4 h-4 mr-2" />
                Öffnungszeiten
            </Button>

            <Dialog open={modalOpen} onOpenChange={(open) => {
                setModalOpen(open);
                if (!open) {
                    setEditingHour(null);
                }
            }}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Öffnungszeiten verwalten</DialogTitle>
                    </DialogHeader>

                    {!editingHour ? (
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="regular">Regulär</TabsTrigger>
                                <TabsTrigger value="special">Sondertage</TabsTrigger>
                            </TabsList>

                            <TabsContent value="regular" className="space-y-2 mt-4">
                                {WEEKDAYS.map(day => {
                                    const dayHour = regularHours.find(h => h.day_of_week === day);
                                    return (
                                        <button
                                            key={day}
                                            onClick={() => dayHour ? openModal(dayHour) : openModal(null, false)}
                                            className="w-full p-4 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-all text-left group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <p className="font-semibold text-slate-800 mb-1">{day}</p>
                                                    {dayHour ? (
                                                        dayHour.is_closed ? (
                                                            <p className="text-sm text-red-500 font-medium">Geschlossen</p>
                                                        ) : (
                                                            <p className="text-sm text-slate-600 font-medium">
                                                                {dayHour.open_time} - {dayHour.close_time}
                                                            </p>
                                                        )
                                                    ) : (
                                                        <p className="text-sm text-slate-400">Nicht festgelegt - Klicken zum Hinzufügen</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {dayHour && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(dayHour.id);
                                                            }}
                                                            className="opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <Pencil className="w-4 h-4 text-slate-400" />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </TabsContent>

                            <TabsContent value="special" className="space-y-3 mt-4">
                                {specialDays.length > 0 && (
                                    <div className="space-y-2">
                                        {specialDays.map(special => (
                                            <button
                                                key={special.id}
                                                onClick={() => openModal(special)}
                                                className="w-full p-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all text-left group"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Calendar className="w-4 h-4 text-amber-600" />
                                                            <p className="font-semibold text-slate-800">
                                                                {special.special_name || 'Sonderöffnungstag'}
                                                            </p>
                                                        </div>
                                                        <p className="text-sm text-slate-700 mb-1">
                                                            {new Date(special.special_date).toLocaleDateString('de-DE', { 
                                                                weekday: 'long', 
                                                                day: 'numeric',
                                                                month: 'long',
                                                                year: 'numeric'
                                                            })}
                                                        </p>
                                                        {special.is_closed ? (
                                                            <p className="text-sm text-red-500 font-medium">Geschlossen</p>
                                                        ) : (
                                                            <p className="text-sm text-slate-600 font-medium">
                                                                {special.open_time} - {special.close_time}
                                                            </p>
                                                        )}
                                                        {special.notes && (
                                                            <p className="text-xs text-slate-500 mt-1 italic">{special.notes}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(special.id);
                                                            }}
                                                            className="opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                        <Pencil className="w-4 h-4 text-amber-600" />
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <Button 
                                    onClick={() => openModal(null, true)}
                                    className="w-full bg-amber-600 hover:bg-amber-700 h-12 text-base"
                                >
                                    <Plus className="w-5 h-5 mr-2" />
                                    Sonderöffnungstag hinzufügen
                                </Button>
                            </TabsContent>
                        </Tabs>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                            {formData.is_special_day ? (
                                <>
                                    <div className="space-y-2">
                                        <Label>Bezeichnung</Label>
                                        <Input
                                            value={formData.special_name}
                                            onChange={(e) => setFormData({ ...formData, special_name: e.target.value })}
                                            placeholder="z.B. Silvester, Feiertag"
                                            className="text-base"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Datum *</Label>
                                        <Input
                                            type="date"
                                            value={formData.special_date}
                                            onChange={(e) => setFormData({ ...formData, special_date: e.target.value })}
                                            required
                                            className="text-base"
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-2">
                                    <Label>Wochentag</Label>
                                    <Select value={formData.day_of_week} onValueChange={(v) => setFormData({ ...formData, day_of_week: v })}>
                                        <SelectTrigger className="text-base">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {WEEKDAYS.map(day => (
                                                <SelectItem key={day} value={day}>{day}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <Label className="text-base">Geschlossen</Label>
                                <Switch
                                    checked={formData.is_closed}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_closed: checked })}
                                />
                            </div>

                            {!formData.is_closed && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Öffnung</Label>
                                        <Input
                                            type="time"
                                            value={formData.open_time}
                                            onChange={(e) => setFormData({ ...formData, open_time: e.target.value })}
                                            className="text-base"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Schließung</Label>
                                        <Input
                                            type="time"
                                            value={formData.close_time}
                                            onChange={(e) => setFormData({ ...formData, close_time: e.target.value })}
                                            className="text-base"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Notizen</Label>
                                <Input
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Besondere Hinweise..."
                                    className="text-base"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
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
                                    {editingHour === 'new' ? 'Hinzufügen' : 'Speichern'}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}