import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';

export default function DayDetailDrawer({
    day,
    open,
    onClose,
    shifts = [],
    vacations = [],
    holidays = [],
    maintenanceTasks = [],
    reservations = [],
    employees = [],
}) {
    if (!day) return null;

    const dayStr = format(day, 'yyyy-MM-dd');
    const dayMD = format(day, 'MM-dd'); // Für Geburtstags-Vergleich

    const dayShifts = shifts.filter(s => s.date === dayStr);
    const dayVacations = vacations.filter(v => {
        const start = new Date(v.start_date);
        const end = new Date(v.end_date);
        return day >= start && day <= end;
    });
    const dayHolidays = holidays.filter(h => h.date === dayStr);
    const dayMaintenance = maintenanceTasks.filter(t => t.next_maintenance === dayStr);
    const dayReservations = reservations.filter(r => r.date === dayStr);
    
    // Geburtstage an diesem Tag
    const dayBirthdays = employees.filter(emp => {
        if (!emp.birthday || emp.birthday.length < 10) return false;
        try {
            const bMD = emp.birthday.slice(5, 10); // "YYYY-MM-DD" → "MM-DD"
            return bMD === dayMD;
        } catch {
            return false;
        }
    });

    const isEmpty = dayShifts.length === 0 && dayVacations.length === 0 && dayHolidays.length === 0 && dayMaintenance.length === 0 && dayReservations.length === 0 && dayBirthdays.length === 0;

    return (
        <Drawer open={open} onOpenChange={onClose}>
            <DrawerContent className="bg-card border-border max-h-[80vh]">
                <DrawerHeader className="border-b border-border pb-3">
                    <DrawerTitle className="text-foreground capitalize">
                        {format(day, 'EEEE, d. MMMM yyyy', { locale: de })}
                    </DrawerTitle>
                </DrawerHeader>

                <div className="overflow-y-auto p-4 space-y-5 pb-8">
                    {isEmpty && (
                        <p className="text-sm text-muted-foreground text-center py-6">Keine Einträge für diesen Tag.</p>
                    )}

                    {/* Feiertage */}
                    {dayHolidays.length > 0 && (
                        <section>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Feiertag</p>
                            <div className="space-y-2">
                                {dayHolidays.map(h => (
                                    <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                                        <span className="text-lg">🎉</span>
                                        <span className="font-semibold text-foreground">{h.name}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Schichten */}
                    {dayShifts.length > 0 && (
                        <section>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                                Schichten ({dayShifts.length})
                            </p>
                            <div className="space-y-2">
                                {dayShifts.map(s => {
                                    const emp = employees.find(e => e.id === s.employee_id);
                                    return (
                                        <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                            <div
                                                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                                                style={{ backgroundColor: emp?.color || '#64748b' }}
                                            >
                                                {s.employee_name?.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground truncate">{s.employee_name}</p>
                                                <p className="text-sm text-muted-foreground">{s.start_time} – {s.end_time}</p>
                                            </div>
                                            {s.shift_type && (
                                                <Badge variant="outline" className="text-xs shrink-0">{s.shift_type}</Badge>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Urlaube */}
                    {dayVacations.length > 0 && (
                        <section>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                                Abwesend ({dayVacations.length})
                            </p>
                            <div className="space-y-2">
                                {dayVacations.map(v => {
                                    const emp = employees.find(e => e.id === v.employee_id);
                                    return (
                                        <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                            <div
                                                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                                                style={{ backgroundColor: emp?.color || '#64748b' }}
                                            >
                                                {v.employee_name?.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground truncate">{v.employee_name}</p>
                                                <p className="text-sm text-muted-foreground">{v.type || 'Urlaub'}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Wartung */}
                    {dayMaintenance.length > 0 && (
                        <section>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Wartung</p>
                            <div className="space-y-2">
                                {dayMaintenance.map(t => (
                                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                        <span className="text-lg">🔧</span>
                                        <span className="font-semibold text-foreground">{t.equipment_name || t.title}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Geburtstage */}
                    {dayBirthdays.length > 0 && (
                        <section>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                                Geburtstage ({dayBirthdays.length})
                            </p>
                            <div className="space-y-2">
                                {dayBirthdays.map(emp => (
                                    <div key={`birthday-${emp.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                        <div
                                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                                            style={{ backgroundColor: emp.color || '#64748b' }}
                                        >
                                            {emp.name?.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-foreground truncate">{emp.name}</p>
                                            <p className="text-sm text-muted-foreground">🎂 Geburtstag</p>
                                        </div>
                                        <span className="text-xl">🎉</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Reservierungen */}
                    {dayReservations.length > 0 && (
                        <section>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                                Reservierungen ({dayReservations.length})
                            </p>
                            <div className="space-y-2">
                                {dayReservations.map(r => (
                                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-pink-500/10 border border-pink-500/20">
                                        <span className="text-lg">📅</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-foreground truncate">{r.customer_name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {r.time} · {r.guests} {r.guests === 1 ? 'Person' : 'Personen'}
                                                {r.table && ` · Tisch ${r.table}`}
                                            </p>
                                        </div>
                                        {r.status && (
                                            <Badge variant="outline" className="text-xs shrink-0">
                                                {r.status === 'bestätigt' ? '✓' : ''} {r.status}
                                            </Badge>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    );
}