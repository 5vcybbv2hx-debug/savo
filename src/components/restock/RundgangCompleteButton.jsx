import { useState } from 'react';
import { format } from 'date-fns';
import { Check } from 'lucide-react';

/**
 * Dezenter Sekundär-Button im Rundgang-Kopf.
 * Nach dem Abschluss bleibt der Rundgang normal bedienbar — hier wird nur
 * der Status angezeigt, nichts gesperrt.
 */
export default function RundgangCompleteButton({ isCompleted, completedAt, onComplete }) {
    const [busy, setBusy] = useState(false);

    if (isCompleted) {
        return (
            <span className="inline-flex items-center gap-1 rounded-md bg-status-ok/10 px-2 py-1 text-[10px] font-semibold text-status-ok dark:text-status-ok">
                <Check className="w-3 h-3" />
                Abgeschlossen{completedAt ? ` · ${format(new Date(completedAt), 'HH:mm')}` : ''}
            </span>
        );
    }

    return (
        <button
            type="button"
            disabled={busy}
            onClick={async () => {
                setBusy(true);
                await onComplete();
                setBusy(false);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground active:scale-95 disabled:opacity-50"
        >
            {busy ? 'Speichere…' : 'Rundgang abschließen'}
        </button>
    );
}