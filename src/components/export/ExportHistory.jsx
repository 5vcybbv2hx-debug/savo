import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, Download, Trash2, FileJson, FileText, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

const FORMAT_ICONS = {
    json: FileJson,
    csv: FileText,
    xlsx: FileText,
    zip: Archive,
};

export default function ExportHistory() {
    const [history, setHistory] = useState([]);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem('exportHistory') || '[]');
            setHistory(stored);
        } catch (e) {
            setHistory([]);
        }
    }, []);

    const clearHistory = () => {
        localStorage.removeItem('exportHistory');
        setHistory([]);
    };

    if (history.length === 0) {
        return (
            <Card className="bg-card border-border">
                <CardContent className="p-8 text-center text-muted-foreground">
                    <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Noch keine Exporte durchgeführt</p>
                    <p className="text-xs mt-1">Export-Verlauf wird hier angezeigt</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Export-Verlauf</h3>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearHistory}
                    className="text-xs text-status-danger hover:text-status-danger/25 hover:bg-status-danger/20 gap-1"
                >
                    <Trash2 className="w-3 h-3" /> Verlauf löschen
                </Button>
            </div>

            <div className="space-y-2">
                {history.map((h, i) => {
                    const Icon = FORMAT_ICONS[h.format] || FileJson;
                    return (
                        <Card key={i} className="bg-card border-border">
                            <CardContent className="p-4 flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                                    <Icon className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-sm font-semibold text-foreground capitalize">{h.type}-Export</p>
                                        <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30 uppercase">{h.format}</Badge>
                                        {h.errors > 0 && (
                                            <Badge className="text-[10px] bg-status-warn/20 text-status-warn border-status-warn/30">
                                                {h.errors} Fehler
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {format(parseISO(h.date), 'dd.MM.yyyy HH:mm', { locale: de })} ·{' '}
                                        {h.totalRecords?.toLocaleString()} Datensätze ·{' '}
                                        {h.modules?.length} Module
                                    </p>
                                </div>
                                <Badge className={cn('text-[10px] shrink-0', h.errors > 0
                                    ? 'bg-status-warn/20 text-status-warn border-status-warn/30'
                                    : 'bg-status-ok/20 text-status-ok border-status-ok/30'
                                )}>
                                    {h.errors > 0 ? 'Mit Warnungen' : 'Erfolgreich'}
                                </Badge>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}