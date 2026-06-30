/**
 * ModuleCenter.jsx — Modulverwaltung für Admins/Manager
 * v3 — kompaktes Redesign: sticky Kategorie-Chips, aktive Module visuell hervorgehoben,
 *      klickbare Cards, Dependency-Badges inline, Statusübersicht im Header
 */

import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
    Package, Users, Calendar, Clock, CheckSquare, Brush,
    RefreshCw, ShoppingCart, Wine, BookOpen, TrendingUp,
    FileText, BarChart2, Wrench, Star, Shield, Settings,
    ChevronRight, Info, Lock, MapPin, ClipboardList, Euro,
    Trophy, Archive, BarChart, QrCode, Banknote, AlertTriangle,
    Zap, CheckCircle2, Circle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/components/auth/usePermissions';
import { toast } from 'sonner';

// ── Modul-Registry ─────────────────────────────────────────────────────────

const MODULE_REGISTRY = [
    // KERN
    {
        id: 'mitarbeiter',
        name: 'Mitarbeiter',
        description: 'Mitarbeiterverwaltung, Personalbogen, Dokumente',
        icon: Users,
        color: 'bg-blue-600',
        category: 'kern',
        page: 'Employees',
        required: true,
        dependents: ['schichten', 'zeiterfassung', 'urlaub', 'onboarding', 'stationsplan'],
    },

    // PLANUNG
    {
        id: 'schichten',
        name: 'Schichtplanung',
        description: 'Schichtplan, Teamkalender, Schichttausch, Analyse',
        icon: Calendar,
        color: 'bg-purple-600',
        category: 'planung',
        page: 'Calendar',
        requires: ['mitarbeiter'],
        dependents: ['zeiterfassung'],
        subpages: ['TeamCalendar', 'ShiftSwaps', 'ShiftAnalytics', 'MyShifts'],
    },
    {
        id: 'zeiterfassung',
        name: 'Zeiterfassung',
        description: 'Stempeluhr, Zeiteinträge, ArbZG-Prüfung',
        icon: Clock,
        color: 'bg-indigo-600',
        category: 'planung',
        page: 'TimeManagement',
        requires: ['mitarbeiter'],
        subpages: ['TimeTracking'],
    },
    {
        id: 'urlaub',
        name: 'Urlaub & Abwesenheit',
        description: 'Urlaubsanträge, Abwesenheitsverwaltung',
        icon: Calendar,
        color: 'bg-sky-600',
        category: 'planung',
        page: 'Vacation',
        requires: ['mitarbeiter'],
    },

    // GÄSTE
    {
        id: 'reservierungen',
        name: 'Reservierungen & Tische',
        description: 'Gästereservierungen, Tischplan, Räume, Warteliste',
        icon: MapPin,
        color: 'bg-green-600',
        category: 'gast',
        page: 'GuestHub',
    },
    {
        id: 'events',
        name: 'Events',
        description: 'Veranstaltungsplanung, Eventideen, Eventvorbereitungen',
        icon: Star,
        color: 'bg-pink-600',
        category: 'gast',
        page: 'Events',
    },
    {
        id: 'businesscard',
        name: 'Digitale Visitenkarte',
        description: 'Digitale Visitenkarte mit QR-Code für Gäste',
        icon: QrCode,
        color: 'bg-teal-600',
        category: 'gast',
        page: 'BusinessCard',
    },

    // BETRIEB
    {
        id: 'aufgaben',
        name: 'Aufgaben & To-Dos',
        description: 'Aufgabenverwaltung, Kategorien, Fälligkeiten',
        icon: CheckSquare,
        color: 'bg-orange-600',
        category: 'betrieb',
        page: 'Todos',
    },
    {
        id: 'reinigung',
        name: 'Reinigung & Hygiene',
        description: 'Putzlisten, Bereiche, Wochenaufgaben, Checklisten',
        icon: Brush,
        color: 'bg-teal-600',
        category: 'betrieb',
        page: 'Cleaning',
        subpages: ['CleaningChecklist', 'WeeklyTasks'],
    },
    {
        id: 'wartung',
        name: 'Wartung & Instandhaltung',
        description: 'Wartungsaufgaben, Reparaturen, Kontakte, Kalender',
        icon: Wrench,
        color: 'bg-slate-600',
        category: 'betrieb',
        page: 'Maintenance',
    },
    {
        id: 'stationsplan',
        name: 'Stationsplan',
        description: 'Stationen zuweisen, Mitarbeiter einplanen',
        icon: MapPin,
        color: 'bg-fuchsia-600',
        category: 'betrieb',
        page: 'Stationsplan',
        requires: ['mitarbeiter'],
    },

    // LAGER
    {
        id: 'artikel',
        name: 'Artikel & Lager',
        description: 'Artikelverwaltung, Bestand, Inventur, Lagerverwaltung',
        icon: Package,
        color: 'bg-zinc-600',
        category: 'lager',
        page: 'Articles',
        dependents: ['rezepte', 'kalkulation', 'auffuellen', 'menu', 'lieferanten'],
        subpages: ['Inventory', 'Storage', 'Warehouse', 'Wastage'],
    },
    {
        id: 'auffuellen',
        name: 'Auffüllen & Restock',
        description: 'Nachfülllisten, Lagerauffüllung, Bestandsänderungen',
        icon: RefreshCw,
        color: 'bg-amber-600',
        category: 'lager',
        page: 'Restock',
        requires: ['artikel'],
    },
    {
        id: 'einkauf',
        name: 'Einkaufsliste',
        description: 'Einkauf, Bestellungen, Lieferantenanfragen',
        icon: ShoppingCart,
        color: 'bg-yellow-600',
        category: 'lager',
        page: 'Shopping',
    },
    {
        id: 'lieferanten',
        name: 'Kontakte & Partner',
        description: 'Lieferanten, Steuerberater, Dienstleister',
        icon: Package,
        color: 'bg-stone-600',
        category: 'lager',
        page: 'Suppliers',
    },

    // KARTE
    {
        id: 'rezepte',
        name: 'Rezepte',
        description: 'Rezeptverwaltung, Zutaten, Allergene, Produktionsmengen',
        icon: BookOpen,
        color: 'bg-rose-600',
        category: 'karte',
        page: 'Recipes',
        requires: ['artikel'],
    },
    {
        id: 'menu',
        name: 'Getränkekarte',
        description: 'Digitale Speisekarte, Public Menu, QR-Code',
        icon: Wine,
        color: 'bg-red-700',
        category: 'karte',
        page: 'DrinkMenu',
        requires: ['artikel'],
    },
    {
        id: 'kalkulation',
        name: 'Preiskalkulation',
        description: 'Getränkekalkulation, Marge, Deckungsbeitrag',
        icon: TrendingUp,
        color: 'bg-emerald-600',
        category: 'karte',
        page: 'PriceCalculator',
        requires: ['artikel'],
        sensitive: true,
    },

    // ANALYTICS
    {
        id: 'analytics',
        name: 'Berichte & Analytik',
        description: 'Tagesabschluss, Umsatzanalyse, Lohnberichte, DATEV',
        icon: BarChart2,
        color: 'bg-violet-600',
        category: 'analytics',
        page: 'DailyAnalysis',
        sensitive: true,
        dependents: ['buchhaltung'],
    },

    // VERWALTUNG
    {
        id: 'buchhaltung',
        name: 'Buchhaltung',
        description: 'Kassenbuch, Belege, Debitoren/Kreditoren, DATEV-Export',
        icon: Euro,
        color: 'bg-emerald-700',
        category: 'verwaltung',
        page: 'AccountingDashboard',
        sensitive: true,
        requires: ['analytics'],
    },
    {
        id: 'dokumente',
        name: 'Dokumente',
        description: 'Dokumentenarchiv, Kategorien, Verträge, Anhänge',
        icon: FileText,
        color: 'bg-cyan-700',
        category: 'verwaltung',
        page: 'Documents',
    },
    {
        id: 'onboarding',
        name: 'Einarbeitung',
        description: 'Onboarding-Checklisten, Aufgaben, Fortschritt',
        icon: Users,
        color: 'bg-lime-600',
        category: 'verwaltung',
        page: 'Onboarding',
        requires: ['mitarbeiter'],
    },
];

