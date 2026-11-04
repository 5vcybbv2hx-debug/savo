import React from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ArticlePicker from './ArticlePicker';
import { priceDeltaPercent } from '@/lib/deliveryNoteMatching';
import { UNIT_CODES, quantityUnits, unitBreakdown, unitLabel } from '@/lib/deliveryNoteUnits';
import { cn } from '@/lib/utils';

const MATCH_BADGES = {
  artikelnummer: { label: 'Art.-Nr.', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  name: { label: 'Name', className: 'bg-muted text-muted-foreground' },
  manuell: { label: 'manuell', className: 'bg-primary/15 text-primary' },
};

const FieldLabel = ({ children }) => (
  <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 lg:hidden">
    {children}
  </span>
);

function DeltaBadge({ delta }) {
  if (delta === null) return <span className="text-xs text-muted-foreground">–</span>;
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return <span className="inline-flex px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-semibold">0 %</span>;
  const up = rounded > 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold',
      up ? 'bg-destructive/15 text-destructive' : 'bg-emerald-500/15 text-emerald-500'
    )}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {up ? '+' : ''}{rounded} %
    </span>
  );
}

export default function PositionRow({ position, index, articles, openItems, otherPages = [], onChange, onRemove, onCreateArticle }) {
  const article = articles.find((a) => a.id === position.article_id) || null;
  const oldPrice = article?.purchase_price ?? null;
  const hasPrice = position.unit_price != null && !position.price_missing;
  const delta = hasPrice ? priceDeltaPercent(oldPrice, position.unit_price) : null;
  const shoppingItem = openItems.find((i) => i.id === position.shopping_item_id) || null;
  const qtyMismatch = shoppingItem?.quantity != null && position.quantity_packages != null
    && Number(position.quantity_packages) !== Number(shoppingItem.quantity);
  const lineTotal = hasPrice ? (quantityUnits(position) || 0) * (Number(position.unit_price) || 0) : 0;
  const breakdown = unitBreakdown(position);
  const matchBadge = position.article_id ? MATCH_BADGES[position.match_source] : null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_70px_104px_84px_94px_74px_32px] lg:items-start lg:gap-2 lg:space-y-0 space-y-2">
        {/* Erkannte Bezeichnung */}
        <div className="lg:pr-1">
          <FieldLabel>Lieferschein</FieldLabel>
          <div className="flex items-start gap-1.5">
            {position.page_number ? (
              <span className="mt-0.5 shrink-0 px-1.5 py-0.5 rounded-md bg-secondary text-[10px] font-bold text-muted-foreground">
                S. {position.page_number}
              </span>
            ) : null}
            <p className="text-sm font-medium text-foreground break-words leading-snug">{position.raw_text || position.article_name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {position.supplier_article_number ? (
              <span className="px-1.5 py-0.5 rounded-md bg-secondary text-[10px] font-semibold text-muted-foreground num">
                Art.-Nr. {position.supplier_article_number}
              </span>
            ) : null}
            {matchBadge ? (
              <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-bold', matchBadge.className)}>
                {matchBadge.label}
              </span>
            ) : null}
            {breakdown.text ? (
              <span className="text-[11px] text-muted-foreground num">{breakdown.text}</span>
            ) : null}
            {position.content_amount && breakdown.code !== 'Fa' ? (
              <span className="text-[11px] text-muted-foreground num">
                Inhalt: {String(position.content_amount).replace('.', ',')} {position.content_unit || ''}
              </span>
            ) : null}
          </div>
          {otherPages.length > 0 && (
            <span className="block mt-1 text-[11px] text-muted-foreground">
              auch auf Seite {otherPages.join(', ')}
            </span>
          )}
          {(delta !== null && Math.abs(delta) > 5) && (
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-amber-500">
              <AlertTriangle className="w-3 h-3" /> Preisänderung {delta > 0 ? '+' : ''}{Math.round(delta * 10) / 10} %
            </span>
          )}
          {qtyMismatch && (
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-amber-500">
              <AlertTriangle className="w-3 h-3" /> Bestellt: {shoppingItem.quantity}
            </span>
          )}
        </div>

        {/* Artikel */}
        <div className="col-span-2 lg:col-span-1">
          <FieldLabel>Artikel</FieldLabel>
          <ArticlePicker
            articles={articles}
            value={position.article_id}
            onChange={(id) => onChange({ article_id: id })}
            onCreate={onCreateArticle}
          />
          {!position.article_id && (
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-destructive">
              <AlertTriangle className="w-3 h-3" /> Nicht zugeordnet
            </span>
          )}
        </div>

        {/* Menge (Gebinde) */}
        <div>
          <FieldLabel>Menge</FieldLabel>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={position.quantity_packages ?? position.quantity ?? ''}
            onChange={(e) => onChange({ quantity_packages: e.target.value === '' ? null : Number(e.target.value) })}
            className="h-10 text-sm"
          />
        </div>

        {/* Einheit + Gebinde */}
        <div>
          <FieldLabel>Einheit</FieldLabel>
          <Select
            value={position.unit_code || 'St'}
            onValueChange={(v) => onChange({ unit_code: v, unit: unitLabel(v) })}
          >
            <SelectTrigger className="h-10 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_CODES.map((code) => (
                <SelectItem key={code} value={code}>{`${code} · ${unitLabel(code)}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-muted-foreground">×</span>
            <Input
              type="number"
              inputMode="decimal"
              value={position.units_per_packaging ?? 1}
              onChange={(e) => onChange({ units_per_packaging: e.target.value === '' ? 1 : Number(e.target.value) })}
              className="h-7 text-xs px-2"
              placeholder="1"
              title="Stück pro Gebinde (Spalte Geb.)"
            />
          </div>
        </div>

        {/* EK alt */}
        <div>
          <FieldLabel>EK alt</FieldLabel>
          <p className="h-10 flex items-center text-sm text-muted-foreground num">
            {oldPrice != null ? `${Number(oldPrice).toFixed(2)} €` : '–'}
          </p>
        </div>

        {/* EK neu */}
        <div>
          <FieldLabel>EK neu</FieldLabel>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={position.unit_price ?? ''}
            onChange={(e) => onChange({
              unit_price: e.target.value === '' ? null : Number(e.target.value),
              price_missing: e.target.value === '',
            })}
            className="h-10 text-sm"
            placeholder="—"
          />
          {!hasPrice && (
            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
              kein Preis auf Beleg
            </span>
          )}
        </div>

        {/* Delta */}
        <div>
          <FieldLabel>Δ</FieldLabel>
          <div className="h-10 flex items-center"><DeltaBadge delta={delta} /></div>
          <p className="text-[10px] text-muted-foreground num">{hasPrice && lineTotal > 0 ? `${lineTotal.toFixed(2)} €` : ''}</p>
        </div>

        {/* Entfernen */}
        <div className="flex lg:justify-center">
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Zeile entfernen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
}