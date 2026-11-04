/**
 * ReservationRow — eine Reservierungszeile (Zeit, Name, Personen, Tisch,
 * Status, "eingetragen von"). Die ganze Zeile ist antippbar → Detailansicht.
 */
import { Users, MapPin, UserPen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTableDisplayName } from '@/components/tables/TableNameDisplay';

const STATUS_BADGE = {
    'bestätigt':  'bg-green-500/15 text-green-400 border-green-500/30',
    'vorgemerkt': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    'erschienen': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'no-show':    'bg-muted text-muted-foreground border-border',
    'storniert':  'bg-muted text-muted-foreground border-border',
};

export default function ReservationRow({ reservation, tables = [], resolveCreator, onOpen, index = 0 }) {
    const res = reservation;
    const table = tables.find(t => t.table_number === res.table || t.id === res.table);
    const tableLabel = Array.isArray(res.tables) && res.tables.length > 0
        ? res.tables.filter(Boolean).join(', ')
        : table ? getTableDisplayName(table) : res.table;

    return (
        <button
            onClick={() => onOpen?.(res)}
            className="w-full text-left p-3 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors card-pressable animate-stagger"
            style={{ '--delay': `${Math.min(index, 12) * 30}ms` }}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
                        {res.time || '–'}
                    </span>
                    <span className="text-sm font-semibold text-foreground truncate">
                        {res.customer_name}
                    </span>
                </div>
                <span className={cn(
                    'text-[11px] px-2 py-0.5 rounded-full border font-medium shrink-0',
                    STATUS_BADGE[res.status] || 'bg-muted text-muted-foreground border-border'
                )}>
                    {res.status}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />{res.guests} Pers.
                </span>
                <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{tableLabel || 'kein Tisch'}
                </span>
                <span className="flex items-center gap-1">
                    <UserPen className="w-3 h-3" />eingetragen von {resolveCreator?.(res.created_by) ?? '—'}
                </span>
            </div>
        </button>
    );
}