import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CONSENT_DIALOG_TEXT, PRIVACY_POLICY_CONTENT, IMPRINT_CONTENT } from '@/lib/legalContent';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ConsentDialog({ open, onConsent, isLoading = false }) {
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [imprintAccepted, setImprintAccepted] = useState(false);
  const [activeTab, setActiveTab] = useState('dialog');

  const handleAccept = async () => {
    if (!privacyAccepted || !imprintAccepted) {
      toast.error('Bitte akzeptieren Sie beide Dokumente');
      return;
    }

    const success = await onConsent(privacyAccepted, imprintAccepted);
    if (success) {
      toast.success('Zustimmung gespeichert');
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background p-0 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 sticky top-0 z-10 bg-background">
            <TabsTrigger value="dialog">Dialog</TabsTrigger>
            <TabsTrigger value="privacy">Datenschutz</TabsTrigger>
            <TabsTrigger value="imprint">Impressum</TabsTrigger>
          </TabsList>

          {/* Dialog Tab */}
          <TabsContent value="dialog" className="space-y-6 p-4 sm:p-6 m-0">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-foreground">
                {CONSENT_DIALOG_TEXT.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {CONSENT_DIALOG_TEXT.subtitle}
              </p>
            </div>

            <p className="text-sm text-foreground leading-relaxed">
              {CONSENT_DIALOG_TEXT.description}
            </p>

            {/* Checkboxes */}
            <div className="space-y-4">
              {CONSENT_DIALOG_TEXT.items.map(item => (
                <Card key={item.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={item.id}
                        checked={item.id === 'privacy' ? privacyAccepted : imprintAccepted}
                        onCheckedChange={checked => {
                          if (item.id === 'privacy') {
                            setPrivacyAccepted(checked);
                          } else {
                            setImprintAccepted(checked);
                          }
                        }}
                        className="mt-1"
                      />
                      <label
                        htmlFor={item.id}
                        className="flex-1 cursor-pointer"
                      >
                        <p className="font-semibold text-sm text-foreground">
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      </label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setActiveTab('privacy')}
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {CONSENT_DIALOG_TEXT.buttons.viewPrivacy}
                </span>
                <span className="sm:hidden text-xs">Datenschutz</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveTab('imprint')}
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {CONSENT_DIALOG_TEXT.buttons.viewImprint}
                </span>
                <span className="sm:hidden text-xs">Impressum</span>
              </Button>
            </div>

            <Button
              onClick={handleAccept}
              disabled={!privacyAccepted || !imprintAccepted || isLoading}
              className="w-full h-11"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                CONSENT_DIALOG_TEXT.buttons.accept
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              {CONSENT_DIALOG_TEXT.footer}
            </p>
          </TabsContent>

          {/* Privacy Policy Tab */}
          <TabsContent value="privacy" className="space-y-6 p-4 sm:p-6 m-0 max-h-[calc(90vh-120px)] overflow-y-auto">
            <PrivacyContent />
            <div className="space-y-2">
              <Label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={privacyAccepted}
                  onCheckedChange={setPrivacyAccepted}
                />
                <span className="text-sm font-medium">
                  Ich akzeptiere die Datenschutzerklärung
                </span>
              </Label>
            </div>
          </TabsContent>

          {/* Imprint Tab */}
          <TabsContent value="imprint" className="space-y-6 p-4 sm:p-6 m-0 max-h-[calc(90vh-120px)] overflow-y-auto">
            <ImprintContent />
            <div className="space-y-2">
              <Label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={imprintAccepted}
                  onCheckedChange={setImprintAccepted}
                />
                <span className="text-sm font-medium">
                  Ich habe das Impressum zur Kenntnis genommen
                </span>
              </Label>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Datenschutzerklärung Inhalt (reusable)
 */
export function PrivacyContent() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="page-title">
          {PRIVACY_POLICY_CONTENT.sections.intro.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {PRIVACY_POLICY_CONTENT.sections.intro.content}
        </p>
      </div>

      {Object.entries(PRIVACY_POLICY_CONTENT.sections).filter(([k]) => k !== 'intro').map(([key, section]) => (
        <div key={key} className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            {section.title}
          </h2>

          {section.content && (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {section.content}
            </p>
          )}

          {section.subsections?.map((sub, idx) => (
            <div key={idx} className="ml-4 space-y-2">
              <h3 className="font-medium text-sm text-foreground">
                {sub.title}
              </h3>
              {sub.items && (
                <ul className="space-y-1">
                  {sub.items.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              {sub.content && (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {sub.content}
                </p>
              )}
            </div>
          ))}

          {section.items && (
            <ul className="space-y-2">
              {section.items.map((item, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                  <span>•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Impressum Inhalt (reusable)
 */
export function ImprintContent() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="page-title">Impressum</h1>
        <p className="text-sm text-muted-foreground">
          Letztes Update: {IMPRINT_CONTENT.lastUpdated}
        </p>
      </div>

      {Object.entries(IMPRINT_CONTENT.sections).map(([key, section]) => (
        <div key={key} className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            {section.title}
          </h2>

          {section.content && (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {section.content}
            </p>
          )}

          {section.items && (
            <ul className="space-y-2">
              {section.items.map((item, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-medium text-foreground">{item.label}:</span>
                  <span className="text-muted-foreground ml-2">{item.value}</span>
                </div>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}