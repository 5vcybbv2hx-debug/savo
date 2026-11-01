import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DeliveryHistory from './DeliveryHistory';

/** Lieferschein-Verlauf als Unterbereich der Inventur. */
export default function DeliveriesTab({ active }) {
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['delivery-notes'],
    queryFn: async () => (await base44.entities.DeliveryNote.list('-delivery_date', 100)) || [],
    placeholderData: [],
    enabled: active,
  });

  return <DeliveryHistory notes={notes} isLoading={isLoading} />;
}