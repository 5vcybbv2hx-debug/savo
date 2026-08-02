import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { haptics } from "@/components/utils/haptics";

export default function TimeEntryModal({ open, onClose, entry, currentEmployee, allEmployees, isManager, onSave }) {
    const [formData, setFormData] = useState({
        employee_id: '',
        employee_name: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '',
        end_time: '',
        break_minutes: 0,
        notes: '',
        status: 'entwurf'
    });

    useEffect(() => {
        if (entry) {
            setFormData({
                employee_id: entry.employee_id || '',
                employee_name: entry.employee_name || '',
                date: entry.date || format(new Date(), 'yyyy-MM-dd'),
                start_time: entry.start_time || '',
                end_time: entry.end_time || '',
                break_minutes: entry.break_minutes || 0,
                notes: entry.notes || '',
                status: entry.status || 'entwurf'
            });
        } else if (currentEmployee) {
            setFormData({
                employee_id: currentEmployee.id,
                employee_name: currentEmployee.name,
                date: format(new Date(), 'yyyy-MM-dd'),
                start_time: '',
                end_time: '',
                break_minutes: 0,
                notes: '',
                status: 'entwurf'
            });
        }
    }, [entry, currentEmployee, open]);

    const calculateLegalBreak = (startTime, endTime) => {
        if (!startTime || !endTime) return 0;
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (totalMinutes < 0) totalMinutes += 24 * 60;
        const workHours = totalMinutes / 60;
        if (workHours > 9) return 45;
        if (workHours > 6) return 30;
        return 0;
    };

    const calculateHours = () => {
        if (!formData.start_time || !formData.end_time) return 0;
        
        const [startH, startM] = formData.start_time.split(':').map(Number);
        const [endH, endM] = formData.end_time.split(':').map(Number);
        
        let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (totalMinutes < 0) totalMinutes += 24 * 60; // Overnight shift
        
        totalMinutes -= formData.break_minutes || 0;
        
        return Math.max(0, totalMinutes / 60);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const totalHours = calculateHours();
        const dataToSave = {
            ...formData,
            break_minutes: Number(formData.break_minutes) || 0,
            total_hours: totalHours
        };
        
        haptics.light();
        onSave(dataToSave, entry?.id);
    };

    const handleEmployeeChange = (employeeId) => {
        const employee = allEmployees.find(e => e.id === employeeId);
        if (employee) {
            setFormData({
                ...formData,
                employee_id: employee.id,
                employee_name: employee.name
            });
        }
    };

    const totalHours = calculateHours();

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{entry?.id ? 'Zeiteintrag bearbeiten' : 'Neuer Zeiteintrag'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {isManager && (
                        <div className="space-y-2">
                            <Label>Mitarbeiter *</Label>
                            <Select value={formData.employee_id} onValueChange={handleEmployeeChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Mitarbeiter wählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {[...allEmployees].sort((a, b) => a.name.localeCompare(b.name, 'de')).map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {!isManager && (
                        <div className="space-y-2">
                            <Label>Mitarbeiter</Label>
                            <Input
                                value={formData.employee_name}
                                disabled
                                className="bg-slate-100"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Startdatum (Schichtbeginn) *</Label>
                        <Input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                        <p className="text-xs text-slate-500">Bei Nachtschichten: Datum des Schichtbeginns</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Startzeit *</Label>
                            <Input
                                type="time"
                                value={formData.start_time}
                                onChange={(e) => {
                                    const newStart = e.target.value;
                                    const autoBreak = calculateLegalBreak(newStart, formData.end_time);
                                    setFormData({ ...formData, start_time: newStart, break_minutes: autoBreak });
                                }}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Endzeit *</Label>
                            <Input
                                type="time"
                                value={formData.end_time}
                                onChange={(e) => {
                                    const newEnd = e.target.value;
                                    const autoBreak = calculateLegalBreak(formData.start_time, newEnd);
                                    setFormData({ ...formData, end_time: newEnd, break_minutes: autoBreak });
                                }}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Pausenzeit (Minuten)</Label>
                        <Input
                            type="number"
                            value={formData.break_minutes}
                            onChange={(e) => setFormData({ ...formData, break_minutes: e.target.value })}
                            placeholder="z.B. 30"
                            min="0"
                        />
                        {formData.break_minutes > 0 && (
                            <p className="text-xs text-amber-600">
                                ⚖️ Gesetzliche Pause automatisch eingetragen ({formData.break_minutes} Min.) – vollständig bezahlt. Manuell anpassbar.
                            </p>
                        )}
                    </div>

                    {totalHours > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm font-semibold text-amber-900">
                                Gesamtzeit: {(totalHours + (Number(formData.break_minutes) || 0) / 60).toFixed(2)}h bezahlt ({totalHours.toFixed(2)}h Netto)
                                {formData.start_time && formData.end_time && formData.end_time < formData.start_time && (
                                    <span className="ml-2 text-xs text-amber-700">🌙 Nachtschicht (endet am Folgetag)</span>
                                )}
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="entwurf">Entwurf</SelectItem>
                                <SelectItem value="eingereicht">Eingereicht</SelectItem>
                                {isManager && <SelectItem value="genehmigt">Genehmigt</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Notizen</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Optional: Zusätzliche Informationen..."
                            rows={2}
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                            Abbrechen
                        </Button>
                        <Button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700">
                            Speichern
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}