import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Image as ImageIcon, Loader2, X, AlertTriangle, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { haptics } from '@/components/utils/haptics';
import { uploadCountPhoto, recognizeSlotPhoto, orderSlotAssignments, preparePhoto, hasBaseline, MIN_CONFIDENCE } from '@/lib/photoCount';
import PhotoCountReview from './PhotoCountReview';

const TIMEOUT_MS = 45000;

/**
 * Foto-Zählung für ein Fach — Vorschlag aus Foto, Bestätigung durch den Menschen.
 * Wird vom Rundgang genutzt und kann später aus dem Regal-Viewer je Fach geöffnet werden.
 */
export default function PhotoCountSheet({ open, slot, assignments = [], capacity, onClose, onApplied }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('pick'); // pick | analyzing | review | error
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [dimensions, setDimensions] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(null);
  const qc = useQueryClient();
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const jobRef = useRef(0);

  const articleIds = Array.from(new Set(assignments.map((a) => a.article_id).filter(Boolean)));

  const { data: articles = [] } = useQuery({
    queryKey: ['photo-count-articles', articleIds.join(',')],
    queryFn: () => Promise.all(articleIds.map((id) => base44.entities.Article.get(id))),
    enabled: open && articleIds.length > 0,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setPreview(null);
    setStatus('pick');
    setError('');
    setRows([]);
    setResult(null);
    setIsApplying(false);
    setDimensions(null);
    setPreparing(false);
    setOrderConfirmed(slot?.variety_order_confirmed || null);
  }, [open, slot?.id]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (!open) return null;

  const slotLabel = slot?.full_name || slot?.name || 'Fach';
  const slotCapacity = capacity ?? (assignments.reduce((sum, a) => sum + (a.max_stock || 0), 0) || null);
  const incomplete = rows.some((r) => r.count == null);

  // Foto einlesen: EXIF-Orientierung anwenden, volle Auflösung behalten (kein Downscaling).
  const handlePick = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    haptics.light();
    if (preview) URL.revokeObjectURL(preview);
    setStatus('pick');
    setError('');
    setPreparing(true);
    try {
      const prepared = await preparePhoto(picked);
      setFile(prepared.blob);
      setDimensions(prepared);
      setPreview(URL.createObjectURL(prepared.blob));
    } catch {
      setFile(picked);
      setDimensions(null);
      setPreview(URL.createObjectURL(picked));
    } finally {
      setPreparing(false);
    }
  };

  // Eine Zeile je Sorte, in Fachreihenfolge (links → rechts).
  // Vorausgefüllt wird nur, wenn das Foto gut ist UND das Modell sicher genug war.
  const orderedAssignments = orderSlotAssignments(assignments);

  const buildRows = (detection) => {
    // Mit Basis: Segmente der Basis sind das Raster (inkl. leerer Segmente).
    // Ohne Basis: aktive Zuordnungen in Fachreihenfolge.
    const seeds = detection.baselineUsed
      ? detection.baselineSegments.map((seg) => {
          const assignment = orderedAssignments.find((a) => a.article_id === seg.article_id) || null;
          return {
            position: seg.position,
            assignmentId: assignment?.id || `seg-${seg.position}`,
            article_id: seg.article_id || '',
            article_name: seg.article_name || 'frei/leer',
            min_stock: assignment?.min_stock ?? null,
            baselineCount: seg.baseline_count ?? null,
          };
        })
      : orderedAssignments.map((a, idx) => ({
          position: idx + 1,
          assignmentId: a.id,
          article_id: a.article_id,
          article_name: a.article_name,
          min_stock: a.min_stock ?? null,
          baselineCount: null,
        }));

    return seeds.map((seed) => {
      const segment = detection.segments.find((s) => s.article_id && s.article_id === seed.article_id)
        || detection.segments.find((s) => s.position === seed.position)
        || null;
      const confident = Boolean(segment)
        && segment.count != null
        && detection.photoQuality !== 'schlecht'
        && (segment.confidence ?? 0) >= MIN_CONFIDENCE;
      return {
        ...seed,
        suggestion: segment ? segment.count : null,
        confidence: segment ? segment.confidence : 0,
        comment: segment?.comment || '',
        count: confident ? segment.count : null,
        uncertain: !confident,
      };
    });
  };

  // Sortenreihenfolge gegen das Foto bestätigen (Fach-Metadatum).
  const confirmVarietyOrder = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    try {
      await base44.entities.StorageSlot.update(slot.id, {
        variety_order_confirmed: today,
        variety_order_source: 'foto',
      });
      setOrderConfirmed(today);
      haptics.medium();
      qc.invalidateQueries({ queryKey: ['slots'] });
    } catch {
      // Bestätigung ist optional — Zählung bleibt möglich
    }
  };

  const recognize = async () => {
    if (!file) return;
    const token = ++jobRef.current;
    setStatus('analyzing');
    setError('');

    const timer = setTimeout(() => {
      if (jobRef.current !== token) return;
      jobRef.current += 1;
      setStatus('error');
      setError('Erkennung fehlgeschlagen, bitte manuell zählen (Zeitüberschreitung).');
    }, TIMEOUT_MS);

    try {
      const fileUrl = await uploadCountPhoto(file);
      const detection = await recognizeSlotPhoto({ fileUrl, slot, assignments, articles });
      if (jobRef.current !== token) return;
      setResult({ ...detection, fileUrl });
      setRows(buildRows(detection));
      setStatus('review');
      haptics.medium();
    } catch {
      if (jobRef.current !== token) return;
      setStatus('error');
      setError('Erkennung fehlgeschlagen, bitte manuell zählen.');
    } finally {
      clearTimeout(timer);
    }
  };

  const cancelRecognition = () => {
    jobRef.current += 1;
    setStatus('pick');
    setError('');
  };

  const updateRow = (assignmentId, patch) => {
    setRows((prev) => prev.map((r) => (r.assignmentId === assignmentId ? { ...r, ...patch } : r)));
  };

  const apply = async () => {
    if (!result || isApplying) return;
    setIsApplying(true);
    const userName = (await base44.auth.me())?.full_name || '';
    const finalCounts = rows.map((r) => ({
      article_id: r.article_id,
      article_name: r.article_name,
      count: r.count ?? 0,
      opened_partial: r.opened ?? 0,
    }));

    try {
      const sample = await base44.entities.PhotoCountSample.create({
        slot_id: slot?.id,
        slot_full_name: slotLabel,
        area_id: slot?.area_id || '',
        file_url: result.fileUrl,
        baseline_used: Boolean(result.baselineUsed),
        expected_articles: rows.map((r) => {
          const article = articles.find((art) => art.id === r.article_id);
          return {
            article_id: r.article_id,
            article_name: r.article_name,
            content_amount: article?.content_amount ?? 0,
            content_unit: article?.content_unit || 'Stück',
          };
        }),
        model_raw_response: result.raw,
        segments: rows.map((r) => ({
          position: r.position,
          article_id: r.article_id,
          article_name: r.article_name,
          suggested_count: r.suggestion ?? 0,
          confirmed_count: r.count ?? 0,
          delta: (r.count ?? 0) - (r.suggestion ?? 0),
          confidence: r.confidence ?? 0,
        })),
        detected_total: result.detectedTotal ?? 0,
        suggested_counts: rows.map((r) => ({
          article_id: r.article_id,
          article_name: r.article_name,
          count: r.suggestion ?? 0,
          confidence: r.confidence ?? 0,
        })),
        final_counts: finalCounts,
        photo_quality: result.photoQuality,
        notes: result.summary,
        model_hint: result.viewOk ? '' : 'Blickwinkel nicht von oben erkannt',
        created_by_name: userName,
      });

      await base44.entities.Document.create({
        name: `Foto-Zählung ${slotLabel} – ${format(new Date(), 'dd.MM.yyyy HH:mm')}`,
        file_url: result.fileUrl,
        file_type: 'JPG',
        category: 'belege',
        linked_entity_type: 'PhotoCountSample',
        linked_entity_id: sample?.id || '',
        linked_entity_name: slotLabel,
        tags: ['foto-zaehlung'],
      });
    } catch {
      // Zählung darf trotzdem übernommen werden
    }

    onApplied?.(Object.fromEntries(rows.map((r) => [r.assignmentId, r.count ?? 0])));
    setIsApplying(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background sm:items-center sm:justify-center sm:p-4">
      <div className="flex flex-col h-full w-full sm:h-auto sm:max-h-[92vh] sm:max-w-md bg-background sm:rounded-2xl sm:border sm:border-border overflow-hidden">
        {/* Kopf */}
        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-border/40 shrink-0">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-primary tracking-tight">Foto-Zählung</p>
            <h2 className="text-base font-bold text-foreground truncate">{slotLabel}</h2>
            <p className="text-[11px] text-muted-foreground">
              {assignments.length} Artikel
              {slotCapacity ? ` · Kapazität ${slotCapacity} Flaschen/Dosen` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground shrink-0" aria-label="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inhalt */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {status === 'pick' && !preview && (
            <div className="space-y-3">
              <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-8 text-center space-y-2">
                <Camera className="w-8 h-8 text-primary mx-auto" />
                <p className="text-sm font-semibold text-foreground">Fach von oben fotografieren</p>
                <p className="text-xs text-muted-foreground">Ganzes Fach im Bild, möglichst von oben und hell.</p>
              </div>
              {!hasBaseline(slot) && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Basis fehlt – einmal im Rundgang unter „Fächer ohne Basis" aufnehmen.
                </p>
              )}
              <button
                onClick={() => cameraRef.current?.click()}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Camera className="w-4 h-4" /> Kamera
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                className="w-full h-12 rounded-xl border border-border bg-card text-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <ImageIcon className="w-4 h-4" /> Galerie
              </button>
            </div>
          )}

          {preparing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Foto wird vorbereitet…
            </div>
          )}

          {preview && status !== 'review' && (
            <>
              <img src={preview} alt="Fach-Foto" className="w-full max-h-64 object-contain rounded-xl bg-muted/30" />
              {dimensions?.portrait && (
                <div className="flex items-start gap-2 rounded-xl border border-status-warn/40 bg-status-warn/10 p-2.5">
                  <AlertTriangle className="w-4 h-4 text-status-warn shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium text-status-warn dark:text-status-warn">
                    Foto quer halten, Fach komplett im Bild — hochkant erkennt das Modell schlechter.
                  </p>
                </div>
              )}
              {dimensions && (
                <p className="text-[10px] text-muted-foreground text-center">
                  {dimensions.width} × {dimensions.height} px · volle Auflösung
                </p>
              )}
            </>
          )}

          {status === 'pick' && preview && (
            <div className="flex gap-2">
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex-1 h-11 rounded-xl border border-border bg-card text-sm font-semibold text-foreground"
              >
                Neues Foto
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex-1 h-11 rounded-xl border border-border bg-card text-sm font-semibold text-foreground"
              >
                Galerie
              </button>
            </div>
          )}

          {status === 'analyzing' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm font-medium text-foreground">Foto wird ausgewertet…</p>
              <p className="text-xs text-muted-foreground">Abbruch nach 45 Sekunden möglich.</p>
              <button onClick={cancelRecognition} className="text-xs font-semibold text-muted-foreground underline">
                Abbrechen
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-destructive">{error}</p>
                <p className="text-[11px] text-muted-foreground">Der Rundgang bleibt offen, du kannst normal weiterzählen.</p>
              </div>
            </div>
          )}

          {status === 'review' && result && (
            <PhotoCountReview
              rows={rows}
              onChange={updateRow}
              photoQuality={result.photoQuality}
              summary={result.summary}
              unknownItems={result.unknownItems}
              onManual={onClose}
              preview={preview}
              baselineUrl={result.baselineUsed ? slot?.baseline_photo_url : null}
              baselineSegments={result.baselineSegments || []}
              detectedTotal={result.detectedTotal}
              orderConfirmed={orderConfirmed}
              onConfirmOrder={confirmVarietyOrder}
            />
          )}
        </div>

        {/* Fuß */}
        <div className="px-4 py-3 border-t border-border/40 bg-background shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {status === 'review' ? (
            <>
              <button
                onClick={apply}
                disabled={isApplying || incomplete}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
              >
                {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                In Rundgang übernehmen
              </button>
              {incomplete && (
                <p className="text-[10px] text-status-warn dark:text-status-warn text-center mt-1.5">
                  Bitte alle Mengen bestätigen — nichts wird automatisch gebucht
                </p>
              )}
            </>
          ) : status === 'analyzing' ? (
            <button onClick={cancelRecognition} className="w-full h-12 rounded-xl border border-border text-sm font-semibold text-muted-foreground">
              Abbrechen
            </button>
          ) : status === 'error' ? (
            <div className="flex gap-2">
              {preview && (
                <button onClick={recognize} className="flex-1 h-12 rounded-xl border border-border bg-card text-sm font-semibold text-foreground">
                  Erneut versuchen
                </button>
              )}
              <button onClick={onClose} className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground text-sm font-bold">
                Manuell zählen
              </button>
            </div>
          ) : (
            <button
              onClick={recognize}
              disabled={!file || preparing}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4" /> Erkennen
            </button>
          )}
        </div>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePick} className="hidden" />
      <input ref={galleryRef} type="file" accept="image/*" onChange={handlePick} className="hidden" />
    </div>
  );
}