/**
 * QuickReservationSheet — Bottom Sheet für schnelle Reservierungserstellung oder Tisch-Details.
 * Öffnet sich wenn ein Tisch angetippt wird.
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    X, Calendar, Clock, Users, CheckCircle2, Phone, Pencil,
    ChevronRight, Sparkles, AlertCircle, ChevronDown
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

// Prüft ob zwei Zeitfenster sich überschneiden (mit 90 Min Puffer)
function timesOverlap(resTime, checkTime, bufferMin = 90) {
    if (!resTime || !checkTime) return false;
    const [rh, rm] = resTime.split(':').map(Number);
    const [ch, cm] = checkTime.split(':').map(Number);
    const rMin = rh * 60 + rm;
    const cMin = ch * 60 + cm;
    return Math.abs(rMin - cMin) < bufferMin;
}

// Alle table_numbers einer Reservierung (unterstützt altes + neues Format)
export function getReservationTables(r) {
    if (r.tables && r.tables.length > 0) return r.tables;
    if (r.table) return [r.table];
    return [];
}

export function getTableStatus(table, reservations, checkDate, checkTime) {
    if (!table.is_active && table.is_active !== undefined) return 'inactive';
    const relevant = reservations.filter(r =>
        r.status !== 'storniert' &&
        !r.is_archived &&
        r.date === checkDate &&
        getReservationTables(r).includes(table.table_number)
    );
    if (relevant.length === 0) return 'free';
    const now = relevant.find(r => timesOverlap(r.time, checkTime, 90));
    if (now) return 'reserved';
    const soon = relevant.find(r => {
        const [rh, rm] = r.time.split(':').map(Number);
        const [ch, cm] = checkTime.split(':').map(Number);
        const diff = rh * 60 + rm - (ch * 60 + cm);
        return diff > 0 && diff <= 120;
    });
    if (soon) return 'soon';
    return 'free';
}

export const STATUS_CONFIG = {
    free:     { label: 'Frei',         color: 'bg-green-500/20 border-green-500/50 text-green-400',  dot: 'bg-green-400' },
    reserved: { label: 'Reserviert',   color: 'bg-red-500/20 border-red-500/50 text-red-400',        dot: 'bg-red-400' },
    soon:     { label: 'Bald belegt',  color: 'bg-amber-500/20 border-amber-500/50 text-amber-400',  dot: 'bg-amber-400' },
    inactive: { label: 'Gesperrt',     color: 'bg-secondary/50 border-border text-muted-foreground', dot: 'bg-muted-foreground' },
};

// Reservierungsstatus-Farben für Tischkarten
export const RES_STATUS_CONFIG = {
    vorgemerkt: { label: 'Vorgemerkt', emoji: '🔵', color: 'bg-blue-500/20 border-blue-500/50 text-blue-400',   dot: 'bg-blue-400' },
    bestätigt:  { label: 'Bestätigt',  emoji: '🟡', color: 'bg-amber-400/20 border-amber-400/50 text-amber-300', dot: 'bg-amber-300' },
    erschienen: { label: 'Erschienen', emoji: '🟢', color: 'bg-green-500/20 border-green-500/50 text-green-400', dot: 'bg-green-400' },
    'no-show':  { label: 'No-Show',    emoji: '🔴', color: 'bg-red-600/20 border-red-600/50 text-red-400',       dot: 'bg-red-500' },
    storniert:  { label: 'Storniert',  emoji: '⚪', color: 'bg-secondary/50 border-border text-muted-foreground', dot: 'bg-muted-foreground' },
};

export const STATUS_CYCLE = ['vorgemerkt', 'bestätigt', 'erschienen', 'no-show', 'storniert'];

// Hilfsfunktionen für effektive Tischfarbe/-label (re-used in GuestHubTablesTab)
export function getEffectiveTableColor(tableStatus, reservation) {
    if ((tableStatus === 'reserved' || tableStatus === 'soon') && reservation?.status) {
        return RES_STATUS_CONFIG[reservation.status]?.color || STATUS_CONFIG[tableStatus].color;
    }
    return STATUS_CONFIG[tableStatus].color;
}
export function getEffectiveTableDot(tableStatus, reservation) {
    if ((tableStatus === 'reserved' || tableStatus === 'soon') && reservation?.status) {
        return RES_STATUS_CONFIG[reservation.status]?.dot || STATUS_CONFIG[tableStatus].dot;
    }
    return STATUS_CONFIG[tableStatus].dot;
}
export function getEffectiveTableLabel(tableStatus, reservation) {
    if ((tableStatus === 'reserved' || tableStatus === 'soon') && reservation?.status) {
        return RES_STATUS_CONFIG[reservation.status]?.label || STATUS_CONFIG[tableStatus].label;
    }
    return STATUS_CONFIG[tableStatus].label;
}

export default function QuickReservationSheet({ table, reservations, tables, onClose, onEditReservation, checkDate, checkTime, isManager }) {
    const queryClient = useQueryClient();
    const status = getTableStatus(table, reservations, checkDate, checkTime);
    const [statusMenuOpen, setStatusMenuOpen] = useState(null);

    // Alle Reservierungen des Tages für diesen Tisch (chronologisch)
    const dayReservations = useMemo(() =>
        reservations
            .filter(r =>
                r.status !== 'storniert' &&
                !r.is_archived &&
                r.date === checkDate &&
                getReservationTables(r).includes(table.table_number)
            )
            .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
        [reservations, checkDate, table.table_number]
    );

    const [mode, setMode] = useState(status === 'free' ? 'new' : 'info');
    const [form, setForm] = useState({
        customer_name: '',
        phone: '',
        guests: table.capacity || 2,
        date: checkDate,
        time: checkTime,
        notes: ''
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Reservation.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
            toast.success('Reservierung erstellt');
            onClose();
        },
        onError: (e) => toast.error('Fehler: ' + e.message)
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Reservation.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
            toast.success('Status aktualisiert');
            setStatusMenuOpen(null);
        },
        onError: (e) => toast.error('Fehler: ' + e.message)
    });

    const handleCreate = () => {
        if (!form.customer_name.trim()) { toast.error('Name erforderlich'); return; }
        createMutation.mutate({
            ...form,
            guests: Number(form.guests),
            table: table.table_number,
            status: 'vorgemerkt',
            source: 'intern'
        });
    };

    const handleStatusChange = (res, newStatus) => {
        updateMutation.mutate({ id: res.id, data: { status: newStatus } });
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 bg-card border-t border-border rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => { e.stopPropagation(); if (statusMenuOpen) setStatusMenuOpen(null); }}>
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-border" />
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
                    <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0',
                        STATUS_CONFIG[status].color
                    )}>
                        {table.table_number}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-foreground">Tisch {table.table_number}</p>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full border flex items-center gap-1', STATUS_CONFIG[status].color)}>
                                <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_CONFIG[status].dot)} />
                                {STATUS_CONFIG[status].label}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {table.capacity} Plätze{table.room ? ` · ${table.room}` : ''}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Info mode — alle Reservierungen des Tages */}
                {mode === 'info' && dayReservations.length > 0 && (
                    <div className="p-5 space-y-3">
                        {dayReservations.length > 1 && (
                            <p className="text-[12px] font-medium text-muted-foreground">
                                {dayReservations.length} Reservierungen heute
                            </p>
                        )}
                        {dayReservations.map(res => {
                            const isActive = timesOverlap(res.time, checkTime, 90);
                            const resStatusCfg = RES_STATUS_CONFIG[res.status] || { emoji: '⚪', label: res.status };
                            return (
                                <div key={res.id} className={cn(
                                    'rounded-xl border p-4 space-y-3',
                                    isActive ? 'border-red-500/40 bg-red-500/10' : 'border-border bg-secondary/30'
                                )}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-semibold text-foreground">{res.customer_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isActive && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Jetzt</span>
                                            )}
                                            {/* Status-Badge mit Dropdown (nur Manager) */}
                                            <div className="relative" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => isManager && setStatusMenuOpen(statusMenuOpen === res.id ? null : res.id)}
                                                    className={cn(
                                                        'flex items-center gap-1 text-xs px-2 py-1 rounded-full border min-h-[28px]',
                                                        res.status === 'vorgemerkt' && 'bg-blue-500/20 border-blue-500/40 text-blue-400',
                                                        res.status === 'bestätigt'  && 'bg-amber-400/20 border-amber-400/40 text-amber-300',
                                                        res.status === 'erschienen' && 'bg-green-500/20 border-green-500/40 text-green-400',
                                                        res.status === 'no-show'    && 'bg-red-600/20 border-red-600/40 text-red-400',
                                                        res.status === 'storniert'  && 'bg-secondary/50 border-border text-muted-foreground',
                                                    )}
                                                >
                                                    {resStatusCfg.emoji} {resStatusCfg.label}
                                                    {isManager && <ChevronDown className="w-2.5 h-2.5 ml-0.5" />}
                                                </button>
                                                {statusMenuOpen === res.id && isManager && (
                                                    <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px]">
                                                        {STATUS_CYCLE.map(s => (
                                                            <button
                                                                key={s}
                                                                onClick={() => handleStatusChange(res, s)}
                                                                className={cn(
                                                                    'w-full text-left px-3 py-2.5 text-xs hover:bg-accent transition-colors',
                                                                    s === res.status && 'font-bold text-foreground bg-accent/50'
                                                                )}
                                                            >
                                                                {RES_STATUS_CONFIG[s]?.emoji} {RES_STATUS_CONFIG[s]?.label || s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Uhrzeit</p>
                                            <p className="font-medium text-foreground">{res.time}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Personen</p>
                                            <p className="font-medium text-foreground">{res.guests}</p>
                                        </div>
                                    </div>
                                    {res.phone && (
                                        <a href={`tel:${res.phone}`}
                                            className="flex items-center gap-2 text-sm text-blue-400 min-h-[44px]">
                                            <Phone className="w-4 h-4" />{res.phone}
                                        </a>
                                    )}
                                    {res.notes && (
                                        <p className="text-sm text-muted-foreground italic">💬 „{res.notes}"</p>
                                    )}
                                    {onEditReservation && (
                                        <Button variant="outline" size="sm" className="w-full gap-2"
                                            onClick={() => { onEditReservation(res); onClose(); }}>
                                            <Pencil className="w-3.5 h-3.5" />Bearbeiten
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                        <Button className="w-full h-12 gap-2 mt-2" onClick={() => setMode('new')}>
                            <Calendar className="w-4 h-4" />Neue Reservierung
                        </Button>
                    </div>
                )}

                {/* New reservation form */}
                {mode === 'new' && (
                    <div className="p-5 space-y-4">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            Reservierung für Tisch {table.table_number}
                        </p>

                        {/* Name */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                            <input
                                type="text"
                                value={form.customer_name}
                                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                                placeholder="Gast-Name"
                                className="w-full h-12 px-4 rounded-xl border border-input bg-transparent text-foreground text-base focus:outline-none focus:ring-1 focus:ring-ring"
                                autoFocus
                            />
                        </div>

                        {/* Time + Guests in one row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Uhrzeit</label>
                                <input type="time" value={form.time}
                                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                                    className="w-full h-12 px-3 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Personen</label>
                                <div className="flex items-center gap-2 h-12">
                                    <button onClick={() => setForm(f => ({ ...f, guests: Math.max(1, f.guests - 1) }))}
                                        className="w-10 h-10 rounded-xl border border-input text-foreground text-xl flex items-center justify-center hover:bg-accent shrink-0">−</button>
                                    <span className="text-xl font-bold text-foreground w-6 text-center">{form.guests}</span>
                                    <button onClick={() => setForm(f => ({ ...f, guests: Math.min(20, f.guests + 1) }))}
                                        className="w-10 h-10 rounded-xl border border-input text-foreground text-xl flex items-center justify-center hover:bg-accent shrink-0">+</button>
                                </div>
                            </div>
                        </div>

                        {/* Date */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Datum</label>
                            <input type="date" value={form.date}
                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                className="w-full h-12 px-3 rounded-xl border border-input bg-transparent text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefon (optional)</label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                placeholder="+49 ..."
                                className="w-full h-12 px-4 rounded-xl border border-input bg-transparent text-foreground text-base focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                        </div>

                        {form.guests > table.capacity && (
                            <p className="text-xs text-amber-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />Über Tischkapazität ({table.capacity} Pl.)
                            </p>
                        )}

                        <div className="flex gap-3 pt-2">
                            {mode === 'new' && dayReservations.length > 0 && (
                                <Button variant="outline" className="flex-1 h-12" onClick={() => setMode('info')}>Zurück</Button>
                            )}
                            {mode === 'new' && dayReservations.length === 0 && (
                                <Button variant="outline" className="flex-1 h-12" onClick={onClose}>Abbrechen</Button>
                            )}
                            <Button
                                className="flex-1 h-12 gap-2 font-semibold"
                                onClick={handleCreate}
                                disabled={createMutation.isPending}
                                style={{ background: 'linear-gradient(135deg, var(--brand-from), var(--brand-via))', color: 'var(--brand-fg)' }}
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Reservieren
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}