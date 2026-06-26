/**
 * DisplayManager — Slide-Verwaltung für Manager
 * Übersicht aller Slides + schnelles Anlegen/Bearbeiten/Deaktivieren
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Monitor, ExternalLink, Eye, EyeOff, GripVertical, Tv } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

const SLIDE_TYPES = [
  { value: 'announcement',  label: '📢 Ankündigung',     desc: 'Allgemeine Mitteilung' },
  { value: 'event',         label: '🎉 Event',            desc: 'Veranstaltung mit Datum' },
  { value: 'drink_special', label: '🍹 Drink Special',    desc: 'Getränk-Angebot mit Preis' },
  { value: 'image_only',    label: '🖼️ Nur Bild',         desc: 'Bild im Vollformat' },
  { value: 'countdown',     label: '⏳ Countdown',         desc: 'Countdown zu einem Event' },
];

const ACCENT_COLORS = [
  { value: 'amber',  label: '🟡 Gold'    },
  { value: 'blue',   label: '🔵 Blau'    },
  { value: 'green',  label: '🟢 Grün'    },
  { value: 'red',    label: '🔴 Rot'     },
  { value: 'purple', label: '🟣 Lila'    },
  { value: 'pink',   label: '🩷 Pink'    },
  { value: 'cyan',   label: '🩵 Cyan'    },
];

const TYPE_COLORS = {
  announcement:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  event:         'bg-purple-500/10 text-purple-400 border-purple-500/30',
  drink_special: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  image_only:    'bg-green-500/10 text-green-400 border-green-500/30',
  countdown:     'bg-red-500/10 text-red-400 border-red-500/30',
};

const EMPTY_FORM = {
  title: '', subtitle: '', body_text: '', slide_type: 'announcement',
  image_url: '', accent_color: 'amber', cta_text: '', event_date: '',
  event_time: '', price_info: '', is_active: true, sort_order: 0,
  show_from: '', show_until: '', duration_seconds: 8,
};

export default function DisplayManager() {
  const permissions = usePermissions();
  const qc = useQueryClient();

  const [modal, setModal]   = useState({ open: false, data: null });
  const [form, setForm]     = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: slides = [], isLoading } = useQuery({
    queryKey: ['display-slides-all'],
    queryFn:  () => base44.entities.DisplaySlide.list('sort_order', 100),
    staleTime: STALE.FAST,
  });

  const saveMut = useMutation({
    mutationFn: d => modal.data?.id
      ? base44.entities.DisplaySlide.update(modal.data.id, d)
      : base44.entities.DisplaySlide.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['display-slides'] });
      qc.invalidateQueries({ queryKey: ['display-slides-all'] });
      setModal({ open: false, data: null });
      toast.success('Slide gespeichert');
    },
    onError: e => toast.error('Fehler: ' + (e?.message || 'Unbekannt')),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.DisplaySlide.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['display-slides-all'] }),
  });

  const deleteMut = useMutation({
    mutationFn: id => base44.entities.DisplaySlide.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['display-slides'] });
      qc.invalidateQueries({ queryKey: ['display-slides-all'] });
      setDeleteTarget(null);
      toast.success('Slide gelöscht');
    },
  });

  const openAdd  = () => { setForm(EMPTY_FORM); setModal({ open: true, data: null }); };
  const openEdit = s  => { setForm({ ...EMPTY_FORM, ...s }); setModal({ open: true, data: s }); };
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  if (!permissions.isManager) return <PermissionDenied />;

  const activeCount   = slides.filter(s => s.is_active).length;
  const inactiveCount = slides.filter(s => !s.is_active).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-32 md:pb-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Tv className="w-5 h-5 text-primary" />
            Display-Manager
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeCount} aktive Slides · {inactiveCount} inaktiv
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="h-9 text-xs">
            <a href={createPageUrl('Display')} target="_blank" rel="noopener noreferrer">
              <Monitor className="w-3.5 h-3.5 mr-1.5" />
              Vorschau
              <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
            </a>
          </Button>
          <Button size="sm" onClick={openAdd} className="h-9 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Neue Slide
          </Button>
        </div>
      </div>

      {/* Info-Banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 mb-5 flex items-start gap-3">
        <Monitor className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-foreground">TV einrichten</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Öffne auf dem Bar-PC den Link <span className="font-mono text-primary">/Display</span> und drücke F11 für Vollbild. Die Slideshow läuft dann automatisch.
          </p>
        </div>
      </div>

      {/* Slide-Liste */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Lade Slides…</div>
      ) : slides.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Tv className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Noch keine Slides</p>
          <Button size="sm" variant="outline" onClick={openAdd} className="mt-3">Erste Slide anlegen</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {slides.map(s => (
            <Card key={s.id} className={cn('border-border/60 transition-opacity', !s.is_active && 'opacity-50')}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-base">
                  {SLIDE_TYPES.find(t => t.value === s.slide_type)?.label.split(' ')[0] || '📢'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                    <Badge className={cn('text-[10px] h-4 px-1.5 border', TYPE_COLORS[s.slide_type])}>
                      {SLIDE_TYPES.find(t => t.value === s.slide_type)?.label.replace(/^.+? /, '') || s.slide_type}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {s.subtitle || s.cta_text || s.price_info || `${s.duration_seconds || 8}s`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleMut.mutate({ id: s.id, is_active: !s.is_active })}
                    title={s.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    {s.is_active
                      ? <Eye className="w-4 h-4 text-primary" />
                      : <EyeOff className="w-4 h-4 text-muted-foreground" />
                    }
                  </button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDeleteTarget(s)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Slide Modal ──────────────────────────────────────────────────────────── */}
      <Dialog open={modal.open} onOpenChange={open => !open && setModal({ open: false, data: null })}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal.data ? 'Slide bearbeiten' : 'Neue Slide'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Typ */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Slide-Typ *</Label>
              <div className="grid grid-cols-2 gap-2">
                {SLIDE_TYPES.map(t => (
                  <button key={t.value} onClick={() => f('slide_type', t.value)}
                    className={cn('text-left p-2.5 rounded-xl border text-xs transition-all',
                      form.slide_type === t.value
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    )}>
                    <div className="font-semibold">{t.label}</div>
                    <div className="opacity-60 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Titel + Untertitel */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Titel *</Label>
                <Input className="h-9" placeholder="Großer Titel" value={form.title} onChange={e => f('title', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Untertitel</Label>
                <Input className="h-9" placeholder="Unterzeile" value={form.subtitle} onChange={e => f('subtitle', e.target.value)} />
              </div>
            </div>

            {/* Body Text */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fließtext (optional)</Label>
              <Textarea className="text-sm resize-none" rows={2} placeholder="Längerer Beschreibungstext…" value={form.body_text} onChange={e => f('body_text', e.target.value)} />
            </div>

            {/* CTA + Preis */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Button-Text</Label>
                <Input className="h-9" placeholder="z.B. Heute ab 20 Uhr" value={form.cta_text} onChange={e => f('cta_text', e.target.value)} />
              </div>
              {(form.slide_type === 'drink_special') && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Preis</Label>
                  <Input className="h-9" placeholder="z.B. 4,50 € / Glas" value={form.price_info} onChange={e => f('price_info', e.target.value)} />
                </div>
              )}
            </div>

            {/* Event-Felder */}
            {(form.slide_type === 'event' || form.slide_type === 'countdown') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Datum</Label>
                  <Input className="h-9" type="date" value={form.event_date} onChange={e => f('event_date', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Uhrzeit</Label>
                  <Input className="h-9" placeholder="20:00" value={form.event_time} onChange={e => f('event_time', e.target.value)} />
                </div>
              </div>
            )}

            {/* Bild */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bild-URL (optional)</Label>
              <Input className="h-9" placeholder="https://…" value={form.image_url} onChange={e => f('image_url', e.target.value)} />
              {form.image_url && (
                <div className="h-20 rounded-lg overflow-hidden border border-border/50">
                  <img src={form.image_url} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                </div>
              )}
            </div>

            {/* Farbe + Dauer + Reihenfolge */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Akzentfarbe</Label>
                <Select value={form.accent_color} onValueChange={v => f('accent_color', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCENT_COLORS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dauer (Sek.)</Label>
                <Input className="h-9" type="number" min="3" max="30" value={form.duration_seconds} onChange={e => f('duration_seconds', parseInt(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Reihenfolge</Label>
                <Input className="h-9" type="number" min="0" value={form.sort_order} onChange={e => f('sort_order', parseInt(e.target.value))} />
              </div>
            </div>

            {/* Zeitfenster */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Anzeigen ab</Label>
                <Input className="h-9" type="datetime-local" value={form.show_from} onChange={e => f('show_from', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Anzeigen bis</Label>
                <Input className="h-9" type="datetime-local" value={form.show_until} onChange={e => f('show_until', e.target.value)} />
              </div>
            </div>

            {/* Aktiv */}
            <div className="flex items-center gap-3 pt-1">
              <Switch checked={form.is_active} onCheckedChange={v => f('is_active', v)} />
              <Label className="text-sm text-foreground cursor-pointer">Slide aktiv (wird angezeigt)</Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModal({ open: false, data: null })}>Abbrechen</Button>
            <Button onClick={() => {
              if (!form.title.trim()) { toast.error('Titel erforderlich'); return; }
              saveMut.mutate(form);
            }} disabled={saveMut.isPending}>
              {saveMut.isPending ? 'Speichern…' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slide löschen?</AlertDialogTitle>
            <AlertDialogDescription>„{deleteTarget?.title}" wird dauerhaft entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMut.mutate(deleteTarget?.id)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
