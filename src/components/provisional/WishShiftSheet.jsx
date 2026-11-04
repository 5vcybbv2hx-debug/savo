/**
 * WishShiftSheet — Wunschschicht direkt aus dem Kalender eintragen.
 * Mobile: Bottom-Sheet, Desktop: Dialog.
 * Props: { open, onOpenChange, date (Date), employee, access }
 *
 * Ist ein Schichttyp voll (taken >= wish_capacity), wird die Zeile nicht
 * deaktiviert: der Mitarbeiter trägt sich stattdessen auf die Warteliste ein.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, ChevronDown, StickyNote, Check, Hourglass } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/components/utils/useIsMobile';
import { haptics } from '@/components/utils/haptics';
import { cn } from '@/lib/utils';
import { getWishShiftTypes, normalizeTime, wishDayHint } from '@/lib/wishShiftRules';
import { BELEGT_STATUS, buildWishUsage, capacityFor, usageFor } from '@/lib/wishShiftCapacity';

// "5:00" → "05:00" (nur für die Anzeige)
function displayTime(t) {
    return normalizeTime(t);
}

export default function WishShiftSheet({ open, onOpenChange, date, employee, access }) {
    const queryClient = useQueryClient();
    const isMobile = useIsMobile();
    const [note, setNote] = useState('');
    const [noteOpen, setNoteOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) {
            setNote('');
            setNoteOpen(false);
            setSaving(false);
        }
    }, [open]);

    const { data: shiftTypes = [], isLoading } = useQuery({
        queryKey: ['wish-shift-types'],
        queryFn: () => base44.entities.ShiftType.filter({ is_active: true }, 'order'),
        enabled: open,
    });

    const dayStr = date ? format(date, 'yyyy-MM-dd') : null;

    // Bereits eingetragene Wünsche für diesen Tag (für Kapazität + "eingetragen")
    const { data: dayRequests = [] } = useQuery({
        queryKey: ['wish-counts', dayStr],
        queryFn: async () => {
            const page = await base44.entities.ProvisionalShiftRequest.filter({ date: dayStr }, { limit: 200 });
            return page?.items || [];
        },
        enabled: open && !!dayStr,
    });

    // Betriebskalender: geschlossene Tage sperren, Sonderöffnungen begrenzen
    const { data: businessDays = [] } = useQuery({
        queryKey: ['business-calendar'],
        queryFn: () => base44.entities.BusinessCalendarDay.list('-date', 500),
        enabled: open,
    });

    // Regeln: Feiertag/Sonderöffnung vor Wochentag (Di 17–22, Mi/Do 18–22, Fr/Sa ab 19:00)
    const availableTypes = useMemo(
        () => getWishShiftTypes(shiftTypes, date, businessDays),
        [shiftTypes, date, businessDays]
    );

    const usageMap = useMemo(() => buildWishUsage(dayRequests), [dayRequests]);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['my-provisional-requests', employee?.id] });
        queryClient.invalidateQueries({ queryKey: ['provisional-shift-requests'] });
        queryClient.invalidateQueries({ queryKey: ['all-provisional-requests'] });
        queryClient.invalidateQueries({ queryKey: ['wish-counts', dayStr] });
    };

    const handlePick = async (type, status) => {
        if (saving || !employee?.id || !date) return;
        haptics.selection();
        setSaving(true);
        try {
            const usage = usageFor(usageMap, dayStr, type.name);
            const position = usage.waitlist.length + 1;

            await base44.entities.ProvisionalShiftRequest.create({
                employee_id: employee.id,
                employee_name: employee.name,
                date: format(date, 'yyyy-MM-dd'),
                start_time: type.start_time,
                end_time: type.end_time,
                shift_type: type.name,
                status,
                access_id: access?.id,
                ...(note.trim() ? { comment: note.trim() } : {}),
            });
            invalidate();

            if (status === 'warteliste') {
                // Sheet bleibt offen, damit die Position direkt sichtbar wird
                toast.success(`Auf der Warteliste – Platz ${position}`);
            } else {
                toast.success('Wunsch eingetragen');
                onOpenChange(false);
            }
        } finally {
            setSaving(false);
        }
    };

    const title = date ? `Wunschschicht · ${format(date, 'EEEE, dd.MM.', { locale: de })}` : 'Wunschschicht';
    const hint = wishDayHint(date, businessDays);

    const body = (
        <div className="space-y-2 pb-2">
            {isLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
            ) : availableTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                    {hint || 'Für diesen Tag ist keine Schichtart zur Auswahl hinterlegt.'}
                </p>
            ) : (
                availableTypes.map(type => {
                    // Belegt = ausstehend + bestätigt (Warteliste zählt nicht)
                    const usage = usageFor(usageMap, dayStr, type.name);
                    const taken = usage.taken;
                    const capacity = capacityFor(type);
                    const full = taken >= capacity;
                    const ownActive = dayRequests.some(r =>
                        r.employee_id === employee?.id && r.shift_type === type.name && BELEGT_STATUS.includes(r.status)
                    );
                    const ownWaitIndex = usage.waitlist.findIndex(r => r.employee_id === employee?.id);
                    const ownWaitPosition = ownWaitIndex >= 0 ? ownWaitIndex + 1 : null;
                    const blocked = saving || ownActive || ownWaitPosition !== null;
                    const pct = capacity > 0 ? Math.min(100, (taken / capacity) * 100) : 100;

                    return (
                        <button
                            key={type.id}
                            type="button"
                            disabled={blocked}
                            onClick={() => handlePick(type, full ? 'warteliste' : 'ausstehend')}
                            className={cn(
                                'w-full flex items-center justify-between gap-3 px-4 py-4 rounded-xl border text-left transition-all',
                                blocked
                                    ? 'opacity-60 cursor-not-allowed border-border bg-secondary/30'
                                    : full
                                        ? 'border-dashed border-amber-500/60 bg-amber-500/5 hover:bg-amber-500/10 active:scale-[0.99]'
                                        : 'border-border bg-secondary/40 hover:bg-secondary active:scale-[0.99]'
                            )}
                        >
                            <span className="font-semibold text-foreground min-w-0 truncate">{type.name}</span>
                            <span className="shrink-0 text-right space-y-1">
                                <span className="flex items-center justify-end gap-2">
                                    {ownActive && (
                                        <span className="flex items-center gap-1 text-xs text-emerald-500">
                                            <Check className="w-3 h-3" /> eingetragen
                                        </span>
                                    )}
                                    {ownWaitPosition !== null && (
                                        <span className="flex items-center gap-1 text-xs text-amber-400">
                                            <Hourglass className="w-3 h-3" /> Warteliste, Platz {ownWaitPosition}
                                        </span>
                                    )}
                                    {!ownActive && ownWaitPosition === null && full && (
                                        <span className="text-xs font-semibold text-amber-400">Auf die Warteliste</span>
                                    )}
                                    <span className="text-sm text-muted-foreground font-mono">
                                        {displayTime(type.start_time)} – {displayTime(type.end_time)}
                                    </span>
                                </span>
                                <span className="flex items-center justify-end gap-2">
                                    <span className="text-xs text-muted-foreground">{taken} von {capacity}</span>
                                    <span className="block w-16 h-[3px] rounded-full bg-border overflow-hidden">
                                        <span className="block h-full bg-amber-500" style={{ width: `${pct}%` }} />
                                    </span>
                                </span>
                                {usage.waitlist.length > 0 && (
                                    <span className="block text-[11px] text-amber-400/80">
                                        {usage.waitlist.length} auf der Warteliste
                                    </span>
                                )}
                            </span>
                        </button>
                    );
                })
            )}

            {/* Notiz — eingeklappt */}
            <div className="pt-2">
                <button
                    type="button"
                    onClick={() => setNoteOpen(o => !o)}
                    className="w-full flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <StickyNote className="w-4 h-4" />
                    <span className="flex-1 text-left">{note.trim() ? 'Notiz hinzugefügt' : 'Notiz (optional)'}</span>
                    <ChevronDown className={cn('w-4 h-4 transition-transform', noteOpen && 'rotate-180')} />
                </button>
                {noteOpen && (
                    <Textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Hinweis an den Manager…"
                        rows={2}
                        className="mt-1 text-sm"
                    />
                )}
            </div>

            {saving && (
                <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Wird eingetragen…
                </p>
            )}
        </div>
    );

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent className="bg-card border-border">
                    <DrawerHeader className="border-b border-border pb-3">
                        <DrawerTitle className="text-foreground text-base text-left">{title}</DrawerTitle>
                        {hint && <p className="text-xs text-muted-foreground text-left mt-1">{hint}</p>}
                    </DrawerHeader>
                    <div className="px-4 pt-3 overflow-y-auto max-h-[70vh]">{body}</div>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base">{title}</DialogTitle>
                    {hint && <p className="text-xs text-muted-foreground text-left mt-1">{hint}</p>}
                </DialogHeader>
                {body}
            </DialogContent>
        </Dialog>
    );
}