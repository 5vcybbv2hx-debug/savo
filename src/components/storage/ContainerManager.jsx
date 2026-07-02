import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Pencil, Search } from 'lucide-react';

const CONTAINER_TYPES = ['Regal', 'Schrank', 'Schublade', 'Kiste', 'Kühler', 'Sonstiges'];

export default function ContainerManager({ permissions }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState(null);
  const [formData, setFormData] = useState({ name: '', type: 'Regal' });

  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: () => base44.entities.Area.list('-order', 100)
  });

  const { data: containers = [], isLoading } = useQuery({
    queryKey: ['containers', selectedArea],
    queryFn: () =>
      selectedArea ? base44.entities.Container.filter({ area_id: selectedArea, is_active: true }, '-order') : Promise.resolve([]),
    enabled: !!selectedArea
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editingContainer?.id
        ? base44.entities.Container.update(editingContainer.id, data)
        : base44.entities.Container.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers', selectedArea] });
      setModalOpen(false);
      setEditingContainer(null);
      setFormData({ name: '', type: 'Regal' });
    },
    onError: (error) => {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler: ' + (error?.message || 'Unbekannter Fehler'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Container.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['containers', selectedArea] }),
    onError: (error) => {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler: ' + (error?.message || 'Unbekannter Fehler'));
    }
  });

  const selectedAreaObj = areas.find((a) => a.id === selectedArea);

  const filteredContainers = containers.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const openAdd = () => {
    if (!selectedArea) {
      alert('Bitte wähle zuerst einen Bereich.');
      return;
    }
    setEditingContainer(null);
    setFormData({ name: '', type: 'Regal' });
    setModalOpen(true);
  };

  const openEdit = (container) => {
    setEditingContainer(container);
    setFormData({ name: container.name, type: container.type });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !selectedArea) return;
    saveMutation.mutate({
      area_id: selectedArea,
      area_name: selectedAreaObj.name,
      name: formData.name.trim(),
      type: formData.type,
      is_active: true,
      order: editingContainer?.order || 0
    });
  };

  return (
    <>
      {/* Area Select */}
      <div className="mb-6">
        <Label className="mb-2 block">Bereich wählen</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {areas.map((area) => (
            <button
              key={area.id}
              onClick={() => {
                setSelectedArea(area.id);
                setSearchTerm('');
              }}
              className={`p-3 rounded-lg font-medium text-sm transition-all border ${
                selectedArea === area.id
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-card border-border hover:border-amber-500 text-foreground hover:bg-accent'
              }`}
            >
              {area.icon && <span className="mr-1">{area.icon}</span>}
              {area.name}
            </button>
          ))}
        </div>
      </div>

      {selectedArea && (
        <>
          {/* Search & Add */}
          <div className="mb-6 flex gap-2 flex-col sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Behälter suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            {permissions.isManager && (
              <Button onClick={openAdd} className="bg-amber-600 hover:bg-amber-700 text-white h-11">
                <Plus className="w-4 h-4 mr-2" />
                Neuer Behälter
              </Button>
            )}
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex justify-center p-8 text-muted-foreground">Lädt...</div>
          ) : filteredContainers.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Keine Behälter in diesem Bereich
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredContainers.map((container) => (
                <Card key={container.id} className="p-4 flex items-center justify-between hover:border-border/80">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{container.name}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {container.type}
                      </Badge>
                      <p className="text-xs text-muted-foreground">ID: {container.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  {permissions.isManager && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(container)}
                        className="border-border text-muted-foreground hover:bg-accent"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMutation.mutate(container.id)}
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
        </>
      )}

      {!selectedArea && (
        <Card className="p-8 text-center text-muted-foreground">
          Wähle einen Bereich, um Behälter zu verwalten
        </Card>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingContainer ? 'Behälter bearbeiten' : 'Neuer Behälter'} {selectedAreaObj && `in „${selectedAreaObj.name}"`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="z.B. Regal A, Schrank 1, Kiste Orange"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-11"
                disabled={saveMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={formData.type} onValueChange={(type) => setFormData({ ...formData, type })} disabled={saveMutation.isPending}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTAINER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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