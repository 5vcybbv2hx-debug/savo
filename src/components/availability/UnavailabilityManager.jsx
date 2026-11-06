import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function UnavailabilityManager() {
    const queryClient = useQueryClient();
    const [selectedReq, setSelectedReq] = useState(null);
    const [responseNote, setResponseNote] = useState('');

    const { data: requests = [] } = useQuery({
        queryKey: ['unavailability-requests-all'],
        queryFn: () => base44.entities.UnavailabilityRequest.list('-date', 200)
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees-active'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true })
    });

    const getFullName = (req) => {
        const emp = employees.find(e => e.id === req.employee_id);
        return emp?.name || req.employee_name;
    };

    const updateMutation = useMutation({
        mutationFn: ({ id, status, note }) => base44.entities.UnavailabilityRequest.update(id, {
            status,
            response_note: note,
            responded_by: 'Manager'
        }),
        onSuccess: () => {
            queryClient.invalidateQueries(['unavailability-requests-all']);
            setSelectedReq(null);
            setResponseNote('');
        }
    });

    const pending = requests.filter(r => r.status === 'ausstehend');
    const decided = requests.filter(r => r.status !== 'ausstehend');

    const handleDecide = (status) => {
        if (!selectedReq) return;
        updateMutation.mutate({ id: selectedReq.id, status, note: responseNote });
    };

    return (
        <div className="space-y-6">
            {/* Ausstehend */}
            <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-status-warn" />
                    Wünsche ausstehend ({pending.length})
                </h3>
                {pending.length === 0 ? (
                    <p className="text-sm text-foreground0 text-center py-4">Keine ausstehenden Wunschtage</p>
                ) : (
                    <div className="space-y-2">
                        {pending.map(req => (
                            <Card key={req.id} className="p-4 bg-status-warn/5 border-status-warn/20 cursor-pointer hover:border-status-warn/40 transition-all"
                                onClick={() => { setSelectedReq(req); setResponseNote(''); }}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold text-foreground text-sm">{getFullName(req)}</p>
                                            <Badge className="bg-status-warn/20 text-status-warn border-status-warn/30 text-xs">Ausstehend</Badge>
                                        </div>
                                        <p className="text-sm text-status-warn/25 font-medium">
                                            {format(parseISO(req.date), 'EEE, dd. MMM yyyy', { locale: de })}
                                            {req.end_date && req.end_date !== req.date && (
                                                <span className="text-muted-foreground"> – {format(parseISO(req.end_date), 'dd. MMM', { locale: de })}</span>
                                            )}
                                        </p>
                                        <p className="text-sm text-foreground/75 mt-1">{req.reason}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button size="sm" className="bg-status-ok/70 hover:bg-status-ok/70 text-foreground gap-1 text-xs px-2"
                                            onClick={e => { e.stopPropagation(); updateMutation.mutate({ id: req.id, status: 'genehmigt', note: '' }); }}>
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Einplanen
                                        </Button>
                                        <Button size="sm" className="bg-status-danger/70 hover:bg-status-danger/70 text-foreground gap-1 text-xs px-2"
                                            onClick={e => { e.stopPropagation(); setSelectedReq(req); setResponseNote(''); }}>
                                            <XCircle className="w-3.5 h-3.5" /> Ablehnen
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Entschieden */}
            {decided.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Bereits entschieden</h3>
                    <div className="space-y-2">
                        {decided.slice(0, 10).map(req => (
                            <Card key={req.id} className="p-3 bg-background border-border opacity-75">
                                <div className="flex items-center gap-3">
                                    {req.status === 'genehmigt'
                                        ? <CheckCircle2 className="w-4 h-4 text-status-ok shrink-0" />
                                        : <XCircle className="w-4 h-4 text-status-danger shrink-0" />
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground/75">{getFullName(req)} – {format(parseISO(req.date), 'dd. MMM', { locale: de })}</p>
                                        <p className="text-xs text-foreground0 truncate">{req.reason}</p>
                                    </div>
                                    <Badge className={req.status === 'genehmigt'
                                        ? 'bg-status-ok/20 text-status-ok border-status-ok/30 text-xs'
                                        : 'bg-status-danger/20 text-status-danger border-status-danger/30 text-xs'}>
                                        {req.status}
                                    </Badge>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Entscheid-Dialog */}
            <Dialog open={!!selectedReq} onOpenChange={() => { setSelectedReq(null); setResponseNote(''); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Wunsch ablehnen</DialogTitle>
                    </DialogHeader>
                    {selectedReq && (
                        <div className="space-y-4 mt-2">
                            <div className="p-4 bg-card rounded-lg space-y-1">
                                <p className="font-semibold text-foreground">{getFullName(selectedReq)}</p>
                                <p className="text-status-warn text-sm font-medium">
                                    {format(parseISO(selectedReq.date), 'EEE, dd. MMM yyyy', { locale: de })}
                                    {selectedReq.end_date && selectedReq.end_date !== selectedReq.date && (
                                        <span> – {format(parseISO(selectedReq.end_date), 'dd. MMM', { locale: de })}</span>
                                    )}
                                </p>
                                <p className="text-foreground/75 text-sm">{selectedReq.reason}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1"><MessageSquare className="w-4 h-4" /> Notiz (optional)</Label>
                                <Textarea
                                    value={responseNote}
                                    onChange={e => setResponseNote(e.target.value)}
                                    placeholder="Begründung oder Hinweis..."
                                    rows={2}
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => { setSelectedReq(null); setResponseNote(''); }}>
                                    Abbrechen
                                </Button>
                                <Button className="flex-1 bg-status-danger/70 hover:bg-status-danger/70 gap-2" onClick={() => handleDecide('abgelehnt')}>
                                    <XCircle className="w-4 h-4" /> Ablehnen
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}