import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock, Check, ChevronDown, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    ABGEBAUTE_STATUS, PRIORITAET_META, PRIORITAET_OPTIONS, STATUS_META,
    SAVO_BLUE, fmtDate, fmtEUR, isOverdue, schuldnerMeta,
} from '@/lib/offenePosten';
import PostenDetails from '@/components/accounting/schulden/PostenDetails';
import BriefVollbildModal from '@/components/accounting/schulden/BriefVollbildModal';

/** Eine Posten-Karte: Badges, Betrag, Frist, optionaler Briefscan, Details + Aktionen. */
export default function PostenKarte({ posten, onMarkPaid, onPriorityChange, isPending }) {
    const [showDetails, setShowDetails] = useState(false);
    const [showScan, setShowScan] = useState(false);

    const prio   = PRIORITAET_META[posten.prioritaet] || PRIORITAET_META.mittel;
    const status = STATUS_META[posten.status] || STATUS_META.offen;
    const schuldner = schuldnerMeta(posten.schuldner);
    const overdue = isOverdue(posten);
    const done = ABGEBAUTE_STATUS.includes(posten.status);

    return (
        <Card className="p-3.5">
            {/* Schuldner — farbcodiert, immer sichtbar */}
            <Badge
                variant="outline"
                className={cn('gap-1.5 h-7 px-2.5 text-xs font-bold uppercase tracking-wide', schuldner.className)}
                style={schuldner.badgeStyle}
            >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: schuldner.dotColor }} />
                {schuldner.label}
            </Badge>

            <div className="flex gap-3 mt-2.5">
                {posten.bild_url && (
                    <button
                        type="button"
                        onClick={() => setShowScan(true)}
                        className="relative w-20 shrink-0 aspect-[3/4] rounded-lg overflow-hidden border border-border/60 bg-muted group"
                        aria-label={`Briefscan zu ${posten.titel} vergrößern`}
                    >
                        <img
                            src={posten.bild_url}
                            alt={`Briefscan zu ${posten.titel}`}
                            loading="lazy"
                            className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 w-5 h-5 rounded-md bg-black/55 flex items-center justify-center">
                            <Maximize2 className="w-3 h-3 text-white" />
                        </span>
                    </button>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={cn('gap-1', prio.className)}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', prio.dot)} />
                            {prio.label}
                        </Badge>
                        <Badge
                            variant="outline"
                            className={status.className}
                            style={posten.status === 'offen' ? { color: SAVO_BLUE, borderColor: SAVO_BLUE } : undefined}
                        >
                            {status.label}
                        </Badge>
                    </div>

                    <p className="text-sm font-semibold text-foreground mt-1.5">{posten.titel || 'Ohne Titel'}</p>
                    <p className="text-2xl font-bold tabular-nums text-foreground leading-tight mt-0.5">
                        {fmtEUR(posten.betrag)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{posten.glaeubiger || 'Gläubiger unbekannt'}</p>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                        <span className={cn('inline-flex items-center gap-1', overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground')}>
                            <CalendarClock className="w-3 h-3" />
                            {posten.faelligkeit ? `Fällig ${fmtDate(posten.faelligkeit)}` : 'Keine Frist gesetzt'}
                            {overdue && ' · überfällig'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
                <Select
                    value={posten.prioritaet || 'mittel'}
                    onValueChange={(v) => onPriorityChange(posten, v)}
                >
                    <SelectTrigger className="h-8 w-[128px] text-xs shrink-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PRIORITAET_OPTIONS.map(p => (
                            <SelectItem key={p} value={p}>{PRIORITAET_META[p].label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    type="button"
                    size="sm"
                    variant={done ? 'outline' : 'default'}
                    disabled={done || isPending}
                    onClick={() => onMarkPaid(posten)}
                    className="h-8 flex-1 gap-1.5 text-xs"
                >
                    <Check className="w-3.5 h-3.5" />
                    {done
                        ? `Bezahlt${posten.bezahlt_am ? ` am ${fmtDate(posten.bezahlt_am)}` : ''}`
                        : 'Als bezahlt markieren'}
                </Button>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => setShowDetails(s => !s)}
                    aria-expanded={showDetails}
                    aria-label="Details anzeigen"
                >
                    <ChevronDown className={cn('w-4 h-4 transition-transform', showDetails && 'rotate-180')} />
                </Button>
            </div>

            {showDetails && <PostenDetails posten={posten} />}

            {showScan && (
                <BriefVollbildModal
                    open={showScan}
                    onOpenChange={setShowScan}
                    url={posten.bild_url}
                    titel={posten.titel}
                />
            )}
        </Card>
    );
}