const CATEGORIES = {
    kern:        { name: 'Kern',               emoji: '⚙️'  },
    planung:     { name: 'Planung',            emoji: '📅'  },
    gast:        { name: 'Gäste',             emoji: '🪑'  },
    betrieb:     { name: 'Betrieb',           emoji: '🔧'  },
    lager:       { name: 'Lager',             emoji: '📦'  },
    karte:       { name: 'Karte',             emoji: '🍹'  },
    analytics:   { name: 'Analytik',          emoji: '📊'  },
    verwaltung:  { name: 'Verwaltung',        emoji: '📁'  },
};

// ── Modul-State via CompanyInfo ────────────────────────────────────────────

function useModuleState(companyInfo) {
    const queryClient = useQueryClient();

    const getStates = () => {
        try {
            const raw = companyInfo?.module_states;
            return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
        } catch { return {}; }
    };

    const saveMut = useMutation({
        mutationFn: async ({ id: ciId, states }) => {
            await base44.entities.CompanyInfo.update(ciId, { module_states: JSON.stringify(states) });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company-info'] }),
        onError: () => toast.error('Fehler beim Speichern'),
    });

    const setModule = (id, enabled) => {
        if (!companyInfo?.id) { toast.error('Firmendaten nicht geladen'); return; }
        const next = { ...getStates(), [id]: enabled };
        saveMut.mutate({ id: companyInfo.id, states: next });
        toast.success(enabled ? 'Modul aktiviert' : 'Modul deaktiviert');
    };

    const isEnabled = (module) => {
        if (module.required) return true;
        const states = getStates();
        return states[module.id] !== false;
    };

    return { isEnabled, setModule, isSaving: saveMut.isPending };
}

// ── ModuleRow — kompakte Listenzeile ──────────────────────────────────────

function ModuleRow({ module, isEnabled, onToggle, allModules, isSaving, isEnabledFn }) {
    const navigate = useNavigate();
    const Icon = module.icon;

    const requires      = (module.requires   || []).map(id => allModules.find(m => m.id === id)).filter(Boolean);
    const dependents    = (module.dependents || []).map(id => allModules.find(m => m.id === id)).filter(Boolean);
    const activeDeps    = dependents.filter(d => isEnabledFn ? isEnabledFn(d) : false);
    const canDisable    = !module.required && activeDeps.length === 0;
    const missingReqs   = requires.filter(r => isEnabledFn && !isEnabledFn(r));

    const handleRowClick = (e) => {
        // Klick auf Switch oder Button nicht navigieren
        if (e.target.closest('button') || e.target.closest('[role="switch"]')) return;
        if (isEnabled) navigate(createPageUrl(module.page));
    };

    return (
        <div
            onClick={handleRowClick}
            className={cn(
                'flex items-center gap-3 px-4 py-3 transition-all duration-150',
                isEnabled
                    ? 'cursor-pointer hover:bg-secondary/40 active:bg-secondary/60'
                    : 'opacity-50 cursor-default',
            )}
        >
            {/* Icon */}
            <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                module.color,
                !isEnabled && 'grayscale'
            )}>
                <Icon className="w-4 h-4 text-white" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn(
                        'text-sm font-semibold',
                        isEnabled ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                        {module.name}
                    </span>
                    {module.required && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
                            Pflicht
                        </span>
                    )}
                    {module.sensitive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" />Admin
                        </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{module.description}</p>

                {/* Warnungen inline */}
                {isEnabled && activeDeps.length > 0 && (
                    <p className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        Benötigt von: {activeDeps.map(d => d.name).join(', ')}
                    </p>
                )}
                {isEnabled && missingReqs.length > 0 && (
                    <p className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        Benötigt: {missingReqs.map(r => r.name).join(', ')}
                    </p>
                )}
            </div>

            {/* Rechts: Status-Dot + Switch */}
            <div className="flex items-center gap-2 shrink-0">
                {isEnabled && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                )}
                <Switch
                    checked={isEnabled}
                    onCheckedChange={onToggle}
                    disabled={module.required || (!canDisable && isEnabled) || isSaving}
                    className="data-[state=checked]:bg-amber-500"
                />
            </div>
        </div>
    );
}

