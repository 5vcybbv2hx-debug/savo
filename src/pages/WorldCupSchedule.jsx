import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format, isToday, isTomorrow, parseISO, differenceInMinutes, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import { Trophy, Search, RefreshCw, Plus, Layers, GitBranch, List, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorldCupMatches } from '@/components/worldcup/useWorldCupMatches';
import MatchCard from '@/components/worldcup/MatchCard';
import MatchDetailSheet from '@/components/worldcup/MatchDetailSheet';
import MatchEditModal from '@/components/worldcup/MatchEditModal';
import GroupStageView from '@/components/worldcup/GroupStageView';
import BracketView from '@/components/worldcup/BracketView';
import { usePermissions } from '@/components/auth/usePermissions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Nächstes Live/Heute-Spiel Banner ─────────────────────────────────────────
function NextMatchBanner({ matches, onClick }) {
    const now = new Date();

    const liveMatch = matches.find(m => m.status === 'live');
    const nextMatch = !liveMatch && matches
        .filter(m => m.status !== 'beendet' && m.status !== 'abgesagt' && new Date(m.kickoff_time) > now)
        .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))[0];

    const match = liveMatch || nextMatch;
    if (!match) return null;

    const kickoff   = new Date(match.kickoff_time);
    const isLive    = match.status === 'live';
    const minsUntil = differenceInMinutes(kickoff, now);
    const soonLabel = minsUntil <= 0   ? 'Läuft gerade' :
                      minsUntil < 60   ? `in ${minsUntil} Min.` :
                      minsUntil < 1440 ? `in ${Math.round(minsUntil/60)}h` :
                                         format(kickoff, "EEE, d. MMM · HH:mm 'Uhr'", { locale: de });

    return (
        <button
            onClick={() => onClick(match)}
            className={cn(
                'w-full text-left rounded-xl border p-3 mb-4 transition-all active:scale-[0.99]',
                isLive
                    ? 'bg-red-500/8 border-red-500/40'
                    : match.is_germany_game
                        ? 'bg-yellow-500/8 border-yellow-500/40'
                        : 'bg-primary/5 border-primary/20'
            )}
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className={cn('text-[10px] font-bold uppercase tracking-wider mb-0.5',
                        isLive ? 'text-red-400' : 'text-muted-foreground'
                    )}>
                        {isLive ? '● LIVE GERADE' : '⏭ NÄCHSTES SPIEL'}
                    </p>
                    <p className="text-sm font-bold text-foreground">
                        {match.home_team} – {match.away_team}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {isLive
                            ? `${match.home_score ?? 0} : ${match.away_score ?? 0}`
                            : soonLabel}
                        {match.tv_channel && ` · 📺 ${match.tv_channel}`}
                    </p>
                </div>
                <div className={cn(
                    'text-xs font-bold px-3 py-1.5 rounded-full shrink-0',
                    isLive ? 'bg-red-500 text-white animate-pulse' :
                    match.is_germany_game ? 'bg-yellow-500 text-black' :
                    'bg-primary text-primary-foreground'
                )}>
                    {isLive ? 'LIVE' : format(kickoff, 'HH:mm')}
                </div>
            </div>
        </button>
    );
}

// ── Filter Chips ──────────────────────────────────────────────────────────────
const FILTERS = [
    { id: 'all',      label: 'Alle' },
    { id: 'today',    label: '📅 Heute' },
    { id: 'tomorrow', label: '📅 Morgen' },
    { id: 'germany',  label: '🇩🇪 Deutschland' },
    { id: 'top',      label: '⭐ Topspiele' },
    { id: 'live',     label: '🔴 Live' },
    { id: 'knockout', label: '🏆 K.o.-Runde' },
];

