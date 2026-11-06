/**
 * ReservationStatusBadge.jsx
 * Example of a pure presentational feature component.
 * No data fetching — receives only what it needs to render.
 */
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
    'vorgemerkt': { label: 'Vorgemerkt', className: 'bg-status-warn/20 text-status-warn/25 border-status-warn/30' },
    'bestätigt':  { label: 'Bestätigt',  className: 'bg-status-ok/20  text-status-ok/25  border-status-ok/30'  },
    'storniert':  { label: 'Storniert',  className: 'bg-status-danger/20    text-status-danger/25    border-status-danger/30'    },
};

export default function ReservationStatusBadge({ status, className }) {
    const config = STATUS_CONFIG[status] ?? { label: status, className: '' };
    return (
        <Badge
            variant="outline"
            className={cn('text-xs font-medium', config.className, className)}
        >
            {config.label}
        </Badge>
    );
}