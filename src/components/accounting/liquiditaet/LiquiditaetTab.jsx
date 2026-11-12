import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { STALE } from '@/lib/queryUtils';
import { buildPlan, planKpis } from '@/lib/liquidityPlan';
import LiquiditaetsKpi from './LiquiditaetsKpi';
import LiquiditaetsChart from './LiquiditaetsChart';
import LiquiditaetsSkeleton from './LiquiditaetsSkeleton';
import WochenTabelle from './WochenTabelle';
import RuecklagenKarten from './RuecklagenKarten';

const WEEK_KEY = ['liquidity-weeks'];
const LIQ_PREFIXES = ['liquidity-weeks', 'liq-'];
const NUMBER_FIELDS = [
    'revenue_plan', 'inflow_card', 'inflow_cash', 'cost_fixed', 'cost_staff', 'cost_sv', 'cost_vat',
    'reserve_vat', 'reserve_tax', 'reserve_aok', 'debt_rate', 'balance_end', 'balance_cum', 'opening_balance',
];
const ALL_FIELDS = ['year', 'week', 'week_start', 'week_end', ...NUMBER_FIELDS, 'debt_payments', 'traffic_light'];

const toPayload = (row) => Object.fromEntries(ALL_FIELDS.map((f) => [f, row[f]]));

async function fetchAll(entity, query) {
    let items = [];
    let cursor;
    for (let i = 0; i < 6; i++) {
        const page = await entity.filter(query, { sort: 'date', limit: 500, cursor });
        items = items.concat(page.items || []);
        if (!page.has_more) break;
        cursor = page.next_cursor;
    }
    return items;
}

