import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SmartCombobox from '@/components/ui/SmartCombobox';
import UploadZone from './UploadZone';
import ReviewTable from './ReviewTable';
import BookingResult from './BookingResult';
import { extractDeliveryNote, uploadDeliveryFile } from '@/lib/deliveryNoteExtraction';
import { matchArticle, matchShoppingItem, matchSupplier, normalizeName } from '@/lib/deliveryNoteMatching';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Lieferschein-Scan als Vollbild-Sheet über der Inventur.
 * Die Inventur-Seite bleibt gemountet — Session, Zählwerte und Filter bleiben erhalten.
 */
export default function DeliveryScanSheet({ open, onOpenChange, articles = [], countedArticleIds, onBooked }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [error, setError] = useState(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-scanner'],
    queryFn: async () => (await base44.entities.Supplier.list('name')) || [],
    placeholderData: [],
    staleTime: 10 * 60_000,
  });

  const { data: openItems = [] } = useQuery({
    queryKey: ['shopping-open-scanner'],
    queryFn: async () => (await base44.entities.ShoppingList.filter({ status: { $in: ['offen', 'bestellt'] } }, '-created_date', 300)) || [],
    placeholderData: [],
    enabled: open,
  });

  const isCounted = (articleId) => !!(articleId && countedArticleIds?.has?.(articleId));

  /** Vorauswahl: bereits gezählt → nur Preis, sonst Bestand buchen. */
  const defaultAction = (articleId) => (isCounted(articleId) ? 'price' : 'stock');

  const reset = () => {
    setFile(null);
    setDraft(null);
    setBookingResult(null);
    setError(null);
  };

  const handleOpenChange = (next) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const openItemsForSupplier = (supplierName) => {
    const target = normalizeName(supplierName);
    if (!target) return openItems;
    return openItems.filter((i) => normalizeName(i.category) === target || normalizeName(i.supplier_name) === target);
  };

  const handleSupplierChange = (name) => {
    const supplier = matchSupplier(name, suppliers);
    setDraft((prev) => {
      if (!prev) return prev;
      const candidates = openItemsForSupplier(supplier?.name || name);
      return {
        ...prev,
        supplier_name: supplier?.name || name,
        supplier_id: supplier?.id || '',
        positions: prev.positions.map((p) => {
          const shoppingItem = matchShoppingItem(p, p.article_id, candidates);
          return { ...p, shopping_item_id: shoppingItem?.id || '' };
        }),
      };
    });
  };

  const handleFile = async (selected) => {
    if (!selected) {
      reset();
      return;
    }
    setFile(selected);
    setDraft(null);
    setBookingResult(null);
    setError(null);
    setIsExtracting(true);
    try {
      const fileUrl = await uploadDeliveryFile(selected);
      const extracted = await extractDeliveryNote(fileUrl);
      const supplier = matchSupplier(extracted.supplier_name, suppliers);
      const supplierName = supplier?.name || extracted.supplier_name || '';
      const candidates = openItemsForSupplier(supplierName);

      const positions = extracted.positions.map((p) => {
        const article = matchArticle(p, articles, supplierName);
        const shoppingItem = matchShoppingItem(p, article?.id, candidates);
        return {
          _key: crypto.randomUUID(),
          raw_text: p.raw_text,
          article_name: article?.name || p.article_name,
          article_id: article?.id || '',
          quantity: p.quantity,
          unit: p.unit || 'Stück',
          unit_size: p.unit_size ?? 1,
          unit_price: p.unit_price,
          line_total: p.line_total,
          shopping_item_id: shoppingItem?.id || '',
          action: defaultAction(article?.id),
        };
      });

      setDraft({
        supplier_name: supplierName,
        supplier_id: supplier?.id || '',
        delivery_note_number: extracted.delivery_note_number || '',
        delivery_date: extracted.delivery_date || today(),
        file_url: fileUrl,
        total_net: extracted.total_net,
        positions,
        notes: '',
      });
    } catch (e) {
      setError(e?.message || 'Der Lieferschein konnte nicht gelesen werden.');
    } finally {
      setIsExtracting(false);
    }
  };

  const updatePosition = (index, patch) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const positions = prev.positions.map((p, i) => {
        if (i !== index) return p;
        const next = { ...p, ...patch };
        if ('article_id' in patch) {
          const article = articles.find((a) => a.id === patch.article_id);
          if (article) next.article_name = article.name;
          const candidates = openItemsForSupplier(prev.supplier_name);
          next.shopping_item_id = matchShoppingItem(next, next.article_id, candidates)?.id || '';
          // Vorauswahl neu bewerten, wenn die Artikel-Zuordnung wechselt und noch nichts gewählt wurde
          if (!('action' in patch)) next.action = defaultAction(next.article_id);
        }
        return next;
      });
      return { ...prev, positions };
    });
  };

  const removePosition = (index) => {
    setDraft((prev) => prev ? { ...prev, positions: prev.positions.filter((_, i) => i !== index) } : prev);
  };

  const createArticle = async (name) => {
    const created = await base44.entities.Article.create({ name, is_active: true, current_stock: 0 });
    queryClient.invalidateQueries({ queryKey: ['articles'] });
    return created;
  };

  const handleBook = async () => {
    if (!draft) return;
    const positions = draft.positions.filter((p) => p.quantity != null && p.quantity !== 0);
    if (positions.length === 0) {
      toast.error('Keine Positionen mit Menge vorhanden.');
      return;
    }
    setIsBooking(true);
    try {
      const response = await base44.functions.invoke('bookDeliveryNote', {
        deliveryNote: {
          supplier_name: draft.supplier_name,
          supplier_id: draft.supplier_id,
          delivery_note_number: draft.delivery_note_number,
          delivery_date: draft.delivery_date,
          file_url: draft.file_url,
          total_net: draft.total_net ?? null,
          notes: draft.notes,
        },
        positions: positions.map((p) => ({
          raw_text: p.raw_text,
          article_name: p.article_name,
          article_id: p.article_id,
          quantity: p.quantity,
          unit: p.unit,
          unit_size: p.unit_size,
          unit_price: p.unit_price,
          line_total: p.line_total,
          shopping_item_id: p.shopping_item_id,
          action: p.action || 'stock',
        })),
      });
      const data = response.data;
      if (data?.error) throw new Error(data.error);
      setBookingResult(data);
      setDraft(null);
      setFile(null);

      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-notes-today'] });
      queryClient.invalidateQueries({ queryKey: ['shopping-open-scanner'] });
      onBooked?.(data);

      const changes = data.priceChanges?.length || 0;
      toast.success(`${data.booked?.length || 0} Position${data.booked?.length === 1 ? '' : 'en'} gebucht`, {
        description: `${changes} Preisänderung${changes === 1 ? '' : 'en'}${data.priceOnly?.length ? ` · ${data.priceOnly.length} nur Preis` : ''}`,
      });
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Buchung fehlgeschlagen.');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col gap-0">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <SheetTitle className="text-base font-bold text-foreground">Lieferschein scannen</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Foto oder PDF einlesen, prüfen und direkt in die Inventur buchen
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"
            title="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!draft && !isExtracting && !bookingResult && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <UploadZone file={file} onSelect={handleFile} disabled={isExtracting} />
            </div>
          )}

          {isExtracting && (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <Loader2 className="w-7 h-7 mx-auto text-primary animate-spin" />
              <p className="mt-3 text-sm font-medium text-foreground">Lieferschein wird gelesen…</p>
              <p className="text-xs text-muted-foreground mt-1">Positionen werden erkannt und mit Artikeln abgeglichen</p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Lesen fehlgeschlagen</p>
                <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
                <button type="button" onClick={reset} className="mt-2 text-xs font-semibold text-primary">
                  Erneut versuchen
                </button>
              </div>
            </div>
          )}

          {bookingResult && <BookingResult result={bookingResult} onReset={reset} />}

          {draft && !bookingResult && (
            <>
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Lieferant</Label>
                    <SmartCombobox
                      value={draft.supplier_name}
                      onChange={handleSupplierChange}
                      options={suppliers.map((s) => s.name).filter(Boolean)}
                      placeholder="Lieferant wählen…"
                      allowCreate
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Lieferschein-Nr.</Label>
                    <Input
                      value={draft.delivery_note_number}
                      onChange={(e) => setDraft((prev) => ({ ...prev, delivery_note_number: e.target.value }))}
                      placeholder="z. B. 123456"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Lieferdatum</Label>
                    <Input
                      type="date"
                      value={draft.delivery_date || ''}
                      onChange={(e) => setDraft((prev) => ({ ...prev, delivery_date: e.target.value }))}
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
                onChange={updatePosition}
                onRemove={removePosition}
                onCreateArticle={createArticle}
              />

              <div className="rounded-2xl border border-border bg-card p-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  „Bestand buchen“ zählt die Ware zu, „Nur Preis übernehmen“ lässt den Bestand unverändert.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    disabled={isBooking}
                    className="h-11 px-4 rounded-xl bg-secondary text-sm font-semibold text-foreground disabled:opacity-50"
                  >
                    Verwerfen
                  </button>
                  <button
                    type="button"
                    onClick={handleBook}
                    disabled={isBooking}
                    className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isBooking && <Loader2 className="w-4 h-4 animate-spin" />}
                    Buchen
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}