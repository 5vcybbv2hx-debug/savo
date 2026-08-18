import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
// Pierres Nummer: +491737486992
import {
    X, Phone, Car, User, Siren, ShieldAlert, Shield, Flame, AlertTriangle,
    Pill, HardHat, ChevronRight, ChevronLeft, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const INCIDENT_TYPES = [
    { key: 'medizinisch', label: 'Medizinisch', icon: Siren },
    { key: 'gewalt', label: 'Gewalt', icon: ShieldAlert },
    { key: 'feuer', label: 'Feuer', icon: Flame },
    { key: 'ueberfall', label: 'Überfall', icon: AlertTriangle },
    { key: 'diebstahl', label: 'Diebstahl', icon: AlertTriangle },
    { key: 'drogen', label: 'Drogen', icon: Pill },
    { key: 'arbeitsunfall', label: 'Arbeitsunfall', icon: HardHat },
];

const FIRST_AID_STEPS = [
    { title: 'Sicherheit prüfen', text: 'Gefahr für dich? Strom, Feuer, Verkehr? Erst sichern, dann helfen.' },
    { title: 'Bewusstsein prüfen', text: 'Ansprechen, an Schultern rütteln. Reagiert die Person?' },
    { title: 'Atmung prüfen', text: 'Brustkorb beobachten, hören, fühlen — max. 10 Sekunden.' },
    { title: 'Notruf 112', text: 'Wem, Was, Wo, Wie viele. Falls noch nicht geschehen — jetzt anrufen!' },
    { title: 'Stabile Seitenlage', text: 'Bei Bewusstlosigkeit + normaler Atmung: Person in Seitenlage bringen.' },
    { title: 'Herzdruckmassage', text: 'Bewusstlos + keine Atmung: Mitte der Brust, 5–6 cm tief, 100–120/min.' },
    { title: 'Bis zum Eintreffen', text: 'Helfer anweisen, Rettungskräfte einweisen. Nicht alleine lassen.' },
];

function CallRow({ href, icon: Icon, label, subtitle, color, onAfter }) {
    const cls = {
        green: 'bg-green-600 hover:bg-green-500',
        blue: 'bg-blue-600 hover:bg-blue-500',
        red: 'bg-red-600 hover:bg-red-500',
        card: 'bg-card border border-border hover:bg-accent',
    }[color];
    const textCls = color === 'card' ? 'text-foreground' : 'text-white';
    return (
        <a
            href={href}
            onClick={() => onAfter?.()}
            className={`flex items-center gap-3 rounded-xl ${cls} ${textCls} px-4 py-3.5 min-h-[60px] shadow-sm active:scale-[0.98] transition-all`}
        >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color === 'card' ? 'bg-primary/15' : 'bg-white/15'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-base font-bold leading-tight">{label}</p>
                {subtitle && <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>}
            </div>
            <Phone className="w-4 h-4 opacity-60 shrink-0" />
        </a>
    );
}

function MedicalAssistant({ onClose }) {
    const [step, setStep] = useState(0);
    const current = FIRST_AID_STEPS[step];
    const isLast = step === FIRST_AID_STEPS.length - 1;

    return (
        <div className="rounded-xl bg-card border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <Siren className="w-3.5 h-3.5" /> Medizinischer Assistent
                </p>
                <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Ausblenden</button>
            </div>

            <div className="flex gap-1">
                {FIRST_AID_STEPS.map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
                ))}
            </div>

            <div>
                <p className="text-sm font-bold text-foreground mb-1">
                    {step + 1}. {current.title}
                </p>
                <p className="text-sm text-muted-foreground leading-snug">{current.text}</p>
            </div>

            <div className="flex items-center justify-between gap-2">
                <button
                    onClick={() => setStep(s => Math.max(0, s - 1))}
                    disabled={step === 0}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 transition-all"
                >
                    <ChevronLeft className="w-4 h-4" /> Zurück
                </button>
                {isLast ? (
                    <button onClick={onClose} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground">
                        <Check className="w-4 h-4" /> Fertig
                    </button>
                ) : (
                    <button
                        onClick={() => setStep(s => s + 1)}
                        className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground"
                    >
                        Weiter <ChevronRight className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

function IncidentCapture({ onClose }) {
    const queryClient = useQueryClient();
    const [selectedType, setSelectedType] = useState(null);
    const [who, setWho] = useState('');
    const [what, setWhat] = useState('');
    const [where, setWhere] = useState('');
    const [saving, setSaving] = useState(false);
    const [shiftStaff, setShiftStaff] = useState('');

    useEffect(() => {
        const today = format(new Date(), 'yyyy-MM-dd');
        base44.entities.Shift.filter({ date: today }, undefined, 100)
            .then(shifts => {
                const names = [...new Set(shifts.map(s => s.employee_name).filter(Boolean))];
                if (names.length) setShiftStaff(names.join(', '));
            })
            .catch(() => {});
    }, []);

    const handleSave = async () => {
        if (!selectedType) { toast.error('Bitte Vorfall-Typ wählen'); return; }
        setSaving(true);
        try {
            await base44.entities.Incident.create({
                type: selectedType,
                status: 'aktiv',
                who, what, where,
                severity: 'mittel',
                shift_staff: shiftStaff,
                incident_time: new Date().toISOString(),
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
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Vorfall erfassen (optional)</p>

            <div className="grid grid-cols-2 gap-2">
                {INCIDENT_TYPES.map(t => {
                    const Icon = t.icon;
                    const active = selectedType === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setSelectedType(t.key)}
                            className={`flex items-center gap-2 rounded-lg py-2.5 px-3 text-sm font-medium border transition-all active:scale-95 ${
                                active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/40 border-border hover:bg-accent'
                            }`}
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{t.label}</span>
                        </button>
                    );
                })}
            </div>

            {selectedType && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2.5">
                    <input value={who} onChange={e => setWho(e.target.value)} placeholder="Wer? (Gast, Mitarbeiter...)"
                        className="w-full rounded-lg bg-secondary/40 border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
                    <textarea value={what} onChange={e => setWhat(e.target.value)} rows={2} placeholder="Was ist passiert?"
                        className="w-full rounded-lg bg-secondary/40 border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
                    <select value={where} onChange={e => setWhere(e.target.value)}
                        className="w-full rounded-lg bg-secondary/40 border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-primary">
                        <option value="">Wo? — wählen —</option>
                        <option>Innen</option>
                        <option>Außen / Raucherbereich</option>
                        <option>WC</option>
                        <option>Eingang</option>
                        <option>Theke</option>
                        <option>Sonstiges</option>
                    </select>
                </motion.div>
            )}

            {selectedType && (
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 transition-all active:scale-95 disabled:opacity-50"
                >
                    {saving ? 'Speichern…' : 'Vorfall speichern'}
                </button>
            )}
        </div>
    );
}

export default function CallHub({ open, onClose }) {
    const [showMedical, setShowMedical] = useState(false);
    const [showIncident, setShowIncident] = useState(false);

    useEffect(() => {
        if (!open) return;
        setShowMedical(false);
        setShowIncident(false);
    }, [open]);

    const chefPhone = '+491737486992'; // Pierre

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md overflow-y-auto"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="min-h-full flex flex-col max-w-md mx-auto px-4 py-6"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-white">Anrufen</h2>
                            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Zone 1: Alltäglich — Chef + Taxi */}
                        <div className="space-y-2 mb-5">
                            <p className="text-xs font-bold text-white/50 uppercase tracking-wide mb-1">Alltäglich</p>
                            {chefPhone ? (
                                <CallRow href={`tel:${chefPhone}`} icon={User} label="Chef anrufen" subtitle={chefPhone} color="green" />
                            ) : (
                                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-xs text-white/50">
                                    Chef-Telefonnummer in Firmeneinstellungen hinterlegen
                                </div>
                            )}
                            <CallRow href="tel:074336666" icon={Car} label="Taxi" subtitle="07433 6666" color="green" />
                        </div>

                        {/* Trennlinie */}
                        <div className="border-t border-white/15 mb-5" />

                        {/* Zone 2: Notfall — 112 + 110 */}
                        <div className="space-y-2 mb-5">
                            <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-1">⚠️ Notfall</p>
                            <CallRow
                                href="tel:112"
                                icon={Siren}
                                label="112"
                                subtitle="Notruf — Rettungsdienst & Feuerwehr"
                                color="red"
                                onAfter={() => setShowMedical(true)}
                            />
                            <CallRow href="tel:110" icon={ShieldAlert} label="110" subtitle="Polizei" color="blue" />
                            <CallRow
                                href="tel:074332640"
                                icon={Shield}
                                label="Polizei Balingen"
                                subtitle="Nicht-Notfall — 07433 264-0"
                                color="card"
                            />
                        </div>

                        {/* Zone 3: Medizinischer Assistent (nach 112-Tap) */}
                        <AnimatePresence>
                            {showMedical && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mb-5"
                                >
                                    <MedicalAssistant onClose={() => setShowMedical(false)} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Überfall-Tipp */}
                        <div className="rounded-xl bg-yellow-500/15 border border-yellow-500/40 px-4 py-3 mb-5">
                            <p className="text-xs text-yellow-100 font-medium leading-snug">
                                ⚠️ <strong>Überfall:</strong> Geld herausgeben. Nicht heldenhaft sein. Tresor nicht öffnen.
                            </p>
                        </div>

                        {/* Zone 4: Vorfall erfassen (optional) */}
                        <div className="mb-4">
                            {!showIncident ? (
                                <button
                                    onClick={() => setShowIncident(true)}
                                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/15 text-white/80 font-medium py-3 hover:bg-white/10 transition-all active:scale-95"
                                >
                                    <AlertTriangle className="w-4 h-4" /> Vorfall erfassen (optional)
                                </button>
                            ) : (
                                <IncidentCapture onClose={() => setShowIncident(false)} />
                            )}
                        </div>

                        {/* Schließen-Button */}
                        <button
                            onClick={onClose}
                            className="w-full rounded-xl bg-white/10 border border-white/20 text-white font-bold py-3.5 hover:bg-white/20 transition-all active:scale-95 mt-2"
                        >
                            Schließen
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}