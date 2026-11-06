import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw, Save, Check, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Theme Presets ────────────────────────────────────────────────────────────
export const THEME_PRESETS = [
    {
        key: 'teal',
        name: 'Teal Modern',
        emoji: '🌊',
        desc: 'Modern & frisch',
        from: '#22d3ee', via: '#06b6d4', fg: '#0a1a1f',
        vars: {
            '--primary':             '187 92% 50%',
            '--ring':                '187 92% 50%',
            '--background':          '200 15% 6%',
            '--card':                '200 12% 9%',
            '--popover':             '200 12% 9%',
            '--secondary':           '190 10% 13%',
            '--muted':               '190 10% 13%',
            '--accent':              '190 10% 16%',
            '--border':              '190 8% 16%',
            '--input':               '190 8% 14%',
        }
    },
    {
        key: 'amber',
        name: 'Warm Amber',
        emoji: '🔥',
        desc: 'Klassisch warm',
        from: '#f59e0b', via: '#f97316', fg: '#1a0a00',
        vars: {
            '--primary':             '38 92% 50%',
            '--ring':                '38 92% 50%',
            '--background':          '20 10% 6%',
            '--card':                '20 10% 9%',
            '--popover':             '20 10% 9%',
            '--secondary':           '20 8% 13%',
            '--muted':               '20 8% 13%',
            '--accent':              '20 8% 16%',
            '--border':              '20 8% 16%',
            '--input':               '20 8% 14%',
        }
    },
    {
        key: 'wine',
        name: 'Weinrot Lounge',
        emoji: '🍷',
        desc: 'Edel & exklusiv',
        from: '#9f1239', via: '#7f1d1d', fg: '#ffe4e6',
        vars: {
            '--primary':             '346 77% 35%',
            '--ring':                '346 77% 35%',
            '--background':          '340 30% 6%',
            '--card':                '340 20% 10%',
            '--popover':             '340 20% 10%',
            '--secondary':           '340 15% 14%',
            '--muted':               '340 15% 14%',
            '--accent':              '340 15% 17%',
            '--border':              '340 15% 17%',
            '--input':               '340 15% 13%',
        }
    },
    {
        key: 'blue',
        name: 'Modern Blau',
        emoji: '💎',
        desc: 'Clean & modern',
        from: '#2563eb', via: '#1d4ed8', fg: '#dbeafe',
        vars: {
            '--primary':             '217 91% 55%',
            '--ring':                '217 91% 55%',
            '--background':          '222 47% 6%',
            '--card':                '220 35% 10%',
            '--popover':             '220 35% 10%',
            '--secondary':           '220 28% 14%',
            '--muted':               '220 28% 14%',
            '--accent':              '220 28% 17%',
            '--border':              '220 28% 17%',
            '--input':               '220 28% 13%',
        }
    },
    {
        key: 'green',
        name: 'Irish Pub',
        emoji: '🍀',
        desc: 'Traditionell',
        from: '#16a34a', via: '#15803d', fg: '#dcfce7',
        vars: {
            '--primary':             '142 71% 40%',
            '--ring':                '142 71% 40%',
            '--background':          '150 30% 5%',
            '--card':                '150 20% 9%',
            '--popover':             '150 20% 9%',
            '--secondary':           '150 15% 13%',
            '--muted':               '150 15% 13%',
            '--accent':              '150 15% 16%',
            '--border':              '150 15% 16%',
            '--input':               '150 15% 12%',
        }
    },
    {
        key: 'violet',
        name: 'Neon Club',
        emoji: '⚡',
        desc: 'Party & Club',
        from: '#7c3aed', via: '#6d28d9', fg: '#ede9fe',
        vars: {
            '--primary':             '262 83% 58%',
            '--ring':                '262 83% 58%',
            '--background':          '260 40% 6%',
            '--card':                '260 28% 10%',
            '--popover':             '260 28% 10%',
            '--secondary':           '260 22% 14%',
            '--muted':               '260 22% 14%',
            '--accent':              '260 22% 17%',
            '--border':              '260 22% 17%',
            '--input':               '260 22% 13%',
        }
    },
    {
        key: 'rose',
        name: 'Cocktail Bar',
        emoji: '🍸',
        desc: 'Trendig & frisch',
        from: '#e11d48', via: '#be123c', fg: '#ffe4e6',
        vars: {
            '--primary':             '346 87% 50%',
            '--ring':                '346 87% 50%',
            '--background':          '350 30% 6%',
            '--card':                '350 20% 10%',
            '--popover':             '350 20% 10%',
            '--secondary':           '350 15% 14%',
            '--muted':               '350 15% 14%',
            '--accent':              '350 15% 17%',
            '--border':              '350 15% 17%',
            '--input':               '350 15% 13%',
        }
    },
    {
        key: 'cyan',
        name: 'Bistro Fresh',
        emoji: '🌊',
        desc: 'Modern & frisch',
        from: '#0891b2', via: '#0e7490', fg: '#cffafe',
        vars: {
            '--primary':             '192 82% 38%',
            '--ring':                '192 82% 38%',
            '--background':          '200 40% 6%',
            '--card':                '200 28% 10%',
            '--popover':             '200 28% 10%',
            '--secondary':           '200 22% 14%',
            '--muted':               '200 22% 14%',
            '--accent':              '200 22% 17%',
            '--border':              '200 22% 17%',
            '--input':               '200 22% 13%',
        }
    },
    {
        key: 'slate',
        name: 'Elegant Dunkel',
        emoji: '🖤',
        desc: 'Minimalistisch',
        from: '#475569', via: '#334155', fg: '#f1f5f9',
        vars: {
            '--primary':             '215 25% 40%',
            '--ring':                '215 25% 40%',
            '--background':          '222 47% 5%',
            '--card':                '220 20% 9%',
            '--popover':             '220 20% 9%',
            '--secondary':           '220 15% 13%',
            '--muted':               '220 15% 13%',
            '--accent':              '220 15% 16%',
            '--border':              '220 15% 16%',
            '--input':               '220 15% 12%',
        }
    },
];

