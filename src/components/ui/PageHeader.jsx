import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * PageHeader — der eine Seitenkopf der App.
 * Titel 20 px / 600, Untertitel 12 px gedämpft, rechts genau eine Primäraktion.
 * Weitere Aktionen gehören in `menu` (Drei-Punkte), nicht neben den Button.
 *
 * menu: [{ label, icon: Icon, onClick, destructive?, separator? }]
 */
export default function PageHeader({ title, subtitle, action, menu = [], className }) {
  const items = menu.filter(Boolean);

  return (
    <div className={cn('page-header', className)}>
      <div className="min-w-0">
        <h1 className="page-title truncate">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {action}
        {items.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Weitere Aktionen">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <React.Fragment key={item.label}>
                    {item.separator && i > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={item.onClick}
                      className={cn('gap-2 text-sm', item.destructive && 'text-destructive focus:text-destructive')}
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      {item.label}
                    </DropdownMenuItem>
                  </React.Fragment>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}