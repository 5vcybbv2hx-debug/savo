import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScanLine, History, Loader2, Sparkles, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SmartCombobox from '@/components/ui/SmartCombobox';
import UploadZone from '@/components/lieferschein/UploadZone';
import ReviewTable from '@/components/lieferschein/ReviewTable';
import DeliveryHistory from '@/components/lieferschein/DeliveryHistory';
import BookingResult from '@/components/lieferschein/BookingResult';
import { extractDeliveryNote, uploadDeliveryFile } from '@/lib/deliveryNoteExtraction';
import { matchArticle, matchShoppingItem, matchSupplier, normalizeName } from '@/lib/deliveryNoteMatching';
import { cn } from '@/lib/utils';

const today = () => new Date().toISOString().slice(0, 10);

export default function LieferscheinScanner() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('scan');
  const [file, setFile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [error, setError] = useState(null);

  const { data: articles = [] } = useQuery({
    queryKey: ['articles-active-scanner'],
    queryFn: async () => (await base44.entities.Article.filter({ is_active: true }, 'name', 500)) || [],
    placeholderData: [],
    staleTime: 5 * 60_000,
  });

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
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['delivery-notes'],
    queryFn: async () => (await base44.entities.DeliveryNote.list('-delivery_date', 100)) || [],
    placeholderData: [],
  });

  if (!permissions.isLoading && !permissions.canViewWarehouse) return <PermissionDenied />;

  const canWrite = permissions.isAdmin || permissions.isManager || permissions.canEditArticles;

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
      setFile(null);
      setDraft(null);
      setBookingResult(null);
      setError(null);
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
    queryClient.invalidateQueries({ queryKey: ['articles-active-scanner'] });
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
        })),
      });
      const data = response.data;
      if (data?.error) throw new Error(data.error);
      setBookingResult(data);
      setDraft(null);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: ['articles-active-scanner'] });
      queryClient.invalidateQueries({ queryKey: ['shopping-open-scanner'] });
      toast.success(data.summary);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Buchung fehlgeschlagen.');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" /> Lieferschein-Scanner
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Foto oder PDF einlesen, prüfen und in den Wareneingang buchen</p>
        </div>
      </div>

      <div className="inline-flex rounded-xl bg-secondary/60 p-1 gap-1">
        <button
          type="button"
          onClick={() => setTab('scan')}
          className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5',
            tab === 'scan' ? 'bg-card text-foreground shadow' : 'text-muted-foreground')}
        >
          <Sparkles className="w-4 h-4" /> Scannen
        </button>
        <button
          type="button"
          onClick={() => setTab('verlauf')}
          className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5',
            tab === 'verlauf' ? 'bg-card text-foreground shadow' : 'text-muted-foreground')}
        >
          <History className="w-4 h-4" /> Verlauf
        </button>
      </div>

      {tab === 'verlauf' ? (
        <DeliveryHistory notes={notes} isLoading={notesLoading} />
      ) : (
        <div className="space-y-4">
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
                <button type="button" onClick={() => { setError(null); setFile(null); }} className="mt-2 text-xs font-semibold text-primary">
                  Erneut versuchen
                </button>
              </div>
            </div>
          )}

          {bookingResult && <BookingResult result={bookingResult} onReset={() => { setBookingResult(null); setFile(null); setError(null); }} />}

          {draft && !bookingResult && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

              <div className="sticky bottom-16 md:bottom-4 rounded-2xl border border-border bg-card/95 backdrop-blur p-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Bestand, EK-Preise, Preisverlauf und offene Bestellungen werden gebucht.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setDraft(null); setFile(null); }}
                    disabled={isBooking}
                    className="h-11 px-4 rounded-xl bg-secondary text-sm font-semibold text-foreground disabled:opacity-50"
                  >
                    Verwerfen
                  </button>
                  <button
                    type="button"
                    onClick={handleBook}
                    disabled={isBooking || !canWrite}
                    className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isBooking && <Loader2 className="w-4 h-4 animate-spin" />}
                    Wareneingang buchen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}