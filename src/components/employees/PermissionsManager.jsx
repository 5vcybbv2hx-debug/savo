/**
 * PermissionsManager — Mobile-first, accordion-based granular permissions editor.
 * Grouped by main area → subarea → individual actions.
 * Sensitive permissions are highlighted.
 * Individual overrides override role defaults.
 */
import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Shield, ChevronDown, ChevronUp, AlertTriangle, Search, X, Check,
    Lock, Eye, EyeOff, RotateCcw
} from 'lucide-react';
import { PERMISSION_MATRIX, EMPLOYEE_ROLES } from '@/components/auth/roleConfig';

// ── 3-level permission config ────────────────────────────────────────────────
const PERMISSION_SECTIONS = [
    {
        area: 'Dashboard',
        icon: '🏠',
        subs: [
            { sub: 'Übersicht', perms: [
                { key: 'canViewDashboard', label: 'Dashboard ansehen' },
            ]},
        ]
    },
    {
        area: 'Schichtplan & Kalender',
        icon: '📅',
        subs: [
            { sub: 'Schichten', perms: [
                { key: 'canViewShifts', label: 'Schichtplan ansehen' },
                { key: 'canEditShifts', label: 'Schichten bearbeiten' },
                { key: 'canPlanShifts', label: 'Schnellplanung (Drag & Drop)' },
                { key: 'canDeleteShifts', label: 'Schichten löschen' },
                { key: 'canExportShifts', label: 'Schichten exportieren' },
            ]},
            { sub: 'Tausch & Kalender', perms: [
                { key: 'canRequestShiftSwap', label: 'Tausch anfragen' },
                { key: 'canApproveShiftSwaps', label: 'Tausch genehmigen' },
                { key: 'canViewTeamCalendar', label: 'Teamkalender ansehen' },
            ]},
        ]
    },
    {
        area: 'Reservierungen',
        icon: '📋',
        subs: [
            { sub: 'Reservierungen', perms: [
                { key: 'canViewReservations', label: 'Reservierungen ansehen' },
                { key: 'canCreateReservations', label: 'Reservierungen erstellen' },
                { key: 'canEditReservations', label: 'Reservierungen bearbeiten' },
                { key: 'canDeleteReservations', label: 'Reservierungen löschen' },
            ]},
        ]
    },
    {
        area: 'Events',
        icon: '🎉',
        subs: [
            { sub: 'Events', perms: [
                { key: 'canViewEvents', label: 'Events ansehen' },
                { key: 'canCreateEvents', label: 'Events erstellen' },
                { key: 'canEditEvents', label: 'Events bearbeiten' },
                { key: 'canDeleteEvents', label: 'Events löschen' },
            ]},
            { sub: 'Eventideen', perms: [
                { key: 'canViewEventIdeas', label: 'Eventideen ansehen' },
                { key: 'canEditEventIdeas', label: 'Eventideen bearbeiten' },
            ]},
        ]
    },
    {
        area: 'Lager & Artikel',
        icon: '📦',
        subs: [
            { sub: 'Lagerübersicht', perms: [
                { key: 'canViewWarehouse', label: 'Lager ansehen' },
                { key: 'canViewInventory', label: 'Inventur ansehen' },
                { key: 'canEditInventory', label: 'Inventur bearbeiten' },
            ]},
            { sub: 'Artikel', perms: [
                { key: 'canCreateArticles', label: 'Artikel erstellen' },
                { key: 'canEditArticles', label: 'Artikel bearbeiten' },
                { key: 'canDeleteArticles', label: 'Artikel löschen' },
            ]},
            { sub: 'Preise & Historie', perms: [
                { key: 'canChangeArticlePrices', label: 'Preise ändern', sensitive: true },
                { key: 'canViewPriceHistory', label: 'Preishistorie ansehen' },
            ]},
            { sub: 'Lieferanten & Hersteller', perms: [
                { key: 'canViewSuppliers', label: 'Lieferanten ansehen' },
                { key: 'canEditSuppliers', label: 'Lieferanten bearbeiten', sensitive: true },
                { key: 'canLinkSuppliers', label: 'Lieferanten verknüpfen' },
            ]},
        ]
    },
    {
        area: 'Einkauf & Auffüllen',
        icon: '🛒',
        subs: [
            { sub: 'Einkaufsliste', perms: [
                { key: 'canViewShopping', label: 'Einkaufsliste ansehen' },
                { key: 'canEditShopping', label: 'Einkaufsliste bearbeiten' },
            ]},
            { sub: 'Auffüllen', perms: [
                { key: 'canViewRestock', label: 'Auffüllen ansehen' },
                { key: 'canEditRestock', label: 'Auffüllen bearbeiten' },
            ]},
        ]
    },
    {
        area: 'Reinigung',
        icon: '🧹',
        subs: [
            { sub: 'Putzliste', perms: [
                { key: 'canViewCleaning', label: 'Putzliste ansehen' },
                { key: 'canEditCleaning', label: 'Aufgaben abhaken / bearbeiten' },
                { key: 'canDeleteCleaning', label: 'Aufgaben löschen' },
                { key: 'canManageCleaningAreas', label: 'Bereiche verwalten', sensitive: true },
            ]},
        ]
    },
    {
        area: 'Aufgaben',
        icon: '✅',
        subs: [
            { sub: 'Aufgaben', perms: [
                { key: 'canViewTodos', label: 'Aufgaben ansehen' },
                { key: 'canViewAllTodos', label: 'Alle Aufgaben ansehen (teamweit)' },
                { key: 'canCreateTodos', label: 'Aufgaben erstellen' },
                { key: 'canEditTodos', label: 'Aufgaben bearbeiten' },
                { key: 'canDeleteTodos', label: 'Aufgaben löschen' },
                { key: 'canAssignTodos', label: 'Aufgaben zuweisen' },
            ]},
        ]
    },
    {
        area: 'Team-Notizen',
        icon: '📝',
        subs: [
            { sub: 'Notizen', perms: [
                { key: 'canViewTeamNotes', label: 'Notizen ansehen' },
                { key: 'canViewManagerNotes', label: 'Manager-Notizen sehen', sensitive: true },
                { key: 'canCreateTeamNotes', label: 'Notizen erstellen' },
                { key: 'canEditTeamNotes', label: 'Notizen bearbeiten' },
                { key: 'canDeleteTeamNotes', label: 'Notizen löschen' },
                { key: 'canPinTeamNotes', label: 'Notizen anpinnen' },
            ]},
        ]
    },
    {
        area: 'Mitarbeiter',
        icon: '👥',
        subs: [
            { sub: 'Übersicht', perms: [
                { key: 'canViewEmployees', label: 'Mitarbeiter ansehen' },
                { key: 'canViewEmployeeDetails', label: 'Stammdaten / IBAN / Steuerdaten', sensitive: true },
                { key: 'canViewEmployeeHistory', label: 'Änderungshistorie ansehen' },
            ]},
            { sub: 'Bearbeitung', perms: [
                { key: 'canEditEmployees', label: 'Mitarbeiter bearbeiten', sensitive: true },
                { key: 'canEditEmployeeShortName', label: 'Kurzname ändern', sensitive: true },
                { key: 'canEditEmployeePermissions', label: 'Berechtigungen ändern', sensitive: true },
            ]},
        ]
    },
    {
        area: 'Rezepte & Getränkekarte',
        icon: '🍸',
        subs: [
            { sub: 'Rezepte', perms: [
                { key: 'canViewRecipes', label: 'Rezepte ansehen' },
                { key: 'canCreateRecipes', label: 'Rezepte erstellen' },
                { key: 'canEditRecipes', label: 'Rezepte bearbeiten' },
                { key: 'canDeleteRecipes', label: 'Rezepte löschen' },
            ]},
            { sub: 'Getränkekarte', perms: [
                { key: 'canViewDrinkMenu', label: 'Getränkekarte ansehen' },
                { key: 'canEditDrinkMenu', label: 'Getränkekarte bearbeiten' },
            ]},
        ]
    },
    {
        area: 'Zeiterfassung',
        icon: '⏱️',
        subs: [
            { sub: 'Eigene Zeiten', perms: [
                { key: 'canViewOwnTimeEntries', label: 'Eigene Zeiten ansehen' },
            ]},
            { sub: 'Team-Zeiten (Manager)', perms: [
                { key: 'canViewTeamTimeEntries', label: 'Team-Zeiten ansehen' },
                { key: 'canApproveTimeEntries', label: 'Zeiten genehmigen', sensitive: true },
                { key: 'canCorrectTimeEntries', label: 'Zeiten korrigieren', sensitive: true },
                { key: 'canClockOutOthers', label: 'Andere ausstempeln', sensitive: true },
                { key: 'canBulkClockIn', label: 'Sammel-Aufstempeln', sensitive: true },
            ]},
        ]
    },
    {
        area: 'Auswertungen & Berichte',
        icon: '📊',
        subs: [
            { sub: 'Analytics', perms: [
                { key: 'canViewAnalytics', label: 'Berichte & Analytics ansehen' },
                { key: 'canExportReports', label: 'Berichte exportieren' },
                { key: 'canViewWastage', label: 'Schwund ansehen' },
                { key: 'canEditWastage', label: 'Schwund bearbeiten' },
                { key: 'canViewAuditLog', label: 'Audit-Log ansehen' },
            ]},
        ]
    },
    {
        area: 'Einstellungen',
        icon: '⚙️',
        subs: [
            { sub: 'System', perms: [
                { key: 'canViewSettings', label: 'Einstellungen ansehen' },
                { key: 'canEditSettings', label: 'Einstellungen ändern', sensitive: true },
                { key: 'canViewOnboarding', label: 'Onboarding ansehen' },
            ]},
        ]
    },
];

