import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Search, SlidersHorizontal, ChevronDown, ChevronRight, FileText, Users, Gift, TrendingDown, X, Trash2 } from 'lucide-react';
import DayDetailModal from './DayDetailModal';
import { cn } from '@/lib/utils';

const isDailyPaid = (emp) =>
    emp?.role === 'Aushilfe' || (emp?.hourly_rate > 0 && emp?.contract_type === 'Minijob');

// ── Build enriched day data ────────────────────────────────────────────────
function buildDayData(rev, timeEntries, tipDistributions, employeeMap) {
    const dateStr = rev.date;
    const getOpDate = (te) => {
        const h = parseInt(te.start_time?.split(':')[0] || '12');
        if (h < 9) {
            const p = new Date(te.date); p.setDate(p.getDate() - 1);
            return p.toISOString().split('T')[0];
        }
        return te.date;
    };

    const dayEntries = timeEntries.filter(te => getOpDate(te) === dateStr && te.status === 'genehmigt');
    const staffCount = new Set(dayEntries.map(te => te.employee_id)).size;
    const laborCost = dayEntries.reduce((sum, te) => {
        const emp = employeeMap.get(te.employee_id);
        if (!isDailyPaid(emp)) return sum;
        const rate = emp?.hourly_rate || te.hourly_rate || 0;
        // Pause wird bei SAVO mitbezahlt → bezahlte Stunden inkl. Pause
        const paidHours = (te.total_hours || 0) + (te.break_minutes || 0) / 60;
        return sum + paidHours * rate;
    }, 0);
    const revenue = rev.revenue || 0;
    const ratio = revenue > 0 ? (laborCost / revenue) * 100 : null;
    const tips = tipDistributions.find(td => td.date === dateStr);
    const hasWarning = ratio !== null && ratio > 30;

    return {
        date: dateStr,
        revenue,
        revenue_cash: rev.revenue_cash,
        revenue_ec: rev.revenue_ec,
        vat: rev.vat,
        own_consumption: rev.own_consumption,
        pdf_url: rev.pdf_url,
        notes: rev.notes,
        laborCost,
        staffCount,
        ratio,
        hasWarning,
        hasPDF: !!rev.pdf_url,
        tips: tips?.total_tips || 0,
        tipPercentage: tips?.tip_percentage || 0,
        tipDistribution: tips || null,
        _searchText: [
            dateStr,
            format(parseISO(dateStr), 'dd. MMMM yyyy EEEE', { locale: de }),
            rev.notes || '',
        ].join(' ').toLowerCase(),
    };
}

