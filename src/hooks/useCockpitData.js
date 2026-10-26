/**
 * useCockpitData — lädt und berechnet die Kennzahlen des Finanz-Cockpits.
 *
 * - Zeitraum-Queries (DailyRevenue, TimeEntry) laufen über fetchUntilDateCovered,
 *   damit auch bei wachsenden Tabellen nichts abgeschnitten wird.
 * - Query-Keys sind nach Zeitraum-Typ getrennt; ein Wechsel zeigt bis zum
 *   Eintreffen der neuen Daten den letzten Stand (placeholderData, kein initialData).
 * - Das Vorjahresfenster kommt aus derselben Query mit (prevFrom…to).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchUntilDateCovered } from '@/lib/adaptiveFetch';
import {
    getCockpitPeriod, inRange, sumRevenue, laborCost, monthlyFixedCosts,
    fixedCostsForPeriod, dailyRevenueSeries, pctDelta,
} from '@/lib/cockpitMetrics';

export function useCockpitData(periodType) {
    const period = useMemo(() => getCockpitPeriod(periodType), [periodType]);

    // Umsatz — Vorjahresfenster bis Periodenende in einem Rutsch
    const revenueQuery = useQuery({
        queryKey: ['cockpit', 'revenue', periodType],
        queryFn: async () => {
            const rows = await fetchUntilDateCovered(
                (limit) => base44.entities.DailyRevenue.list('-date', limit),
                period.prevFrom,
                period.to
            );
            return { type: periodType, rows };
        },
        placeholderData: (prev) => (prev?.type === periodType ? prev : undefined),
        staleTime: 5 * 60 * 1000,
    });

    // Erfasste Arbeitsstunden — ebenfalls mit Vorjahresfenster
    const timeQuery = useQuery({
        queryKey: ['cockpit', 'time-entries', periodType],
        queryFn: async () => {
            const rows = await fetchUntilDateCovered(
                (limit) => base44.entities.TimeEntry.list('-date', limit),
                period.prevFrom,
                period.to
            );
            return { type: periodType, rows };
        },
        placeholderData: (prev) => (prev?.type === periodType ? prev : undefined),
        staleTime: 5 * 60 * 1000,
    });

    // Stammdaten — zeitunabhängig
    const employeesQuery = useQuery({
        queryKey: ['cockpit', 'employees'],
        queryFn: () => base44.entities.Employee.list(),
        staleTime: 30 * 60 * 1000,
    });

    const fixedCostsQuery = useQuery({
        queryKey: ['cockpit', 'fixed-costs'],
        queryFn: () => base44.entities.RecurringExpense.list('title'),
        staleTime: 30 * 60 * 1000,
    });

    const kpis = useMemo(() => {
        const revenueRows = revenueQuery.data?.rows || [];
        const timeRows = timeQuery.data?.rows || [];
        const employees = employeesQuery.data || [];
        const expenses = fixedCostsQuery.data || [];

        const revenueRowsNow = revenueRows.filter(r => inRange(r.date, period.from, period.to));
        const revenueRowsPrev = revenueRows.filter(r => inRange(r.date, period.prevFrom, period.prevTo));
        const timeRowsNow = timeRows.filter(t => inRange(t.date, period.from, period.to));
        const timeRowsPrev = timeRows.filter(t => inRange(t.date, period.prevFrom, period.prevTo));

        const revenue = sumRevenue(revenueRowsNow);
        const prevRevenue = sumRevenue(revenueRowsPrev);
        const labor = laborCost(timeRowsNow, employees);
        const prevLabor = laborCost(timeRowsPrev, employees);

        const fixedMonthly = monthlyFixedCosts(expenses);
        const fixed = fixedCostsForPeriod(fixedMonthly, periodType);

        const contribution = revenue - labor.cost - fixed;
        // Vorjahres-Deckungsbeitrag nur, wenn Umsatz- und Personalwerte vorliegen.
        // Fixkosten sind nicht historisiert — es gilt der heutige Fixkostenstand.
        const hasPrevComponents = revenueRowsPrev.length > 0 && timeRowsPrev.length > 0;
        const prevContribution = hasPrevComponents ? prevRevenue - prevLabor.cost - fixed : null;

        return {
            revenue,
            prevRevenue,
            revenueDelta: pctDelta(revenue, prevRevenue),
            labor,
            prevLabor,
            fixed,
            fixedMonthly,
            contribution,
            prevContribution,
            contributionDelta: prevContribution != null ? pctDelta(contribution, prevContribution) : null,
            hasRevenueData: revenueRowsNow.length > 0,
            series: dailyRevenueSeries(revenueRowsNow, period.from, period.elapsedTo, periodType),
        };
    }, [period, periodType, revenueQuery.data, timeQuery.data, employeesQuery.data, fixedCostsQuery.data]);

    return {
        period,
        kpis,
        error: revenueQuery.error || timeQuery.error || employeesQuery.error || fixedCostsQuery.error,
        isLoading: revenueQuery.isLoading || timeQuery.isLoading
            || employeesQuery.isLoading || fixedCostsQuery.isLoading,
        isFetching: revenueQuery.isFetching || timeQuery.isFetching,
    };
}