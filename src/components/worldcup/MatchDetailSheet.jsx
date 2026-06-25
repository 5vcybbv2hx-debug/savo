import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, Clock, Tv, Pencil } from 'lucide-react';
import { getTrafficColor, getTrafficLabel, getTrafficDot } from './useWorldCupMatches';
import { getFlag } from './GroupStageView';

export default function MatchDetailSheet({ match, open, onClose, onEdit }) {
    if (!match) return null;
    const kickoff  = new Date(match.kickoff_time);
    const traffic  = match.expected_bar_traffic || 'normal';
    const isLive   = match.status === 'live';
    const isDone   = match.status === 'beendet';
    const homeWins = isDone && Number(match.home_score) > Number(match.away_score);
    const awayWins = isDone && Number(match.away_score) > Number(match.home_score);

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
                <SheetHeader className="pb-3">
                    <SheetTitle className="flex items-center gap-2 flex-wrap text-base">
                        {isLive && (
                            <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">● LIVE</span>
                        )}
                        {match.is_germany_game && (
                            <span className="text-xs font-bold bg-yellow-500 text-black px-2 py-0.5 rounded-full">🇩🇪 DEUTSCHLAND</span>
                        )}
                        {match.is_top_game && !match.is_germany_game && (
                            <span className="text-xs font-bold bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded-full">⭐ TOPSPIEL</span>
                        )}
                        <span>{match.round}{match.group_name ? ` · ${match.group_name}` : ''}</span>
                    </SheetTitle>
                </SheetHeader>

                <div className="space-y-4">
                    {/* Teams + Score — zentriert */}
                    <div className={`rounded-xl p-4 border ${
                        isLive ? 'bg-red-500/8 border-red-500/30' :
                        isDone ? 'bg-secondary/50 border-border' :
                        'bg-primary/5 border-primary/20'
                    }`}>
                        <div className="flex items-center gap-2">
                            {/* Home */}
                            <div className="flex-1 flex flex-col items-center gap-1 text-center">
                                <span className="text-4xl">{getFlag(match.home_team)}</span>
                                <p className={`text-sm font-bold ${homeWins ? 'text-foreground' : isDone ? 'text-muted-foreground' : 'text-foreground'}`}>
                                    {match.home_team}
                                </p>
                                <p className="text-[10px] text-muted-foreground">Heimteam</p>
                            </div>

                            {/* Score */}
                            <div className="flex flex-col items-center min-w-[72px]">
                                {isLive || isDone ? (
                                    <>
                                        <div className="text-3xl font-mono font-bold">
                                            {match.home_score ?? 0}:{match.away_score ?? 0}
                                        </div>
                                        <span className={`text-xs font-semibold mt-1 ${isLive ? 'text-red-400 animate-pulse' : 'text-muted-foreground'}`}>
                                            {isLive ? '● LIVE' : 'Abpfiff'}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-2xl font-mono font-bold text-primary">
                                            {format(kickoff, 'HH:mm')}
                                        </div>
                                        <span className="text-xs text-muted-foreground mt-0.5">Uhr</span>
                                    </>
                                )}
                            </div>

                            {/* Away */}
                            <div className="flex-1 flex flex-col items-center gap-1 text-center">
                                <span className="text-4xl">{getFlag(match.away_team)}</span>
                                <p className={`text-sm font-bold ${awayWins ? 'text-foreground' : isDone ? 'text-muted-foreground' : 'text-foreground'}`}>
                                    {match.away_team}
                                </p>
                                <p className="text-[10px] text-muted-foreground">Auswärts</p>
                            </div>
                        </div>
                    </div>

                    {/* Infogrid */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-secondary/40 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="text-[10px] uppercase tracking-wide">Anstoß</span>
                            </div>
                            <p className="font-bold text-sm">{format(kickoff, 'HH:mm')} Uhr</p>
                            <p className="text-xs text-muted-foreground">{format(kickoff, 'EEEE, d. MMMM', { locale: de })}</p>
                        </div>
                        {match.tv_channel && (
                            <div className="bg-secondary/40 rounded-xl p-3">
                                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                    <Tv className="w-3.5 h-3.5" />
                                    <span className="text-[10px] uppercase tracking-wide">TV</span>
                                </div>
                                <p className="font-bold text-sm">{match.tv_channel}</p>
                            </div>
                        )}
                        {match.venue && (
                            <div className={`bg-secondary/40 rounded-xl p-3 ${match.tv_channel ? '' : 'col-span-2'}`}>
                                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span className="text-[10px] uppercase tracking-wide">Stadion</span>
                                </div>
                                <p className="font-medium text-sm">{match.venue}</p>
                            </div>
                        )}
                    </div>

                    {/* Bar-Auslastung */}
                    <div className={`rounded-xl p-3 border ${getTrafficColor(traffic)}`}>
                        <p className="text-xs font-bold mb-0.5">{getTrafficDot(traffic)} Erwartete Auslastung</p>
                        <p className="font-bold text-base">{getTrafficLabel(traffic)}</p>
                        {match.staff_recommendation && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-current/20">
                                <Users className="w-3.5 h-3.5 shrink-0" />
                                <p className="text-sm">{match.staff_recommendation}</p>
                            </div>
                        )}
                    </div>

                    {match.notes && (
                        <div className="bg-secondary/40 rounded-xl p-3">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Notizen</p>
                            <p className="text-sm">{match.notes}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pb-safe">
                        {onEdit && (
                            <Button variant="outline" size="sm" onClick={() => onEdit(match)} className="gap-1.5">
                                <Pencil className="w-3.5 h-3.5" /> Bearbeiten
                            </Button>
                        )}
                        <Button variant="outline" className="flex-1 gap-1.5" onClick={onClose} asChild>
                            <a href="/Calendar"><Calendar className="w-4 h-4" /> Schichtplan</a>
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
