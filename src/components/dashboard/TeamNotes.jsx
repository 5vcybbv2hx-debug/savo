import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Plus, Pin, Check, Archive, Trash2, Edit3, ChevronDown, ChevronUp,
    MessageSquare, Tag, ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';

const priorityConfig = {
    normal: { label: 'Normal', color: 'bg-slate-600 text-slate-200', dot: 'bg-slate-400' },
    wichtig: { label: 'Wichtig', color: 'bg-amber-500/20 text-amber-300 border border-amber-500/30', dot: 'bg-amber-400' },
    dringend: { label: 'Dringend', color: 'bg-red-500/20 text-red-300 border border-red-500/30', dot: 'bg-red-400' }
};

const categoryColors = {
    Allgemein: 'text-slate-400',
    Wichtig: 'text-amber-400',
    Schicht: 'text-blue-400',
    Lager: 'text-orange-400',
    Gäste: 'text-green-400',
    Sonstiges: 'text-purple-400'
};

const FILTERS = ['alle', 'offen', 'wichtig', 'heute', 'angepinnt', 'erledigt'];

function NoteCard({ note, isManager, currentUserEmail, onEdit, onDelete, onPin, onDone, onArchive, onConvertToTask }) {
    const [expanded, setExpanded] = useState(false);
    const isOwn = note.author_email === currentUserEmail;
    const isLong = note.message && note.message.length > 120;
    const prio = priorityConfig[note.priority] || priorityConfig.normal;

    const dateStr = note.created_date
        ? format(parseISO(note.created_date), 'EEE, dd.MM. · HH:mm', { locale: de })
        : '';
    const editedStr = note.edited_at
        ? `Bearbeitet: ${format(parseISO(note.edited_at), 'dd.MM. HH:mm', { locale: de })}${note.edited_by_name ? ` von ${note.edited_by_name}` : ''}`
        : null;

    return (
        <Card className={cn(
            'border transition-all',
            note.is_pinned ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card',
            note.status === 'erledigt' && 'opacity-60'
        )}>
            <CardContent className="p-4">
                <div className="flex items-start gap-2 mb-2">
                    {note.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                        {note.title && (
                            <p className="text-sm font-semibold text-foreground mb-0.5 truncate">{note.title}</p>
                        )}
                        <p className={cn('text-sm text-foreground leading-relaxed', !expanded && isLong && 'line-clamp-3')}>
                            {note.message}
                        </p>
                        {isLong && (
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="text-xs text-primary mt-1 flex items-center gap-0.5 hover:underline"
                            >
                                {expanded
                                    ? <><ChevronUp className="w-3 h-3" />Weniger</>
                                    : <><ChevronDown className="w-3 h-3" />Mehr anzeigen</>}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs text-muted-foreground">{note.author_name || note.author_email}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{dateStr}</span>
                    {note.category && note.category !== 'Allgemein' && (
                        <span className={cn('text-xs font-medium', categoryColors[note.category])}>
                            <Tag className="w-2.5 h-2.5 inline mr-0.5" />{note.category}
                        </span>
                    )}
                    {note.priority !== 'normal' && (
                        <Badge className={cn('text-xs px-2 py-0', prio.color)}>{prio.label}</Badge>
                    )}
                    {note.is_for_next_shift && (
                        <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-300">Nächste Schicht</Badge>
                    )}
                    {note.status === 'erledigt' && (
                        <Badge variant="outline" className="text-xs border-green-500/40 text-green-300">Erledigt</Badge>
                    )}
                    {editedStr && (
                        <span className="text-xs text-muted-foreground italic">{editedStr}</span>
                    )}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                    {(isOwn || isManager) && note.status !== 'archiviert' && (
                        <Button size="sm" variant="ghost" onClick={() => onEdit(note)}
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
                            <Edit3 className="w-3 h-3 mr-1" />Bearbeiten
                        </Button>
                    )}
                    {isManager && (
                        <>
                            <Button size="sm" variant="ghost" onClick={() => onConvertToTask(note)}
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-blue-400">
                                <ClipboardList className="w-3 h-3 mr-1" />Als Aufgabe
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => onPin(note)}
                                className={cn('h-8 px-2 text-xs', note.is_pinned ? 'text-amber-400 hover:text-amber-300' : 'text-muted-foreground hover:text-amber-400')}>
                                <Pin className="w-3 h-3 mr-1" />{note.is_pinned ? 'Ablösen' : 'Anpinnen'}
                            </Button>
                            {note.status !== 'erledigt' && (
                                <Button size="sm" variant="ghost" onClick={() => onDone(note)}
                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-green-400">
                                    <Check className="w-3 h-3 mr-1" />Erledigt
                                </Button>
                            )}
                            {note.status !== 'archiviert' && (
                                <Button size="sm" variant="ghost" onClick={() => onArchive(note)}
                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
                                    <Archive className="w-3 h-3 mr-1" />Archiv
                                </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => onDelete(note.id)}
                                className="h-8 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10">
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function NoteForm({ initial, onSave, onClose, isManager }) {
    const [form, setForm] = useState({
        message: initial?.message || '',
        title: initial?.title || '',
        category: initial?.category || 'Allgemein',
        priority: initial?.priority || 'normal',
        is_manager_only: initial?.is_manager_only || false,
        is_for_next_shift: initial?.is_for_next_shift || false
    });

    return (
        <div className="space-y-4">
            <div>
                <Label className="text-sm">Nachricht *</Label>
                <Textarea
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    placeholder="Nachricht eingeben..."
                    rows={4}
                    className="mt-1 text-base"
                    autoFocus
                />
            </div>
            <div>
                <Label className="text-sm">Titel (optional)</Label>
                <Input
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Kurzer Betreff..."
                    className="mt-1"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-sm">Kategorie</Label>
                    <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {['Allgemein', 'Wichtig', 'Schicht', 'Lager', 'Gäste', 'Sonstiges'].map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className="text-sm">Priorität</Label>
                    <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="wichtig">Wichtig</SelectItem>
                            <SelectItem value="dringend">Dringend</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_for_next_shift}
                        onChange={e => setForm({ ...form, is_for_next_shift: e.target.checked })}
                        className="w-4 h-4 rounded accent-primary" />
                    <span className="text-sm text-foreground">Für nächste Schicht</span>
                </label>
                {isManager && (
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.is_manager_only}
                            onChange={e => setForm({ ...form, is_manager_only: e.target.checked })}
                            className="w-4 h-4 rounded accent-primary" />
                        <span className="text-sm text-foreground">Nur für Manager sichtbar</span>
                    </label>
                )}
            </div>
            <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={onClose} className="flex-1">Abbrechen</Button>
                <Button
                    onClick={() => form.message.trim() && onSave(form)}
                    disabled={!form.message.trim()}
                    className="flex-1 bg-primary text-primary-foreground"
                >
                    {initial ? 'Speichern' : 'Senden'}
                </Button>
            </div>
        </div>
    );
}

export default function TeamNotes({ isManager, currentUser, compact = false }) {
    const queryClient = useQueryClient();
    const [activeFilter, setActiveFilter] = useState('alle');
    const [modalOpen, setModalOpen] = useState(false);
    const [editNote, setEditNote] = useState(null);

    const { data: notes = [] } = useQuery({
        queryKey: ['team-notes'],
        queryFn: () => base44.entities.TeamNote.list('-created_date', 100),
        refetchInterval: 60000
    });

    useEffect(() => {
        const unsub = base44.entities.TeamNote.subscribe(() => {
            queryClient.invalidateQueries({ queryKey: ['team-notes'] });
        });
        return unsub;
    }, [queryClient]);

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.TeamNote.create(data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['team-notes'] }); toast.success('Notiz gespeichert'); },
        onError: () => toast.error('Fehler beim Speichern')
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.TeamNote.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-notes'] }),
        onError: () => toast.error('Fehler beim Aktualisieren')
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.TeamNote.delete(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['team-notes'] }); toast.success('Notiz gelöscht'); },
        onError: () => toast.error('Fehler beim Löschen')
    });

    const handleSave = async (form) => {
        if (editNote) {
            await updateMutation.mutateAsync({
                id: editNote.id,
                data: {
                    ...form,
                    edited_by_name: currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Unbekannt',
                    edited_by_email: currentUser?.email || '',
                    edited_at: new Date().toISOString(),
                }
            });
        } else {
            await createMutation.mutateAsync({
                ...form,
                author_name: currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Unbekannt',
                author_email: currentUser?.email || '',
                status: 'offen'
            });
        }
        setModalOpen(false);
        setEditNote(null);
    };

    const createTaskMutation = useMutation({
        mutationFn: (data) => base44.entities.TodoItem.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] })
    });

    const openEdit = (note) => { setEditNote(note); setModalOpen(true); };
    const handlePin = (note) => updateMutation.mutate({ id: note.id, data: { is_pinned: !note.is_pinned } });
    const handleDone = (note) => {
        if (confirm('Notiz als erledigt markieren und löschen?')) {
            deleteMutation.mutate(note.id);
        }
    };
    const handleArchive = (note) => updateMutation.mutate({ id: note.id, data: { status: 'archiviert' } });
    const handleDelete = (id) => { if (confirm('Nachricht löschen?')) deleteMutation.mutate(id); };
    const handleConvertToTask = async (note) => {
        await createTaskMutation.mutateAsync({
            title: note.title || note.message.slice(0, 80),
            description: note.message,
            priority: note.priority === 'dringend' ? 'dringend' : note.priority === 'wichtig' ? 'hoch' : 'mittel',
            status: 'offen',
            created_by: note.author_name || note.author_email || ''
        });
        // Notiz archivieren (kein Datenverlust, verschwindet aus aktiver Ansicht)
        await updateMutation.mutateAsync({ id: note.id, data: { status: 'archiviert' } });
        toast.success('✅ Aufgabe erstellt — Notiz archiviert');
    };

    const today = new Date().toISOString().split('T')[0];
    const filtered = notes.filter(n => {
        if (!isManager && n.is_manager_only) return false;
        if (n.status === 'archiviert' && activeFilter !== 'archiviert') return false;
        if (activeFilter === 'offen') return n.status === 'offen';
        if (activeFilter === 'wichtig') return n.priority === 'wichtig' || n.priority === 'dringend';
        if (activeFilter === 'heute') return n.created_date?.startsWith(today);
        if (activeFilter === 'angepinnt') return n.is_pinned;
        if (activeFilter === 'erledigt') return n.status === 'erledigt';
        return true;
    });

    const sorted = [...filtered].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_date) - new Date(a.created_date);
    });

    const openCount = notes.filter(n => n.status === 'offen' && (!n.is_manager_only || isManager)).length;
    const displayNotes = compact ? sorted.filter(n => n.status !== 'archiviert').slice(0, 3) : sorted;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <h2 className={cn('font-bold text-foreground', compact ? 'text-sm uppercase tracking-wide' : 'text-lg')}>
                        Team-Notizen
                    </h2>
                    {openCount > 0 && (
                        <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs">{openCount}</Badge>
                    )}
                </div>
                <Button
                    onClick={() => { setEditNote(null); setModalOpen(true); }}
                    className="h-9 px-3 bg-primary text-primary-foreground text-xs"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Notiz senden</span>
                    <span className="sm:hidden">+</span>
                </Button>
            </div>

            {/* Filter Chips – hidden in compact mode */}
            {!compact && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {FILTERS.map(f => (
                        <button
                            key={f}
                            onClick={() => setActiveFilter(f)}
                            className={cn(
                                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                                activeFilter === f
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card text-muted-foreground border-border hover:border-primary/30'
                            )}
                        >
                            {f === 'alle' ? 'Alle' :
                             f === 'offen' ? 'Offen' :
                             f === 'wichtig' ? '⚠ Wichtig' :
                             f === 'heute' ? 'Heute' :
                             f === 'angepinnt' ? '📌 Angepinnt' :
                             f === 'erledigt' ? '✓ Erledigt' : f}
                        </button>
                    ))}
                </div>
            )}

            {/* Notes Feed */}
            <div className="space-y-3">
                {displayNotes.map(note => (
                    <NoteCard
                        key={note.id}
                        note={note}
                        isManager={isManager}
                        currentUserEmail={currentUser?.email}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        onPin={handlePin}
                        onDone={handleDone}
                        onArchive={handleArchive}
                        onConvertToTask={handleConvertToTask}
                    />
                ))}
                {displayNotes.length === 0 && (
                    <Card className="border-dashed border-border bg-card/50">
                        <CardContent className="p-8 text-center">
                            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                            <p className="text-sm text-muted-foreground">Keine Nachrichten</p>
                        </CardContent>
                    </Card>
                )}
                {compact && sorted.length > 3 && (
                    <p className="text-xs text-center text-muted-foreground py-1">+{sorted.length - 3} weitere im Team-Tab</p>
                )}
            </div>

            {/* Modal */}
            <Dialog open={modalOpen} onOpenChange={(v) => { if (!v) { setModalOpen(false); setEditNote(null); } }}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editNote ? 'Notiz bearbeiten' : 'Neue Notiz senden'}</DialogTitle>
                    </DialogHeader>
                    <NoteForm
                        initial={editNote}
                        onSave={handleSave}
                        onClose={() => { setModalOpen(false); setEditNote(null); }}
                        isManager={isManager}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}