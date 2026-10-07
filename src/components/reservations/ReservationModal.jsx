import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, AlertCircle, RepeatIcon, Check, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/mobile-select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/mobile-dialog";
import { MobileModalHeader, MobileModalContent, MobileModalFooter } from "@/components/modals/MobileModalWrapper";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, isSameDay } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RES_KEYS } from '@/features/reservations/hooks/useReservations';
import { Switch } from "@/components/ui/switch";
import { haptics } from "@/components/utils/haptics";
import { cn } from '@/lib/utils';

// Hilfsfunktion: Zeitüberschneidung ±2h
function timesOverlap(t1, t2, bufferMin = 120) {
    if (!t1 || !t2) return false;
    const [h1, m1] = t1.split(':').map(Number);
    const [h2, m2] = t2.split(':').map(Number);
    return Math.abs(h1 * 60 + m1 - (h2 * 60 + m2)) < bufferMin;
}

// Alle table_numbers einer Reservierung (unterstützt altes + neues Format)
function getReservationTables(r) {
    if (r.tables && r.tables.length > 0) return r.tables;
    if (r.table) return [r.table];
    return [];
}

export default function ReservationModal({ open, onClose, reservation, onSave, onDelete, canDelete = false, isManager = false, onNavigate, navPosition }) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        customer_name: '',
        phone: '',
        email: '',
        date: '',
        time: '19:00',
        guests: 2,
        tables: [],
        table: '',
        notes: '',
        status: 'vorgemerkt',
        is_recurring: false,
        recurring_pattern: 'weekly',
        recurring_end_date: ''
    });

    const { data: events = [] } = useQuery({
        queryKey: ['events'],
        queryFn: () => base44.entities.Event.list('-date', 50),
        enabled: open
    });

    const { data: allTables = [] } = useQuery({
        queryKey: ['tables'],
        queryFn: () => base44.entities.Table.list(),
        enabled: open
    });

    // Nutze Cache statt zweitem API-Call
    const allReservations = queryClient.getQueryData(RES_KEYS.active) ?? [];

    const sortedTables = useMemo(() =>
        [...allTables]
            .filter(t => t.is_active !== false)
            .sort((a, b) => String(a.table_number).localeCompare(String(b.table_number), undefined, { numeric: true })),
        [allTables]
    );

    const hasEventOnDate = formData.date && events.some(e =>
        isSameDay(new Date(e.date), new Date(formData.date)) && e.status !== 'abgesagt'
    );
    const isBlocked = hasEventOnDate && !isManager;

    // Kapazitätswarnung
    const selectedTableObjs = sortedTables.filter(t => formData.tables.includes(t.table_number));
    const totalCapacity = selectedTableObjs.reduce((sum, t) => sum + (t.capacity || 0), 0);
    const capacityWarning = formData.tables.length > 0 && totalCapacity > 0 && formData.guests > totalCapacity;

    // Kollisionswarnung: Ein gewählter Tisch ist am gleichen Tag ±2h bereits belegt
    const collisionWarnings = useMemo(() => {
        if (!formData.date || !formData.time || formData.tables.length === 0) return [];
        return formData.tables.filter(tn => {
            return allReservations.some(r => {
                if (r.id === reservation?.id) return false;
                if (r.status === 'storniert' || r.is_archived) return false;
                if (r.date !== formData.date) return false;
                if (!timesOverlap(r.time, formData.time)) return false;
                return getReservationTables(r).includes(tn);
            });
        });
    }, [formData.tables, formData.date, formData.time, allReservations, reservation?.id]);

    useEffect(() => {
        if (reservation) {
            const tables = (reservation.tables && reservation.tables.length > 0)
                ? reservation.tables
                : reservation.table ? [reservation.table] : [];
            setFormData({
                customer_name: reservation.customer_name || '',
                phone: reservation.phone || '',
                email: reservation.email || '',
                date: reservation.date || '',
                time: reservation.time || '19:00',
                guests: reservation.guests || 2,
                tables,
                table: reservation.table || '',
                notes: reservation.notes || '',
                status: reservation.status || 'vorgemerkt',
                is_recurring: false,
                recurring_pattern: 'weekly',
                recurring_end_date: ''
            });
        } else {
            // Smart Vorbelegung: Datum = heute, Uhrzeit = nächste halbe Stunde
            const now = new Date();
            const minutes = now.getMinutes();
            const rounded = minutes <= 30 ? 30 : 60;
            now.setMinutes(rounded, 0, 0);
            if (rounded === 60) now.setHours(now.getHours() + 1);
            const pad = (n) => String(n).padStart(2, '0');
            const defaultTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
            const todayStr = format(now, 'yyyy-MM-dd');
            setFormData({
                customer_name: '',
                phone: '',
                email: '',
                date: todayStr,
                time: defaultTime,
                guests: 2,
                tables: [],
                table: '',
                notes: '',
                status: 'vorgemerkt',
                is_recurring: false,
                recurring_pattern: 'weekly',
                recurring_end_date: ''
            });
        }
    }, [reservation, open]);

    const toggleTable = (tableNumber) => {
        setFormData(prev => {
            const already = prev.tables.includes(tableNumber);
            const newTables = already
                ? prev.tables.filter(t => t !== tableNumber)
                : [...prev.tables, tableNumber];
            // Rückwärtskompatibilität: table = erster Tisch
            return { ...prev, tables: newTables, table: newTables[0] || '' };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isBlocked) return;
        haptics.light();
        onSave({ ...formData }, reservation?.id);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <MobileModalHeader onClose={onClose} onNavigate={reservation?.id ? onNavigate : undefined} navPosition={navPosition}>
                    {reservation ? 'Reservierung bearbeiten' : 'Neue Reservierung'}
                </MobileModalHeader>

                <MobileModalContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {hasEventOnDate && isBlocked && (
                        <Alert className="bg-red-500/10 border-red-500/30">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <AlertDescription className="text-red-400">
                                An diesem Tag findet ein Event statt. Reservierungen sind für Gäste gesperrt.
                            </AlertDescription>
                        </Alert>
                    )}
                    {hasEventOnDate && isManager && (
                        <Alert className="bg-amber-500/10 border-amber-500/30">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <AlertDescription className="text-amber-400">
                                Reservierungen sind für Gäste gesperrt. Als Manager kannst du trotzdem manuell eintragen.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label>Name *</Label>
                        <Input
                            value={formData.customer_name}
                            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                            placeholder="Name des Gastes"
                            required
                            disabled={isBlocked}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Telefon</Label>
                            <Input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+49..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>E-Mail</Label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="email@..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Datum *</Label>
                            <Input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Uhrzeit * (bis 21:00 Uhr)</Label>
                            <Input
                                type="time"
                                max="21:00"
                                value={formData.time}
                                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Personen *</Label>
                            <Input
                                type="number"
                                min="1"
                                value={formData.guests}
                                onChange={(e) => setFormData({ ...formData, guests: parseInt(e.target.value) })}
                                required
                            />
                        </div>
                    </div>

                    {/* Kapazitätswarnung */}
                    {capacityWarning && (
                        <Alert className="bg-amber-500/10 border-amber-500/30">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <AlertDescription className="text-amber-400">
                                ⚠️ Gästeanzahl übersteigt Tischkapazität ({totalCapacity} Plätze)
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Kollisionswarnung */}
                    {collisionWarnings.length > 0 && (
                        <Alert className="bg-orange-500/10 border-orange-500/30">
                            <AlertCircle className="w-4 h-4 text-orange-400" />
                            <AlertDescription className="text-orange-400">
                                ⚠️ Tisch {collisionWarnings.join(', ')} ist um diese Zeit bereits belegt (±2h)
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Multi-Select Tische */}
                    <div className="space-y-2">
                        <Label>
                            Tische
                            {formData.tables.length > 0 && (
                                <span className="ml-2 text-xs text-muted-foreground font-normal">
                                    {formData.tables.length} gewählt · {totalCapacity > 0 ? `${totalCapacity} Pl.` : ''}
                                </span>
                            )}
                        </Label>
                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                            {sortedTables.map(t => {
                                const isSelected = formData.tables.includes(t.table_number);
                                const hasCollision = collisionWarnings.includes(t.table_number);
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => toggleTable(t.table_number)}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all min-h-[40px]',
                                            isSelected
                                                ? hasCollision
                                                    ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                                                    : 'bg-primary/20 border-primary/60 text-primary'
                                                : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
                                        )}
                                    >
                                        {isSelected && <Check className="w-3 h-3" />}
                                        <span>{t.table_number}</span>
                                        {t.capacity && <span className="opacity-60 text-xs">·{t.capacity}</span>}
                                        {t.room && <span className="opacity-50 text-xs hidden sm:inline">·{t.room}</span>}
                                    </button>
                                );
                            })}
                            {formData.tables.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, tables: [], table: '' }))}
                                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground min-h-[40px]"
                                >
                                    <X className="w-3 h-3" /> Alle abwählen
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="vorgemerkt">Vorgemerkt</SelectItem>
                                <SelectItem value="bestätigt">Bestätigt</SelectItem>
                                <SelectItem value="storniert">Storniert</SelectItem>
                                <SelectItem value="no-show">No-Show</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Notizen</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Besondere Wünsche..."
                            rows={2}
                        />
                    </div>

                    {!reservation && (
                        <div className="space-y-3 p-4 bg-secondary/40 rounded-lg border border-border">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <RepeatIcon className="w-4 h-4 text-slate-600" />
                                    <Label htmlFor="recurring" className="cursor-pointer">Wiederkehrend (z.B. Stammtisch)</Label>
                                </div>
                                <Switch
                                    id="recurring"
                                    checked={formData.is_recurring}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
                                />
                            </div>

                            {formData.is_recurring && (
                                <div className="space-y-3 mt-3 pl-6">
                                    <div className="space-y-2">
                                        <Label>Wiederholung</Label>
                                        <Select
                                            value={formData.recurring_pattern}
                                            onValueChange={(v) => setFormData({ ...formData, recurring_pattern: v })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="weekly">Wöchentlich</SelectItem>
                                                <SelectItem value="biweekly">Alle 2 Wochen</SelectItem>
                                                <SelectItem value="monthly">Monatlich</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Endet am (optional)</Label>
                                        <Input
                                            type="date"
                                            value={formData.recurring_end_date}
                                            onChange={(e) => setFormData({ ...formData, recurring_end_date: e.target.value })}
                                            min={formData.date}
                                        />
                                        <p className="text-xs text-slate-500">Leer lassen für 6 Monate</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </form>
                </MobileModalContent>

                <MobileModalFooter>
                    {reservation && canDelete && (
                        <Button
                            type="button"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                                haptics.light();
                                onDelete(reservation.id);
                            }}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Löschen
                        </Button>
                    )}
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11">
                            Abbrechen
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 h-11 bg-amber-600 hover:bg-amber-700"
                            disabled={isBlocked}
                            onClick={handleSubmit}
                        >
                            {reservation
                                ? 'Speichern'
                                : formData.is_recurring
                                    ? 'Wiederk. anlegen'
                                    : 'Hinzufügen'}
                        </Button>
                    </div>
                </MobileModalFooter>
            </DialogContent>
        </Dialog>
    );
}