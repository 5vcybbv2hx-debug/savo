import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, ClipboardList, FileClock, ScanText } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import UploadZone from '@/components/lieferschein/UploadZone';
import ScanDraftForm from '@/components/lieferschein/ScanDraftForm';
import BookingResult from '@/components/lieferschein/BookingResult';
import DeliveryHistory from '@/components/lieferschein/DeliveryHistory';
import { extractDeliveryNote, uploadDeliveryFile, MAX_PAGES } from '@/lib/deliveryNoteExtraction';
import { matchArticleDetailed, matchShoppingItem, matchSupplier, normalizeName } from '@/lib/deliveryNoteMatching';
import { quantityUnits } from '@/lib/deliveryNoteUnits';

const today = () => new Date().toISOString().slice(0, 10);

export default function LieferscheinScanner() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('scan');
  const [pages, setPages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [error, setError] = useState(null);

  const { data: articles = [] } = useQuery({
    queryKey: ['articles'],
    queryFn: async () => (await base44.entities.Article.list('name', 1000)) || [],
    placeholderData: [],
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
    enabled: tab === 'verlauf',
  });

  const reset = () => {
    setPages([]);
    setDraft(null);
    setBookingResult(null);
    setError(null);
  };

  const openItemsForSupplier = (supplierName) => {
    const target = normalizeName(supplierName);
    if (!target) return openItems;
    return openItems.filter((i) => normalizeName(i.category) === target || normalizeName(i.supplier_name) === target);
  };

  const addPages = async (files) => {
    const room = MAX_PAGES - pages.length;
    if (room <= 0) {
      toast.error(`Maximal ${MAX_PAGES} Seiten pro Beleg.`);
      return;
    }
    const list = Array.from(files || []).slice(0, room);
    if (list.length === 0) return;
    setBookingResult(null);
    setError(null);
    setIsUploading(true);
    try {
      const uploaded = [];
      for (const f of list) {
        const url = await uploadDeliveryFile(f);
        uploaded.push({
          id: crypto.randomUUID(),
          name: f.name,
          url,
          isImage: !!f.type?.startsWith('image/'),
        });
      }
      setPages((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e?.message || 'Seite konnte nicht hochgeladen werden.');
    } finally {
      setIsUploading(false);
    }
  };

  const removePage = (id) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  };

  const runExtraction = async () => {
    if (pages.length === 0) return;
    setDraft(null);
    setBookingResult(null);
    setError(null);
    setIsExtracting(true);
    try {
      const extracted = await extractDeliveryNote(pages.map((p) => p.url));
      const supplier = matchSupplier(extracted.supplier_name, suppliers);
      const supplierName = supplier?.name || extracted.supplier_name || '';
      const candidates = openItemsForSupplier(supplierName);

      const positions = extracted.positions.filter((p) => !p.is_return).map((p) => {
        const { article, source } = matchArticleDetailed(p, articles, supplierName);
        const shoppingItem = matchShoppingItem(p, article?.id, candidates);
        const row = {
          _key: crypto.randomUUID(),
          raw_text: p.raw_text,
          article_name: article?.name || p.article_name,
          supplier_article_number: p.supplier_article_number || '',
          article_id: article?.id || '',
          match_source: source || null,
          quantity: p.quantity_packages,
          quantity_packages: p.quantity_packages,
          unit: p.unit || '',
          unit_code: p.unit_code || 'St',
          unit_size: p.units_per_packaging ?? 1,
          units_per_packaging: p.units_per_packaging ?? 1,
          quantity_units: null,
          content_amount: p.content_amount,
          content_unit: p.content_unit,
          unit_price: p.unit_price,
          line_total: p.line_total,
          price_missing: p.price_missing !== false,
          page_number: p.page_number || 1,
          shopping_item_id: shoppingItem?.id || '',
        };
        return { ...row, quantity_units: quantityUnits(row) };
      });

      const returnPositions = extracted.positions.filter((p) => p.is_return).map((p) => ({
        _key: crypto.randomUUID(),
        raw_text: p.raw_text,
        article_name: p.article_name,
        supplier_article_number: p.supplier_article_number || '',
        quantity: p.quantity_packages,
        quantity_packages: p.quantity_packages,
        unit: p.unit || '',
        unit_code: p.unit_code || 'St',
        units_per_packaging: p.units_per_packaging ?? 1,
        quantity_units: quantityUnits(p),
        content_amount: p.content_amount,
        content_unit: p.content_unit,
        page_number: p.page_number || 1,
      }));

      const priced = positions.filter((p) => p.unit_price != null);
      const totalNet = priced.length
        ? priced.reduce((sum, p) => sum + (p.line_total
            ?? (quantityUnits(p) || 0) * (Number(p.unit_price) || 0)), 0)
        : null;

      setDraft({
        document_type: extracted.document_type || 'lieferschein',
        supplier_name: supplierName,
        supplier_id: supplier?.id || '',
        delivery_note_number: extracted.delivery_note_number || '',
        delivery_date: extracted.delivery_date || today(),
        file_url: pages[0]?.url || '',
        file_urls: pages.map((p) => p.url),
        page_count: pages.length,
        missing_pages: extracted.missing_pages || [],
        total_net: totalNet,
        positions,
        return_positions: returnPositions,
      });
    } catch (e) {
      setError(e?.message || 'Der Lieferschein konnte nicht gelesen werden.');
    } finally {
      setIsExtracting(false);
    }
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
        positions: prev.positions.map((p) => ({
          ...p,
          shopping_item_id: matchShoppingItem(p, p.article_id, candidates)?.id || '',
        })),
      };
    });
  };

  const updatePosition = (index, patch) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const positions = prev.positions.map((p, i) => {
        if (i !== index) return p;
        const next = { ...p, ...patch };
        if ('quantity_packages' in patch) next.quantity = patch.quantity_packages;
        if (patch.article_id) {
          const article = articles.find((a) => a.id === patch.article_id);
          if (article) next.article_name = article.name;
          next.match_source = 'manuell';
          const candidates = openItemsForSupplier(prev.supplier_name);
          next.shopping_item_id = matchShoppingItem(next, next.article_id, candidates)?.id || '';
        }
        next.quantity_units = quantityUnits(next);
        return next;
      });
      return { ...prev, positions };
    });
  };

  const removePosition = (index) => {
    setDraft((prev) => prev ? { ...prev, positions: prev.positions.filter((_, i) => i !== index) } : prev);
  };

  const updateReturn = (index, patch) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const return_positions = (prev.return_positions || []).map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, ...patch };
        if ('quantity' in patch) next.quantity_packages = patch.quantity;
        return { ...next, quantity_units: quantityUnits(next) };
      });
      return { ...prev, return_positions };
    });
  };

  const removeReturn = (index) => {
    setDraft((prev) => prev ? { ...prev, return_positions: (prev.return_positions || []).filter((_, i) => i !== index) } : prev);
  };

  const createArticle = async (name) => {
    const created = await base44.entities.Article.create({ name, is_active: true, current_stock: 0 });
    queryClient.invalidateQueries({ queryKey: ['articles'] });
    return created;
  };

  const handleBook = async () => {
    if (!draft) return;
    const positions = draft.positions.filter((p) => p.quantity_packages != null && p.quantity_packages !== 0);
    const returnPositions = (draft.return_positions || []).filter((p) => p.quantity != null && p.quantity !== 0);
    if (positions.length === 0 && returnPositions.length === 0) {
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
          document_type: draft.document_type || 'lieferschein',
          file_url: draft.file_url,
          file_urls: draft.file_urls || [],
          page_count: draft.page_count || 1,
          total_net: draft.total_net ?? null,
        },
        positions: positions.map((p) => ({
          raw_text: p.raw_text,
          article_name: p.article_name,
          article_id: p.article_id,
          supplier_article_number: p.supplier_article_number || '',
          match_source: p.match_source || null,
          quantity: p.quantity_packages,
          quantity_packages: p.quantity_packages,
          unit: p.unit,
          unit_code: p.unit_code,
          unit_size: p.units_per_packaging,
          units_per_packaging: p.units_per_packaging,
          quantity_units: quantityUnits(p),
          content_amount: p.content_amount ?? null,
          content_unit: p.content_unit ?? null,
          unit_price: p.unit_price,
          line_total: p.line_total,
          page_number: p.page_number || 1,
          price_missing: p.unit_price == null,
          shopping_item_id: p.shopping_item_id,
        })),
        return_positions: returnPositions.map((p) => ({
          raw_text: p.raw_text,
          article_name: p.article_name,
          supplier_article_number: p.supplier_article_number || '',
          quantity: p.quantity,
          unit_code: p.unit_code,
          unit: p.unit,
          units_per_packaging: p.units_per_packaging,
          quantity_units: quantityUnits(p),
          content_amount: p.content_amount ?? null,
          content_unit: p.content_unit ?? null,
          page_number: p.page_number || 1,
        })),
      });
      const data = response.data;
      if (data?.error) throw new Error(data.error);
      setBookingResult(data);
      setDraft(null);
      setPages([]);
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: ['shopping-open-scanner'] });
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      toast.success(`${data.counts?.booked || 0} Position${data.counts?.booked === 1 ? '' : 'en'} Ware gebucht`);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Buchung fehlgeschlagen.');
    } finally {
      setIsBooking(false);
    }
  };

  if (!permissions.canViewWarehouse) return <PermissionDenied />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Lieferschein-Scanner</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Foto oder PDF einlesen, Positionen prüfen und als Wareneingang buchen
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-secondary/60 p-1 gap-1 mb-5">
          <button
            type="button"
            onClick={() => setTab('scan')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 ${tab === 'scan' ? 'bg-card text-foreground shadow' : 'text-muted-foreground'}`}
          >
            <ClipboardList className="w-4 h-4" /> Scannen
          </button>
          <button
            type="button"
            onClick={() => setTab('verlauf')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 ${tab === 'verlauf' ? 'bg-card text-foreground shadow' : 'text-muted-foreground'}`}
          >
            <FileClock className="w-4 h-4" /> Verlauf
          </button>
        </div>

        {tab === 'verlauf' ? (
          <DeliveryHistory notes={notes} isLoading={notesLoading} />
        ) : (
          <div className="space-y-4">
            {!draft && !isExtracting && !bookingResult && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <UploadZone
                  pages={pages}
                  onAddFiles={addPages}
                  onRemovePage={removePage}
                  disabled={isExtracting}
                  isUploading={isUploading}
                />
                {pages.length > 0 && (
                  <button
                    type="button"
                    onClick={runExtraction}
                    disabled={isUploading}
                    className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    <ScanText className="w-4 h-4" />
                    {pages.length === 1 ? 'Seite auslesen' : `${pages.length} Seiten auslesen`}
                  </button>
                )}
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
                  <button
                    type="button"
                    onClick={pages.length > 0 ? runExtraction : reset}
                    className="mt-2 text-xs font-semibold text-primary"
                  >
                    Erneut versuchen
                  </button>
                </div>
              </div>
            )}

            {bookingResult && <BookingResult result={bookingResult} onReset={reset} />}

            {draft && !bookingResult && (
              <ScanDraftForm
                draft={draft}
                suppliers={suppliers}
                articles={articles}
                openItems={openItems}
                isBooking={isBooking}
                onSupplierChange={handleSupplierChange}
                onFieldChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
                onChangePosition={updatePosition}
                onRemovePosition={removePosition}
                onChangeReturn={updateReturn}
                onRemoveReturn={removeReturn}
                onCreateArticle={createArticle}
                onBook={handleBook}
                onDiscard={reset}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}