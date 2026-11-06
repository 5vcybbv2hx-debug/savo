import { Minus, Plus, EyeOff, Camera, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

function confidenceColor(value) {
  if (value >= 0.75) return 'bg-status-ok/70';
  if (value >= 0.45) return 'bg-status-warn/70';
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
        !seen || uncertain ? 'bg-status-warn/5 border-status-warn/30' : 'bg-muted/20 border-border/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
              {row.position}
            </span>
            <p className="text-sm font-bold text-foreground truncate">{row.article_name}</p>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            {seen && !uncertain ? (
              <>
                <Camera className="w-3 h-3 shrink-0" />
                Foto-Vorschlag: {row.suggestion} Flaschen/Dosen
              </>
            ) : seen ? (
              <>
                <AlertTriangle className="w-3 h-3 shrink-0 text-status-warn" />
                unsicher ({pct}%) — bitte manuell zählen
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3 shrink-0 text-status-warn" />
                im Foto nicht gesehen — bitte manuell zählen
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {row.baselineCount != null && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary whitespace-nowrap">
              Basis {row.baselineCount}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span
              className={cn('w-2 h-2 rounded-full shrink-0', confidenceColor(row.confidence))}
              title={`Confidence ${pct}%`}
            />
            <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">{pct}%</span>
          </span>
        </div>
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
            row.count == null ? 'border-status-warn/50 placeholder:text-muted-foreground/50' : 'border-border'
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

      {row.min_stock > 0 && row.count != null && (
        <p className="text-[11px] text-muted-foreground">
          Soll {row.min_stock} · auffüllen{' '}
          <span className="font-bold text-foreground">{Math.max(0, row.min_stock - row.count)}</span> Flaschen/Dosen
        </p>
      )}

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