import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { usePermissions } from '@/components/auth/usePermissions';
import { Camera, ChevronDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import BaselineWizard from './BaselineWizard';

/**
 * Fach-Basis: Einstieg in den Wizard + Liste der Fächer mit/ohne Basis.
 * Nur Manager/Inhaber.
 */
export default function BaselineStatusCard({ slots = [], assignments = [] }) {
  const { isManager } = usePermissions();
  const [open, setOpen] = useState(false);
  const [wizardSlotId, setWizardSlotId] = useState(null);

  if (!isManager) return null;

  const countBySlot = {};
  assignments.forEach((a) => {
    countBySlot[a.storage_slot_id] = (countBySlot[a.storage_slot_id] || 0) + 1;
  });

  const withAssignments = slots
    .filter((s) => (countBySlot[s.id] || 0) > 0)
    .sort((a, b) => (a.full_name || a.name || '').localeCompare(b.full_name || b.name || '', 'de'));

  const without = withAssignments.filter((s) => !s.baseline_photo_url);
  const withBaseline = withAssignments.filter((s) => Boolean(s.baseline_photo_url));

  return (
    <Card className="border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
      >
        <Camera className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1">Fächer ohne Basis</span>
        <span className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums',
          without.length > 0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        )}>
          {without.length}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-3 border-t border-border/40 space-y-3">
          <p className="text-[10px] text-muted-foreground">
            Einmal je Fach eine Basis aufnehmen: künftige Fotos werden dagegen verglichen und je Sorte gezählt.
          </p>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ohne Basis</p>
            {without.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">Alle Fächer haben eine Basis.</p>
            ) : (
              without.map((slot) => (
                <div key={slot.id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{slot.full_name || slot.name}</p>
                    <p className="text-[10px] text-muted-foreground">{countBySlot[slot.id]} Sorten</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWizardSlotId(slot.id)}
                    className="h-8 px-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-[11px] font-bold active:scale-95 shrink-0"
                  >
                    Basis aufnehmen
                  </button>
                </div>
              ))
            )}
          </div>

          {withBaseline.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Basis vorhanden</p>
              {withBaseline.map((slot) => (
                <div key={slot.id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate flex items-center gap-1">
                      {slot.baseline_locked && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                      {slot.full_name || slot.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {slot.baseline_date || 'ohne Datum'}
                      {(slot.baseline_segments?.length || 0) > 0 ? ` · ${slot.baseline_segments.length} Segmente` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWizardSlotId(slot.id)}
                    className="h-8 px-2.5 rounded-lg border border-border bg-card text-[11px] font-bold text-foreground active:scale-95 shrink-0"
                  >
                    Neu aufnehmen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <BaselineWizard
        open={Boolean(wizardSlotId)}
        slots={slots}
        assignments={assignments}
        initialSlotId={wizardSlotId || undefined}
        onClose={() => setWizardSlotId(null)}
      />
    </Card>
  );
}