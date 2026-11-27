import React from 'react';
import { cn } from '@/lib/utils';

// ── Toggle-Buttons für einen Permission-Key ───────────────────────────────────
export default function PermToggle({ permKey, value, onChange, actions }) {
  const levels = ['none', ...(actions || ['view', 'edit'])];
  return (
    <div className="flex gap-1">
      {levels.includes('none') && (
        <button
          onClick={() => onChange(permKey, 'none')}
          className={cn(
            'px-2 py-1 rounded text-[10px] font-medium transition-all min-h-[28px]',
            (!value || value === 'none')
              ? 'bg-muted text-muted-foreground ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted/60'
          )}
        >–</button>
      )}
      {levels.includes('view') && (
        <button
          onClick={() => onChange(permKey, 'view')}
          className={cn(
            'px-2 py-1 rounded text-[10px] font-medium transition-all min-h-[28px]',
            value === 'view'
              ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
              : 'text-muted-foreground hover:bg-muted/60'
          )}
        >Lesen</button>
      )}
      {levels.includes('edit') && (
        <button
          onClick={() => onChange(permKey, 'edit')}
          className={cn(
            'px-2 py-1 rounded text-[10px] font-medium transition-all min-h-[28px]',
            value === 'edit'
              ? 'bg-status-ok/20 text-status-ok ring-1 ring-status-ok/40'
              : 'text-muted-foreground hover:bg-muted/60'
          )}
        >Voll</button>
      )}
    </div>
  );
}