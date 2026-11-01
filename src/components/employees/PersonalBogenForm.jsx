import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Save, Loader2, User, FileText, Shield, CreditCard, Phone } from 'lucide-react';
import SignaturePad from './SignaturePad';
import PermissionsManager from './PermissionsManager';
import EmployeeAvatar from './EmployeeAvatar';

const TABS = [
  { id: 'allgemein',   label: 'Allgemein',            icon: User },
  { id: 'vertrag',     label: 'Vertrag & Arbeitszeit', icon: FileText },
  { id: 'steuer',      label: 'Steuer & Soziales',     icon: Shield },
  { id: 'bank',        label: 'Bankdaten',             icon: CreditCard },
  { id: 'notfall',     label: 'Notfallkontakt',        icon: Phone },
];

function FieldWrapper({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground/80">{label}</Label>
      {children}
    </div>
  );
}

function TextField({ label, field, type = 'text', formData, onChange, disabled }) {
  return (
    <FieldWrapper label={label}>
      {type === 'textarea' ? (
        <Textarea
          value={formData[field] || ''}
          onChange={(e) => onChange(field, e.target.value)}
          disabled={disabled}
          className="min-h-20 text-base resize-none"
        />
      ) : (
        <Input
          type={type}
          value={formData[field] || ''}
          onChange={(e) => onChange(field, e.target.value)}
          disabled={disabled}
          className="h-10 text-base"
        />
      )}
    </FieldWrapper>
  );
}

