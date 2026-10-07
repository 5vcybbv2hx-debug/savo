import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_REGISTRY, STANDARD_ROLES, PERMISSION_LEVELS } from '@/lib/permissionRegistry';
import { PERMISSION_MATRIX, EMPLOYEE_ROLES } from '@/components/auth/roleConfig';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import {
  Search, ChevronDown, ChevronUp, Save, RotateCcw,
  User, Shield, SlidersHorizontal, Check, X, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Hilfsfunktion: wie viele Sections hat ein MA Zugriff auf? ──────────────────
function getAccessSummary(empPermissions = {}) {
  const allKeys = Object.values(PERMISSION_REGISTRY).flatMap(p =>
    Object.values(p.sections || {}).map(s => s.key)
  );
  const total = allKeys.length;
  const active = allKeys.filter(k => empPermissions[k] && empPermissions[k] !== 'none').length;
  return { active, total };
}

// ── Welche Rolle passt am besten? ─────────────────────────────────────────────
function detectRole(empPermissions = {}) {
  if (!empPermissions || Object.keys(empPermissions).length === 0) return null;
  for (const [key, role] of Object.entries(STANDARD_ROLES)) {
    const rolePerms = role.permissions || {};
    const roleKeys = Object.keys(rolePerms);
    if (roleKeys.length === 0) continue;
    const match = roleKeys.filter(k => empPermissions[k] === rolePerms[k]).length;
    if (match / roleKeys.length > 0.85) return role.displayName;
  }
  return 'Individuell';
}

// ── Badge-Farbe je Zugriffsgrad ───────────────────────────────────────────────
function AccessBadge({ level }) {
  if (!level || level === 'none') return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">–</span>
  );
  if (level === 'view') return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500 font-medium">Lesen</span>
  );
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-medium">Voll</span>
  );
}

// ── Toggle-Buttons für einen Permission-Key ───────────────────────────────────
function PermToggle({ permKey, value, onChange, actions }) {
  const levels = ['none', ...(actions || ['view', 'edit'])];
  return (
    <div className="flex gap-1">
      {levels.includes('none') && (
        <button
          onClick={() => onChange(permKey, 'none')}
          className={cn(
            'px-2 py-1 rounded text-[10px] font-medium transition-all min-h-[28px]',
            (!value || value === 'none')
              ? 'bg-muted text-muted-foreground ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted/60'
          )}
        >–</button>
      )}
      {levels.includes('view') && (
        <button
          onClick={() => onChange(permKey, 'view')}
          className={cn(
            'px-2 py-1 rounded text-[10px] font-medium transition-all min-h-[28px]',
            value === 'view'
              ? 'bg-blue-500/20 text-blue-500 ring-1 ring-blue-500/40'
              : 'text-muted-foreground hover:bg-muted/60'
          )}
        >Lesen</button>
      )}
      {levels.includes('edit') && (
        <button
          onClick={() => onChange(permKey, 'edit')}
          className={cn(
            'px-2 py-1 rounded text-[10px] font-medium transition-all min-h-[28px]',
            value === 'edit'
              ? 'bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/40'
              : 'text-muted-foreground hover:bg-muted/60'
          )}
        >Voll</button>
      )}
    </div>
  );
}

