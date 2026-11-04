import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { usePermissions } from '@/components/auth/usePermissions';
import { haptics } from '@/components/utils/haptics';
import { ListOrdered, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Fächer ohne bestätigte Sortenreihenfolge.
 * Ein Fach gilt als offen, wenn mehr als eine aktive Zuordnung drin liegt und
 * variety_order_confirmed leer ist. Einmal durchgehen reicht (Quelle: manuell).
 */
export default function VarietyOrderChecklist({ slots = [], assignments = [] }) {
  const { isManager } = usePermissions();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  if (!isManager) return null;

  const countBySlot = {};
  assignments.forEach((a) => {
    countBySlot[a.storage_slot_id] = (countBySlot[a.storage_slot_id] || 0) + 1;
  });

  const pending = slots
    .filter((s) => (countBySlot[s.id] || 0) > 1 && !s.variety_order_confirmed)
    .sort((a, b) => (a.full_name || a.name || '').localeCompare(b.full_name || b.name || '', 'de'));

  const confirm = async (slot) => {
    setBusyId(slot.id);
    try {
      await base44.entities.StorageSlot.update(slot.id, {
        variety_order_confirmed: format(new Date(), 'yyyy-MM-dd'),
        variety_order_source: 'manuell',
      });
      haptics.medium();
      qc.invalidateQueries({ queryKey: ['slots'] });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
      >
        <ListOrdered className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1">Fächer ohne bestätigte Sortenreihenfolge</span>
        <span className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums',
          pending.length > 0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        )}>
          {pending.length}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-3 border-t border-border/40 space-y-1.5">
          {pending.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Alle Fächer mit mehreren Sorten sind geprüft.
            </p>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground">
                Einmal durchgehen: stimmt die Reihenfolge der Sorten im Fach (links → rechts)?
              </p>
              {pending.map((slot) => (
                <div key={slot.id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{slot.full_name || slot.name}</p>
                    <p className="text-[10px] text-muted-foreground">{countBySlot[slot.id]} Sorten</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => confirm(slot)}
                    disabled={busyId === slot.id}
                    className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border bg-card text-[11px] font-bold text-foreground active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" /> Passt
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </Card>
  );
}