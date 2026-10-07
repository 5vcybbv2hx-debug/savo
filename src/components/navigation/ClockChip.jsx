import React from 'react';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { useClockInOut } from '@/hooks/useClockInOut';
import { format } from 'date-fns';
import { LogIn, LogOut, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Kompakter Stempel-Chip für mobilen Header und DesktopQuickBar.
 * Zustandsanzeige: grau = nicht eingestempelt, grün + "seit HH:MM" = eingestempelt.
 * Antippen = direkt ein-/ausstempeln mit Loading-Zustand.
 * Nur für eingeloggte Nutzer mit verknüpftem Employee-Datensatz (hook prüft intern).
 */
export default function ClockChip() {
    const { data: employee } = useCurrentEmployee();
    const { active, clockIn, clockOut, isClockingIn, isClockingOut } = useClockInOut(employee);

    if (!employee) return null;

    const isLoading = isClockingIn || isClockingOut;
    const sinceTime = active ? format(new Date(active.clock_in), 'HH:mm') : null;

    const handleToggle = () => {
        if (active) {
            clockOut(active.id);
        } else {
            clockIn();
        }
    };

    return (
        <button
            onClick={handleToggle}
            disabled={isLoading}
            className={cn(
                'flex items-center gap-1.5 rounded-full transition-all active:scale-95 h-8 px-2.5 text-xs font-medium shrink-0',
                active
                    ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                    : 'bg-muted text-muted-foreground border border-border',
                isLoading && 'opacity-60'
            )}
            title={active ? `Eingestempelt seit ${sinceTime} · Tippen zum Ausstempeln` : 'Einstempeln'}
        >
            {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : active ? (
                <LogOut className="w-3.5 h-3.5" />
            ) : (
                <LogIn className="w-3.5 h-3.5" />
            )}
            {active ? `seit ${sinceTime}` : 'Stempeln'}
        </button>
    );
}