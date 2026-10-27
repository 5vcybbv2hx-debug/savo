import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Route } from 'lucide-react';
import { FAHRPLAN_STATUS_META } from '@/lib/offenePosten';

/** Fahrplan: Phasen in sort_order-Reihenfolge mit Status-Badge. */
export default function FahrplanPhasen({ phasen }) {
    const sorted = [...phasen].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    return (
        <section className="space-y-2.5">
            <div className="flex items-center gap-2 px-0.5">
                <Route className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Fahrplan</h2>
                <span className="text-[11px] text-muted-foreground">{sorted.length} Phasen</span>
            </div>

            {sorted.length === 0 ? (
                <Card className="p-4 text-xs text-muted-foreground">
                    Noch keine Phasen hinterlegt.
                </Card>
            ) : (
                <div className="space-y-2">
                    {sorted.map((phase, i) => {
                        const meta = FAHRPLAN_STATUS_META[phase.status] || FAHRPLAN_STATUS_META.geplant;
                        return (
                            <Card key={phase.id} className="p-3.5 flex gap-3">
                                <span className="w-6 h-6 rounded-full border border-border bg-muted flex items-center justify-center text-[11px] font-bold shrink-0 text-muted-foreground">
                                    {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-semibold text-foreground">{phase.titel}</p>
                                        <Badge
                                            variant="outline"
                                            className={meta.className}
                                            style={meta.style}
                                        >
                                            {meta.label}
                                        </Badge>
                                    </div>
                                    {phase.beschreibung && (
                                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                                            {phase.beschreibung}
                                        </p>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </section>
    );
}