import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, MapPin, FileText, PartyPopper, Plane, RepeatIcon } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function EventDetailsModal({ event, open, onClose, onShiftSwap }) {
    if (!event) return null;

    // Multiple events view
    if (event.type === 'multiple') {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                            <Calendar className="w-5 h-5 text-status-warn" />
                            {format(event.date, 'dd. MMMM yyyy', { locale: de })}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 mt-4">
                        {event.events.map((evt, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    onClose();
                                    // Trigger event click again with single event
                                    setTimeout(() => {
                                        const clickEvent = new CustomEvent('calendar-event-click', { detail: evt });
                                        window.dispatchEvent(clickEvent);
                                    }, 100);
                                }}
                                className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-card transition-colors"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div 
                                        className="w-3 h-3 rounded-full" 
                                        style={{ backgroundColor: evt.color }}
                                    />
                                    <span className="text-sm font-medium text-foreground">{evt.label}</span>
                                </div>
                                <Badge variant="outline" className="text-xs text-foreground/75 border-border/70">
                                    {evt.type === 'shift' ? 'Schicht' : evt.type === 'vacation' ? 'Urlaub' : 'Feiertag'}
                                </Badge>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // Shift Details
    if (event.type === 'shift') {
        const { data, employee } = event;
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                            <Clock className="w-5 h-5 text-primary" />
                            Schicht Details
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div className="flex items-start gap-3">
                            <User className="w-5 h-5 text-foreground/75 mt-0.5" />
                            <div>
                                <div className="text-sm font-medium text-foreground/75">Mitarbeiter</div>
                                <div className="text-foreground font-medium">{data.employee_name}</div>
                                {employee?.role && (
                                    <Badge variant="outline" className="mt-1 text-xs">
                                        {employee.role}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-foreground/75 mt-0.5" />
                            <div>
                                <div className="text-sm font-medium text-foreground/75">Datum</div>
                                <div className="text-foreground font-medium">
                                    {format(new Date(data.date), 'dd. MMMM yyyy', { locale: de })}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-foreground/75 mt-0.5" />
                            <div>
                                <div className="text-sm font-medium text-foreground/75">Zeit</div>
                                <div className="text-foreground font-medium">
                                    {data.start_time} - {data.end_time}
                                </div>
                            </div>
                        </div>

                        {data.shift_type && (
                            <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-foreground/75 mt-0.5" />
                                <div>
                                    <div className="text-sm font-medium text-foreground/75">Schichttyp</div>
                                    <div className="text-foreground font-medium">{data.shift_type}</div>
                                </div>
                            </div>
                        )}

                        {data.notes && (
                            <div className="flex items-start gap-3">
                                <FileText className="w-5 h-5 text-foreground/75 mt-0.5" />
                                <div>
                                    <div className="text-sm font-medium text-foreground/75">Notizen</div>
                                    <div className="text-foreground text-sm font-medium">{data.notes}</div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-4">
                            <Button
                                onClick={() => {
                                    onShiftSwap?.(data);
                                    onClose();
                                }}
                                className="flex-1 bg-status-warn/70 hover:bg-status-warn/70"
                            >
                                <RepeatIcon className="w-4 h-4 mr-2" />
                                Tauschen
                            </Button>
                            <Button variant="outline" onClick={onClose} className="flex-1">
                                Schließen
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // Vacation Details
    if (event.type === 'vacation') {
        const { data } = event;
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                            <Plane className="w-5 h-5 text-primary" />
                            Urlaub Details
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div className="flex items-start gap-3">
                            <User className="w-5 h-5 text-foreground/75 mt-0.5" />
                            <div>
                                <div className="text-sm font-medium text-foreground/75">Mitarbeiter</div>
                                <div className="text-foreground font-medium">{data.employee_name}</div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-foreground/75 mt-0.5" />
                            <div>
                                <div className="text-sm font-medium text-foreground/75">Zeitraum</div>
                                <div className="text-foreground font-medium">
                                    {format(new Date(data.start_date), 'dd. MMM', { locale: de })} - {format(new Date(data.end_date), 'dd. MMM yyyy', { locale: de })}
                                </div>
                                {data.days_count && (
                                    <div className="text-sm text-foreground/75 mt-1">
                                        {data.days_count} Arbeitstage
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <FileText className="w-5 h-5 text-foreground/75 mt-0.5" />
                            <div>
                                <div className="text-sm font-medium text-foreground/75">Typ</div>
                                <Badge className={cn(
                                    data.type === 'Urlaub' ? 'bg-primary/70' :
                                    data.type === 'Krankheit' ? 'bg-status-danger/70' :
                                    'bg-status-ok/70'
                                )}>
                                    {data.type || 'Urlaub'}
                                </Badge>
                            </div>
                        </div>

                        {data.notes && (
                            <div className="flex items-start gap-3">
                                <FileText className="w-5 h-5 text-foreground/75 mt-0.5" />
                                <div>
                                    <div className="text-sm font-medium text-foreground/75">Notizen</div>
                                    <div className="text-foreground text-sm font-medium">{data.notes}</div>
                                </div>
                            </div>
                        )}

                        <Button variant="outline" onClick={onClose} className="w-full border-border/70 text-foreground hover:bg-card">
                            Schließen
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // Holiday Details
    if (event.type === 'holiday') {
        const { data } = event;
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                            <PartyPopper className="w-5 h-5 text-status-danger" />
                            Feiertag
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div className="text-center py-6">
                            <div className="text-4xl mb-4">🎉</div>
                            <h3 className="text-xl font-bold text-foreground mb-2">{data.name}</h3>
                            <div className="text-foreground/75 font-medium">
                                {format(data.date, 'dd. MMMM yyyy', { locale: de })}
                            </div>
                            <Badge className="mt-4 bg-status-danger/70 text-foreground">
                                Gesetzlicher Feiertag
                            </Badge>
                        </div>
                        <Button variant="outline" onClick={onClose} className="w-full border-border/70 text-foreground hover:bg-card">
                            Schließen
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return null;
}