function SelectField({ label, field, options, formData, onChange, disabled }) {
  return (
    <FieldWrapper label={label}>
      <Select value={formData[field] || ''} onValueChange={(v) => onChange(field, v)} disabled={disabled}>
        <SelectTrigger className="h-10">
          <SelectValue placeholder="Bitte wählen…" />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

function SwitchField({ label, field, formData, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-secondary/40 min-h-[52px]">
      <span className="text-sm text-foreground">{label}</span>
      <Switch
        checked={!!formData[field]}
        onCheckedChange={(v) => onChange(field, v)}
        disabled={disabled}
      />
    </div>
  );
}

function ColorField({ label, field, formData, onChange, disabled }) {
  const COLORS = [
    '#f43f5e','#ec4899','#a855f7','#8b5cf6','#6366f1',
    '#3b82f6','#06b6d4','#10b981','#84cc16','#f59e0b','#f97316','#ef4444',
  ];
  return (
    <FieldWrapper label={label}>
      <div className="flex flex-wrap gap-2">
        {COLORS.map(c => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => onChange(field, c)}
            className={cn(
              'w-8 h-8 rounded-full border-2 transition-transform',
              formData[field] === c ? 'border-foreground scale-110' : 'border-transparent'
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        <Input
          type="color"
          value={formData[field] || '#f59e0b'}
          onChange={(e) => onChange(field, e.target.value)}
          disabled={disabled}
          className="w-8 h-8 p-0 border-0 rounded-full cursor-pointer bg-transparent"
          title="Eigene Farbe wählen"
        />
      </div>
    </FieldWrapper>
  );
}

function SectionTitle({ children }) {
  return <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest pt-4 pb-1 first:pt-0">{children}</h3>;
}

export default function PersonalBogenForm({ employee, onSave, isLoading = false, isEditable = true }) {
  const [formData, setFormData] = useState(employee || {});
  const [activeTab, setActiveTab] = useState('allgemein');

  useEffect(() => {
    if (employee) setFormData(employee);
  }, [employee?.id]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => onSave(formData);

  const f = { formData, onChange: handleChange, disabled: !isEditable };

  return (
    <div className="space-y-0">
      {/* Tab Bar */}
      <div className="overflow-x-auto scrollbar-hide -mx-1">
        <div className="flex gap-1 px-1 min-w-max border-b border-border pb-0">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pt-5 space-y-4">

        {/* ── Tab 1: Allgemein ── */}
        {activeTab === 'allgemein' && (
          <div className="space-y-4">
            {/* Profilfoto */}
            <div className="flex flex-col items-center gap-2 pb-2">
              <EmployeeAvatar
                employee={formData}
                size="md"
                upload={isEditable}
                onUploaded={(url) => handleChange('profile_image_url', url)}
              />
              {isEditable && (
                <p className="text-xs text-muted-foreground">Foto antippen zum Ändern</p>
              )}
            </div>

            <SectionTitle>Basisdaten</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Name" field="name" {...f} />
              <TextField label="Kurzname" field="short_name" {...f} />
            </div>
            <SelectField label="Rolle" field="role" options={[
              { value: 'Aushilfe', label: 'Aushilfe' },
              { value: 'Vollzeit', label: 'Vollzeit' },
              { value: 'Manager', label: 'Manager' },
              { value: 'Orga', label: 'Orga' },
            ]} {...f} />
            <ColorField label="Farbe" field="color" {...f} />

            <SectionTitle>Kontakt</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Telefon" field="phone" type="tel" {...f} />
              <TextField label="E-Mail" field="email" type="email" {...f} />
            </div>

            <SectionTitle>Persönliche Daten</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Geburtsdatum" field="birthday" type="date" {...f} />
              <TextField label="Geburtsname" field="birth_name" {...f} />
              <TextField label="Geburtsort" field="birth_place" {...f} />
              <TextField label="Nationalität" field="nationality" {...f} />
            </div>

            <SectionTitle>Adresse</SectionTitle>
            <TextField label="Straße und Hausnummer" field="street" {...f} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Postleitzahl" field="postal_code" {...f} />
              <TextField label="Stadt" field="city" {...f} />
            </div>

            <SectionTitle>Kleidung</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField label="T-Shirt Größe" field="tshirt_size" options={
                ['XS','S','M','L','XL','XXL','XXXL'].map(s => ({ value: s, label: s }))
              } {...f} />
              <SelectField label="Pullover Größe" field="pullover_size" options={
                ['XS','S','M','L','XL','XXL','XXXL'].map(s => ({ value: s, label: s }))
              } {...f} />
            </div>

            <SectionTitle>Status</SectionTitle>
            <SwitchField label="Aktiv" field="is_active" {...f} />
            <SwitchField label="Systemkonto (in Terminal ausblenden)" field="is_system_account" {...f} />
          </div>
        )}

        {/* ── Tab 2: Vertrag & Arbeitszeit ── */}
        {activeTab === 'vertrag' && (
          <div className="space-y-4">
            <SectionTitle>Anstellung</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Mitarbeiternummer" field="employee_number" {...f} />
              <TextField label="Eintrittsdatum" field="entry_date" type="date" {...f} />
            </div>
            <SelectField label="Vertragsart" field="contract_type" options={[
              { value: 'Vollzeit', label: 'Vollzeit' },
              { value: 'Teilzeit', label: 'Teilzeit' },
              { value: 'Minijob', label: 'Minijob' },
            ]} {...f} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Stundenlohn (€/h)" field="hourly_rate" type="number" {...f}
                hint={formData.contract_type === 'Vollzeit' || formData.contract_type === 'Teilzeit' ? 'Für stundenbasierte Abrechnung' : undefined}
              />
              <TextField label="Festgehalt (€/Monat)" field="monthly_salary" type="number" {...f}
                hint="Nur für Festangestellte mit Monatsgehalt"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Wochenstunden" field="weekly_hours" type="number" {...f} />
              <TextField label="Urlaubstage/Jahr" field="vacation_days_per_year" type="number" {...f} />
            </div>

            <SectionTitle>Tätigkeit</SectionTitle>
            <TextField label="Tätigkeit / Position" field="activity" {...f} />
            <TextField label="Schul- und Berufsausbildung" field="education" type="textarea" {...f} />

            <SectionTitle>Skills</SectionTitle>
            <FieldWrapper label="Fähigkeiten">
              <div className="flex flex-wrap gap-2">
                {['Barkeeper', 'Service', 'Sonderaufgaben'].map(skill => {
                  const skills = formData.skills || [];
                  const active = skills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      disabled={!isEditable}
                      onClick={() => {
                        const next = active ? skills.filter(s => s !== skill) : [...skills, skill];
                        handleChange('skills', next);
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-secondary/50 text-muted-foreground border-border hover:border-primary/50'
                      )}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>
            </FieldWrapper>

            <SectionTitle>Nebenbeschäftigung</SectionTitle>
            <SwitchField label="Versicherungspflichtige Hauptbeschäftigung" field="has_main_job" {...f} />
            <SwitchField label="Weitere geringfügige Beschäftigung" field="has_other_minijob" {...f} />
            {formData.has_other_minijob && (
              <TextField label="Details zur weiteren Beschäftigung" field="other_minijob_details" type="textarea" {...f} />
            )}

            <SectionTitle>Berechtigungen</SectionTitle>
            <PermissionsManager
              employee={formData}
              onSave={(perms) => handleChange('permissions', perms)}
            />

            <SectionTitle>Zugang</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Kalender-Token" field="calendar_token" {...f} />
            </div>
          </div>
        )}

        {/* ── Tab 3: Steuer & Soziales ── */}
        {activeTab === 'steuer' && (
          <div className="space-y-4">
            <SectionTitle>Steuer</SectionTitle>
            <TextField label="Steuer-Identifikationsnummer" field="tax_id" {...f} />

            <SectionTitle>Sozialversicherung</SectionTitle>
            <TextField label="Rentenversicherungsnummer" field="pension_number" {...f} />
            <TextField label="Krankenkasse" field="health_insurance" {...f} />
            <SwitchField label="Befreiungsantrag Rentenversicherung" field="pension_exemption" {...f} />
          </div>
        )}

        {/* ── Tab 4: Bankdaten ── */}
        {activeTab === 'bank' && (
          <div className="space-y-4">
            <SectionTitle>Kontoverbindung</SectionTitle>
            <TextField label="Kreditinstitut" field="bank_name" {...f} />
            <TextField label="IBAN" field="iban" {...f} />
            <TextField label="BIC" field="bic" {...f} />

            <SectionTitle>Unterschriften</SectionTitle>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground/80">Unterschrift Arbeitnehmer</p>
                {formData.sig_employee && (
                  <img src={formData.sig_employee} alt="Unterschrift AN" className="border rounded-lg max-h-24 bg-white" />
                )}
                {isEditable && (
                  <SignaturePad
                    label=""
                    onSign={(sig) => handleChange('sig_employee', sig)}
                  />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground/80">Unterschrift Arbeitgeber</p>
                {formData.sig_employer && (
                  <img src={formData.sig_employer} alt="Unterschrift AG" className="border rounded-lg max-h-24 bg-white" />
                )}
                {isEditable && (
                  <SignaturePad
                    label=""
                    onSign={(sig) => handleChange('sig_employer', sig)}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 5: Notfallkontakt ── */}
        {activeTab === 'notfall' && (
          <div className="space-y-4">
            <SectionTitle>Notfallkontakt</SectionTitle>
            <TextField label="Name" field="emergency_contact_name" {...f} />
            <TextField label="Telefon" field="emergency_contact_phone" type="tel" {...f} />
            <SelectField label="Beziehung" field="emergency_contact_relation" options={[
              { value: 'Ehepartner', label: 'Ehepartner' },
              { value: 'Eltern', label: 'Eltern' },
              { value: 'Kind', label: 'Kind' },
              { value: 'Geschwister', label: 'Geschwister' },
              { value: 'Freund', label: 'Freund' },
              { value: 'Sonstiges', label: 'Sonstiges' },
            ]} {...f} />
          </div>
        )}

      </div>

      {/* Save Button */}
      {isEditable && (
        <div className="pt-6">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="w-full h-11 text-base font-semibold"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Wird gespeichert…</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Speichern</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}