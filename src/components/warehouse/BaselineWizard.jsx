import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Camera, Image as ImageIcon, Loader2, X, Sparkles, Plus, Minus, Lock, AlertTriangle } from 'lucide-react';
import {
  preparePhoto, uploadCountPhoto, suggestSegmentCount, orderSlotAssignments, MAX_SEGMENTS,
} from '@/lib/photoCount';
import { haptics } from '@/components/utils/haptics';
import { cn } from '@/lib/utils';

const TIP = 'Handy an dieselbe Kante/Markierung, Blitz aus, Fach komplett und senkrecht von oben, Licht an.';
const STEPS = ['Fach', 'Foto', 'Linien', 'Sorten'];

// Probefächer für den Test: oben im Wizard sichtbar und zusätzlich in der Auswahlliste.
const TEST_AREA = 'Raucherbereich';
const TEST_FURNITURE = 'Kühltheke Bar';
const TEST_SLOT_ORDER = [
  'oben links', 'oben mitte links', 'oben mitte rechts', 'oben rechts',
  'unten links', 'unten mitte links', 'unten mitte rechts', 'unten rechts',
];

/**
 * Wizard "Fach-Basis aufnehmen": Referenzfoto + Segmentlinien + Sorten je Segment.
 * Speichert baseline_* am StorageSlot und sperrt die Basis.
 */
