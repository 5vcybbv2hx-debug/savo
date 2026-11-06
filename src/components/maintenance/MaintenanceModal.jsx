import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Trash2, Wrench } from "lucide-react";
import ContactsList from "./ContactsList";
import { haptics } from "@/components/utils/haptics";
import { toast } from "sonner";
import { calculateNextMaintenance } from "@/lib/maintenanceUtils";

// ── Shared field style ───────────────────────────────────────────────────────
const fieldClass = "h-12 text-base rounded-xl border-border/70";
const labelClass = "text-sm font-semibold text-foreground mb-1.5 block";

function Field({ label, hint, children }) {
    return (
        <div className="flex flex-col">
            {label && <label className={labelClass}>{label}</label>}
            {children}
            {hint && <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{hint}</p>}
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            {title && (
                <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
                    <span className="text-[13.5px] font-medium text-foreground tracking-tight">{title}</span>
                </div>
            )}
            <div className="p-4 space-y-4">{children}</div>
        </div>
    );
}

function SwitchRow({ label, description, checked, onCheckedChange }) {
    return (
        <div className="flex items-center justify-between gap-3 py-1">
            <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────

const EMPTY = {
    equipment_name: "",
    category: "Technik",
    task_description: "",
    frequency: "jährlich",
    last_maintenance: "",
    next_maintenance: "",
    responsible: "",
    notes: "",
    enable_reminders: true,
    reminder_days_before: 7,
    sync_to_calendar: true,
    is_active: true,
    contacts: [],
};

export default function MaintenanceModal({ task, open, onClose }) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState(EMPTY);
    const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
    });

    useEffect(() => {
        setFormData(task ? { ...EMPTY, ...task } : EMPTY);
    }, [task, open]);

    // Auto-calculate next_maintenance when last_maintenance or frequency changes
    useEffect(() => {
        if (formData.last_maintenance && formData.frequency) {
            const next = calculateNextMaintenance(formData.last_maintenance, formData.frequency);
            setFormData(prev => ({ ...prev, next_maintenance: next }));
        }
    }, [formData.last_maintenance, formData.frequency]);

    const saveMutation = useMutation({
        mutationFn: (data) => task
            ? base44.entities.MaintenanceTask.update(task.id, data)
            : base44.entities.MaintenanceTask.create(data),
        onSuccess: () => {
            haptics.light();
            toast.success(task ? 'Wartung aktualisiert' : 'Wartung erstellt');
            queryClient.invalidateQueries(['maintenance-tasks']);
            onClose();
        },
        onError: (err) => toast.error('Speichern fehlgeschlagen'),
    });

    const deleteMutation = useMutation({
        mutationFn: () => base44.entities.MaintenanceTask.delete(task.id),
        onSuccess: () => {
            haptics.light();
            toast.success('Wartung gelöscht');
            queryClient.invalidateQueries(['maintenance-tasks']);
            onClose();
        },
        onError: (err) => toast.error('Löschen fehlgeschlagen'),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const isBusy = saveMutation.isPending || deleteMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col p-0 gap-0 rounded-none sm:rounded-2xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <Wrench className="w-5 h-5 text-status-warn" />
                        {task ? 'Wartung bearbeiten' : 'Neue Wartung'}
                    </DialogTitle>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form id="maintenance-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

                    {/* Gerät */}
                    <Section title="Gerät / Bereich">
                        <Field label="Name *">
                            <Input
                                className={fieldClass}
                                value={formData.equipment_name}
                                onChange={e => set('equipment_name', e.target.value)}
                                placeholder="z.B. Feuerlöscher Küche"
                                required
                            />
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Kategorie">
                                <Select value={formData.category || "Technik"} onValueChange={v => set('category', v)}>
                                    <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {['Sicherheit','Technik','Hygiene','Elektrik','Sonstiges'].map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field label="Zuständig">
                                <Select value={formData.responsible || ""} onValueChange={v => set('responsible', v)}>
                                    <SelectTrigger className={fieldClass}>
                                        <SelectValue placeholder="Auswählen…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={null}>Niemand zugewiesen</SelectItem>
                                        {employees.map(emp => (
                                            <SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        <Field label="Beschreibung *">
                            <Textarea
                                className="text-base rounded-xl border-border/70 min-h-[72px] resize-none"
                                value={formData.task_description}
                                onChange={e => set('task_description', e.target.value)}
                                placeholder="Was muss gewartet/geprüft werden?"
                                required
                            />
                        </Field>
                    </Section>

                    {/* Termine */}
                    <Section title="Intervall & Termine">
                        <Field label="Wartungsintervall *">
                            <Select value={formData.frequency} onValueChange={v => set('frequency', v)}>
                                <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="täglich">Täglich</SelectItem>
                                    <SelectItem value="wöchentlich">Wöchentlich</SelectItem>
                                    <SelectItem value="monatlich">Monatlich</SelectItem>
                                    <SelectItem value="quartalsweise">Quartalsweise (3 Monate)</SelectItem>
                                    <SelectItem value="halbjährlich">Halbjährlich (6 Monate)</SelectItem>
                                    <SelectItem value="jährlich">Jährlich</SelectItem>
                                    <SelectItem value="alle zwei Jahre">Alle zwei Jahre</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Letzte Wartung" hint="Nächster Termin wird automatisch berechnet.">
                                <Input
                                    className={fieldClass}
                                    type="date"
                                    value={formData.last_maintenance}
                                    onChange={e => set('last_maintenance', e.target.value)}
                                />
                            </Field>

                            <Field label="Nächste Wartung" hint="Wird automatisch befüllt, kann manuell überschrieben werden.">
                                <Input
                                    className={fieldClass}
                                    type="date"
                                    value={formData.next_maintenance}
                                    onChange={e => set('next_maintenance', e.target.value)}
                                />
                            </Field>
                        </div>
                    </Section>

                    {/* Kontakte */}
                    <Section title="Wartungsfirma & Kontakte">
                        <ContactsList
                            contacts={formData.contacts || []}
                            onChange={newContacts => set('contacts', newContacts)}
                        />
                    </Section>

                    {/* Notizen */}
                    <Section title="Notizen">
                        <Field>
                            <Textarea
                                className="text-base rounded-xl border-border/70 min-h-[72px] resize-none"
                                value={formData.notes}
                                onChange={e => set('notes', e.target.value)}
                                placeholder="Zusätzliche Infos, Prüfberichte…"
                            />
                        </Field>
                    </Section>

                    {/* Einstellungen */}
                    <Section title="Einstellungen">
                        <div className="divide-y divide-border/40">
                            <div className="pb-3">
                                <SwitchRow
                                    label="Erinnerungen aktivieren"
                                    description="Benachrichtigung vor dem Fälligkeitsdatum"
                                    checked={formData.enable_reminders}
                                    onCheckedChange={v => set('enable_reminders', v)}
                                />
                                {formData.enable_reminders && (
                                    <div className="mt-3 pl-0">
                                        <Field label="Erinnerung (Tage vor Termin)">
                                            <Input
                                                className={fieldClass}
                                                type="number" min="1" max="60"
                                                value={formData.reminder_days_before}
                                                onChange={e => set('reminder_days_before', parseInt(e.target.value))}
                                            />
                                        </Field>
                                    </div>
                                )}
                            </div>
                            <div className="py-3">
                                <SwitchRow
                                    label="Kalender-Sync"
                                    description="Termin im geteilten Kalender eintragen"
                                    checked={formData.sync_to_calendar}
                                    onCheckedChange={v => set('sync_to_calendar', v)}
                                />
                            </div>
                            <div className="pt-3">
                                <SwitchRow
                                    label="Aktiv"
                                    description="Inaktive Einträge werden ausgeblendet"
                                    checked={formData.is_active}
                                    onCheckedChange={v => set('is_active', v)}
                                />
                            </div>
                        </div>
                    </Section>
                </form>

                {/* Sticky footer */}
                <div className="shrink-0 px-4 py-4 border-t border-border/50 bg-card flex flex-col gap-3">
                    <Button
                        form="maintenance-form"
                        type="submit"
                        disabled={isBusy}
                        className="h-12 text-base font-semibold w-full rounded-xl"
                    >
                        {saveMutation.isPending ? 'Speichern…' : 'Speichern'}
                    </Button>
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isBusy}
                            className="flex-1 h-11 rounded-xl"
                        >
                            Abbrechen
                        </Button>
                        {task && (
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={isBusy}
                                onClick={() => deleteMutation.mutate()}
                                className="flex-1 h-11 rounded-xl gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {deleteMutation.isPending ? 'Löschen…' : 'Löschen'}
                            </Button>
                        )}
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
}