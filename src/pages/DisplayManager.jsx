/**
 * DisplayManager — Slide-Verwaltung für Manager
 * v2: Mehrere Drink-Specials pro Slide, Ort-Feld, größere Farbpalette,
 *     Vorschau-Panel, Auto-Deaktivierung bei Ablauf, doppelte Reihenfolge-Validierung
 */
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Monitor, ExternalLink, Eye, EyeOff, Tv, AlertTriangle, ChevronDown, ChevronUp, GripVertical, QrCode, X, Copy, Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import DrinkEmojiPicker from '@/components/emoji/DrinkEmojiPicker';
import InstagramExportDialog from '@/components/display/InstagramExportDialog';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { isAfter, parseISO } from 'date-fns';

const SLIDE_TYPES = [
  { value: 'announcement',  label: '📢 Ankündigung',      desc: 'Allgemeine Mitteilung' },
  { value: 'event',         label: '🎉 Event',             desc: 'Veranstaltung mit Datum & Ort' },
  { value: 'drink_special', label: '🍹 Drink Special',     desc: 'Bis zu 4 Getränke mit Preisen' },
  { value: 'image_only',    label: '🖼️ Nur Bild',          desc: 'Bild im Vollformat' },
  { value: 'countdown',     label: '⏳ Countdown',          desc: 'Countdown zu einem Event' },
  { value: 'qr_code',       label: '📱 QR-Code',           desc: 'QR-Code mit Text' },
  { value: 'tonight',       label: '🌙 Tonight',           desc: 'Heutige Veranstaltung' },
];

// Erweiterte Farbpalette
const ACCENT_COLORS = [
  { value: 'amber',    label: 'Gold',      hex: '#f59e0b' },
  { value: 'orange',   label: 'Orange',    hex: '#f97316' },
  { value: 'red',      label: 'Rot',       hex: '#ef4444' },
  { value: 'rose',     label: 'Rose',      hex: '#f43f5e' },
  { value: 'pink',     label: 'Pink',      hex: '#ec4899' },
  { value: 'fuchsia',  label: 'Fuchsia',   hex: '#d946ef' },
  { value: 'purple',   label: 'Lila',      hex: '#a855f7' },
  { value: 'violet',   label: 'Violett',   hex: '#7c3aed' },
  { value: 'indigo',   label: 'Indigo',    hex: '#6366f1' },
  { value: 'blue',     label: 'Blau',      hex: '#3b82f6' },
  { value: 'sky',      label: 'Hellblau',  hex: '#0ea5e9' },
  { value: 'cyan',     label: 'Cyan',      hex: '#06b6d4' },
  { value: 'teal',     label: 'Teal',      hex: '#14b8a6' },
  { value: 'green',    label: 'Grün',      hex: '#22c55e' },
  { value: 'lime',     label: 'Lime',      hex: '#84cc16' },
  { value: 'white',    label: 'Weiß',      hex: '#f8fafc' },
];

const BACKGROUND_THEMES = [
  { value: 'auto',             label: '✨ Automatisch',        desc: 'Anhand des Titels erkannt' },
  { value: 'germany',          label: '🇩🇪 Deutschlandfahne',   desc: 'Wehende Flagge' },
  { value: 'american_football',label: '🏈 American Football',  desc: 'Spiralball & Yard-Lines' },
  { value: 'soccer',           label: '⚽ Fußball',             desc: 'Ball & Rasen' },
  { value: 'disco',            label: '🪩 Disco',               desc: 'Spiegelkugel & Lichter' },
  { value: 'music',            label: '🎵 Live Music',          desc: 'Equalizer-Visualizer' },
  { value: 'party',            label: '🎉 Party',               desc: 'Konfetti-Regen' },
  { value: 'cocktail',         label: '🍹 Cocktails',           desc: 'Farbige Blasen' },
  { value: 'beer',             label: '🍺 Bier',                desc: 'Aufsteigende Blasen' },
  { value: 'fireworks',        label: '🎆 Feuerwerk',           desc: 'Partikel-Explosion' },
  { value: 'summer',           label: '☀️ Sommer',              desc: 'Sonne & Wellen' },
  { value: 'christmas',        label: '❄️ Weihnachten',         desc: 'Schneeflocken' },
  { value: 'halloween',        label: '🎃 Halloween',           desc: 'Geister & Kürbisse' },
  { value: 'love',             label: '❤️ Liebe',               desc: 'Aufsteigende Herzen' },
  { value: 'food',             label: '🍕 Food',                desc: 'Schwebende Icons' },
  { value: 'default',          label: '⭐ Standard',            desc: 'Dezente Partikel' },
];


