import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function LocationSelect({ value, onChange, className }) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.filter({ is_active: true }, '-order', 100)
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Location.create(data),
    onSuccess: (newLocation) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      onChange(newLocation.id);
      setNewLocationName('');
      setShowCreateDialog(false);
    }
  });

  const handleCreate = () => {
    if (!newLocationName.trim()) return;
    createMutation.mutate({ name: newLocationName.trim(), is_active: true });
  };

  return (
    <>
      <div className={cn('space-y-2', className)}>
        <Label>Lagerort *</Label>
        <div className="flex gap-2">
          <Select value={value} onValueChange={onChange} disabled={isLoading}>
            <SelectTrigger className="h-11 text-base">
              <SelectValue placeholder="Lagerort wählen..." />
            </SelectTrigger>
            <SelectContent>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11"
            onClick={() => setShowCreateDialog(true)}
            title="Neuer Lagerort"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Neuer Lagerort</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="z.B. Lagerkeller, Bar Hauptbereich"
                value={newLocationName}
                onChange={e => setNewLocationName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="h-11 text-base"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="flex-1">Abbrechen</Button>
              <Button onClick={handleCreate} disabled={!newLocationName.trim() || createMutation.isPending} className="flex-1">
                {createMutation.isPending ? 'Wird erstellt...' : 'Erstellen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}