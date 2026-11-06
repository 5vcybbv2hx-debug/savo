import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Loader2, Sparkles, CheckCircle, User, ClipboardList,
    FileCheck, ChevronDown, ChevronUp, Save, Eye, EyeOff
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STEPS = ['scribe', 'notes', 'ai', 'approve'];

const TOPIC_STATUSES = [
    { value: 'offen',         label: 'Offen',          emoji: '⬜', color: 'border-border text-muted-foreground bg-secondary/50' },
    { value: 'beschlossen',   label: 'Beschlossen',    emoji: '✅', color: 'border-status-ok/40 text-status-ok bg-status-ok/10' },
    { value: 'zu_klaeren',    label: 'Zu klären',      emoji: '🔄', color: 'border-primary/40 text-primary bg-primary/10' },
    { value: 'keine_einigung',label: 'Keine Einigung', emoji: '❌', color: 'border-destructive/40 text-destructive bg-destructive/10' },
    { value: 'vertagt',       label: 'Vertagt',        emoji: '⏭️', color: 'border-status-warn/40 text-status-warn bg-status-warn/10' },
];

// ── Schritt-Indikator ──────────────────────────────────────────────────────────
function StepIndicator({ step }) {
    const steps = [
        { key: 'scribe',  label: 'Protokollant' },
        { key: 'notes',   label: 'Notizen' },
        { key: 'ai',      label: 'KI-Protokoll' },
        { key: 'approve', label: 'Freigabe' },
    ];
    const currentIdx = steps.findIndex(s => s.key === step);

    return (
        <div className="mb-5">
            <div className="flex items-center gap-0">
                {steps.map((s, i) => (
                    <React.Fragment key={s.key}>
                        <div className="flex flex-col items-center gap-1">
                            <div className={cn(
                                'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all',
                                i < currentIdx  ? 'bg-status-ok/70 border-status-ok/70 text-white' :
                                i === currentIdx ? 'bg-primary border-primary text-primary-foreground' :
                                                   'border-border text-muted-foreground bg-background'
                            )}>
                                {i < currentIdx ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                            </div>
                            <span className={cn(
                                'text-[9px] font-medium hidden sm:block',
                                i === currentIdx ? 'text-foreground' : 'text-muted-foreground'
                            )}>{s.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={cn(
                                'flex-1 h-0.5 mb-3.5 mx-1 transition-all',
                                i < currentIdx ? 'bg-status-ok/70' : 'bg-border'
                            )} />
                        )}
                    </React.Fragment>
                ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">
                Schritt {currentIdx + 1} von {steps.length}
            </p>
        </div>
    );
}

// ── Thema-Zeile mit Chip-Status ────────────────────────────────────────────────
function TopicStatusRow({ topic, statusEntry, onChange }) {
    const [showNote, setShowNote] = useState(!!statusEntry?.notes);
    const current = statusEntry?.status || 'offen';

    return (
        <div className={cn(
            'rounded-xl border p-3 transition-all',
            current !== 'offen' ? 'border-border bg-secondary/20' : 'border-border/50 bg-card'
        )}>
            {/* Thema + Einreicher */}
            <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">{topic.topic}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {topic.employee_name}
                        {topic.priority === 'hoch' && <span className="ml-1.5 text-destructive font-medium">· Hoch</span>}
                    </p>
                </div>
                <button
                    onClick={() => setShowNote(v => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
                    title="Notiz hinzufügen"
                >
                    {showNote ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* Status-Chips horizontal scrollbar */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                {TOPIC_STATUSES.map(s => (
                    <button
                        key={s.value}
                        onClick={() => onChange({ ...statusEntry, status: s.value })}
                        className={cn(
                            'shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all whitespace-nowrap min-h-[32px]',
                            current === s.value ? s.color : 'border-border/40 text-muted-foreground bg-transparent hover:border-border'
                        )}
                    >
                        {s.emoji} {s.label}
                    </button>
                ))}
            </div>

            {/* Notiz-Feld */}
            {showNote && (
                <div className="mt-2.5">
                    <Input
                        placeholder="Kurze Notiz zu diesem Punkt…"
                        value={statusEntry?.notes || ''}
                        onChange={e => onChange({ ...statusEntry, notes: e.target.value })}
                        className="text-xs h-8 bg-background"
                        autoFocus
                    />
                </div>
            )}
        </div>
    );
}

// ── Auto-Save Indicator ────────────────────────────────────────────────────────
function SaveIndicator({ saving, lastSaved }) {
    if (saving) return (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Speichert…
        </span>
    );
    if (lastSaved) return (
        <span className="text-xs text-status-ok flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Gespeichert
        </span>
    );
    return null;
}

// ── Haupt-Modal ────────────────────────────────────────────────────────────────
export default function MeetingProtocolModal({
    open, onClose, schedule, openTopics = [], employees = [],
    isManager, currentUser, existingProtocol
}) {
    const queryClient = useQueryClient();
    const [step,          setStep]          = useState('scribe');
    const [scribeId,      setScribeId]      = useState('');
    const [liveNotes,     setLiveNotes]     = useState('');
    const [aiSummary,     setAiSummary]     = useState('');
    const [isGenerating,  setIsGenerating]  = useState(false);
    const [generateStep,  setGenerateStep]  = useState('');
    const [protocolId,    setProtocolId]    = useState(null);
    const [topicStatuses, setTopicStatuses] = useState({});
    const [lastSaved,     setLastSaved]     = useState(false);
    const [showPreview,   setShowPreview]   = useState(false);
    const autoSaveTimer = useRef(null);

    useEffect(() => {
        if (open && existingProtocol) {
            setProtocolId(existingProtocol.id);
            setScribeId(existingProtocol.scribe_employee_id);
            setLiveNotes(existingProtocol.live_notes || '');
            setAiSummary(existingProtocol.ai_summary || '');
            if (existingProtocol.topic_statuses) {
                try { setTopicStatuses(JSON.parse(existingProtocol.topic_statuses)); } catch (_) {}
            }
            setStep('notes');
        }
    }, [open, existingProtocol?.id]);

    // Auto-Save Notizen nach 3 Sekunden Pause
    useEffect(() => {
        if (!protocolId || step !== 'notes') return;
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(async () => {
            await saveDraftMutation.mutateAsync({
                live_notes: liveNotes,
                topic_statuses: JSON.stringify(topicStatuses),
            });
            setLastSaved(true);
            setTimeout(() => setLastSaved(false), 3000);
        }, 3000);
        return () => clearTimeout(autoSaveTimer.current);
    }, [liveNotes, topicStatuses, protocolId]);

    const selectedScribe = employees.find(e => e.id === scribeId);
    const meetingDate    = schedule?.date || format(new Date(), 'yyyy-MM-dd');

    const updateTopicStatus = (topicId, entry) => {
        setTopicStatuses(prev => ({ ...prev, [topicId]: entry }));
    };

    const saveDraftMutation = useMutation({
        mutationFn: (data) => protocolId
            ? base44.entities.MeetingProtocol.update(protocolId, data)
            : base44.entities.MeetingProtocol.create(data),
        onSuccess: (result) => {
            if (!protocolId && result?.id) setProtocolId(result.id);
            queryClient.invalidateQueries({ queryKey: ['meeting-protocols'] });
        }
    });

    const approveMutation = useMutation({
        mutationFn: async () => {
            const topicUpdates = openTopics.map(t => {
                const ts = topicStatuses[t.id];
                let newStatus = t.status;
                if (['beschlossen', 'zu_klaeren', 'keine_einigung'].includes(ts?.status)) newStatus = 'besprochen';
                else if (ts?.status === 'vertagt') newStatus = 'offen';
                else newStatus = 'besprochen';
                return base44.entities.TeamMeetingTopic.update(t.id, {
                    status: newStatus,
                    discussed_at: new Date().toISOString(),
                    manager_notes: ts?.notes
                        ? (t.manager_notes ? t.manager_notes + '\n' + ts.notes : ts.notes)
                        : t.manager_notes
                });
            });
            await Promise.all(topicUpdates);

            const agendaSnapshot = JSON.stringify(openTopics.map(t => ({
                id: t.id, topic: t.topic, description: t.description,
                priority: t.priority,
                status: topicStatuses[t.id]?.status || 'besprochen',
                protocol_notes: topicStatuses[t.id]?.notes || '',
                employee_name: t.employee_name,
                manager_notes: t.manager_notes,
            })));

            return base44.entities.MeetingProtocol.update(protocolId, {
                ai_summary: aiSummary,
                topic_statuses: JSON.stringify(topicStatuses),
                agenda_snapshot: agendaSnapshot,
                status: 'freigegeben',
                approved_by: currentUser?.full_name || currentUser?.email,
                approved_at: new Date().toISOString(),
                topics_marked_discussed: openTopics.map(t => t.id),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting-protocols'] });
            queryClient.invalidateQueries({ queryKey: ['meeting-topics'] });
            toast.success('Protokoll freigegeben ✓');
            onClose();
            resetState();
        },
        onError: () => toast.error('Fehler bei der Freigabe'),
    });

    const resetState = () => {
        setStep('scribe'); setScribeId(''); setLiveNotes('');
        setAiSummary(''); setProtocolId(null); setTopicStatuses({});
        setGenerateStep(''); setShowPreview(false);
    };

    const handleScribeNext = async () => {
        if (!scribeId) return;
        await saveDraftMutation.mutateAsync({
            meeting_date:      meetingDate,
            meeting_time:      schedule?.time || '',
            meeting_location:  schedule?.location || '',
            scribe_employee_id:   scribeId,
            scribe_employee_name: selectedScribe?.name || '',
            live_notes: '', status: 'entwurf',
        });
        setStep('notes');
    };

    const handleNotesNext = async () => {
        await saveDraftMutation.mutateAsync({
            live_notes: liveNotes,
            topic_statuses: JSON.stringify(topicStatuses),
            status: 'entwurf',
        });
        setStep('ai');
    };

    const handleGenerateAI = async () => {
        setIsGenerating(true);
        setGenerateStep('Analysiere Agendapunkte…');

        const topicsList = openTopics.map(t => {
            const ts    = topicStatuses[t.id];
            const label = TOPIC_STATUSES.find(s => s.value === (ts?.status || 'offen'))?.label || '';
            return `- ${t.topic}${t.description ? ` (${t.description})` : ''} → ${label}${ts?.notes ? ` | Notiz: ${ts.notes}` : ''}${t.manager_notes ? ` | Manager: ${t.manager_notes}` : ''} [Prio: ${t.priority}]`;
        }).join('\n');

        const headerLine = [
            format(new Date(meetingDate), 'EEEE, dd. MMMM yyyy', { locale: de }),
            schedule?.time ? schedule.time + ' Uhr' : '',
            schedule?.location || '',
        ].filter(Boolean).join(' \u00b7 ');

        const prompt = [
            'Du bist Protokollant für ein professionelles Gastronomie-Team.',
            'Erstelle das Teamsitzungsprotokoll EXAKT in diesem Format. Halte dich strikt an die Struktur.',
            'Keine Markdown-Symbole wie # * _ oder **. Trennlinien sind genau 40 Bindestriche.',
            '',
            '========================================',
            'PROTOKOLL \u2014 TEAMSITZUNG',
            headerLine,
            'Protokollant: ' + (selectedScribe?.name || 'Unbekannt'),
            '========================================',
            '',
            'AGENDA-PUNKTE',
            '',
            topicsList || '(keine Agenda-Punkte vorhanden)',
            '',
            '----------------------------------------',
            'BESCHLÜSSE & MASSNAHMEN',
            '',
            'Extrahiere alle konkreten Handlungspunkte aus Agenda und Notizen.',
            'Format je Massnahme (eine pro Zeile):',
            '-> [Name oder "Team"] -- [Was genau] -- bis [Datum falls bekannt, sonst "zeitnah"]',
            '',
            'Falls keine erkennbar: "(keine Massnahmen beschlossen)"',
            '',
            '----------------------------------------',
            'OFFENE PUNKTE / NÄCHSTE SITZUNG',
            '',
            'Liste vertagte oder ungeklärte Punkte auf. Falls keine: "(keine offenen Punkte)"',
            '',
            '========================================',
            '',
            'Live-Notizen (zur Auswertung):',
            liveNotes || '(keine)',
            '',
            'Wichtig: Knappe, präzise Sprache. Keine Füllsätze. Keine Wiederholungen.',
        ].join('\n');

        try {
            setGenerateStep('Schreibe Protokoll…');
            const result = await base44.integrations.Core.InvokeLLM({ prompt });
            setAiSummary(result);
            setGenerateStep('Speichere Entwurf…');
            await saveDraftMutation.mutateAsync({ ai_summary: result, status: 'wartet_auf_freigabe' });
            setStep('approve');
        } catch (e) {
            toast.error('KI-Generierung fehlgeschlagen');
        } finally {
            setIsGenerating(false);
            setGenerateStep('');
        }
    };

    const statusSummary = openTopics.reduce((acc, t) => {
        const s = topicStatuses[t.id]?.status || 'offen';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    const beschlossenCount = statusSummary['beschlossen'] || 0;
    const offenCount       = statusSummary['offen']       || openTopics.length;

    return (
        <Dialog open={open} onOpenChange={() => { onClose(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-status-warn" />
                        Sitzungsprotokoll
                    </DialogTitle>
                </DialogHeader>

                <StepIndicator step={step} />

                {/* ── Schritt 1: Protokollant ──────────────────────────────── */}
                {step === 'scribe' && (
                    <div className="space-y-4">
                        <div className="bg-secondary/30 rounded-xl p-3.5 text-sm space-y-1">
                            <p className="font-semibold text-foreground">
                                📅 {format(new Date(meetingDate), 'EEEE, dd. MMMM yyyy', { locale: de })}
                                {schedule?.time && (' \u00b7 ' + schedule.time + ' Uhr')}
                            </p>
                            {schedule?.location && <p className="text-muted-foreground text-xs">📍 {schedule.location}</p>}
                            <p className="text-xs text-muted-foreground mt-1">
                                {openTopics.length} offene Agenda-Punkte
                            </p>
                        </div>

                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground mb-2 block">
                                Wer schreibt heute das Protokoll?
                            </Label>
                            <Select value={scribeId} onValueChange={setScribeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Protokollant auswählen…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedScribe && (
                            <>
                                <Card className="bg-status-warn/5 border-status-warn/30">
                                    <CardContent className="p-3 flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                                            style={{ backgroundColor: selectedScribe.color || '#f59e0b' }}>
                                            {selectedScribe.name?.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-foreground">{selectedScribe.name}</p>
                                            <p className="text-xs text-muted-foreground">{selectedScribe.role}</p>
                                        </div>
                                        <Badge className="bg-status-warn/20 text-status-warn border border-status-warn/30 shrink-0">
                                            Protokollant
                                        </Badge>
                                    </CardContent>
                                </Card>
                                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground">
                                    💡 <strong className="text-foreground">{selectedScribe.name}</strong> öffnet auf seinem Gerät die Teamsitzungsseite und klickt auf "Protokoll führen" — dort kann er Live-Notizen schreiben und Punkte abhaken.
                                </div>
                            </>
                        )}

                        <div className="flex justify-end pt-1">
                            <Button
                                onClick={handleScribeNext}
                                disabled={!scribeId || saveDraftMutation.isPending}
                            >
                                {saveDraftMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                Sitzung starten →
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── Schritt 2: Agenda + Notizen ──────────────────────────── */}
                {step === 'notes' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                Protokollant: <strong className="text-foreground">{selectedScribe?.name || '—'}</strong>
                            </p>
                            <SaveIndicator saving={saveDraftMutation.isPending} lastSaved={lastSaved} />
                        </div>

                        {/* Agenda-Punkte */}
                        {openTopics.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        AGENDA-PUNKTE ({openTopics.length})
                                    </Label>
                                    {beschlossenCount > 0 && (
                                        <span className="text-xs text-status-ok font-medium">
                                            ✓ {beschlossenCount} beschlossen
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 -mr-1">
                                    {openTopics.map(t => (
                                        <TopicStatusRow
                                            key={t.id}
                                            topic={t}
                                            statusEntry={topicStatuses[t.id]}
                                            onChange={entry => updateTopicStatus(t.id, entry)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Live-Notizen — volle Größe */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground">
                                LIVE-NOTIZEN
                            </Label>
                            <Textarea
                                value={liveNotes}
                                onChange={e => setLiveNotes(e.target.value)}
                                placeholder={"Weitere Punkte, Diskussionen, spontane Themen…\n- z.B. Neue Öffnungszeiten ab Juli\n- Max übernimmt die Getränkebestellung\n- Nächste Sitzung: 15. August"}
                                rows={8}
                                className="font-mono text-sm leading-relaxed resize-y min-h-[160px]"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Wird automatisch gespeichert · KI fasst Agenda + Notizen im nächsten Schritt zusammen
                            </p>
                        </div>

                        <div className="flex justify-between pt-1">
                            <Button variant="outline" onClick={() => setStep('scribe')}>← Zurück</Button>
                            <Button onClick={handleNotesNext} disabled={saveDraftMutation.isPending}>
                                {saveDraftMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                Weiter →
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── Schritt 3: KI-Protokoll generieren ──────────────────── */}
                {step === 'ai' && (
                    <div className="space-y-4">
                        {/* Zusammenfassung was generiert wird */}
                        <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2 text-sm">
                            <p className="font-semibold text-foreground">Was wird generiert?</p>
                            <div className="space-y-1 text-xs text-muted-foreground">
                                <p>📋 {openTopics.length} Agenda-Punkte mit ihren Ergebnissen</p>
                                {liveNotes && <p>📝 Deine Live-Notizen ({liveNotes.split('\n').filter(Boolean).length} Zeilen)</p>}
                                <p>🤖 KI erstellt daraus ein strukturiertes Protokoll</p>
                            </div>
                        </div>

                        {/* Status-Übersicht */}
                        {openTopics.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                                {TOPIC_STATUSES.filter(s => statusSummary[s.value] > 0).map(s => (
                                    <Badge key={s.value} className={cn('text-xs border', s.color)}>
                                        {s.emoji} {statusSummary[s.value]}× {s.label}
                                    </Badge>
                                ))}
                                {!Object.values(statusSummary).some(Boolean) && (
                                    <p className="text-xs text-muted-foreground">Alle Punkte als "Besprochen" gewertet</p>
                                )}
                            </div>
                        )}

                        {/* Generieren-Button + Animation */}
                        {!isGenerating ? (
                            <Button onClick={handleGenerateAI} className="w-full h-12 text-base gap-2">
                                <Sparkles className="w-5 h-5" />
                                Protokoll generieren
                            </Button>
                        ) : (
                            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center space-y-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                                <p className="text-sm font-semibold text-foreground">{generateStep}</p>
                                <p className="text-xs text-muted-foreground">Das dauert normalerweise 10–20 Sekunden…</p>
                            </div>
                        )}

                        <div className="flex justify-between pt-1">
                            <Button variant="outline" onClick={() => setStep('notes')} disabled={isGenerating}>← Zurück</Button>
                        </div>
                    </div>
                )}

                {/* ── Schritt 4: Freigabe mit Preview ─────────────────────── */}
                {step === 'approve' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">Protokoll prüfen & freigeben</p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowPreview(v => !v)}
                                className="text-xs gap-1.5 text-muted-foreground"
                            >
                                {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                {showPreview ? 'Bearbeiten' : 'Vorschau'}
                            </Button>
                        </div>

                        {/* Preview oder Edit */}
                        {showPreview ? (
                            <div className="rounded-xl border border-border bg-secondary/20 p-4 max-h-72 overflow-y-auto">
                                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                                    {aiSummary || 'Kein Protokolltext vorhanden.'}
                                </pre>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">PROTOKOLLTEXT BEARBEITEN</Label>
                                <Textarea
                                    value={aiSummary}
                                    onChange={e => setAiSummary(e.target.value)}
                                    rows={10}
                                    className="font-mono text-sm leading-relaxed resize-y min-h-[200px]"
                                    placeholder="Protokolltext…"
                                />
                            </div>
                        )}

                        {/* Hinweis was passiert bei Freigabe */}
                        <div className="rounded-xl bg-status-ok/10 border border-status-ok/20 px-4 py-3 text-xs text-status-ok space-y-1">
                            <p className="font-semibold">Bei Freigabe passiert Folgendes:</p>
                            <p>✓ Protokoll wird für das Team sichtbar</p>
                            <p>✓ {openTopics.length} Agenda-Punkte werden als besprochen markiert</p>
                            <p>✓ Status wechselt zu "Freigegeben"</p>
                        </div>

                        <div className="flex gap-3 pt-1">
                            <Button variant="outline" onClick={() => setStep('ai')} className="flex-1">
                                ← Zurück
                            </Button>
                            <Button
                                onClick={() => approveMutation.mutate()}
                                disabled={approveMutation.isPending || !aiSummary}
                                className="flex-1 bg-status-ok/70 hover:bg-status-ok/70 text-white gap-2"
                            >
                                {approveMutation.isPending
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird freigegeben…</>
                                    : <><FileCheck className="w-4 h-4" /> Freigeben</>
                                }
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}