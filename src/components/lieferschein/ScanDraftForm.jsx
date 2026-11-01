import React from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SmartCombobox from '@/components/ui/SmartCombobox';
import ReviewTable from './ReviewTable';

/** Prüfbereich: Kopfdaten des Lieferscheins, Positionen und Buchen. */
export default function ScanDraftForm({
  draft,
  suppliers,
  articles,
  openItems,
  isBooking,
  onSupplierChange,
  onFieldChange,
  onChangePosition,
  onRemovePosition,
  onCreateArticle,
  onBook,
  onDiscard,
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Lieferant</Label>
            <SmartCombobox
              value={draft.supplier_name}
              onChange={onSupplierChange}
              options={suppliers.map((s) => s.name).filter(Boolean)}
              placeholder="Lieferant wählen…"
              allowCreate
            />
          </div>
          <div>
            <Label className="text-xs">Lieferschein-Nr.</Label>
            <Input
              value={draft.delivery_note_number}
              onChange={(e) => onFieldChange({ delivery_note_number: e.target.value })}
              placeholder="z. B. 123456"
            />
          </div>
          <div>
            <Label className="text-xs">Lieferdatum</Label>
            <Input
              type="date"
              value={draft.delivery_date || ''}
              onChange={(e) => onFieldChange({ delivery_date: e.target.value })}
            />
          </div>
        </div>
        {draft.file_url && (
          <a
            href={draft.file_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Original-Lieferschein ansehen
          </a>
        )}
      </div>

      <ReviewTable
        positions={draft.positions}
        articles={articles}
        openItems={openItems}
        onChange={onChangePosition}
        onRemove={onRemovePosition}
        onCreateArticle={onCreateArticle}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={isBooking}
          className="h-11 px-4 rounded-xl bg-secondary text-sm font-semibold text-foreground disabled:opacity-50"
        >
          Verwerfen
        </button>
        <button
          type="button"
          onClick={onBook}
          disabled={isBooking}
          className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
        >
          {isBooking && <Loader2 className="w-4 h-4 animate-spin" />}
          Wareneingang buchen
        </button>
      </div>
    </div>
  );
}