export default function WorldCupSchedule() {
    const permissions   = usePermissions();
    const queryClient   = useQueryClient();
    const { data: matches = [], isLoading, dataUpdatedAt } = useWorldCupMatches();
    const [activeFilter, setActiveFilter] = useState('all');
    const [search,       setSearch]       = useState('');
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [editMatch,    setEditMatch]     = useState(null);
    const [syncing,      setSyncing]       = useState(false);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await base44.functions.invoke('syncWorldCup', { automation: true });
            const d = res?.data || res;
            toast.success(`Sync: ${d.created || 0} neu, ${d.updated || 0} aktualisiert`);
            queryClient.invalidateQueries({ queryKey: ['world-cup-matches'] });
        } catch (err) {
            toast.error('Sync fehlgeschlagen: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    // ── Filtern + Suche ───────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = [...matches];
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(m =>
                m.home_team?.toLowerCase().includes(q) ||
                m.away_team?.toLowerCase().includes(q) ||
                m.venue?.toLowerCase().includes(q)
            );
        }
        switch (activeFilter) {
            case 'germany':  list = list.filter(m => m.is_germany_game); break;
            case 'today':    list = list.filter(m => isToday(new Date(m.kickoff_time))); break;
            case 'tomorrow': list = list.filter(m => isTomorrow(new Date(m.kickoff_time))); break;
            case 'top':      list = list.filter(m => m.is_top_game || m.is_germany_game); break;
            case 'knockout': list = list.filter(m => {
                const r = (m.round || '').toLowerCase();
                return ['finale', 'halbfinale', 'viertelfinale', 'achtelfinale'].some(x => r.includes(x));
            }); break;
            case 'live':     list = list.filter(m => m.status === 'live'); break;
        }
        return list.sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time));
    }, [matches, activeFilter, search]);

    // ── Nach Datum gruppieren ────────────────────────────────────────────────
    const grouped = useMemo(() => {
        const groups = {};
        filtered.forEach(m => {
            const d = new Date(m.kickoff_time);
            const key = format(d, 'yyyy-MM-dd');
            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        });
        return groups;
    }, [filtered]);

    const sortedDates = Object.keys(grouped).sort();

    const liveCount = matches.filter(m => m.status === 'live').length;
    const doneCount = matches.filter(m => m.status === 'beendet').length;
    const todayCount = matches.filter(m => isToday(new Date(m.kickoff_time))).length;

    const formatDateHeader = (dateStr) => {
        const d = parseISO(dateStr);
        if (isToday(d))    return '📅 Heute';
        if (isTomorrow(d)) return '📅 Morgen';
        return format(d, 'EEEE, d. MMMM', { locale: de });
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Header */}
            <div className="bg-gradient-to-br from-amber-600/15 via-background to-background border-b border-border/50 px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">WM 2026 ⚽</h1>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <span>{matches.length} Spiele</span>
                                {liveCount > 0 && <span className="text-red-400 font-semibold animate-pulse">● {liveCount} LIVE</span>}
                                {todayCount > 0 && <span className="text-primary font-medium">{todayCount} heute</span>}
                                {doneCount > 0 && <span>{doneCount} beendet</span>}
                            </div>
                        </div>
                    </div>
                    {permissions.isManager && (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="text-xs h-8">
                                <RefreshCw className={cn('w-3.5 h-3.5 mr-1', syncing && 'animate-spin')} />
                                Sync
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setEditMatch({})} className="text-xs h-8">
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Spiel
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="px-4 pt-4 pb-24 md:pb-6">
                <Tabs defaultValue="list" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="list"    className="text-xs gap-1.5"><List     className="w-3.5 h-3.5" /> Spielplan</TabsTrigger>
                        <TabsTrigger value="groups"  className="text-xs gap-1.5"><Layers   className="w-3.5 h-3.5" /> Gruppen</TabsTrigger>
                        <TabsTrigger value="bracket" className="text-xs gap-1.5"><GitBranch className="w-3.5 h-3.5" /> K.o.-Bracket</TabsTrigger>
                    </TabsList>

                    {/* ── Spielplan (Liste) — jetzt Standard-Tab ── */}
                    <TabsContent value="list" className="space-y-4">

                        {/* Nächstes/Live Spiel Banner */}
                        <NextMatchBanner matches={matches} onClick={setSelectedMatch} />

                        {/* Suche */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Team oder Stadion suchen…"
                                className="w-full pl-9 pr-9 py-2 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>
                            )}
                        </div>

                        {/* Filter Chips */}
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {FILTERS.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setActiveFilter(f.id)}
                                    className={cn(
                                        'flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all',
                                        activeFilter === f.id
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                                    )}
                                >
                                    {f.label}
                                    {f.id === 'live' && liveCount > 0 && (
                                        <span className="ml-1 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full">
                                            {liveCount}
                                        </span>
                                    )}
                                    {f.id === 'today' && todayCount > 0 && (
                                        <span className="ml-1 bg-primary/80 text-primary-foreground text-[9px] font-bold px-1 rounded-full">
                                            {todayCount}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Ergebnisse */}
                        {isLoading ? (
                            <div className="space-y-3">
                                {[1,2,3].map(i => <div key={i} className="h-28 rounded-xl bg-card border border-border animate-pulse" />)}
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">Keine Spiele gefunden</p>
                                {search && <button onClick={() => setSearch('')} className="text-xs text-primary mt-1 underline">Suche zurücksetzen</button>}
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {sortedDates.map(dateStr => (
                                    <div key={dateStr}>
                                        {/* Datums-Trenner */}
                                        <div className="flex items-center gap-3 mb-2">
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                {formatDateHeader(dateStr)}
                                            </p>
                                            <div className="flex-1 h-px bg-border/50" />
                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                                {grouped[dateStr].length} Spiel{grouped[dateStr].length !== 1 ? 'e' : ''}
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {grouped[dateStr].map(m => (
                                                <MatchCard key={m.id} match={m} onClick={setSelectedMatch} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Gruppenphase ── */}
                    <TabsContent value="groups">
                        <GroupStageView matches={matches} />
                    </TabsContent>

                    {/* ── K.o.-Bracket ── */}
                    <TabsContent value="bracket">
                        <BracketView matches={matches} />
                    </TabsContent>
                </Tabs>
            </div>

            {/* Detail Sheet */}
            <MatchDetailSheet
                match={selectedMatch}
                open={!!selectedMatch}
                onClose={() => setSelectedMatch(null)}
                onEdit={permissions.isManager ? (m) => { setSelectedMatch(null); setEditMatch(m); } : null}
            />

            {/* Edit Modal */}
            {editMatch !== null && (
                <MatchEditModal
                    match={editMatch?.id ? editMatch : null}
                    open={editMatch !== null}
                    onClose={() => setEditMatch(null)}
                    onSave={() => { setEditMatch(null); queryClient.invalidateQueries({ queryKey: ['world-cup-matches'] }); }}
                />
            )}
        </div>
    );
}