const TYPE_COLORS = {
  announcement:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  event:         'bg-purple-500/10 text-purple-400 border-purple-500/30',
  drink_special: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  image_only:    'bg-green-500/10 text-green-400 border-green-500/30',
  countdown:     'bg-red-500/10 text-red-400 border-red-500/30',
  qr_code:       'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  tonight:       'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
};

const EMPTY_DRINK = { name: '', price: '', emoji: '🍹' };
const EMPTY_FORM = {
  title: '', subtitle: '', body_text: '', slide_type: 'announcement',
  image_url: '', accent_color: 'amber', background_theme: 'auto', cta_text: '', event_date: '',
  event_end_date: '', event_time: '', event_end_time: '', location: '',
  price_info: '', is_active: true, sort_order: 1, public_event: false,
  show_from: '', show_until: '', duration_seconds: 8,
  drinks: [{ ...EMPTY_DRINK }],
};

export default function DisplayManager() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();

  const [modal, setModal]       = useState({ open: false, data: null });
  const [form, setForm]         = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewOpen, setPreviewOpen]   = useState(false);
  const [activeTab, setActiveTab]       = useState('form');
  const [showQR, setShowQR]             = useState(false);
  const [qrCopied, setQrCopied]         = useState(false);
  const [igExport, setIgExport]         = useState(null);

  const MENU_URL = `${window.location.origin}/PublicDrinkMenu`;

  const { data: slides = [], isLoading } = useQuery({
    queryKey: ['display-slides-all'],
    queryFn:  () => base44.entities.DisplaySlide.list('sort_order', 100),
    staleTime: STALE.SLOW,
  });

  // Auto-Deaktivierung: Slide deaktivieren wenn show_until abgelaufen
  useEffect(() => {
    if (!slides.length) return;
    const now = new Date();
    slides.forEach(s => {
      if (s.is_active && s.show_until && isAfter(now, parseISO(s.show_until))) {
        base44.entities.DisplaySlide.update(s.id, { is_active: false }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['display-slides-all'] });
        });
      }
    });
  }, [slides]);

  const saveMut = useMutation({
    mutationFn: d => {
      // drinks-Array als JSON in body_text speichern wenn drink_special
      const payload = { ...d };
      if (payload.slide_type === 'drink_special' && Array.isArray(payload.drinks)) {
        payload.body_text = JSON.stringify(payload.drinks.filter(dr => dr.name));
      }
      delete payload.drinks;
      return modal.data?.id
        ? base44.entities.DisplaySlide.update(modal.data.id, payload)
        : base44.entities.DisplaySlide.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['display-slides'] });
      queryClient.invalidateQueries({ queryKey: ['display-slides-all'] });
      setModal({ open: false, data: null });
      toast.success('Slide gespeichert');
    },
    onError: e => toast.error('Fehler: ' + (e?.message || 'Unbekannt')),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.DisplaySlide.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['display-slides-all'] }),
  });

  const deleteMut = useMutation({
    mutationFn: id => base44.entities.DisplaySlide.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['display-slides'] });
      queryClient.invalidateQueries({ queryKey: ['display-slides-all'] });
      setDeleteTarget(null);
      toast.success('Slide gelöscht');
    },
  });

  const reorderMut = useMutation({
    mutationFn: async (updates) => {
      return Promise.all(updates.map(({ id, sort_order }) => base44.entities.DisplaySlide.update(id, { sort_order })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['display-slides-all'] });
      toast.success('Reihenfolge geändert');
    },
  });

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.index === destination.index) return;

    const sorted = [...slides].sort((a,b) => (a.sort_order||0)-(b.sort_order||0));
    const moving = sorted[source.index];

    if (source.index < destination.index) {
      // Move down: Slides between source+1 and dest shift up (order decreases)
      const updates = sorted.slice(source.index + 1, destination.index + 1).map((s, i, arr) => ({
        id: s.id,
        sort_order: (arr[i-1]?.sort_order || (moving.sort_order || 0)) 
      }));
      updates.push({ id: moving.id, sort_order: sorted[destination.index].sort_order });
      reorderMut.mutate(updates);
    } else {
      // Move up: Slides between dest and source-1 shift down (order increases)
      const updates = sorted.slice(destination.index, source.index).map((s, i, arr) => ({
        id: s.id,
        sort_order: (s.sort_order || 0) + 1
      }));
      updates.push({ id: moving.id, sort_order: sorted[destination.index].sort_order });
      reorderMut.mutate(updates);
    }
  };

  const openAdd = () => {
    const maxOrder = slides.length ? Math.max(...slides.map(s => s.sort_order || 0)) + 1 : 1;
    setForm({ ...EMPTY_FORM, sort_order: maxOrder });
    setModal({ open: true, data: null });
    setActiveTab('form');
  };

  const openEdit = s => {
    let drinks = [{ ...EMPTY_DRINK }];
    if (s.slide_type === 'drink_special' && s.body_text) {
      try { drinks = JSON.parse(s.body_text); } catch {}
    }
    setForm({ ...EMPTY_FORM, ...s, public_event: s.public_event === true, drinks, event_end_date: s.event_end_date || '', event_end_time: s.event_end_time || '', location: s.location || '', background_theme: s.background_theme || 'auto' });
    setModal({ open: true, data: s });
    setActiveTab('form');
  };

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  // Validierung doppelte Reihenfolge
  const orderConflict = slides.some(s => {
    if (modal.data?.id && s.id === modal.data.id) return false;
    return Number(s.sort_order) === Number(form.sort_order);
  });

  const accentHex = ACCENT_COLORS.find(c => c.value === form.accent_color)?.hex || '#f59e0b';

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
            {activeCount} aktive · {inactiveCount} inaktiv
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="h-9 text-xs">
            <a href={createPageUrl('Display')} target="_blank" rel="noopener noreferrer">
              <Monitor className="w-3.5 h-3.5 mr-1.5" />
              Vollbild
              <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowQR(true)} className="h-9 text-xs gap-1.5">
            <QrCode className="w-3.5 h-3.5" />
            Gäste-Link
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
        <p className="text-xs text-muted-foreground">
          Öffne auf dem Bar-PC <span className="font-mono text-primary">/Display</span> und drücke <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">F11</kbd> für Vollbild.
        </p>
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
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="slides" direction="vertical">
            {(provided, snapshot) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className={cn('space-y-2', snapshot.isDraggingOver && 'bg-primary/5 rounded-lg p-2')}>
                {[...slides].sort((a,b) => (a.sort_order||0)-(b.sort_order||0)).map((s, i) => (
                  <Draggable key={s.id} draggableId={s.id} index={i}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} className={cn(snapshot.isDragging && 'opacity-50')}>
                        <Card className={cn('border-border/60 transition-opacity', !s.is_active && 'opacity-50')}>
                          <CardContent className="p-3 flex items-center gap-3">
                            <div {...provided.dragHandleProps} className="shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing transition-colors">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-base"
                              style={{ background: (ACCENT_COLORS.find(c => c.value === s.accent_color)?.hex || '#f59e0b') + '22' }}>
                              {SLIDE_TYPES.find(t => t.value === s.slide_type)?.label.split(' ')[0] || '📢'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                                <Badge className={cn('text-[10px] h-4 px-1.5 border', TYPE_COLORS[s.slide_type])}>
                                  {SLIDE_TYPES.find(t => t.value === s.slide_type)?.label.replace(/^.+? /, '') || s.slide_type}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">#{s.sort_order}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {s.subtitle || s.location || s.price_info || `${s.duration_seconds || 8}s`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => toggleMut.mutate({ id: s.id, is_active: !s.is_active })}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                {s.is_active ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                              </button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Instagram-Export" onClick={() => setIgExport(s)}>
                                <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDeleteTarget(s)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* ── Slide Modal ────────────────────────────────────────────────────────── */}
      <Dialog open={modal.open} onOpenChange={open => !open && setModal({ open: false, data: null })}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal.data ? 'Slide bearbeiten' : 'Neue Slide'}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-2 mb-4">
              <TabsTrigger value="form">Inhalt</TabsTrigger>
              <TabsTrigger value="preview">Vorschau</TabsTrigger>
            </TabsList>

            {/* ── FORM TAB ── */}
            <TabsContent value="form" className="space-y-4">

              {/* Typ */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Slide-Typ</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SLIDE_TYPES.map(t => (
                    <button key={t.value} onClick={() => f('slide_type', t.value)}
                      className={cn('flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors text-xs',
                        form.slide_type === t.value
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border/60 hover:border-border text-muted-foreground')}>
                      <span className="text-base">{t.label.split(' ')[0]}</span>
                      <div>
                        <div className="font-medium text-foreground">{t.label.replace(/^.+? /, '')}</div>
                        <div className="text-[10px] text-muted-foreground">{t.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Titel + Untertitel */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Titel *</Label>
                  <Input value={form.title} onChange={e => f('title', e.target.value)} placeholder="Slide-Titel" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Untertitel</Label>
                  <Input value={form.subtitle} onChange={e => f('subtitle', e.target.value)} placeholder="Optional" className="h-9 text-sm" />
                </div>
              </div>

              {/* Event-spezifisch */}
              {(form.slide_type === 'event' || form.slide_type === 'countdown') && (
                <div className="space-y-3 rounded-xl border border-border/60 p-3 bg-muted/30">
                  <p className="text-xs font-semibold text-foreground">Event-Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Startdatum</Label>
                      <Input type="date" value={form.event_date} onChange={e => f('event_date', e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Enddatum (optional)</Label>
                      <Input type="date" value={form.event_end_date} onChange={e => f('event_end_date', e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Startzeit</Label>
                      <Input type="time" value={form.event_time} onChange={e => f('event_time', e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Endzeit (optional)</Label>
                      <Input type="time" value={form.event_end_time} onChange={e => f('event_end_time', e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">📍 Ort / Location</Label>
                    <Input value={form.location} onChange={e => f('location', e.target.value)} placeholder="z.B. QUI Bar, Terrasse, Hauptsaal…" className="h-9 text-sm" />
                  </div>

                  {/* Öffentliche Event-Seite + QR-Code auf dem Display */}
                  <div className="pt-2.5 border-t border-border/50 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <Label className="text-xs flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5" /> Öffentliche Event-Seite & QR-Code
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Gäste scannen den QR-Code auf dem TV und sehen Titel, Datum, Ort und
                        Beschreibung — inklusive Kalender-Speichern und Getränkekarte.
                      </p>
                      {form.public_event && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 mt-1.5 break-all">
                          🔗 {window.location.origin}/Event/{modal.data?.id || '… — erscheint nach dem Speichern'}
                        </p>
                      )}
                    </div>
                    <Switch checked={!!form.public_event} onCheckedChange={v => f('public_event', v)} className="mt-0.5" />
                  </div>
                </div>
              )}

              {/* Drink-Special: Mehrere Getränke */}
              {form.slide_type === 'drink_special' && (
                <div className="space-y-3 rounded-xl border border-border/60 p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">Getränke (max. 4)</p>
                    {form.drinks.length < 4 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => f('drinks', [...form.drinks, { ...EMPTY_DRINK }])}>
                        <Plus className="w-3 h-3 mr-1" /> Getränk hinzufügen
                      </Button>
                    )}
                  </div>
                  {form.drinks.map((dr, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <DrinkEmojiPicker
                        value={dr.emoji}
                        onChange={(emoji) => {
                          const d = [...form.drinks]; d[i] = { ...d[i], emoji }; f('drinks', d);
                        }}
                      />
                      <Input value={dr.name} onChange={e => {
                        const d = [...form.drinks]; d[i] = { ...d[i], name: e.target.value }; f('drinks', d);
                      }} className="h-9 text-sm flex-1" placeholder="Getränk-Name" />
                      <Input value={dr.price} onChange={e => {
                        const d = [...form.drinks]; d[i] = { ...d[i], price: e.target.value }; f('drinks', d);
                      }} className="h-9 text-sm w-24" placeholder="z.B. 6,50€" />
                      {form.drinks.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                          onClick={() => f('drinks', form.drinks.filter((_, j) => j !== i))}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Bild URL */}
              {form.slide_type !== 'drink_special' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Bild-URL (optional)</Label>
                  <Input value={form.image_url} onChange={e => f('image_url', e.target.value)} placeholder="https://..." className="h-9 text-sm" />
                </div>
              )}

              {/* Body text — nur bei announcement */}
              {form.slide_type === 'announcement' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Beschreibung</Label>
                  <Textarea value={form.body_text} onChange={e => f('body_text', e.target.value)} placeholder="Weitere Details…" rows={3} className="text-sm resize-none" />
                </div>
              )}

              {/* CTA */}
              {form.slide_type !== 'drink_special' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Call-to-Action Text</Label>
                  <Input value={form.cta_text} onChange={e => f('cta_text', e.target.value)} placeholder="z.B. Jetzt reservieren!" className="h-9 text-sm" />
                </div>
              )}

              {/* Farbe */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Akzentfarbe</Label>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_COLORS.map(c => (
                    <button key={c.value} onClick={() => f('accent_color', c.value)}
                      title={c.label}
                      className={cn('w-8 h-8 rounded-full border-2 transition-transform hover:scale-110',
                        form.accent_color === c.value ? 'border-foreground scale-110' : 'border-transparent')}
                      style={{ background: c.hex }} />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Gewählt: <span style={{ color: accentHex }} className="font-semibold">
                    {ACCENT_COLORS.find(c => c.value === form.accent_color)?.label}
                  </span>
                </p>
              </div>


              {/* Hintergrund-Animation */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Hintergrund-Animation</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {BACKGROUND_THEMES.map(bg => (
                    <button
                      key={bg.value}
                      onClick={() => f('background_theme', bg.value)}
                      className={cn(
                        'flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all',
                        form.background_theme === bg.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:border-primary/50'
                      )}
                    >
                      <span className="text-lg leading-none mt-0.5">{bg.label.split(' ')[0]}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate">
                          {bg.label.split(' ').slice(1).join(' ')}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{bg.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Anzeigedauer + Reihenfolge */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Anzeigedauer (Sekunden)</Label>
                  <Input type="number" min={3} max={60} value={form.duration_seconds}
                    onChange={e => f('duration_seconds', Number(e.target.value))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reihenfolge</Label>
                  <Input type="number" min={1} value={form.sort_order}
                    onChange={e => f('sort_order', Number(e.target.value))} className={cn('h-9 text-sm', orderConflict && 'border-destructive')} />
                  {orderConflict && (
                    <p className="text-[10px] text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Diese Reihenfolge ist bereits vergeben
                    </p>
                  )}
                </div>
              </div>

              {/* Zeitplanung */}
              <div className="space-y-2 rounded-xl border border-border/60 p-3 bg-muted/30">
                <p className="text-xs font-semibold text-foreground">Zeitplanung (optional)</p>
                <p className="text-[10px] text-muted-foreground">Slide wird nach Ablauf von "Anzeigen bis" automatisch deaktiviert.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Anzeigen ab</Label>
                    <Input type="datetime-local" value={form.show_from} onChange={e => f('show_from', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Anzeigen bis (auto-deaktiviert)</Label>
                    <Input type="datetime-local" value={form.show_until} onChange={e => f('show_until', e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Aktiv */}
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Aktiv</p>
                  <p className="text-xs text-muted-foreground">Slide wird in der Slideshow angezeigt</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={v => f('is_active', v)} />
              </div>
            </TabsContent>

            {/* ── VORSCHAU TAB ── */}
            <TabsContent value="preview">
              <SlidePreview form={form} />
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setModal({ open: false, data: null })}>Abbrechen</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || !form.title || orderConflict}>
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
            <AlertDialogAction onClick={() => deleteMut.mutate(deleteTarget?.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── QR-Code Dialog (Gäste-Link) ── */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" />
              Gäste-Link · Getränkekarte
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(MENU_URL)}&bgcolor=ffffff&color=111827&margin=2`}
                alt="QR-Code Getränkekarte"
                width={220}
                height={220}
                className="rounded-lg block"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Gäste scannen diesen Code mit der Kamera-App<br/>
              und sehen die Getränkekarte sofort im Browser.
            </p>
            <div className="w-full flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <span className="text-[11px] text-muted-foreground truncate flex-1 font-mono">{MENU_URL}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(MENU_URL);
                  setQrCopied(true);
                  setTimeout(() => setQrCopied(false), 2000);
                }}
                className="shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Link kopieren"
              >
                {qrCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <a
                href={MENU_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Im Browser öffnen"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Instagram Export Dialog ── */}
      <InstagramExportDialog
        open={!!igExport}
        onOpenChange={(o) => !o && setIgExport(null)}
        slide={igExport}
      />
    </div>
  );
}

// ── Mini-Vorschau im Manager ──────────────────────────────────────────────────
function SlidePreview({ form }) {
  const accentHex = ACCENT_COLORS.find(c => c.value === form.accent_color)?.hex || '#f59e0b';
  const glow = accentHex + '66';
  const soft = accentHex + '22';

  const drinks = form.slide_type === 'drink_special'
    ? (Array.isArray(form.drinks) ? form.drinks.filter(d => d.name) : [])
    : [];

  return (
    <div className="rounded-xl overflow-hidden border border-border/60" style={{ aspectRatio: '16/9', background: '#0a0a0a', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '5%', textAlign: 'center', gap: '4%' }}>

        {/* Typ-Badge */}
        <div style={{ background: soft, border: `1px solid ${accentHex}`, borderRadius: 6, padding: '3px 12px', fontSize: '0.6rem', color: accentHex, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {SLIDE_TYPES.find(t => t.value === form.slide_type)?.label || 'Slide'}
        </div>

        {/* Titel */}
        <div style={{ fontSize: 'clamp(1rem, 4vw, 2rem)', fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {form.title || 'Titel'}
        </div>

        {/* Untertitel */}
        {form.subtitle && (
          <div style={{ fontSize: 'clamp(0.6rem, 2vw, 0.9rem)', color: 'rgba(255,255,255,0.6)' }}>{form.subtitle}</div>
        )}

        {/* Drink-Specials Vorschau */}
        {drinks.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {drinks.map((dr, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${accentHex}44`, borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 60 }}>
                <div style={{ fontSize: '1.2rem' }}>{dr.emoji}</div>
                <div style={{ fontSize: '0.55rem', color: '#fff', fontWeight: 600 }}>{dr.name}</div>
                {dr.price && <div style={{ fontSize: '0.6rem', color: accentHex, fontWeight: 800 }}>{dr.price}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Event Datum/Zeit/Ort */}
        {form.slide_type === 'event' && (form.event_date || form.location) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {form.event_date && <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 10px', color: '#fff', fontSize: '0.6rem', fontWeight: 600 }}>📅 {form.event_date}</div>}
            {form.event_time && <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 10px', color: '#fff', fontSize: '0.6rem', fontWeight: 600 }}>🕐 {form.event_time}</div>}
            {form.location && <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 10px', color: '#fff', fontSize: '0.6rem', fontWeight: 600 }}>📍 {form.location}</div>}
          </div>
        )}

        {/* CTA */}
        {form.cta_text && (
          <div style={{ background: accentHex, color: '#fff', padding: '6px 20px', borderRadius: 8, fontWeight: 800, fontSize: '0.65rem', boxShadow: `0 0 16px ${glow}` }}>
            {form.cta_text}
          </div>
        )}

        {/* Countdown Vorschau */}
        {form.slide_type === 'countdown' && (
          <div style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${accentHex}`, borderRadius: 10, padding: '8px 24px', display: 'inline-flex', gap: 12, alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: '1.4rem', lineHeight: 1 }}>??</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.55rem' }}>Tage<br/>noch</span>
          </div>
        )}

        {/* Farbindikator unten */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: accentHex, boxShadow: `0 0 8px ${glow}` }} />
      </div>
    </div>
  );
}