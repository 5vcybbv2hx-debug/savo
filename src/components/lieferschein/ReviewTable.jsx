import React from 'react';
import { AlertTriangle } from 'lucide-react';
import PositionRow from './PositionRow';
import { normalizeName } from '@/lib/deliveryNoteMatching';
import { quantityUnits } from '@/lib/deliveryNoteUnits';

const pageKey = (position) =>
  position.article_id || normalizeName(`${position.article_name || ''} ${position.raw_text || ''}`);

export default function ReviewTable({ positions, articles, openItems, onChange, onRemove, onCreateArticle }) {
  const assigned = positions.filter((p) => p.article_id);
  const priced = positions.filter((p) => p.unit_price != null);
  const totalNet = priced.reduce(
    (sum, p) => sum + (quantityUnits(p) || 0) * (Number(p.unit_price) || 0),
    0
  );
  const unassigned = positions.length - assigned.length;

  // Gleicher Artikel auf mehreren Seiten → getrennt bleiben, aber Hinweis "auch auf Seite X".
  const pagesByKey = positions.reduce((acc, p) => {
    const key = pageKey(p);
    if (!key) return acc;
    acc[key] = acc[key] || new Set();
    if (p.page_number) acc[key].add(p.page_number);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <div className="hidden lg:grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_70px_104px_84px_94px_74px_32px] gap-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Lieferschein</span>
        <span>Artikel</span>
        <span>Menge</span>
        <span>Einheit</span>
        <span>EK alt</span>
        <span>EK neu</span>
        <span>Δ</span>
        <span />
      </div>

      {positions.map((position, index) => {
        const key = pageKey(position);
        const otherPages = key
          ? Array.from(pagesByKey[key] || []).filter((page) => page !== position.page_number).sort((a, b) => a - b)
          : [];
        return (
          <PositionRow
            key={position._key || index}
            position={position}
            index={index}
            articles={articles}
            openItems={openItems}
            otherPages={otherPages}
            onChange={(patch) => onChange(index, patch)}
            onRemove={onRemove}
            onCreateArticle={onCreateArticle}
          />
        );
      })}

      {positions.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Keine Positionen – bitte manuell hinzufügen oder neu scannen.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/60 border border-border px-3 py-2.5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{positions.length} Position{positions.length === 1 ? '' : 'en'}</span>
          <span>·</span>
          <span>{assigned.length} zugeordnet</span>
          {unassigned > 0 && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-status-warn font-semibold">
                <AlertTriangle className="w-3 h-3" /> {unassigned} ohne Artikel
              </span>
            </>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Summe netto</p>
          {priced.length > 0 ? (
            <p className="text-lg font-bold text-foreground num">{totalNet.toFixed(2)} €</p>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">— <span className="text-[10px] font-normal">kein Preis auf Beleg</span></p>
          )}
        </div>
      </div>
    </div>
  );
}