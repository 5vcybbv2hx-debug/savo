import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, MessageSquare, CheckCircle, Clock, AlertCircle,
    Archive, RotateCcw, ThumbsUp, ThumbsDown, Settings,
    Send, ClipboardList, FileText, MoreHorizontal, Pencil,
    Trash2, Check, Flag, ChevronRight, Users, CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/components/auth/usePermissions';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import TeamMeetingPrintView from '@/components/team-meeting/TeamMeetingPrintView';
import MeetingProtocolModal from '@/components/team-meeting/MeetingProtocolModal';
import MeetingProtocolList from '@/components/team-meeting/MeetingProtocolList';
import ProvisionalReviewPanel from '@/components/provisional/ProvisionalReviewPanel';

// ── Semantic Badge helpers ────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
    const map = {
        hoch:   'bg-destructive/15 text-destructive border-destructive/30',
        normal: 'bg-secondary text-muted-foreground border-border',
        niedrig:'bg-primary/10 text-primary border-primary/20',
    };
    const labels = { hoch: '🔴 Hoch', normal: 'Normal', niedrig: '🔵 Niedrig' };
    return (
        <Badge className={cn('text-[10px] border font-medium', map[priority] || map.normal)}>
            {labels[priority] || priority}
        </Badge>
    );
}

function StatusBadge({ status }) {
    const map = {
        offen:      'bg-amber-500/15 text-amber-500 border-amber-500/30',
        besprochen: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        erledigt:   'bg-green-500/15 text-green-500 border-green-500/30',
    };
    const icons = { offen: Clock, besprochen: MessageSquare, erledigt: CheckCircle };
    const Icon = icons[status] || Clock;
    return (
        <Badge className={cn('text-[10px] border font-medium gap-1', map[status] || map.offen)}>
            <Icon className="w-2.5 h-2.5" />
            {status === 'offen' ? 'Offen' : status === 'besprochen' ? 'Besprochen' : 'Erledigt'}
        </Badge>
    );
}

// ── Thema-Karte ───────────────────────────────────────────────────────────────
function TopicCard({ topic, isManager, onOpen, onStatusChange, onDelete }) {
    const isGermany = topic.is_germany_game;
    return (
        <button
            onClick={() => onOpen(topic)}
            className={cn(
                'w-full text-left rounded-xl border bg-card p-3.5 transition-all active:scale-[0.99]',
                'hover:border-border/80 hover:bg-accent/20',
                topic.priority === 'hoch' ? 'border-destructive/30' : 'border-border',
            )}
        >
            <div className="flex items-start gap-3">
                {/* Priority dot */}
                <div className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    topic.priority === 'hoch'   ? 'bg-destructive' :
                    topic.priority === 'niedrig' ? 'bg-primary' : 'bg-muted-foreground/40'
                )} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm text-foreground truncate">
                            {topic.topic}
                        </span>
                        <StatusBadge status={topic.status} />
                        {topic.priority === 'hoch' && <PriorityBadge priority="hoch" />}
                    </div>

                    {topic.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {topic.description}
                        </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>von {topic.employee_name || 'Unbekannt'}</span>
                        {topic.created_date && (
                            <span>{format(new Date(topic.created_date), 'd. MMM', { locale: de })}</span>
                        )}
                        {topic.manager_notes && (
                            <span className="text-amber-500 flex items-center gap-1">
                                <Pencil className="w-2.5 h-2.5" /> Notiz
                            </span>
                        )}
                    </div>
                </div>

                {/* Quick actions für Manager */}
                {isManager && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); onStatusChange(topic, 'besprochen'); }}>
                                <MessageSquare className="w-4 h-4 mr-2 text-purple-400" /> Als besprochen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); onStatusChange(topic, 'erledigt'); }}>
                                <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Als erledigt
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); onStatusChange(topic, 'offen'); }}>
                                <RotateCcw className="w-4 h-4 mr-2 text-amber-500" /> Wieder öffnen
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={e => { e.stopPropagation(); onDelete(topic); }}
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Löschen
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </button>
    );
}

