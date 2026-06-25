import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Tv, Users } from 'lucide-react';
import { getTrafficColor, getTrafficLabel, getTrafficDot } from './useWorldCupMatches';
import { getFlag } from './GroupStageView';

export default function MatchCard({ match, onClick, compact = false }) {
    const kickoff  = new Date(match.kickoff_time);
    const time     = format(kickoff, 'HH:mm');
    const traffic  = match.expected_bar_traffic || 'normal';
    const isGermany = match.is_germany_game;
    const isTop    = match.is_top_game;
    const isLive   = match.status === 'live';
    const isDone   = match.status === 'beendet';
    const homeWins = isDone && Number(match.home_score) > Number(match.away_score);
    const awayWins = isDone && Number(match.away_score) > Number(match.home_score);

    // ── Compact (für DayBanner / Kalender) ──────────────────────────────────
    if (compact) {
        return (
            <button
                onClick={() => onClick?.(match)}
                className={`w-full text-left rounded-lg border p-2.5 transition-all active:scale-[0.98] ${
                    isGermany
                        ? 'bg-gradient-to-r from-yellow-500/10 via-red-500/10 to-yellow-500/5 border-yellow-500/40'
                        : 'bg-secondary/50 border-border hover:border-border/80'
                }`}
            >
                <div className="flex items-center gap-2">
                    {isGermany && (
                        <span className="text-[9px] font-bold bg-yellow-500 text-black px-1.5 py-0.5 rounded shrink-0">🇩🇪 DE</span>
                    )}
                    {isLive && (
                        <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded shrink-0 animate-pulse">LIVE</span>
                    )}
                    <span className="font-mono text-xs font-bold text-primary shrink-0">{time}</span>
                    <span className="text-xs font-medium truncate">
                        {getFlag(match.home_team)} {match.home_team}
                        {(isLive || isDone) ? ` ${match.home_score ?? 0}:${match.away_score ?? 0} ` : ' – '}
                        {match.away_team} {getFlag(match.away_team)}
                    </span>
                    <span className="ml-auto text-sm shrink-0">{getTrafficDot(traffic)}</span>
                </div>
                {match.staff_recommendation && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        👥 {match.staff_recommendation}
                    </p>
                )}
            </button>
        );
    }

    // ── Full Card ─────────────────────────────────────────────────────────────
    return (
        <button
            onClick={() => onClick?.(match)}
            className={`w-full text-left rounded-xl border transition-all active:scale-[0.98] overflow-hidden ${
                isLive
                    ? 'border-red-500/50 shadow-md shadow-red-500/10'
                    : isGermany
                        ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/8'
                        : isTop
                            ? 'border-primary/25'
                            : 'border-border'
            }`}
        >
            {/* Colored top bar */}
            <div className={`h-1 w-full ${
                isLive ? 'bg-red-500' :
                isGermany ? 'bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-400' :
                isTop ? 'bg-primary/60' : 'bg-transparent'
            }`} />

            <div className="p-4">
                {/* Badges */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {isLive && (
                        <span className="flex items-center gap-1 text-xs font-bold bg-red-500 text-white px-2.5 py-1 rounded-full animate-pulse">
                            ● LIVE
                        </span>
                    )}
                    {isGermany && (
                        <span className="text-xs font-bold bg-yellow-500 text-black px-2 py-0.5 rounded-full">
                            🇩🇪 DEUTSCHLAND
                        </span>
                    )}
                    {isTop && !isGermany && (
                        <span className="text-xs font-bold bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded-full">
                            ⭐ TOPSPIEL
                        </span>
                    )}
                    <span className="text-xs text-muted-foreground">{match.round}</span>
                    <span className={`ml-auto text-xs border rounded-full px-2 py-0.5 ${getTrafficColor(traffic)}`}>
                        {getTrafficDot(traffic)} {getTrafficLabel(traffic)}
                    </span>
                </div>

                {/* Teams + Score — zentriert & symmetrisch */}
                <div className="flex items-center gap-3">
                    {/* Home */}
                    <div className="flex-1 flex flex-col items-center gap-1 text-center">
                        <span className="text-3xl leading-none">{getFlag(match.home_team)}</span>
                        <p className={`text-xs font-semibold leading-tight ${homeWins ? 'text-foreground' : isDone ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {match.home_team}
                        </p>
                    </div>

                    {/* Score / Zeit */}
                    <div className="flex flex-col items-center shrink-0 min-w-[72px]">
                        {isLive || isDone ? (
                            <>
                                <div className="flex items-center gap-1">
                                    <span className={`text-2xl font-mono font-bold ${homeWins ? 'text-foreground' : 'text-muted-foreground'}`}>
                                        {match.home_score ?? 0}
                                    </span>
                                    <span className="text-lg text-muted-foreground/40 font-mono">:</span>
                                    <span className={`text-2xl font-mono font-bold ${awayWins ? 'text-foreground' : 'text-muted-foreground'}`}>
                                        {match.away_score ?? 0}
                                    </span>
                                </div>
                                <span className={`text-[10px] font-medium mt-0.5 ${isLive ? 'text-red-400' : 'text-muted-foreground'}`}>
                                    {isLive ? '● LIVE' : 'Abpfiff'}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="text-xl font-mono font-bold text-primary">{time}</span>
                                <span className="text-[10px] text-muted-foreground">
                                    {format(kickoff, 'EEE, d. MMM', { locale: de })}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Away */}
                    <div className="flex-1 flex flex-col items-center gap-1 text-center">
                        <span className="text-3xl leading-none">{getFlag(match.away_team)}</span>
                        <p className={`text-xs font-semibold leading-tight ${awayWins ? 'text-foreground' : isDone ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {match.away_team}
                        </p>
                    </div>
                </div>

                {/* TV + Staff */}
                {(match.tv_channel || match.staff_recommendation) && (
                    <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap gap-3">
                        {match.tv_channel && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Tv className="w-3.5 h-3.5 shrink-0" />
                                <span className="font-medium">{match.tv_channel}</span>
                            </div>
                        )}
                        {match.staff_recommendation && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Users className="w-3.5 h-3.5 shrink-0" />
                                <span>{match.staff_recommendation}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </button>
    );
}
