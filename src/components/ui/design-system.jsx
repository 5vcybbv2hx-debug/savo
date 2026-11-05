import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Design System Showcase
 * Zeige alle Farben, Komponenten und Patterns
 */
export function DesignSystemShowcase() {
  return (
    <div className="min-h-screen bg-background p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Design System</h1>
        <p className="text-muted-foreground">BarManager — Zentrale Farb- & Komponentenbibliothek</p>
      </div>

      {/* ── Farbpalette ── */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Farbpalette</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: 'Background', class: 'bg-background border border-border', text: 'text-foreground' },
            { name: 'Card', class: 'bg-card border border-border', text: 'text-card-foreground' },
            { name: 'Primary', class: 'bg-primary', text: 'text-primary-foreground' },
            { name: 'Secondary', class: 'bg-secondary', text: 'text-secondary-foreground' },
            { name: 'Muted', class: 'bg-muted', text: 'text-muted-foreground' },
            { name: 'Accent', class: 'bg-accent', text: 'text-accent-foreground' },
            { name: 'Destructive', class: 'bg-destructive', text: 'text-destructive-foreground' },
            { name: 'Border', class: 'bg-background border-2 border-border', text: 'text-foreground' },
            { name: 'Input', class: 'bg-input border border-input', text: 'text-foreground' },
          ].map(c => (
            <div key={c.name} className={`rounded-lg p-4 ${c.class}`}>
              <p className={`text-sm font-medium ${c.text}`}>{c.name}</p>
              <p className={`text-xs ${c.text} opacity-70`}>var(--{c.name.toLowerCase()})</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Buttons ── */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="default">Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      {/* ── Cards ── */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Cards</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Standard Card</h3>
            <p className="text-muted-foreground text-sm">Verwendet bg-card mit border-border</p>
          </Card>
          <Card className="p-6 border-amber-500/30 bg-amber-500/5">
            <h3 className="text-lg font-semibold text-foreground mb-2">Accent Card</h3>
            <p className="text-muted-foreground text-sm">Mit custom Accent-Border</p>
          </Card>
        </div>
      </section>

      {/* ── Badges ── */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-600/30">Custom Brand</Badge>
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-600/30">Success</Badge>
        </div>
      </section>

      {/* ── Status States ── */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Status States</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 rounded-lg border border-green-500/30 bg-green-500/5">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-green-500">Success</p>
              <p className="text-sm text-muted-foreground">Verwendung: bg-green-500/5, border-green-500/30, text-green-500</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-red-500">Error/Destructive</p>
              <p className="text-sm text-muted-foreground">Verwendung: bg-destructive/5, border-destructive/30, text-destructive</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Typographie ── */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Typographie</h2>
        <div className="space-y-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Heading 1 (3xl bold)</h1>
            <p className="text-xs text-muted-foreground mt-1">Hero-Titel, Page-Überschriften</p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Heading 2 (2xl bold)</h2>
            <p className="text-xs text-muted-foreground mt-1">Section-Titel</p>
          </div>
          <div>
            <p className="text-base text-foreground">Body Text (base)</p>
            <p className="text-xs text-muted-foreground mt-1">Standard Paragraph, Copy</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Small Text (sm muted)</p>
            <p className="text-xs text-muted-foreground mt-1">Sekundärer Text, Labels</p>
          </div>
        </div>
      </section>

      {/* ── Best Practices ── */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Best Practices</h2>
        <Card className="p-6 space-y-3">
          <div>
            <p className="font-semibold text-foreground">✅ Nutze CSS-Variablen überall:</p>
            <code className="text-xs bg-secondary p-2 rounded block mt-1">
              &lt;div className="bg-card text-card-foreground border border-border"&gt;
            </code>
          </div>
          <div>
            <p className="font-semibold text-foreground">❌ Vermeide hardcoded Farben:</p>
            <code className="text-xs bg-secondary p-2 rounded block mt-1 text-red-400">
              &lt;div className="bg-[#ffffff] text-[#000000]"&gt;
            </code>
          </div>
          <div>
            <p className="font-semibold text-foreground">💡 Für Brand-Gradients:</p>
            <code className="text-xs bg-secondary p-2 rounded block mt-1">
              style={`{ background: 'linear-gradient(to right, var(--brand-from), var(--brand-via))', color: 'var(--brand-fg)' }`}
            </code>
          </div>
        </Card>
      </section>
    </div>
  );
}

/**
 * Page Layout Components
 */
export function PageShell({ children, className = '' }) {
  return (
    <div className={`min-h-screen bg-background p-6 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({ value = 0, max = 100, className = '' }) {
  const percentage = (value / max) * 100;
  return (
    <div className={`w-full bg-secondary rounded-full overflow-hidden h-2 ${className}`}>
      <div
        className="bg-amber-500 h-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export default DesignSystemShowcase;