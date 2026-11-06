import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    FileText, Download, Trash2, Archive, Eye,
    Calendar, Link as LinkIcon, Tag, ArchiveRestore
} from 'lucide-react';
import { format, isBefore, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Semantic Tokens statt hardcodierter Farben
const fileTypeBadge = {
    'PDF':  'bg-status-danger/15 text-status-danger',
    'DOCX': 'bg-primary/15 text-primary',
    'DOC':  'bg-primary/15 text-primary',
    'XLSX': 'bg-status-ok/15 text-status-ok',
    'XLS':  'bg-status-ok/15 text-status-ok',
    'PNG':  'bg-primary/15 text-primary',
    'JPG':  'bg-primary/15 text-primary',
    'JPEG': 'bg-primary/15 text-primary',
    'GIF':  'bg-primary/15 text-primary',
    'MP4':  'bg-primary/15 text-primary',
    'MP3':  'bg-primary/15 text-primary',
};

export default function DocumentCard({ document, onDelete, onArchive, canEdit, onView }) {
    const today = new Date();
    const isExpired = document.expiry_date && isBefore(new Date(document.expiry_date), today);
    const daysLeft  = document.expiry_date
        ? differenceInDays(new Date(document.expiry_date), today)
        : null;
    const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

    return (
        <Card className={cn(
            'border transition-all hover:shadow-md group bg-card',
            isExpired    ? 'border-destructive/40'   : 'border-border',
            expiringSoon && !isExpired ? 'border-status-warn/40' : ''
        )}>
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                        isExpired ? 'bg-destructive/10' : 'bg-status-warn/10'
                    )}>
                        <FileText className={cn('w-5 h-5', isExpired ? 'text-destructive' : 'text-status-warn')} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground text-sm mb-1 truncate">
                            {document.name}
                        </h3>

                        {document.description && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                {document.description}
                            </p>
                        )}

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {document.file_type && (
                                <Badge className={cn('text-[10px] px-1.5 h-5', fileTypeBadge[document.file_type] || 'bg-secondary text-muted-foreground')}>
                                    {document.file_type}
                                </Badge>
                            )}
                            {isExpired && (
                                <Badge className="text-[10px] px-1.5 h-5 bg-destructive/15 text-destructive">
                                    Abgelaufen
                                </Badge>
                            )}
                            {expiringSoon && !isExpired && (
                                <Badge className="text-[10px] px-1.5 h-5 bg-status-warn/15 text-status-warn">
                                    Läuft ab in {daysLeft}d
                                </Badge>
                            )}
                        </div>

                        {/* Meta */}
                        <div className="space-y-1 text-xs">
                            {document.linked_entity_name && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <LinkIcon className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{document.linked_entity_type}: {document.linked_entity_name}</span>
                                </div>
                            )}
                            {document.tags?.length > 0 && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Tag className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{document.tags.join(', ')}</span>
                                </div>
                            )}
                            {document.expiry_date && (
                                <div className={cn('flex items-center gap-1.5', isExpired ? 'text-destructive' : expiringSoon ? 'text-status-warn' : 'text-muted-foreground')}>
                                    <Calendar className="w-3 h-3 shrink-0" />
                                    <span>
                                        {isExpired ? 'Abgelaufen ' : 'Läuft ab '}
                                        {format(new Date(document.expiry_date), 'd. MMM yyyy', { locale: de })}
                                    </span>
                                </div>
                            )}
                            <div className="text-muted-foreground/50 text-[10px] pt-0.5">
                                Hochgeladen {format(new Date(document.created_date), 'd. MMM yyyy', { locale: de })}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border/50">
                            <Button size="sm" variant="outline"
                                onClick={() => onView?.(document)}
                                className="h-8 text-xs gap-1 min-h-[36px] flex-1"
                            >
                                <Eye className="w-3 h-3" /> Ansehen
                            </Button>
                            <a
                                href={document.file_url}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors min-h-[36px]"
                            >
                                <Download className="w-3.5 h-3.5" />
                            </a>
                            {canEdit && (
                                <>
                                    <Button size="sm" variant="ghost"
                                        onClick={() => onArchive(!document.is_archived)}
                                        title={document.is_archived ? 'Wiederherstellen' : 'Archivieren'}
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-status-warn min-h-[36px]"
                                    >
                                        {document.is_archived
                                            ? <ArchiveRestore className="w-3.5 h-3.5" />
                                            : <Archive className="w-3.5 h-3.5" />
                                        }
                                    </Button>
                                    <Button size="sm" variant="ghost"
                                        onClick={onDelete}
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive min-h-[36px]"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
