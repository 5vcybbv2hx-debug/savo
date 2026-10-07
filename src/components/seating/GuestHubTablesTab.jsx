/**
 * GuestHubTablesTab — neu
 * Tisch-Klick → direkt neue Reservierung anlegen (wenn frei) oder vorhandene öffnen.
 * View-Toggle bleibt (Grid / Liste), aber klarer und kompakter.
 */
import { useState } from 'react';
import { List, Grid2x2, Plus, Sparkles, MessageCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTableDisplayName } from '@/components/tables/TableNameDisplay';
import { STATUS_CONFIG, RES_STATUS_CONFIG, getEffectiveTableColor, getEffectiveTableDot, getEffectiveTableLabel } from './QuickReservationSheet';

export default function GuestHubTablesTab({
    tableWithStatus, stats, guestFilter, suggested, permissions,
    planView, setPlanView,
    highlightedTableNumbers = [],
    onTableSelect, onTableNewReservation, onCreateTable, onEditTable
}) {
    const getDayRes = (tableId) =>
        tableWithStatus.find(ts => ts.table.id === tableId)?.dayReservations || [];

    const isHighlighted = (table) => highlightedTableNumbers.includes(table.table_number);

    const hasNotes = (tableId) =>
        getDayRes(tableId).some(r => r.notes && r.notes.trim());

    const getNotesText = (tableId) =>
        getDayRes(tableId).filter(r => r.notes?.trim()).map(r => `${r.time}: ${r.notes}`).join(' | ');

    const handleTableClick = (table, status) => {
        // Freier Tisch → direkt neue Reservierung für diesen Tisch
        if (status === 'free' && onTableNewReservation) {
            onTableNewReservation(table);
        } else {
            onTableSelect(table);
        }
    };

    return (
        <div className="space-y-3">

            {/* View Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex rounded-xl bg-secondary/50 p-1 gap-1 border border-border">
                    {[
                        { id: 'plan', icon: Grid2x2, label: 'Grid' },
                        { id: 'list', icon: List, label: 'Liste' },
                    ].map(({ id, icon: Icon, label }) => (
                        <button key={id} onClick={() => setPlanView(id)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                planView === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            )}>
                            <Icon className="w-3.5 h-3.5" />{label}
                        </button>
                    ))}
                </div>
                {permissions.isManager && (
                    <Button size="sm" variant="outline" onClick={() => onCreateTable({})}
                        className="h-8 text-xs gap-1.5">
                        <Plus className="w-3.5 h-3.5" />Tisch
                    </Button>
                )}
            </div>

            {/* Tisch-Empfehlungen */}
            {guestFilter && suggested.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-3">
                    <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3.5 h-3.5" />Empfohlen für {guestFilter} Personen
                    </p>
                    <div className="flex gap-2 flex-wrap">
                        {suggested.map(t => (
                            <button key={t.id} onClick={() => handleTableClick(t, 'free')}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-sm font-medium text-amber-300 min-h-[44px]">
                                {getTableDisplayName(t)} · {t.capacity} Pl.
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {guestFilter && suggested.length === 0 && (
                <div className="rounded-xl border border-border bg-secondary/20 p-3 text-sm text-muted-foreground text-center">
                    Kein freier Tisch für {guestFilter} Personen verfügbar
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
                {[
                    { label: 'Frei', count: stats.free, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                    { label: 'Reserviert', count: stats.reserved, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                    { label: 'Bald', count: stats.soon, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                ].map(({ label, count, color, bg }) => (
                    <div key={label} className={cn('rounded-xl border p-3 text-center', bg)}>
                        <p className={cn('text-2xl font-bold tabular-nums', color)}>{count}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* ── GRID VIEW ─────────────────────────────────────────────── */}
            {planView === 'plan' && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {tableWithStatus.map(({ table, status, reservation }) => {
                        const effColor = getEffectiveTableColor(status, reservation);
                        const effDot   = getEffectiveTableDot(status, reservation);
                        const effLabel = getEffectiveTableLabel(status, reservation);
                        const dayRes   = getDayRes(table.id);
                        const noteExists = hasNotes(table.id);
                        const isFree = status === 'free';

                        return (
                            <button key={table.id}
                                onClick={() => handleTableClick(table, status)}
                                title={isFree ? 'Tippen um neue Reservierung anzulegen' : undefined}
                                className={cn(
                                    'rounded-2xl border-2 p-3 text-left transition-all active:scale-95 min-h-[96px] flex flex-col justify-between relative',
                                    effColor,
                                    suggested.some(s => s.id === table.id) && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-background',
                                    isHighlighted(table) && 'ring-2 ring-amber-500 ring-offset-1 ring-offset-background'
                                )}>

                                <div className="flex items-start justify-between gap-1">
                                    <span className="text-lg font-bold break-all flex-1 leading-tight">
                                        {getTableDisplayName(table)}
                                    </span>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className={cn('w-2.5 h-2.5 rounded-full', effDot)} />
                                        {noteExists && <MessageCircle className="w-3 h-3 opacity-60" />}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[11px] font-semibold">{effLabel}</p>
                                    <p className="text-[10px] opacity-65">{table.capacity} Pl.</p>
                                    {/* Tagesreservierungen kompakt */}
                                    {dayRes.slice(0, 2).map((r, i) => (
                                        <p key={i} className="text-[10px] font-medium truncate mt-0.5 flex items-center gap-0.5">
                                            <Clock className="w-2.5 h-2.5 shrink-0" />
                                            {r.time} · {r.guests}P.
                                        </p>
                                    ))}
                                    {dayRes.length > 2 && (
                                        <p className="text-[10px] opacity-50">+{dayRes.length - 2} weitere</p>
                                    )}
                                </div>

                                {/* Freier Tisch: + Icon als Hinweis */}
                                {isFree && (
                                    <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <Plus className="w-3 h-3 text-green-400" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── LIST VIEW ─────────────────────────────────────────────── */}
            {planView === 'list' && (
                <div className="space-y-2">
                    {tableWithStatus.map(({ table, status, reservation }) => {
                        const effColor = getEffectiveTableColor(status, reservation);
                        const effDot   = getEffectiveTableDot(status, reservation);
                        const effLabel = getEffectiveTableLabel(status, reservation);
                        const dayRes   = getDayRes(table.id);
                        const noteExists = hasNotes(table.id);
                        const isFree = status === 'free';

                        return (
                            <button key={table.id}
                                onClick={() => handleTableClick(table, status)}
                                className={cn(
                                    'w-full flex items-center gap-3 p-3.5 rounded-2xl border bg-card hover:bg-accent/30 active:scale-[0.99] transition-all min-h-[60px] text-left',
                                    isHighlighted(table) ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-border'
                                )}>

                                {/* Tisch-Nummer */}
                                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0', effColor)}>
                                    {table.number || getTableDisplayName(table).slice(0,3)}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-semibold text-foreground text-sm">{getTableDisplayName(table)}</p>
                                        {table.room && <span className="text-xs text-muted-foreground">· {table.room}</span>}
                                        <span className={cn('w-1.5 h-1.5 rounded-full ml-1', effDot)} />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {table.capacity} Pl. ·{' '}
                                        {isFree ? (
                                            <span className="text-green-400">Frei — tippen um Reservierung anzulegen</span>
                                        ) : (
                                            dayRes.slice(0, 2).map((r, i) => (
                                                <span key={i}>{i > 0 ? ', ' : ''}{r.time} {r.customer_name} ({r.guests}P.)</span>
                                            ))
                                        )}
                                        {dayRes.length > 2 && <span> +{dayRes.length - 2}</span>}
                                    </p>
                                    {noteExists && (
                                        <p className="text-xs text-muted-foreground italic truncate mt-0.5">
                                            💬 {getNotesText(table.id)}
                                        </p>
                                    )}
                                </div>

                                {/* Status Badge + Edit */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium', effColor)}>
                                        {effLabel}
                                    </span>
                                    {permissions.isManager && (
                                        <button onClick={e => { e.stopPropagation(); onEditTable(table); }}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}