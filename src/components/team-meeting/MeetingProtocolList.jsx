import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Lock, CheckCircle, Clock, Pencil, Trash2, MoreHorizontal, ChevronDown } from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function StatusBadge({ status }) {
    if (status === 'freigegeben')
        return <Badge className="bg-status-ok/20 text-status-ok border border-status-ok/30 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Freigegeben</Badge>;
    if (status === 'wartet_auf_freigabe')
        return <Badge className="bg-status-warn/20 text-status-warn border border-status-warn/30 text-xs"><Clock className="w-3 h-3 mr-1" />Wartet auf Freigabe</Badge>;
    return <Badge className="bg-secondary text-muted-foreground border border-border text-xs">Entwurf</Badge>;
}

// ── Protokoll-Text Renderer ──────────────────────────────────────────────────
function ProtocolTextRenderer({ text }) {
    if (!text) return (
        <div className="bg-secondary/20 rounded-xl p-4 border border-border text-sm text-muted-foreground">
            Kein Protokolltext vorhanden.
        </div>
    );

    // Splitte in Abschnitte anhand von Trennlinien (===... oder ---...)
    const lines = text.split('\n');
    const sections = [];
    let currentSection = { type: 'text', title: null, lines: [] };

    for (const line of lines) {
        const trimmed = line.trim();
        // Haupttitel (========)
        if (/^={10,}/.test(trimmed)) {
            if (currentSection.lines.length > 0) {
                sections.push(currentSection);
                currentSection = { type: 'text', title: null, lines: [] };
            }
            continue;
        }
        // Abschnitts-Trenner (--------)
        if (/^-{10,}/.test(trimmed)) {
            if (currentSection.lines.length > 0) {
                sections.push(currentSection);
                currentSection = { type: 'text', title: null, lines: [] };
            }
            continue;
        }
        // Abschnitts-Überschrift (GROSSBUCHSTABEN, kurze Zeile)
        if (/^[A-ZÄÖÜ& \/]{4,}$/.test(trimmed) && trimmed.length < 60) {
            if (currentSection.lines.length > 0) {
                sections.push(currentSection);
            }
            currentSection = { type: 'section', title: trimmed, lines: [] };
            continue;
        }
        // PROTOKOLL — Header-Zeile
        if (trimmed.startsWith('PROTOKOLL —') || trimmed.startsWith('Protokollant:') || trimmed.match(/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)/)) {
            currentSection.lines.push({ type: 'meta', text: trimmed });
            continue;
        }
        // Maßnahmen-Zeile (→)
        if (trimmed.startsWith('→')) {
            currentSection.lines.push({ type: 'action', text: trimmed.slice(1).trim() });
            continue;
        }
        // Leere Zeile
        if (!trimmed) {
            currentSection.lines.push({ type: 'empty' });
            continue;
        }
        currentSection.lines.push({ type: 'text', text: trimmed });
    }
    if (currentSection.lines.length > 0) sections.push(currentSection);

    return (
        <div className="space-y-3">
            {sections.map((section, si) => {
                const nonEmpty = section.lines.filter(l => l.type !== 'empty');
                if (nonEmpty.length === 0) return null;

                if (section.type === 'section') {
                    const isMassnahmen = section.title?.includes('MASSNAHMEN') || section.title?.includes('BESCHLÜSSE');
                    const isOffen      = section.title?.includes('OFFEN') || section.title?.includes('NÄCHSTE');

                    return (
                        <div key={si} className={cn(
                            'rounded-xl border p-3.5 space-y-2',
                            isMassnahmen ? 'border-status-ok/20 bg-status-ok/5' :
                            isOffen      ? 'border-status-warn/20 bg-status-warn/5' :
                                           'border-border bg-secondary/20'
                        )}>
                            <p className={cn(
                                'text-[10px] font-bold uppercase tracking-wider',
                                isMassnahmen ? 'text-status-ok' :
                                isOffen      ? 'text-status-warn' :
                                               'text-muted-foreground'
                            )}>
                                {isMassnahmen ? '✅ ' : isOffen ? '⏭️ ' : ''}{section.title}
                            </p>
                            <div className="space-y-1.5">
                                {section.lines.map((line, li) => {
                                    if (line.type === 'empty') return null;
                                    if (line.type === 'action') return (
                                        <div key={li} className="flex items-start gap-2 text-sm">
                                            <span className="text-status-ok font-bold mt-0.5 shrink-0">→</span>
                                            <span className="text-foreground">{line.text}</span>
                                        </div>
                                    );
                                    return (
                                        <p key={li} className="text-sm text-foreground leading-relaxed">
                                            {line.text}
                                        </p>
                                    );
                                })}
                            </div>
                        </div>
                    );
                }

                // Meta-Header (Datum etc.)
                return (
                    <div key={si} className="rounded-xl border border-border bg-card px-4 py-3 space-y-1">
                        {section.lines.filter(l => l.type !== 'empty').map((line, li) => (
                            <p key={li} className={cn(
                                'text-sm',
                                line.text?.startsWith('PROTOKOLL') ? 'font-bold text-foreground text-base' : 'text-muted-foreground'
                            )}>
                                {line.text}
                            </p>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}

// ── Detail + Edit Modal ───────────────────────────────────────────────────────
function ProtocolDetailModal({ protocol, isManager, onClose, onDeleted }) {
    const queryClient = useQueryClient();
    const [editMode, setEditMode] = useState(false);
    const [editText, setEditText] = useState(protocol.ai_summary || '');
    const [editStatus, setEditStatus] = useState(protocol.status || 'entwurf');
    const [confirmDelete, setConfirmDelete] = useState(false);

    let agendaItems = [];
    if (isManager && protocol.agenda_snapshot) {
        try { agendaItems = JSON.parse(protocol.agenda_snapshot); } catch (_) {}
    }

    const updateMutation = useMutation({
        mutationFn: (data) => base44.entities.MeetingProtocol.update(protocol.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting-protocols'] });
            setEditMode(false);
            toast.success('Protokoll gespeichert');
            onClose();
        },
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const deleteMutation = useMutation({
        mutationFn: () => base44.entities.MeetingProtocol.delete(protocol.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting-protocols'] });
            toast.success('Protokoll gelöscht');
            onClose();
            onDeleted?.();
        },
        onError: () => toast.error('Fehler beim Löschen'),
    });

    const handleSave = () => {
        updateMutation.mutate({
            ...protocol,
            ai_summary: editText,
            status: editStatus,
            ...(editStatus === 'freigegeben' && !protocol.approved_by
                ? { approved_at: new Date().toISOString() }
                : {}),
        });
    };

    return (
        <>
            <Dialog open onOpenChange={(v) => { if (!v) { setEditMode(false); onClose(); } }}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between pr-8">
                            <DialogTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-status-warn" />
                                Protokoll — {format(new Date(protocol.meeting_date), 'dd. MMMM yyyy', { locale: de })}
                            </DialogTitle>
                            {/* Manager-Aktionen */}
                            {isManager && !editMode && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                        <DropdownMenuItem onClick={() => setEditMode(true)}>
                                            <Pencil className="w-4 h-4 mr-2" /> Bearbeiten
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() => setConfirmDelete(true)}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" /> Löschen
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 mt-2">
                        {/* Meta-Infos */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-secondary/30 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">Protokollant</p>
                                <p className="font-medium text-foreground">{protocol.scribe_employee_name}</p>
                            </div>
                            <div className="bg-secondary/30 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">Status</p>
                                {editMode ? (
                                    <Select value={editStatus} onValueChange={setEditStatus}>
                                        <SelectTrigger className="h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="entwurf">Entwurf</SelectItem>
                                            <SelectItem value="wartet_auf_freigabe">Wartet auf Freigabe</SelectItem>
                                            <SelectItem value="freigegeben">Freigegeben</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <StatusBadge status={protocol.status} />
                                )}
                            </div>
                            {protocol.approved_by && (
                                <div className="bg-secondary/30 rounded-lg p-3 col-span-2">
                                    <p className="text-xs text-muted-foreground mb-1">Freigegeben von</p>
                                    <p className="font-medium text-foreground">
                                        {protocol.approved_by}
                                        {protocol.approved_at && ` · ${format(new Date(protocol.approved_at), 'dd.MM.yyyy HH:mm', { locale: de })}`}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Protokolltext */}
                        <div>
                            <Label className="text-sm font-semibold text-foreground mb-2 block">Protokoll</Label>
                            {editMode ? (
                                <Textarea
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    rows={12}
                                    className="font-mono text-sm leading-relaxed resize-y"
                                    placeholder="Protokolltext bearbeiten…"
                                />
                            ) : (
                                <ProtocolTextRenderer text={protocol.ai_summary} />
                            )}
                        </div>

                        {/* Agenda-Snapshot (nur Manager, nur lesend) */}
                        {isManager && agendaItems.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <p className="text-sm font-semibold text-foreground">Agenda-Snapshot</p>
                                    <Badge className="bg-status-warn/20 text-status-warn border border-status-warn/30 text-[10px]">
                                        <Lock className="w-2.5 h-2.5 mr-1" />Nur Manager
                                    </Badge>
                                </div>
                                <div className="space-y-2">
                                    {agendaItems.map((item, i) => (
                                        <div key={i} className="bg-secondary/30 rounded-lg p-3 text-sm border border-border/50">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="font-medium text-foreground">{item.topic}</span>
                                                <Badge className={cn('text-[10px]', item.priority === 'hoch' ? 'bg-destructive/20 text-destructive' : 'bg-secondary text-muted-foreground')}>
                                                    {item.priority}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground ml-auto">von {item.employee_name}</span>
                                            </div>
                                            {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                                            {item.manager_notes && <p className="text-xs text-status-warn mt-1">📝 {item.manager_notes}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 pt-2 justify-end">
                            {editMode ? (
                                <>
                                    <Button variant="outline" onClick={() => { setEditMode(false); setEditText(protocol.ai_summary || ''); setEditStatus(protocol.status); }}>
                                        Abbrechen
                                    </Button>
                                    <Button onClick={handleSave} disabled={updateMutation.isPending}>
                                        {updateMutation.isPending ? 'Wird gespeichert…' : 'Speichern'}
                                    </Button>
                                </>
                            ) : (
                                <Button variant="outline" onClick={onClose}>Schließen</Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Löschen-Bestätigung */}
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Protokoll löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Das Protokoll vom{' '}
                            <strong>{format(new Date(protocol.meeting_date), 'dd. MMMM yyyy', { locale: de })}</strong>{' '}
                            wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90 text-white"
                            onClick={() => deleteMutation.mutate()}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Wird gelöscht…' : 'Ja, löschen'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// ── Protokoll-Liste ───────────────────────────────────────────────────────────
export default function MeetingProtocolList({ isManager }) {
    const [selectedProtocol, setSelectedProtocol] = useState(null);

    const { data: protocols = [], isLoading } = useQuery({
        queryKey: ['meeting-protocols'],
        queryFn: () => isManager
            ? base44.entities.MeetingProtocol.list('-meeting_date', 50)
            : base44.entities.MeetingProtocol.filter({ status: 'freigegeben' }, '-meeting_date', 50),
        staleTime: 60_000,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-status-warn/70 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (protocols.length === 0) {
        return (
            <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground font-medium">Noch keine Protokolle vorhanden</p>
                <p className="text-xs text-muted-foreground mt-1">Starte eine Sitzung über den "Protokoll"-Button oben</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {protocols.map(protocol => (
                <Card
                    key={protocol.id}
                    className="bg-card border-border hover:bg-accent/20 transition-colors cursor-pointer"
                    onClick={() => setSelectedProtocol(protocol)}
                >
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-status-warn/10 border border-status-warn/30 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-status-warn" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <p className="font-semibold text-foreground text-sm">
                                    {format(new Date(protocol.meeting_date), 'dd. MMMM yyyy', { locale: de })}
                                    {protocol.meeting_time && ` · ${protocol.meeting_time} Uhr`}
                                </p>
                                <StatusBadge status={protocol.status} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {protocol.scribe_employee_name}
                                {protocol.topics_marked_discussed?.length > 0 && ` · ${protocol.topics_marked_discussed.length} Punkte besprochen`}
                            </p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    </CardContent>
                </Card>
            ))}

            {selectedProtocol && (
                <ProtocolDetailModal
                    protocol={selectedProtocol}
                    isManager={isManager}
                    onClose={() => setSelectedProtocol(null)}
                    onDeleted={() => setSelectedProtocol(null)}
                />
            )}
        </div>
    );
}