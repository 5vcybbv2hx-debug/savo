import React, { useState } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MapPin, Trash2, Edit, Repeat, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const categoryConfig = {
    concert: { label: 'Konzert', icon: '🎵', color: 'bg-pink-100 text-pink-700 border-pink-200' },
    festival: { label: 'Festival', icon: '🎪', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    sports: { label: 'Sport', icon: '⚽', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    market: { label: 'Markt', icon: '🛒', color: 'bg-green-100 text-green-700 border-green-200' },
    community: { label: 'Stadt/Community', icon: '🏘️', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    holiday: { label: 'Feiertag', icon: '🎉', color: 'bg-red-100 text-red-700 border-red-200' },
    other: { label: 'Sonstiges', icon: '📍', color: 'bg-muted text-foreground border-border' },
};

const impactConfig = {
    small: { label: 'Wenig', color: 'text-green-600' },
    medium: { label: 'Mittel', color: 'text-amber-600' },
    large: { label: 'Groß!', color: 'text-red-600' },
};

const recurrenceLabels = {
    none: 'Einmalig',
    annual_fixed: 'Jährlich (fest)',
    annual_floating: 'Jährlich (variabel)',
    irregular: 'Unregelmäßig',
};

const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const weekLabels = { first: '1.', second: '2.', third: '3.', fourth: '4.', last: 'Letzte' };

function getRecurrenceDescription(event) {
    if (event.recurrence_pattern === 'none') return null;
    if (event.recurrence_pattern === 'annual_fixed') {
        return `Jährlich am ${format(parseISO(event.event_date), 'dd.MM.')}`;
    }
    if (event.recurrence_pattern === 'annual_floating') {
        const month = event.recurrence_base_month ? format(new Date(2000, event.recurrence_base_month - 1, 1), 'MMMM', { locale: de }) : '';
        const week = event.recurrence_week ? weekLabels[event.recurrence_week] : '';
        const day = event.recurrence_weekday != null ? weekdays[event.recurrence_weekday] : '';
        return `Jährlich ${week} ${day} im ${month}`;
    }
    return 'Unregelmäßig';
}

export default function LocalEventsTab() {
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [filter, setFilter] = useState('upcoming');

    const { data: events = [] } = useQuery({
        queryKey: ['local-events'],
        queryFn: () => base44.entities.LocalEvent.list('event_date', 500),
        staleTime: 60 * 1000,
    });

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = events.filter(e => e.event_date >= today && e.is_active !== false);
    const past = events.filter(e => e.event_date < today);
    const recurring = events.filter(e => e.recurrence_pattern !== 'none');
    const displayed = filter === 'upcoming' ? upcoming : filter === 'past' ? past : recurring;

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.LocalEvent.create(data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['local-events'] }); toast.success('Event erstellt'); setModalOpen(false); setEditingEvent(null); },
        onError: (e) => toast.error('Fehler: ' + e.message),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.LocalEvent.update(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['local-events'] }); toast.success('Aktualisiert'); setModalOpen(false); setEditingEvent(null); },
        onError: (e) => toast.error('Fehler: ' + e.message),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.LocalEvent.delete(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['local-events'] }); toast.success('Gelöscht'); },
    });

    const handleSave = (formData) => {
        const data = {
            ...formData,
            staff_adjustment: formData.staff_adjustment ? parseInt(formData.staff_adjustment) : 0,
            recurrence_base_month: formData.recurrence_base_month ? parseInt(formData.recurrence_base_month) : null,
            recurrence_weekday: formData.recurrence_weekday !== '' ? parseInt(formData.recurrence_weekday) : null,
        };
        if (editingEvent) updateMutation.mutate({ id: editingEvent.id, data });
        else createMutation.mutate(data);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h2 className="text-lg font-semibold">Veranstaltungen Umgebung</h2>
                    <p className="text-sm text-muted-foreground">Feste, Konzerte, Märkte — alles was den Barbetrieb beeinflusst</p>
                </div>
                <Button onClick={() => { setEditingEvent(null); setModalOpen(true); }} size="sm">
                    <Plus className="w-4 h-4 mr-1" /> Event
                </Button>
            </div>

            <div className="flex gap-2 flex-wrap">
                {[
                    { key: 'upcoming', label: `Anstehend (${upcoming.length})` },
                    { key: 'recurring', label: `Wiederkehrend (${recurring.length})` },
                    { key: 'past', label: `Vergangen (${past.length})` },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setFilter(tab.key)}
                        className={cn('px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                            filter === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {displayed.length === 0 ? (
                <Card className="p-8 text-center">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        {filter === 'upcoming' && 'Noch keine Events. Trag Feste, Konzerte und Märkte aus Balingen & Umgebung ein — die Smart-Engine berücksichtigt sie automatisch.'}
                        {filter === 'recurring' && 'Keine wiederkehrenden Events. Setze beim Anlegen "jährlich wiederkehrend".'}
                        {filter === 'past' && 'Keine vergangenen Events.'}
                    </p>
                </Card>
            ) : (
                <div className="space-y-2">
                    {displayed.map(event => {
                        const cat = categoryConfig[event.category] || categoryConfig.other;
                        const impact = impactConfig[event.impact_level] || impactConfig.small;
                        const recDesc = getRecurrenceDescription(event);
                        return (
                            <Card key={event.id} className="p-4">
                                <div className="flex items-start gap-3">
                                    <div className="text-2xl">{cat.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-medium truncate">{event.event_name}</h3>
                                            {event.recurrence_pattern !== 'none' && (
                                                <Badge variant="outline" className="text-xs gap-1">
                                                    <Repeat className="w-3 h-3" />{recurrenceLabels[event.recurrence_pattern]}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {format(parseISO(event.event_date), 'dd. MMM yyyy', { locale: de })}
                                                {event.event_end_date && ` – ${format(parseISO(event.event_end_date), 'dd. MMM', { locale: de })}`}
                                            </span>
                                            {event.location && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="w-3.5 h-3.5" />{event.location}{event.distance_km ? ` (${event.distance_km} km)` : ''}
                                                </span>
                                            )}
                                        </div>
                                        {recDesc && <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><Repeat className="w-3 h-3" />{recDesc}</p>}
                                        {event.staff_adjustment != null && event.staff_adjustment !== 0 && (
                                            <div className="mt-1.5 flex items-center gap-1">
                                                {event.staff_adjustment > 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-600" /> : <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
                                                <span className={cn('text-xs font-medium', event.staff_adjustment > 0 ? 'text-green-600' : 'text-red-600')}>
                                                    {event.staff_adjustment > 0 ? '+' : ''}{event.staff_adjustment} Personal
                                                </span>
                                            </div>
                                        )}
                                        {event.description && <p className="text-sm text-muted-foreground mt-1">{event.description}</p>}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Badge variant="outline" className={cn('text-xs', cat.color)}>{cat.label}</Badge>
                                        <span className={cn('text-xs font-medium', impact.color)}>{impact.label}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingEvent(event); setModalOpen(true); }}>
                                            <Edit className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(`"${event.event_name}" löschen?`)) deleteMutation.mutate(event.id); }}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <EventModal open={modalOpen} onOpenChange={setModalOpen} editingEvent={editingEvent} onSave={handleSave} isLoading={createMutation.isPending || updateMutation.isPending} />
        </div>
    );
}

function EventModal({ open, onOpenChange, editingEvent, onSave, isLoading }) {
    const [form, setForm] = useState({});
    const [showRecurrence, setShowRecurrence] = useState(false);

    React.useEffect(() => {
        if (editingEvent) {
            setForm({
                event_name: editingEvent.event_name || '', event_date: editingEvent.event_date || '', event_end_date: editingEvent.event_end_date || '',
                category: editingEvent.category || 'other', impact_level: editingEvent.impact_level || 'small',
                location: editingEvent.location || '', description: editingEvent.description || '',
                recurrence_pattern: editingEvent.recurrence_pattern || 'none', recurrence_name: editingEvent.recurrence_name || '',
                recurrence_base_month: editingEvent.recurrence_base_month || '', recurrence_week: editingEvent.recurrence_week || '',
                recurrence_weekday: editingEvent.recurrence_weekday != null ? String(editingEvent.recurrence_weekday) : '',
                staff_adjustment: editingEvent.staff_adjustment || '', bar_traffic_impact: editingEvent.bar_traffic_impact || 'more',
                distance_km: editingEvent.distance_km || '', source: 'manually',
            });
            setShowRecurrence(editingEvent.recurrence_pattern !== 'none');
        } else {
            setForm({ event_name: '', event_date: '', event_end_date: '', category: 'community', impact_level: 'medium',
                location: 'Balingen', description: '', recurrence_pattern: 'none', recurrence_name: '',
                recurrence_base_month: '', recurrence_week: '', recurrence_weekday: '', staff_adjustment: '',
                bar_traffic_impact: 'more', distance_km: '', source: 'manually' });
            setShowRecurrence(false);
        }
    }, [editingEvent, open]);

    const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.event_name || !form.event_date) { toast.error('Name und Datum sind Pflicht'); return; }
        onSave(form);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingEvent ? 'Event bearbeiten' : 'Neues Event'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Event-Name *</Label>
                        <Input value={form.event_name} onChange={e => set('event_name', e.target.value)} placeholder="z.B. Balingen Stadtfest" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Startdatum *</Label>
                            <Input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Enddatum (optional)</Label>
                            <Input type="date" value={form.event_end_date} onChange={e => set('event_end_date', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Kategorie</Label>
                            <Select value={form.category} onValueChange={v => set('category', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(categoryConfig).map(([key, cfg]) => (
                                        <SelectItem key={key} value={key}>{cfg.icon} {cfg.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Einfluss auf Bar</Label>
                            <Select value={form.impact_level} onValueChange={v => set('impact_level', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="small">Wenig</SelectItem>
                                    <SelectItem value="medium">Mittel</SelectItem>
                                    <SelectItem value="large">Groß!</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Ort</Label>
                            <Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="z.B. Marktplatz" />
                        </div>
                        <div className="space-y-2">
                            <Label>Entfernung (km)</Label>
                            <Input type="number" value={form.distance_km} onChange={e => set('distance_km', e.target.value)} placeholder="0.5" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Personal-Anpassung</Label>
                            <Input type="number" value={form.staff_adjustment} onChange={e => set('staff_adjustment', e.target.value)} placeholder="+2 oder -1" />
                        </div>
                        <div className="space-y-2">
                            <Label>Barbetrieb</Label>
                            <Select value={form.bar_traffic_impact} onValueChange={v => set('bar_traffic_impact', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="more">Mehr los</SelectItem>
                                    <SelectItem value="less">Weniger los</SelectItem>
                                    <SelectItem value="neutral">Neutral</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Beschreibung</Label>
                        <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
                    </div>

                    <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-1.5"><Repeat className="w-4 h-4" /> Jährlich wiederkehrend?</Label>
                            <Select value={form.recurrence_pattern} onValueChange={v => { set('recurrence_pattern', v); setShowRecurrence(v !== 'none'); }}>
                                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Einmalig</SelectItem>
                                    <SelectItem value="annual_fixed">Jährlich (fest)</SelectItem>
                                    <SelectItem value="annual_floating">Jährlich (variabel)</SelectItem>
                                    <SelectItem value="irregular">Unregelmäßig</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {showRecurrence && (
                            <div className="space-y-2 pl-5 border-l-2 border-primary/20 ml-1">
                                <div className="space-y-1">
                                    <Label className="text-xs">Name der Serie</Label>
                                    <Input value={form.recurrence_name} onChange={e => set('recurrence_name', e.target.value)} placeholder="z.B. Balingen Stadtfest" />
                                    <p className="text-xs text-muted-foreground">Für automatische Vorschläge im nächsten Jahr</p>
                                </div>
                                {form.recurrence_pattern === 'annual_floating' && (
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Monat</Label>
                                            <Select value={form.recurrence_base_month ? String(form.recurrence_base_month) : ''} onValueChange={v => set('recurrence_base_month', v)}>
                                                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent>
                                                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                                        <SelectItem key={m} value={String(m)}>{format(new Date(2000, m-1, 1), 'MMMM', { locale: de })}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Woche</Label>
                                            <Select value={form.recurrence_week} onValueChange={v => set('recurrence_week', v)}>
                                                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(weekLabels).map(([key, label]) => (
                                                        <SelectItem key={key} value={key}>{label} Woche</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Wochentag</Label>
                                            <Select value={form.recurrence_weekday} onValueChange={v => set('recurrence_weekday', v)}>
                                                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent>
                                                    {weekdays.map((day, i) => (
                                                        <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
                                <p className="text-xs text-blue-600">System schlägt das nächste Datum automatisch vor, wenn das aktuelle vorbei ist.</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
                        <Button type="submit" disabled={isLoading}>Speichern</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
