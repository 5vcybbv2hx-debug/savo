import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PrivacyContent, ImprintContent } from '@/components/legal/ConsentDialog';
import { useConsent } from '@/components/legal/useConsent';
import { usePermissions } from '@/components/auth/usePermissions';
import { FileText, Clock, AlertCircle, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

export default function LegalSettingsPanel() {
  const { userConsent, needsNewConsent } = useConsent();
  const permissions = usePermissions();
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showImprint, setShowImprint] = useState(false);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">⚖️ Rechtliches & Datenschutz</h3>
        <p className="text-sm text-muted-foreground">
          Verwalten Sie Ihre Zustimmungen und lesen Sie unsere rechtlichen Dokumente.
        </p>
      </div>

      {/* Warning if new consent needed */}
      {needsNewConsent && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Unsere Datenschutzerklärung wurde aktualisiert. Bitte bestätigen Sie die neue Version.
          </AlertDescription>
        </Alert>
      )}

      {/* Consent Status */}
      {userConsent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">✅ Ihre Zustimmung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-foreground">Datenschutzerklärung:</span>
                <span className="text-muted-foreground ml-2">
                  {userConsent.privacy_accepted ? '✓ Akzeptiert' : '✗ Nicht akzeptiert'}
                </span>
              </p>
              <p>
                <span className="font-medium text-foreground">Impressum:</span>
                <span className="text-muted-foreground ml-2">
                  {userConsent.imprint_accepted ? '✓ Zur Kenntnis genommen' : '✗ Nicht bestätigt'}
                </span>
              </p>
              {userConsent.accepted_date && (
                <p>
                  <span className="font-medium text-foreground">Zustimmung vom:</span>
                  <span className="text-muted-foreground ml-2">
                    {formatDistanceToNow(new Date(userConsent.accepted_date), {
                      addSuffix: true,
                      locale: de
                    })}
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Privacy Policy */}
        <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <h4 className="font-semibold text-sm text-foreground">
                      📋 Datenschutzerklärung
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Wie wir Ihre Daten verarbeiten
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Datenschutzerklärung</DialogTitle>
              <DialogDescription>
                Lesen Sie unsere vollständige Datenschutzerklärung
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <PrivacyContent />
            </div>
          </DialogContent>
        </Dialog>

        {/* Imprint */}
        <Dialog open={showImprint} onOpenChange={setShowImprint}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <h4 className="font-semibold text-sm text-foreground">
                      🏢 Impressum
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Kontaktdaten & Betreiber
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Impressum</DialogTitle>
              <DialogDescription>
                Kontaktdaten und rechtliche Angaben
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <ImprintContent />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Admin: Audit Log */}
      {(permissions.isAdmin || permissions.isManager) && (
        <div className="pt-6 border-t border-border/50 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">Admin-Bereich</h3>
          </div>
          <Card className="bg-amber-500/10 border-amber-500/20 p-4">
            <p className="text-xs text-amber-200 mb-3">
              Zugriffs- und Änderungsprotokoll für Compliance & Audits
            </p>
            <Button
              size="sm"
              onClick={() => window.location.href = '/AuditLog'}
              className="w-full"
            >
              → Audit-Log ansehen
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}