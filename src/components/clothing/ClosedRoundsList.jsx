/**
 * Abgeschlossene Klamotten-Runden mit PDF-Zugriff (nur Manager).
 * Zeigt die dauerhaft gespeicherte Bestellübersicht und erlaubt, sie neu zu erzeugen.
 */
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, RefreshCw, Shirt } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { generateRoundOverviewPdf, openRoundPdf } from '@/lib/clothingRoundOverview';

const fmt = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function ClosedRoundsList({ rounds = [] }) {
    const queryClient = useQueryClient();
    const [busyId, setBusyId] = useState(null);
    const closed = [...rounds]
        .filter((r) => !r.is_active)
        .sort((a, b) => new Date(b.closed_at || b.updated_date || b.created_date) - new Date(a.closed_at || a.updated_date || a.created_date));

    if (closed.length === 0) return null;

    const regenerate = async (round) => {
        setBusyId(round.id);
        try {
            const { file_uri } = await generateRoundOverviewPdf(round, { markClosed: true });
            queryClient.invalidateQueries({ queryKey: ['clothingRounds'] });
            toast.success('Bestellübersicht neu erzeugt', {
                action: { label: 'PDF öffnen', onClick: () => openRoundPdf(file_uri) },
            });
        } catch (error) {
            toast.error('PDF konnte nicht erzeugt werden: ' + error.message);
        } finally {
            setBusyId(null);
        }
    };

    const download = async (round) => {
        setBusyId(round.id);
        try {
            await openRoundPdf(round.pdf_url);
        } catch (error) {
            toast.error('PDF konnte nicht geöffnet werden: ' + error.message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Card className="border-border/60">
            <CardContent className="pt-4 pb-4 space-y-2.5">
                <p className="text-[12px] font-medium text-muted-foreground">Abgeschlossene Runden</p>
                {closed.map((round) => (
                    <div key={round.id} className="rounded-lg border border-border/60 p-2.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                    <Shirt className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{round.round_name || 'Klamotten-Bestellrunde'}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Abgeschlossen: {fmt(round.closed_at || round.updated_date)}
                                    {round.total_items != null && ` · ${round.total_items} Teile`}
                                    {round.open_items > 0 && ` · ${round.open_items} ohne Menge`}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {round.pdf_url && (
                                <Button size="sm" variant="outline" onClick={() => download(round)} disabled={busyId === round.id}>
                                    <FileText className="w-3.5 h-3.5 mr-1.5" /> Bestellübersicht (PDF)
                                </Button>
                            )}
                            <Button size="sm" variant={round.pdf_url ? 'ghost' : 'outline'} onClick={() => regenerate(round)} disabled={busyId === round.id}>
                                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${busyId === round.id ? 'animate-spin' : ''}`} />
                                {busyId === round.id ? 'Erzeuge…' : 'PDF neu erzeugen'}
                            </Button>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}