import React, { useState } from 'react';
import { ExternalLink, FileText, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const fmtDate = (value) => {
  if (!value) return '–';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function DeliveryHistory({ notes = [], isLoading }) {
  const [selected, setSelected] = useState(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <FileText className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
        <p className="mt-2 text-sm text-muted-foreground">Noch keine Lieferscheine gebucht.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {notes.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => setSelected(note)}
            className="w-full text-left rounded-xl border border-border bg-card p-3 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{note.supplier_name || 'Unbekannter Lieferant'}</p>
                <p className="text-xs text-muted-foreground">
                  {note.delivery_note_number ? `Nr. ${note.delivery_note_number} · ` : ''}{fmtDate(note.delivery_date)}
                </p>
              </div>
              <span className={cn(
                'shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase',
                note.status === 'gebucht' ? 'bg-status-ok/15 text-status-ok' : 'bg-muted text-muted-foreground'
              )}>
                {note.status === 'gebucht' ? 'Gebucht' : 'Entwurf'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Package className="w-3.5 h-3.5" /> {note.positions_count ?? note.positions?.length ?? 0} Positionen
              </span>
              <span className="font-semibold text-foreground num">
                {Number(note.total_net || 0).toFixed(2)} €
              </span>
            </div>
            {note.file_url && (
              <span
                role="link"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); window.open(note.file_url, '_blank', 'noopener'); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); window.open(note.file_url, '_blank', 'noopener'); } }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Beleg
              </span>
            )}
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selected?.supplier_name} · {selected?.delivery_note_number || 'ohne Nr.'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">{fmtDate(selected?.delivery_date)}</p>

          <div className="space-y-1.5 mt-2">
            {(selected?.positions || []).map((p, i) => (
              <div key={i} className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.article_name || p.raw_text}</p>
                    {p.raw_text && p.article_name && p.raw_text !== p.article_name && (
                      <p className="text-[11px] text-muted-foreground truncate">{p.raw_text}</p>
                    )}
                  </div>
                  {!p.booked && (
                    <span className="shrink-0 text-[10px] font-bold uppercase text-status-warn">nicht gebucht</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground num">
                  <span>{p.quantity ?? '–'} {p.unit || ''}</span>
                  {p.unit_size > 1 && <span>× {p.unit_size} Stk/Geb.</span>}
                  <span>EK {p.unit_price != null ? `${Number(p.unit_price).toFixed(2)} €` : '–'}</span>
                  {p.line_total != null && <span>Summe {Number(p.line_total).toFixed(2)} €</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Summe netto</span>
            <span className="text-sm font-bold text-foreground num">{Number(selected?.total_net || 0).toFixed(2)} €</span>
          </div>

          {selected?.booking_summary && (
            <p className="text-xs text-muted-foreground">{selected.booking_summary}</p>
          )}

          {selected?.file_url && (
            <a
              href={selected.file_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-secondary text-sm font-medium text-foreground w-fit"
            >
              <ExternalLink className="w-4 h-4" /> Beleg öffnen
            </a>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}