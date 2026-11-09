import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Check, ChevronDown, Package, Send, CalendarClock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHECKS, statusMeta, monthLabel, shortDate } from '@/lib/monatsabschluss';

/**
 * Eine Karte pro Monat: Prüfpunkte abhaken, Lücken notieren, Paket bauen.
 */
export default function MonatsabschlussKarte({ row, kasse, lohn, today, onPatch, onBuildPaket, onMarkSent }) {
    const [luecken, setLuecken] = useState(row.luecken || '');
    const [besitzer, setBesitzer] = useState(row.besitzer || '');

    const meta      = statusMeta(row.status);
    const done      = CHECKS.filter(c => row[c.key]);
    const doneCount = done.length;
    const pct       = Math.round((doneCount / CHECKS.length) * 100);
    const allDone   = doneCount === CHECKS.length;
    const missing   = CHECKS.filter(c => !row[c.key]).map(c => c.label).join(', ');
    const overdue   = row.faellig_am && row.faellig_am < today && row.status !== 'versendet' && row.status !== 'fertig';

    const detailFor = key => {
        if (key === 'check_kasse') {
            const text = `${kasse.booked} von ${kasse.expected} Tagen gebucht`;
            return { text: kasse.complete ? `${text} · automatisch` : text, ok: kasse.complete };
        }
        if (key === 'check_lohn') {
            const hours = lohn.hours.toLocaleString('de-DE', { maximumFractionDigits: 1 });
            return { text: `${hours} h · ${lohn.employees} Mitarbeiter`, ok: false };
        }
        return null;
    };

    return (
        <Card className="p-4 space-y-3">
            {/* ── Kopf: Monat · Status · Fälligkeit · Besitzer ───────────── */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold text-foreground tracking-tight">{monthLabel(row.month)}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span className={cn('flex items-center gap-1 shrink-0', overdue && 'text-status-danger')}>
                            <CalendarClock className="w-3 h-3" />
                            {row.faellig_am ? `fällig ${shortDate(row.faellig_am)}` : 'keine Fälligkeit'}
                        </span>
                        <span className="flex items-center gap-1 min-w-0 flex-1">
                            <User className="w-3 h-3 shrink-0" />
                            <input
                                value={besitzer}
                                onChange={e => setBesitzer(e.target.value)}
                                onBlur={() => {
                                    const next = besitzer.trim();
                                    if (next !== (row.besitzer || '')) onPatch(row.id, { besitzer: next });
                                }}
                                placeholder="wer ist dran?"
                                className="min-w-0 flex-1 bg-transparent p-0 text-[11px] text-foreground/80 focus:outline-none placeholder:text-muted-foreground/60"
                            />
                        </span>
                    </div>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[11px] font-medium shrink-0 transition-colors',
                            meta.className
                        )}>
                            {meta.label}
                            <ChevronDown className="w-3 h-3 opacity-70" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {['offen', 'in_arbeit', 'pruefung', 'fertig', 'versendet'].map(key => (
                            <DropdownMenuItem key={key} onSelect={() => onPatch(row.id, { status: key })} className="text-xs">
                                {statusMeta(key).label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* ── Fortschritt ────────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <Progress value={pct} className="flex-1" />
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground shrink-0">
                    {doneCount}/5 · {pct} %
                </span>
            </div>

            {/* ── Fünf Prüfpunkte ────────────────────────────────────────── */}
            <div className="divide-y divide-border/50">
                {CHECKS.map(check => {
                    const isDone = !!row[check.key];
                    const detail = detailFor(check.key);
                    return (
                        <button
                            key={check.key}
                            onClick={() => onPatch(row.id, { [check.key]: !isDone })}
                            className="w-full flex items-start gap-2.5 py-2 text-left active:opacity-70 transition-opacity"
                        >
                            <span className={cn(
                                'mt-0.5 w-5 h-5 rounded-[6px] border flex items-center justify-center shrink-0 transition-colors',
                                isDone ? 'bg-status-ok border-status-ok text-primary-foreground' : 'border-border bg-transparent'
                            )}>
                                {isDone && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className={cn('block text-sm leading-tight', isDone ? 'text-foreground' : 'text-foreground/90')}>
                                    {check.label}
                                </span>
                                {check.hint && (
                                    <span className="block text-[10px] text-muted-foreground/70 mt-0.5">{check.hint}</span>
                                )}
                                {detail && (
                                    <span className={cn(
                                        'block text-[10px] mt-0.5 tabular-nums',
                                        detail.ok ? 'text-status-ok font-medium' : 'text-muted-foreground/80'
                                    )}>
                                        {detail.text}
                                    </span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Lücken ─────────────────────────────────────────────────── */}
            <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">Lücken</p>
                <Textarea
                    value={luecken}
                    onChange={e => setLuecken(e.target.value)}
                    onBlur={() => {
                        if (luecken !== (row.luecken || '')) onPatch(row.id, { luecken });
                    }}
                    placeholder="Was fehlt? z. B. Kontoauszüge Juli, Belege Woche 32"
                    rows={2}
                    className="text-xs min-h-[56px] rounded-xl"
                />
            </div>

            {/* ── Aktionen ───────────────────────────────────────────────── */}
            <div className="space-y-2">
                <TooltipProvider delayDuration={200}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="block">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!allDone}
                                    onClick={() => onBuildPaket(row)}
                                    className="w-full gap-1.5"
                                >
                                    <Package className="w-4 h-4" />
                                    Paket bauen
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            {allDone
                                ? (row.paket_gebaut_am ? `Gebaut am ${shortDate(row.paket_gebaut_am)}` : 'Alle Prüfpunkte erledigt — Paket kann gebaut werden')
                                : `Erst alle fünf Häkchen setzen — offen: ${missing}`}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <Button
                    size="sm"
                    disabled={row.status === 'versendet'}
                    onClick={() => onMarkSent(row)}
                    className="w-full gap-1.5"
                >
                    <Send className="w-4 h-4" />
                    Als versendet markieren
                </Button>
            </div>
        </Card>
    );
}