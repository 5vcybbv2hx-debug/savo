import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { DEPRECATED_ENTITIES, getDeleteableSafely, getMigrationChecklist } from '@/lib/deprecatedEntitiesAudit';

/**
 * Deprecated Entities Audit Dashboard
 * Status, Dependencies, Migration-Pfade
 */
export default function DeprecatedEntitiesAudit() {
  const deletable = getDeleteableSafely();
  const checklist = getMigrationChecklist();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Deprecated Entities Audit</h1>
        <p className="text-muted-foreground">Status veralteter Entities und Migration-Pfade</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-red-500">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Deprecated</p>
          <p className="text-3xl font-bold text-foreground mt-2">
            {DEPRECATED_ENTITIES.filter(e => e.status === 'DEPRECATED').length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Entities zu migrieren</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">In Progress</p>
          <p className="text-3xl font-bold text-foreground mt-2">
            {DEPRECATED_ENTITIES.filter(e => e.status === 'SEMI-DEPRECATED').length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Teilweise veraltet</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-green-500">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Löschbar</p>
          <p className="text-3xl font-bold text-foreground mt-2">{deletable.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Ohne Daten-Verlust</p>
        </Card>
      </div>

      {/* Detailed List */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Entities Übersicht</h2>
        <div className="space-y-3">
          {DEPRECATED_ENTITIES.map(entity => (
            <Card key={entity.name} className="p-4 overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-foreground">{entity.name}</h3>
                    <Badge
                      variant={entity.safeToDelete ? 'outline' : 'default'}
                      className={entity.safeToDelete ? 'bg-status-ok/10 text-status-ok border-status-ok/30' : 'bg-status-danger/10 text-status-danger border-status-danger/30'}
                    >
                      {entity.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{entity.reason}</p>
                </div>

                {entity.safeToDelete && (
                  <Trash2 className="w-5 h-5 text-status-ok shrink-0 ml-2" />
                )}
              </div>

              {/* Replacement */}
              <div className="mb-3 p-3 bg-secondary/30 rounded-lg">
                <p className="text-xs text-muted-foreground font-medium">Ersetzt durch:</p>
                <p className="text-sm text-foreground font-semibold mt-1">{entity.replacedBy}</p>
              </div>

              {/* Migration Steps */}
              <div className="mb-3">
                <p className="text-xs text-muted-foreground font-medium uppercase mb-2">Migration-Schritte:</p>
                <ol className="space-y-1 text-xs">
                  {entity.migrationPath.map((step, i) => (
                    <li key={i} className="text-muted-foreground pl-4 relative">
                      <span className="absolute left-0">→</span> {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Dependencies */}
              {entity.dependencies.length > 0 && (
                <div className="mb-3 p-3 bg-status-warn/5 border border-status-warn/20 rounded-lg">
                  <p className="text-xs text-status-warn dark:text-status-warn font-medium">Dependencies:</p>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {entity.dependencies.map((dep, i) => (
                      <li key={i}>• {dep}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-between items-center text-xs text-muted-foreground border-t border-border pt-3">
                <div>Last Used: {entity.lastUsed}</div>
                {entity.safeToDelete && (
                  <Badge variant="outline" className="bg-status-ok/10 text-status-ok">
                    ✓ Sicher zu löschen
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Migration Checklist */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Migration Checklist</h2>
        <Card className="p-6 space-y-4">
          {checklist.map(item => (
            <div key={item.entity} className="pb-4 border-b border-border last:border-0 last:pb-0">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-status-warn" />
                <h3 className="font-bold text-foreground">{item.entity}</h3>
                <Badge
                  variant="outline"
                  className={item.priority === 'high' ? 'bg-status-danger/10 text-status-danger border-status-danger/30' : 'bg-primary/10 text-primary border-primary/30'}
                >
                  {item.priority.toUpperCase()}
                </Badge>
              </div>
              <ol className="space-y-1 text-sm text-muted-foreground pl-6">
                {item.steps.map((step, i) => (
                  <li key={i} className="list-decimal">{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </Card>
      </section>

      {/* Safe to Delete */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">🗑️ Sicher zu Löschen</h2>
        {deletable.length > 0 ? (
          <div className="space-y-2">
            {deletable.map(entity => (
              <Card key={entity.name} className="p-4 border-l-4 border-l-green-500 bg-status-ok/5">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground">{entity.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{entity.notes}</p>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-status-ok shrink-0 ml-2" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-4 text-center text-muted-foreground">
            Alle veralteten Entities haben noch Dependencies. Erst migrieren!
          </Card>
        )}
      </section>

      {/* Next Steps */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Nächste Schritte</h2>
        <Card className="p-6 space-y-3">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-status-warn shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">1. Exportiere alle Daten</p>
              <p className="text-sm text-muted-foreground">Sicherung aller deprecated Entities vor Migration</p>
            </div>
          </div>

          <div className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">2. Führe Migration durch</p>
              <p className="text-sm text-muted-foreground">Folge den Schritten in der Migration Checklist</p>
            </div>
          </div>

          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-status-warn shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">3. Validiere Dependencies</p>
              <p className="text-sm text-muted-foreground">Stelle sicher, dass alle Verknüpfungen aktualisiert sind</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Trash2 className="w-5 h-5 text-status-danger shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">4. Lösche veraltete Entities</p>
              <p className="text-sm text-muted-foreground">Nur Entities ohne Dependencies</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}