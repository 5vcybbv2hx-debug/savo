import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';
import LegalStatusPanel from '@/components/legal/LegalStatusPanel';
import LegalSettingsPanel from '@/components/legal/LegalSettingsPanel';
import ComplianceChecklist from '@/components/legal/ComplianceChecklist';
import CompanyInfoEditor from '@/components/settings/CompanyInfoEditor';
import { PrivacyContent, ImprintContent } from '@/components/legal/ConsentDialog';
import AGBContent from '@/components/legal/AGBContent';
import { Shield, FileText, Building2, CheckSquare } from 'lucide-react';

/**
 * Rechtliches-Tab für MyArea (Manager-only).
 * Bündelt: Legal-Status, CompanyInfoEditor (Impressum-Stammdaten),
 * Compliance-Checklist, LegalSettingsPanel und die migrierten
 * Rechtstexte (Datenschutz, Impressum, AGB) in einem Accordion.
 */
export default function LegalTabContent() {
  return (
    <div className="space-y-6">
      {/* Status: fehlende Pflichtfelder */}
      <section>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-amber-500" />
          Rechtlicher Status
        </h2>
        <LegalStatusPanel />
      </section>

      {/* Impressum-Stammdaten */}
      <section>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-primary" />
          Impressum-Stammdaten
        </h2>
        <Card className="p-4 bg-card border-border">
          <CompanyInfoEditor />
        </Card>
      </section>

      {/* Compliance-Checklist */}
      <section>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
          <CheckSquare className="w-5 h-5 text-emerald-500" />
          Compliance-Checkliste
        </h2>
        <ComplianceChecklist />
      </section>

      {/* Zustimmungen & Dokumente (Dialoge) */}
      <section>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-blue-500" />
          Zustimmungen & Dokumente
        </h2>
        <LegalSettingsPanel />
      </section>

      {/* Rechtstexte als Accordion (migrierte Waisen-Seiten) */}
      <section>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-foreground" />
          Rechtstexte
        </h2>
        <Card className="p-4 bg-card border-border">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="privacy">
              <AccordionTrigger className="text-foreground font-medium">
                Datenschutzerklärung
              </AccordionTrigger>
              <AccordionContent className="max-h-[60vh] overflow-y-auto">
                <PrivacyContent />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="imprint">
              <AccordionTrigger className="text-foreground font-medium">
                Impressum
              </AccordionTrigger>
              <AccordionContent className="max-h-[60vh] overflow-y-auto">
                <ImprintContent />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="agb">
              <AccordionTrigger className="text-foreground font-medium">
                Allgemeine Geschäftsbedingungen
              </AccordionTrigger>
              <AccordionContent className="max-h-[60vh] overflow-y-auto">
                <AGBContent />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </section>
    </div>
  );
}