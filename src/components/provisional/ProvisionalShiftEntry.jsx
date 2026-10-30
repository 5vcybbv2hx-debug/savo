import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarDays, Clock, Plus, Pencil, Trash2, Info } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
    ausstehend: { label: 'Ausstehend', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    bestätigt: { label: 'Bestätigt', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    abgelehnt: { label: 'Abgelehnt', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const SHIFT_TYPES = ['Frühschicht', 'Spätschicht', 'Aufmachen', 'Sonderschicht'];

function defaultForm(access) {
    return {
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '18:00',
        end_time: '23:00',
        shift_type: '',
        comment: '',
        access_id: access?.id || '',
    };
}

export default function ProvisionalShiftEntry({ employee, access }) {
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(defaultForm(access));

    const today = format(new Date(), 'yyyy-MM-dd');
    const windowActive = access && access.is_active && access.start_date <= today && access.end_date >= today;

    const { data: requests = [] } = useQuery({
        queryKey: ['my-provisional-requests', employee?.id],
        queryFn: () => base44.entities.ProvisionalShiftRequest.filter({ employee_id: employee.id }),
        enabled: !!employee?.id
    });

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const payload = { ...data, employee_id: employee.id, employee_name: employee.name, status: 'ausstehend' };
            if (editing) return base44.entities.ProvisionalShiftRequest.update(editing.id, payload);
            return base44.entities.ProvisionalShiftRequest.create(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-provisional-requests', employee?.id] });
            // Manager-Prüfliste (TeamMeeting → Wünsche) und Kalender sofort aktualisieren
            queryClient.invalidateQueries({ queryKey: ['provisional-shift-requests'] });
            queryClient.invalidateQueries({ queryKey: ['all-provisional-requests'] });
            setModalOpen(false);
            setEditing(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.ProvisionalShiftRequest.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-provisional-requests', employee?.id] });
            queryClient.invalidateQueries({ queryKey: ['provisional-shift-requests'] });
            queryClient.invalidateQueries({ queryKey: ['all-provisional-requests'] });
        }
    });

    const openNew = () => {
        setEditing(null);
        setForm(defaultForm(access));
        setModalOpen(true);
    };

    const openEdit = (req) => {
        if (req.status !== 'ausstehend') return;
        setEditing(req);
        setForm({ date: req.date, start_time: req.start_time, end_time: req.end_time, shift_type: req.shift_type || '', comment: req.comment || '', access_id: req.access_id || access?.id || '' });
        setModalOpen(true);
    };

    if (!access) return null;

    return (
        <div className="space-y-4">
            {/* Info Banner */}
            <Card className="p-4 border-amber-500/30 bg-amber-500/5">
                <div className="flex gap-3">
                    <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-amber-300 text-sm">Vorläufige Selbsteinplanung</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Du kannst Wunschschichten eintragen. Diese werden vom Manager geprüft und bestätigt.
                        </p>
                        {access.note && (
                            <p className="text-xs text-amber-400/80 mt-1 italic">📋 {access.note}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                            Zeitfenster: {format(parseISO(access.start_date), 'dd.MM.yyyy')} – {format(parseISO(access.end_date), 'dd.MM.yyyy')}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground">Meine Wunschschichten</h3>
                {windowActive && (
                    <Button onClick={openNew} className="bg-amber-600 hover:bg-amber-700 gap-2 h-11">
                        <Plus className="w-4 h-4" /> Eintragen
                    </Button>
                )}
            </div>

            {!windowActive && (
                <Card className="p-4 text-center">
                    <p className="text-muted-foreground text-sm">
                        {access.start_date > today
                            ? `Eingabe möglich ab ${format(parseISO(access.start_date), 'dd.MM.yyyy')}`
                            : 'Das Eingabefenster ist abgelaufen.'}
                    </p>
                </Card>
            )}

            {/* Requests List */}
            {requests.length > 0 && (
                <div className="space-y-3">
                    {[...requests].sort((a, b) => a.date.localeCompare(b.date)).map(req => {
                        const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.ausstehend;
                        const canEdit = req.status === 'ausstehend' && windowActive;
                        return (
                            <Card key={req.id} className={cn('p-4', req.status === 'bestätigt' && 'border-green-500/30', req.status === 'abgelehnt' && 'border-red-500/30 opacity-70')}>
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-foreground">
                                                {format(parseISO(req.date), 'EEEE, dd.MM.yyyy', { locale: de })}
                                            </span>
                                            <Badge className={cn('text-xs border', sc.color)}>{sc.label}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>{req.start_time} – {req.end_time}</span>
                                            {req.shift_type && <span>• {req.shift_type}</span>}
                                        </div>
                                        {req.comment && <p className="text-xs text-muted-foreground mt-1 italic">"{req.comment}"</p>}
                                        {req.manager_note && (
                                            <p className="text-xs mt-1 text-amber-400/80">Manager: {req.manager_note}</p>
                                        )}
                                    </div>
                                    {canEdit && (
                                        <div className="flex gap-1 shrink-0">
                                            <button onClick={() => openEdit(req)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => { if (confirm('Eintrag löschen?')) deleteMutation.mutate(req.id); }}
                                                className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {requests.length === 0 && windowActive && (
                <Card className="p-8 text-center">
                    <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                    <p className="text-muted-foreground text-sm">Noch keine Wunschschichten eingetragen</p>
                    <Button onClick={openNew} className="mt-4 bg-amber-600 hover:bg-amber-700 gap-2">
                        <Plus className="w-4 h-4" /> Jetzt eintragen
                    </Button>
                </Card>
            )}

            {/* Entry Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Eintrag bearbeiten' : 'Wunschschicht eintragen'}</DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-muted-foreground -mt-2 mb-2">
                        Diese Anfrage wird vom Manager geprüft – sie ist noch nicht verbindlich.
                    </p>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Datum</Label>
                            <Input type="date"
                                value={form.date}
                                min={access.start_date}
                                max={access.end_date}
                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                className="h-12 text-base" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Von</Label>
                                <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="h-12 text-base" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Bis</Label>
                                <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="h-12 text-base" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Schichttyp (optional)</Label>
                            <div className="flex gap-2 flex-wrap">
                                {SHIFT_TYPES.map(t => (
                                    <button key={t} type="button"
                                        onClick={() => setForm(f => ({ ...f, shift_type: f.shift_type === t ? '' : t }))}
                                        className={cn('px-3 py-2.5 rounded-xl border text-sm transition-all',
                                            form.shift_type === t ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold' : 'border-border text-muted-foreground')}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Kommentar (optional)</Label>
                            <Textarea value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                                placeholder="Hinweis an den Manager..." rows={2} className="text-sm" />
                        </div>
                        <div className="flex gap-2 pt-1">
                            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1 h-12">Abbrechen</Button>
                            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.date || !form.start_time || !form.end_time}
                                className="flex-1 h-12 bg-amber-600 hover:bg-amber-700">
                                {editing ? 'Speichern' : 'Eintragen'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}