export default function PermissionsNew() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [expandedCats, setExpandedCats] = useState({});
  const [localPermissions, setLocalPermissions] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // ──── Queries ────────────────────────────────────────────────────────────────
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }),
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const filteredEmployees = useMemo(
    () => {
      const q = debouncedSearch.toLowerCase();
      return employees.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q)
      );
    },
    [employees, debouncedSearch]
  );

  // ──── Mutation ────────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ employeeId, permissions }) => {
      await base44.entities.Employee.update(employeeId, { permissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setHasChanges(false);
      toast.success('Berechtigungen gespeichert');
    },
    onError: (err) => {
      toast.error('Fehler: ' + err.message);
    },
  });

  // ──── Handlers ───────────────────────────────────────────────────────────────
  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    setLocalPermissions(emp.permissions || {});
    setHasChanges(false);
    setAdvancedMode(false);
    setSheetOpen(true);
  };

  const handlePermissionChange = (key, level) => {
    const newPerms = { ...localPermissions };
    if (level === 'none') delete newPerms[key];
    else newPerms[key] = level;
    setLocalPermissions(newPerms);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!selectedEmployee) return;
    updateMutation.mutate({ employeeId: selectedEmployee.id, permissions: localPermissions });
  };

  const handleReset = () => {
    setLocalPermissions(selectedEmployee?.permissions || {});
    setHasChanges(false);
  };

  const handleApplyRole = (roleKey) => {
    const role = STANDARD_ROLES[roleKey];
    if (role) {
      setLocalPermissions({ ...role.permissions });
      setHasChanges(true);
      toast.success(`Rolle "${role.displayName}" angewendet`);
    }
  };

  const handleCopyFrom = (sourceId) => {
    const emp = employees.find(e => e.id === sourceId);
    if (emp) {
      setLocalPermissions({ ...(emp.permissions || {}) });
      setHasChanges(true);
      toast.success(`Kopiert von ${emp.name}`);
    }
  };

  // ── Auf Rollenstandard zurücksetzen ──────────────────────────────────────────
  // Berechnet die korrekten Permissions aus der roleConfig Matrix (can-keys)
  // und löscht alle falschen customPerms-Overrides
  const handleResetToRoleDefault = () => {
    if (!selectedEmployee) return;
    const empRole = selectedEmployee.role; // z.B. "Manager"
    // Alle boolean-basierten Permissions aus PERMISSION_MATRIX für diese Rolle berechnen
    const matrixDefaults = {};
    Object.entries(PERMISSION_MATRIX).forEach(([key, rule]) => {
      if (rule.adminOnly) return;
      matrixDefaults[key] = rule.roles.includes(empRole);
    });
    // Nur die true-Werte behalten (false = kein Override nötig, da default)
    const cleanPerms = {};
    Object.entries(matrixDefaults).forEach(([key, val]) => {
      if (val) cleanPerms[key] = true;
    });
    setLocalPermissions(cleanPerms);
    setHasChanges(true);
    toast.success(`Auf Rollenstandard "${empRole}" zurückgesetzt — bitte speichern!`, { duration: 4000 });
  };

  const toggleCat = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  // ──── Kategorien aus Registry ─────────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = {};
    Object.values(PERMISSION_REGISTRY).forEach(page => {
      const cat = page.category || 'Sonstige';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(page);
    });
    return cats;
  }, []);

  // ──── Permission Check ────────────────────────────────────────────────────────
  if (!permissions.isManager) {
    return <PermissionDenied message="Nur Manager können Berechtigungen verwalten." />;
  }

  const activeSummary = getAccessSummary(localPermissions);
  const detectedRole = detectRole(localPermissions);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Berechtigungen
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tippe auf einen Mitarbeiter um Rechte zu vergeben
          </p>
        </div>

        {/* ── Suche ──────────────────────────────────────────────────────────── */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Mitarbeiter suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* ── Mitarbeiterliste ───────────────────────────────────────────────── */}
        <div className="space-y-2">
          {filteredEmployees.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Kein Mitarbeiter gefunden</p>
          )}
          {filteredEmployees.map(emp => {
            const summary = getAccessSummary(emp.permissions);
            const role = detectRole(emp.permissions);
            const pct = summary.total > 0 ? Math.round((summary.active / summary.total) * 100) : 0;
            return (
              <button
                key={emp.id}
                onClick={() => handleSelectEmployee(emp)}
                className="w-full text-left bg-card border border-border rounded-xl px-4 py-3 hover:bg-secondary/50 transition-all active:scale-[0.99] flex items-center gap-3 min-h-[60px]"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {emp.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground truncate">{emp.name}</span>
                    {role && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground hidden sm:inline">
                        {role}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {/* Progress bar */}
                    <div className="flex-1 max-w-[120px] h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          pct === 0 ? 'bg-muted' : pct < 40 ? 'bg-amber-500' : 'bg-emerald-500'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {summary.active}/{summary.total} Bereiche
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SHEET — Berechtigungen bearbeiten
      ══════════════════════════════════════════════════════════════════════ */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-0 flex flex-col"
        >
          {selectedEmployee && (
            <>
              {/* Sheet Header */}
              <SheetHeader className="px-4 pt-5 pb-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-bold text-primary">
                      {selectedEmployee.name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <SheetTitle className="text-base font-bold leading-tight">
                      {selectedEmployee.name}
                    </SheetTitle>
                    <p className="text-xs text-muted-foreground">
                      {selectedEmployee.role} · {activeSummary.active}/{activeSummary.total} Bereiche aktiv
                      {detectedRole && ` · ${detectedRole}`}
                    </p>
                  </div>
                </div>
              </SheetHeader>

              {/* ── Rollenstandard-Reset Banner ────────────────────────── */}
              {(() => {
                // Prüfe ob customPerms falsche Overrides enthalten
                const empRole = selectedEmployee.role;
                const wrongOverrides = empRole ? Object.entries(localPermissions).filter(([key, val]) => {
                  const rule = PERMISSION_MATRIX[key];
                  if (!rule) return false;
                  const shouldBe = rule.roles.includes(empRole);
                  return val === false && shouldBe; // false-Override obwohl Rolle es haben sollte
                }) : [];
                if (wrongOverrides.length === 0) return null;
                return (
                  <div className="mx-4 mt-3 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-amber-500 text-lg">⚠️</span>
                      <div>
                        <p className="text-xs font-semibold text-amber-500">
                          {wrongOverrides.length} Berechtigungen fälschlicherweise gesperrt
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Für Rolle "{empRole}" sollten diese aktiv sein
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleResetToRoleDefault}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors min-h-[36px]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Zurücksetzen
                    </button>
                  </div>
                );
              })()}

              {/* Scrollbarer Inhalt */}
              <div className="flex-1 overflow-y-auto">

                {/* ── Rollen-Schnellauswahl ──────────────────────────────── */}
                <div className="px-4 py-4 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Rolle anwenden
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(STANDARD_ROLES).map(([key, role]) => (
                      <button
                        key={key}
                        onClick={() => handleApplyRole(key)}
                        className={cn(
                          'text-left px-3 py-2.5 rounded-lg border transition-all min-h-[44px]',
                          detectedRole === role.displayName
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-secondary/40 text-foreground hover:bg-secondary'
                        )}
                      >
                        <div className="text-xs font-semibold">{role.displayName}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                          {role.description}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Kopieren von */}
                  <div className="mt-3">
                    <Select onValueChange={handleCopyFrom}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue placeholder="Berechtigungen von Mitarbeiter kopieren..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter(e => e.id !== selectedEmployee.id)
                          .map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ── Erweiterte Einstellungen Toggle ───────────────────── */}
                <div className="px-4 py-3 border-b border-border">
                  <button
                    onClick={() => setAdvancedMode(!advancedMode)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Granulare Einstellungen</span>
                    {advancedMode
                      ? <ChevronUp className="w-3.5 h-3.5 ml-1" />
                      : <ChevronDown className="w-3.5 h-3.5 ml-1" />
                    }
                    {advancedMode && (
                      <span className="ml-auto text-[10px] bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded">
                        Erweitert
                      </span>
                    )}
                  </button>
                </div>

                {/* ── Granulare Permission-Sektionen ────────────────────── */}
                {advancedMode && (
                  <div className="px-4 py-3 space-y-2">
                    {Object.entries(categories).map(([cat, pages]) => {
                      const isOpen = expandedCats[cat];
                      // Wie viele Sections in dieser Kategorie sind aktiv?
                      const catKeys = pages.flatMap(p =>
                        Object.values(p.sections || {}).map(s => s.key)
                      );
                      const catActive = catKeys.filter(k => localPermissions[k] && localPermissions[k] !== 'none').length;

                      return (
                        <div key={cat} className="border border-border rounded-xl overflow-hidden">
                          <button
                            onClick={() => toggleCat(cat)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/60 transition-colors min-h-[44px]"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{cat}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {catActive}/{catKeys.length}
                              </span>
                            </div>
                            {isOpen
                              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            }
                          </button>

                          {isOpen && (
                            <div className="divide-y divide-border/50">
                              {pages.map(page => (
                                <div key={page.pageKey} className="px-4 py-3">
                                  <p className="text-xs font-semibold text-foreground mb-2">
                                    {page.displayName}
                                  </p>
                                  <div className="space-y-2">
                                    {Object.values(page.sections || {}).map(section => (
                                      <div key={section.key} className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="text-xs text-foreground truncate">{section.displayName}</p>
                                        </div>
                                        <PermToggle
                                          permKey={section.key}
                                          value={localPermissions[section.key]}
                                          onChange={handlePermissionChange}
                                          actions={section.actions}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Sticky Footer ─────────────────────────────────────────── */}
              {hasChanges && (
                <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-card flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="flex-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Zurücksetzen
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="flex-2 flex-grow-[2]"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {updateMutation.isPending ? 'Speichern...' : 'Speichern'}
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}