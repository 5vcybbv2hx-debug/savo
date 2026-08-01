import React, { useState } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { Plus, Calendar as CalendarIcon, Trash2, Edit, Search, Lightbulb } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import SavedFilters from '@/components/filters/SavedFilters';
import { usePermissions } from '@/components/auth/usePermissions';
import EventArchive from '@/components/events/EventArchive';
import EventIdeas from '@/components/events/EventIdeas';
import CalendarSubscribe from '@/components/events/CalendarSubscribe';
import LocalEventsTab from '@/components/events/LocalEventsTab';

const eventTypeColors = {
    'Party': 'bg-purple-100 text-purple-700 border-purple-200',
    'Livemusik': 'bg-pink-100 text-pink-700 border-pink-200',
    'DJ-Night': 'bg-blue-100 text-blue-700 border-blue-200',
    'Special Event': 'bg-amber-100 text-amber-700 border-amber-200',
    'Private Feier': 'bg-green-100 text-green-700 border-green-200',
    'Sonstiges': 'bg-muted text-foreground border-border'
};

const statusColors = {
    'geplant': 'bg-yellow-100 text-yellow-700',
    'bestätigt': 'bg-green-100 text-green-700',
    'abgesagt': 'bg-red-100 text-red-700'
};

const formatDateWithDay = (dateStr) => {
    const date = parseISO(dateStr);
    return format(date, 'EEEE, dd. MMMM yyyy', { locale: de });
};

