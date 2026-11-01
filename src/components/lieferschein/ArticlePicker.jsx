import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Package, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ArticlePicker({ articles, value, onChange, onCreate, placeholder = 'Artikel wählen…' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const selected = articles.find((a) => a.id === value) || null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = articles.filter((a) => a.is_active !== false);
    if (!q) return list.slice(0, 12);
    return list
      .filter((a) =>
        a.name?.toLowerCase().includes(q) ||
        a.barcode?.toLowerCase().includes(q) ||
        a.manufacturer?.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [articles, query]);

  const handleCreate = async () => {
    const name = query.trim();
    if (!name || !onCreate) return;
    setCreating(true);
    try {
      const created = await onCreate(name);
      if (created) {
        onChange(created.id);
        setOpen(false);
        setQuery('');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full h-11 px-3 rounded-lg border text-left text-sm flex items-center justify-between gap-2',
          selected ? 'border-border bg-card text-foreground' : 'border-destructive/40 bg-destructive/5 text-muted-foreground'
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 shrink-0 opacity-60" />
          <span className="truncate">{selected ? selected.name : placeholder}</span>
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Artikel suchen…"
                className="w-full bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {results.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { onChange(a.id); setOpen(false); setQuery(''); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="truncate text-foreground">{a.name}</span>
                  {a.id === value && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              ))}
              {results.length === 0 && (
                <p className="px-3 py-3 text-xs text-muted-foreground">Kein Artikel gefunden.</p>
              )}
            </div>
            {onCreate && query.trim().length > 1 && (
              <button
                type="button"
                disabled={creating}
                onClick={handleCreate}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-t border-border text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {creating ? 'Wird angelegt…' : `Neuen Artikel anlegen: „${query.trim()}“`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}