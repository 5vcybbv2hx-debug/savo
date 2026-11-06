import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Zap, Gauge, BarChart3, CheckCircle2, TrendingDown } from 'lucide-react';
import {
  QUERY_CACHING_STRATEGIES,
  RENDER_OPTIMIZATION,
  APP_CACHING_CONFIG,
  PERFORMANCE_CHECKLIST,
  COMMON_BOTTLENECKS,
  WEB_VITALS,
} from '@/lib/performanceAudit';

/**
 * Performance Audit Dashboard
 * Query-Caching, Render-Optimierung, Best Practices
 */
export default function PerformanceAudit() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Performance Audit</h1>
        <p className="text-muted-foreground">Query-Caching, Render-Optimierung, Bundle-Size</p>
      </div>

      {/* Web Vitals */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Web Vitals Targets</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(WEB_VITALS).map(([key, vital]) => (
            <Card key={key} className="p-4 border-l-4 border-l-blue-500">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-foreground">{key}</h3>
                <Badge variant="outline" className="text-xs">{vital.target}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{vital.name}</p>
              <p className="text-xs text-muted-foreground italic">💡 {vital.how}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Query Caching Strategies */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Query Caching Strategien</h2>
        <div className="space-y-3">
          {QUERY_CACHING_STRATEGIES.map((strategy, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-foreground">{strategy.name}</h3>
                <Zap className="w-4 h-4 text-status-warn shrink-0" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">{strategy.description}</p>
              <code className="text-xs bg-secondary p-2 rounded block mb-2 font-mono">
                {strategy.example}
              </code>
              <p className="text-xs text-status-ok dark:text-status-ok">✓ {strategy.benefit}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* App-Specific Caching Config */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">App-Spezifische Cache-Konfiguration</h2>
        <Card className="p-6 space-y-4">
          {Object.entries(APP_CACHING_CONFIG).map(([entity, config]) => (
            <div key={entity} className="pb-4 border-b border-border last:border-0 last:pb-0">
              <h3 className="font-bold text-foreground mb-2 capitalize">{entity}</h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground font-medium">staleTime</p>
                  <p className="text-foreground font-mono">{`${String((config.staleTime / 60 / 1000).toFixed(0))} min`}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">gcTime</p>
                  <p className="text-foreground font-mono">{`${String((config.gcTime / 60 / 1000).toFixed(0))} min`}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">refetch</p>
                  <p className="text-foreground font-mono">
                    {config.refetchInterval ? `${String((config.refetchInterval / 1000).toFixed(0))}s` : 'on-demand'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </Card>
      </section>

      {/* Render Optimization */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Render-Optimierungs-Techniken</h2>
        <div className="space-y-3">
          {RENDER_OPTIMIZATION.map((opt, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-foreground font-mono text-sm">{opt.technique}</h3>
                <Gauge className="w-4 h-4 text-status-ok shrink-0" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Wann:</strong> {opt.when}
              </p>
              <code className="text-xs bg-secondary p-2 rounded block mb-2 font-mono">
                {opt.code}
              </code>
              <p className="text-xs text-status-ok dark:text-status-ok">
                ⚡ {opt.impact}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Performance Checklist */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Performance Checkliste</h2>
        <div className="space-y-4">
          {PERFORMANCE_CHECKLIST.map(section => (
            <Card key={section.category} className="p-4">
              <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-status-warn" />
                {section.category}
              </h3>
              <ul className="space-y-1">
                {section.items.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    <code className="text-xs bg-secondary px-2 py-1 rounded">
                      {item.split(':')[0]}
                    </code>
                    <span className="ml-2">{item.split(':')[1]}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* Common Bottlenecks */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Häufige Performance-Probleme</h2>
        <div className="space-y-3">
          {COMMON_BOTTLENECKS.map((bottleneck, i) => (
            <Card key={i} className="p-4 border-l-4 border-l-red-500 bg-status-danger/5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-status-danger shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-foreground">{bottleneck.problem}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>Symptom:</strong> {bottleneck.symptom}
                  </p>
                  <p className="text-xs text-status-ok dark:text-status-ok mt-1">
                    <strong>Fix:</strong> {bottleneck.fix}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* How to Measure */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Performance Messen</h2>
        <Card className="p-6 space-y-3">
          <div className="flex gap-3">
            <BarChart3 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">React DevTools Profiler</p>
              <p className="text-sm text-muted-foreground">Chrome DevTools → Profiler Tab: Misst Render-Zeit pro Component</p>
            </div>
          </div>

          <div className="flex gap-3">
            <BarChart3 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">Network Tab</p>
              <p className="text-sm text-muted-foreground">Chrome DevTools → Network: Request-Größe, Caching, Duplicates</p>
            </div>
          </div>

          <div className="flex gap-3">
            <TrendingDown className="w-5 h-5 text-status-ok shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">Lighthouse</p>
              <p className="text-sm text-muted-foreground">Chrome DevTools → Lighthouse: Web Vitals, Performance Score (0-100)</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Zap className="w-5 h-5 text-status-warn shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">React Query DevTools</p>
              <p className="text-sm text-muted-foreground">import ReactQueryDevtools: Zeigt Query-Status, Cache, Stale-Times</p>
            </div>
          </div>
        </Card>
      </section>

      {/* Next Steps */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Implementierungs-Roadmap</h2>
        <Card className="p-6 space-y-3">
          <div className="flex gap-3">
            <Badge variant="default" className="mt-0.5">1</Badge>
            <div>
              <p className="font-bold text-foreground">Baseline messen</p>
              <p className="text-sm text-muted-foreground">Lighthouse Score, Render-Zeit (Profiler), Network-Requests</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Badge variant="default" className="mt-0.5">2</Badge>
            <div>
              <p className="font-bold text-foreground">Query-Caching konfigurieren</p>
              <p className="text-sm text-muted-foreground">staleTime, gcTime pro Entity-Typ setzen</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Badge variant="default" className="mt-0.5">3</Badge>
            <div>
              <p className="font-bold text-foreground">Render-Probleme identifizieren</p>
              <p className="text-sm text-muted-foreground">Profiler nutzen, useMemo/useCallback wo nötig</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Badge variant="default" className="mt-0.5">4</Badge>
            <div>
              <p className="font-bold text-foreground">Code-Splitting implementieren</p>
              <p className="text-sm text-muted-foreground">React.lazy für große Pages</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Badge variant="default" className="mt-0.5">5</Badge>
            <div>
              <p className="font-bold text-foreground">Re-measure & iterate</p>
              <p className="text-sm text-muted-foreground">Target: Lighthouse {">="} 80, LCP less than 2.5s</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}