// ── MAIN ──────────────────────────────────────────────────────────────────

export default function ModuleCenter() {
    const permissions        = usePermissions();
    const [selectedCategory, setSelectedCategory] = useState('alle');
    const chipRef            = useRef(null);

    const { data: companyInfo } = useQuery({
        queryKey: ['company-info'],
        queryFn: async () => {
            const r = await base44.entities.CompanyInfo.list('-last_updated', 1);
            return r?.[0] || null;
        },
        staleTime: STALE.SLOW,
    });

    const { isEnabled, setModule, isSaving } = useModuleState(companyInfo);

    if (!permissions.isManager) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="p-8 max-w-sm text-center border border-border rounded-2xl bg-card">
                    <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <h2 className="text-lg font-bold text-foreground mb-2">Kein Zugriff</h2>
                    <p className="text-sm text-muted-foreground">Nur Manager und Admins können das Modulcenter verwalten.</p>
                </div>
            </div>
        );
    }

    const allCategories = ['alle', ...Object.keys(CATEGORIES)];

    const filtered = selectedCategory === 'alle'
        ? MODULE_REGISTRY
        : MODULE_REGISTRY.filter(m => m.category === selectedCategory);

    // Gruppiert für Sektions-Überschriften
    const grouped = filtered.reduce((acc, m) => {
        if (!acc[m.category]) acc[m.category] = [];
        acc[m.category].push(m);
        return acc;
    }, {});

    const totalActive = MODULE_REGISTRY.filter(m => isEnabled(m)).length;
    const total       = MODULE_REGISTRY.length;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto">

                {/* ── Header ────────────────────────────────────────────── */}
                <div className="px-4 pt-4 pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-foreground">Modulcenter</h1>
                                <p className="text-xs text-muted-foreground">Module aktivieren & verwalten</p>
                            </div>
                        </div>

                        {/* Aktiv-Counter */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border">
                            <CheckCircle2 className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-bold text-foreground">{totalActive}</span>
                            <span className="text-xs text-muted-foreground">/ {total} aktiv</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-500"
                            style={{ width: `${(totalActive / total) * 100}%` }}
                        />
                    </div>
                </div>

                {/* ── Sticky Kategorie Chips ────────────────────────────── */}
                <div
                    ref={chipRef}
                    className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-2"
                >
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                        {allCategories.map(cat => {
                            const info = CATEGORIES[cat];
                            const count = cat === 'alle'
                                ? MODULE_REGISTRY.filter(m => isEnabled(m)).length
                                : MODULE_REGISTRY.filter(m => m.category === cat && isEnabled(m)).length;
                            const catTotal = cat === 'alle'
                                ? MODULE_REGISTRY.length
                                : MODULE_REGISTRY.filter(m => m.category === cat).length;

                            return (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={cn(
                                        'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                                        selectedCategory === cat
                                            ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                            : 'bg-card border-border text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {cat === 'alle' ? '✦' : info?.emoji}
                                    <span>{cat === 'alle' ? 'Alle' : info?.name}</span>
                                    <span className={cn(
                                        'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                                        selectedCategory === cat
                                            ? 'bg-white/20 text-white'
                                            : 'bg-secondary text-muted-foreground'
                                    )}>
                                        {count}/{catTotal}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Modul-Listen ──────────────────────────────────────── */}
                <div className="px-0 pt-2 space-y-3">
                    {Object.entries(grouped).map(([cat, modules]) => (
                        <div key={cat}>
                            {/* Kategorie-Header — nur bei "alle" anzeigen */}
                            {selectedCategory === 'alle' && (
                                <div className="flex items-center gap-2 px-4 py-2 mt-2">
                                    <span className="text-base">{CATEGORIES[cat]?.emoji}</span>
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {CATEGORIES[cat]?.name}
                                    </span>
                                    <div className="flex-1 h-px bg-border" />
                                    <span className="text-xs text-muted-foreground">
                                        {modules.filter(m => isEnabled(m)).length}/{modules.length}
                                    </span>
                                </div>
                            )}

                            {/* Modul-Karte als Liste */}
                            <div className="mx-3 rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/60">
                                {modules.map(module => (
                                    <ModuleRow
                                        key={module.id}
                                        module={module}
                                        isEnabled={isEnabled(module)}
                                        onToggle={(val) => setModule(module.id, val)}
                                        allModules={MODULE_REGISTRY}
                                        isSaving={isSaving}
                                        isEnabledFn={isEnabled}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Footer-Hinweis ─────────────────────────────────────── */}
                <p className="text-xs text-muted-foreground text-center px-4 pt-6 pb-2">
                    Änderungen gelten sofort für alle Nutzer · Tippe auf ein aktives Modul zum Öffnen
                </p>

            </div>
        </div>
    );
}