export default function BaselineWizard({ open, slots = [], assignments = [], initialSlotId, onClose }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [slotId, setSlotId] = useState(initialSlotId || '');
  const [photo, setPhoto] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [bounds, setBounds] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionNote, setSuggestionNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dragRef = useRef(null);
  const wrapRef = useRef(null);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const slot = slots.find((s) => s.id === slotId) || null;
  const slotAssignments = orderSlotAssignments(assignments.filter((a) => a.storage_slot_id === slotId));
  const testSlots = slots
    .filter((s) => s.area_name === TEST_AREA && s.furniture_name === TEST_FURNITURE)
    .sort((a, b) => {
      const ia = TEST_SLOT_ORDER.indexOf((a.name || '').toLowerCase());
      const ib = TEST_SLOT_ORDER.indexOf((b.name || '').toLowerCase());
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  const testIds = new Set(testSlots.map((s) => s.id));
  const selectableSlots = slots
    .filter((s) => testIds.has(s.id) || assignments.some((a) => a.storage_slot_id === s.id))
    .sort((a, b) => (a.full_name || a.name || '').localeCompare(b.full_name || b.name || '', 'de'));

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSlotId(initialSlotId || '');
    setPhoto(null);
    setBounds([]);
    setDrafts([]);
    setError('');
    setSuggestionNote('');
    if (initialSlotId) prefill(initialSlotId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSlotId]);

  function prefill(id) {
    const s = slots.find((x) => x.id === id);
    const segs = Array.isArray(s?.baseline_segments)
      ? [...s.baseline_segments].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      : [];
    if (segs.length === 0) {
      setBounds([]);
      setDrafts([]);
      return;
    }
    const cuts = segs.slice(0, -1).map((x) => x.x_to);
    setBounds(cuts.every((v) => Number.isFinite(v))
      ? cuts
      : Array.from({ length: segs.length - 1 }, (_, i) => (i + 1) / segs.length));
    setDrafts(segs.map((x, i) => ({
      position: i + 1,
      article_id: x.article_id || '',
      baseline_count: x.baseline_count ?? '',
    })));
  }

  if (!open) return null;

  const segments = bounds.length + 1;
  const ranges = Array.from({ length: segments }, (_, i) => ({
    from: i === 0 ? 0 : bounds[i - 1],
    to: i === bounds.length ? 1 : bounds[i],
  }));

  const selectSlot = (id) => {
    setSlotId(id);
    prefill(id);
    haptics.light();
  };

  const applyCount = (n) => {
    const safe = Math.min(MAX_SEGMENTS, Math.max(1, n));
    setBounds(Array.from({ length: safe - 1 }, (_, i) => Math.round(((i + 1) / safe) * 1000) / 1000));
    setDrafts((prev) => Array.from({ length: safe }, (_, i) => {
      if (prev[i]) return prev[i];
      const assignment = slotAssignments[i] || null;
      return {
        position: i + 1,
        article_id: assignment?.article_id || '',
        baseline_count: assignment?.min_stock ?? '',
      };
    }));
  };

  const handlePick = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    haptics.light();
    setError('');
    setPreparing(true);
    try {
      const prepared = await preparePhoto(picked);
      setPhoto({ ...prepared, preview: URL.createObjectURL(prepared.blob) });
      if (drafts.length === 0) applyCount(1);
    } catch {
      setError('Foto konnte nicht gelesen werden.');
    } finally {
      setPreparing(false);
    }
  };

  const dragLine = (e, idx) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const f = (e.clientX - rect.left) / rect.width;
    const min = idx === 0 ? 0.05 : bounds[idx - 1] + 0.05;
    const max = idx === bounds.length - 1 ? 0.95 : bounds[idx + 1] - 0.05;
    const value = Math.min(max, Math.max(min, f));
    setBounds((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const askModel = async () => {
    if (!photo || suggesting) return;
    setSuggesting(true);
    setSuggestionNote('');
    try {
      const url = await uploadCountPhoto(photo.blob);
      const guess = await suggestSegmentCount({ fileUrl: url, assignments: slotAssignments });
      applyCount(guess.count);
      setSuggestionNote(`Modell schlägt ${guess.count} Segment(e) vor${guess.reason ? ` — ${guess.reason}` : ''}`);
      haptics.medium();
    } catch {
      setSuggestionNote('Modell-Vorschlag nicht verfügbar — Linien bitte manuell setzen.');
    } finally {
      setSuggesting(false);
    }
  };

  const updateDraft = (idx, patch) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const pickArticle = (idx, articleId) => {
    const assignment = slotAssignments.find((a) => a.article_id === articleId) || null;
    updateDraft(idx, {
      article_id: articleId,
      baseline_count: assignment?.min_stock ?? drafts[idx]?.baseline_count ?? '',
    });
  };

  const canNext = step === 1 ? Boolean(slotId) : step === 2 ? Boolean(photo) : true;

  const save = async () => {
    if (!slot || !photo || saving) return;
    setSaving(true);
    setError('');
    try {
      const url = await uploadCountPhoto(photo.blob);
      const user = await base44.auth.me();
      const today = format(new Date(), 'yyyy-MM-dd');
      const segmentPayload = ranges.map((range, i) => {
        const draft = drafts[i] || {};
        const assignment = slotAssignments.find((a) => a.article_id === draft.article_id) || null;
        const count = parseInt(draft.baseline_count, 10);
        return {
          position: i + 1,
          article_id: draft.article_id || '',
          article_name: assignment?.article_name || 'frei/leer',
          baseline_count: Number.isFinite(count) ? Math.max(0, count) : (assignment?.min_stock ?? 0),
          orientation: assignment?.storage_orientation || 'unbekannt',
          x_from: Math.round(range.from * 1000) / 1000,
          x_to: Math.round(range.to * 1000) / 1000,
        };
      });

      const history = Array.isArray(slot.baseline_history) ? [...slot.baseline_history] : [];
      if (slot.baseline_photo_url) {
        history.push({
          photo_url: slot.baseline_photo_url,
          date: slot.baseline_date || '',
          segments: slot.baseline_segments || [],
        });
      }

      await base44.entities.StorageSlot.update(slot.id, {
        baseline_photo_url: url,
        baseline_date: today,
        baseline_by: user?.full_name || user?.email || '',
        baseline_locked: true,
        baseline_segments: segmentPayload,
        baseline_history: history.slice(-5),
        variety_order_confirmed: today,
        variety_order_source: 'foto',
      });
      qc.invalidateQueries({ queryKey: ['slots'] });
      haptics.medium();
      onClose?.();
    } catch {
      setError('Basis konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background sm:items-center sm:justify-center sm:p-4">
      <div className="flex flex-col h-full w-full sm:h-auto sm:max-h-[94vh] sm:max-w-lg bg-background sm:rounded-2xl sm:border sm:border-border overflow-hidden">
        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-border/40 shrink-0">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-primary tracking-tight">Fach-Basis aufnehmen</p>
            <h2 className="text-base font-bold text-foreground truncate">
              {slot ? (slot.full_name || slot.name) : 'Fach wählen'}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Schritt {step} von 4 · {STEPS[step - 1]}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground shrink-0" aria-label="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {step === 1 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Für welches Fach nimmst du die Basis auf?</p>
              {testSlots.length > 0 && (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-2.5 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
                    Probefächer · {TEST_AREA} › {TEST_FURNITURE}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {testSlots.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectSlot(s.id)}
                        className={cn(
                          'px-2 h-8 rounded-lg border text-[11px] font-semibold active:scale-95',
                          slotId === s.id
                            ? 'border-primary bg-primary text-primary-foreground'
                            : s.baseline_photo_url
                              ? 'border-status-ok/40 bg-status-ok/10 text-status-ok dark:text-status-ok'
                              : 'border-border bg-card text-foreground'
                        )}
                      >
                        {s.name}{s.baseline_photo_url ? ' ✓' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <select
                value={slotId}
                onChange={(e) => selectSlot(e.target.value)}
                className="w-full h-12 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">— Fach wählen —</option>
                {selectableSlots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.name}
                    {s.baseline_photo_url ? ' · Basis vorhanden' : ''}
                  </option>
                ))}
              </select>
              {slot?.baseline_locked && (
                <div className="flex items-start gap-2 rounded-xl border border-status-warn/40 bg-status-warn/10 p-2.5">
                  <Lock className="w-4 h-4 text-status-warn shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium text-status-warn dark:text-status-warn">
                    Basis ist gesperrt (aufgenommen {slot.baseline_date || '–'}{slot.baseline_by ? ` von ${slot.baseline_by}` : ''}).
                    Eine neue Aufnahme verschiebt die alte Basis in den Verlauf.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-6 text-center space-y-2">
                <Camera className="w-8 h-8 text-primary mx-auto" />
                <p className="text-sm font-semibold text-foreground">Referenzfoto aufnehmen</p>
                <p className="text-[11px] text-muted-foreground">{TIP}</p>
              </div>
              {preparing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Foto wird vorbereitet…
                </div>
              )}
              {photo && (
                <>
                  <img src={photo.preview} alt="Basis-Foto" className="w-full max-h-64 object-contain rounded-xl bg-muted/30" />
                  <p className="text-[10px] text-muted-foreground text-center">
                    {photo.width} × {photo.height} px · volle Auflösung, EXIF gedreht
                  </p>
                </>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Camera className="w-4 h-4" /> Kamera
                </button>
                <button
                  onClick={() => galleryRef.current?.click()}
                  className="flex-1 h-12 rounded-xl border border-border bg-card text-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <ImageIcon className="w-4 h-4" /> Galerie
                </button>
              </div>
            </div>
          )}

          {step === 3 && photo && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Trennlinien zwischen den Sorten setzen — links nach rechts. Ein Segment darf leer bleiben.
              </p>
              <div ref={wrapRef} className="relative select-none touch-none rounded-xl overflow-hidden bg-black/40">
                <img src={photo.preview} alt="Basis-Foto" className="w-full max-h-[42vh] object-contain" draggable={false} />
                {bounds.map((b, idx) => (
                  <div
                    key={idx}
                    onPointerDown={(e) => {
                      dragRef.current = idx;
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (dragRef.current === idx) dragLine(e, idx);
                    }}
                    onPointerUp={() => { dragRef.current = null; }}
                    onPointerCancel={() => { dragRef.current = null; }}
                    className="absolute inset-y-0 w-8 -ml-4 flex items-center justify-center cursor-col-resize"
                    style={{ left: `${b * 100}%` }}
                  >
                    <span className="w-0.5 h-full bg-primary" />
                    <span className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      ⇔
                    </span>
                  </div>
                ))}
                {ranges.map((r, idx) => (
                  <span
                    key={idx}
                    className="absolute top-1 text-[10px] font-bold text-white bg-black/60 rounded px-1 pointer-events-none"
                    style={{ left: `${((r.from + r.to) / 2) * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    {idx + 1}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => applyCount(segments - 1)}
                  disabled={segments <= 1}
                  className="h-10 px-3 rounded-xl border border-border bg-card text-sm font-semibold text-foreground flex items-center gap-1 disabled:opacity-40"
                >
                  <Minus className="w-4 h-4" /> Segment
                </button>
                <span className="text-sm font-bold text-foreground tabular-nums">{segments} Segmente</span>
                <button
                  onClick={() => applyCount(segments + 1)}
                  disabled={segments >= MAX_SEGMENTS}
                  className="h-10 px-3 rounded-xl border border-border bg-card text-sm font-semibold text-foreground flex items-center gap-1 disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" /> Segment
                </button>
              </div>
              <button
                onClick={askModel}
                disabled={suggesting}
                className="w-full h-10 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Segmentanzahl vom Modell vorschlagen
              </button>
              {suggestionNote && <p className="text-[11px] text-muted-foreground">{suggestionNote}</p>}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Welche Sorte steht in welchem Segment, und wie viele Flaschen bei Vollbestückung?
              </p>
              {ranges.map((range, idx) => (
                <div key={idx} className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(range.from * 100)}–{Math.round(range.to * 100)}% der Breite
                    </span>
                  </div>
                  <select
                    value={drafts[idx]?.article_id || ''}
                    onChange={(e) => pickArticle(idx, e.target.value)}
                    className="w-full h-11 rounded-xl border border-border bg-card px-2 text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">— frei / leer —</option>
                    {slotAssignments.map((a) => (
                      <option key={a.id} value={a.article_id}>{a.article_name}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-muted-foreground flex-1">Flaschen bei Vollbestückung</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={drafts[idx]?.baseline_count ?? ''}
                      onChange={(e) => updateDraft(idx, { baseline_count: e.target.value })}
                      className="w-20 h-10 text-center font-semibold rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border/40 bg-background shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex gap-2">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={saving}
              className="h-12 px-4 rounded-xl border border-border bg-card text-sm font-semibold text-foreground"
            >
              Zurück
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={() => { haptics.selection(); setStep((s) => s + 1); }}
              disabled={!canNext}
              className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] disabled:opacity-40"
            >
              Weiter
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving || !photo || !slot}
              className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Basis speichern & sperren
            </button>
          )}
        </div>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePick} className="hidden" />
      <input ref={galleryRef} type="file" accept="image/*" onChange={handlePick} className="hidden" />
    </div>
  );
}