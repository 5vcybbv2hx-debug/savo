/**
 * Umsatz-Historie — Mehrjahres-Auswertung auf Basis der DailyRevenue-Entity.
 *
 * Datenquellen:
 *  - Tagesabschluss (regulär, source='tagesabschluss')
 *  - Z-Abschlags-Import 2021–2026 von der NAS (source='zabschlag_import')
 *  - Manuell nachgetragene Tage (source='manual')
 *
 * Sichten:
 *  1. Jahresumsätze (Balken) mit Vollständigkeits-Markierung
 *  2. Monatsverlauf pro Jahr (Vergleichslinien, Jahre wählbar)
 *  3. Deckungsübersicht — welche Monate fehlen
 *  4. Nachtragen fehlender Tage (Datum + Umsatz + optional Bar/EC)
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchUntilDateCovered } from '@/lib/adaptiveFetch';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
    TrendingUp, CalendarPlus, AlertTriangle, CheckCircle2, Info, Loader2, X
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, LabelList
} from 'recharts';

const fmtEUR = (n) => (n ?? 0).toLocaleString('de-DE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0
});
const fmtEUR2 = (n) => (n ?? 0).toLocaleString('de-DE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2
});
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTHS_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
    'August', 'September', 'Oktober', 'November', 'Dezember'];

// Jahre mit weniger als 12 erfassten Monaten sind unvollständig (gekennzeichnet)
const isYearComplete = (days) => days >= 350;

export default function RevenueHistory() {
    const queryClient = useQueryClient();
    const [chartYears, setChartYears] = useState(null); // Auswahl Monatsvergleich
    const [showMissingForm, setShowMissingForm] = useState(false);
    const [form, setForm] = useState({ date: '', revenue: '', revenue_cash: '', revenue_ec: '' });
    const [formError, setFormError] = useState(null);

    // Komplette Historie laden (2021 bis heute), adaptiv paginiert
    const { data: records = [], isLoading, error } = useQuery({
        queryKey: ['revenue-history-full'],
        queryFn: async () => {
            const today = new Date().toISOString().slice(0, 10);
            return await fetchUntilDateCovered(
                (limit) => base44.entities.DailyRevenue.list('-date', limit),
                '2021-01-01',
                today
            );
        },
        staleTime: 5 * 60 * 1000,
    });

    const mutation = useMutation({
        mutationFn: async (data) => {
            return await base44.entities.DailyRevenue.create({
                date: data.date,
                revenue: parseFloat(data.revenue),
                revenue_cash: data.revenue_cash !== '' ? parseFloat(data.revenue_cash) : null,
                revenue_ec: data.revenue_ec !== '' ? parseFloat(data.revenue_ec) : null,
                source: 'manual',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['revenue-history-full'] });
            queryClient.invalidateQueries({ queryKey: ['daily-revenues'] });
            setShowMissingForm(false);
            setForm({ date: '', revenue: '', revenue_cash: '', revenue_ec: '' });
            setFormError(null);
        },
        onError: (e) => setFormError(e.message || 'Speichern fehlgeschlagen'),
    });

    // ── Ableitungen ──────────────────────────────────────────────────────
    const derived = useMemo(() => {
        const valid = records.filter(r => r.date);

        // Jahr → Monat → Einträge
        const yearMap = new Map();
        for (const r of valid) {
            const d = r.date.slice(0, 10);
            const y = d.slice(0, 4);
            const m = parseInt(d.slice(5, 7)) - 1;
            if (!yearMap.has(y)) yearMap.set(y, Array.from({ length: 12 }, () => []));
            yearMap.get(y)[m].push(r);
        }

        const years = [...yearMap.keys()].sort();

        // Jahresdaten
        const yearly = years.map(y => {
            const months = yearMap.get(y);
            const days = months.reduce((s, m) => s + m.length, 0);
            const total = months.reduce((s, m) => s + m.reduce((s2, r) => s2 + (r.revenue || 0), 0), 0);
            const coveredMonths = months.filter(m => m.length > 0).length;
            return { year: y, total, days, coveredMonths, complete: isYearComplete(days) };
        });

        // Monatsverlauf pro Jahr (12 Summen)
        const monthly = {};
        for (const y of years) {
            monthly[y] = yearMap.get(y).map(m =>
                m.length ? m.reduce((s, r) => s + (r.revenue || 0), 0) : null
            );
        }

        // Fehlende Monate: nur innerhalb der "aktiven Spanne" des jeweiligen Jahres
        const missingMonths = [];
        for (const y of years) {
            const months = yearMap.get(y);
            const firstIdx = months.findIndex(m => m.length > 0);
            const lastIdx = 11 - [...months].reverse().findIndex(m => m.length > 0);
            const now = new Date();
            const isCurrentYear = String(now.getFullYear()) === y;
            const lastPossible = isCurrentYear ? now.getMonth() : 11;
            for (let m = firstIdx; m <= Math.min(lastIdx, lastPossible); m++) {
                if (months[m].length === 0) {
                    missingMonths.push({ year: y, month: m, label: `${MONTHS_FULL[m]} ${y}` });
                }
            }
        }

        // Wochentagsprofil (alle Jahre)
        const dow = [0, 0, 0, 0, 0, 0, 0];
        const dowCount = [0, 0, 0, 0, 0, 0, 0];
        for (const r of valid) {
            const d = new Date(r.date.slice(0, 10) + 'T12:00:00');
            if (isNaN(d)) continue;
            dow[d.getDay()] += r.revenue || 0;
            dowCount[d.getDay()]++;
        }
        const dowAvg = dow.map((s, i) => dowCount[i] ? Math.round(s / dowCount[i]) : 0);

        // Rekordtag
        let best = null;
        for (const r of valid) {
            if (!best || (r.revenue || 0) > (best.revenue || 0)) best = r;
        }

        const totalAll = valid.reduce((s, r) => s + (r.revenue || 0), 0);
        const barAll = valid.reduce((s, r) => s + (r.revenue_cash || 0), 0);
        const ecAll = valid.reduce((s, r) => s + (r.revenue_ec || 0), 0);

        return { years, yearly, monthly, missingMonths, dowAvg, best, totalAll, barAll, ecAll, count: valid.length };
    }, [records]);

    // Default: die 3 neuesten Jahre im Monatsvergleich
    const activeYears = useMemo(() => {
        if (chartYears) return chartYears;
        return derived.years.slice(-3);
    }, [chartYears, derived.years]);

    const lineData = useMemo(() => {
        return MONTHS.map((label, i) => {
            const row = { month: label };
            for (const y of derived.years) {
                row[y] = derived.monthly[y][i];
            }
            return row;
        });
    }, [derived]);

    const toggleYear = (y) => {
        const next = new Set(activeYears);
        if (next.has(y)) { if (next.size > 1) next.delete(y); }
        else next.add(y);
        setChartYears([...next].sort());
    };

    const submitManual = (e) => {
        e.preventDefault();
        if (!form.date || form.revenue === '') {
            setFormError('Datum und Umsatz sind erforderlich');
            return;
        }
        const value = parseFloat(form.revenue);
        if (isNaN(value) || value < 0) {
            setFormError('Umsatz muss eine Zahl ≥ 0 sein');
            return;
        }
        mutation.mutate(form);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade Umsatz-Historie …
            </div>
        );
    }
    if (error) {
        return (
            <div className="p-6 max-w-md mx-auto mt-10">
                <Card className="p-5 border-destructive/40">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        <p className="text-sm font-semibold">Historie konnte nicht geladen werden</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{String(error.message || error)}</p>
                </Card>
            </div>
        );
    }

    const barShare = derived.totalAll > 0 ? (derived.barAll / derived.totalAll) * 100 : 0;

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                        Umsatz-Historie
                    </h1>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                        {derived.count} erfasste Tage seit {derived.years[0] || '—'} · Gesamtumsatz {fmtEUR(derived.totalAll)}
                    </p>
                </div>
                <Button
                    size="sm"
                    onClick={() => setShowMissingForm(v => !v)}
                    className="shrink-0"
                >
                    <CalendarPlus className="w-4 h-4 mr-1.5" />
                    Tag nachtragen
                </Button>
            </div>

            {/* ── Nachtragen-Formular ── */}
            {showMissingForm && (
                <Card className="p-4 border-primary/30">
                    <form onSubmit={submitManual} className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold flex items-center gap-2">
                                <CalendarPlus className="w-4 h-4 text-primary" />
                                Fehlenden Tag nachtragen
                            </p>
                            <button type="button" onClick={() => setShowMissingForm(false)}
                                className="text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Für Tage, die im Tagesabschluss nicht erfasst sind (z. B. aus alten Z-Abschlägen).
                            Bereits erfasste Tage werden nicht überschrieben.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                            <label className="space-y-1">
                                <span className="text-[11px] font-medium text-muted-foreground">Datum *</span>
                                <Input type="date" value={form.date} required
                                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-[11px] font-medium text-muted-foreground">Umsatz gesamt (€) *</span>
                                <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="z. B. 1234,50"
                                    value={form.revenue} required
                                    onChange={e => setForm(f => ({ ...f, revenue: e.target.value }))} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-[11px] font-medium text-muted-foreground">davon Bar (€)</span>
                                <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="optional"
                                    value={form.revenue_cash}
                                    onChange={e => setForm(f => ({ ...f, revenue_cash: e.target.value }))} />
                            </label>
                            <label className="space-y-1">
                                <span className="text-[11px] font-medium text-muted-foreground">davon EC (€)</span>
                                <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="optional"
                                    value={form.revenue_ec}
                                    onChange={e => setForm(f => ({ ...f, revenue_ec: e.target.value }))} />
                            </label>
                        </div>
                        {formError && (
                            <p className="text-xs text-destructive flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />{formError}
                            </p>
                        )}
                        <div className="flex justify-end">
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                                Tag speichern
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* ── KPI-Zeile ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <Card className="p-3.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Bestes Jahr</p>
                    <p className="text-lg font-bold text-foreground mt-1">
                        {derived.yearly.length ? fmtEUR(Math.max(...derived.yearly.map(y => y.total))) : '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {derived.yearly.length ? derived.yearly.reduce((a, b) => a.total > b.total ? a : b).year : ''}
                    </p>
                </Card>
                <Card className="p-3.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Rekordtag</p>
                    <p className="text-lg font-bold text-foreground mt-1">
                        {derived.best ? fmtEUR(derived.best.revenue) : '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {derived.best ? derived.best.date.slice(0, 10).split('-').reverse().join('.') : ''}
                    </p>
                </Card>
                <Card className="p-3.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ø pro Tag</p>
                    <p className="text-lg font-bold text-foreground mt-1">
                        {derived.count ? fmtEUR(derived.totalAll / derived.count) : '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">über alle erfassten Tage</p>
                </Card>
                <Card className="p-3.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Bar / EC</p>
                    <p className="text-lg font-bold text-foreground mt-1">
                        {Math.round(barShare)}% / {Math.round(100 - barShare)}%
                    </p>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                        <div className="h-full bg-primary" style={{ width: `${barShare}%` }} />
                    </div>
                </Card>
            </div>

            {/* ── Jahresumsätze ── */}
            <Card className="p-4">
                <p className="text-sm font-semibold mb-3">Jahresumsätze</p>
                <div className="h-56 -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={derived.yearly} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false}
                                axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k €`} width={48} />
                            <Tooltip formatter={(v) => fmtEUR2(v)}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={56}>
                                {derived.yearly.map((y) => (
                                    <Cell key={y.year} fill="hsl(var(--primary))"
                                        opacity={y.complete ? 1 : 0.45} />
                                ))}
                                <LabelList dataKey="total" position="top"
                                    formatter={(v) => fmtEUR(v)}
                                    style={{ fontSize: 10.5, fill: 'hsl(var(--muted-foreground))' }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-primary inline-block" /> vollständig erfasst
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-primary/45 inline-block" /> Teiljahr (Lücken)
                    </span>
                </div>
            </Card>

            {/* ── Monatsverlauf ── */}
            <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <p className="text-sm font-semibold">Monatsverlauf im Jahresvergleich</p>
                    <div className="flex flex-wrap gap-1.5">
                        {derived.years.map((y, i) => {
                            const active = activeYears.includes(y);
                            return (
                                <button key={y}
                                    onClick={() => toggleYear(y)}
                                    className={cn(
                                        'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                                        active
                                            ? 'border-primary text-primary-foreground bg-primary'
                                            : 'border-border text-muted-foreground hover:border-primary/40'
                                    )}>
                                    {y}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="h-64 -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false}
                                axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k €`} width={48} />
                            <Tooltip formatter={(v) => v == null ? 'keine Daten' : fmtEUR2(v)}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                            {activeYears.map((y, i) => (
                                <Line key={y} type="monotone" dataKey={y} name={y}
                                    stroke={`hsl(var(--primary) / ${0.9 - 0.25 * (activeYears.length - 1 - i)})`}
                                    strokeWidth={i === activeYears.length - 1 ? 2.5 : 1.75}
                                    dot={false} connectNulls={false} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* ── Fehlende Monate / Datenqualität ── */}
            <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                    <p className="text-sm font-semibold">Datenlücken</p>
                    {derived.missingMonths.length === 0 ? (
                        <span className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> keine Lücken
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {derived.missingMonths.length} Monat{derived.missingMonths.length > 1 ? 'e' : ''} ohne Daten
                        </span>
                    )}
                </div>
                {derived.missingMonths.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        Alle Monate seit dem ersten erfassten Tag sind belegt. Neue Tage kommen über den Tagesabschluss dazu.
                    </p>
                ) : (
                    <>
                        <p className="text-xs text-muted-foreground mb-2.5">
                            Diese Monate liegen zwischen erfassten Zeiträumen, haben aber keine Umsatzdaten.
                            Falls du noch Z-Abschläge dazu hast, kannst du die Tage über „Tag nachtragen" erfassen
                            oder sie mir zuschicken — ich importiere sie.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {derived.missingMonths.map(m => (
                                <span key={`${m.year}-${m.month}`}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400">
                                    {m.label}
                                </span>
                            ))}
                        </div>
                    </>
                )}
                <div className="flex items-start gap-1.5 mt-3 text-[11px] text-muted-foreground">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>
                        Balken mit reduzierter Deckkraft kennzeichnen Teiljahre. Der Jahresvergleich zeigt nur
                        vollständig erfasste Jahre als verlässlich.
                    </span>
                </div>
            </Card>
        </div>
    );
}