// ─── Apply theme to CSS variables ─────────────────────────────────────────────
export function applyThemePreset(preset) {
    const root = document.documentElement;

    // Apply all vars from the preset.vars map
    if (preset.vars) {
        Object.entries(preset.vars).forEach(([key, val]) => {
            root.style.setProperty(key, val);
        });
    }
    root.style.setProperty('--primary-foreground', '190 30% 8%');

    // Brand gradient vars (used by Layout and all inline style brand refs)
    root.style.setProperty('--brand-from', preset.from);
    root.style.setProperty('--brand-via', preset.via);
    root.style.setProperty('--brand-fg', preset.fg);

    // Update PWA theme color
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.name = 'theme-color';
        document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', preset.from);

    // ─── Comprehensive brand CSS override ───────────────────────────────────────
    // Replaces ALL hardcoded amber/orange/brand Tailwind classes app-wide
    injectStyle('brand-overrides', `
        /* ── Gradient utilities ── */
        .from-status-warn, .from-status-warn, .from-status-warn,
        .from-status-warn, .from-status-warn {
            --tw-gradient-from: ${preset.from} !important;
        }
        .via-status-warn, .via-status-warn, .via-status-warn, .via-status-warn {
            --tw-gradient-via: ${preset.via} !important;
        }
        .to-status-warn, .to-status-warn, .to-status-warn, .to-status-warn {
            --tw-gradient-to: ${preset.via} !important;
        }

        /* ── Background colors ── */
        .bg-status-warn/70, .bg-status-warn/70, .bg-status-warn/70, .bg-status-warn/70,
        .bg-status-warn/70, .bg-status-warn/70 {
            background-color: ${preset.from} !important;
        }
        .bg-status-warn/70\/10, .bg-status-warn/70\/20 { background-color: ${preset.from}1a !important; }
        .bg-status-warn/70\/5  { background-color: ${preset.from}0d !important; }
        .bg-status-warn/70\/20 { background-color: ${preset.from}33 !important; }
        .bg-status-warn/70\/10 { background-color: ${preset.from}1a !important; }
        .bg-status-warn/70\/30, .bg-status-warn/70\/20 { background-color: ${preset.from}22 !important; }
        .bg-status-warn/70\/10 { background-color: ${preset.via}1a !important; }

        /* ── Text colors ── */
        .text-status-warn, .text-status-warn, .text-status-warn,
        .text-status-warn, .text-status-warn {
            color: ${preset.from} !important;
        }
        .text-status-warn/25 { color: ${preset.from}cc !important; }

        /* ── Border colors ── */
        .border-status-warn/70, .border-status-warn/70, .border-status-warn/70,
        .border-status-warn/70, .border-status-warn/70 {
            border-color: ${preset.from} !important;
        }
        .border-status-warn/70\/20 { border-color: ${preset.from}33 !important; }
        .border-status-warn/70\/30 { border-color: ${preset.from}4d !important; }
        .border-status-warn/70\/30 { border-color: ${preset.from}4d !important; }
        .border-status-warn/70 { border-color: ${preset.from}99 !important; }

        /* ── Hover backgrounds ── */
        .hover\:bg-status-warn/70:hover, .hover\:bg-status-warn/70:hover {
            background-color: ${preset.via} !important;
        }
        .hover\:bg-status-warn/70\/10:hover { background-color: ${preset.from}1a !important; }
        .hover\:border-status-warn/70:hover { border-color: ${preset.from} !important; }
        .hover\:text-status-warn/25:hover, .hover\:text-status-warn:hover { color: ${preset.from} !important; }

        /* ── Gradient backgrounds ── */
        .bg-gradient-to-r.from-status-warn,
        .bg-gradient-to-br.from-status-warn {
            background: linear-gradient(to right, ${preset.from}, ${preset.via}) !important;
            color: ${preset.fg} !important;
        }
        .bg-gradient-to-r.from-status-warn.to-status-warn {
            background: linear-gradient(to right, ${preset.from}, ${preset.via}) !important;
        }

        /* ── Shadow colors ── */
        .shadow-amber-500\/20 { --tw-shadow-color: ${preset.from}33 !important; }
        .shadow-amber-500\/40 { --tw-shadow-color: ${preset.from}66 !important; }

        /* ── Ring colors ── */
        .ring-status-warn/70\/30 { --tw-ring-color: ${preset.from}4d !important; }
        .ring-2.ring-inset.ring-status-warn/70\/30 { --tw-ring-color: ${preset.from}4d !important; }

        /* ── Tabs: active state ── */
        [role="tab"][data-state="active"],
        [data-state="active"][role="tab"] {
            background-color: ${preset.from} !important;
            color: ${preset.fg} !important;
        }
        .data-\[state\=active\]\:bg-status-warn/70[data-state="active"] {
            background-color: ${preset.from} !important;
            color: ${preset.fg} !important;
        }

        /* ── Buttons with brand bg ── */
        .bg-status-warn/70 { background-color: ${preset.from} !important; color: ${preset.fg} !important; }
        .bg-status-warn/70.hover\:bg-status-warn/70:hover { background-color: ${preset.via} !important; }

        /* ── Primary button (uses --primary HSL) ── */
        .bg-primary { background: linear-gradient(135deg, ${preset.from}, ${preset.via}) !important; color: ${preset.fg} !important; }
        .hover\:bg-primary\/90:hover { background: linear-gradient(135deg, ${preset.via}, ${preset.from}) !important; }

        /* ── Active nav & mobile states ── */
        [class*="text-amber-"] { color: ${preset.from} !important; }

        /* ── Focus & ring ── */
        :focus-visible { outline-color: ${preset.from} !important; }
        input:focus, textarea:focus, select:focus {
            border-color: ${preset.from} !important;
            box-shadow: 0 0 0 2px ${preset.from}33 !important;
        }

        /* ── Checkbox & Switch checked ── */
        [data-state="checked"] {
            background-color: ${preset.from} !important;
            border-color: ${preset.from} !important;
        }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar-thumb { background: ${preset.from}55 !important; }
        ::-webkit-scrollbar-thumb:hover { background: ${preset.from} !important; }

        /* ── Progress bars ── */
        .bg-status-warn/70, .bg-status-warn/70 { background-color: ${preset.from} !important; }

        /* ── Dot indicators ── */
        .bg-status-warn/70.rounded-full, .w-2.h-2.bg-status-warn/70 { background-color: ${preset.from} !important; }

        /* ── Gradient cards / panels ── */
        .from-status-warn\/10 { --tw-gradient-from: ${preset.from}1a !important; }
        .to-status-warn\/10, .to-status-warn\/20 { --tw-gradient-to: ${preset.via}1a !important; }
        .from-status-warn\/30 { --tw-gradient-from: ${preset.from}33 !important; }
        .to-status-warn\/20 { --tw-gradient-to: ${preset.via}22 !important; }
    `);
}

