import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

/** Ein Wert mit Copy-Button — leere Werte werden gar nicht gerendert. */
export default function CopyField({ label, value }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success(`${label} kopiert`);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error('Kopieren nicht möglich');
        }
    };

    return (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5">
            <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-xs font-medium break-all">{value}</p>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={copy}
                aria-label={`${label} kopieren`}
            >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
        </div>
    );
}