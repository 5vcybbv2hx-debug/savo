import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, AlertCircle, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function PayrollReportHistory() {
    const [open, setOpen] = useState(false);
    const { data: logs = [], isLoading } = useQuery({
        queryKey: ['payroll-report-logs'],
        queryFn: () => base44.entities.PayrollReportLog.list('-created_date', 20),
    });

    if (isLoading) {
        return (
            <Card className="border-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Mail className="w-5 h-5" />
                        Versandverlauf
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Lade Verlauf...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (logs.length === 0) {
        return (
            <Card className="border-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Mail className="w-5 h-5" />
                        Versandverlauf
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Noch keine Reports versendet</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border">
            <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setOpen(o => !o)}
            >
                <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="w-5 h-5" />
                    Versandverlauf
                    <span className="ml-auto text-muted-foreground">
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                </CardTitle>
            </CardHeader>
            {open && <CardContent>
                <div className="space-y-3">
                    {logs.map((log) => (
                        <div
                            key={log.id}
                            className={cn(
                                'flex items-start gap-3 p-3 rounded-lg border',
                                log.status === 'success'
                                    ? 'bg-status-ok/5 border-status-ok/20'
                                    : 'bg-status-danger/5 border-status-danger/20'
                            )}
                        >
                            <div className="mt-0.5">
                                {log.status === 'success' ? (
                                    <Check className="w-5 h-5 text-status-ok" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-status-danger" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-sm">
                                        {log.report_type === 'monthly'
                                            ? `${log.month}/${log.year}`
                                            : `${log.day}.${log.month}.${log.year}`}
                                    </p>
                                    <span className="text-xs text-muted-foreground">
                                        → {log.recipient_email}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(log.sent_at), 'd. MMM yyyy, HH:mm', { locale: de })}
                                </p>
                                {log.status === 'failed' && log.error_message && (
                                    <p className="text-xs text-status-danger mt-1">
                                        Fehler: {log.error_message}
                                    </p>
                                )}
                            </div>
                            <div className={cn(
                                'text-xs font-medium whitespace-nowrap',
                                log.status === 'success'
                                    ? 'text-status-ok'
                                    : 'text-status-danger'
                            )}>
                                {log.status === 'success' ? 'Versendet' : 'Fehler'}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>}
        </Card>
    );
}