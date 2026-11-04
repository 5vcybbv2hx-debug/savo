import { AlertTriangle, Sparkles, PencilLine, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { segmentCuts } from '@/lib/photoCount';
import PhotoCountRow from './PhotoCountRow';

function PhotoPane({ label, src, cuts }) {
  return (
    <div className="space-y-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="relative rounded-lg overflow-hidden bg-black/50">
        <img src={src} alt={label} className="w-full max-h-44 object-contain" />
        {cuts.map((c, idx) => (
          <span
            key={idx}
            className="absolute inset-y-0 border-l border-white/70 pointer-events-none"
            style={{ left: `${c * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Prüf-Ansicht der Foto-Zählung.
 * Mit Basis: Basis-Foto und aktuelles Foto nebeneinander, gleiche Trennlinien.
 * Ohne Basis: Einzelbild mit Positionsraster.
 */
export default function PhotoCountReview({
  rows,
  onChange,
  photoQuality,
  summary,
  unknownItems = [],
  onManual,
  preview,
  baselineUrl,
  baselineSegments = [],
  detectedTotal,
  orderConfirmed,
  onConfirmOrder,
}) {
  const lowQuality = photoQuality === 'schlecht';
  const hasUncertain = rows.some((r) => r.uncertain);
  const ordered = [...rows].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const overlaySegments = baselineSegments.length ? baselineSegments : ordered;
  const cuts = segmentCuts(overlaySegments);

  return (
    <div className="space-y-3">
      {preview && (
        <div className="space-y-2">
          {baselineUrl ? (
            <div className="grid grid-cols-2 gap-1.5">
              <PhotoPane label="Basis" src={baselineUrl} cuts={cuts} />
              <PhotoPane label="aktuell" src={preview} cuts={cuts} />
            </div>
          ) : (
            <PhotoPane label="aktuell" src={preview} cuts={cuts} />
          )}

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
                {row.baselineCount != null && (
                  <span className="text-muted-foreground tabular-nums">/ {row.baselineCount}</span>
                )}
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

          {!baselineUrl && (
            <p className="text-[10px] text-muted-foreground">
              Ohne Basis gezählt — einmal eine Fach-Basis aufnehmen verbessert die Trefferquote.
            </p>
          )}
        </div>
      )}

      {(lowQuality || hasUncertain) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {lowQuality
                ? 'Foto-Qualität schlecht — keine Mengen vorausgefüllt'
                : 'Einzelne Segmente unsicher — Mengen bitte prüfen'}
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