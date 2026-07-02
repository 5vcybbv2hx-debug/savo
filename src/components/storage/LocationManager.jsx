import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Pencil, Search, Copy, Check } from 'lucide-react';

const LOCATION_TYPES = ['Regal', 'Schrank', 'Fach', 'Schublade', 'Kiste', 'Kühler', 'Sonstiges'];

const generateShortCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'LOC-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function LocationManager({ permissions }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedContainer, setSelectedContainer] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [formData, setFormData] = useState({
    location_type: 'Regal',
    position: '',
    description: ''
  });

  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: () => base44.entities.Area.list('-order', 100)
  });

  const { data: containers = [] } = useQuery({
    queryKey: ['containers', selectedArea],
    queryFn: () =>
      selectedArea ? base44.entities.Container.filter({ area_id: selectedArea, is_active: true }, '-order') : Promise.resolve([]),
    enabled: !!selectedArea
  });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['storage-locations', selectedArea, selectedContainer],
    queryFn: () => {
      let filter = {};
      if (selectedArea) filter.area_id = selectedArea;
      if (selectedContainer) filter.container_id = selectedContainer;
      return Object.keys(filter).length > 0
        ? base44.entities.StorageLocation.filter(filter, '-created_date', 500)
        : Promise.resolve([]);
    },
    enabled: !!selectedArea || !!selectedContainer
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editingLocation?.id ? base44.entities.StorageLocation.update(editingLocation.id, data) : base44.entities.StorageLocation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-locations', selectedArea, selectedContainer] });
      setModalOpen(false);
      setEditingLocation(null);
      setFormData({ location_type: 'Regal', position: '', description: '' });
    },
    onError: (error) => {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler: ' + (error?.message || 'Unbekannter Fehler'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.StorageLocation.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storage-locations', selectedArea, selectedContainer] }),
    onError: (error) => {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler: ' + (error?.message || 'Unbekannter Fehler'));
    }
  });

  const selectedAreaObj = areas.find((a) => a.id === selectedArea);
  const selectedContainerObj = containers.find((c) => c.id === selectedContainer);

  const filteredLocations = useMemo(
    () =>
      locations.filter((loc) =>
        `${loc.area_name} ${loc.container_name} ${loc.position}`.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [locations, searchTerm]
  );

  const openAdd = () => {
    if (!selectedArea || !selectedContainer) {
      alert('Bitte wähle einen Bereich und Behälter.');
      return;
    }
    setEditingLocation(null);
    setFormData({ location_type: 'Regal', position: '', description: '' });
    setModalOpen(true);
  };

  const openEdit = (location) => {
    setEditingLocation(location);
    setFormData({
      location_type: location.location_type || 'Regal',
      position: location.position || '',
      description: location.description || ''
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!selectedArea || !selectedContainer) return;

    const autoName = `${selectedAreaObj.name} › ${selectedContainerObj.name}${formData.position ? ` › ${formData.position}` : ''}`;

    saveMutation.mutate({
      area_id: selectedArea,
      area_name: selectedAreaObj.name,
      container_id: selectedContainer,
      container_name: selectedContainerObj.name,
      name: autoName,
      short_code: editingLocation?.short_code || generateShortCode(),
      location_type: formData.location_type,
      position: formData.position || '',
      description: formData.description || '',
      is_active: true
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
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
                setSelectedContainer('');
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
          {/* Container Select */}
          <div className="mb-6">
            <Label className="mb-2 block">Behälter wählen</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {containers.map((container) => (
                <button
                  key={container.id}
                  onClick={() => {
                    setSelectedContainer(container.id);
                    setSearchTerm('');
                  }}
                  className={`p-3 rounded-lg font-medium text-sm transition-all border ${
                    selectedContainer === container.id
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-card border-border hover:border-amber-500 text-foreground hover:bg-accent'
                  }`}
                >
                  {container.name}
                </button>
              ))}
            </div>
          </div>

          {selectedContainer && (
            <>
              {/* Search & Add */}
              <div className="mb-6 flex gap-2 flex-col sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Lagerplatz suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
                {permissions.isManager && (
                  <Button onClick={openAdd} className="bg-amber-600 hover:bg-amber-700 text-white h-11">
                    <Plus className="w-4 h-4 mr-2" />
                    Neuer Platz
                  </Button>
                )}
              </div>

              {/* List */}
              {isLoading ? (
                <div className="flex justify-center p-8 text-muted-foreground">Lädt...</div>
              ) : filteredLocations.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  Keine Lagerplätze in diesem Behälter
                </Card>
              ) : (
                <div className="grid gap-3">
                  {filteredLocations.map((location) => (
                    <Card key={location.id} className="p-4 space-y-2 hover:border-border/80">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{location.name}</p>
                          <div className="flex gap-2 flex-wrap mt-2">
                            {location.short_code && (
                              <Badge
                                variant="outline"
                                className="cursor-pointer hover:bg-accent text-xs"
                                onClick={() => copyToClipboard(location.short_code)}
                              >
                                {copiedId === location.short_code ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1" /> Kopiert
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 mr-1" /> {location.short_code}
                                  </>
                                )}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {location.location_type}
                            </Badge>
                          </div>
                          {location.position && (
                            <p className="text-xs text-muted-foreground mt-1">Position: {location.position}</p>
                          )}
                          {location.description && (
                            <p className="text-xs text-muted-foreground mt-1">Notiz: {location.description}</p>
                          )}
                        </div>
                        {permissions.isManager && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(location)}
                              className="border-border text-muted-foreground hover:bg-accent"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteMutation.mutate(location.id)}
                              disabled={deleteMutation.isPending}
                              className="border-destructive/50 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {!selectedContainer && (
            <Card className="p-8 text-center text-muted-foreground">
              Wähle einen Behälter, um Lagerplätze zu verwalten
            </Card>
          )}
        </>
      )}

      {!selectedArea && (
        <Card className="p-8 text-center text-muted-foreground">
          Wähle einen Bereich, um Lagerplätze zu verwalten
        </Card>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Lagerplatz bearbeiten' : 'Neuer Lagerplatz'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-muted/50 rounded border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Automatisch generierter Name</p>
              <p className="text-sm text-foreground mt-1 font-medium">
                {selectedAreaObj?.name} › {selectedContainerObj?.name}
                {formData.position && ` › ${formData.position}`}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={formData.location_type} onValueChange={(type) => setFormData({ ...formData, location_type: type })} disabled={saveMutation.isPending}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Position (optional)</Label>
              <Input
                placeholder="z.B. oben links, Fach 2, Ecke rechts"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="h-11"
                disabled={saveMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label>Beschreibung (optional)</Label>
              <Input
                placeholder="z.B. besondere Ausstattung, Hinweise"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="h-11"
                disabled={saveMutation.isPending}
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
              disabled={saveMutation.isPending}
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