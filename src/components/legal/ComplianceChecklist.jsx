import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

const ComplianceChecklist = () => {
  const items = [
    {
      category: '✅ Implementiert',
      items: [
        { name: 'Impressum-Seite', status: 'done' },
        { name: 'Datenschutzerklärung', status: 'done' },
        { name: 'Zustimmungs-Dialog', status: 'done' },
        { name: 'Zustimmungs-Versionierung', status: 'done' },
        { name: 'Einwilligungs-Bestätigung beim Login', status: 'done' },
        { name: 'PrivacyCenter (Datenrechte)', status: 'done' },
        { name: 'Audit-Log Entity', status: 'done' },
        { name: 'AGB-Seite', status: 'done' },
      ]
    },
    {
      category: '🟡 Teilweise (Server-Side nötig)',
      items: [
        { name: 'Row-Level Security (RLS) für Employee', status: 'done', note: 'checkEmployeeAccess ist in EmployeeProfile verdrahtet (fehloffen)' },
        { name: 'RLS für EmployeeDocument', status: 'done', note: 'secureDocumentDownload liefert Signatur-URL, prüft Eigentümer/Manager' },
        { name: 'Audit-Logging Integration', status: 'done', note: 'Dokument ansehen/hochladen/löschen schreibt in AccessLog' },
        { name: 'Document Access Control', status: 'partial', note: 'Signatur + Rate-Limiting' },
      ]
    },
    {
      category: '🔴 Empfohlen (Optional)',
      items: [
        { name: 'Retention Policies', status: 'todo', note: 'Archivierung nach X Jahren' },
        { name: 'Fine-Grained Permissions', status: 'todo', note: 'Module-spezifische Rollen' },
        { name: 'PDF Export', status: 'todo', note: 'Persondaten als PDF' },
        { name: 'Data Minimization Audit', status: 'todo', note: 'Formulare überprüfen' },
      ]
    }
  ];

  const getIcon = (status) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="w-4 h-4 text-status-ok" />;
      case 'partial':
        return <Clock className="w-4 h-4 text-status-warn" />;
      case 'todo':
        return <AlertCircle className="w-4 h-4 text-status-danger" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {items.map((section, idx) => (
        <Card key={idx} className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {section.category}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {section.items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded hover:bg-accent/50 transition-colors">
                  {getIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    {item.note && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Quick Stats */}
      <Card className="bg-gradient-to-br from-status-ok/10 to-status-ok/10 border-status-ok/20">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-status-ok">8</p>
              <p className="text-xs text-muted-foreground">Implementiert</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-status-warn">4</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-status-danger">4</p>
              <p className="text-xs text-muted-foreground">Optional</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceChecklist;