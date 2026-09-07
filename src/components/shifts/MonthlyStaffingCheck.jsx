import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Calendar } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function MonthlyStaffingCheck({ open: extOpen, onOpenChange: extOnOpenChange, hideTrigger }) {
    const [intModalOpen, setIntModalOpen] = useState(false);
    const modalOpen = extOpen !== undefined ? extOpen : intModalOpen;
    const setModalOpen = (v) => { if (extOnOpenChange) extOnOpenChange(v); setIntModalOpen(v); };
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true })
    });

    const { data: shifts = [], isLoading } = useQuery({
        queryKey: ['shifts-monthly', selectedMonth],
        // ⚠️ Limit erhoeht (750 Shifts aktuell, waechst weiter) — verhindert,
        // dass aeltere Monate aus dem Auslastungs-Check fallen.
        queryFn: () => base44.entities.Shift.list('-date', 3000),
        enabled: modalOpen
    });

    const analyzeMonthlyStaffing = () => {
        const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

        const monthShifts = shifts.filter(s => s.date >= monthStart && s.date <= monthEnd);

        const employeeStats = employees.map(emp => {
            const empShifts = monthShifts.filter(s => s.employee_id === emp.id);
            return {
                id: emp.id,
                name: emp.name,
                shiftCount: empShifts.length,
                shifts: empShifts
            };
        });

        return employeeStats.sort((a, b) => a.shiftCount - b.shiftCount);
    };

    const stats = modalOpen ? analyzeMonthlyStaffing() : [];
    const understaffed = stats.filter(s => s.shiftCount < 2);

    return (
        <>
            {!hideTrigger && (
                <Button 
                    variant="outline" 
                    onClick={() => setModalOpen(true)}
                    className="border-border/70 hover:bg-secondary text-foreground/75"
                >
                    <Calendar className="w-4 h-4 mr-2" />
                    Monatsanalyse
                </Button>
            )}

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Monatliche Schichtverteilung</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        {/* Month Selector */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const newDate = new Date(selectedMonth);
                                    newDate.setMonth(newDate.getMonth() - 1);
                                    setSelectedMonth(newDate);
                                }}
                            >
                                ←
                            </Button>
                            <div className="flex-1 text-center font-semibold">
                                {format(selectedMonth, 'MMMM yyyy', { locale: de })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const newDate = new Date(selectedMonth);
                                    newDate.setMonth(newDate.getMonth() + 1);
                                    setSelectedMonth(newDate);
                                }}
                            >
                                →
                            </Button>
                        </div>

                        {/* Summary */}
                        {understaffed.length > 0 && (
                            <Card className="p-4 bg-amber-50 border-amber-200">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                                    <div>
                                        <p className="font-medium text-amber-900">
                                            {understaffed.length} Mitarbeiter unter Minimum
                                        </p>
                                        <p className="text-sm text-amber-700">
                                            Mindestens 2 Schichten pro Monat erforderlich
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Employee List */}
                        <div className="space-y-2">
                            {isLoading ? (
                                <p className="text-center text-muted-foreground py-8">Lädt...</p>
                            ) : (
                                stats.map(emp => (
                                    <Card 
                                        key={emp.id} 
                                        className={`p-4 ${
                                            emp.shiftCount < 2 
                                                ? 'bg-red-50 border-red-200' 
                                                : 'bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-slate-900">
                                                        {emp.name}
                                                    </p>
                                                    {emp.shiftCount >= 2 ? (
                                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                    ) : (
                                                        <AlertTriangle className="w-4 h-4 text-red-600" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-600 mt-1">
                                                    {emp.shiftCount} {emp.shiftCount === 1 ? 'Schicht' : 'Schichten'} 
                                                    {emp.shifts.length > 0 && (
                                                        <span className="ml-2">
                                                            • {emp.shifts.map(s => format(new Date(s.date), 'dd.MM.')).join(', ')}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <Badge 
                                                className={
                                                    emp.shiftCount < 2 
                                                        ? 'bg-red-100 text-red-700' 
                                                        : emp.shiftCount >= 8
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                }
                                            >
                                                {emp.shiftCount}
                                            </Badge>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}