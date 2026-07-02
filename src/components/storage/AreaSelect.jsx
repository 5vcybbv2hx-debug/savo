import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function AreaSelect({ value, onChange, className }) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const queryClient = useQueryClient();

  const { data: areas = [], isLoading } = useQuery({
    queryKey: ['areas'],
    queryFn: () => base44.entities.Area.list('order', 100)
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Area.create(data),
    onSuccess: (newArea) => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      onChange(newArea);
      setNewAreaName('');
      setShowCreateDialog(false);
    },
    onError: (error) => {
      console.error('Fehler beim Erstellen des Bereichs:', error);
      alert('Fehler beim Erstellen des Bereichs: ' + (error?.message || 'Unbekannter Fehler'));
    }
  });

  const handleCreate = () => {
    const trimmedName = newAreaName.trim();
    if (!trimmedName) return;
    createMutation.mutate({
      name: trimmedName,
      is_active: true,
      order: 0
    });
  };

  return (
    <>
      <div className={cn('space-y-2', className)}>
        <Label>Bereich *</Label>
         <div className="flex gap-2">
           <Select value={value?.id || ''} onValueChange={areaId => {
             const selectedArea = areas.find(a => a.id === areaId);
             onChange(selectedArea || {});
           }} disabled={isLoading || !areas?.length}>
             <SelectTrigger className="h-11 text-base">
               <SelectValue placeholder={isLoading ? 'Lädt...' : 'Bereich wählen...'} />
             </SelectTrigger>
             <SelectContent>
               {areas.map(area => (
                 <SelectItem key={area.id} value={area.id}>
                   {area.icon ? `${area.icon} ${area.name}` : area.name}
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11"
            onClick={() => setShowCreateDialog(true)}
            title="Neuer Bereich"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuer Bereich</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="z.B. Keller, Bar, Küche"
                value={newAreaName}
                onChange={e => setNewAreaName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="h-11 text-base"
                autoFocus
                disabled={createMutation.isPending}
              />
            </div>
            {createMutation.isError && (
              <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded border border-destructive/20">
                Fehler beim Erstellen. Bitte versuche es erneut.
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={!newAreaName.trim() || createMutation.isPending}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {createMutation.isPending ? 'Wird erstellt...' : 'Erstellen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}