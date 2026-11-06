import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusColors = {
    'Bestätigt': 'bg-status-ok/15 text-status-ok',
    'Abgesagt': 'bg-status-danger/15 text-status-danger'
};

const eventTypeColors = {
    'Party': 'bg-primary text-primary border-primary',
    'Livemusik': 'bg-primary text-primary border-primary',
    'DJ-Night': 'bg-primary/15 text-primary border-primary/25',
    'Special Event': 'bg-status-warn/15 text-status-warn border-status-warn/25',
    'Private Feier': 'bg-status-ok/15 text-status-ok border-status-ok/25',
    'Sonstiges': 'bg-secondary/50 text-foreground border-border'
};

export default function EventArchive({ events, onEdit, onDelete }) {
    const [expandedId, setExpandedId] = useState(null);

    // Group events by year-month
    const groupedEvents = useMemo(() => {
        const groups = {};
        [...events].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(event => {
            const monthKey = format(parseISO(event.date), 'MMMM yyyy', { locale: de });
            if (!groups[monthKey]) groups[monthKey] = [];
            groups[monthKey].push(event);
        });
        return groups;
    }, [events]);

    const formatDateWithDay = (dateStr) => {
        const date = parseISO(dateStr);
        return format(date, 'EEEE, dd. MMMM yyyy', { locale: de });
    };

    return (
        <div className="space-y-4">
            {Object.entries(groupedEvents).map(([monthKey, monthEvents]) => (
                <div key={monthKey}>
                    <h3 className="text-[12px] font-medium text-muted-foregroundr mb-3 px-1">
                        {monthKey}
                    </h3>
                    <div className="space-y-2">
                        {monthEvents.map(event => (
                            <Card 
                                key={event.id}
                                className="bg-card border-border overflow-hidden"
                            >
                                <button
                                    onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                                    className="w-full"
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 text-left">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <CardTitle className="text-base text-foreground">
                                                        {event.title}
                                                    </CardTitle>
                                                    <Badge className={eventTypeColors[event.event_type]} variant="outline">
                                                        {event.event_type}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatDateWithDay(event.date)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge className={statusColors[event.status]}>
                                                    {event.status}
                                                </Badge>
                                                {expandedId === event.id ? (
                                                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                </button>

                                {expandedId === event.id && (
                                    <CardContent className="pb-4 pt-0 space-y-3 border-t border-border">
                                        {event.start_time && (
                                            <div>
                                                <p className="text-[12px] text-muted-foreground">Zeit</p>
                                                <p className="text-sm text-foreground/75">
                                                    {event.start_time}{event.end_time && ` - ${event.end_time}`}
                                                </p>
                                            </div>
                                        )}

                                        {event.description && (
                                            <div>
                                                <p className="text-[12px] text-muted-foreground">Beschreibung</p>
                                                <p className="text-sm text-foreground/75">{event.description}</p>
                                            </div>
                                        )}

                                        {event.expected_guests && (
                                            <div>
                                                <p className="text-[12px] text-muted-foreground">Erwartete Gäste</p>
                                                <p className="text-sm text-foreground/75">{event.expected_guests}</p>
                                            </div>
                                        )}

                                        {event.notes && (
                                            <div>
                                                <p className="text-[12px] text-muted-foreground">Notizen</p>
                                                <p className="text-sm text-foreground/75 italic">{event.notes}</p>
                                            </div>
                                        )}

                                        <div className="flex gap-2 pt-2 border-t border-border">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEdit(event);
                                                }}
                                                className="flex-1 text-foreground/75 hover:text-status-warn hover:bg-status-warn/10"
                                            >
                                                <Edit className="w-3 h-3 mr-1" />
                                                Bearbeiten
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(event.id);
                                                }}
                                                className="flex-1 text-status-danger hover:text-status-danger/25 hover:bg-status-danger/10"
                                            >
                                                <Trash2 className="w-3 h-3 mr-1" />
                                                Löschen
                                            </Button>
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        ))}
                    </div>
                </div>
            ))}

            {events.length === 0 && (
                <Card className="p-8 bg-card border-border">
                    <div className="text-center text-muted-foreground">
                        <p className="text-sm">Keine archivierten Events vorhanden</p>
                    </div>
                </Card>
            )}
        </div>
    );
}