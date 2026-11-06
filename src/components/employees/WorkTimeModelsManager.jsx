import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Pencil, Trash2, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function WorkTimeModelsManager() {
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedModel, setSelectedModel] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        hours_per_week: '',
        min_hourly_rate: '12.41',
        default_hourly_rate: '',
        max_monthly_earnings: '',
        vacation_days: '',
        notes: '',
        is_active: true
    });

    const { data: models = [] } = useQuery({
        queryKey: ['work-time-models'],
        queryFn: () => base44.entities.WorkTimeModel.list('name')
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.WorkTimeModel.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['work-time-models']);
            closeModal();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.WorkTimeModel.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['work-time-models']);
            closeModal();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.WorkTimeModel.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['work-time-models']);
        }
    });

    const openModal = (model = null) => {
        if (model) {
            setSelectedModel(model);
            setFormData({
                name: model.name,
                hours_per_week: model.hours_per_week || '',
                min_hourly_rate: model.min_hourly_rate || '12.41',
                default_hourly_rate: model.default_hourly_rate || '',
                max_monthly_earnings: model.max_monthly_earnings || '',
                vacation_days: model.vacation_days || '',
                notes: model.notes || '',
                is_active: model.is_active !== false
            });
        } else {
            setSelectedModel(null);
            setFormData({
                name: '',
                hours_per_week: '',
                min_hourly_rate: '12.41',
                default_hourly_rate: '',
                max_monthly_earnings: '',
                vacation_days: '',
                notes: '',
                is_active: true
            });
        }
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedModel(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const cleanedData = {
            ...formData,
            hours_per_week: formData.hours_per_week ? parseFloat(formData.hours_per_week) : undefined,
            min_hourly_rate: formData.min_hourly_rate ? parseFloat(formData.min_hourly_rate) : undefined,
            default_hourly_rate: parseFloat(formData.default_hourly_rate),
            max_monthly_earnings: formData.max_monthly_earnings ? parseFloat(formData.max_monthly_earnings) : undefined,
            vacation_days: formData.vacation_days ? parseInt(formData.vacation_days) : undefined
        };
        
        if (selectedModel) {
            updateMutation.mutate({ id: selectedModel.id, data: cleanedData });
        } else {
            createMutation.mutate(cleanedData);
        }
    };

    return (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-primary/70 text-primary hover:bg-primary/15">
                    <Clock className="w-4 h-4 mr-2" />
                    Arbeitszeitmodelle
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        Arbeitszeitmodelle verwalten
                    </DialogTitle>
                </DialogHeader>

                <Alert className="bg-primary/15 border-primary/25">
                    <Info className="w-4 h-4 text-primary" />
                    <AlertDescription className="text-primary text-sm">
                        Definiere Standard-Arbeitszeitmodelle mit Mindestlohn und empfohlenen Stundensätzen. 
                        Diese können bei der Mitarbeiteranlage automatisch übernommen werden.
                    </AlertDescription>
                </Alert>

                <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Verfügbare Modelle</h3>
                    <Button onClick={() => openModal()} size="sm" className="bg-primary/70 hover:bg-primary/70">
                        <Plus className="w-4 h-4 mr-1" />
                        Neues Modell
                    </Button>
                </div>

                <div className="grid gap-3">
                    {models.filter(m => m.is_active !== false).map(model => (
                        <Card key={model.id} className="p-4 bg-card">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h4 className="font-semibold text-muted-foreground">{model.name}</h4>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                                        {model.hours_per_week && (
                                            <p>Wochenstunden: {model.hours_per_week}</p>
                                        )}
                                        {model.min_hourly_rate && (
                                            <p>Mindestlohn: {model.min_hourly_rate.toFixed(2)} €</p>
                                        )}
                                        <p>Standard: {model.default_hourly_rate.toFixed(2)} €/Std.</p>
                                        {model.max_monthly_earnings && (
                                            <p>Max. monatlich: {model.max_monthly_earnings.toFixed(2)} €</p>
                                        )}
                                        {model.vacation_days && (
                                            <p>Urlaubstage: {model.vacation_days}</p>
                                        )}
                                    </div>
                                    {model.notes && (
                                        <p className="text-xs text-muted-foreground mt-2">{model.notes}</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openModal(model)}
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            if (confirm('Arbeitszeitmodell wirklich löschen?')) {
                                                deleteMutation.mutate(model.id);
                                            }
                                        }}
                                        className="text-status-danger hover:text-status-danger"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                {selectedModel !== null && (
                    <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
                        <h3 className="font-semibold">
                            {selectedModel ? 'Modell bearbeiten' : 'Neues Modell erstellen'}
                        </h3>

                        <div className="space-y-2">
                            <Label>Bezeichnung *</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                placeholder="z.B. Vollzeit, Minijob"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Wochenstunden</Label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    value={formData.hours_per_week}
                                    onChange={(e) => setFormData({...formData, hours_per_week: e.target.value})}
                                    placeholder="z.B. 40"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Urlaubstage/Jahr</Label>
                                <Input
                                    type="number"
                                    value={formData.vacation_days}
                                    onChange={(e) => setFormData({...formData, vacation_days: e.target.value})}
                                    placeholder="z.B. 30"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Mindestlohn (€/Std.) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.min_hourly_rate}
                                    onChange={(e) => setFormData({...formData, min_hourly_rate: e.target.value})}
                                    required
                                />
                                <p className="text-xs text-muted-foreground">Gesetzlicher Mindestlohn 2025: 12.41 €</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Standard-Stundensatz (€/Std.) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.default_hourly_rate}
                                    onChange={(e) => setFormData({...formData, default_hourly_rate: e.target.value})}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Max. monatlicher Verdienst (€)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.max_monthly_earnings}
                                onChange={(e) => setFormData({...formData, max_monthly_earnings: e.target.value})}
                                placeholder="z.B. 538 für Minijobs"
                            />
                            <p className="text-xs text-muted-foreground">Nur für Minijobs relevant</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Hinweise</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                placeholder="Zusätzliche Informationen zum Arbeitszeitmodell"
                                className="h-20"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={closeModal} className="flex-1">
                                Abbrechen
                            </Button>
                            <Button type="submit" className="flex-1 bg-primary/70 hover:bg-primary/70">
                                {selectedModel ? 'Speichern' : 'Erstellen'}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}