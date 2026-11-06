import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function formatPrice(p) {
    if (p == null) return '–';
    return `${Number(p).toFixed(2)} €`;
}

function PriceChangeRow({ entry }) {
    const isIncrease = entry.new_price > (entry.old_price ?? 0);
    const isDecrease = entry.new_price < (entry.old_price ?? 0);
    const hasOld = entry.old_price != null;

    return (
        <div className="flex flex-col gap-1 py-3 border-b border-border/50 last:border-0">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    {hasOld ? (
                        isIncrease ? (
                            <TrendingUp className="w-4 h-4 text-status-danger shrink-0" />
                        ) : isDecrease ? (
                            <TrendingDown className="w-4 h-4 text-status-ok shrink-0" />
                        ) : (
                            <Minus className="w-4 h-4 text-muted-foreground shrink-0" />
                        )
                    ) : (
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="text-sm font-medium">
                        {hasOld ? (
                            <span>
                                <span className="text-muted-foreground line-through">{formatPrice(entry.old_price)}</span>
                                <span className="mx-1.5 text-muted-foreground">→</span>
                                <span className={cn(
                                    'font-bold',
                                    isIncrease && 'text-status-danger',
                                    isDecrease && 'text-status-ok',
                                    !isIncrease && !isDecrease && 'text-foreground'
                                )}>{formatPrice(entry.new_price)}</span>
                            </span>
                        ) : (
                            <span className="font-bold text-foreground">Erstpreis: {formatPrice(entry.new_price)}</span>
                        )}
                    </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0 text-right">
                    <div>{entry.weekday || ''} {entry.change_date ? format(parseISO(entry.change_date), 'dd.MM.yy', { locale: de }) : ''}</div>
                    {entry.change_time && <div>{entry.change_time} Uhr</div>}
                </div>
            </div>
            <div className="flex items-center gap-2 pl-6 text-xs text-muted-foreground">
                {entry.changed_by_name || entry.changed_by || 'Unbekannt'}
                {entry.supplier_name && (
                    <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{entry.supplier_name}</span>
                )}
                {entry.note && <span className="italic truncate">· {entry.note}</span>}
            </div>
        </div>
    );
}

export default function PriceHistoryPanel({ articleId, currentPrice }) {
    const [expanded, setExpanded] = useState(false);
    const PREVIEW_COUNT = 3;

    const { data: history = [], isLoading } = useQuery({
        queryKey: ['price-history', articleId],
        queryFn: () => base44.entities.PriceHistory.filter({ article_id: articleId }, '-created_date'),
        enabled: !!articleId,
        staleTime: 30 * 1000
    });

    if (isLoading) {
        return <div className="py-2 text-sm text-muted-foreground">Lade Preishistorie...</div>;
    }

    if (history.length === 0) {
        return (
            <div className="py-3 text-sm text-muted-foreground italic">
                Noch keine Preisänderungen aufgezeichnet.
            </div>
        );
    }

    const visible = expanded ? history : history.slice(0, PREVIEW_COUNT);
    const hasMore = history.length > PREVIEW_COUNT;

    return (
        <div>
            <div className="divide-y divide-border/30">
                {visible.map(entry => (
                    <PriceChangeRow key={entry.id} entry={entry} />
                ))}
            </div>
            {hasMore && (
                <button
                    type="button"
                    onClick={() => setExpanded(e => !e)}
                    className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors min-h-[44px] w-full justify-center"
                >
                    {expanded ? (
                        <><ChevronUp className="w-4 h-4" /> Weniger anzeigen</>
                    ) : (
                        <><ChevronDown className="w-4 h-4" /> {history.length - PREVIEW_COUNT} weitere anzeigen</>
                    )}
                </button>
            )}
        </div>
    );
}