import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function HolidayCreditManager() {
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [creditType, setCreditType] = useState('holiday'); // 'holiday' or 'vacation'
    const [mode, setMode] = useState('month'); // 'month' or 'single'
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [result, setResult] = useState(null);

    const creditMutation = useMutation({
        mutationFn: async (data) => {
            const functionName = creditType === 'holiday' ? 'creditHolidayHours' : 'creditVacationHours';
            return await base44.functions.invoke(functionName, data);
        },
        onSuccess: (response) => {
            setResult(response.data);
            queryClient.invalidateQueries(['time-entries']);
        }
    });

    const handleCredit = () => {
        const payload = mode === 'month' 
            ? { year, month }
            : { date };
        
        creditMutation.mutate(payload);
    };

    const handleClose = () => {
        setModalOpen(false);
        setResult(null);
        setCreditType('holiday');
    };

    return (
        <>
            <Button
                onClick={() => setModalOpen(true)}
                variant="outline"
                className="border-border text-muted-foreground hover:bg-surface"
            >
                <Calendar className="w-4 h-4 mr-2" />
                Stunden gutschreiben
            </Button>

            <Dialog open={modalOpen} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-status-warn" />
                            Stunden für Vollzeitkräfte gutschreiben
                        </DialogTitle>
                    </DialogHeader>

                    {!result ? (
                        <div className="space-y-4 mt-4">
                            <div className="flex gap-2">
                                <Button
                                    variant={creditType === 'holiday' ? 'default' : 'outline'}
                                    onClick={() => setCreditType('holiday')}
                                    className={creditType === 'holiday' ? 'bg-status-warn/70 hover:bg-status-warn/70' : ''}
                                >
                                    Feiertage
                                </Button>
                                <Button
                                    variant={creditType === 'vacation' ? 'default' : 'outline'}
                                    onClick={() => setCreditType('vacation')}
                                    className={creditType === 'vacation' ? 'bg-status-warn/70 hover:bg-status-warn/70' : ''}
                                >
                                    Urlaubstage
                                </Button>
                            </div>

                            <div className="bg-card p-3 rounded-lg text-sm text-muted-foreground">
                                <p className="font-medium mb-1">ℹ️ Automatische Gutschrift</p>
                                <p>
                                    {creditType === 'holiday' 
                                        ? 'Vollzeitkräfte erhalten automatisch 8 Stunden für jeden Feiertag, der auf einen Öffnungstag fällt.'
                                        : 'Vollzeitkräfte erhalten automatisch 8 Stunden für jeden Urlaubstag, der auf einen Öffnungstag fällt.'
                                    }
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant={mode === 'month' ? 'default' : 'outline'}
                                    onClick={() => setMode('month')}
                                    className={mode === 'month' ? 'bg-status-warn/70 hover:bg-status-warn/70' : ''}
                                >
                                    Monat
                                </Button>
                                <Button
                                    variant={mode === 'single' ? 'default' : 'outline'}
                                    onClick={() => setMode('single')}
                                    className={mode === 'single' ? 'bg-status-warn/70 hover:bg-status-warn/70' : ''}
                                >
                                    Einzelner Tag
                                </Button>
                            </div>

                            {mode === 'month' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label>Jahr</Label>
                                        <Input
                                            type="number"
                                            value={year}
                                            onChange={(e) => setYear(parseInt(e.target.value))}
                                            min={2020}
                                            max={2030}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Monat</Label>
                                        <select
                                            value={month}
                                            onChange={(e) => setMonth(parseInt(e.target.value))}
                                            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                                        >
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                <option key={m} value={m}>
                                                    {format(new Date(2024, m - 1, 1), 'MMMM', { locale: de })}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label>Datum</Label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={handleClose}>
                                    Abbrechen
                                </Button>
                                <Button
                                    onClick={handleCredit}
                                    disabled={creditMutation.isPending}
                                    className="bg-status-warn/70 hover:bg-status-warn/70"
                                >
                                    {creditMutation.isPending ? (
                                        <>
                                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                                            Wird verarbeitet...
                                        </>
                                    ) : (
                                        'Gutschreiben'
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 mt-4">
                            {result.success ? (
                                <>
                                    <div className="bg-status-ok/15 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle2 className="w-5 h-5 text-status-ok" />
                                            <p className="font-semibold text-status-ok">Erfolgreich</p>
                                        </div>
                                        <p className="text-sm text-status-ok">{result.summary}</p>
                                    </div>

                                    {result.credited.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-2">Gutgeschrieben:</p>
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                                {result.credited.map((item, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-2 bg-status-ok/15 rounded text-sm">
                                                        <div>
                                                            <p className="font-medium text-muted-foreground">{item.employee}</p>
                                                            <p className="text-xs text-muted-foreground">{item.name} • {item.date}</p>
                                                        </div>
                                                        <Badge className="bg-status-ok/70">
                                                            {item.hours}h
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {result.skipped.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-2">Übersprungen:</p>
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                                {result.skipped.map((item, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-2 bg-card rounded text-sm">
                                                        <div>
                                                            <p className="font-medium text-muted-foreground">
                                                                {item.employee || item.name}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">{item.reason}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="bg-status-danger/15 p-4 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle className="w-5 h-5 text-status-danger" />
                                        <p className="font-semibold text-status-danger">Fehler</p>
                                    </div>
                                    <p className="text-sm text-status-danger">{result.error}</p>
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button onClick={handleClose}>
                                    Schließen
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}