// ── Month group header ─────────────────────────────────────────────────────
function MonthHeader({ label, count, open, onToggle }) {
    return (
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-1 py-2 group"
        >
            <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">{count}</span>
            </div>
            {open
                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
    );
}

// ── Day Card (mobile-first) ────────────────────────────────────────────────
function DayCard({ day, isSelected, onClick, onDelete }) {
    const net = day.revenue > 0 ? day.revenue - day.laborCost : null;
    return (
        <Card
            onClick={onClick}
            className={cn(
                'cursor-pointer border transition-all active:scale-[0.99]',
                isSelected ? 'border-amber-500/60 bg-amber-500/5' : 'border-border bg-card hover:border-border/80',
            )}
        >
            <CardContent className="px-3 py-3 space-y-2">
                {/* Row 1: date + badges */}
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-sm font-semibold text-foreground">
                            {format(parseISO(day.date), 'EEE, dd. MMM', { locale: de })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {format(parseISO(day.date), 'yyyy', { locale: de })}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end">
                        {day.hasPDF && (
                            <Badge className="bg-blue-500/15 text-blue-400 text-[10px] px-1.5 py-0.5 h-auto">
                                <FileText className="w-3 h-3 mr-0.5" />PDF
                            </Badge>
                        )}
                        {day.hasWarning && (
                            <Badge className="bg-red-500/15 text-red-400 text-[10px] px-1.5 py-0.5 h-auto">
                                ⚠ {day.ratio?.toFixed(0)}%
                            </Badge>
                        )}
                        {day.tips > 0 && (
                            <Badge className="bg-purple-500/15 text-purple-400 text-[10px] px-1.5 py-0.5 h-auto">
                                <Gift className="w-3 h-3 mr-0.5" />{day.tips.toFixed(0)} €
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Row 2: KPIs */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Umsatz</p>
                        <p className="text-sm font-bold text-green-400">
                            {day.revenue > 0 ? `${day.revenue.toFixed(0)} €` : '–'}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Personal</p>
                        <p className={cn('text-sm font-bold', day.hasWarning ? 'text-red-400' : 'text-amber-400')}>
                            {day.laborCost > 0 ? `${day.laborCost.toFixed(0)} €` : '–'}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Ergebnis</p>
                        <p className={cn('text-sm font-bold', net !== null ? (net >= 0 ? 'text-green-400' : 'text-red-400') : 'text-muted-foreground')}>
                            {net !== null ? `${net.toFixed(0)} €` : '–'}
                        </p>
                    </div>
                </div>

                {/* Notes preview */}
                {day.notes && (
                    <p className="text-xs text-muted-foreground truncate border-t border-border/40 pt-1.5">
                        {day.notes}
                    </p>
                )}

                {/* Delete button */}
                {onDelete && (
                    <div className="border-t border-border/40 pt-1.5 flex justify-end">
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(day); }}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors px-1 py-0.5 rounded"
                        >
                            <Trash2 className="w-3 h-3" />
                            Löschen
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ── Filter chip ────────────────────────────────────────────────────────────
function Chip({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-all min-h-[36px]',
                active
                    ? 'bg-amber-600 border-amber-600 text-white'
                    : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground',
            )}
        >
            {label}
        </button>
    );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function DailyRevenueList({ revenues, timeEntries, tipDistributions, employees = [], onSelectDate, selectedDate, onDelete }) {
    const [detailRevenue, setDetailRevenue] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filter, setFilter] = useState('all'); // all | warnings | pdf | tips | no-pdf
    const [collapsedMonths, setCollapsedMonths] = useState(new Set());

    const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

    // Build all day data (all revenues, not just last 30)
    const allDays = useMemo(() =>
        revenues.map(rev => buildDayData(rev, timeEntries, tipDistributions, employeeMap))
    , [revenues, timeEntries, tipDistributions, employeeMap]);

    // Apply search + filter
    const filtered = useMemo(() => {
        let result = allDays;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(d => d._searchText.includes(q));
        }
        if (filter === 'warnings') result = result.filter(d => d.hasWarning);
        if (filter === 'pdf') result = result.filter(d => d.hasPDF);
        if (filter === 'tips') result = result.filter(d => d.tips > 0);
        if (filter === 'no-pdf') result = result.filter(d => !d.hasPDF && d.revenue > 0);
        return result;
    }, [allDays, search, filter]);

    // Group by month key "yyyy-MM"
    const grouped = useMemo(() => {
        const map = new Map();
        for (const day of filtered) {
            const key = day.date.slice(0, 7); // "yyyy-MM"
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(day);
        }
        // Sort groups: newest first; days within each group: newest first
        return Array.from(map.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([key, days]) => ({
                key,
                label: format(parseISO(key + '-01'), 'MMMM yyyy', { locale: de }),
                days: days.sort((a, b) => b.date.localeCompare(a.date)),
            }));
    }, [filtered]);

    const toggleMonth = (key) => {
        setCollapsedMonths(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    if (revenues.length === 0) return null;

    const activeFilterCount = (search ? 1 : 0) + (filter !== 'all' ? 1 : 0);

    return (
        <>
            {/* ── Section header + search ────────────────────────────────── */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Verlauf</h2>
                    <span className="text-xs text-muted-foreground">{revenues.length} Einträge</span>
                </div>

                {/* Search bar */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Datum, Notiz suchen…"
                            className="w-full h-11 pl-9 pr-9 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setShowFilters(v => !v)}
                        className={cn(
                            'h-11 w-11 flex items-center justify-center rounded-xl border transition-colors',
                            activeFilterCount > 0
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'bg-card border-border text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                    </button>
                </div>

                {/* Filter chips — collapsible */}
                {showFilters && (
                    <div className="flex flex-wrap gap-2 pb-1">
                        <Chip label="Alle" active={filter === 'all'} onClick={() => setFilter('all')} />
                        <Chip label="⚠ Warnungen" active={filter === 'warnings'} onClick={() => setFilter('warnings')} />
                        <Chip label="PDF vorhanden" active={filter === 'pdf'} onClick={() => setFilter('pdf')} />
                        <Chip label="Mit Trinkgeld" active={filter === 'tips'} onClick={() => setFilter('tips')} />
                        <Chip label="Kein PDF" active={filter === 'no-pdf'} onClick={() => setFilter('no-pdf')} />
                    </div>
                )}

                {/* No results */}
                {filtered.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        Keine Einträge gefunden.
                    </div>
                )}

                {/* Month groups */}
                <div className="space-y-4">
                    {grouped.map(({ key, label, days }, groupIdx) => {
                        const isOpen = !collapsedMonths.has(key);
                        return (
                            <div key={key}>
                                <MonthHeader
                                    label={label}
                                    count={days.length}
                                    open={isOpen}
                                    onToggle={() => toggleMonth(key)}
                                />
                                {isOpen && (
                                    <div className="space-y-2 mt-1">
                                        {days.map(day => (
                                            <DayCard
                                                key={day.date}
                                                day={day}
                                                isSelected={day.date === selectedDate}
                                                onClick={() => {
                                                    setDetailRevenue(day);
                                                    onSelectDate?.(day.date);
                                                }}
                                                onDelete={onDelete ? (d) => setConfirmDelete(d) : null}
                                            />
                                        ))}
                                    </div>
                                )}
                                {/* Divider between groups */}
                                {groupIdx < grouped.length - 1 && (
                                    <div className="border-b border-border/40 mt-3" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <DayDetailModal
                open={!!detailRevenue}
                onOpenChange={(isOpen) => !isOpen && setDetailRevenue(null)}
                revenue={detailRevenue}
                tipDistribution={detailRevenue?.tipDistribution}
                laborCost={detailRevenue?.laborCost || 0}
                staffCount={detailRevenue?.staffCount || 0}
            />

            {/* Delete confirmation */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">Eintrag löschen?</p>
                                <p className="text-sm text-muted-foreground">
                                    {format(parseISO(confirmDelete.date), 'EEE, dd. MMMM yyyy', { locale: de })}
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Dieser Tagesabschluss wird dauerhaft gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                            >
                                Löschen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}