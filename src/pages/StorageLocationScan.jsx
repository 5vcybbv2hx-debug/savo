import { useEffect, useState, useCallback } from 'react';
import { MapPin, Package, CheckCircle2, Circle, AlertTriangle, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';

// ── Inline quantity editor row ────────────────────────────────────────────────
function QuantityRow({ assignment, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(String(assignment.quantity ?? ''));
  const [saving,  setSaving]  = useState(false);
  const [checked, setChecked] = useState(false);

  const isLow = assignment.min_stock != null && (assignment.quantity ?? 0) < assignment.min_stock;

  const save = useCallback(async () => {
    const n = parseFloat(val);
    if (isNaN(n) || n === assignment.quantity) { setEditing(false); return; }
    setSaving(true);
    try {
      // Update via service role through backend function
      await fetch(
        `/api/apps/${import.meta.env.VITE_APP_ID || window.__BASE44_APP_ID__}/functions/updateSlotQuantity`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignmentId: assignment.id, quantity: n }),
        }
      );
      onUpdate(assignment.id, n);
      setChecked(true);
      setTimeout(() => setChecked(false), 3000);
    } catch {
      // Fallback: try direct entity update (works if user is logged in)
      try {
        await base44.entities.StorageAssignment.update(assignment.id, { quantity: n });
        onUpdate(assignment.id, n);
        setChecked(true);
        setTimeout(() => setChecked(false), 3000);
      } catch {
        alert('Fehler beim Speichern — bitte einloggen oder neu versuchen.');
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [val, assignment, onUpdate]);

  return (
    <div className={[
      'flex items-center gap-3 p-4 rounded-xl border transition-all duration-200',
      checked ? 'border-green-500/50 bg-green-500/5'  :
      isLow   ? 'border-red-500/40 bg-red-500/5'      :
                'border-border bg-card',
    ].join(' ')}>

      {/* Check toggle */}
      <button
        onClick={() => setChecked(v => !v)}
        className="shrink-0 touch-manipulation active:scale-90 transition-transform"
        aria-label="Abhaken"
      >
        {checked
          ? <CheckCircle2 className="w-6 h-6 text-green-500" />
          : <Circle       className="w-6 h-6 text-muted-foreground/40" />
        }
      </button>

      {/* Article image / placeholder */}
      {assignment.article_image_url ? (
        <img
          src={assignment.article_image_url}
          alt=""
          className="w-11 h-11 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="w-11 h-11 rounded-lg bg-secondary flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-muted-foreground" />
        </div>
      )}

      {/* Article info */}
      <div className="flex-1 min-w-0">
        <p className={[
          'font-semibold text-sm leading-tight',
          checked ? 'line-through text-muted-foreground' : 'text-foreground',
        ].join(' ')}>
          {assignment.article_name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {isLow && !checked && (
            <span className="flex items-center gap-1 text-[11px] text-red-500 font-medium">
              <AlertTriangle className="w-3 h-3" />
              Nachfüllen
            </span>
          )}
          {assignment.min_stock != null && (
            <span className="text-[11px] text-muted-foreground">
              Min: {assignment.min_stock}{assignment.unit ? ` ${assignment.unit}` : ''}
            </span>
          )}
          {assignment.notes && (
            <span className="text-[11px] text-muted-foreground/70 italic truncate max-w-[120px]">
              {assignment.notes}
            </span>
          )}
        </div>
      </div>

      {/* Quantity — tap to edit */}
      <div className="shrink-0 flex items-center gap-1">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              type="number"
              inputMode="numeric"
              className="w-20 h-10 text-center text-base font-bold"
              value={val}
              onChange={e => setVal(e.target.value)}
              onBlur={save}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
              disabled={saving}
            />
            {assignment.unit && <span className="text-xs text-muted-foreground">{assignment.unit}</span>}
          </div>
        ) : (
          <button
            onClick={() => { setEditing(true); setVal(String(assignment.quantity ?? '')); }}
            className="flex items-center gap-1 group touch-manipulation active:scale-95 transition-transform"
          >
            <span className="text-2xl font-bold text-foreground tabular-nums leading-none">
              {assignment.quantity ?? '—'}
            </span>
            {assignment.unit && (
              <span className="text-xs text-muted-foreground">{assignment.unit}</span>
            )}
            <Pencil className="w-3.5 h-3.5 text-muted-foreground/50 ml-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main scan view ────────────────────────────────────────────────────────────
export default function StorageLocationScan() {
  const [slot,        setSlot]        = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [showNotes,   setShowNotes]   = useState(false);

  // Extract slot ID from URL — supports both /:id and ?slotId=
  const pathParts = window.location.pathname.split('/');
  const slotId    = pathParts[pathParts.length - 1] !== 'StorageLocationScan'
    ? pathParts[pathParts.length - 1]
    : new URLSearchParams(window.location.search).get('slotId');

  // Detect app ID from meta tag or env
  const getAppId = () => {
    const meta = document.querySelector('meta[name="base44-app-id"]');
    if (meta) return meta.getAttribute('content');
    return window.__BASE44_APP_ID__ || '695532713e60f5ccfc3522b9';
  };

  useEffect(() => {
    if (!slotId) {
      setError('Kein Lagerplatz angegeben.');
      setLoading(false);
      return;
    }

    const appId = getAppId();
    // Use backend function — no auth required
    fetch(`/api/apps/${appId}/functions/getSlotData?slotId=${encodeURIComponent(slotId)}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Fehler');
        setSlot(data.slot);
        setAssignments(data.assignments || []);
      })
      .catch(async () => {
        // Fallback: direct entity calls (works when logged in)
        try {
          const [slots, assigns] = await Promise.all([
            base44.entities.StorageSlot.filter({ id: slotId }),
            base44.entities.StorageAssignment.filter({ storage_slot_id: slotId, is_active: true }),
          ]);
          if (!slots || slots.length === 0) throw new Error('not found');
          setSlot(slots[0]);
          setAssignments(assigns || []);
        } catch {
          setError('Lagerplatz nicht gefunden. Bitte QR-Code erneut scannen.');
        }
      })
      .finally(() => setLoading(false));
  }, [slotId]);

  const handleUpdate = useCallback((id, newQty) => {
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, quantity: newQty } : a));
  }, []);

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center">
        <MapPin className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-30" />
        <p className="text-lg font-semibold text-foreground">{error}</p>
        <p className="text-xs text-muted-foreground font-mono mt-2 opacity-60">{slotId}</p>
      </div>
    </div>
  );

  const displayName = slot.full_name || slot.name || 'Lagerplatz';
  const breadcrumb  = [slot.area_name, slot.furniture_name, slot.container_name].filter(Boolean).join(' › ');
  const lowCount    = assignments.filter(a => a.min_stock != null && (a.quantity ?? 0) < a.min_stock).length;
  const okPct       = assignments.length > 0
    ? Math.round((assignments.length - lowCount) / assignments.length * 100)
    : 100;

  return (
    <div className="min-h-screen bg-background pb-16">

      {/* ── Hero Header ─────────────────────────────────────────────── */}
      <div
        className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-b border-border px-4 pb-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}
      >
        <div className="max-w-lg mx-auto">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-3xl shrink-0">
              📦
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-medium text-status-warn tracking-tight mb-0.5">
                Lagerplatz
              </p>
              <h1 className="text-xl font-bold text-foreground leading-tight break-words">
                {displayName}
              </h1>
              {slot.short_code && (
                <Badge className="mt-1 bg-secondary text-foreground text-xs font-mono border-0">
                  {slot.short_code}
                </Badge>
              )}
              {breadcrumb && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{breadcrumb}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="bg-card rounded-xl p-3 text-center border border-border">
              <p className="text-xl font-bold text-foreground leading-none">{assignments.length}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Artikel</p>
            </div>
            <div className={[
              'rounded-xl p-3 text-center border',
              lowCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-card border-border',
            ].join(' ')}>
              <p className={['text-xl font-bold leading-none', lowCount > 0 ? 'text-red-500' : 'text-foreground'].join(' ')}>
                {lowCount}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Nachfüllen</p>
            </div>
            <div className={[
              'rounded-xl p-3 text-center border',
              okPct === 100 ? 'bg-green-500/10 border-green-500/30' : 'bg-card border-border',
            ].join(' ')}>
              <p className={['text-xl font-bold leading-none', okPct === 100 ? 'text-green-500' : 'text-foreground'].join(' ')}>
                {okPct}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">OK</p>
            </div>
          </div>

          {/* Notes toggle */}
          {slot.notes && (
            <>
              <button
                onClick={() => setShowNotes(v => !v)}
                className="mt-3 w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border text-left touch-manipulation"
              >
                <span className="text-xs text-muted-foreground font-medium">Notizen anzeigen</span>
                {showNotes
                  ? <ChevronUp   className="w-4 h-4 text-muted-foreground" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                }
              </button>
              {showNotes && (
                <div className="mt-1 px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-muted-foreground">
                  {slot.notes}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Article list ─────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-5 pt-4 space-y-3">

        {assignments.length > 0 && (
          <p className="text-[11px] text-muted-foreground text-center pb-1">
            Tippe auf die Menge zum Bearbeiten · Haken = geprüft ✓
          </p>
        )}

        {assignments.length === 0 ? (
          <Card className="p-10 text-center border-border">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">Keine Artikel zugeordnet.</p>
          </Card>
        ) : (
          assignments.map(a => (
            <QuantityRow key={a.id} assignment={a} onUpdate={handleUpdate} />
          ))
        )}

        {/* Low stock alert summary */}
        {lowCount > 0 && (
          <div className="mt-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-500">
                {lowCount} {lowCount === 1 ? 'Artikel' : 'Artikel'} unter Mindestbestand
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Bitte zeitnah nachfüllen</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}