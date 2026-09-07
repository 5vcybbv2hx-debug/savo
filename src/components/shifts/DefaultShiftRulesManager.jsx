import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Settings2 } from 'lucide-react';

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export default function DefaultShiftRulesManager({ open: extOpen, onOpenChange: extOnOpenChange, hideTrigger }) {
    const [intOpen, setIntOpen] = useState(false);
    const open = extOpen !== undefined ? extOpen : intOpen;
    const setOpen = (v) => { if (extOnOpenChange) extOnOpenChange(v); setIntOpen(v); };
    const [newRule, setNewRule] = useState({ employee_id: '', day_of_week: '', shift_type: '' });
    const queryClient = useQueryClient();

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true })
    });

    const { data: shiftTypes = [] } = useQuery({
        queryKey: ['shift-types'],
        queryFn: () => base44.entities.ShiftType.filter({ is_active: true }, 'order')
    });

    const { data: rules = [] } = useQuery({
        queryKey: ['default-shift-rules'],
        queryFn: () => base44.entities.DefaultShiftRule.list(),
        enabled: open
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.DefaultShiftRule.create(data),
        onSuccess: () => queryClient.invalidateQueries(['default-shift-rules'])
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.DefaultShiftRule.delete(id),
        onSuccess: () => queryClient.invalidateQueries(['default-shift-rules'])
    });

    const handleAdd = () => {
        if (!newRule.employee_id || !newRule.day_of_week || !newRule.shift_type) return;
        const employee = employees.find(e => e.id === newRule.employee_id);
        createMutation.mutate({
            ...newRule,
            employee_name: employee?.name || ''
        });
        setNewRule({ employee_id: '', day_of_week: '', shift_type: '' });
    };

    // Group rules by employee
    const rulesByEmployee = rules.reduce((acc, rule) => {
        if (!acc[rule.employee_id]) acc[rule.employee_id] = { name: rule.employee_name, rules: [] };
        acc[rule.employee_id].rules.push(rule);
        return acc;
    }, {});

    return (
        <>
            {!hideTrigger && (
                <Button
                    variant="outline"
                    onClick={() => setOpen(true)}
                    className="border-slate-600 text-slate-300"
                    title="Standard-Schichtregeln"
                >
                    <Settings2 className="w-4 h-4 mr-2" />
                    Schicht-Regeln
                </Button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Standard-Schichtregeln</DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            Lege fest, welcher Schichttyp für einen Mitarbeiter an einem bestimmten Wochentag vorausgewählt wird.
                        </p>
                    </DialogHeader>

                    {/* Add new rule */}
                    <div className="space-y-3 p-3 bg-secondary/30 rounded-lg border border-border">
                        <p className="text-sm font-medium">Neue Regel hinzufügen</p>
                        <Select value={newRule.employee_id} onValueChange={(v) => setNewRule({ ...newRule, employee_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen..." /></SelectTrigger>
                            <SelectContent>
                                {[...employees].sort((a, b) => a.name?.localeCompare(b.name, 'de')).map(emp => (
                                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={newRule.day_of_week} onValueChange={(v) => setNewRule({ ...newRule, day_of_week: v })}>
                            <SelectTrigger><SelectValue placeholder="Wochentag wählen..." /></SelectTrigger>
                            <SelectContent>
                                {DAYS.map(day => (
                                    <SelectItem key={day} value={day}>{day}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={newRule.shift_type} onValueChange={(v) => setNewRule({ ...newRule, shift_type: v })}>
                            <SelectTrigger><SelectValue placeholder="Schichttyp wählen..." /></SelectTrigger>
                            <SelectContent>
                                {shiftTypes.map(type => (
                                    <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            onClick={handleAdd}
                            disabled={!newRule.employee_id || !newRule.day_of_week || !newRule.shift_type || createMutation.isPending}
                            className="w-full bg-amber-600 hover:bg-amber-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Regel hinzufügen
                        </Button>
                    </div>

                    {/* Existing rules */}
                    <div className="space-y-4 mt-2">
                        {Object.keys(rulesByEmployee).length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">Noch keine Regeln definiert.</p>
                        )}
                        {Object.entries(rulesByEmployee).map(([empId, { name, rules: empRules }]) => (
                            <div key={empId} className="space-y-2">
                                <p className="text-sm font-semibold text-foreground">{name}</p>
                                <div className="space-y-1">
                                    {empRules
                                        .sort((a, b) => DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week))
                                        .map(rule => (
                                        <div key={rule.id} className="flex items-center justify-between p-2 bg-secondary/40 rounded-lg">
                                            <span className="text-sm text-muted-foreground w-28">{rule.day_of_week}</span>
                                            <span className="text-sm font-medium flex-1">{rule.shift_type}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                                onClick={() => deleteMutation.mutate(rule.id)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}