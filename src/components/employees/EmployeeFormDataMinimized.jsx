import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataCollectionBanner, RequiredFieldNotice, OptionalFieldNotice, SensitiveDataWarning } from '@/components/privacy/DataMinimizationNotice';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * EmployeeFormDataMinimized
 * 
 * DSGVO-compliant employee form with:
 * - Data minimization (only required fields)
 * - Clear notices about data collection
 * - Separated sensitive data sections
 * - Transparent purpose statements
 */

const FORM_SECTIONS = {
  basic: {
    title: 'Grunddaten',
    description: 'Erforderlich für Betrieb und Verwaltung',
    fields: [
      { key: 'name', label: 'Name *', type: 'text', required: true, reason: 'Identifikation' },
      { key: 'email', label: 'E-Mail *', type: 'email', required: true, reason: 'Kommunikation' },
      { key: 'phone', label: 'Telefon *', type: 'tel', required: true, reason: 'Notfallkontakt' },
      { key: 'role', label: 'Position *', type: 'select', required: true, options: ['Aushilfe', 'Vollzeit', 'Manager'], reason: 'Berechtigungen' }
    ]
  },
  employment: {
    title: 'Anstellung',
    description: 'Für Vertragsmanagement und Buchhaltung erforderlich',
    fields: [
      { key: 'contract_type', label: 'Vertragsart *', type: 'select', required: true, options: ['Minijob', 'Teilzeit', 'Vollzeit'], reason: 'Sozialversicherung' },
      { key: 'hourly_rate', label: 'Stundensatz *', type: 'number', required: true, reason: 'Lohnabrechnung' },
      { key: 'entry_date', label: 'Eintrittsdatum *', type: 'date', required: true, reason: 'Arbeitsvertrag' }
    ]
  },
  address: {
    title: 'Adresse',
    description: 'Optional – wird nur bei Bedarf erfasst',
    fields: [
      { key: 'street', label: 'Straße & Hausnr.', type: 'text', required: false },
      { key: 'postal_code', label: 'Postleitzahl', type: 'text', required: false },
      { key: 'city', label: 'Wohnort', type: 'text', required: false }
    ]
  },
  sensitive: {
    title: 'Sensible Daten',
    description: 'Diese Felder sind besonders geschützt. Nur für Admin sichtbar.',
    sensitive: true,
    fields: [
      { key: 'birthday', label: 'Geburtsdatum (optional)', type: 'date', required: false },
      { key: 'tax_id', label: 'Steuernummer (optional)', type: 'text', required: false },
      { key: 'iban', label: 'IBAN (optional)', type: 'text', required: false, hint: 'Verschlüsselt gespeichert' }
    ]
  },
  emergency: {
    title: 'Notfall',
    description: 'Für Notfälle. Nur bei Bedarf erfasst.',
    fields: [
      { key: 'emergency_contact_name', label: 'Name (optional)', type: 'text', required: false },
      { key: 'emergency_contact_phone', label: 'Telefon (optional)', type: 'tel', required: false },
      { key: 'emergency_contact_relation', label: 'Beziehung (optional)', type: 'text', required: false, placeholder: 'z.B. Ehepartner' }
    ]
  }
};

export default function EmployeeFormDataMinimized({ employee = {}, onSave, isLoading = false, isEditable = true }) {
  const [formData, setFormData] = useState(employee);
  const [activeTab, setActiveTab] = useState('basic');

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Validate required fields
    const requiredFields = Object.values(FORM_SECTIONS)
      .flatMap(s => s.fields)
      .filter(f => f.required)
      .map(f => f.key);

    const missing = requiredFields.filter(key => !formData[key]);
    if (missing.length > 0) {
      toast.error(`Erforderliche Felder fehlen: ${missing.join(', ')}`);
      return;
    }

    onSave(formData);
  };

  const renderField = (field) => {
    const value = formData[field.key] || '';

    if (field.type === 'select') {
      return (
        <Select value={value} onValueChange={(val) => handleFieldChange(field.key, val)} disabled={!isEditable}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === 'textarea') {
      return (
        <Textarea
          value={value}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
          disabled={!isEditable}
          className="min-h-[80px]"
        />
      );
    }

    return (
      <Input
        type={field.type}
        value={value}
        onChange={(e) => handleFieldChange(field.key, e.target.value)}
        disabled={!isEditable}
        placeholder={field.placeholder}
        className="h-10"
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Data Collection Banner */}
      <DataCollectionBanner
        title="📋 Welche Daten erfassen wir?"
        items={[
          'Grunddaten und Kontaktinformationen (erforderlich)',
          'Anstellungsdaten für Verträge und Gehalt',
          'Adressdaten nur bei Bedarf',
          'Sensitive Daten (Steuernummer, IBAN) verschlüsselt und nur für Admin',
          'Alle Daten werden mindestens 6 Jahre aufbewahrt (Steuerrecht)'
        ]}
      />

      {/* Sensitive Data Warning */}
      <SensitiveDataWarning fields={['Steuernummer', 'IBAN', 'Geburtsdatum']} />

      {/* Form Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          {Object.entries(FORM_SECTIONS).map(([key, section]) => (
            <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
              {section.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(FORM_SECTIONS).map(([sectionKey, section]) => (
          <TabsContent key={sectionKey} value={sectionKey} className="space-y-6 mt-6">
            <Card className={section.sensitive ? 'border-status-warn/25 dark:border-status-warn/70 bg-status-warn/15 dark:bg-status-warn/20' : ''}>
              <CardHeader>
                <CardTitle className="text-lg">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {section.fields.map(field => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="text-sm font-medium">
                      {field.label}
                    </Label>
                    {renderField(field)}
                    {field.required ? (
                      <RequiredFieldNotice reason={field.reason} />
                    ) : (
                      <OptionalFieldNotice />
                    )}
                    {field.hint && (
                      <div className="text-xs text-status-warn dark:text-status-warn italic">
                        ℹ️ {field.hint}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Save Button */}
      {isEditable && (
        <Button onClick={handleSave} disabled={isLoading} className="w-full h-11">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Wird gespeichert...
            </>
          ) : (
            'Daten speichern'
          )}
        </Button>
      )}
    </div>
  );
}