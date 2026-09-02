import { useState, useMemo } from 'react';
import { Calendar, Download, AlertTriangle, FileJson, BarChart3, Clock, Euro, Wine, CalendarDays } from 'lucide-react';

export default function AtlasExport({ base44 }) {
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Schnellwahl
  const quickSelect = (preset) => {
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    let from, to = fmt(today);

    switch (preset) {
      case 'today':
        from = fmt(today);
        break;
      case 'this_week': {
        const day = today.getDay() || 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - day + 1);
        from = fmt(monday);
        break;
      }
      case 'last_week': {
        const day = today.getDay() || 7;
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - day - 6);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        from = fmt(lastMonday);
        to = fmt(lastSunday);
        break;
      }
      case 'this_month':
        from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        break;
      case 'last_month': {
        const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        from = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}-01`;
        to = `${lmEnd.getFullYear()}-${String(lmEnd.getMonth() + 1).padStart(2, '0')}-${String(lmEnd.getDate()).padStart(2, '0')}`;
        break;
      }
      case 'this_year':
        from = `${today.getFullYear()}-01-01`;
        break;
      case 'all':
        from = '2020-01-01';
        break;
    }
    setPeriodFrom(from);
    setPeriodTo(to);
    setPreview(null);
  };

  // Preview laden
  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch('/api/apps/695532713e60f5ccfc3522b9/functions/atlasExport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_from: periodFrom,
          period_to: periodTo,
          preview_only: true,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPreview(data.preview);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Export herunterladen
  const doExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch('/api/apps/695532713e60f5ccfc3522b9/functions/atlasExport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_from: periodFrom,
          period_to: periodTo,
          preview_only: false,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const blob = new Blob([JSON.stringify(data.export_data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `SAVO_ATLAS_${periodFrom}_${periodTo}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileJson className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Atlas Export</h1>
          <p className="text-sm text-muted-foreground">
            Operative Tagesdaten als JSON für die Controlling-App Atlas exportieren
          </p>
        </div>
      </div>

      {/* Zeitraum-Auswahl */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="w-4 h-4" />
          Zeitraum wählen
        </div>

        {/* Schnellwahl */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'today', label: 'Heute' },
            { key: 'this_week', label: 'Diese Woche' },
            { key: 'last_week', label: 'Letzte Woche' },
            { key: 'this_month', label: 'Dieser Monat' },
            { key: 'last_month', label: 'Letzter Monat' },
            { key: 'this_year', label: 'Dieses Jahr' },
            { key: 'all', label: 'Gesamter Zeitraum' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => quickSelect(p.key)}
              className="px-3 py-1.5 text-sm rounded-md border bg-background hover:bg-accent transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Datum-Eingaben */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Von</label>
            <input
              type="date"
              value={periodFrom}
              onChange={e => { setPeriodFrom(e.target.value); setPreview(null); }}
              className="px-3 py-2 text-sm rounded-md border bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Bis</label>
            <input
              type="date"
              value={periodTo}
              onChange={e => { setPeriodTo(e.target.value); setPreview(null); }}
              className="px-3 py-2 text-sm rounded-md border bg-background"
            />
          </div>
          <button
            onClick={loadPreview}
            disabled={loading || !periodFrom || !periodTo}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Lädt...' : 'Vorschau laden'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Fehler: {error}
        </div>
      )}

      {/* Vorschau */}
      {preview && (
        <div className="space-y-4">
          {/* Stat-Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={CalendarDays} label="Betriebstage" value={preview.operating_days} />
            <StatCard icon={Euro} label="Umsatz (brutto)" value={preview.gross_revenue ? `${preview.gross_revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}` : '—'} />
            <StatCard icon={Clock} label="Personalstunden" value={preview.personnel_hours ? `${preview.personnel_hours.toFixed(1)}h` : '—'} />
            <StatCard icon={Euro} label="Personalkosten" value={preview.personnel_cost ? `${preview.personnel_cost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}` : '—'} />
            <StatCard icon={Wine} label="Events" value={preview.events} />
            <StatCard icon={BarChart3} label="Fasswechsel" value={preview.keg_changes || '—'} />
          </div>

          {/* Warnungen */}
          {preview.warnings && preview.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-500">
                <AlertTriangle className="w-4 h-4" />
                {preview.warnings.length} Warnung(en) erkannt
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {preview.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-muted-foreground pl-6">
                    • {w}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Warnungen blockieren den Export nicht. Du kannst trotzdem exportieren.
              </p>
            </div>
          )}

          {/* Export Button */}
          <div className="flex justify-end">
            <button
              onClick={doExport}
              disabled={exporting || preview.operating_days === 0}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Erzeuge Export...' : `JSON herunterladen (${preview.operating_days} Tage)`}
            </button>
          </div>
        </div>
      )}

      {/* Info-Hinweis */}
      {!preview && !loading && (
        <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Wähle einen Zeitraum und lade die Vorschau, um zu sehen welche Daten exportiert werden.
          <br />
          <span className="text-xs">Schema: SAVO_ATLAS_EXPORT_V1 · JSON-Format · Keine NAS/Cloud-Anbindung</span>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
