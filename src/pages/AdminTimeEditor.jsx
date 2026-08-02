import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { Pencil, Trash2, Save, X, Clock, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';

// ── Inline edit modal für TimeEntry ─────────────────────────────────────────
function TimeEntryEditModal({ entry, employees, onSave, onClose }) {
    const [form, setForm] = useState({
        employee_id: entry?.employee_id || '',
        employee_name: entry?.employee_name || '',
        date: entry?.date || format(new Date(), 'yyyy-MM-dd'),
        start_time: entry?.start_time || '',
        end_time: entry?.end_time || '',
        break_minutes: entry?.break_minutes ?? 0,
        total_hours: entry?.total_hours ?? 0,
        notes: entry?.notes || '',
        status: entry?.status || 'entwurf',
    });

    const recalc = (f) => {
        if (!f.start_time || !f.end_time) return f;
        const [sh, sm] = f.start_time.split(':').map(Number);
        const [eh, em] = f.end_time.split(':').map(Number);
        let totalMin = (eh * 60 + em) - (sh * 60 + sm);
        if (totalMin < 0) totalMin += 24 * 60;
        totalMin -= Number(f.break_minutes || 0);
        return { ...f, total_hours: Math.round((totalMin / 60) * 100) / 100 };
    };

    const set = (key, val) => setForm(prev => recalc({ ...prev, [key]: val }));

    const handleEmpChange = (id) => {
        const emp = employees.find(e => e.id === id);
        setForm(prev => recalc({ ...prev, employee_id: id, employee_name: emp?.name || '' }));
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-foreground">
                        {entry ? 'TimeEntry bearbeiten' : 'Neuer TimeEntry'}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <Label className="text-xs text-muted-foreground">Mitarbeiter</Label>
                        <select
                            value={form.employee_id}
                            onChange={e => handleEmpChange(e.target.value)}
                            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
                        >
                            <option value="">— wählen —</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Datum</Label>
                        <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs text-muted-foreground">Startzeit</Label>
                            <Input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Endzeit</Label>
                            <Input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className="mt-1" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs text-muted-foreground">Pause (Min)</Label>
                            <Input type="number" value={form.break_minutes} onChange={e => set('break_minutes', Number(e.target.value))} className="mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Stunden (berechnet)</Label>
                            <Input type="number" step="0.01" value={form.total_hours} onChange={e => set('total_hours', Number(e.target.value))} className="mt-1" />
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <select
                            value={form.status}
                            onChange={e => set('status', e.target.value)}
                            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
                        >
                            <option value="entwurf">Entwurf</option>
                            <option value="eingereicht">Eingereicht</option>
                            <option value="genehmigt">Genehmigt</option>
                        </select>
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Notizen</Label>
                        <Input value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" placeholder="optional" />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button onClick={() => onSave(form)} className="flex-1 bg-amber-600 hover:bg-amber-700">
                            <Save className="w-4 h-4 mr-1" /> Speichern
                        </Button>
                        <Button variant="outline" onClick={onClose}>Abbrechen</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Inline edit modal für ClockEntry ────────────────────────────────────────
function ClockEntryEditModal({ entry, employees, onSave, onClose }) {
    const [form, setForm] = useState({
        employee_id: entry?.employee_id || '',
        employee_name: entry?.employee_name || '',
        clock_in: entry?.clock_in ? entry.clock_in.slice(0, 16) : '',
        clock_out: entry?.clock_out ? entry.clock_out.slice(0, 16) : '',
        break_minutes: entry?.break_minutes ?? 0,
        total_hours: entry?.total_hours ?? 0,
        status: entry?.status || 'clocked_out',
        notes: entry?.notes || '',
    });

    const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const handleEmpChange = (id) => {
        const emp = employees.find(e => e.id === id);
        setForm(prev => ({ ...prev, employee_id: id, employee_name: emp?.name || '' }));
    };

    const handleSave = () => {
        const data = {
            ...form,
            clock_in: form.clock_in ? new Date(form.clock_in).toISOString() : undefined,
            clock_out: form.clock_out ? new Date(form.clock_out).toISOString() : undefined,
            break_minutes: Number(form.break_minutes),
            total_hours: Number(form.total_hours),
        };
        onSave(data);
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-foreground">ClockEntry bearbeiten</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <Label className="text-xs text-muted-foreground">Mitarbeiter</Label>
                        <select
                            value={form.employee_id}
                            onChange={e => handleEmpChange(e.target.value)}
                            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
                        >
                            <option value="">— wählen —</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs text-muted-foreground">Einstempel</Label>
                            <Input type="datetime-local" value={form.clock_in} onChange={e => set('clock_in', e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Ausstempel</Label>
                            <Input type="datetime-local" value={form.clock_out} onChange={e => set('clock_out', e.target.value)} className="mt-1" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs text-muted-foreground">Pause (Min)</Label>
                            <Input type="number" value={form.break_minutes} onChange={e => set('break_minutes', e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Stunden</Label>
                            <Input type="number" step="0.01" value={form.total_hours} onChange={e => set('total_hours', e.target.value)} className="mt-1" />
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <select
                            value={form.status}
                            onChange={e => set('status', e.target.value)}
                            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
                        >
                            <option value="clocked_in">Eingestempelt</option>
                            <option value="on_break">Pause</option>
                            <option value="clocked_out">Ausgestempelt</option>
                        </select>
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Notizen</Label>
                        <Input value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" placeholder="optional" />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button onClick={handleSave} className="flex-1 bg-amber-600 hover:bg-amber-700">
                            <Save className="w-4 h-4 mr-1" /> Speichern
                        </Button>
                        <Button variant="outline" onClick={onClose}>Abbrechen</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AdminTimeEditor() {
    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const [editTE, setEditTE] = useState(null); // null | 'new' | entry object
    const [editCE, setEditCE] = useState(null);
    const [filterEmp, setFilterEmp] = useState('');
    const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true })
    });

    const { data: timeEntries = [], isLoading: loadingTE } = useQuery({
        queryKey: ['admin-time-entries', filterMonth],
        queryFn: async () => {
            const start = `${filterMonth}-01`;
            const end = format(endOfMonth(parseISO(start)), 'yyyy-MM-dd');
            // Base44 SDK unterstützt keine date_gte/date_lte — clientseitig filtern
            const all = await base44.entities.TimeEntry.list('-date', 1000);
            return all.filter(e => e.date >= start && e.date <= end);
        }
    });

    const { data: clockEntries = [], isLoading: loadingCE } = useQuery({
        queryKey: ['admin-clock-entries', filterMonth],
        queryFn: () => {
            const start = `${filterMonth}-01T00:00:00`;
            const end = format(endOfMonth(parseISO(`${filterMonth}-01`)), 'yyyy-MM-dd') + 'T23:59:59';
            return base44.entities.ClockEntry.filter({ clock_in_gte: start, clock_in_lte: end }, '-clock_in', 500);
        }
    });

    // Clientseitige Filterung entfernt — Daten sind bereits gefiltert
    const filteredTE = timeEntries;
    const filteredCE = clockEntries;

    // Mutations
    const saveTEMutation = useMutation({
        mutationFn: ({ id, data }) => id
            ? base44.entities.TimeEntry.update(id, data)
            : base44.entities.TimeEntry.create(data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-time-entries'] }); setEditTE(null); }
    });

    const deleteTEMutation = useMutation({
        mutationFn: (id) => base44.entities.TimeEntry.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-time-entries'] })
    });

    const saveCEMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.ClockEntry.update(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-clock-entries'] }); setEditCE(null); }
    });

    const deleteCEMutation = useMutation({
        mutationFn: (id) => base44.entities.ClockEntry.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-clock-entries'] })
    });

    if (!permissions.isAdmin && !permissions.isManager) {
        return <PermissionDenied message="Nur Admins haben Zugriff auf den Zeit-Editor." />;
    }

    const statusColors = {
        entwurf: 'bg-slate-500/20 text-slate-400',
        eingereicht: 'bg-blue-500/20 text-blue-400',
        genehmigt: 'bg-green-500/20 text-green-400',
        clocked_in: 'bg-green-500/20 text-green-400',
        on_break: 'bg-amber-500/20 text-amber-400',
        clocked_out: 'bg-slate-500/20 text-slate-400',
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Admin Zeit-Editor</h1>
                            <p className="text-xs text-muted-foreground">Direktbearbeitung aller ClockEntry & TimeEntry Datensätze</p>
                        </div>
                    </div>
                    <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-xl text-xs text-red-300">
                        ⚠️ <strong>Achtung:</strong> Hier können alle Einträge direkt bearbeitet werden — auch bereits genehmigte. Nur für Korrekturen verwenden!
                    </div>
                </div>

                {/* Filter Bar */}
                <Card className="p-3 bg-card border-border mb-4 flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Monat:</Label>
                        <Input
                            type="month"
                            value={filterMonth}
                            onChange={e => setFilterMonth(e.target.value)}
                            className="text-sm h-8"
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Mitarbeiter:</Label>
                        <select
                            value={filterEmp}
                            onChange={e => setFilterEmp(e.target.value)}
                            className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm text-foreground h-8"
                        >
                            <option value="">Alle</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            queryClient.invalidateQueries({ queryKey: ['admin-time-entries'] });
                            queryClient.invalidateQueries({ queryKey: ['admin-clock-entries'] });
                        }}
                        className="h-8"
                    >
                        <RefreshCw className="w-3 h-3 mr-1" /> Neu laden
                    </Button>
                </Card>

                <Tabs defaultValue="timeentry">
                    <TabsList className="grid grid-cols-2 bg-card border border-border mb-4">
                        <TabsTrigger value="timeentry" className="data-[state=active]:bg-amber-600">
                            TimeEntries ({filteredTE.length})
                        </TabsTrigger>
                        <TabsTrigger value="clockentry" className="data-[state=active]:bg-amber-600">
                            ClockEntries ({filteredCE.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* ── TimeEntry Tab ──────────────────────────────────────── */}
                    <TabsContent value="timeentry">
                        <div className="flex justify-end mb-3">
                            <Button
                                onClick={() => setEditTE('new')}
                                size="sm"
                                className="bg-amber-600 hover:bg-amber-700"
                            >
                                <Plus className="w-4 h-4 mr-1" /> Neuer Eintrag
                            </Button>
                        </div>

                        {loadingTE ? (
                            <div className="text-center py-12 text-muted-foreground">Lade…</div>
                        ) : filteredTE.length === 0 ? (
                            <Card className="p-8 text-center text-muted-foreground bg-card border-border">
                                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p>Keine TimeEntries gefunden</p>
                            </Card>
                        ) : (
                            <div className="space-y-2">
                                {filteredTE
                                    .sort((a, b) => b.date.localeCompare(a.date))
                                    .map(entry => (
                                    <Card key={entry.id} className="p-3 bg-card border-border">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                                                <span className="font-semibold text-sm text-foreground whitespace-nowrap">
                                                    {entry.employee_name}
                                                </span>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {entry.date}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {entry.start_time} – {entry.end_time}
                                                </span>
                                                <span className="text-sm font-bold text-amber-400">
                                                    {(entry.total_hours + (entry.break_minutes || 0)/60).toFixed(2)}h
                                                </span>
                                                {entry.break_minutes > 0 && (
                                                    <span className="text-xs text-muted-foreground">
                                                        Pause: {entry.break_minutes}min (mitbezahlt)
                                                    </span>
                                                )}
                                                <Badge className={cn('text-xs', statusColors[entry.status] || 'bg-secondary text-secondary-foreground')}>
                                                    {entry.status}
                                                </Badge>
                                                {entry.notes && (
                                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={entry.notes}>
                                                        📝 {entry.notes}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setEditTE(entry)}
                                                    className="text-slate-400 hover:text-white h-8 w-8"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => confirm(`Eintrag von ${entry.employee_name} am ${entry.date} löschen?`) && deleteTEMutation.mutate(entry.id)}
                                                    className="text-red-400 hover:text-red-300 h-8 w-8"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── ClockEntry Tab ─────────────────────────────────────── */}
                    <TabsContent value="clockentry">
                        {loadingCE ? (
                            <div className="text-center py-12 text-muted-foreground">Lade…</div>
                        ) : filteredCE.length === 0 ? (
                            <Card className="p-8 text-center text-muted-foreground bg-card border-border">
                                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p>Keine ClockEntries gefunden</p>
                            </Card>
                        ) : (
                            <div className="space-y-2">
                                {filteredCE
                                    .sort((a, b) => (b.clock_in || '').localeCompare(a.clock_in || ''))
                                    .map(entry => (
                                    <Card key={entry.id} className={cn('p-3 bg-card border-border', !entry.clock_out && 'border-green-700/50')}>
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                                                <span className="font-semibold text-sm text-foreground whitespace-nowrap">
                                                    {entry.employee_name}
                                                </span>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {entry.clock_in ? format(new Date(entry.clock_in), 'dd.MM.yyyy HH:mm', { locale: de }) : '—'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">→</span>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {entry.clock_out ? format(new Date(entry.clock_out), 'HH:mm', { locale: de }) : '⏳ offen'}
                                                </span>
                                                {entry.total_hours != null && (
                                                    <span className="text-sm font-bold text-amber-400">
                                                        {(Number(entry.total_hours) + (entry.break_minutes || 0)/60).toFixed(2)}h
                                                    </span>
                                                )}
                                                {entry.break_minutes > 0 && (
                                                    <span className="text-xs text-muted-foreground">
                                                        Pause: {entry.break_minutes}min (mitbezahlt)
                                                    </span>
                                                )}
                                                <Badge className={cn('text-xs', statusColors[entry.status] || 'bg-secondary text-secondary-foreground')}>
                                                    {entry.status === 'clocked_in' ? 'Aktiv' : entry.status === 'on_break' ? 'Pause' : 'Fertig'}
                                                </Badge>
                                                {entry.arbzg_warning && (
                                                    <span className="text-xs text-red-400">⚠️ ArbZG</span>
                                                )}
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setEditCE(entry)}
                                                    className="text-slate-400 hover:text-white h-8 w-8"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => confirm(`ClockEntry von ${entry.employee_name} löschen?`) && deleteCEMutation.mutate(entry.id)}
                                                    className="text-red-400 hover:text-red-300 h-8 w-8"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Modals */}
            {editTE && (
                <TimeEntryEditModal
                    entry={editTE === 'new' ? null : editTE}
                    employees={employees}
                    onSave={(data) => saveTEMutation.mutate({ id: editTE === 'new' ? null : editTE.id, data })}
                    onClose={() => setEditTE(null)}
                />
            )}
            {editCE && (
                <ClockEntryEditModal
                    entry={editCE}
                    employees={employees}
                    onSave={(data) => saveCEMutation.mutate({ id: editCE.id, data })}
                    onClose={() => setEditCE(null)}
                />
            )}
        </div>
    );
}