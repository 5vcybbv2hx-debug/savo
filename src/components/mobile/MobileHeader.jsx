import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Consistent mobile page header with optional status indicator.
 */
export default function MobileHeader({ 
  title, 
  subtitle = null,
  icon = null,
  badge = null,
  right = null,
  className = '' 
}) {
  return (
    <div className={cn('mb-4 sm:mb-6', className)}>
      <div className="flex items-start justify-between gap-2 mb-1 sm:mb-2">
        <div className="flex items-center gap-2">
          {icon && <span className="text-xl sm:text-2xl">{icon}</span>}
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {title}
          </h1>
          {badge && (
            <span className="text-xs px-2 py-1 rounded-full bg-status-warn/20 text-status-warn font-semibold">
              {badge}
            </span>
          )}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
      {subtitle && (
        <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}