function injectStyle(id, css) {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
    el.textContent = css;
}

function hexToHsl(hex) {
    // Returns "H S% L%" format for CSS vars — simplified passthrough for known values
    // If the fg is already an HSL-ish value we just return it; otherwise return a neutral
    return '210 40% 98%'; // safe light foreground fallback
}

// ─── Load saved theme on app start ───────────────────────────────────────────
export async function loadSavedColors() {
    try {
        const companies = await base44.entities.CompanyInfo.list();
        const raw = companies[0];
        const info = raw?.data ? raw.data : raw;
        const key = info?.theme_preset_key || 'teal';
        const preset = THEME_PRESETS.find(p => p.key === key) || THEME_PRESETS[0];
        applyThemePreset(preset);
    } catch (_) {
        // fallback: apply teal
        const teal = THEME_PRESETS.find(p => p.key === 'teal');
        if (teal) applyThemePreset(teal);
    }
}

// ─── Mini preview component ───────────────────────────────────────────────────
function ThemePreview({ preset }) {
    const bg = preset.vars?.['--background'] || '200 15% 6%';
    const card = preset.vars?.['--card'] || '200 12% 9%';
    return (
        <div className="rounded-xl overflow-hidden border border-border/50" style={{ background: `hsl(${bg})` }}>
            <div className="flex gap-2 p-3 items-center" style={{ background: `hsl(${card})` }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.via})`, color: preset.fg }}>
                    B
                </div>
                <div className="flex gap-1.5">
                    <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                        style={{ background: `linear-gradient(to right, ${preset.from}, ${preset.via})`, color: preset.fg }}>
                        Dashboard
                    </div>
                    <div className="px-2.5 py-1 rounded-lg text-[10px] text-white/50"
                        style={{ background: `hsl(${card})` }}>
                        Kalender
                    </div>
                </div>
            </div>
            <div className="p-3 space-y-2" style={{ background: `hsl(${bg})` }}>
                <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                        style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.via})`, color: preset.fg }}>
                        Speichern
                    </button>
                    <button className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-white/20 text-white/70"
                        style={{ background: `hsl(${card})` }}>
                        Abbrechen
                    </button>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: `${preset.from}33`, color: preset.from, border: `1px solid ${preset.from}55` }}>
                        Badge
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] text-white/60 border border-white/15"
                        style={{ background: `hsl(${card})` }}>
                        Inaktiv
                    </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `hsl(${card})` }}>
                    <div className="h-full w-2/3 rounded-full"
                        style={{ background: `linear-gradient(to right, ${preset.from}, ${preset.via})` }} />
                </div>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ColorCustomizer() {
    const queryClient = useQueryClient();
    const [selected, setSelected] = useState('teal');
    const [previewKey, setPreviewKey] = useState('teal');

    const { data: companyList } = useQuery({
        queryKey: ['company-info'],
        queryFn: () => base44.entities.CompanyInfo.list(),
    });

    const rawCompany = companyList?.[0];
    const company = rawCompany?.data ? { ...rawCompany.data, id: rawCompany.id } : rawCompany;

    useEffect(() => {
        if (company?.theme_preset_key) {
            setSelected(company.theme_preset_key);
            setPreviewKey(company.theme_preset_key);
        }
    }, [company]);

    const saveMutation = useMutation({
        mutationFn: async (key) => {
            if (!company?.id) throw new Error('Keine Firmendaten gefunden');
            return base44.entities.CompanyInfo.update(company.id, { theme_preset_key: key });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['company-info'] });
            toast.success('Theme gespeichert – gilt für alle Mitarbeiter');
        },
    });

    const handleSelect = (preset) => {
        setSelected(preset.key);
        setPreviewKey(preset.key);
        applyThemePreset(preset); // Live preview
    };

    const handleSave = () => {
        saveMutation.mutate(selected);
    };

    const handleReset = () => {
        const def = THEME_PRESETS.find(p => p.key === 'teal') || THEME_PRESETS[0];
        setSelected(def.key);
        setPreviewKey(def.key);
        applyThemePreset(def);
        saveMutation.mutate(def.key);
    };

    const currentPreset = THEME_PRESETS.find(p => p.key === previewKey) || THEME_PRESETS[0];

    return (
        <div className="space-y-6">
            {/* Preset Grid */}
            <div>
                <Label className="text-sm font-semibold text-foreground mb-1 block">Branding-Theme wählen</Label>
                <p className="text-xs text-muted-foreground mb-4">
                    Wähle ein Farbthema passend zu deinem Betrieb. Ändert sich sofort als Vorschau.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {THEME_PRESETS.map((preset) => {
                        const isActive = selected === preset.key;
                        return (
                            <button
                                key={preset.key}
                                onClick={() => handleSelect(preset)}
                                className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all min-h-[80px] ${
                                    isActive
                                        ? 'border-white/40 scale-105 shadow-lg'
                                        : 'border-border hover:border-white/20'
                                }`}
                                style={{ background: `hsl(${preset.card})` }}
                            >
                                {/* Color swatch */}
                                <div className="w-10 h-10 rounded-full shadow-md relative"
                                    style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.via})` }}>
                                    {isActive && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Check className="w-5 h-5" style={{ color: preset.fg }} />
                                        </div>
                                    )}
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-semibold text-foreground leading-tight">{preset.emoji} {preset.name}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{preset.desc}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Live Preview */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold text-foreground">Vorschau: {currentPreset.emoji} {currentPreset.name}</Label>
                </div>
                <ThemePreview preset={currentPreset} />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-border">
                <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="gap-2 flex-1 sm:flex-none"
                >
                    <Save className="w-4 h-4" />
                    {saveMutation.isPending ? 'Speichern...' : 'Für alle speichern'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Zurücksetzen
                </Button>
            </div>
        </div>
    );
}