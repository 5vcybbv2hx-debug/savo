import { Minus, Plus, EyeOff, Camera, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

function confidenceColor(value) {
  if (value >= 0.75) return 'bg-emerald-500';
  if (value >= 0.45) return 'bg-amber-500';
  return 'bg-destructive';
}

export default function PhotoCountRow({ row, onChange }) {
  const seen = row.suggestion != null;
  const uncertain = Boolean(row.uncertain);
  const pct = Math.round((row.confidence || 0) * 100);

  return (
    <div
      className={cn(
        'rounded-xl border p-3 space-y-2',
        !seen || uncertain ? 'bg-amber-500/5 border-amber-500/30' : 'bg-muted/20 border-border/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{row.article_name}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            {seen && !uncertain ? (
              <>
                <Camera className="w-3 h-3 shrink-0" />
                Foto-Vorschlag: {row.suggestion} Gebinde
              </>
            ) : seen ? (
              <>
                <AlertTriangle className="w-3 h-3 shrink-0 text-amber-500" />
                unsicher ({pct}%) — bitte manuell zählen
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3 shrink-0 text-amber-500" />
                im Foto nicht gesehen — bitte manuell zählen
              </>
            )}
          </p>
        </div>
        {seen && !uncertain && (
          <div className="flex flex-col items-end gap-1 shrink-0 w-16">
            <span className="text-[10px] font-semibold text-muted-foreground">{pct}%</span>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full rounded-full', confidenceColor(row.confidence))} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ count: Math.max(0, (row.count || 0) - 1) })}
          className="w-11 h-12 flex items-center justify-center rounded-xl border-2 border-border bg-card text-muted-foreground active:scale-95 shrink-0"
          aria-label="Weniger"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          placeholder="–"
          value={row.count ?? ''}
          onChange={(e) => {
            const parsed = parseInt(e.target.value);
            onChange({ count: isNaN(parsed) ? null : Math.max(0, parsed) });
          }}
          className={cn(
            'flex-1 text-center font-bold text-xl h-12 rounded-xl border-2 bg-background focus:outline-none focus:border-primary',
            row.count == null ? 'border-amber-500/50 placeholder:text-muted-foreground/50' : 'border-border'
          )}
        />
        <button
          type="button"
          onClick={() => onChange({ count: (row.count || 0) + 1 })}
          className="w-11 h-12 flex items-center justify-center rounded-xl border-2 border-border bg-card text-muted-foreground active:scale-95 shrink-0"
          aria-label="Mehr"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {row.suggestedOpened > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-muted-foreground flex-1">
            angebrochen ({row.suggestedOpened})
          </label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={row.opened ?? 0}
            onChange={(e) => {
              const parsed = parseInt(e.target.value);
              onChange({ opened: isNaN(parsed) ? 0 : Math.max(0, parsed) });
            }}
            className="w-20 text-center font-semibold h-10 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
          />
        </div>
      )}

      {row.comment && (
        <p className="text-[11px] text-muted-foreground italic">{row.comment}</p>
      )}
    </div>
  );
}