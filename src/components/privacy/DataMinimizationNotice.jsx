import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Info } from 'lucide-react';

/**
 * DataMinimizationNotice
 * 
 * DSGVO-compliant notices for data collection fields.
 * Shows users what data is collected and why.
 */

export const OptionalFieldNotice = ({ label }) => (
  <div className="text-xs text-muted-foreground italic mt-1">
    Optional – wird nicht für Betrieb erforderlich
  </div>
);

export const RequiredFieldNotice = ({ label, reason }) => (
  <div className="text-xs text-muted-foreground mt-1">
    Erforderlich für: {reason}
  </div>
);

export const DataCollectionBanner = ({ title, items }) => (
  <Alert className="border-primary/25 dark:border-primary/70 bg-primary/15 dark:bg-primary/20 mb-6">
    <Info className="h-4 w-4 text-primary" />
    <AlertDescription className="text-sm text-primary dark:text-primary/25">
      <strong>{title}</strong>
      <ul className="mt-2 space-y-1 ml-4 list-disc">
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </AlertDescription>
  </Alert>
);

export const SensitiveDataWarning = ({ fields }) => (
  <Alert className="border-status-warn/25 dark:border-status-warn/70 bg-status-warn/15 dark:bg-status-warn/20">
    <AlertTriangle className="h-4 w-4 text-status-warn" />
    <AlertDescription className="text-sm text-status-warn dark:text-status-warn/25">
      <strong>Sensible Daten:</strong> {fields.join(', ')} sind besonders geschützt und nur für berechtigte Personen einsehbar.
    </AlertDescription>
  </Alert>
);

export const ConsentCheckbox = ({ checked, onChange, label }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg border border-border dark:border-border bg-card dark:bg-surface">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-5 h-5 rounded border-border mt-1 accent-amber-600 cursor-pointer"
    />
    <label className="text-sm text-foreground cursor-pointer">
      {label}
    </label>
  </div>
);