import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Eye, EyeOff, GripVertical, RefreshCw, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SLIDE_TYPES = [
  { value: 'announcement',  label: '📢 Ankündigung' },
  { value: 'event',         label: '🎉 Event' },
  { value: 'drink_special', label: '🍹 Drink Special' },
  { value: 'image_only',    label: '🖼️ Nur Bild' },
  { value: 'countdown',     label: '⏳ Countdown' },
  { value: 'qr_code',       label: '📱 QR-Code' },
  { value: 'tonight',       label: '🌙 Tonight' },
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

const ACCENT_COLORS = [
  { value: 'amber', hex: '#f59e0b' }, { value: 'orange', hex: '#f97316' },
  { value: 'red', hex: '#ef4444' }, { value: 'blue', hex: '#3b82f6' },
  { value: 'green', hex: '#22c55e' }, { value: 'cyan', hex: '#06b6d4' },
];

const isEventSlide = (s) => typeof s.cta_text === 'string' && s.cta_text.startsWith('event:');

export default function SortableSlideCard({ slide, onToggle, onEdit, onDelete, onExport }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const eventSynced = isEventSlide(slide);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-50 z-50')}
      {...attributes}
    >
      <Card className={cn('border-border/60 transition-opacity', !slide.is_active && 'opacity-50', eventSynced && 'border-primary/30 bg-primary/5')}>
        <CardContent className="p-3 flex items-center gap-3">
          <div
            {...listeners}
            className="shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing transition-colors touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-base"
            style={{ background: (ACCENT_COLORS.find(c => c.value === slide.accent_color)?.hex || '#f59e0b') + '22' }}>
            {SLIDE_TYPES.find(t => t.value === slide.slide_type)?.label.split(' ')[0] || '📢'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{slide.title}</p>
              <Badge className={cn('text-[10px] h-4 px-1.5 border', TYPE_COLORS[slide.slide_type])}>
                {SLIDE_TYPES.find(t => t.value === slide.slide_type)?.label.replace(/^.+? /, '') || slide.slide_type}
              </Badge>
              {eventSynced && (
                <Badge className="text-[10px] h-4 px-1.5 border border-primary/30 bg-primary/10 text-primary flex items-center gap-0.5">
                  <RefreshCw className="w-2.5 h-2.5" />
                  Aus Events
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">#{slide.sort_order}</span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {slide.subtitle || slide.location || slide.price_info || `${slide.duration_seconds || 8}s`}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onToggle(slide.id, !slide.is_active)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors" title={slide.is_active ? 'Deaktivieren' : 'Aktivieren'}>
              {slide.is_active ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
            </button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Instagram-Export" onClick={() => onExport(slide)}>
              <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            {!eventSynced && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(slide)} title="Bearbeiten">
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDelete(slide)} title="Löschen">
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}