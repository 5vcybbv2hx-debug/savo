import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Calendar, AlertCircle, CalendarCheck, Clock } from 'lucide-react';

export default function TodayOverview({ shifts = [], events = [], reservations = [], employees = [], maxItems = null }) {
    // Schichten werden bereits gefiltert übergeben, aber wir zeigen es immer an falls es Inhalte gibt
    const hasContent = shifts.length > 0 || events.length > 0 || reservations.length > 0;
    
    if (!hasContent) {
        return (
            <Card className="p-6 bg-card border-border">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-status-ok" />
                    Heute • {format(new Date(), 'EEEE, d. MMMM', { locale: de })}
                </h3>
                <p className="text-sm text-muted-foreground/70 italic text-center py-4">Nichts geplant für heute</p>
            </Card>
        );
    }

    const shiftsToShow = maxItems ? shifts.slice(0, maxItems) : shifts;
    const eventsToShow = maxItems ? events.slice(0, maxItems) : events;
    const reservationsToShow = maxItems ? reservations.slice(0, maxItems) : reservations;

    // Hilfsfunktion um Mitarbeiterfarbe zu holen
    const getEmployeeColor = (employeeId) => {
        const employee = employees.find(e => e.id === employeeId);
        return employee?.color || '#64748b';
    };

    return (
        <Card className="p-6 bg-card border-border">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-status-ok" />
                Heute • {format(new Date(), 'EEEE, d. MMMM', { locale: de })}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <p className="text-[13.5px] font-medium text-foreground tracking-tight mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Schichten ({shifts.length})
                    </p>
                    <div className="space-y-2">
                        {shiftsToShow.length > 0 ? (
                            shiftsToShow.map((shift, idx) => (
                                <div key={shift.id} className="flex items-center gap-2 text-sm p-2 rounded animate-stagger bg-secondary/30 hover:bg-secondary/50 transition-colors" style={{ '--delay': `${idx * 35}ms` }}>
                                    <div 
                                        className="w-3 h-3 rounded-full flex-shrink-0" 
                                        style={{ backgroundColor: shift.color || getEmployeeColor(shift.employee_id) }} 
                                    />
                                    <span className="text-foreground/80 truncate flex-1">{shift.employee_name}</span>
                                    <span className="text-muted-foreground/70 text-xs whitespace-nowrap ml-2">{shift.start_time?.substring(0, 5)}-{shift.end_time?.substring(0, 5)}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground/50 italic py-2">Keine Schichten</p>
                        )}
                        {shifts.length > maxItems && <p className="text-xs text-muted-foreground/70 pt-2">+{shifts.length - shiftsToShow.length} weitere</p>}
                    </div>
                </div>

                <div>
                    <p className="text-[13.5px] font-medium text-foreground tracking-tight mb-2">Events ({events.length})</p>
                    <div className="space-y-2">
                        {eventsToShow.map((event, idx) => (
                            <div key={event.id} className="flex items-start gap-2 text-sm animate-stagger" style={{ '--delay': `${idx * 35}ms` }}>
                                <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-foreground/80 font-medium truncate">{event.title}</p>
                                    {event.expected_guests && <p className="text-xs text-muted-foreground/70">{event.expected_guests} Gäste</p>}
                                </div>
                            </div>
                        ))}
                        {events.length === 0 && <p className="text-sm text-muted-foreground/50 italic">Keine Events</p>}
                    </div>
                </div>

                <div>
                    <p className="text-[13.5px] font-medium text-foreground tracking-tight mb-2">Reservierungen ({reservations.length})</p>
                    <div className="space-y-2">
                        {reservationsToShow.map((res, idx) => (
                            <div key={res.id} className="flex items-start gap-2 text-sm animate-stagger" style={{ '--delay': `${idx * 35}ms` }}>
                                <CalendarCheck className="w-4 h-4 text-primary mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-foreground/80 truncate">{res.customer_name}</p>
                                    <p className="text-xs text-muted-foreground/70">{res.time} • {res.guests} Gäste</p>
                                </div>
                            </div>
                        ))}
                        {reservations.length === 0 && <p className="text-sm text-muted-foreground/50 italic">Keine Reservierungen</p>}
                    </div>
                </div>
            </div>
        </Card>
    );
}