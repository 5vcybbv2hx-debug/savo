import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Check, ArrowRightLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { validateDirectSwap } from '@/lib/shiftSwapHelpers';

export default function DirectSwapModal({ open, onOpenChange, myShifts = [] }) {
  const queryClient = useQueryClient();
  const [selectedMyShift, setSelectedMyShift] = useState(null);
  const [selectedOtherShift, setSelectedOtherShift] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true })
  });

  const { data: allShifts = [] } = useQuery({
    queryKey: ['shifts-direct-swap'],
    queryFn: async () => {
      const { format, addDays } = await import('date-fns');
      const { fetchUntilDateCovered } = await import('@/lib/adaptiveFetch');
      const from = format(new Date(), 'yyyy-MM-dd');
      const to   = format(addDays(new Date(), 60), 'yyyy-MM-dd');
      // ⚠️ War aufsteigend sortiert mit Limit 500 — bei >500 vergangenen
      // Schichten wurden ALLE zukuenftigen Schichten (das eigentliche Ziel!)
      // nie erreicht. Jetzt absteigend + selbst-skalierend.
      return fetchUntilDateCovered(
          (limit) => base44.entities.Shift.list('-date', limit),
          from, to
      );
    },
    staleTime: 60_000,
  });

  const directSwapMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMyShift || !selectedOtherShift || !selectedEmployee) {
        throw new Error('Bitte wähle beide Schichten aus');
      }

      const currentEmployee = employees.find(e => e.email === currentUser?.email);
      if (!currentEmployee) {
        throw new Error('Aktueller Mitarbeiter nicht gefunden');
      }

      // Validiere Konflikte
      const val1 = await validateDirectSwap(
        selectedEmployee.id,
        selectedMyShift.date,
        selectedMyShift.start_time
      );
      
      const val2 = await validateDirectSwap(
        currentEmployee.id,
        selectedOtherShift.date,
        selectedOtherShift.start_time
      );

      if (!val1.valid || !val2.valid) {
        throw new Error(val1.error || val2.error || 'Validierung fehlgeschlagen');
      }

      // Tausch durchführen
      await base44.entities.Shift.update(selectedMyShift.id, {
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.name
      });

      await base44.entities.Shift.update(selectedOtherShift.id, {
        employee_id: currentEmployee.id,
        employee_name: currentEmployee.full_name
      });

      // Benachrichtigungen
      try {
        if (selectedEmployee.email) {
          await base44.entities.Notification.create({
            type: 'direct_swap',
            title: 'Direkter Schichttausch durchgeführt',
            message: `Du tauschst deine Schicht am ${format(parseISO(selectedOtherShift.date), 'dd.MM.yyyy', { locale: de })} mit ${currentEmployee.full_name}.`,
            related_id: selectedMyShift.id,
            read_by: []
          });
        }
      } catch (error) {
        console.error('Benachrichtigung fehlgeschlagen:', error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
      queryClient.invalidateQueries(['my-shifts']);
      setSelectedMyShift(null);
      setSelectedOtherShift(null);
      setSelectedEmployee(null);
      setSelectedMyShift(null);
      onOpenChange(false);
      toast.success('Direkter Tausch erfolgreich durchgeführt!');
    },
    onError: (error) => {
      toast.error('Fehler beim Tausch: ' + error.message);
    }
  });

  const otherEmployees = employees.filter(e => e.email !== currentUser?.email);
  const otherEmployeeShifts = useMemo(() => {
    if (!selectedEmployee) return [];
    return allShifts.filter(s => s.employee_id === selectedEmployee.id);
  }, [selectedEmployee, allShifts]);

  const swapPreview = selectedMyShift && selectedOtherShift && selectedEmployee;
  const conflictChecked = !!selectedMyShift && !!selectedOtherShift && !!selectedEmployee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            Direkter Schichttausch
          </DialogTitle>
          <DialogDescription>
            Tausche deine Schicht direkt mit einem anderen Mitarbeiter
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Meine Schicht */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">
              Deine Schicht (zum Tauschen anbieten)
            </label>
            <Select value={selectedMyShift?.id || ''} onValueChange={(id) => {
              const shift = myShifts.find(s => s.id === id);
              setSelectedMyShift(shift);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Wähle eine deiner Schichten..." />
              </SelectTrigger>
              <SelectContent>
                {myShifts.length > 0 ? (
                  myShifts.map(shift => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {format(parseISO(shift.date), 'dd.MM.yyyy', { locale: de })} · {shift.start_time} - {shift.end_time}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem disabled value="none">
                    Keine Schichten verfügbar
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {selectedMyShift && (
              <Card className="mt-2 p-3 bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm font-medium text-blue-400">
                  {format(parseISO(selectedMyShift.date), 'EEEE, d. MMMM yyyy', { locale: de })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedMyShift.start_time} - {selectedMyShift.end_time}
                </p>
              </Card>
            )}
          </div>

          {/* Anderer Mitarbeiter */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">
              Mitarbeiter (zum Tauschen mit)
            </label>
            <Select value={selectedEmployee?.id || ''} onValueChange={(id) => {
              const emp = otherEmployees.find(e => e.id === id);
              setSelectedEmployee(emp);
              setSelectedOtherShift(null); // Reset shift wenn Mitarbeiter wechselt
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Wähle einen Mitarbeiter..." />
              </SelectTrigger>
              <SelectContent>
                {otherEmployees.length > 0 ? (
                  otherEmployees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem disabled value="none">
                    Keine anderen Mitarbeiter verfügbar
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Andere Schicht */}
          {selectedEmployee && (
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                {selectedEmployee.name}s Schicht (die du übernimmst)
              </label>
              <Select value={selectedOtherShift?.id || ''} onValueChange={(id) => {
                const shift = otherEmployeeShifts.find(s => s.id === id);
                setSelectedOtherShift(shift);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Wähle eine Schicht..." />
                </SelectTrigger>
                <SelectContent>
                  {otherEmployeeShifts.length > 0 ? (
                    otherEmployeeShifts.map(shift => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {format(parseISO(shift.date), 'dd.MM.yyyy', { locale: de })} · {shift.start_time} - {shift.end_time}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="none">
                      Keine Schichten verfügbar
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {selectedOtherShift && (
                <Card className="mt-2 p-3 bg-green-500/10 border border-green-500/20">
                  <p className="text-sm font-medium text-green-400">
                    {format(parseISO(selectedOtherShift.date), 'EEEE, d. MMMM yyyy', { locale: de })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedOtherShift.start_time} - {selectedOtherShift.end_time}
                  </p>
                </Card>
              )}
            </div>
          )}

          {/* Vorschau & Validierung */}
          {swapPreview && (
            <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-500/5">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                Tauschabwicklung
              </h3>
              <div className="space-y-2 text-sm">
                <p className="text-foreground">
                  Du gibst auf: <span className="font-medium text-blue-400">{format(parseISO(selectedMyShift.date), 'dd.MM.', { locale: de })} {selectedMyShift.start_time}</span>
                </p>
                <p className="text-foreground">
                  Du bekommst: <span className="font-medium text-green-400">{format(parseISO(selectedOtherShift.date), 'dd.MM.', { locale: de })} {selectedOtherShift.start_time}</span>
                </p>
                <p className="text-muted-foreground mt-2">
                  {selectedEmployee.name} bekommt deine Schicht, du bekommst {selectedEmployee.name}s Schicht.
                </p>
              </div>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            onClick={() => directSwapMutation.mutate()}
            disabled={!swapPreview || directSwapMutation.isPending}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
          >
            {directSwapMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Wird durchgeführt...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Tausch durchführen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}