/** Liquiditäts- und Tilgungsplan — Soll wochenweise, Ist getrennt. */
export default function LiquiditaetTab() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [expandedKey, setExpandedKey] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const now = new Date();

    const { data: storedWeeks, isLoading: loadingWeeks } = useQuery({
        queryKey: WEEK_KEY,
        queryFn: async () => {
            const page = await base44.entities.LiquidityWeek.filter({}, { sort: 'week_start', limit: 100 });
            return page.items;
        },
        staleTime: STALE.FAST,
    });

    const { data: revenues, isLoading: loadingRevenues } = useQuery({
        queryKey: ['liq-revenues'],
        queryFn: () => fetchAll(base44.entities.DailyRevenue, { date: { $gte: '2024-10-01' } }),
        staleTime: STALE.MEDIUM,
    });

    const { data: timeEntries } = useQuery({
        queryKey: ['liq-time-entries', format(now, 'yyyy-MM')],
        queryFn: () => fetchAll(base44.entities.TimeEntry, { date: { $gte: format(subMonths(now, 3), 'yyyy-MM-dd') } }),
        staleTime: STALE.MEDIUM,
    });

    const { data: employees } = useQuery({
        queryKey: ['liq-employees'],
        queryFn: () => base44.entities.Employee.list('name', 200),
        staleTime: STALE.MEDIUM,
    });

    const { data: openItems } = useQuery({
        queryKey: ['liq-open-items'],
        queryFn: () => base44.entities.OffenerPosten.list('-betrag', 300),
        staleTime: STALE.MEDIUM,
    });

    const { data: accounts } = useQuery({
        queryKey: ['liq-accounts'],
        queryFn: () => base44.entities.BankAccount.list('name', 50),
        staleTime: STALE.MEDIUM,
    });

    const { data: buckets } = useQuery({
        queryKey: ['liq-buckets'],
        queryFn: () => base44.entities.LiquidityBucket.list('name', 20),
        staleTime: STALE.MEDIUM,
    });

    const { data: actuals } = useQuery({
        queryKey: ['liq-actuals'],
        queryFn: () => base44.entities.LiquidityActual.list('-year', 500),
        staleTime: STALE.FAST,
    });

    const openingBalance = useMemo(
        () => (accounts || []).filter((a) => a.active !== false).reduce((s, a) => s + (a.current_balance || 0), 0),
        [accounts]
    );

    const computed = useMemo(
        () => buildPlan({
            revenues: revenues || [],
            timeEntries: timeEntries || [],
            employees: employees || [],
            openItems: openItems || [],
            openingBalance,
        }),
        [revenues, timeEntries, employees, openItems, openingBalance]
    );

    // Gesperrte Wochen behalten ihre gespeicherten Werte, alles andere wird fortgeschrieben.
    const rows = useMemo(() => {
        const byKey = new Map((storedWeeks || []).map((w) => [`${w.year}-${w.week}`, w]));
        return computed.map((row) => {
            const key = `${row.year}-${row.week}`;
            const stored = byKey.get(key);
            if (!stored) return { ...row, key };
            return stored.is_locked ? { ...row, ...stored, key } : { ...row, id: stored.id, notes: stored.notes, key };
        });
    }, [computed, storedWeeks]);

    const kpis = useMemo(() => planKpis(rows, openItems || [], openingBalance), [rows, openItems, openingBalance]);

    const actualByWeek = useMemo(() => {
        const income = new Set(['umsatz', 'karte', 'bar']);
        const map = {};
        for (const a of actuals || []) {
            const key = `${a.year}-${a.week}`;
            const signed = income.has(a.category) ? (a.amount || 0) : -(a.amount || 0);
            map[key] = (map[key] || 0) + signed;
        }
        return map;
    }, [actuals]);

    // ── Soll-Wochen automatisch anlegen und fortschreiben ────────────────────
    const syncRef = useRef('');
    useEffect(() => {
        if (!revenues?.length || !employees?.length || !storedWeeks) return;
        const signature = rows.map((r) => `${r.key}:${Math.round(r.balance_cum || 0)}`).join('|');
        if (syncRef.current === signature) return;
        syncRef.current = signature;

        const byKey = new Map(storedWeeks.map((w) => [`${w.year}-${w.week}`, w]));
        const toCreate = [];
        const toUpdate = [];
        for (const row of rows) {
            const stored = byKey.get(row.key);
            const payload = toPayload(row);
            if (!stored) { toCreate.push(payload); continue; }
            if (stored.is_locked) continue;
            const changed = NUMBER_FIELDS.some((f) => Math.abs((stored[f] || 0) - (payload[f] || 0)) > 0.009)
                || (stored.traffic_light || '') !== payload.traffic_light
                || JSON.stringify(stored.debt_payments || []) !== JSON.stringify(payload.debt_payments || []);
            if (changed) toUpdate.push({ id: stored.id, ...payload });
        }
        if (toCreate.length === 0 && toUpdate.length === 0) return;

        (async () => {
            if (toCreate.length) await base44.entities.LiquidityWeek.bulkCreate(toCreate);
            if (toUpdate.length) await base44.entities.LiquidityWeek.bulkUpdate(toUpdate);
            queryClient.invalidateQueries({ queryKey: WEEK_KEY });
        })().catch(() => toast({ title: 'Planung konnte nicht gespeichert werden', variant: 'destructive' }));
    }, [rows, storedWeeks, revenues, employees, queryClient, toast]);

    // ── Rücklagen-Töpfe einmalig anlegen ─────────────────────────────────────
    const bucketsRef = useRef(false);
    useEffect(() => {
        if (bucketsRef.current || !buckets) return;
        bucketsRef.current = true;
        if (buckets.length > 0) return;
        const names = ['USt', 'Einkommensteuer', 'AOK', 'BGN', 'Sonstiges'];
        base44.entities.LiquidityBucket.bulkCreate(names.map((name) => ({
            name, target_balance: 0, current_balance: 0, weekly_rate: 0, is_active: true,
        })))
            .then(() => queryClient.invalidateQueries({ queryKey: ['liq-buckets'] }))
            .catch(() => {});
    }, [buckets, queryClient]);

    const toggleLock = async (row) => {
        await base44.entities.LiquidityWeek.update(row.id, { is_locked: !row.is_locked });
        queryClient.invalidateQueries({ queryKey: WEEK_KEY });
    };

    const refresh = async () => {
        setRefreshing(true);
        await queryClient.invalidateQueries({
            predicate: (q) => LIQ_PREFIXES.some((p) => String(q.queryKey[0]).startsWith(p)),
        });
        setRefreshing(false);
    };

    const first = rows[0];
    const last = rows[rows.length - 1];
    const stand = format(new Date(), 'HH:mm');
    const loading = loadingWeeks || loadingRevenues;

    const header = (
        <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
                <p className="page-title">Liquidität</p>
                <p className="page-subtitle">
                    {first
                        ? `Soll-Plan KW ${first.week}/${first.year} – KW ${last.week}/${last.year} · Ist aus Kontoauszug und Kassenbericht`
                        : 'Soll-Plan, Rücklagen und Tilgungen'}
                </p>
            </div>
            <Button className="h-9 shrink-0 gap-1.5 rounded-xl" onClick={refresh} disabled={refreshing}>
                <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Aktualisieren
            </Button>
        </div>
    );

    if (loading) {
        return (
            <div>
                {header}
                <LiquiditaetsSkeleton />
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div>
                {header}
                <Card className="empty-state">
                    <TrendingUp className="empty-state-icon" strokeWidth={1.4} />
                    <p className="text-[13px] text-muted-foreground">Für einen Plan fehlen noch Umsätze und Zeiteinträge.</p>
                    <Button className="h-9 rounded-xl" onClick={refresh}>Plan berechnen</Button>
                </Card>
            </div>
        );
    }

    return (
        <div>
            {header}
            <div className="space-y-4">
                <LiquiditaetsKpi kpis={kpis} />

                <LiquiditaetsChart rows={rows} actualByWeek={actualByWeek} stand={stand} />

                <WochenTabelle
                    rows={rows}
                    expandedKey={expandedKey}
                    onToggle={(key) => setExpandedKey((prev) => (prev === key ? null : key))}
                    onToggleLock={toggleLock}
                />

                <RuecklagenKarten buckets={buckets} stand={stand} />
            </div>
        </div>
    );
}