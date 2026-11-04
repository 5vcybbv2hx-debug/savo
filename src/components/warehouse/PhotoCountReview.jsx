import { AlertTriangle, Sparkles, PencilLine } from 'lucide-react';
import PhotoCountRow from './PhotoCountRow';

export default function PhotoCountReview({ rows, onChange, photoQuality, summary, unknownItems = [], onManual }) {
  const lowQuality = photoQuality === 'schlecht';
  const hasUncertain = rows.some((r) => r.uncertain);

  return (
    <div className="space-y-3">
      {(lowQuality || hasUncertain) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {lowQuality
                ? 'Foto-Qualität schlecht — keine Mengen vorausgefüllt'
                : 'Einzelne Artikel unsicher — Mengen bitte prüfen'}
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

      {rows.map((row) => (
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