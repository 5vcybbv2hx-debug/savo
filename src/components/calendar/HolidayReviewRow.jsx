/**
 * HolidayReviewRow — ein kommender Feiertag in der Prüfliste.
 * Drei Zustände als Segmented Control (geschlossen / offen wie üblich /
 * offen mit Sonderzeiten) plus editierbarer Titel, Beschreibung und Zeiten.
 */
import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Lock, Sun, Clock, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MODES = [
    { id: 'closed',  label: 'geschlossen',            icon: Lock },
    { id: 'regular', label: 'offen wie üblich',       icon: Sun },
    { id: 'special', label: 'offen mit Sonderzeiten', icon: Clock },
];

function modeOf(day) {
    if (day.is_closed === true) return 'closed';
    if (day.is_special_opening === true || day.opening_time_override) return 'special';
    return 'regular';
}

export default function HolidayReviewRow({ day, canEdit }) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        title: day.title || '',
        description: day.description || '',
        opening_time_override: day.opening_time_override || '',
        closing_time_override: day.closing_time_override || '',
    });

    useEffect(() => {
        setForm({
            title: day.title || '',
            description: day.description || '',
            opening_time_override: day.opening_time_override || '',
            closing_time_override: day.closing_time_override || '',
        });
    }, [day.id, day.title, day.description, day.opening_time_override, day.closing_time_override]);

    const mode = modeOf(day);
    const date = parseISO(day.date);

    const save = (patch, message = 'Gespeichert') => {
        if (!canEdit) return;
        setSaving(true);
        base44.entities.BusinessCalendarDay.update(day.id, patch)
            .then(() => {
                queryClient.invalidateQueries({ queryKey: ['business-calendar'] });
                toast.success(message);
            })
            .catch(() => toast.error('Speichern fehlgeschlagen'))
            .finally(() => setSaving(false));
    };

    const handleMode = (nextMode) => {
        if (nextMode === mode) return;
        if (nextMode === 'closed') {
            save({ is_closed: true, is_special_opening: false }, 'Feiertag als geschlossen gespeichert');
        } else if (nextMode === 'regular') {
            save({
                is_closed: false,
                is_special_opening: false,
                opening_time_override: null,
                closing_time_override: null,
            }, 'Feiertag geöffnet wie üblich');
        } else {
            save({
                is_closed: false,
                is_special_opening: true,
                opening_time_override: day.opening_time_override || '18:00',
                closing_time_override: day.closing_time_override || '02:00',
            }, 'Sonderzeiten aktiv');
        }
    };

    const handleSaveDetails = () => {
        const patch = {
            title: form.title.trim(),
            description: form.description.trim(),
        };
        if (mode === 'special') {
            patch.opening_time_override = form.opening_time_override || null;
            patch.closing_time_override = form.closing_time_override || null;
        }
        save(patch);
    };

    const stateLabel = mode === 'closed'
        ? 'geschlossen'
        : mode === 'regular'
            ? 'offen wie üblich'
            : `${day.opening_time_override || '—'}${day.closing_time_override ? `–${day.closing_time_override}` : ''}`;

    return (
        <div className="rounded-xl border border-border bg-background/40 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/40 transition-colors"
            >
                <div className="w-10 h-10 rounded-xl bg-status-danger/15 flex flex-col items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-status-danger/25 leading-none">{format(date, 'd')}</span>
                    <span className="text-[9px] text-status-danger/70">{format(date, 'MMM', { locale: de })}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{day.title || 'Feiertag'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                        {format(date, 'EEEE, d. MMMM yyyy', { locale: de })} · {stateLabel}
                    </p>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
                <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                    {/* Segmented Control */}
                    <div className={cn('grid grid-cols-3 gap-1 p-1 rounded-xl bg-secondary/60', !canEdit && 'opacity-60')}>
                        {MODES.map(m => {
                            const Icon = m.icon;
                            const active = mode === m.id;
                            return (
                                <button
                                    key={m.id}
                                    disabled={!canEdit || saving}
                                    onClick={() => handleMode(m.id)}
                                    className={cn(
                                        'flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] font-semibold transition-colors',
                                        active
                                            ? 'bg-primary text-primary-foreground shadow'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span className="text-center leading-tight">{m.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {mode === 'special' && (
                        <div className="flex items-center gap-2">
                            <Input
                                type="time"
                                value={form.opening_time_override}
                                onChange={e => setForm(f => ({ ...f, opening_time_override: e.target.value }))}
                                disabled={!canEdit}
                                className="h-9 w-28"
                            />
                            <span className="text-muted-foreground text-sm">–</span>
                            <Input
                                type="time"
                                value={form.closing_time_override}
                                onChange={e => setForm(f => ({ ...f, closing_time_override: e.target.value }))}
                                disabled={!canEdit}
                                className="h-9 w-28"
                            />
                        </div>
                    )}

                    <Input
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        disabled={!canEdit}
                        placeholder="Titel, z. B. 1. Mai – offen ab 18 Uhr"
                        className="h-9"
                    />
                    <Textarea
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        disabled={!canEdit}
                        rows={2}
                        placeholder="Beschreibung / Hinweis"
                        className="text-sm"
                    />

                    {canEdit && (
                        <Button size="sm" onClick={handleSaveDetails} disabled={saving} className="h-9 w-full gap-1.5">
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Speichern
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}