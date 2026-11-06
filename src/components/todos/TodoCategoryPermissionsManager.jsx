import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TodoCategoryPermissionsManager({ open, onClose }) {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]);

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['todo-categories'],
    queryFn: () => base44.entities.TodoCategory.list(),
    enabled: open
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true })
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TodoCategory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['todo-categories']);
      setNewCategoryName('');
      setSelectedRoles([]);
      toast.success('Kategorie erstellt');
    },
    onError: (err) => toast.error('Fehler: ' + err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TodoCategory.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['todo-categories']);
      setSelectedCategory(null);
      setEditMode(false);
      toast.success('Kategorie aktualisiert');
    },
    onError: (err) => toast.error('Fehler: ' + err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TodoCategory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['todo-categories']);
      setSelectedCategory(null);
      toast.success('Kategorie gelöscht');
    },
    onError: (err) => toast.error('Fehler: ' + err.message)
  });

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error('Kategoriename erforderlich');
      return;
    }
    createMutation.mutate({
      name: newCategoryName.trim(),
      visible_roles: selectedRoles.length > 0 ? selectedRoles : ['admin']
    });
  };

  const handleUpdateCategory = () => {
    if (!selectedCategory) return;
    updateMutation.mutate({
      id: selectedCategory.id,
      data: {
        visible_roles: selectedRoles.length > 0 ? selectedRoles : ['admin']
      }
    });
  };

  const availableRoles = ['admin', 'manager', 'team', 'user'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>To-do-Kategorien Berechtigungen</DialogTitle>
          <DialogDescription>
            Verwalte welche Rollen welche To-do-Kategorien sehen dürfen.
          </DialogDescription>
        </DialogHeader>

        {loadingCategories ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">Kategorien ({categories.length})</TabsTrigger>
              <TabsTrigger value="new">Neue Kategorie</TabsTrigger>
            </TabsList>

            {/* Kategorien Liste */}
            <TabsContent value="list" className="space-y-3 mt-4">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Keine Kategorien vorhanden.</p>
              ) : (
                categories.map(cat => (
                  <Card key={cat.id} className="border-border/50">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{cat.name}</h4>
                          {cat.description && (
                            <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(cat.visible_roles || []).map(role => (
                              <span key={role} className="px-2 py-1 text-xs rounded-full bg-primary/20 text-primary border border-primary/30">
                                {role}
                              </span>
                            ))}
                            {(cat.visible_roles || []).length === 0 && (
                              <span className="text-xs text-muted-foreground italic">Keine Rollen konfiguriert</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCategory(cat);
                              setSelectedRoles(cat.visible_roles || []);
                              setEditMode(true);
                            }}
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Bearbeiten
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-status-danger hover:text-status-danger"
                            onClick={() => {
                              if (confirm(`Kategorie "${cat.name}" wirklich löschen?`)) {
                                deleteMutation.mutate(cat.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Neue Kategorie */}
            <TabsContent value="new" className="space-y-4 mt-4">
              <div>
                <Label className="text-sm font-semibold text-foreground mb-2 block">
                  Kategoriename
                </Label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="z.B. Einkauf, Reparatur, Event..."
                  className="h-10"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-foreground mb-3 block">
                  Sichtbar für Rollen
                </Label>
                <div className="space-y-2">
                  {availableRoles.map(role => (
                    <div key={role} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-new-${role}`}
                        checked={selectedRoles.includes(role)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRoles([...selectedRoles, role]);
                          } else {
                            setSelectedRoles(selectedRoles.filter(r => r !== role));
                          }
                        }}
                      />
                      <Label htmlFor={`role-new-${role}`} className="font-normal text-foreground">
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleCreateCategory}
                disabled={createMutation.isPending || !newCategoryName.trim()}
                className="w-full bg-gradient-to-r from-status-ok to-status-ok hover:from-status-ok hover:to-status-ok text-white"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wird erstellt...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Kategorie erstellen
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Edit Mode */}
            {editMode && selectedCategory && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-md">
                  <CardHeader>
                    <CardTitle>Kategorie bearbeiten: {selectedCategory.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold text-foreground mb-3 block">
                        Sichtbar für Rollen
                      </Label>
                      <div className="space-y-2">
                        {availableRoles.map(role => (
                          <div key={role} className="flex items-center gap-2">
                            <Checkbox
                              id={`role-edit-${role}`}
                              checked={selectedRoles.includes(role)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedRoles([...selectedRoles, role]);
                                } else {
                                  setSelectedRoles(selectedRoles.filter(r => r !== role));
                                }
                              }}
                            />
                            <Label htmlFor={`role-edit-${role}`} className="font-normal text-foreground">
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditMode(false);
                          setSelectedCategory(null);
                        }}
                        className="flex-1"
                      >
                        Abbrechen
                      </Button>
                      <Button
                        onClick={handleUpdateCategory}
                        disabled={updateMutation.isPending}
                        className="flex-1"
                      >
                        {updateMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Speichern...
                          </>
                        ) : (
                          'Speichern'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}