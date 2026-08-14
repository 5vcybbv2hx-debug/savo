import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/components/auth/usePermissions';
import { createNotification } from '@/utils/createNotification';
import { useQueryClient } from '@tanstack/react-query';
import {
    X, Phone, ShieldAlert, Siren, Flame, AlertTriangle,
    Pill, HardHat, Stethoscope, Heart, Droplet, Scissors, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const INCIDENT_TYPES = [
    { key: 'medizinisch', label: 'Medizinischer Notfall', icon: Siren, color: 'red' },
    { key: 'gewalt',      label: 'Gewalt / Schlägerei',   icon: ShieldAlert, color: 'red' },
    { key: 'feuer',       label: 'Feuer',                  icon: Flame, color: 'orange' },
    { key: 'ueberfall',   label: 'Überfall',               icon: AlertTriangle, color: 'orange' },
    { key: 'diebstahl',   label: 'Diebstahl',              icon: AlertTriangle, color: 'orange' },
    { key: 'drogen',      label: 'Drogen',                 icon: Pill, color: 'yellow' },
    { key: 'arbeitsunfall', label: 'Arbeitsunfall',        icon: HardHat, color: 'yellow' },
];

const FIRST_AID = [
    { title: 'Bewusstlos', text: 'Stabile Seitenlage, Atmung prüfen, 112 rufen' },
    { title: 'Alkoholvergiftung', text: 'Nicht allein lassen, ständige Seitenlage, 112 bei Bewusstlosigkeit' },
    { title: 'Schnittwunde', text: 'Druckverband, bei starkem Blutverlust 112' },
    { title: 'Herzdruckmassage', text: 'Mitte der Brust, 5-6 cm tief, 100-120/min' },
];

const COLOR_STYLES = {
    red:    'bg-red-600 hover:bg-red-500 text-white',
    orange: 'bg-orange-600 hover:bg-orange-500 text-white',
    yellow: 'bg-yellow-600 hover:bg-yellow-500 text-white',
};

function CallButton({ href, label, subtitle, color, training, onClick }) {
    const cls = {
        red: 'bg-red-600 hover:bg-red-500',
        blue: 'bg-blue-600 hover:bg-blue-500',
        green: 'bg-green-600 hover:bg-green-500',
    }[color];
    return (
        <a
            href={training ? undefined : href}
            onClick={e => { if (training) { e.preventDefault(); onClick?.(); } }}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl ${cls} text-white py-4 px-3 min-h-[72px] shadow-lg active:scale-95 transition-all`}
        >
            <Phone className="w-5 h-5 mb-0.5" />
            <span className="text-2xl font-bold leading-none tracking-tight">{label}</span>
            <span className="text-[11px] font-medium opacity-90">{subtitle}</span>
        </a>
    );
}

export default function EmergencyModal({ open, onClose }) {
    const permissions = usePermissions();
    const queryClient = useQueryClient();

    const [seconds, setSeconds] = useState(0);
    const [selectedType, setSelectedType] = useState(null);
    const [who, setWho] = useState('');
    const [what, setWhat] = useState('');
    const [where, setWhere] = useState('');
    const [training, setTraining] = useState(false);
    const [saving, setSaving] = useState(false);
    const [alerting, setAlerting] = useState(false);
    const [shiftStaff, setShiftStaff] = useState('');
    const startedAt = useRef(null);

    // Timer
    useEffect(() => {
        if (!open) return;
        startedAt.current = Date.now();
        setSeconds(0);
        setSelectedType(null);
        setWho(''); setWhat(''); setWhere('');
        const id = setInterval(() => {
            setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
        }, 1000);
        return () => clearInterval(id);
    }, [open]);

    // Auto-fill shift staff
    useEffect(() => {
        if (!open) return;
        const today = format(new Date(), 'yyyy-MM-dd');
        base44.entities.Shift.filter({ date: today }, undefined, 100)
            .then(shifts => {
                const names = [...new Set(shifts.map(s => s.employee_name).filter(Boolean))];
                if (names.length) setShiftStaff(names.join(', '));
            })
            .catch(() => {});
    }, [open]);

    const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

    const handleTrainingCall = () => {
        toast.info('Schulungsmodus — kein echter Notruf');
    };

    const handleAlertManagers = async () => {
        setAlerting(true);
        try {
            const managers = await base44.entities.Employee.filter({ role: 'Manager', is_active: true }, undefined, 50);
            const typeLabel = INCIDENT_TYPES.find(t => t.key === selectedType)?.label || 'Unbekannt';
            const prefix = training ? 'TRAINING: ' : '';
            await createNotification({
                type: 'emergency',
                title: `🚨 NOTFALL in SAVO${training ? ' (TRAINING)' : ''}`,
                message: `${prefix}${typeLabel}${what ? ` — ${what}` : ''}${who ? ` · Betroffen: ${who}` : ''}`,
                targetRoles: ['admin', 'Manager'],
            });
            toast.success(`Manager wurden benachrichtigt${managers.length ? ` (${managers.length})` : ''}`);
        } catch (err) {
            toast.error(`Alert fehlgeschlagen: ${err?.message || 'Unbekannt'}`);
        } finally {
            setAlerting(false);
        }
    };

    const handleSave = async () => {
        if (!selectedType) { toast.error('Bitte Vorfall-Typ wählen'); return; }
        setSaving(true);
        try {
            const now = new Date().toISOString();
            await base44.entities.Incident.create({
                type: selectedType,
                status: 'aktiv',
                who, what, where,
                severity: 'mittel',
                is_training: training,
                shift_staff: shiftStaff,
                incident_time: now,
            });
            queryClient.invalidateQueries({ queryKey: ['incidents'] });
            toast.success('Vorfall erfasst');
            onClose();
        } catch (err) {
            toast.error(`Speichern fehlgeschlagen: ${err?.message || 'Unbekannt'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md overflow-y-auto"
                >
                    <div className="min-h-full flex flex-col max-w-2xl mx-auto px-4 py-6">
                        {/* Header: Timer + Close + Training toggle */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-white">
                                <Clock className="w-5 h-5 text-red-400" />
                                <span className="text-lg font-mono font-bold tabular-nums">⏱️ {mmss}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {permissions.isManager && (
                                    <button
                                        onClick={() => setTraining(t => !t)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                            training
                                                ? 'bg-yellow-500 text-black border-yellow-400'
                                                : 'bg-transparent text-white/70 border-white/30 hover:text-white'
                                        }`}
                                    >
                                        Schulungsmodus {training ? 'AN' : 'AUS'}
                                    </button>
                                )}
                                <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Call buttons */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <CallButton href="tel:112" label="112" subtitle="Notruf" color="red" training={training} onClick={handleTrainingCall} />
                            <CallButton href="tel:110" label="110" subtitle="Polizei" color="blue" training={training} onClick={handleTrainingCall} />
                            <CallButton href="tel:+4974336666" label="Taxi" subtitle="+49 7433 6666" color="green" training={training} onClick={handleTrainingCall} />
                        </div>

                        {/* Überfall-Tipp */}
                        <div className="rounded-xl bg-yellow-500/15 border border-yellow-500/40 px-4 py-3 mb-4">
                            <p className="text-sm text-yellow-100 font-medium leading-snug">
                                ⚠️ <strong>Überfall:</strong> Geld herausgeben. Nicht heldenhaft sein. Tresor nicht öffnen. Täter beschreiben, nicht verfolgen. Nach Tataufgang 110 rufen.
                            </p>
                        </div>

                        {/* Erste-Hilfe-Cheatsheet (nur Schulungsmodus) */}
                        {training && (
                            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 mb-4">
                                <p className="text-xs font-bold text-white/80 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                    <Stethoscope className="w-3.5 h-3.5" /> Erste-Hilfe-Cheatsheet
                                </p>
                                <div className="space-y-2">
                                    {FIRST_AID.map(item => (
                                        <div key={item.title} className="flex gap-2 text-xs text-white/90">
                                            <span className="font-bold text-white min-w-[120px]">{item.title}</span>
                                            <span className="text-white/70">{item.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Vorfall-Typ Auswahl */}
                        <p className="text-xs font-bold text-white/70 uppercase tracking-wide mb-2">Vorfall-Typ</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                            {INCIDENT_TYPES.map(t => {
                                const Icon = t.icon;
                                const active = selectedType === t.key;
                                return (
                                    <button
                                        key={t.key}
                                        onClick={() => setSelectedType(t.key)}
                                        className={`flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 min-h-[68px] text-center transition-all active:scale-95 border ${
                                            active
                                                ? `${COLOR_STYLES[t.color]} border-white/40`
                                                : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                                        }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="text-[11px] font-semibold leading-tight">{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Schnellerfassung */}
                        {selectedType && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-3 mb-4"
                            >
                                <p className="text-xs font-bold text-white/70 uppercase tracking-wide">Schnellerfassung</p>
                                <div>
                                    <label className="text-xs text-white/60 mb-1 block">Wer? (Gast, Mitarbeiter, Unbekannt + Beschreibung)</label>
                                    <input
                                        value={who} onChange={e => setWho(e.target.value)}
                                        placeholder="z.B. Gast, männlich, ca. 30 Jahre"
                                        className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-red-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-white/60 mb-1 block">Was ist passiert?</label>
                                    <textarea
                                        value={what} onChange={e => setWhat(e.target.value)} rows={2}
                                        placeholder="Kurze Beschreibung..."
                                        className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-red-400 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-white/60 mb-1 block">Wo?</label>
                                    <select
                                        value={where} onChange={e => setWhere(e.target.value)}
                                        className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-400"
                                    >
                                        <option value="" className="bg-zinc-900">— wählen —</option>
                                        <option value="Innen" className="bg-zinc-900">Innen</option>
                                        <option value="Außen / Raucherbereich" className="bg-zinc-900">Außen / Raucherbereich</option>
                                        <option value="WC" className="bg-zinc-900">WC</option>
                                        <option value="Eingang" className="bg-zinc-900">Eingang</option>
                                        <option value="Theke" className="bg-zinc-900">Theke</option>
                                        <option value="Sonstiges" className="bg-zinc-900">Sonstiges</option>
                                    </select>
                                </div>
                            </motion.div>
                        )}

                        {/* Bottom actions */}
                        <div className="mt-auto pt-2 space-y-2">
                            <button
                                onClick={handleAlertManagers}
                                disabled={alerting}
                                className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold py-3 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {alerting ? 'Manager werden alertiert…' : 'Manager alerten'}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !selectedType}
                                className="w-full rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold py-3 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {saving ? 'Speichern…' : 'Vorfall speichern'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}