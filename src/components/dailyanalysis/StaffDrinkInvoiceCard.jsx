import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const MARKER = 'Arbeitsgetränke';

/**
 * Arbeitsgetränke / Eigenbedarf
 * Eigene Rechnung, bewusst getrennt vom Z-Abschlag: wird hier nur abgelegt
 * und aufgelistet, nicht in den Tagesumsatz gerechnet.
 */
export default function StaffDrinkInvoiceCard({ selectedDate }) {
    const fileRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const queryClient = useQueryClient();

    const { data: documents = [] } = useQuery({
        queryKey: ['staff-drink-invoices'],
        queryFn: () => base44.entities.Document.list('-created_date', 100),
        staleTime: 60000,
    });

    const invoices = documents
        .filter(d => `${d.name || ''} ${d.description || ''}`.includes(MARKER))
        .slice(0, 5);

    const handleUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setBusy(true);
        setFeedback(null);
        try {
            const upload = await base44.integrations.Core.UploadFile({ file });
            const monthLabel = selectedDate
                ? format(new Date(selectedDate), 'MMMM yyyy', { locale: de })
                : format(new Date(), 'MMMM yyyy', { locale: de });
            await base44.entities.Document.create({
                name: `${MARKER} ${monthLabel}`,
                description: `${MARKER}/Eigenbedarf-Rechnung. Abgelegt über den Tagesabschluss. Bewusst nicht Teil des Tagesumsatzes.`,
                file_url: upload.file_url,
                file_type: file.type || 'application/pdf',
                file_size: file.size || undefined,
                category: 'Rechnung',
                tags: ['arbeitsgetränke', 'eigenbedarf'],
                is_archived: false,
            });
            setFeedback({ type: 'ok', text: 'Rechnung abgelegt.' });
            queryClient.invalidateQueries({ queryKey: ['staff-drink-invoices'] });
        } catch (e) {
            setFeedback({ type: 'error', text: `Ablage fehlgeschlagen: ${e.message}` });
        } finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-[12px] font-medium text-muted-foreground">
                        Arbeitsgetränke / Eigenbedarf
                    </CardTitle>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => fileRef.current?.click()}
                        disabled={busy}
                    >
                        {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                        Rechnung hochladen
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
                <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={handleUpload}
                />

                {feedback && (
                    <p className={`text-[11.5px] flex items-center gap-1 ${feedback.type === 'ok' ? 'text-status-ok' : 'text-status-danger'}`}>
                        {feedback.type === 'ok' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {feedback.text}
                    </p>
                )}

                {invoices.length === 0 ? (
                    <p className="text-[11.5px] text-muted-foreground">
                        Noch keine Rechnung abgelegt. Die Arbeitsgetränke laufen separat und werden nicht in den
                        Tagesumsatz gerechnet.
                    </p>
                ) : (
                    <div className="space-y-1.5">
                        {invoices.map(doc => (
                            <a
                                key={doc.id}
                                href={doc.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 hover:bg-accent/40 transition-colors"
                            >
                                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="text-[12px] text-foreground truncate flex-1">{doc.name}</span>
                                <span className="text-[11px] text-muted-foreground shrink-0">
                                    {doc.created_date ? format(new Date(doc.created_date), 'dd.MM.', { locale: de }) : ''}
                                </span>
                            </a>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
