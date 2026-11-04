import { AlertTriangle, Sparkles, PencilLine, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import PhotoCountRow from './PhotoCountRow';

/**
 * Prüf-Ansicht der Foto-Zählung.
 * Segmente = Sorten in Fachreihenfolge (links → rechts). Über dem Foto liegen
 * dünne, gleiche Trennlinien (n Segmente = n Sorten) als reines Overlay.
 */
export default function PhotoCountReview({
  rows,
  onChange,
  photoQuality,
  summary,
  unknownItems = [],
  onManual,
  preview,
  detectedTotal,
  orderConfirmed,
  onConfirmOrder,
}) {
  const lowQuality = photoQuality === 'schlecht';
  const hasUncertain = rows.some((r) => r.uncertain);
  const ordered = [...rows].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const segments = ordered.length;

  return (
    <div className="space-y-3">
      {preview && (
        <div className="space-y-2">
          <div className="relative rounded-xl overflow-hidden bg-black/50">
            <img src={preview} alt="Fach-Foto" className="w-full max-h-72 object-contain" />
            {segments > 1 && (
              <div className="absolute inset-0 flex pointer-events-none">
                {ordered.map((row, idx) => (
                  <div
                    key={row.assignmentId}
                    className={cn('relative flex-1 min-w-0', idx < segments - 1 && 'border-r border-white/70')}
                  >
                    <span className="absolute top-1 left-1/2 -translate-x-1/2 min-w-[18px] h-[18px] px-1 rounded-full bg-black/70 text-white text-[10px] font-bold flex items-center justify-center">
                      {row.position}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {ordered.map((row) => (
              <span
                key={row.assignmentId}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] max-w-full',
                  row.count == null ? 'border-amber-500/40 bg-amber-500/10' : 'border-border/60 bg-card'
                )}
              >
                <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                  {row.position}
                </span>
                <span className="truncate max-w-[110px] text-foreground">{row.article_name}</span>
                <span className="font-bold tabular-nums text-foreground">{row.count ?? '–'}</span>
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            {orderConfirmed ? (
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Reihenfolge bestätigt · {format(new Date(orderConfirmed), 'dd.MM.yyyy')}
              </p>
            ) : (
              <button
                type="button"
                onClick={onConfirmOrder}
                className="text-[11px] font-bold px-2.5 h-8 rounded-lg border border-primary/30 bg-primary/10 text-primary active:scale-95"
              >
                Reihenfolge passt zum Foto
              </button>
            )}
            {detectedTotal != null && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                Foto gesamt: {detectedTotal} Fl./Dose
              </span>
            )}
          </div>
        </div>
      )}

      {(lowQuality || hasUncertain) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {lowQuality
                ? 'Foto-Qualität schlecht — keine Mengen vorausgefüllt'
                : 'Einzelne Sorten unsicher — Mengen bitte prüfen'}
            </p>
          </div>
          {onManual && (
            <button
              onClick={onManual}
              className="w-full h-10 rounded-lg border border-amber-500/40 bg-card text-xs font-bold text-foreground flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <PencilLine className="w-3.5 h-3.5" /> Manuell zählen (ohne Vorschlag)
            </button>
          )}
        </div>
      )}

      {summary && (
        <div className="flex items-start gap-2 rounded-xl bg-primary/10 border border-primary/20 p-3">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/80">{summary}</p>
        </div>
      )}

      {ordered.map((row) => (
        <PhotoCountRow key={row.assignmentId} row={row} onChange={(patch) => onChange(row.assignmentId, patch)} />
      ))}

      {unknownItems.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Zusätzlich im Foto (wird nicht gebucht)
          </p>
          {unknownItems.map((item, idx) => (
            <p key={idx} className="text-xs text-foreground/70">
              {item.description} · {item.count}×
            </p>
          ))}
        </div>
      )}
    </div>
  );
}