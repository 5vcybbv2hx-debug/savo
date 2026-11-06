import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, EyeOff, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from '@/components/auth/usePermissions';
import SpecialDayRules from '@/components/business-calendar/SpecialDayRules';

const WEEKDAYS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];

export default function TaskManager({ task, areas }) {
    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: task.title,
        area: task.area,
        frequency: task.frequency,
        due_weekdays: task.due_weekdays || [],
        special_day_rules: task.special_day_rules || {}
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.CleaningTask.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['cleaning']);
            setModalOpen(false);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.CleaningTask.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['cleaning']);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        updateMutation.mutate({ id: task.id, data: formData });
    };

    const handleDelete = () => {
        if (confirm('Aufgabe wirklich löschen?')) {
            deleteMutation.mutate(task.id);
        }
    };

    const handleToggleActive = () => {
        const newStatus = !task.is_active;
        if (confirm(`Aufgabe wirklich ${newStatus ? 'aktivieren' : 'deaktivieren'}?`)) {
            updateMutation.mutate({ 
                id: task.id, 
                data: { is_active: newStatus } 
            });
        }
    };

    // Nur Manager/Admins können bearbeiten
    if (!permissions.canEditCleaning || !permissions.isManager) {
        return null;
    }

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-muted-foreground"
                onClick={() => setModalOpen(true)}
            >
                <Pencil className="w-4 h-4" />
            </Button>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Aufgabe bearbeiten</DialogTitle>
                    </DialogHeader>
                    
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label>Aufgabe</Label>
                            <Input
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Bereich</Label>
                                <Select value={formData.area} onValueChange={(v) => setFormData({ ...formData, area: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {areas.map(area => (
                                            <SelectItem key={area.id} value={area.name}>
                                                <div className="flex items-center gap-2">
                                                    <div 
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: area.color }}
                                                    />
                                                    {area.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Häufigkeit</Label>
                                <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="täglich">Täglich</SelectItem>
                                        <SelectItem value="am Wochenende">Am Wochenende (Fr+Sa)</SelectItem>
                                        <SelectItem value="wöchentlich">Wöchentlich</SelectItem>
                                        <SelectItem value="alle zwei Wochen">Alle zwei Wochen</SelectItem>
                                        <SelectItem value="monatlich">Monatlich</SelectItem>
                                        <SelectItem value="an Sonderöffnungstagen">An Sonderöffnungstagen</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Wochentage einschränken */}
                        <div className="space-y-2">
                            <Label className="text-sm">Nur an bestimmten Tagen <span className="text-muted-foreground font-normal">(leer = immer)</span></Label>
                            <div className="flex flex-wrap gap-2">
                                {WEEKDAYS.map(day => {
                                    const selected = formData.due_weekdays.includes(day);
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => {
                                                const next = selected
                                                    ? formData.due_weekdays.filter(d => d !== day)
                                                    : [...formData.due_weekdays, day];
                                                setFormData({ ...formData, due_weekdays: next });
                                            }}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                                selected
                                                    ? 'bg-status-warn/70 text-foreground border-status-warn/70'
                                                    : 'bg-card text-muted-foreground border-border hover:border-status-warn/50'
                                            }`}
                                        >
                                            {day.slice(0, 2)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sonderregel-Erweiterung */}
                        <SpecialDayRules
                            rules={formData.special_day_rules}
                            onChange={(r) => setFormData({ ...formData, special_day_rules: r })}
                        />

                        <div className="flex flex-col gap-3 pt-4">
                            <div className="flex gap-2">
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    className={task.is_active === false ? "text-status-ok hover:text-status-ok hover:bg-status-ok/15" : "text-status-warn hover:text-status-warn hover:bg-status-warn/15"}
                                    onClick={handleToggleActive}
                                >
                                    {task.is_active === false ? (
                                        <>
                                            <Eye className="w-4 h-4 mr-2" />
                                            Aktivieren
                                        </>
                                    ) : (
                                        <>
                                            <EyeOff className="w-4 h-4 mr-2" />
                                            Deaktivieren
                                        </>
                                    )}
                                </Button>
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    className="text-status-danger hover:text-status-danger hover:bg-status-danger/15"
                                    onClick={handleDelete}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Löschen
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">
                                    Abbrechen
                                </Button>
                                <Button type="submit" className="flex-1 bg-status-warn/70 hover:bg-status-warn/70">
                                    Speichern
                                </Button>
                            </div>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}