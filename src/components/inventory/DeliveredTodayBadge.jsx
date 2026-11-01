import React from 'react';
import { Truck } from 'lucide-react';

/** Kleines Badge in der Inventur-Zählliste: Ware kam heute per Lieferschein. */
export default function DeliveredTodayBadge({ units }) {
  const value = Number(units) || 0;
  if (value <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 text-[10px] font-semibold"
      title="Für diesen Artikel wurde heute ein Lieferschein gebucht"
    >
      <Truck className="w-3 h-3" /> heute geliefert: {Number(value.toFixed(2))}
    </span>
  );
}