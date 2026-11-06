import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Download, Trash2, Edit, AlertCircle, Loader2, CheckCircle2, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function PrivacyCenter() {
  const [currentUser, setCurrentUser] = React.useState(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Export personal data mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) throw new Error('Benutzer nicht authentifiziert');

      // Fetch user's personal data
      const userData = { ...currentUser };
      const myEmployee = await base44.entities.Employee.filter({ email: currentUser.email });
      const myDocs = myEmployee[0] ? await base44.entities.EmployeeDocument.filter({ employee_id: myEmployee[0].id }) : [];
      const myTimeEntries = await base44.entities.TimeEntry.filter({ created_by: currentUser.email });

      const exportData = {
        user: userData,
        employee: myEmployee[0] || null,
        documents: myDocs,
        timeEntries: myTimeEntries,
        exportDate: new Date().toISOString()
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meine-daten-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      return exportData;
    },
    onSuccess: () => {
      toast.success('Ihre Daten wurden heruntergeladen');
    },
    onError: (error) => {
      toast.error('Fehler beim Export: ' + error.message);
    }
  });

  // Request account deletion
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) throw new Error('Benutzer nicht authentifiziert');

      // Call delete function (serverside)
      await base44.functions.invoke('requestAccountDeletion', {
        email: currentUser.email
      });

      return true;
    },
    onSuccess: () => {
      toast.success('Löschanfrage eingereicht. Sie werden kontaktiert.');
      setShowDeleteWarning(false);
      setDeleteConfirm('');
      // Logout after 3 seconds
      setTimeout(() => base44.auth.logout(), 3000);
    },
    onError: (error) => {
      toast.error('Fehler: ' + error.message);
    }
  });

  return (
    <div className="space-y-6">
      {/* Privacy Header */}
      <Card className="border-status-warn/25 dark:border-status-warn/70 bg-status-warn/15 dark:bg-status-warn/20">
        <CardHeader>
          <div className="flex items-start gap-4">
            <Shield className="w-6 h-6 text-status-warn mt-1 shrink-0" />
            <div>
              <CardTitle>Datenschutz & Ihre Rechte</CardTitle>
              <CardDescription className="text-status-warn dark:text-status-warn/25 mt-2">
                Gemäß DSGVO (Datenschutz-Grundverordnung) haben Sie Rechte auf Auskunft, Berichtigung, Löschung und Datenübertragung.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="rights" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rights">Ihre Rechte</TabsTrigger>
          <TabsTrigger value="data">Meine Daten</TabsTrigger>
          <TabsTrigger value="policy">Richtlinie</TabsTrigger>
        </TabsList>

        {/* Tab 1: Rights & Info */}
        <TabsContent value="rights" className="space-y-4 mt-6">
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">📋 Auskunftsrecht (Art. 15 DSGVO)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Sie können jederzeit eine Auskunft darüber anfordern, welche personenbezogenen Daten über Sie gespeichert sind.</p>
                <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending} variant="outline" className="w-full mt-2 h-10">
                  {exportMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Wird vorbereitet...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Meine Daten exportieren
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">✏️ Berichtigungsrecht (Art. 16 DSGVO)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Sie können unrichtige Daten korrigieren oder ergänzen. Besuchen Sie Ihr Profil oder kontaktieren Sie Ihren Manager.</p>
                <Button variant="outline" className="w-full mt-2 h-10">
                  <Edit className="w-4 h-4 mr-2" />
                  Zum Profil
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">🗑️ Löschungsrecht (Art. 17 DSGVO)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Sie können verlangen, dass Ihre personenbezogenen Daten gelöscht werden (unter Vorbehalt rechtlicher Aufbewahrungsfristen).</p>
                <Button onClick={() => setShowDeleteWarning(true)} variant="destructive" className="w-full mt-2 h-10">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Löschanfrage stellen
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">📤 Datenübertragbarkeit (Art. 20 DSGVO)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Sie können Ihre Daten in einem strukturierten, gängigen Format erhalten.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: My Data Overview */}
        <TabsContent value="data" className="space-y-4 mt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Hier sehen Sie eine Übersicht der über Sie gespeicherten Daten. Für Details oder Korrekturen nutzen Sie bitte die einzelnen Bereiche der App.
            </AlertDescription>
          </Alert>

          {currentUser && (
            <div className="space-y-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">👤 Profildaten</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1 text-muted-foreground">
                  <p><strong>Name:</strong> {currentUser.full_name}</p>
                  <p><strong>E-Mail:</strong> {currentUser.email}</p>
                  <p><strong>Rolle:</strong> {currentUser.role}</p>
                  <p className="text-xs pt-2">Konto erstellt: {new Date(currentUser.created_date).toLocaleDateString('de-DE')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">📄 Speicherkategorien</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-status-ok" />
                    <span>Personalbogendaten</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-status-ok" />
                    <span>Zeiterfassungsdaten</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-status-ok" />
                    <span>Hochgeladene Dokumente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-status-ok" />
                    <span>Schichtpläne & Verfügbarkeit</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Policy */}
        <TabsContent value="policy" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datenschutzrichtlinie</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-4">
              <div>
                <h4 className="font-semibold text-foreground mb-1">Wer ist verantwortlich?</h4>
                <p>Der Betreiber dieser App ist verantwortlich für die Verarbeitung Ihrer Daten.</p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-1">Welche Daten werden erfasst?</h4>
                <p>Personenbezogene Daten wie Name, E-Mail, Telefon, Geburtsdatum, Bankdaten und Dokumente. Alle Daten sind für die Verwaltung des Betriebs und die Einhaltung gesetzlicher Anforderungen erforderlich.</p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-1">Wie lange werden Daten gespeichert?</h4>
                <p>Mitarbeiterdaten werden mindestens 6 Jahre nach Austritt aufbewahrt (gesetzliche Anforderung). Sie können früher gelöscht werden, sofern keine Aufbewahrungspflichten bestehen.</p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-1">Wer kann meine Daten sehen?</h4>
                <p>Nur autorisierte Manager und Admin-Nutzer. Mitarbeiter sehen nur ihre eigenen Daten. Daten werden nicht an Dritte weitergegeben.</p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-1">Wie kann ich meine Rechte ausüben?</h4>
                <p>Nutzen Sie die Funktionen in dieser App oder kontaktieren Sie den Betreiber direkt.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Warning Dialog */}
      <Dialog open={showDeleteWarning} onOpenChange={setShowDeleteWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Löschanfrage bestätigen</DialogTitle>
            <DialogDescription>
              Dies ist ein ernster Schritt. Alle Ihre personenbezogenen Daten werden nach rechtlicher Überprüfung gelöscht.
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-status-danger/20 bg-status-danger/15 dark:bg-status-danger/20">
            <AlertCircle className="h-4 w-4 text-status-danger" />
            <AlertDescription className="text-status-danger dark:text-status-danger/25 text-sm">
              Geben Sie zur Bestätigung <strong>"LÖSCHEN"</strong> ein.
            </AlertDescription>
          </Alert>

          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Geben Sie 'LÖSCHEN' ein"
            className="w-full h-10 px-3 rounded-md border border-input bg-transparent"
          />

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowDeleteWarning(false)} className="flex-1">
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteConfirm !== 'LÖSCHEN' || deleteMutation.isPending}
              className="flex-1"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird verarbeitet...
                </>
              ) : (
                'Unwiderruflich löschen'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}