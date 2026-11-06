import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { format, eachDayOfInterval, parseISO, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { Palmtree, Loader2, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const REASONS = ['Betriebsferien', 'Renovierung', 'Umbau', 'Sonstiges'];

const CLOSED_TYPES = ['geschlossen', 'geschlossen_mit_reinigung', 'betriebsferien'];

/**
 * Schließt einen Zeitraum im Betriebskalender (Betriebsferien, Renovierung …).
 * Jeder Tag im Zeitraum wird als day_type "betriebsferien" + is_closed gespeichert;
 * vorhandene Tage im Zeitraum werden überschrieben, andere Tage bleiben unberührt.
 */
export default function ClosePeriodDialog({ open, onOpenChange, existingDays = [], onSaved }) {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const [from, setFrom] = useState(todayStr);
    const [to, setTo] = useState(format(addDays(new Date(), 6), 'yyyy-MM-dd'));
    const [reason, setReason] = useState('Betriebsferien');
    const [customTitle, setCustomTitle] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    const days = useMemo(() => {
        if (!from || !to || to < from) return [];
        return eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
    }, [from, to]);

    const alreadyClosed = useMemo(() => {
        return days.filter(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const entry = existingDays.find(d => d.date === dateStr);
            return entry && (entry.is_closed === true || CLOSED_TYPES.includes(entry.day_type));
        }).length;
    }, [days, existingDays]);

    const title = customTitle.trim() || reason;

    const handleSave = async () => {
        if (days.length === 0) {
            toast.error('Bitte Von- und Bis-Datum prüfen');
            return;
        }
        setSaving(true);
        try {
            for (const day of days) {
                const dateStr = format(day, 'yyyy-MM-dd');
                const payload = {
                    day_type: 'betriebsferien',
                    is_closed: true,
                    is_special_opening: false,
                    opening_time_override: '',
                    closing_time_override: '',
                    title,
                    description: description.trim() || `${reason} – geschlossen`,
                };
                const existing = existingDays.find(d => d.date === dateStr);
                if (existing) {
                    await base44.entities.BusinessCalendarDay.update(existing.id, payload);
                } else {
                    await base44.entities.BusinessCalendarDay.create({ date: dateStr, ...payload });
                }
            }
            onSaved?.();
            setSaving(false);
            onOpenChange(false);
            setCustomTitle('');
            setDescription('');
            toast.success(`${days.length} ${days.length === 1 ? 'Tag' : 'Tage'} geschlossen · ${title}`);
        } catch (e) {
            setSaving(false);
            toast.error('Fehler beim Speichern des Zeitraums');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Palmtree className="w-4 h-4 text-primary" />
                        Zeitraum schließen
                    </DialogTitle>
                    <DialogDescription>
                        Legt für jeden Tag im Zeitraum Betriebsferien an bzw. überschreibt vorhandene Tage.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Von</label>
                            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground text-sm" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Bis</label>
                            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground text-sm" />
                        </div>
                    </div>

                    <div>
                        <p className="text-[12px] font-medium text-muted-foreground mb-2">Grund</p>
                        <div className="grid grid-cols-2 gap-1.5">
                            {REASONS.map(r => (
                                <button key={r} onClick={() => setReason(r)}
                                    className={cn(
                                        'px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left min-h-[44px]',
                                        reason === r
                                            ? 'bg-primary text-white shadow-md'
                                            : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60'
                                    )}>
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-[12px] font-medium text-muted-foreground mb-1.5">
                            Eigener Titel <span className="font-normal normal-case">(optional)</span>
                        </p>
                        <input value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                            placeholder={reason}
                            className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground text-sm placeholder:text-muted-foreground" />
                    </div>

                    <div>
                        <p className="text-[12px] font-medium text-muted-foreground mb-1.5">
                            Beschreibung <span className="font-normal normal-case">(optional)</span>
                        </p>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                            placeholder={`${title} – geschlossen`}
                            className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground text-sm placeholder:text-muted-foreground resize-none" />
                    </div>

                    {/* Vorschau */}
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/10 border border-primary/25">
                        <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="text-sm text-foreground">
                            {days.length === 0 ? (
                                <p className="text-destructive">Bitte gültigen Zeitraum wählen.</p>
                            ) : (
                                <>
                                    <p className="font-semibold">
                                        {days.length} {days.length === 1 ? 'Tag' : 'Tage'} werden geschlossen, davon {alreadyClosed} bereits geschlossen
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {format(days[0], 'dd.MM.yyyy', { locale: de })} – {format(days[days.length - 1], 'dd.MM.yyyy', { locale: de })} · Titel „{title}“
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    <Button onClick={handleSave} disabled={saving || days.length === 0}
                        className="w-full bg-primary hover:bg-primary text-white min-h-[48px] font-semibold">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Palmtree className="w-4 h-4 mr-2" />}
                        {saving ? 'Speichern…' : `${days.length} ${days.length === 1 ? 'Tag' : 'Tage'} schließen`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}