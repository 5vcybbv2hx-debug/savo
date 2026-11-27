import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import PermToggle from './PermToggle';
import { normalizePresetPermissions, countActivePermissions, permissionCategories, categoryKeys } from './rolePresetUtils';
import { ChevronDown, ChevronUp, Trash2, Plus, Save, Lock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Bearbeiten-Modus für Rollen-Vorlagen ──────────────────────────────────────
// Vorlagen sind reine Rechte-Bündel. Sie ändern nie Employee.role und wirken
// nicht rückwirkend auf Mitarbeiter, die eine Vorlage früher bekommen haben.
export default function RolePresetEditor({ open, onOpenChange, presets = [] }) {
  const queryClient = useQueryClient();
  const categories = useMemo(() => permissionCategories(), []);
  const [editing, setEditing] = useState(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [expandedCats, setExpandedCats] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setNewName('');
      setNewDesc('');
    }
  }, [open]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['role-presets'] });

  const startEdit = (preset) => {
    setEditing({ ...preset, permissions: normalizePresetPermissions(preset.permissions) });
    setExpandedCats({});
  };

  const changePerm = (key, level) => {
    setEditing(prev => {
      if (!prev) return prev;
      const permissions = { ...prev.permissions };
      if (level === 'none') delete permissions[key];
      else permissions[key] = level;
      return { ...prev, permissions };
    });
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Bitte einen Namen eingeben');
      return;
    }
    setBusy(true);
    const created = await base44.entities.RolePreset.create({
      display_name: newName.trim(),
      description: newDesc.trim(),
      permissions: {},
      sort_order: presets.length,
      is_system: false,
      is_active: true,
    });
    setBusy(false);
    setNewName('');
    setNewDesc('');
    refresh();
    setEditing({ ...created, permissions: {} });
    toast.success('Vorlage angelegt — jetzt Rechte vergeben');
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.display_name?.trim()) {
      toast.error('Bitte einen Namen eingeben');
      return;
    }
    setBusy(true);
    await base44.entities.RolePreset.update(editing.id, {
      display_name: editing.display_name.trim(),
      description: editing.description || '',
      permissions: editing.permissions,
    });
    setBusy(false);
    refresh();
    toast.success(`Vorlage ${editing.display_name.trim()} gespeichert`);
    setEditing(null);
  };

  const handleDelete = async (preset) => {
    if (preset.is_system) return;
    if (!window.confirm(`Vorlage "${preset.display_name}" löschen?`)) return;
    await base44.entities.RolePreset.delete(preset.id);
    if (editing?.id === preset.id) setEditing(null);
    refresh();
    toast.success('Vorlage gelöscht');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col bg-card border-border">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base">Rollen-Vorlagen</SheetTitle>
              <p className="text-[11px] text-muted-foreground mt-1">
                Vorlagen sind Bündel von Rechten. Sie ändern nie die Rolle eines Mitarbeiters, sondern
                nur dessen Rechte — und wirken nicht rückwirkend auf Mitarbeiter, die eine Vorlage
                früher bekommen haben.
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* ── Liste aller Vorlagen ───────────────────────────────── */}
          <div>
            <p className="text-[12px] font-medium text-muted-foreground mb-2">Vorhandene Vorlagen</p>
            <div className="space-y-1.5">
              {presets.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">Noch keine Vorlagen angelegt.</p>
              )}
              {presets.map(preset => {
                const activeCount = countActivePermissions(preset.permissions);
                const isEditing = editing?.id === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors',
                      isEditing ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'
                    )}
                  >
                    <button onClick={() => startEdit(preset)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {preset.display_name}
                        </span>
                        {preset.is_system && (
                          <Lock className="w-3 h-3 text-muted-foreground shrink-0" title="Systemvorlage" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {activeCount} Rechte aktiv
                        {preset.description ? ` · ${preset.description}` : ''}
                      </p>
                    </button>
                    {preset.is_system ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground px-2">System</span>
                    ) : (
                      <button
                        onClick={() => handleDelete(preset)}
                        className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label="Vorlage löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Neue Vorlage anlegen ───────────────────────────────── */}
          <div className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-[12px] font-medium text-muted-foreground">Neue Vorlage</p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name der Vorlage"
              className="h-9 text-sm"
            />
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Beschreibung (optional)"
              className="h-9 text-sm"
            />
            <Button size="sm" onClick={handleCreate} disabled={busy} className="w-full">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Anlegen
            </Button>
          </div>

          {/* ── Rechte der ausgewählten Vorlage ────────────────────── */}
          {editing && (
            <div className="rounded-xl border border-border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-medium text-muted-foreground">
                  Rechte: {editing.display_name}
                </p>
                <button
                  onClick={() => setEditing(null)}
                  className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary transition-colors"
                >
                  Abbrechen
                </button>
              </div>
              <Input
                value={editing.display_name}
                onChange={(e) => setEditing(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="Name der Vorlage"
                className="h-9 text-sm"
              />
              <Textarea
                value={editing.description || ''}
                onChange={(e) => setEditing(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beschreibung (optional)"
                className="text-sm min-h-[60px]"
              />

              <div className="space-y-2">
                {Object.entries(categories).map(([cat, pages]) => {
                  const isOpen = expandedCats[cat];
                  const keys = categoryKeys(pages);
                  const catActive = keys.filter(k => editing.permissions[k]).length;
                  return (
                    <div key={cat} className="border border-border rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary/30 hover:bg-secondary/60 transition-colors min-h-[44px]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{cat}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {catActive}/{keys.length}
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
                            <div key={page.pageKey} className="px-3 py-2.5">
                              <p className="text-xs font-semibold text-foreground mb-2">
                                {page.displayName}
                              </p>
                              <div className="space-y-2">
                                {Object.values(page.sections || {}).map(section => (
                                  <div key={section.key} className="flex items-center justify-between gap-2">
                                    <p className="text-xs text-foreground truncate min-w-0">
                                      {section.displayName}
                                    </p>
                                    <PermToggle
                                      permKey={section.key}
                                      value={editing.permissions[section.key]}
                                      onChange={changePerm}
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
            </div>
          )}
        </div>

        {/* ── Speichern ─────────────────────────────────────────────── */}
        {editing && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-card">
            <Button size="sm" onClick={handleSave} disabled={busy} className="w-full">
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {busy ? 'Speichern...' : 'Vorlage speichern'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}