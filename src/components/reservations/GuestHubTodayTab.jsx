/**
 * GuestHubTodayTab — neu
 * Zeitlinie statt Kartenstapel. Zeigt wer wann kommt, mit wie vielen, an welchem Tisch.
 * Tisch-Klick direkt → neue Reservierung anlegen.
 */
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, AlertCircle, Clock, Users, MapPin, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTableDisplayName } from '@/components/tables/TableNameDisplay';

const STATUS_DOT = {
    'vorgemerkt': 'bg-blue-400',
    'bestätigt':  'bg-green-400',
    'erschienen': 'bg-emerald-500',
    'no-show':    'bg-red-400',
    'storniert':  'bg-slate-400',
};

export default function GuestHubTodayTab({
    todayReservations, tables, stats, permissions,
    onAddReservation, onEditReservation
}) {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Nächste Reservierung berechnen
    const nextRes = todayReservations.find(r => {
        const [h, m] = (r.time || '0:0').split(':').map(Number);
        return (h * 60 + m) > nowMinutes;
    });

    return (
        <div className="space-y-4">

            {/* Stats — 3 Kacheln */}
            <div className="grid grid-cols-3 gap-2">
                {[
                    { label: 'Frei', count: stats.free, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                    { label: 'Reserviert', count: stats.reserved, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                    { label: 'Heute', count: todayReservations.length, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                ].map(({ label, count, color, bg }) => (
                    <div key={label} className={cn('rounded-xl border p-3 text-center', bg)}>
                        <p className={cn('text-2xl font-bold tabular-nums', color)}>{count}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Nächste Reservierung — Hero-Banner */}
            {nextRes && (
                <button onClick={() => onEditReservation(nextRes)}
                    className="w-full text-left rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4 hover:bg-amber-500/12 transition-colors">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />Als nächstes
                    </p>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="font-bold text-foreground text-lg leading-tight">{nextRes.customer_name}</p>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-amber-400" />{nextRes.time} Uhr
                                </span>
                                <span className="flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5 text-amber-400" />{nextRes.guests} {nextRes.guests === 1 ? 'Person' : 'Personen'}
                                </span>
                                {nextRes.table && (() => {
                                    const t = tables.find(t => t.id === nextRes.table || t.table_number === nextRes.table);
                                    return t ? (
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-3.5 h-3.5 text-amber-400" />{getTableDisplayName(t)}
                                        </span>
                                    ) : null;
                                })()}
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-amber-400 shrink-0" />
                    </div>
                </button>
            )}

            {/* Tisch ohne Zuweisung */}
            {todayReservations.filter(r => !r.table).length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400">
                        <strong>{todayReservations.filter(r => !r.table).length}</strong> Reservierung(en) ohne Tischzuweisung
                    </p>
                </div>
            )}

            {/* Zeitlinie */}
            {todayReservations.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-3xl mb-3">🍾</p>
                    <p className="font-semibold text-foreground">Keine Reservierungen heute</p>
                    <p className="text-sm text-muted-foreground mt-1 mb-5">Noch ruhig heute.</p>
                    {permissions.canEditReservations && (
                        <Button onClick={onAddReservation}
                            className="bg-amber-600 hover:bg-amber-700 gap-2">
                            <Plus className="w-4 h-4" />Reservierung anlegen
                        </Button>
                    )}
                </div>
            ) : (
                <div>
                    <p className="text-[12px] font-medium text-muted-foregroundr mb-3 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(), "EEEE, d. MMMM", { locale: de })} — Zeitlinie
                    </p>

                    {/* Timeline */}
                    <div className="relative">
                        {/* Vertikale Linie */}
                        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

                        <div className="space-y-1">
                            {todayReservations.map(res => {
                                const [rh, rm] = (res.time || '0:0').split(':').map(Number);
                                const resMinutes = rh * 60 + rm;
                                const isPast = resMinutes < nowMinutes - 30;
                                const isNext = res.id === nextRes?.id;
                                const tbl = tables.find(t => t.id === res.table || t.table_number === res.table);

                                return (
                                    <button key={res.id}
                                        onClick={() => onEditReservation(res)}
                                        className={cn(
                                            'w-full flex items-center gap-3 pl-10 pr-4 py-3 rounded-xl text-left transition-all relative min-h-[56px]',
                                            isNext ? 'bg-amber-500/10 border border-amber-500/25' :
                                            isPast ? 'opacity-45 hover:opacity-70' :
                                            'hover:bg-accent/50'
                                        )}>

                                        {/* Dot auf der Linie */}
                                        <div className={cn(
                                            'absolute left-3.5 w-3 h-3 rounded-full border-2 border-background',
                                            STATUS_DOT[res.status] || 'bg-muted-foreground'
                                        )} />

                                        {/* Zeit */}
                                        <span className={cn(
                                            'text-sm font-bold tabular-nums shrink-0 w-11',
                                            isNext ? 'text-amber-400' : isPast ? 'text-muted-foreground' : 'text-foreground'
                                        )}>
                                            {res.time}
                                        </span>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                'font-medium truncate text-sm',
                                                isPast ? 'text-muted-foreground' : 'text-foreground'
                                            )}>
                                                {res.customer_name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-3 h-3" />{res.guests}
                                                </span>
                                                {tbl && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />{getTableDisplayName(tbl)}
                                                    </span>
                                                )}
                                                {!res.table && (
                                                    <span className="text-amber-400">kein Tisch</span>
                                                )}
                                            </div>
                                        </div>

                                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* FAB — neue Reservierung */}
            {permissions.canEditReservations && todayReservations.length > 0 && (
                <Button onClick={onAddReservation}
                    className="w-full bg-amber-600 hover:bg-amber-700 gap-2 h-11">
                    <Plus className="w-4 h-4" />Neue Reservierung
                </Button>
            )}
        </div>
    );
}