// ── Role default preview helper ───────────────────────────────────────────────
function getRoleDefault(permKey, employeeRole) {
    if (!employeeRole) return false;
    const rule = PERMISSION_MATRIX[permKey];
    if (!rule) return false;
    if (rule.adminOnly) return false;
    return rule.roles.includes(employeeRole);
}

// ── SubSection component ──────────────────────────────────────────────────────
function SubSection({ sub, perms, permissions, employeeRole, onToggle, searchQuery }) {
    const filteredPerms = searchQuery
        ? perms.filter(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : perms;

    if (filteredPerms.length === 0) return null;

    return (
        <div className="space-y-1">
            <p className="text-[13.5px] font-medium text-foreground tracking-tight px-1 pt-2">{sub}</p>
            {filteredPerms.map(perm => {
                const override = permissions[perm.key];
                const roleDefault = getRoleDefault(perm.key, employeeRole);
                const effective = typeof override === 'boolean' ? override : roleDefault;
                const isOverridden = typeof override === 'boolean';
                const isSensitive = perm.sensitive || PERMISSION_MATRIX[perm.key]?.sensitive;

                return (
                    <div
                        key={perm.key}
                        className={cn(
                            'flex items-center justify-between px-3 py-3 rounded-xl min-h-[52px] transition-colors',
                            effective ? 'bg-secondary/60' : 'bg-transparent',
                            isOverridden && 'ring-1 ring-inset ring-amber-500/40'
                        )}
                    >
                        <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
                            {isSensitive && (
                                <Lock className="w-3 h-3 text-red-400 shrink-0" />
                            )}
                            <span className={cn(
                                'text-sm leading-tight',
                                effective ? 'text-foreground' : 'text-muted-foreground',
                            )}>
                                {perm.label}
                            </span>
                            {isOverridden && (
                                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-300 border-amber-500/30 shrink-0">
                                    individuell
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {isOverridden && (
                                <button
                                    onClick={() => onToggle(perm.key, undefined)}
                                    title="Override entfernen (Rollen-Standard wiederherstellen)"
                                    className="text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <Switch
                                checked={effective}
                                onCheckedChange={(val) => onToggle(perm.key, val)}
                                className={cn(isSensitive && effective && 'data-[state=checked]:bg-red-600')}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Area accordion ────────────────────────────────────────────────────────────
function AreaAccordion({ section, permissions, employeeRole, onToggle, searchQuery, defaultOpen }) {
    const [open, setOpen] = useState(defaultOpen || false);

    // Count active perms in this area
    const allPerms = section.subs.flatMap(s => s.perms);
    const activeCount = allPerms.filter(p => {
        const override = permissions[p.key];
        const roleDefault = getRoleDefault(p.key, employeeRole);
        return typeof override === 'boolean' ? override : roleDefault;
    }).length;

    const hasSearch = !!searchQuery;
    const matchingPerms = hasSearch
        ? allPerms.filter(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : allPerms;

    if (hasSearch && matchingPerms.length === 0) return null;

    const isOpen = hasSearch ? true : open;

    return (
        <div className="rounded-xl border border-border overflow-hidden">
            {/* Area header */}
            <button
                onClick={() => !hasSearch && setOpen(v => !v)}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-card hover:bg-accent/30 transition-colors min-h-[56px]"
            >
                <span className="text-lg">{section.icon}</span>
                <span className="text-sm font-semibold text-foreground flex-1 text-left">{section.area}</span>
                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                    {activeCount}/{allPerms.length}
                </Badge>
                {!hasSearch && (
                    isOpen
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
            </button>

            {/* Area content */}
            {isOpen && (
                <div className="px-3 pb-3 bg-card/50 border-t border-border space-y-1 divide-y divide-border/30">
                    {section.subs.map(sub => (
                        <SubSection
                            key={sub.sub}
                            sub={sub.sub}
                            perms={sub.perms}
                            permissions={permissions}
                            employeeRole={employeeRole}
                            onToggle={onToggle}
                            searchQuery={searchQuery}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PermissionsManager({ employee, onSave }) {
    const [open, setOpen] = useState(false);
    const [permissions, setPermissions] = useState(employee?.permissions || {});
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);

    const overrideCount = Object.keys(permissions).filter(k => typeof permissions[k] === 'boolean').length;

    const handleToggle = (key, value) => {
        setPermissions(prev => {
            const next = { ...prev };
            if (value === undefined) {
                delete next[key]; // remove override → use role default
            } else {
                next[key] = value;
            }
            return next;
        });
    };

    const handleSave = () => {
        setSaving(true);
        onSave(permissions);
        setTimeout(() => {
            setSaving(false);
            setOpen(false);
        }, 300);
    };

    const handleReset = () => {
        setPermissions({});
    };

    if (!open) {
        return (
            <Button
                variant="outline"
                size="sm"
                onClick={() => {
                    setPermissions(employee?.permissions || {});
                    setOpen(true);
                }}
                className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 gap-2"
            >
                <Shield className="w-4 h-4" />
                Berechtigungen
                {overrideCount > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] px-1.5">
                        {overrideCount}
                    </Badge>
                )}
            </Button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

            {/* Sheet — full-screen on mobile, max-width on desktop */}
            <div className="relative z-10 w-full max-w-lg mx-auto mt-auto sm:my-auto bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-border shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-foreground truncate">Berechtigungen</h2>
                        <p className="text-xs text-muted-foreground truncate">{employee?.name} · Rolle: {employee?.role}</p>
                    </div>
                    <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Info banner */}
                <div className="mx-4 mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300">
                        Individuelle Overrides überschreiben den Rollen-Standard. <span className="text-amber-300">Amber</span> = individuell gesetzt. <Lock className="w-2.5 h-2.5 inline text-red-400" /> = sensibles Recht.
                    </p>
                </div>

                {/* Search */}
                <div className="px-4 pt-3 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Berechtigung suchen..."
                            className="w-full h-10 pl-9 pr-9 rounded-xl border border-input bg-transparent text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats bar */}
                <div className="flex items-center gap-3 px-4 py-2 shrink-0">
                    <p className="text-xs text-muted-foreground flex-1">
                        {overrideCount > 0
                            ? <><span className="text-amber-400 font-medium">{overrideCount} individuelle Overrides</span> aktiv</>
                            : 'Keine individuellen Overrides — Rollen-Standard gilt'}
                    </p>
                    {overrideCount > 0 && (
                        <button
                            onClick={handleReset}
                            className="text-xs text-muted-foreground hover:text-red-400 flex items-center gap-1 min-h-[44px]"
                        >
                            <RotateCcw className="w-3 h-3" />Alle zurücksetzen
                        </button>
                    )}
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-2">
                    {PERMISSION_SECTIONS.map((section, idx) => (
                        <AreaAccordion
                            key={section.area}
                            section={section}
                            permissions={permissions}
                            employeeRole={employee?.role}
                            onToggle={handleToggle}
                            searchQuery={searchQuery}
                            defaultOpen={idx === 0}
                        />
                    ))}
                </div>

                {/* Footer actions */}
                <div className="flex gap-3 px-4 py-4 border-t border-border shrink-0">
                    <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 h-12">
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2"
                    >
                        <Check className="w-4 h-4" />
                        Speichern
                    </Button>
                </div>
            </div>
        </div>
    );
}