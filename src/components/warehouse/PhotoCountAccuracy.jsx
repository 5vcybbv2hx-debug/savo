import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subDays } from 'date-fns';
import { Camera, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { usePermissions } from '@/components/auth/usePermissions';
import { analyzePhotoCounts } from '@/lib/photoCountAccuracy';
import { cn } from '@/lib/utils';

const PERIODS = [7, 30];

/**
 * Foto-Zählung — Trefferquote (Kalibrierung).
 * Basis: PhotoCountSample.suggested_counts vs. final_counts. Nur für Manager.
 */
export default function PhotoCountAccuracy() {
  const { isManager } = usePermissions();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);

  const { data: samples = [] } = useQuery({
    queryKey: ['photo-count-samples'],
    queryFn: () => base44.entities.PhotoCountSample.list('-created_date', 500),
    enabled: Boolean(isManager) && open,
    staleTime: 60_000,
  });

  if (!isManager) return null;

  const cutoff = subDays(new Date(), days).getTime();
  const inRange = samples.filter((s) => {
    const ts = s.created_date ? new Date(s.created_date).getTime() : 0;
    return ts >= cutoff;
  });
  const { overall, slots } = analyzePhotoCounts(inRange);
  const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);

  return (
    <Card className="border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
      >
        <Camera className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1">Foto-Zählung — Trefferquote</span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/40 pt-3">
          <div className="flex gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setDays(p)}
                className={cn(
                  'px-2.5 h-7 rounded-lg text-[11px] font-semibold border transition-colors',
                  days === p
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border'
                )}
              >
                {p} Tage
              </button>
            ))}
          </div>

          {overall.photos === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Noch keine Foto-Zählungen im Zeitraum erfasst.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-muted/30 px-2 py-2">
                  <p className="text-[11.5px] text-muted-foreground">Trefferquote</p>
                  <p className="text-base font-bold text-foreground tabular-nums">{pct(overall.hitRate)}</p>
                </div>
                <div className="rounded-xl bg-muted/30 px-2 py-2">
                  <p className="text-[11.5px] text-muted-foreground">Ø Abweichung</p>
                  <p className="text-base font-bold text-foreground tabular-nums">
                    {overall.avgDeviation == null ? '–' : overall.avgDeviation.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/30 px-2 py-2">
                  <p className="text-[11.5px] text-muted-foreground">conf. &lt; 0,5</p>
                  <p className="text-base font-bold text-foreground tabular-nums">{pct(overall.lowConfRate)}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[11.5px] font-medium text-muted-foreground">Je Fach</p>
                {slots.map((slot) => (
                  <div key={slot.key} className="flex items-center gap-2 text-xs py-1 border-b border-border/30 last:border-0">
                    <span className="flex-1 min-w-0 truncate text-foreground">{slot.key}</span>
                    <span className="tabular-nums text-muted-foreground w-12 text-right">{pct(slot.hitRate)}</span>
                    <span className="tabular-nums text-muted-foreground w-14 text-right">
                      ±{slot.avgDeviation == null ? '–' : slot.avgDeviation.toFixed(1)}
                    </span>
                    <span className="tabular-nums text-muted-foreground w-12 text-right">
                      {pct(slot.lowConfRate)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Treffer = Vorschlag unverändert übernommen · {overall.compared} Sorten-Vergleiche
                {' '}· mit Basis: {overall.baselinePhotos}/{overall.photos}
              </p>
            </>
          )}
        </div>
      )}
    </Card>
  );
}