export default function Events() {
    const queryClient = useQueryClient();
    const permissions = usePermissions();
    const canEdit = permissions.canEditEvents;
    const [activeTab, setActiveTab] = useState('upcoming');
    const [showLocalEvents, setShowLocalEvents] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('alle');
    const [statusFilter, setStatusFilter] = useState('alle');
    const [confirmDialog, setConfirmDialog] = useState(null); // { type: 'delete'|'cancel', id, onConfirm }
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        date: '',
        start_time: '',
        end_time: '',
        event_type: 'Party',
        expected_guests: '',
        entry_fee: '',
        artist_name: '',
        responsible_person: '',
        budget: '',
        actual_guests: '',
        notes: '',
        status: 'geplant'
    });

    const { data: allEvents = [] } = useQuery({
        queryKey: ['events'],
        queryFn: () => base44.entities.Event.list('date', 500),
        staleTime: STALE.MEDIUM,
    });

    const { data: allIdeas = [] } = useQuery({
        queryKey: ['eventIdeas'],
        queryFn: () => base44.entities.EventIdea.list('-created_date', 200),
        staleTime: STALE.MEDIUM,
    });

    const now = new Date();
    const upcomingEvents = allEvents.filter(e => new Date(e.date) >= now);
    const archiveEvents = allEvents.filter(e => new Date(e.date) < now);

    const events = upcomingEvents.filter(event => {
        const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'alle' || event.event_type === typeFilter;
        const matchesStatus = statusFilter === 'alle' || event.status === statusFilter;
        return matchesSearch && matchesType && matchesStatus;
    });

    // ── Event → DisplaySlide Sync ────────────────────────────────────────────
    const syncEventToDisplay = async (event, eventId) => {
        try {
            // Existierende Slide für dieses Event suchen (via cta_text als Event-ID-Tag)
            const allSlides = await base44.entities.DisplaySlide.list('sort_order', 200);
            const existingSlide = allSlides.find(s => s.cta_text === `event:${eventId}`);
            const maxOrder = allSlides.reduce((m, s) => Math.max(m, s.sort_order || 0), 0);
            const payload = {
                title:            event.title,
                subtitle:         event.artist_name ? `mit ${event.artist_name}` : (event.event_type || 'Event'),
                body_text:        event.description || '',
                slide_type:       'event',
                background_theme: 'event',
                event_date:       event.date || '',
                event_time:       event.start_time || '',
                price_info:       event.entry_fee ? `Eintritt: ${event.entry_fee} €` : 'Eintritt frei',
                cta_text:         `event:${eventId}`,
                is_active:        event.status !== 'abgesagt',
                show_from:        event.date || '',
                show_until:       event.date || '',
                sort_order:       existingSlide ? existingSlide.sort_order : maxOrder + 10,
            };
            if (existingSlide) {
                await base44.entities.DisplaySlide.update(existingSlide.id, payload);
            } else {
                await base44.entities.DisplaySlide.create(payload);
            }
            queryClient.invalidateQueries({ queryKey: ['display-slides'] });
        } catch (err) {
            console.warn('[Events] DisplaySlide-Sync fehlgeschlagen:', err);
        }
    };

    const removeEventFromDisplay = async (eventId) => {
        try {
            const allSlides = await base44.entities.DisplaySlide.list('sort_order', 200);
            const slide = allSlides.find(s => s.cta_text === `event:${eventId}`);
            if (slide) {
                await base44.entities.DisplaySlide.update(slide.id, { is_active: false });
                queryClient.invalidateQueries({ queryKey: ['display-slides'] });
            }
        } catch (err) {
            console.warn('[Events] DisplaySlide deaktivieren fehlgeschlagen:', err);
        }
    };


    const createMutation = useMutation({
        mutationFn: async (data) => {
            const created = await base44.entities.Event.create(data);
            await syncEventToDisplay(data, created.id);
            return created;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            closeModal();
            toast.success('Event gespeichert & auf TV-Display aktualisiert');
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            const updated = await base44.entities.Event.update(id, data);
            await syncEventToDisplay(data, id);
            return updated;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            closeModal();
            toast.success('Event aktualisiert & TV-Display synchronisiert');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            await removeEventFromDisplay(id);
            return base44.entities.Event.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            toast.success('Event gelöscht & von TV-Display entfernt');
        }
    });

    const createIdeaMutation = useMutation({
        mutationFn: (data) => base44.entities.EventIdea.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['eventIdeas'] });
        }
    });

    const updateIdeaMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.EventIdea.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['eventIdeas'] });
        }
    });

    const deleteIdeaMutation = useMutation({
        mutationFn: (id) => base44.entities.EventIdea.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['eventIdeas'] });
        }
    });

    const openModal = (event = null) => {
        if (event) {
            setSelectedEvent(event);
            setFormData({
                title: event.title,
                description: event.description || '',
                date: event.date,
                start_time: event.start_time || '',
                end_time: event.end_time || '',
                event_type: event.event_type || 'Party',
                expected_guests: event.expected_guests || '',
                entry_fee: event.entry_fee || '',
                artist_name: event.artist_name || '',
                responsible_person: event.responsible_person || '',
                budget: event.budget || '',
                actual_guests: event.actual_guests || '',
                notes: event.notes || '',
                status: event.status || 'geplant'
            });
        } else {
            setSelectedEvent(null);
            setFormData({
                title: '',
                description: '',
                date: '',
                start_time: '20:00',
                end_time: '02:00',
                event_type: 'Party',
                expected_guests: '',
                entry_fee: '',
                artist_name: '',
                responsible_person: '',
                budget: '',
                actual_guests: '',
                notes: '',
                status: 'geplant'
            });
        }
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedEvent(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Confirm if changing to "abgesagt"
        if (selectedEvent && selectedEvent.status !== 'abgesagt' && formData.status === 'abgesagt') {
            setConfirmDialog({
                type: 'cancel',
                message: 'Event wirklich absagen? Diese Aktion kann nicht rückgängig gemacht werden.',
                onConfirm: () => {
                    setConfirmDialog(null);
                    if (selectedEvent) {
                        updateMutation.mutate({ id: selectedEvent.id, data: formData });
                    } else {
                        createMutation.mutate(formData);
                    }
                }
            });
            return;
        }
        
        // Zahlenfelder korrekt konvertieren
        const cleanData = {
            ...formData,
            expected_guests: formData.expected_guests !== '' ? Number(formData.expected_guests) : null,
            entry_fee:        formData.entry_fee        !== '' ? Number(formData.entry_fee)        : null,
            budget:           formData.budget           !== '' ? Number(formData.budget)           : null,
            actual_guests:    formData.actual_guests    !== '' ? Number(formData.actual_guests)    : null,
        };

        if (selectedEvent) {
            updateMutation.mutate({ id: selectedEvent.id, data: cleanData });
        } else {
            createMutation.mutate(cleanData);
        }
    };

    const handleDelete = (id) => {
        setConfirmDialog({
            type: 'delete',
            message: 'Event wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
            onConfirm: () => {
                setConfirmDialog(null);
                deleteMutation.mutate(id);
            }
        });
    };

    const handleConvertIdeaToEvent = (idea) => {
        setActiveTab('upcoming');
        openModal(null);
        setFormData({
            title: idea.title,
            description: idea.description || '',
            date: '',
            start_time: '20:00',
            end_time: '02:00',
            event_type: idea.category || 'Party',
            expected_guests: '',
            entry_fee: '',
            artist_name: '',
            responsible_person: '',
            budget: '',
            actual_guests: '',
            notes: idea.notes || `Umgewandelt von Idee: ${idea.title}`,
            status: 'geplant'
        });
    };

    const sortedEvents = [...events].sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        if (!a.start_time) return 1;
        if (!b.start_time) return -1;
        return a.start_time.localeCompare(b.start_time);
    });

    const sortedArchiveEvents = [...archiveEvents].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });

    return (
        <div className="min-h-screen bg-background animate-page-enter pb-24 md:pb-0">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Events</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            {upcomingEvents.length} kommend · {archiveEvents.length} archiviert · {allIdeas.length} Ideen
                        </p>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {canEdit && (
                    <Button 
                        size="sm"
                        onClick={() => { setActiveTab('upcoming'); openModal(); }}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 shadow-lg shadow-amber-500/20 text-xs h-9"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Event</span>
                        <span className="sm:hidden">+</span>
                    </Button>
                    )}
                    <div className="text-xs text-muted-foreground p-2">
                        iCal-Export wird in Kürze verfügbar.
                    </div>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="bg-card border-border border w-full grid grid-cols-3 h-auto">
                        <TabsTrigger value="upcoming" className="text-xs sm:text-sm">Kommend</TabsTrigger>
                        <TabsTrigger value="archive" className="text-xs sm:text-sm">Archiv</TabsTrigger>
                        <TabsTrigger value="ideas" className="text-xs sm:text-sm flex items-center gap-1"><Lightbulb className="w-3 h-3" /></TabsTrigger>
                    </TabsList>

                    {/* Upcoming Events Tab */}
                    <TabsContent value="upcoming" className="space-y-4">
                        <Card className="p-4 bg-card border-border">
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Event suchen..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9 bg-background border-border"
                                        />
                                    </div>
                                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                                        <SelectTrigger className="w-full sm:w-40 bg-background border-border">
                                            <SelectValue placeholder="Typ" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="alle">Alle Typen</SelectItem>
                                            <SelectItem value="Party">Party</SelectItem>
                                            <SelectItem value="Livemusik">Livemusik</SelectItem>
                                            <SelectItem value="Special Event">Special Event</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-full sm:w-40 bg-background border-border">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="alle">Alle Status</SelectItem>
                                            <SelectItem value="geplant">Geplant</SelectItem>
                                            <SelectItem value="bestätigt">Bestätigt</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <SavedFilters
                                    storageKey="events_saved_filters"
                                    currentFilters={{ searchTerm, typeFilter, statusFilter }}
                                    onApplyFilter={(filters) => {
                                        setSearchTerm(filters.searchTerm || '');
                                        setTypeFilter(filters.typeFilter || 'alle');
                                        setStatusFilter(filters.statusFilter || 'alle');
                                    }}
                                />
                            </div>
                        </Card>

                        {sortedEvents.length > 0 ? (
                            <div className="space-y-3">
                                {sortedEvents.map((event, idx) => (
                                    <Card 
                                        key={event.id}
                                        style={{ '--delay': `${idx*50}ms` }}
                                        className={cn("p-5 bg-card border-border animate-stagger transition-colors", canEdit && "hover:bg-accent/5 cursor-pointer")}
                                        onClick={() => canEdit && openModal(event)}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                    <CalendarIcon className="w-5 h-5 text-amber-400" />
                                                    <h3 className="font-semibold text-foreground text-lg">{event.title}</h3>
                                                    <Badge className={eventTypeColors[event.event_type]}>
                                                        {event.event_type}
                                                    </Badge>
                                                    <Badge className={statusColors[event.status]}>
                                                        {event.status}
                                                    </Badge>
                                                </div>
                                                
                                                {event.description && (
                                                    <p className="text-sm text-muted-foreground mb-3">{event.description}</p>
                                                )}
                                                
                                                <div className="flex flex-wrap items-center gap-4 text-sm">
                                                    <div className="flex items-center gap-2 text-foreground">
                                                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                                                        <span>{formatDateWithDay(event.date)}</span>
                                                    </div>
                                                    
                                                    {event.start_time && (
                                                        <div className="flex items-center gap-2 text-foreground">
                                                            <span>🕐</span>
                                                            <span>{event.start_time}{event.end_time && ` - ${event.end_time}`}</span>
                                                        </div>
                                                    )}
                                                    
                                                    {event.expected_guests && (
                                                        <div className="flex items-center gap-2 text-foreground">
                                                            <span>👥</span>
                                                            <span>{event.expected_guests} Gäste</span>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {event.notes && (
                                                    <p className="text-xs text-muted-foreground mt-2 italic">{event.notes}</p>
                                                )}
                                            </div>
                                            
                                            {canEdit && (
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openModal(event);
                                                    }}
                                                    className="h-8 w-8 text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(event.id);
                                                    }}
                                                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            )}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card className="p-12 bg-card border-border">
                                <div className="text-center text-muted-foreground">
                                    <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium">Keine Events gefunden</p>
                                    <p className="text-sm mt-1">
                                        {searchTerm || typeFilter !== 'alle' || statusFilter !== 'alle' 
                                            ? 'Versuche andere Filter' 
                                            : 'Füge dein erstes Event hinzu'}
                                    </p>
                                </div>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Archive Tab */}
                    <TabsContent value="archive" className="space-y-4">
                        <EventArchive
                            events={sortedArchiveEvents}
                            onEdit={canEdit ? openModal : null}
                            onDelete={canEdit ? handleDelete : null}
                            canEdit={canEdit}
                        />
                    </TabsContent>

                    {/* Ideas Tab */}
                    <TabsContent value="ideas" className="space-y-4">
                        <EventIdeas
                            ideas={allIdeas}
                            onAdd={canEdit ? (data) => createIdeaMutation.mutate(data) : null}
                            onEdit={canEdit ? ({ id, data }) => updateIdeaMutation.mutate({ id, data }) : null}
                            onDelete={canEdit ? (id) => deleteIdeaMutation.mutate(id) : null}
                            onConvertToEvent={canEdit ? handleConvertIdeaToEvent : null}
                            canEdit={canEdit}
                        />
                    </TabsContent>
                </Tabs>

                {/* Event Modal — only accessible when canEdit */}
                <Dialog open={modalOpen && canEdit} onOpenChange={closeModal}>
                    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {selectedEvent ? 'Event bearbeiten' : 'Neues Event'}
                            </DialogTitle>
                        </DialogHeader>
                        
                        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Titel *</Label>
                                <Input
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="z.B. 80s Party Night"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Beschreibung</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Details zum Event..."
                                    rows={3}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Event-Art</Label>
                                    <Select value={formData.event_type} onValueChange={(v) => setFormData({ ...formData, event_type: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Party">Party</SelectItem>
                                            <SelectItem value="Livemusik">Livemusik</SelectItem>
                                            <SelectItem value="DJ-Night">DJ-Night</SelectItem>
                                            <SelectItem value="Special Event">Special Event</SelectItem>
                                            <SelectItem value="Private Feier">Private Feier</SelectItem>
                                            <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="geplant">Geplant</SelectItem>
                                            <SelectItem value="bestätigt">Bestätigt</SelectItem>
                                            <SelectItem value="abgesagt">Abgesagt</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Datum *</Label>
                                <Input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Startzeit</Label>
                                    <Input
                                        type="time"
                                        value={formData.start_time}
                                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Endzeit</Label>
                                    <Input
                                        type="time"
                                        value={formData.end_time}
                                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Erwartete Gästeanzahl</Label>
                                <Input
                                    type="number"
                                    value={formData.expected_guests}
                                    onChange={(e) => setFormData({ ...formData, expected_guests: e.target.value })}
                                    placeholder="z.B. 150"
                                />
                            </div>

                            {canEdit && (
                                <>
                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                                        <div className="space-y-2">
                                            <Label>Eintritt (€)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={formData.entry_fee}
                                                onChange={(e) => setFormData({ ...formData, entry_fee: e.target.value })}
                                                placeholder="z.B. 10.00"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Budget (€)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={formData.budget}
                                                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                                                placeholder="z.B. 500.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Künstler / DJ</Label>
                                            <Input
                                                value={formData.artist_name}
                                                onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
                                                placeholder="z.B. DJ Max"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Verantwortlich</Label>
                                            <Input
                                                value={formData.responsible_person}
                                                onChange={(e) => setFormData({ ...formData, responsible_person: e.target.value })}
                                                placeholder="z.B. Max Schmidt"
                                            />
                                        </div>
                                    </div>

                                    {selectedEvent && new Date(formData.date) < now && (
                                        <div className="space-y-2">
                                            <Label>Tatsächliche Gäste</Label>
                                            <Input
                                                type="number"
                                                value={formData.actual_guests}
                                                onChange={(e) => setFormData({ ...formData, actual_guests: e.target.value })}
                                                placeholder="z.B. 120"
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="space-y-2">
                                <Label>Notizen</Label>
                                <Textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Zusätzliche Infos..."
                                    rows={2}
                                />
                            </div>

                            <div className="flex gap-2 pt-4">
                                <Button type="button" variant="outline" onClick={closeModal} className="flex-1 border-border text-muted-foreground hover:bg-accent">
                                    Abbrechen
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 shadow-lg shadow-amber-500/20 disabled:opacity-60">
                                    {(createMutation.isPending || updateMutation.isPending) ? 'Speichern...' : (selectedEvent ? 'Speichern' : 'Hinzufügen')}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Confirm Dialog */}
                {confirmDialog && (
                    <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
                        <DialogContent className="sm:max-w-sm">
                            <DialogHeader>
                                <DialogTitle>
                                    {confirmDialog.type === 'delete' ? 'Event löschen' : 'Event absagen'}
                                </DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-muted-foreground py-2">{confirmDialog.message}</p>
                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" onClick={() => setConfirmDialog(null)} className="flex-1 border-border text-muted-foreground hover:bg-accent">
                                    Abbrechen
                                </Button>
                                <Button
                                    onClick={confirmDialog.onConfirm}
                                    className={`flex-1 ${confirmDialog.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'} text-white`}
                                >
                                    {confirmDialog.type === 'delete' ? 'Löschen' : 'Absagen'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        </div>
    );
}