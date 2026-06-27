import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check } from 'lucide-react';
import { addDays, addWeeks, endOfWeek, format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SmartCombobox from '@/components/ui/SmartCombobox';
import AttachmentManager from './AttachmentManager';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/mobile-dialog";
import { MobileModalHeader, MobileModalContent, MobileModalFooter, MobileModalForm } from "@/components/modals/MobileModalWrapper";
import { cn } from "@/lib/utils";
import { haptics } from "@/components/utils/haptics";
import { getUserDisplayName } from '@/lib/userDisplayName';

const PRIORITIES = [
    { value: 'niedrig', label: 'Niedrig', color: 'bg-slate-500' },
    { value: 'mittel',  label: 'Mittel',  color: 'bg-blue-500' },
    { value: 'hoch',    label: 'Hoch',    color: 'bg-orange-500' },
    { value: 'dringend',label: 'Dringend',color: 'bg-red-500' },
];

const STATUSES = [
    { value: 'offen',          label: 'Offen',    icon: '○' },
    { value: 'in_bearbeitung', label: 'Aktiv',    icon: '◑' },
    { value: 'erledigt',       label: 'Erledigt', icon: '●' },
];

const priorityAccent = {
    niedrig: 'bg-slate-500',
    mittel:  'bg-blue-500',
    hoch:    'bg-orange-500',
    dringend:'bg-red-500',
};

const quickDates = [
    { label: 'Heute',         getValue: () => format(new Date(), 'yyyy-MM-dd') },
    { label: 'Morgen',        getValue: () => format(addDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: 'Diese Woche',   getValue: () => format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd') },
    { label: 'Nächste Woche', getValue: () => format(endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd') },
];

function generateId() {
    return Math.random().toString(36).slice(2, 10);
}

function generateAttachmentId() {
    return 'att_' + crypto.randomUUID().split('-')[0];
}

export default function TodoModal({ open, onClose, todo, employees, onSave, currentUser }) {
    const AREAS = ['Bar', 'Lager', 'Küche', 'Außenbereich', 'Büro', 'Allgemein'];

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'mittel',
        status: 'offen',
        due_date: '',
        assigned_to: '',
        assigned_to_names: [],
        category: 'Sonstiges',
        linked_area: '',
        subtasks: [],
        attachments: [],
    });
    const [newSubtask, setNewSubtask] = useState('');

    const { data: dbCategories = [] } = useQuery({
        queryKey: ['todo-categories'],
        queryFn: () => base44.entities.TodoCategory.list('name'),
    });

    const DEFAULT_CATEGORIES = ['Einkauf', 'Reparatur', 'Event', 'Bar', 'Lager', 'Küche', 'Sonstiges'];
    const categories = Array.from(new Set([
        ...DEFAULT_CATEGORIES,
        ...dbCategories.map(c => c.name)
    ]));

    useEffect(() => {
        if (todo) {
            setFormData({
                title: todo.title || '',
                description: todo.description || '',
                priority: todo.priority || 'mittel',
                status: todo.status || 'offen',
                due_date: todo.due_date || '',
                assigned_to: todo.assigned_to || '',
                assigned_to_names: todo.assigned_to_names || (todo.assigned_to ? [todo.assigned_to] : []),
                category: todo.category || 'Sonstiges',
                linked_area: todo.linked_area || '',
                subtasks: todo.subtasks || [],
                attachments: todo.attachments || [],
            });
        } else {
            const defaultAssignee = getUserDisplayName({ user: currentUser });
            setFormData({
                title: '',
                description: '',
                priority: 'mittel',
                status: 'offen',
                due_date: '',
                assigned_to: defaultAssignee,
                assigned_to_names: defaultAssignee ? [defaultAssignee] : [],
                category: 'Sonstiges',
                linked_area: '',
                subtasks: [],
                attachments: [],
            });
        }
        setNewSubtask('');
    }, [todo, open, currentUser]);

    const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const toggleAssignee = (name) => {
        const current = formData.assigned_to_names || [];
        const updated = current.includes(name)
            ? current.filter(n => n !== name)
            : [...current, name];
        setFormData(prev => ({
            ...prev,
            assigned_to_names: updated,
            assigned_to: updated[0] || ''
        }));
    };

    const addSubtask = () => {
        if (!newSubtask.trim()) return;
        set('subtasks', [...formData.subtasks, { id: generateId(), title: newSubtask.trim(), done: false }]);
        setNewSubtask('');
    };

    const removeSubtask = (id) => {
        set('subtasks', formData.subtasks.filter(s => s.id !== id));
    };

    const handleSubmit = (e) => {
        if (e?.preventDefault) e.preventDefault();
        if (!formData.title?.trim()) return;
        haptics.light();
        onSave(formData, todo?.id);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <div className={cn("h-1 w-full rounded-t-lg transition-colors duration-300", priorityAccent[formData.priority])} />
                <MobileModalHeader onClose={onClose}>
                    {todo ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
                </MobileModalHeader>

                <MobileModalContent>
                    <MobileModalForm id="todo-form" onSubmit={handleSubmit}>
                    {/* Title */}
                    <div className="space-y-1.5">
                        <Label className="text-base font-semibold">Titel *</Label>
                        <Input
                            value={formData.title}
                            onChange={e => set('title', e.target.value)}
                            placeholder="Aufgabe eingeben..."
                            required
                            className="h-12 text-base"
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Beschreibung</Label>
                        <Textarea
                            value={formData.description}
                            onChange={e => set('description', e.target.value)}
                            placeholder="Details zur Aufgabe..."
                            rows={5}
                            className="text-sm"
                        />
                    </div>

                    {/* Priority - visual chips */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Priorität</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {PRIORITIES.map(p => (
                                <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => set('priority', p.value)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all active:scale-95",
                                        formData.priority === p.value
                                            ? "border-foreground text-foreground bg-accent"
                                            : "border-border text-muted-foreground"
                                    )}
                                >
                                    <span className={cn("w-3 h-3 rounded-full shrink-0", p.color)} />
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Category - Chip-Grid */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Kategorie</Label>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => set('category', cat)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95",
                                        formData.category === cat
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "border-border text-muted-foreground hover:border-primary/50"
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status - 3 Chips */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Status</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {STATUSES.map(s => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => set('status', s.value)}
                                    className={cn(
                                        "py-3 rounded-xl border text-sm font-medium transition-all active:scale-95",
                                        formData.status === s.value
                                            ? "border-foreground bg-accent text-foreground"
                                            : "border-border text-muted-foreground"
                                    )}
                                >
                                    <span className="mr-1">{s.icon}</span>{s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Due date + Bereich */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Fällig am</Label>
                            <div className="flex gap-1.5 flex-wrap mb-2">
                                {quickDates.map(qd => {
                                    const isActive = qd.getValue() === formData.due_date;
                                    return (
                                        <button
                                            key={qd.label}
                                            type="button"
                                            onClick={() => set('due_date', qd.getValue())}
                                            className={cn(
                                                "text-xs px-2.5 py-1 rounded-full border transition-all active:scale-95",
                                                isActive
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "border-border text-muted-foreground hover:border-primary/50"
                                            )}
                                        >
                                            {qd.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <Input
                                type="date"
                                value={formData.due_date}
                                onChange={e => set('due_date', e.target.value)}
                                className="h-12 text-base"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Bereich (optional)</Label>
                            <select
                                value={formData.linked_area}
                                onChange={e => set('linked_area', e.target.value)}
                                className="w-full h-12 rounded-xl border border-input bg-background px-3 text-base text-foreground"
                            >
                                <option value="">Kein Bereich</option>
                                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Assignees - multi-select checkboxes */}
                    {employees?.length > 0 && (
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Zugewiesen an</Label>
                            <div className="flex flex-wrap gap-2">
                                {employees.map(emp => {
                                    const selected = formData.assigned_to_names?.includes(emp.name);
                                    return (
                                        <button
                                            key={emp.id}
                                            type="button"
                                            onClick={() => toggleAssignee(emp.name)}
                                            className={cn(
                                                "px-3 py-2.5 rounded-xl border text-sm transition-all active:scale-95",
                                                selected
                                                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold"
                                                    : "border-border text-muted-foreground"
                                            )}
                                        >
                                            {selected ? '✓ ' : ''}{emp.name}
                                        </button>
                                    );
                                })}
                                {formData.assigned_to_names?.length > 0 && (
                                    <button type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, assigned_to_names: [], assigned_to: '' }))}
                                        className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">
                                        Alle entfernen
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Attachments Manager */}
                    <AttachmentManager
                        attachments={formData.attachments}
                        onChange={(attachments) => set('attachments', attachments)}
                        isLoading={false}
                    />

                    {/* Subtasks */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Unteraufgaben</Label>
                        {formData.subtasks.length > 0 && (
                            <div className="space-y-1 mb-2">
                                {formData.subtasks.map(subtask => (
                                    <div key={subtask.id} className="flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => set('subtasks', formData.subtasks.map(s =>
                                                s.id === subtask.id ? { ...s, done: !s.done } : s
                                            ))}
                                            className={cn(
                                                "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                                                subtask.done
                                                    ? "bg-primary border-primary"
                                                    : "border-border hover:border-primary"
                                            )}
                                        >
                                            {subtask.done && <Check className="w-3 h-3 text-primary-foreground" />}
                                        </button>
                                        <span className={cn("text-xs flex-1", subtask.done ? "line-through text-muted-foreground" : "text-foreground")}>{subtask.title}</span>
                                        <button type="button" onClick={() => removeSubtask(subtask.id)}
                                            className="text-muted-foreground hover:text-red-400 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Input
                                value={newSubtask}
                                onChange={e => setNewSubtask(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                                placeholder="Unteraufgabe hinzufügen..."
                                className="h-11 text-base flex-1"
                            />
                            <Button type="button" variant="outline" onClick={addSubtask} disabled={!newSubtask.trim()} className="h-11 px-4">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    </MobileModalForm>
                </MobileModalContent>

                <MobileModalFooter>
                    <Button type="button" variant="outline" onClick={onClose} className="h-12 text-base">
                        Abbrechen
                    </Button>
                    <Button type="button" onClick={handleSubmit} className="h-12 text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold">
                        {todo ? 'Speichern' : 'Hinzufügen'}
                    </Button>
                </MobileModalFooter>
            </DialogContent>
        </Dialog>
    );
}