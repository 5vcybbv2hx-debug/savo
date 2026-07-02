import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Pencil, Search } from 'lucide-react';

export default function AreaManager({ permissions }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [formData, setFormData] = useState({ name: '', icon: '' });

  const { data: areas = [], isLoading } = useQuery({
    queryKey: ['areas'],
    queryFn: () => base44.entities.Area.list('-order', 100)
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editingArea?.id ? base44.entities.Area.update(editingArea.id, data) : base44.entities.Area.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      setModalOpen(false);
      setEditingArea(null);
      setFormData({ name: '', icon: '' });
    },
    onError: (error) => {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler: ' + (error?.message || 'Unbekannter Fehler'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Area.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['areas'] }),
    onError: (error) => {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler: ' + (error?.message || 'Unbekannter Fehler'));
    }
  });

  const filteredAreas = areas.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAdd = () => {
    setEditingArea(null);
    setFormData({ name: '', icon: '' });
    setModalOpen(true);
  };

  const openEdit = (area) => {
    setEditingArea(area);
    setFormData({ name: area.name, icon: area.icon || '' });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;
    saveMutation.mutate({
      name: formData.name.trim(),
      icon: formData.icon || '',
      is_active: true,
      order: editingArea?.order || 0
    });
  };

  return (
    <>
      {/* Search & Add */}
      <div className="mb-6 flex gap-2 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Bereich suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        {permissions.isManager && (
          <Button onClick={openAdd} className="bg-amber-600 hover:bg-amber-700 text-white h-11">
            <Plus className="w-4 h-4 mr-2" />
            Neuer Bereich
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center p-8 text-muted-foreground">Lädt...</div>
      ) : filteredAreas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Keine Bereiche gefunden
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredAreas.map((area) => (
            <Card key={area.id} className="p-4 flex items-center justify-between hover:border-border/80">
              <div className="flex items-center gap-3 flex-1">
                {area.icon && <span className="text-2xl">{area.icon}</span>}
                <div>
                  <p className="font-semibold text-foreground">{area.name}</p>
                  <p className="text-xs text-muted-foreground">ID: {area.id.slice(0, 8)}</p>
                </div>
              </div>
              {permissions.isManager && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(area)}
                    className="border-border text-muted-foreground hover:bg-accent"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteMutation.mutate(area.id)}
                    disabled={deleteMutation.isPending}
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingArea ? 'Bereich bearbeiten' : 'Neuer Bereich'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="z.B. Keller, Bar, Küche"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-11"
                disabled={saveMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon (optional)</Label>
              <Input
                placeholder="z.B. 🏠 🍺 👨‍🍳"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="h-11"
                disabled={saveMutation.isPending}
                maxLength={2}
              />
            </div>
            {saveMutation.isError && (
              <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded border border-destructive/20">
                Fehler beim Speichern. Bitte versuche es erneut.
              </div>
            )}
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saveMutation.isPending}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name.trim() || saveMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saveMutation.isPending ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}