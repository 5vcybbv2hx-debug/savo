/**
 * ActiveStaffPanel — Manager view of all currently clocked-in employees.
 * Night-safe: uses status-based filtering, not calendar date.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, LogOut, Pause, Play, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  isActiveEntry, calcWorkMinutes, formatDuration, formatTime,
  getOperationDate, getShiftWarning, buildTimeEntryFromClock
} from '@/lib/nightUtils';

function StatusBadge({ status }) {
  if (status === 'on_break') return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Pause</Badge>;
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Aktiv</Badge>;
}

function WarningBadge({ minutes }) {
  const level = getShiftWarning(minutes);
  if (!level) return null;
  const cfg = {
    danger: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  const labels = { danger: '10h+ Schicht!', warning: '8h+ Schicht', info: '6h Schicht' };
  return (
    <Badge className={cn('text-[10px] border flex items-center gap-1', cfg[level])}>
      <AlertTriangle className="w-2.5 h-2.5" />{labels[level]}
    </Badge>
  );
}

export default function ActiveStaffPanel() {
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState(null);

  const { data: clockEntries = [], isLoading } = useQuery({
    queryKey: ['clock-entries'],
    queryFn: () => base44.entities.ClockEntry.list('-clock_in', 200),
    refetchInterval: 120000, // auto-refresh every 2 minutes
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }),
  });

  // Night-safe: filter by status only, not by date
  const activeEntries = clockEntries.filter(isActiveEntry);

  const clockOutMutation = useMutation({
    mutationFn: async (entry) => {
      const now = new Date().toISOString();
      const totalMinutes = calcWorkMinutes(entry.clock_in, now);
      const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

      // Update ClockEntry
      await base44.entities.ClockEntry.update(entry.id, {
        clock_out: now,
        total_hours: totalHours,
        status: 'clocked_out',
      });

      // Erstelle TimeEntry mit korrektem Format
      const { format } = await import('date-fns');
      await base44.entities.TimeEntry.create({
        employee_id: entry.employee_id,
        employee_name: entry.employee_name,
        date: format(new Date(entry.clock_in), 'yyyy-MM-dd'),
        start_time: format(new Date(entry.clock_in), 'HH:mm'),
        end_time: format(new Date(now), 'HH:mm'),
        break_minutes: entry.pause_minutes || 0,
        total_hours: totalHours,
        notes: 'Automatisch von Manager ausstempelt',
        status: 'eingereicht',
        employee_confirmed: true,
        employee_confirmed_at: now
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clock-entries'] });
      qc.invalidateQueries({ queryKey: ['time-entries'] });
      qc.invalidateQueries({ queryKey: ['pending-time-entries'] });
      toast.success('Mitarbeiter ausgestempelt');
      setConfirmId(null);
    },
    onError: (e) => toast.error('Fehler: ' + e.message),
  });

  const breakMutation = useMutation({
    mutationFn: async (entry) => {
      const newStatus = entry.status === 'on_break' ? 'clocked_in' : 'on_break';
      const field = newStatus === 'on_break' ? 'pause_start' : 'pause_end';
      await base44.entities.ClockEntry.update(entry.id, {
        status: newStatus,
        [field]: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clock-entries'] });
      toast.success('Status aktualisiert');
    },
    onError: (e) => toast.error('Fehler: ' + e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-secondary/40 animate-pulse" />)}
      </div>
    );
  }

  if (activeEntries.length === 0) {
    return (
      <Card className="p-6 text-center bg-card border-border">
        <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Niemand ist gerade eingestempelt</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {activeEntries.map(entry => {
        const emp = employees.find(e => e.id === entry.employee_id);
        const nowMs = Date.now();
        const totalMinutes = calcWorkMinutes(entry.clock_in, new Date());
        const opDate = getOperationDate(entry.clock_in).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        const isConfirming = confirmId === entry.id;

        return (
          <Card key={entry.id} className={cn(
            'border',
            entry.status === 'on_break' ? 'border-amber-500/30 bg-amber-500/5' : 'border-green-500/30 bg-green-500/5'
          )}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: emp?.color || '#64748b' }}>
                  {entry.employee_name?.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground text-sm">{entry.employee_name}</p>
                    <StatusBadge status={entry.status} />
                    <WarningBadge minutes={totalMinutes} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      seit {formatTime(entry.clock_in)}
                    </span>
                    <span className="font-semibold text-foreground">{formatDuration(totalMinutes)}</span>
                    <span>Betriebstag: {opDate}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {isConfirming ? (
                <div className="mt-3 flex gap-2">
                  <p className="text-xs text-muted-foreground flex-1 self-center">Wirklich ausstempeln?</p>
                  <Button size="sm" variant="outline" onClick={() => setConfirmId(null)} className="h-8 text-xs">Abbrechen</Button>
                  <Button size="sm" onClick={() => clockOutMutation.mutate(entry)}
                    disabled={clockOutMutation.isPending}
                    className="h-8 bg-red-600 hover:bg-red-700 text-white text-xs gap-1">
                    <LogOut className="w-3 h-3" />Ausstempeln
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline"
                    onClick={() => breakMutation.mutate(entry)}
                    disabled={breakMutation.isPending}
                    className="h-8 text-xs gap-1">
                    {entry.status === 'on_break'
                      ? <><Play className="w-3 h-3" />Pause beenden</>
                      : <><Pause className="w-3 h-3" />Pause</>}
                  </Button>
                  <Button size="sm" onClick={() => setConfirmId(entry.id)}
                    className="h-8 bg-red-600 hover:bg-red-700 text-white text-xs gap-1 ml-auto">
                    <LogOut className="w-3 h-3" />Ausstempeln
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}