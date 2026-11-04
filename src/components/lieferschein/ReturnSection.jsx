import React from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { unitBreakdown } from '@/lib/deliveryNoteUnits';

/** Leergut/Rückgabe — nur informativ, wird beim Buchen nicht als Wareneingang gebucht. */
export default function ReturnSection({ positions, onChange, onRemove }) {
  if (!positions || positions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Leergut / Rückgabe
        </p>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {positions.length} Position{positions.length === 1 ? '' : 'en'} · nicht gebucht
        </span>
      </div>

      {positions.map((position, index) => {
        const breakdown = unitBreakdown(position);
        return (
          <div key={position._key || index} className="rounded-xl border border-border/70 bg-secondary/30 p-2.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground break-words leading-snug">
                  {position.raw_text || position.article_name}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  {position.page_number ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-secondary text-[10px] font-bold text-muted-foreground">
                      S. {position.page_number}
                    </span>
                  ) : null}
                  {position.supplier_article_number ? (
                    <span className="text-[11px] text-muted-foreground num">Art.-Nr. {position.supplier_article_number}</span>
                  ) : null}
                  <span className="text-[11px] text-muted-foreground num">{breakdown.text}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={position.quantity ?? ''}
                  onChange={(e) => onChange(index, { quantity: e.target.value === '' ? null : Number(e.target.value) })}
                  className="h-9 w-20 text-sm"
                />
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Zeile entfernen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}