/**
 * useReservations.js
 * React Query hooks for the Reservations feature.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { useMemo } from 'react';
import {
    reservationService,
    groupByStatus,
    sortByTime,
} from '../services/reservationService';
import { toast } from 'sonner';

export const RES_KEYS = {
    all:     ['reservations'],
    active:  ['reservations', 'active'],
    archived:['reservations', 'archived'],
    forDate: (d) => ['reservations', 'date', d],
};

export function useReservations() {
    return useQuery({
        queryKey: RES_KEYS.active,
        queryFn:  () => reservationService.list(false),
        staleTime: STALE.MEDIUM,
    });
}

export function useArchivedReservations() {
    return useQuery({
        queryKey: RES_KEYS.archived,
        queryFn:  () => reservationService.list(true),
    });
}

export function useReservationsForDate(dateStr) {
    return useQuery({
        queryKey: RES_KEYS.forDate(dateStr),
        queryFn:  () => reservationService.forDate(dateStr),
        enabled:  !!dateStr,
        select:   sortByTime,   // transform data once, not on every render
    });
}

/** Status-grouped summary — memoised so grouping only re-runs on data change */
export function useReservationSummary() {
    const { data = [], ...rest } = useReservations();
    const grouped = useMemo(() => groupByStatus(data), [data]);
    return { grouped, total: data.length, ...rest };
}

// ── Mutations ─────────────────────────────────────────────────────────────────
function useInvalidateAll() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: RES_KEYS.all });
}

export function useCreateReservation() {
    const invalidate = useInvalidateAll();
    return useMutation({
        mutationFn: (data) => data.is_recurring
            ? reservationService.createRecurring(data)
            : reservationService.create(data),
        onSuccess: (_, data) => {
            invalidate();
            toast.success(data.is_recurring ? 'Wiederkehrende Reservierung angelegt' : 'Reservierung erstellt');
        },
    });
}

export function useUpdateReservation() {
    const invalidate = useInvalidateAll();
    return useMutation({
        mutationFn: ({ id, data }) => reservationService.update(id, data),
        onSuccess: () => { invalidate(); toast.success('Reservierung gespeichert'); },
    });
}

export function useConfirmReservation() {
    const invalidate = useInvalidateAll();
    return useMutation({
        mutationFn: (id) => reservationService.confirm(id),
        onSuccess: () => { invalidate(); toast.success('Reservierung bestätigt'); },
    });
}

export function useCancelReservation() {
    const invalidate = useInvalidateAll();
    return useMutation({
        mutationFn: (id) => reservationService.cancel(id),
        onSuccess: () => { invalidate(); toast.success('Reservierung storniert'); },
    });
}

export function useArchiveReservation() {
    const invalidate = useInvalidateAll();
    return useMutation({
        mutationFn: (id) => reservationService.archive(id),
        onSuccess:  invalidate,
    });
}

export function useDeleteReservation() {
    const invalidate = useInvalidateAll();
    return useMutation({
        mutationFn: (id) => reservationService.delete(id),
        onSuccess: invalidate,
    });
}

export function useSendConfirmation() {
    return useMutation({
        mutationFn: (reservationId) => reservationService.sendConfirmation(reservationId),
        onSuccess: () => toast.success('Bestätigungsmail versendet'),
    });
}