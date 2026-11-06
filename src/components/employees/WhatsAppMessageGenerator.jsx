import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MessageCircle, Sparkles, Copy, ExternalLink, Loader2, Check, Users, User, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/FrOmvmQFvvBJvqo4CJaBPA';

const QUICK_TOPICS = [
    'Schichtplan geändert',
    'Dringende Info',
    'Meeting / Besprechung',
    'Lob / Danke',
    'Erinnerung',
    'Krankmeldung',
    'Einladung',
];

// mode: 'group' | 'single' | 'multi'
export default function WhatsAppMessageGenerator({ employees = [] }) {
    const [open, setOpen] = useState(false);
    const [keywords, setKeywords] = useState('');
    const [mode, setMode] = useState('group'); // 'group' | 'single' | 'multi'
    const [selectedIds, setSelectedIds] = useState([]); // for single: max 1, for multi: many
    const [tone, setTone] = useState('freundlich');
    const [isLoading, setIsLoading] = useState(false);

    // For single: one message string
    // For multi: array of { employee, message, copied }
    const [singleMessage, setSingleMessage] = useState('');
    const [multiMessages, setMultiMessages] = useState([]); // [{employee, message, copied}]
    const [groupMessage, setGroupMessage] = useState('');

    const [showEmployeeList, setShowEmployeeList] = useState(false);

    const activeEmployees = employees.filter(e => e.is_active !== false && e.phone);

    const toggleEmployee = (id) => {
        if (mode === 'single') {
            setSelectedIds([id]);
        } else {
            setSelectedIds(prev =>
                prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
            );
        }
    };

    const handleGenerate = async () => {
        if (!keywords.trim()) return;
        setIsLoading(true);
        setSingleMessage('');
        setMultiMessages([]);
        setGroupMessage('');

        try {
            if (mode === 'group') {
                const result = await base44.integrations.Core.InvokeLLM({
                    prompt: buildPrompt('die gesamte Team-WhatsApp-Gruppe', null, keywords, tone)
                });
                setGroupMessage(result);

            } else if (mode === 'single') {
                const emp = activeEmployees.find(e => e.id === selectedIds[0]);
                if (!emp) return;
                const result = await base44.integrations.Core.InvokeLLM({
                    prompt: buildPrompt(`${emp.name}`, emp.name, keywords, tone)
                });
                setSingleMessage(result);

            } else if (mode === 'multi') {
                // Generate all in parallel
                const emps = activeEmployees.filter(e => selectedIds.includes(e.id));
                const results = await Promise.all(
                    emps.map(emp =>
                        base44.integrations.Core.InvokeLLM({
                            prompt: buildPrompt(`${emp.name}`, emp.name, keywords, tone)
                        }).then(msg => ({ employee: emp, message: msg, copied: false }))
                    )
                );
                setMultiMessages(results);
            }
        } catch (e) {
            toast.error('Fehler beim Generieren der Nachricht');
        } finally {
            setIsLoading(false);
        }
    };

    const buildPrompt = (recipientDesc, name, kw, t) => `Erstelle eine WhatsApp-Nachricht für ein Bar-Team.
Empfänger: ${recipientDesc}${name ? ` (persönlich ansprechen mit Vorname: ${name.split(' ')[0]})` : ''}
Ton: ${t}
Stichwörter / Anlass: ${kw}

Regeln:
- WhatsApp-Formatierung verwenden (*fett*, _kursiv_)
- Kurz und prägnant (max. 5-8 Sätze)
- Passende Emojis einsetzen
- Auf Deutsch
- Keine Betreffzeile, direkt die Nachricht
- Am Ende eine kurze Handlungsaufforderung wenn sinnvoll`;

    const copyMessage = (text, index = null) => {
        navigator.clipboard.writeText(text);
        toast.success('Nachricht kopiert!');
        if (index !== null) {
            setMultiMessages(prev => prev.map((m, i) => i === index ? { ...m, copied: true } : m));
            setTimeout(() => setMultiMessages(prev => prev.map((m, i) => i === index ? { ...m, copied: false } : m)), 2000);
        }
    };

    const openWhatsApp = (message, employee = null) => {
        const encoded = encodeURIComponent(message);
        if (employee?.phone) {
            const phone = employee.phone.replace(/\D/g, '');
            window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
        } else {
            navigator.clipboard.writeText(message);
            toast.success('Nachricht kopiert! WhatsApp-Gruppe wird geöffnet...');
            setTimeout(() => window.open(WHATSAPP_GROUP_LINK, '_blank'), 800);
        }
    };

    const handleReset = () => {
        setKeywords('');
        setSingleMessage('');
        setMultiMessages([]);
        setGroupMessage('');
        setSelectedIds([]);
        setMode('group');
        setTone('freundlich');
        setShowEmployeeList(false);
    };

    const canGenerate = keywords.trim() && (
        mode === 'group' ||
        (mode === 'single' && selectedIds.length === 1) ||
        (mode === 'multi' && selectedIds.length >= 2)
    );

    const selectedEmployees = activeEmployees.filter(e => selectedIds.includes(e.id));

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) handleReset(); }}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="gap-2 border-status-ok/40 text-status-ok hover:bg-status-ok/10"
                >
                    <MessageCircle className="w-4 h-4" />
                    Nachricht erstellen
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-status-ok" />
                        WhatsApp-Nachricht Generator
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    {/* Mode Selection */}
                    <div className="space-y-2">
                        <Label>Empfänger</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'group', icon: Users, label: 'Team-Gruppe' },
                                { id: 'single', icon: User, label: 'Einzelperson' },
                                { id: 'multi', icon: Users, label: 'Mehrere Personen' },
                            ].map(({ id, icon: Icon, label }) => (
                                <button
                                    key={id}
                                    onClick={() => { setMode(id); setSelectedIds([]); setSingleMessage(''); setMultiMessages([]); setGroupMessage(''); }}
                                    className={cn(
                                        'p-2.5 rounded-xl border text-xs font-medium transition-all flex flex-col items-center gap-1',
                                        mode === id
                                            ? 'border-status-ok/60 bg-status-ok/10 text-status-ok'
                                            : 'border-border bg-card text-muted-foreground hover:bg-accent/30'
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Employee Picker */}
                    {(mode === 'single' || mode === 'multi') && (
                        <div className="space-y-2">
                            <button
                                onClick={() => setShowEmployeeList(v => !v)}
                                className="w-full flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition-all"
                            >
                                <span className="text-sm text-foreground">
                                    {selectedIds.length === 0
                                        ? 'Mitarbeiter auswählen...'
                                        : mode === 'single'
                                            ? selectedEmployees[0]?.name
                                            : `${selectedIds.length} Personen ausgewählt`}
                                </span>
                                {showEmployeeList ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            </button>

                            {showEmployeeList && (
                                <div className="rounded-xl border border-border bg-card overflow-hidden max-h-48 overflow-y-auto">
                                    {activeEmployees.map(emp => {
                                        const selected = selectedIds.includes(emp.id);
                                        return (
                                            <button
                                                key={emp.id}
                                                onClick={() => { toggleEmployee(emp.id); if (mode === 'single') setShowEmployeeList(false); }}
                                                className={cn(
                                                    'w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all hover:bg-accent/30',
                                                    selected ? 'bg-status-ok/10 text-status-ok' : 'text-foreground'
                                                )}
                                            >
                                                <div className={cn(
                                                    'w-5 h-5 rounded border flex items-center justify-center shrink-0',
                                                    selected ? 'bg-status-ok/70 border-status-ok/70' : 'border-border'
                                                )}>
                                                    {selected && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                                    style={{ backgroundColor: emp.color || '#64748b' }}>
                                                    {emp.name?.charAt(0)}
                                                </div>
                                                <span className="flex-1 text-left">{emp.name}</span>
                                                <span className="text-xs text-muted-foreground">{emp.role}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Ton */}
                    <div className="space-y-2">
                        <Label>Ton</Label>
                        <div className="flex gap-2 flex-wrap">
                            {['freundlich', 'professionell', 'dringend', 'locker', 'glücklich'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTone(t)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                                        tone === t
                                            ? 'border-status-warn/60 bg-status-warn/15 text-status-warn'
                                            : 'border-border text-muted-foreground hover:bg-accent/30'
                                    )}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Thema */}
                    <div className="space-y-2">
                        <Label>Thema / Stichwörter</Label>
                        <div className="flex gap-1.5 flex-wrap mb-2">
                            {QUICK_TOPICS.map(topic => (
                                <button
                                    key={topic}
                                    onClick={() => setKeywords(prev => prev ? `${prev}, ${topic}` : topic)}
                                    className="px-2.5 py-1 rounded-full text-xs border border-border text-muted-foreground hover:bg-accent/30 hover:text-foreground transition-all"
                                >
                                    + {topic}
                                </button>
                            ))}
                        </div>
                        <Textarea
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            placeholder="z.B. Schichttausch Samstag, jemand krank, dringend Ersatz gesucht..."
                            className="min-h-20 text-sm"
                        />
                    </div>

                    <Button
                        onClick={handleGenerate}
                        disabled={!canGenerate || isLoading}
                        className="w-full bg-gradient-to-r from-status-ok to-status-ok hover:from-status-ok hover:to-status-ok text-white"
                    >
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {mode === 'multi' ? `Generiere ${selectedIds.length} Nachrichten...` : 'Generiere...'}</>
                        ) : (
                            <><Sparkles className="w-4 h-4 mr-2" />
                            {mode === 'multi' ? `${selectedIds.length} Nachrichten generieren` : 'Nachricht generieren'}</>
                        )}
                    </Button>

                    {/* Single / Group Message */}
                    {(singleMessage || groupMessage) && (
                        <MessageCard
                            message={singleMessage || groupMessage}
                            employee={mode === 'single' ? selectedEmployees[0] : null}
                            onCopy={() => copyMessage(singleMessage || groupMessage)}
                            onOpen={() => openWhatsApp(singleMessage || groupMessage, mode === 'single' ? selectedEmployees[0] : null)}
                            onRegenerate={handleGenerate}
                            isLoading={isLoading}
                        />
                    )}

                    {/* Multi Messages */}
                    {multiMessages.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-[12px] font-medium text-muted-foreground">
                                {multiMessages.length} personalisierte Nachrichten
                            </p>
                            {multiMessages.map((item, idx) => (
                                <MessageCard
                                    key={item.employee.id}
                                    message={item.message}
                                    employee={item.employee}
                                    copied={item.copied}
                                    onCopy={() => copyMessage(item.message, idx)}
                                    onOpen={() => openWhatsApp(item.message, item.employee)}
                                    compact
                                />
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function MessageCard({ message, employee, onCopy, onOpen, onRegenerate, isLoading, compact = false, copied = false }) {
    return (
        <div className="space-y-2">
            {employee && (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: employee.color || '#64748b' }}>
                        {employee.name?.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-foreground">{employee.name}</span>
                </div>
            )}
            <div className="p-4 rounded-xl bg-status-ok/5 border border-status-ok/20">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {message}
                </p>
            </div>
            <div className="flex gap-2">
                {onRegenerate && !compact && (
                    <Button variant="outline" onClick={onRegenerate} disabled={isLoading} className="flex-1 text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />Neu
                    </Button>
                )}
                <Button
                    variant="outline"
                    onClick={onCopy}
                    className={cn('flex-1 text-xs transition-all', copied ? 'border-status-ok/40 text-status-ok' : 'border-primary/30 text-primary hover:bg-primary/10')}
                >
                    {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copied ? 'Kopiert!' : 'Kopieren'}
                </Button>
                <Button
                    onClick={onOpen}
                    className="flex-1 text-xs bg-gradient-to-r from-status-ok to-status-ok hover:from-status-ok hover:to-status-ok text-white"
                >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    {employee ? 'Senden' : 'Zur Gruppe'}
                </Button>
            </div>
        </div>
    );
}