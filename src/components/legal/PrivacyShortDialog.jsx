import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2 } from 'lucide-react';

export default function PrivacyShortDialog({ open, onAccept, onDecline, isLoading = false }) {
  const [agreed, setAgreed] = useState(false);

  const handleAccept = () => {
    if (agreed) {
      onAccept();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Datenschutz</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <DialogDescription className="text-sm leading-relaxed">
            Diese App verarbeitet personenbezogene Daten (z. B. Mitarbeiterdaten, Arbeitszeiten und Dokumente), um den Betrieb zu organisieren.
          </DialogDescription>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              Bitte bestätige, dass du die Datenschutzerklärung gelesen hast.
            </p>
          </div>

          {/* Checkbox */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="privacy-agree"
              checked={agreed}
              onCheckedChange={setAgreed}
              className="mt-1"
            />
            <label
              htmlFor="privacy-agree"
              className="text-sm font-medium text-foreground cursor-pointer flex-1"
            >
              Ich stimme der Verarbeitung meiner Daten zu
            </label>
          </div>

          {/* Buttons */}
          <div className="space-y-2 pt-2">
            <Button
              asChild
              variant="outline"
              className="w-full"
            >
              <Link to="/MyArea?tab=rechtliches" className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Datenschutzerklärung ansehen
              </Link>
            </Button>

            <Button
              onClick={handleAccept}
              disabled={!agreed || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                'Akzeptieren'
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={onDecline}
              disabled={isLoading}
              className="w-full"
            >
              Ablehnen
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Ohne Zustimmung kann die App nicht genutzt werden.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}