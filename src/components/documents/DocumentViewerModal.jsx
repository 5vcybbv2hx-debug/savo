import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ExternalLink, X, AlertTriangle, Clock } from 'lucide-react';
import { format, isBefore, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const fileTypeBadge = {
    'PDF':  'bg-status-danger/15 text-status-danger',
    'DOCX': 'bg-primary/15 text-primary',
    'DOC':  'bg-primary/15 text-primary',
    'XLSX': 'bg-status-ok/15 text-status-ok',
    'XLS':  'bg-status-ok/15 text-status-ok',
    'PNG':  'bg-primary/15 text-primary',
    'JPG':  'bg-primary/15 text-primary',
    'JPEG': 'bg-primary/15 text-primary',
};

export default function DocumentViewerModal({ document, open, onClose }) {
    if (!document) return null;

    const today      = new Date();
    const isImage    = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(document.file_type);
    const isPDF      = document.file_type === 'PDF';
    const isExpired  = document.expiry_date && isBefore(new Date(document.expiry_date), today);
    const daysLeft   = document.expiry_date ? differenceInDays(new Date(document.expiry_date), today) : null;
    const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-card border-border p-0 overflow-hidden">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
                    <div className="flex-1 min-w-0">
                        <DialogTitle className="text-foreground text-base font-semibold truncate">
                            {document.name}
                        </DialogTitle>
                        {document.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {document.description}
                            </p>
                        )}
                    </div>
                    <DialogClose asChild>
                        <Button variant="ghost" size="icon" className="shrink-0 w-8 h-8">
                            <X className="w-4 h-4" />
                        </Button>
                    </DialogClose>
                </div>

                {/* ── Ablauf-Warnung ──────────────────────────────────────── */}
                {(isExpired || expiringSoon) && (
                    <div className={cn(
                        'flex items-center gap-2 px-4 py-2 text-xs border-b',
                        isExpired
                            ? 'bg-destructive/10 border-destructive/20 text-destructive'
                            : 'bg-status-warn/10 border-status-warn/20 text-status-warn'
                    )}>
                        {isExpired ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <Clock className="w-3.5 h-3.5 shrink-0" />}
                        {isExpired
                            ? `Dieses Dokument ist seit ${format(new Date(document.expiry_date), 'd. MMM yyyy', { locale: de })} abgelaufen.`
                            : `Läuft ab in ${daysLeft} Tag${daysLeft === 1 ? '' : 'en'} (${format(new Date(document.expiry_date), 'd. MMM yyyy', { locale: de })})`
                        }
                    </div>
                )}

                {/* ── Metadaten ───────────────────────────────────────────── */}
                <div className="px-4 py-3 border-b border-border flex flex-wrap gap-3 items-center">
                    <div className="flex flex-wrap gap-1.5">
                        {document.file_type && (
                            <Badge className={cn('text-xs', fileTypeBadge[document.file_type] || 'bg-secondary text-muted-foreground')}>
                                {document.file_type}
                            </Badge>
                        )}
                        {document.category && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                                {document.category}
                            </Badge>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground ml-auto">
                        {document.file_size && (
                            <span>{(document.file_size / 1024).toFixed(0)} KB</span>
                        )}
                        {document.linked_entity_name && (
                            <span>{document.linked_entity_type}: {document.linked_entity_name}</span>
                        )}
                        {document.created_date && (
                            <span>Hochgeladen {format(new Date(document.created_date), 'd. MMM yyyy', { locale: de })}</span>
                        )}
                    </div>
                </div>

                {/* ── Preview ─────────────────────────────────────────────── */}
                <div className="flex-1 overflow-auto bg-secondary/30 min-h-[300px]">
                    {isPDF && (
                        <iframe
                            src={document.file_url}
                            className="w-full h-full min-h-[500px]"
                            title={document.name}
                        />
                    )}
                    {isImage && (
                        <div className="flex items-center justify-center p-6 h-full">
                            <img
                                src={document.file_url}
                                alt={document.name}
                                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                            />
                        </div>
                    )}
                    {!isPDF && !isImage && (
                        <div className="flex flex-col items-center justify-center h-full p-12 gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                                <span className="text-2xl font-bold text-muted-foreground">
                                    {document.file_type || '?'}
                                </span>
                            </div>
                            <p className="text-muted-foreground text-sm text-center">
                                Vorschau für diesen Dateityp nicht verfügbar.
                            </p>
                            <a
                                href={document.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Datei in neuem Tab öffnen
                            </a>
                        </div>
                    )}
                </div>

                {/* ── Footer ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-card">
                    <div className="flex flex-wrap gap-1">
                        {document.tags?.map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px] text-muted-foreground">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <a
                            href={document.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-9 px-3 text-sm rounded-md border border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Öffnen
                        </a>
                        <a
                            href={document.file_url}
                            download
                            className="inline-flex items-center gap-1.5 h-9 px-3 text-sm rounded-md bg-status-warn/70 hover:bg-status-warn/70 text-white transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Download
                        </a>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
