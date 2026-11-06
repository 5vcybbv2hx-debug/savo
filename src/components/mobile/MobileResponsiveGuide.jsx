import { MOBILE_CHECKLIST, MOBILE_PATTERNS } from '@/lib/mobileResponsiveUtils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Phone, Tablet, Monitor } from 'lucide-react';

/**
 * Mobile Responsive Guide
 * Zeigt Best Practices und Checkliste
 */
export default function MobileResponsiveGuide() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Mobile Responsive Guide</h1>
        <p className="text-muted-foreground">Best Practices für mobile-first Design in BarManager</p>
      </div>

      {/* Viewport Sizes */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Breakpoints (Tailwind)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-l-4 border-l-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-foreground">Mobile</h3>
            </div>
            <p className="text-sm text-muted-foreground">&lt; 640px</p>
            <code className="text-xs bg-secondary p-2 rounded block mt-2">max-w-screen-sm</code>
          </Card>

          <Card className="p-4 border-l-4 border-l-amber-500">
            <div className="flex items-center gap-2 mb-2">
              <Tablet className="w-5 h-5 text-status-warn" />
              <h3 className="font-bold text-foreground">Tablet (md)</h3>
            </div>
            <p className="text-sm text-muted-foreground">≥ 768px</p>
            <code className="text-xs bg-secondary p-2 rounded block mt-2">md:flex md:p-6</code>
          </Card>

          <Card className="p-4 border-l-4 border-l-green-500">
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="w-5 h-5 text-status-ok" />
              <h3 className="font-bold text-foreground">Desktop (lg)</h3>
            </div>
            <p className="text-sm text-muted-foreground">≥ 1024px</p>
            <code className="text-xs bg-secondary p-2 rounded block mt-2">lg:flex lg:p-8</code>
          </Card>
        </div>
      </section>

      {/* Common Patterns */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Häufige Mobile Patterns</h2>
        <div className="space-y-3">
          {Object.entries(MOBILE_PATTERNS).map(([key, value]) => (
            <Card key={key} className="p-4">
              <p className="font-mono text-xs text-muted-foreground mb-2">{key}</p>
              <code className="text-sm bg-secondary p-3 rounded block break-all font-mono">
                className="{value}"
              </code>
            </Card>
          ))}
        </div>
      </section>

      {/* Checkliste */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Mobile-First Checkliste</h2>
        <div className="space-y-4">
          {MOBILE_CHECKLIST.map(section => (
            <Card key={section.category} className="p-4">
              <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-status-warn" />
                {section.category}
              </h3>
              <ul className="space-y-2">
                {section.items.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    <code className="text-xs bg-secondary px-2 py-1 rounded">
                      {item.split(':')[0].trim()}
                    </code>
                    <span className="ml-2">{item.split(':')[1]?.trim()}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* Bad vs Good Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">❌ Falsch vs ✅ Richtig</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Bad */}
          <Card className="p-4 border-l-4 border-l-red-500">
            <h3 className="font-bold text-status-danger mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Falsch
            </h3>
            <div className="space-y-2 text-xs">
              <code className="block bg-secondary p-2 rounded">
                className="flex gap-8 p-8"
              </code>
              <p className="text-muted-foreground">→ Zu viel Padding auf Mobile</p>
              
              <code className="block bg-secondary p-2 rounded mt-3">
                className="grid grid-cols-4"
              </code>
              <p className="text-muted-foreground">→ 4 Spalten auf Mobile zu eng</p>
              
              <code className="block bg-secondary p-2 rounded mt-3">
                className="w-80"
              </code>
              <p className="text-muted-foreground">→ Fixed width: überläuft auf Mobile</p>
            </div>
          </Card>

          {/* Good */}
          <Card className="p-4 border-l-4 border-l-green-500">
            <h3 className="font-bold text-status-ok mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Richtig
            </h3>
            <div className="space-y-2 text-xs">
              <code className="block bg-secondary p-2 rounded">
                className="flex gap-2 md:gap-8 p-3 md:p-8"
              </code>
              <p className="text-muted-foreground">→ Responsive spacing</p>
              
              <code className="block bg-secondary p-2 rounded mt-3">
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
              </code>
              <p className="text-muted-foreground">→ Responsive grid layout</p>
              
              <code className="block bg-secondary p-2 rounded mt-3">
                className="w-full md:w-80"
              </code>
              <p className="text-muted-foreground">→ Full-width on Mobile, fixed on Desktop</p>
            </div>
          </Card>
        </div>
      </section>

      {/* Safe Area Insets */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Safe Area Insets (Notches)</h2>
        <Card className="p-4 bg-status-warn/5 border-status-warn/30">
          <p className="text-sm text-muted-foreground mb-3">
            Für iPhone X+ mit Notch/Dynamic Island verwende Safe Area Insets:
          </p>
          <div className="space-y-2">
            <code className="text-xs bg-secondary p-2 rounded block">className="pt-safe pb-safe"</code>
            <code className="text-xs bg-secondary p-2 rounded block">style={`{ paddingTop: 'env(safe-area-inset-top)' }`}</code>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Automatisch in Layout definiert. Nutze pb-safe bei Bottom-Navs!
          </p>
        </Card>
      </section>

      {/* Testing */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Mobile Testen</h2>
        <Card className="p-4">
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              <strong>Chrome DevTools:</strong> F12 → Toggle device toolbar (Ctrl+Shift+M)
            </p>
            <p className="text-muted-foreground">
              <strong>Test-Sizes:</strong> 375px (iPhone SE), 390px (iPhone 12), 428px (iPhone 14 Pro), 768px (iPad)
            </p>
            <p className="text-muted-foreground">
              <strong>Touch-Simulation:</strong> DevTools → ESC → Rendering → Emulate CSS media feature prefers-reduced-motion
            </p>
            <p className="text-muted-foreground">
              <strong>Performance:</strong> Throttle CPU (4x slowdown) für mobile Performance-Testing
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}