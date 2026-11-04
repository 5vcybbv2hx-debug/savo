import React from 'react';
import { CheckCircle2, AlertTriangle, ExternalLink, TrendingDown, TrendingUp } from 'lucide-react';

export default function BookingResult({ result, onReset }) {
  if (!result) return null;
  const hasErrors = (result.errors?.length || 0) > 0;

  return (
    <div className="space-y-3">
      <div className={hasErrors ? 'rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4' : 'rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4'}>
        <div className="flex items-start gap-2">
          {hasErrors
            ? <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            : <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">
              {hasErrors ? 'Teilweise gebucht' : 'Wareneingang gebucht'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{result.summary}</p>
          </div>
        </div>
      </div>

      {result.counts && (
        <div className={result.counts.leergut > 0 ? 'grid grid-cols-2 sm:grid-cols-4 gap-2' : 'grid grid-cols-3 gap-2'}>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold text-foreground num">{result.counts.booked ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Positionen Ware gebucht</p>
          </div>
          {result.counts.leergut > 0 && (
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-lg font-bold text-amber-500 num">{result.counts.leergut}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Leergut (nicht gebucht)</p>
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold text-emerald-500 num">{result.counts.withPrice ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">mit Preis übernommen</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold text-muted-foreground num">{result.counts.withoutPrice ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ohne Preis</p>
          </div>
        </div>
      )}

      {result.priceChanges?.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Preisänderungen</p>
          <div className="space-y-1">
            {result.priceChanges.map((c, i) => {
              const up = Number(c.new_price) > Number(c.old_price);
              return (
                <div key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-foreground">{c.article_name}</span>
                  <span className={up ? 'inline-flex items-center gap-1 text-destructive num' : 'inline-flex items-center gap-1 text-emerald-500 num'}>
                    {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {Number(c.old_price).toFixed(2)} → {Number(c.new_price).toFixed(2)} €
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result.unbooked?.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 mb-2">Nicht gebucht – kein Artikel zugeordnet</p>
          <ul className="space-y-1">
            {result.unbooked.map((u, i) => (
              <li key={i} className="text-sm text-foreground">• {u.name}</li>
            ))}
          </ul>
        </div>
      )}

      {hasErrors && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-destructive mb-2">Fehler</p>
          <ul className="space-y-1">
            {result.errors.map((e, i) => (
              <li key={i} className="text-sm text-foreground">
                {e.position > 0 ? `Position ${e.position}: ` : `${e.name}: `}{e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {result.note?.file_url && (
          <a
            href={result.note.file_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-secondary text-sm font-medium text-foreground"
          >
            <ExternalLink className="w-4 h-4" /> Beleg öffnen
          </a>
        )}
        <button
          type="button"
          onClick={onReset}
          className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          Neuen Lieferschein scannen
        </button>
      </div>
    </div>
  );
}