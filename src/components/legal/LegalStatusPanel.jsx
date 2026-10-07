import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import LegalSetupWizard from './LegalSetupWizard';
import { getMissingRequiredFields, getCompletionPercentage } from '@/lib/legalContent';
import { Link } from 'react-router-dom';

export default function LegalStatusPanel() {
  const [companyInfo, setCompanyInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const result = await base44.entities.CompanyInfo.list();
      if (result.length > 0) {
        setCompanyInfo(result[0]);
      } else {
        setCompanyInfo(null);
      }
    } catch (error) {
      console.error('Error loading company info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 text-center text-muted-foreground text-sm">
          Wird geladen...
        </CardContent>
      </Card>
    );
  }

  const missing = getMissingRequiredFields(companyInfo);
  const completion = getCompletionPercentage(companyInfo);
  const isIncomplete = missing.required.length > 0 || missing.recommended.length > 0;

  // Hide panel if legal info is complete
  if (!isIncomplete) {
    return null;
  }

  return (
    <>
      <Card className={`bg-card border-border ${isIncomplete ? 'border-amber-500/50 bg-amber-500/5' : 'border-green-500/50 bg-green-500/5'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {isIncomplete ? (
              <AlertCircle className="w-5 h-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
            <CardTitle className="text-base">
              {isIncomplete ? 'Rechtliche Angaben unvollständig' : 'Rechtliche Angaben vollständig'}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Fortschritt</span>
              <span>{completion}%</span>
            </div>
            <Progress value={completion} className="h-2" />
          </div>

          {/* Fehlende Pflichtfelder */}
          {missing.required.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 space-y-1">
              <p className="text-xs font-medium text-red-600">Pflichtangaben fehlen:</p>
              <ul className="text-xs text-red-600 space-y-0.5">
                {missing.required.map(field => (
                  <li key={field} className="flex items-center gap-2">
                    <span>•</span>
                    <span>{fieldLabel(field)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fehlende empfohlene Felder */}
          {missing.recommended.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 space-y-1">
              <p className="text-xs font-medium text-amber-700">Empfohlene Angaben:</p>
              <ul className="text-xs text-amber-700 space-y-0.5">
                {missing.recommended.map(field => (
                  <li key={field} className="flex items-center gap-2">
                    <span>•</span>
                    <span>{fieldLabel(field)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Current Info */}
          {companyInfo?.company_name && (
            <div className="bg-accent/50 rounded-lg p-2.5 text-xs text-muted-foreground space-y-0.5">
              <p><strong>Firmenname:</strong> {companyInfo.company_name}</p>
              {companyInfo.owner_name && <p><strong>Betreiber:</strong> {companyInfo.owner_name}</p>}
              {companyInfo.email && <p><strong>E-Mail:</strong> {companyInfo.email}</p>}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => setSetupOpen(true)}
              size="sm"
              className="w-full gap-2"
            >
              <FileText className="w-4 h-4" />
              {companyInfo ? 'Angaben bearbeiten' : 'Angaben hinzufügen'}
            </Button>
            {companyInfo && (
              <Link to="/MyArea?tab=einstellungen" className="flex">
                <Button variant="outline" size="sm" className="w-full">
                  In Einstellungen anpassen
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Wizard */}
      <LegalSetupWizard
        open={setupOpen}
        onComplete={() => {
          setSetupOpen(false);
          loadData();
        }}
      />
    </>
  );
}

function fieldLabel(field) {
  const labels = {
    company_name: 'Firmenname',
    email: 'E-Mail',
    owner_name: 'Name des Betreibers',
    street: 'Straße',
    postal_code: 'Postleitzahl',
    city: 'Stadt',
    phone: 'Telefon',
  };
  return labels[field] || field;
}