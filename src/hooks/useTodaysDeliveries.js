import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Heute gebuchte Lieferscheine → Map article_id → gelieferte Einzeleinheiten.
 * Zeigt in der Inventur-Zählliste, welche Ware heute schon kam.
 */
export default function useTodaysDeliveries() {
  const { data: notes = [] } = useQuery({
    queryKey: ['delivery-notes-today'],
    queryFn: async () =>
      (await base44.entities.DeliveryNote.filter(
        { status: 'gebucht', delivery_date: today() },
        '-created_date',
        200
      )) || [],
    placeholderData: [],
    staleTime: 60_000,
  });

  const deliveredToday = {};
  notes.forEach((note) => {
    (note.positions || []).forEach((p) => {
      if (!p.article_id || !p.booked || p.action === 'price') return;
      const units = Number(p.booked_units ?? p.quantity ?? 0);
      if (!units) return;
      deliveredToday[p.article_id] = (deliveredToday[p.article_id] || 0) + units;
    });
  });

  return { notes, deliveredToday };
}