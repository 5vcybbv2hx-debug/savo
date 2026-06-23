/**
 * TimeApprovalPanel — Manager view for reviewing and approving time entries.
 * Shows entries with status 'eingereicht', allows approve / edit.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Pencil, X, Clock, AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDuration, getShiftWarning } from '@/lib/nightUtils';

function StatusBadge({ status, managerApprovedBy }) {
  // status='genehmigt' aber kein manager_approved_by → gilt als ausstehend
  const effectiveStatus = (status === 'genehmigt' && !managerApprovedBy) ? 'ausstehend' : status;
  const cfg = {
    eingereicht: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    ausstehend: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    genehmigt: 'bg-green-500/20 text-green-400 border-green-500/30',
    abgelehnt: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const labels = { eingereicht: 'Eingereicht', ausstehend: 'Ausstehend', genehmigt: 'Genehmigt', abgelehnt: 'Abgelehnt' };
  return (
    <Badge className={cn('text-[10px] border', cfg[effectiveStatus] || 'bg-secondary text-muted-foreground')}>
      {labels[effectiveStatus] || effectiveStatus}
    </Badge>
  );
}

function EditForm({ entry, onSave, onCancel }) {
  const [form, setForm] = useState({
    start_time: entry.start_time || '',
    end_time: entry.end_time || '',
    break_minutes: entry.break_minutes || 0,
    notes: entry.notes || '',
  });

  const calcHours = () => {
    if (!form.start_time || !form.end_time) return 0;
    const [sh, sm] = form.start_time.split(':').map(Number);
    let [eh, em] = form.end_time.split(':').map(Number);
    let startMins = sh * 60 + sm;
    let endMins = eh * 60 + em;
    if (endMins < startMins) endMins += 24 * 60; // overnight
    const workMins = Math.max(0, endMins - startMins - (parseInt(form.break_minutes) || 0));
    return Math.round((workMins / 60) * 100) / 100;
  };

  return (
    <div className="mt-3 space-y-3 p-3 bg-background/50 rounded-lg border border-border">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Start</Label>
          <Input type="time" className="h-9 text-sm" value={form.start_time}
            onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ende</Label>
          <Input type="time" className="h-9 text-sm" value={form.end_time}
            onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Pause (Minuten)</Label>
        <Input type="number" min={0} className="h-9 text-sm" value={form.break_minutes}
          onChange={e => setForm(f => ({ ...f, break_minutes: e.target.value }))} />
      </div>
      <p className="text-xs text-muted-foreground">Berechnet: <strong className="text-foreground">{calcHours()}h</strong></p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} className="flex-1 h-9 text-xs"><X className="w-3 h-3 mr-1" />Abbrechen</Button>
        <Button size="sm" onClick={() => onSave({ ...form, total_hours: calcHours() })} className="flex-1 h-9 bg-amber-600 hover:bg-amber-700 text-white text-xs">Speichern</Button>
      </div>
    </div>
  );
}

export default function TimeApprovalPanel() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [showApproved, setShowApproved] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncClockEntriesToTimeEntries', {});
      const { created, skipped } = res.data;
      toast.success(`${created} Einträge importiert, ${skipped} bereits vorhanden`);
      qc.invalidateQueries({ queryKey: ['time-entries-all'] });
      qc.invalidateQueries({ queryKey: ['pending-time-entries'] });
    } catch (e) {
      toast.error('Fehler: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const { data: allEntries = [], isLoading } = useQuery({
    queryKey: ['time-entries-all'],
    queryFn: () => base44.entities.TimeEntry.list('-date', 300),
    refetchInterval: 120000,
    staleTime: STALE.FAST,
  });

  // Ausstehend: status='eingereicht' ODER employee_confirmed=true — noch nicht vom Manager genehmigt
  const pending = allEntries.filter(e =>
    (e.status === 'eingereicht' || e.employee_confirmed === true) &&
    e.status !== 'genehmigt'
  );
  // Wirklich genehmigt: manager_approved_by gesetzt
  const approved = allEntries.filter(e => e.status === 'genehmigt' && !!e.manager_approved_by).slice(0, 10);

  const approveMutation = useMutation({
    mutationFn: async (id) => {
      const user = await base44.auth.me();
      return base44.entities.TimeEntry.update(id, {
        status: 'genehmigt',
        manager_approved_by: user?.email || user?.full_name || 'Manager',
        manager_approved_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries-all'] });
      qc.invalidateQueries({ queryKey: ['pending-time-entries'] });
      toast.success('Zeit genehmigt');
    },
    onError: (e) => toast.error('Fehler: ' + e.message),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TimeEntry.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries-all'] });
      qc.invalidateQueries({ queryKey: ['pending-time-entries'] });
      setEditingId(null);
      toast.success('Eintrag aktualisiert');
    },
    onError: (e) => toast.error('Fehler: ' + e.message),
  });

  const EntryCard = ({ entry, canApprove = true }) => {
    const totalMinutes = (entry.total_hours || 0) * 60;
    const warn = getShiftWarning(totalMinutes);
    const isEditing = editingId === entry.id;

    return (
      <Card key={entry.id} className={cn(
        'border',
        (entry.status === 'genehmigt' && !!entry.manager_approved_by) ? 'border-green-500/20 bg-green-500/5' : 'border-border bg-card'
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="font-semibold text-foreground text-sm">{entry.employee_name}</p>
                <StatusBadge status={entry.status} managerApprovedBy={entry.manager_approved_by} />
                {warn && (
                  <Badge className={cn('text-[10px] border flex items-center gap-1',
                    warn === 'danger' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                  )}>
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {warn === 'danger' ? '10h+' : '8h+'}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span>📅 {entry.date || entry.operation_date}</span>
                <span>⏱ {entry.start_time} – {entry.end_time}</span>
                <span>⌚ {entry.total_hours?.toFixed(2)}h</span>
                {entry.break_minutes > 0 && <span>☕ {entry.break_minutes}min Pause</span>}
              </div>
              {entry.notes && <p className="text-xs text-muted-foreground mt-1 italic">{entry.notes}</p>}
            </div>

            {canApprove && !(entry.status === 'genehmigt' && !!entry.manager_approved_by) && (
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEditingId(isEditing ? null : entry.id)}
                  className="h-8 w-8 p-0">
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="sm" onClick={() => approveMutation.mutate(entry.id)}
                  disabled={approveMutation.isPending}
                  className="h-8 bg-green-600 hover:bg-green-700 text-white gap-1 text-xs px-2">
                  <CheckCircle2 className="w-3 h-3" />OK
                </Button>
              </div>
            )}
          </div>

          {isEditing && (
            <EditForm
              entry={entry}
              onCancel={() => setEditingId(null)}
              onSave={(data) => editMutation.mutate({ id: entry.id, data })}
            />
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-secondary/40 animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Sync Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 hover:bg-accent/50 transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
          {syncing ? 'Importiere...' : 'Stempelzeiten nachimportieren'}
        </button>
      </div>

      {/* Pending */}
      {pending.length === 0 ? (
        <Card className="p-6 text-center bg-card border-border">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Alle Zeiten genehmigt</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {pending.map(entry => <EntryCard key={entry.id} entry={entry} canApprove />)}
        </div>
      )}

      {/* Approved (collapsible) */}
      {approved.length > 0 && (
        <div>
          <button
            onClick={() => setShowApproved(s => !s)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-2 w-full">
            {showApproved ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Bereits genehmigte Einträge ({approved.length})
          </button>
          {showApproved && (
            <div className="space-y-2 mt-1">
              {approved.map(entry => <EntryCard key={entry.id} entry={entry} canApprove={false} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}