// ── Termin-Card ───────────────────────────────────────────────────────────────
function ScheduleCard({ schedule, rsvpData, currentEmployee, onRsvp, isManager }) {
    const [showRsvpList, setShowRsvpList] = React.useState(false);
    if (!schedule) return null;

    // ── NUR RSVPs für diesen konkreten Termin filtern ──────────────────────
    const scheduleRsvps = rsvpData.filter(r => r.meeting_date === schedule.date);
    const myRsvp  = scheduleRsvps.find(r => r.employee_id === currentEmployee?.id)?.status;
    const zusagen = scheduleRsvps.filter(r => r.status === 'zusage');
    const absagen = scheduleRsvps.filter(r => r.status === 'absage');

    return (
        <div className="rounded-xl border border-border bg-card p-4 mb-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">
                        {format(new Date(schedule.date), 'EEEE, dd. MMMM yyyy', { locale: de })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        🕐 {schedule.time} Uhr
                        {schedule.location && <> · 📍 {schedule.location}</>}
                    </p>
                    {/* RSVP Zähler — klickbar für Detailansicht */}
                    {(zusagen.length > 0 || absagen.length > 0) && (
                        <button
                            onClick={() => setShowRsvpList(v => !v)}
                            className="flex gap-3 mt-2 text-xs hover:opacity-80 transition-opacity"
                        >
                            <span className="text-green-500">✓ {zusagen.length} Zusagen</span>
                            <span className="text-destructive">✗ {absagen.length} Absagen</span>
                            <span className="text-muted-foreground">{showRsvpList ? '▲' : '▼'}</span>
                        </button>
                    )}
                </div>

                {/* RSVP Buttons — nur wenn Mitarbeiter angemeldet */}
                {currentEmployee && (
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={() => onRsvp('zusage')}
                            className={cn(
                                'min-h-[44px] min-w-[44px] rounded-xl border text-sm font-semibold transition-all px-3',
                                myRsvp === 'zusage'
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'border-border text-muted-foreground hover:border-green-500/50 hover:text-green-500'
                            )}
                        >
                            ✓
                        </button>
                        <button
                            onClick={() => onRsvp('absage')}
                            className={cn(
                                'min-h-[44px] min-w-[44px] rounded-xl border text-sm font-semibold transition-all px-3',
                                myRsvp === 'absage'
                                    ? 'bg-destructive border-destructive text-white'
                                    : 'border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive'
                            )}
                        >
                            ✗
                        </button>
                    </div>
                )}
            </div>

            {/* Aufklappbare Namensliste */}
            {showRsvpList && (
                <div className="border-t border-border/50 pt-3 grid grid-cols-2 gap-3">
                    {zusagen.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-1.5">
                                ✓ Zusagen ({zusagen.length})
                            </p>
                            <div className="space-y-1">
                                {zusagen.map(r => (
                                    <p key={r.id} className="text-xs text-foreground">
                                        {r.employee_name || '—'}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
                    {absagen.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-destructive uppercase tracking-wider mb-1.5">
                                ✗ Absagen ({absagen.length})
                            </p>
                            <div className="space-y-1">
                                {absagen.map(r => (
                                    <p key={r.id} className="text-xs text-foreground">
                                        {r.employee_name || '—'}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Leerer Zustand ────────────────────────────────────────────────────────────
function EmptyState({ tab, onAdd }) {
    const config = {
        offen:      { icon: '📋', title: 'Keine offenen Themen', sub: 'Reiche ein Thema für die nächste Sitzung ein.' },
        besprochen: { icon: '💬', title: 'Noch nichts besprochen', sub: 'Themen erscheinen hier sobald sie in der Sitzung behandelt wurden.' },
        archiv:     { icon: '📦', title: 'Archiv ist leer', sub: 'Als erledigt markierte Themen landen automatisch hier.' },
    };
    const { icon, title, sub } = config[tab] || config.offen;
    return (
        <div className="text-center py-14">
            <p className="text-4xl mb-3">{icon}</p>
            <p className="font-semibold text-foreground mb-1">{title}</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">{sub}</p>
            {tab === 'offen' && (
                <Button size="sm" onClick={onAdd} className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-1.5" /> Thema einreichen
                </Button>
            )}
        </div>
    );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function TeamMeeting() {
    const queryClient  = useQueryClient();
    const permissions  = usePermissions();

    const [activeTab,         setActiveTab]         = useState('agenda');
    const [agendaFilter,      setAgendaFilter]      = useState('offen');
    const [modalOpen,         setModalOpen]         = useState(false);
    const [detailModalOpen,   setDetailModalOpen]   = useState(false);
    const [selectedTopic,     setSelectedTopic]     = useState(null);
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [printViewOpen,     setPrintViewOpen]     = useState(false);
    const [protocolModalOpen, setProtocolModalOpen] = useState(false);
    const [editMode,          setEditMode]          = useState(false);
    const [editFormData,      setEditFormData]      = useState({ topic: '', description: '', priority: 'normal' });
    const [scheduleData,      setScheduleData]      = useState({ date: '', time: '', location: '', notes: '' });
    const [formData,          setFormData]          = useState({ topic: '', description: '', priority: 'normal' });
    const [notes,             setNotes]             = useState('');

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: schedules = [] } = useQuery({
        queryKey: ['meeting-schedules'],
        queryFn:  () => base44.entities.TeamMeetingSchedule.list('-date', 10),
        staleTime: 60_000,
    });

    const { data: rsvpData = [] } = useQuery({
        queryKey: ['meeting-rsvp'],
        queryFn:  () => base44.entities.TeamMeetingRSVP.list('-created_date', 200),
        staleTime: 30_000,
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn:  () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: 120_000,
    });

    const { data: currentUser } = useQuery({
        queryKey: ['current-user'],
        queryFn:  () => base44.auth.me(),
        staleTime: 120_000,
    });

    const currentEmployee = employees.find(e => e.email === currentUser?.email);
    const currentSchedule = schedules[0] || null;

    // Themen sind privat: nur die eigene Person + Manager sehen ein Thema.
    // Manager sehen alle Themen (fürs Vorbereiten der Sitzung), alle anderen
    // ausschließlich ihre eigenen eingereichten Punkte.
    const { data: topics = [] } = useQuery({
        queryKey: ['meeting-topics', permissions.isManager, currentEmployee?.id],
        queryFn:  () => permissions.isManager
            ? base44.entities.TeamMeetingTopic.list('-created_date', 200)
            : base44.entities.TeamMeetingTopic.filter({ employee_id: currentEmployee.id }, '-created_date', 200),
        enabled: !permissions.isLoading && (permissions.isManager || !!currentEmployee?.id),
        staleTime: 30_000,
    });

    // Ist der aktuelle User der Protokollant?
    const isScribe = currentSchedule?.scribe_employee_id === currentEmployee?.id;

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.TeamMeetingTopic.create(data),
        onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['meeting-topics'] }); setModalOpen(false); setFormData({ topic: '', description: '', priority: 'normal' }); toast.success('Thema eingereicht'); },
        onError:    () => toast.error('Fehler beim Speichern'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.TeamMeetingTopic.update(id, data),
        onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['meeting-topics'] }),
        onError:    () => toast.error('Fehler beim Aktualisieren'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.TeamMeetingTopic.delete(id),
        onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['meeting-topics'] }); setDetailModalOpen(false); toast.success('Thema gelöscht'); },
        onError:    () => toast.error('Fehler beim Löschen'),
    });

    const scheduleMutation = useMutation({
        mutationFn: async (data) => {
            if (currentSchedule) {
                const oldRsvps = rsvpData.filter(r => r.meeting_date === currentSchedule.date);
                await Promise.all(oldRsvps.map(r => base44.entities.TeamMeetingRSVP.delete(r.id)));
                return base44.entities.TeamMeetingSchedule.update(currentSchedule.id, data);
            }
            return base44.entities.TeamMeetingSchedule.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting-schedules'] });
            queryClient.invalidateQueries({ queryKey: ['meeting-rsvp'] });
            setScheduleModalOpen(false);
            toast.success('Termin gespeichert — alle Zusagen wurden zurückgesetzt');
        },
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const rsvpMutation = useMutation({
        mutationFn: async (status) => {
            const existing = rsvpData.find(r =>
                r.employee_id === currentEmployee?.id && r.meeting_date === currentSchedule?.date
            );
            const payload = { employee_id: currentEmployee.id, meeting_date: currentSchedule.date, status, employee_name: currentEmployee.name };
            return existing
                ? base44.entities.TeamMeetingRSVP.update(existing.id, payload)
                : base44.entities.TeamMeetingRSVP.create(payload);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meeting-rsvp'] }),
    });

    // ── Handler ───────────────────────────────────────────────────────────────
    const handleSubmit = () => {
        if (!formData.topic.trim()) return;
        createMutation.mutate({
            ...formData,
            employee_name: currentEmployee?.name || currentUser?.email || 'Anonym',
            employee_id:   currentEmployee?.id || '',
            status:        'offen',
            is_archived:   false,
        });
    };

    const handleStatusChange = (topic, newStatus) => {
        const data = { ...topic, status: newStatus };
        if (newStatus === 'erledigt') {
            // Erledigt = fertig besprochen -> wandert automatisch ins Archiv,
            // taucht nicht mehr in der aktuellen Agenda auf.
            data.is_archived = true;
            data.archived_at = new Date().toISOString();
            data.discussed_at = data.discussed_at || new Date().toISOString();
        } else if (newStatus === 'offen') {
            // "Wieder öffnen" holt ein Thema (auch aus dem Archiv) zurück in die aktive Liste.
            data.is_archived = false;
            data.archived_at = null;
        }
        updateMutation.mutate({ id: topic.id, data });
        toast.success(newStatus === 'erledigt' ? 'Erledigt & archiviert' : newStatus === 'besprochen' ? 'Als besprochen markiert' : 'Wieder geöffnet');
    };

    const handleDelete = (topic) => {
        deleteMutation.mutate(topic.id);
    };

    const handleNotesSave = () => {
        updateMutation.mutate({ id: selectedTopic.id, data: { ...selectedTopic, manager_notes: notes } });
        toast.success('Notiz gespeichert');
    };

    const openDetail = (topic) => {
        setSelectedTopic(topic);
        setEditMode(false);
        setEditFormData({ topic: topic.topic, description: topic.description || '', priority: topic.priority });
        setNotes(topic.manager_notes || '');
        setDetailModalOpen(true);
    };

    const handleEditSave = () => {
        updateMutation.mutate({ id: selectedTopic.id, data: { ...selectedTopic, ...editFormData } }, {
            onSuccess: () => { setEditMode(false); toast.success('Gespeichert'); }
        });
    };

    const handleWhatsApp = () => {
        if (!currentSchedule) return;
        const datum    = format(new Date(currentSchedule.date), 'EEEE, dd.MM.yyyy', { locale: de });
        const ort      = currentSchedule.location ? `\n📍 Ort: ${currentSchedule.location}` : '';
        const notizen  = currentSchedule.notes    ? `\n💬 ${currentSchedule.notes}`          : '';
        const appUrl   = window.location.origin + '/TeamMeeting';
        const text =
            `📋 *Erinnerung: Teamsitzung*\n\n📅 ${datum}\n🕐 ${currentSchedule.time} Uhr${ort}${notizen}\n\n` +
            `Bitte bis morgen Bescheid geben:\n${appUrl}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    // ── Gefilterte Themen ─────────────────────────────────────────────────────
    const activeTopics   = topics.filter(t => !t.is_archived);
    const archivedTopics = topics.filter(t =>  t.is_archived);

    // 'erledigt' gibt es als Filter-Chip nicht mehr: sobald ein Thema erledigt
    // ist, wird es automatisch archiviert (siehe handleStatusChange) und taucht
    // stattdessen im Archiv-Tab auf.
    const agendaGroups = {
        offen:      activeTopics.filter(t => t.status === 'offen'),
        besprochen: activeTopics.filter(t => t.status === 'besprochen'),
    };
    const visibleTopics = agendaGroups[agendaFilter] || [];

    const openCount     = agendaGroups.offen.length;
    const besprochenCount = agendaGroups.besprochen.length;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-3xl mx-auto px-4 pt-5 pb-24 md:pb-8 space-y-4">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <Users className="w-4.5 h-4.5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground leading-none">Teamsitzung</h1>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {openCount > 0 ? `${openCount} offene Punkte` : 'Agenda verwalten'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Haupt-Action */}
                        <Button
                            size="sm"
                            onClick={() => setModalOpen(true)}
                            className="bg-primary hover:bg-primary/90 h-9"
                        >
                            <Plus className="w-4 h-4 mr-1.5" />
                            <span className="hidden sm:inline">Thema</span>
                        </Button>

                        {/* Manager-Aktionen im Dropdown */}
                        {permissions.isManager && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuItem onClick={() => { setScheduleData(currentSchedule || { date:'', time:'', location:'', notes:'' }); setScheduleModalOpen(true); }}>
                                        <Settings className="w-4 h-4 mr-2" /> Termin festlegen
                                    </DropdownMenuItem>
                                    {currentSchedule && (
                                        <DropdownMenuItem onClick={handleWhatsApp}>
                                            <Send className="w-4 h-4 mr-2 text-green-500" /> WhatsApp Erinnerung
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setPrintViewOpen(true)}>
                                        <FileText className="w-4 h-4 mr-2" /> Agenda drucken
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setProtocolModalOpen(true)}>
                                        <ClipboardList className="w-4 h-4 mr-2 text-amber-400" /> Protokoll erstellen
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* Protokoll für Protokollanten */}
                        {!permissions.isManager && isScribe && (
                            <Button size="sm" onClick={() => setProtocolModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 h-9">
                                <ClipboardList className="w-4 h-4 mr-1.5" /> Protokoll
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Termin-Card ─────────────────────────────────────────── */}
                {currentSchedule && (
                    <ScheduleCard
                        schedule={currentSchedule}
                        rsvpData={rsvpData}
                        currentEmployee={currentEmployee}
                        onRsvp={(status) => rsvpMutation.mutate(status)}
                        isManager={permissions.isManager}
                    />
                )}
                {!currentSchedule && permissions.isManager && (
                    <button
                        onClick={() => { setScheduleData({ date:'', time:'', location:'', notes:'' }); setScheduleModalOpen(true); }}
                        className="w-full rounded-xl border border-dashed border-border bg-card p-4 flex items-center gap-3 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                        <CalendarDays className="w-5 h-5" />
                        <span className="text-sm">Termin für nächste Sitzung festlegen…</span>
                    </button>
                )}

                {/* ── Tabs ────────────────────────────────────────────────── */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="agenda" className="text-xs gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5" />
                            Agenda
                            {openCount > 0 && <span className="ml-1 bg-amber-500 text-white text-[9px] font-bold rounded-full px-1.5">{openCount}</span>}
                        </TabsTrigger>
                        <TabsTrigger value="schichtwünsche" className="text-xs gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5" /> Wünsche
                        </TabsTrigger>
                        <TabsTrigger value="archiv" className="text-xs gap-1.5">
                            <Archive className="w-3.5 h-3.5" /> Archiv
                        </TabsTrigger>
                        <TabsTrigger value="protokolle" className="text-xs gap-1.5">
                            <ClipboardList className="w-3.5 h-3.5" /> Protokolle
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Agenda Tab ── */}
                    <TabsContent value="agenda" className="space-y-3 mt-3">
                        {/* Status-Filter Chips */}
                        <div className="flex gap-2">
                            {[
                                { id: 'offen',      label: 'Offen',      count: agendaGroups.offen.length },
                                { id: 'besprochen', label: 'Besprochen', count: agendaGroups.besprochen.length },
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setAgendaFilter(f.id)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                        agendaFilter === f.id
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                                    )}
                                >
                                    {f.label}
                                    {f.count > 0 && (
                                        <span className={cn(
                                            'text-[9px] font-bold rounded-full px-1.5',
                                            agendaFilter === f.id ? 'bg-white/20 text-white' : 'bg-secondary text-muted-foreground'
                                        )}>
                                            {f.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Themen-Liste */}
                        {visibleTopics.length === 0 ? (
                            <EmptyState tab={agendaFilter} onAdd={() => setModalOpen(true)} />
                        ) : (
                            <div className="space-y-2">
                                {visibleTopics
                                    .sort((a, b) => {
                                        const prio = { hoch: 0, normal: 1, niedrig: 2 };
                                        return (prio[a.priority] ?? 1) - (prio[b.priority] ?? 1);
                                    })
                                    .map(topic => (
                                        <TopicCard
                                            key={topic.id}
                                            topic={topic}
                                            isManager={permissions.isManager}
                                            onOpen={openDetail}
                                            onStatusChange={handleStatusChange}
                                            onDelete={handleDelete}
                                        />
                                    ))
                                }
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Schichtwünsche Tab ── */}
                    <TabsContent value="schichtwünsche" className="mt-3">
                        <ProvisionalReviewPanel />
                    </TabsContent>

                    {/* ── Archiv Tab ── */}
                    <TabsContent value="archiv" className="mt-3">
                        {archivedTopics.length === 0 ? (
                            <EmptyState tab="archiv" onAdd={() => {}} />
                        ) : (
                            <div className="space-y-2">
                                {archivedTopics.map(topic => (
                                    <TopicCard
                                        key={topic.id}
                                        topic={topic}
                                        isManager={permissions.isManager}
                                        onOpen={openDetail}
                                        onStatusChange={handleStatusChange}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Protokolle Tab ── */}
                    <TabsContent value="protokolle" className="mt-3">
                        <MeetingProtocolList isManager={permissions.isManager} />
                    </TabsContent>
                </Tabs>
            </div>

            {/* ── Thema einreichen Modal ───────────────────────────────────── */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" /> Thema einreichen
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Thema *</Label>
                            <Input
                                placeholder="Worum geht es?"
                                value={formData.topic}
                                onChange={e => setFormData(f => ({ ...f, topic: e.target.value }))}
                                autoFocus
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Beschreibung</Label>
                            <Textarea
                                placeholder="Mehr Details (optional)…"
                                value={formData.description}
                                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                                rows={3}
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Priorität</Label>
                            <Select value={formData.priority} onValueChange={v => setFormData(f => ({ ...f, priority: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="niedrig">🔵 Niedrig</SelectItem>
                                    <SelectItem value="normal">⚪ Normal</SelectItem>
                                    <SelectItem value="hoch">🔴 Hoch</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Abbrechen</Button>
                            <Button onClick={handleSubmit} disabled={!formData.topic.trim() || createMutation.isPending} className="flex-1">
                                {createMutation.isPending ? 'Wird eingereicht…' : 'Einreichen'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Detail Modal ─────────────────────────────────────────────── */}
            {selectedTopic && (
                <Dialog open={detailModalOpen} onOpenChange={v => { if (!v) { setDetailModalOpen(false); setEditMode(false); }}}>
                    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 flex-wrap pr-8">
                                <StatusBadge status={selectedTopic.status} />
                                <PriorityBadge priority={selectedTopic.priority} />
                            </DialogTitle>
                        </DialogHeader>

                        {editMode ? (
                            <div className="space-y-4 mt-2">
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Thema</Label>
                                    <Input value={editFormData.topic} onChange={e => setEditFormData(f => ({ ...f, topic: e.target.value }))} />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Beschreibung</Label>
                                    <Textarea value={editFormData.description} onChange={e => setEditFormData(f => ({ ...f, description: e.target.value }))} rows={3} />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Priorität</Label>
                                    <Select value={editFormData.priority} onValueChange={v => setEditFormData(f => ({ ...f, priority: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="niedrig">🔵 Niedrig</SelectItem>
                                            <SelectItem value="normal">⚪ Normal</SelectItem>
                                            <SelectItem value="hoch">🔴 Hoch</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="outline" onClick={() => setEditMode(false)} className="flex-1">Abbrechen</Button>
                                    <Button onClick={handleEditSave} className="flex-1">Speichern</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 mt-2">
                                <div>
                                    <p className="font-semibold text-foreground text-base">{selectedTopic.topic}</p>
                                    {selectedTopic.description && (
                                        <p className="text-sm text-muted-foreground mt-1">{selectedTopic.description}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Eingereicht von {selectedTopic.employee_name}
                                        {selectedTopic.created_date && ` · ${format(new Date(selectedTopic.created_date), 'd. MMMM yyyy', { locale: de })}`}
                                    </p>
                                </div>

                                {/* Manager-Notizen */}
                                {permissions.isManager && (
                                    <div>
                                        <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Manager-Notiz</Label>
                                        <Textarea
                                            placeholder="Interne Notiz (nur für Manager sichtbar)…"
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            rows={2}
                                        />
                                        <Button size="sm" variant="outline" onClick={handleNotesSave} className="mt-2">
                                            Notiz speichern
                                        </Button>
                                    </div>
                                )}

                                {/* Status-Aktionen */}
                                {permissions.isManager && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <Button size="sm" variant="outline" onClick={() => { handleStatusChange(selectedTopic, 'besprochen'); setDetailModalOpen(false); }}>
                                            <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-purple-400" /> Besprochen
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => { handleStatusChange(selectedTopic, 'erledigt'); setDetailModalOpen(false); }}>
                                            <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-green-500" /> Erledigt
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => { handleStatusChange(selectedTopic, 'offen'); setDetailModalOpen(false); }}>
                                            <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> Wieder öffnen
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setEditMode(true)}>
                                            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Bearbeiten
                                        </Button>
                                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(selectedTopic)}>
                                            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Löschen
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            )}

            {/* ── Termin Modal ─────────────────────────────────────────────── */}
            <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-primary" />
                            {currentSchedule ? 'Termin ändern' : 'Termin festlegen'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        {currentSchedule && (
                            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-500">
                                <span className="mt-0.5 shrink-0">⚠️</span>
                                <span>Beim Ändern werden alle bisherigen Zu- und Absagen zurückgesetzt, damit das Team neu abstimmen kann.</span>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1.5 block">Datum *</Label>
                                <Input type="date" value={scheduleData.date} onChange={e => setScheduleData(s => ({ ...s, date: e.target.value }))} />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1.5 block">Uhrzeit *</Label>
                                <Input type="time" value={scheduleData.time} onChange={e => setScheduleData(s => ({ ...s, time: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Ort</Label>
                            <Input placeholder="z.B. Konferenzraum, Online…" value={scheduleData.location || ''} onChange={e => setScheduleData(s => ({ ...s, location: e.target.value }))} />
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Notizen</Label>
                            <Textarea placeholder="Hinweise für das Team…" value={scheduleData.notes || ''} onChange={e => setScheduleData(s => ({ ...s, notes: e.target.value }))} rows={2} />
                        </div>
                        <div className="flex gap-3 pt-1">
                            <Button variant="outline" onClick={() => setScheduleModalOpen(false)} className="flex-1">Abbrechen</Button>
                            <Button
                                onClick={() => scheduleMutation.mutate(scheduleData)}
                                disabled={!scheduleData.date || !scheduleData.time || scheduleMutation.isPending}
                                className="flex-1"
                            >
                                {scheduleMutation.isPending ? 'Wird gespeichert…' : currentSchedule ? 'Termin ändern' : 'Termin speichern'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Print & Protocol ─────────────────────────────────────────── */}
            {printViewOpen && (
                <TeamMeetingPrintView
                    topics={activeTopics}
                    schedule={currentSchedule}
                    onClose={() => setPrintViewOpen(false)}
                />
            )}
            {protocolModalOpen && (
                <MeetingProtocolModal
                    open={protocolModalOpen}
                    onClose={() => setProtocolModalOpen(false)}
                    topics={activeTopics}
                    schedule={currentSchedule}
                    employees={employees}
                    currentEmployee={currentEmployee}
                    isManager={permissions.isManager}
                />
            )}
        </div>
    );
}