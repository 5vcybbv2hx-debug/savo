import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getVacationDaysForRange } from '@/lib/vacationBalance';

const emptyPeriod = () => ({ start_date: '', end_date: '', days_count: null, manual: false });

const fmt = (value) => {
    const v = Math.round((Number(value) || 0) * 10) / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
};

export default function VacationRequestDialog({
    open,
    onOpenChange,
    balance,
    openingHours,
    onSubmit,
    isSubmitting = false,
    multiPeriod = true,
}) {
    const [type, setType] = useState('Urlaub');
    const [notes, setNotes] = useState('');
    const [periods, setPeriods] = useState([emptyPeriod()]);
    const [confirmed, setConfirmed] = useState(false);

    useEffect(() => {
        if (!open) return;
        setType('Urlaub');
        setNotes('');
        setPeriods([emptyPeriod()]);
        setConfirmed(false);
    }, [open]);

    const updatePeriod = (index, patch) => {
        setPeriods((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    };

    // Datumswechsel: Urlaubstage automatisch aus den Öffnungstagen füllen
    const setDates = (index, patch) => {
        setPeriods((prev) => prev.map((p, i) => {
            if (i !== index) return p;
            const next = { ...p, ...patch };
            if (next.start_date && next.end_date && !next.manual) {
                const days = getVacationDaysForRange(next.start_date, next.end_date, openingHours);
                next.days_count = days > 0 ? days : null;
            }
            return next;
        }));
    };

    const setDays = (index, raw) => {
        const parsed = raw === '' ? null : Number(String(raw).replace(',', '.'));
        updatePeriod(index, {
            days_count: parsed === null || Number.isNaN(parsed) ? null : parsed,
            manual: true,
        });
    };

    const validPeriods = periods.filter((p) => p.start_date && p.end_date);
    const requestedDays = useMemo(
        () => Math.round(validPeriods.reduce((sum, p) => sum + (Number(p.days_count) || 0), 0) * 10) / 10,
        [periods],
    );

    const available = balance ? Number(balance.available) || 0 : null;
    const overLimit = available !== null && requestedDays > available;
    const remainingAfter = available !== null ? Math.round((available - requestedDays) * 10) / 10 : null;
    // Übertrag wird zuerst verbraucht, danach der Jahresanspruch
    const carryoverLeft = balance ? Number(balance.carryover_remaining) || 0 : 0;
    const fromCarryover = Math.round(Math.min(requestedDays, carryoverLeft) * 10) / 10;
    const fromEntitlement = Math.round(Math.max(0, requestedDays - carryoverLeft) * 10) / 10;
    const blocked = validPeriods.length === 0 || (overLimit && !confirmed) || isSubmitting;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (blocked) return;
        await onSubmit({
            type,
            notes,
            periods: validPeriods.map((p) => ({
                start_date: p.start_date,
                end_date: p.end_date,
                days_count: Number(p.days_count) || 0,
            })),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Urlaub beantragen</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div>
                        <Label className="mb-1.5 block">Art</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger className="bg-card border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Urlaub">Urlaub</SelectItem>
                                <SelectItem value="Krankheit">Krankheit</SelectItem>
                                <SelectItem value="Sonderurlaub">Sonderurlaub</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Zeitraum</Label>
                            {multiPeriod && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPeriods((prev) => [...prev, emptyPeriod()])}
                                    className="text-xs h-7"
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Hinzufügen
                                </Button>
                            )}
                        </div>

                        {periods.map((period, index) => {
                            const periodDays = period.start_date && period.end_date && !period.manual
                                ? getVacationDaysForRange(period.start_date, period.end_date, openingHours)
                                : null;
                            return (
                                <div key={index} className="p-3 border border-border rounded-lg space-y-2 bg-background/50">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Zeitraum {index + 1}
                                        </span>
                                        {multiPeriod && periods.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setPeriods((prev) => prev.filter((_, i) => i !== index))}
                                                className="text-status-danger hover:text-status-danger/25"
                                                aria-label="Zeitraum entfernen"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Von *</Label>
                                            <Input
                                                type="date"
                                                value={period.start_date}
                                                onChange={(e) => setDates(index, { start_date: e.target.value })}
                                                required
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Bis *</Label>
                                            <Input
                                                type="date"
                                                value={period.end_date}
                                                onChange={(e) => setDates(index, { end_date: e.target.value })}
                                                required
                                                className="mt-1"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <Label className="text-xs text-muted-foreground">Urlaubstage</Label>
                                            <Input
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                value={period.days_count ?? ''}
                                                onChange={(e) => setDays(index, e.target.value)}
                                                placeholder="0"
                                                className="mt-1"
                                            />
                                        </div>
                                        <div className="pb-1 text-xs text-muted-foreground">
                                            {periodDays !== null
                                                ? `${periodDays} Öffnungstag${periodDays === 1 ? '' : 'e'}`
                                                : period.manual ? 'manuell' : 'Datum wählen'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {validPeriods.length > 0 && (
                        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-1">
                            <div className="flex items-baseline justify-between">
                                <span className="text-xs text-muted-foreground">Urlaubstage gesamt</span>
                                <span className="text-sm font-semibold text-primary tabular-nums">
                                    {fmt(requestedDays)} {requestedDays === 1 ? 'Tag' : 'Tage'}
                                </span>
                            </div>
                            {remainingAfter !== null && (
                                <div className="flex items-baseline justify-between">
                                    <span className="text-xs text-muted-foreground">Rest danach</span>
                                    <span className={`text-sm font-semibold tabular-nums ${remainingAfter < 0 ? 'text-status-danger' : 'text-foreground'}`}>
                                        {fmt(remainingAfter)} Tage
                                    </span>
                                </div>
                            )}
                            {requestedDays > 0 && carryoverLeft > 0 && (
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="text-xs text-muted-foreground">Verbrauch</span>
                                    <span className="text-xs text-foreground tabular-nums text-right">
                                        {fmt(fromCarryover)} Tage Übertrag + {fmt(fromEntitlement)} Tage Anspruch
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {overLimit && (
                        <div className="rounded-lg border border-status-warn/40 bg-status-warn/10 p-3 space-y-2">
                            <div className="flex items-start gap-2 text-xs text-status-warn/25">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>
                                    Resturlaub reicht nicht: {fmt(requestedDays)} Tage beantragt,
                                    {' '}{fmt(available)} verfügbar
                                </span>
                            </div>
                            <label className="flex items-start gap-2 cursor-pointer">
                                <Checkbox
                                    checked={confirmed}
                                    onCheckedChange={(v) => setConfirmed(v === true)}
                                    className="mt-0.5"
                                />
                                <span className="text-xs text-foreground">
                                    Trotzdem beantragen (bewusst über dem Resturlaub)
                                </span>
                            </label>
                        </div>
                    )}

                    <div>
                        <Label className="mb-1.5 block">Notizen</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional: Grund oder Hinweise..."
                            rows={2}
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                            Abbrechen
                        </Button>
                        <Button type="submit" disabled={blocked} className="flex-1 bg-primary hover:bg-primary/90">
                            {validPeriods.length > 1 ? `${validPeriods.length} Anträge einreichen` : 'Beantragen'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}