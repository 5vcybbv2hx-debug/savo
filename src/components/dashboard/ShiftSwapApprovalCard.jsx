import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { RepeatIcon, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { notifyEmployee, invalidateAllSwapQueries } from '@/lib/shiftSwapHelpers';

export default function ShiftSwapApprovalCard() {
    const queryClient = useQueryClient();

    const { data: currentUser } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me()
    });

    const { data: pendingRequests = [] } = useQuery({
        queryKey: ['shift-swap-requests-pending'],
        queryFn: async () => {
            const all = await base44.entities.ShiftSwapRequest.list('-created_date', 200);
            // 'angenommen' = per Inbox-Karte bereits vom Mitarbeiter akzeptiert,
            // wartet noch auf Schicht-Übertragung — muss sichtbar bleiben.
            return all.filter(r => r.status === 'ausstehend' || r.status === 'offen' || r.status === 'angenommen');
        }
    });

    const { data: bids = [] } = useQuery({
        queryKey: ['shift-swap-bids'],
        queryFn: () => base44.entities.ShiftSwapBid.list('-created_date', 500)
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true })
    });

    const approveMutation = useMutation({
        mutationFn: async ({ requestId, shiftId, newEmployeeId, newEmployeeName, request }) => {
            await base44.entities.ShiftSwapRequest.update(requestId, {
                status: 'genehmigt',
                target_employee_id: newEmployeeId,
                target_employee_name: newEmployeeName,
                approved_by: currentUser?.full_name || currentUser?.email,
                response_date: new Date().toISOString()
            });
            await base44.entities.Shift.update(shiftId, {
                employee_id: newEmployeeId,
                employee_name: newEmployeeName
            });
            // Gegenseitiger 1:1-Tausch: Partner-Schicht zurück an den
            // ursprünglich Anfragenden geben, sonst hätte der
            // Ziel-Mitarbeiter am Ende beide Schichten.
            if (request.is_mutual_swap && request.partner_shift_id) {
                await base44.entities.Shift.update(request.partner_shift_id, {
                    employee_id: request.requesting_employee_id,
                    employee_name: request.requesting_employee_name,
                });
            }
            // Update bids
            const allBids = await base44.entities.ShiftSwapBid.filter({ swap_request_id: requestId });
            for (const bid of allBids) {
                await base44.entities.ShiftSwapBid.update(bid.id, {
                    status: bid.bidding_employee_id === newEmployeeId ? 'akzeptiert' : 'abgelehnt'
                });
            }
            // Notifications
            const requester = employees.find(e => e.id === request.requesting_employee_id);
            const target = employees.find(e => e.id === newEmployeeId);
            if (requester) {
                await notifyEmployee({
                    recipientId: requester.id,
                    recipientEmail: requester.email,
                    title: 'Schichttausch genehmigt ✓',
                    message: request.is_mutual_swap
                        ? `Dein gegenseitiger Tausch mit ${newEmployeeName} wurde genehmigt. Beide Schichten wurden getauscht.`
                        : `Dein Schichttausch für ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} wurde genehmigt. ${newEmployeeName} übernimmt.`,
                    relatedId: requestId,
                });
            }
            if (target) {
                await notifyEmployee({
                    recipientId: target.id,
                    recipientEmail: target.email,
                    title: request.is_mutual_swap ? 'Gegenseitiger Tausch genehmigt ✓' : 'Du übernimmst eine Schicht',
                    message: request.is_mutual_swap
                        ? `Euer gegenseitiger Tausch mit ${request.requesting_employee_name} wurde genehmigt. Beide Schichten wurden getauscht.`
                        : `Du übernimmst die Schicht von ${request.requesting_employee_name} am ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })}.`,
                    relatedId: requestId,
                });
            }
        },
        onSuccess: () => {
            invalidateAllSwapQueries(queryClient);
            toast.success('Schichttausch genehmigt – Kalender aktualisiert');
        },
        onError: (e) => toast.error('Fehler: ' + e.message)
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ requestId, request }) => {
            await base44.entities.ShiftSwapRequest.update(requestId, {
                status: 'abgelehnt',
                approved_by: currentUser?.full_name || currentUser?.email,
                response_date: new Date().toISOString()
            });
            const requester = employees.find(e => e.id === request.requesting_employee_id);
            if (requester) {
                await notifyEmployee({
                    recipientId: requester.id,
                    recipientEmail: requester.email,
                    title: 'Schichttausch abgelehnt',
                    message: `Dein Schichttausch für ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} wurde abgelehnt.`,
                    relatedId: requestId,
                });
            }
        },
        onSuccess: () => {
            invalidateAllSwapQueries(queryClient);
            toast.success('Schichttausch abgelehnt');
        },
        onError: (e) => toast.error('Fehler: ' + e.message)
    });

    if (pendingRequests.length === 0) return null;

    return (
        <Card className="p-5 bg-card border-border">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <RepeatIcon className="w-4 h-4 text-amber-400" />
                </div>
                <h2 className="font-bold text-foreground">Schichttausch-Anfragen</h2>
                <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 ml-auto">
                    {pendingRequests.length} ausstehend
                </Badge>
            </div>

            <div className="space-y-3">
                {pendingRequests.map(request => {
                    const requestBids = bids.filter(b => b.swap_request_id === request.id);
                    return (
                        <div key={request.id} className="p-3 rounded-lg bg-background/50 border border-border/50 space-y-2">
                            <div>
                                <p className="font-medium text-foreground text-sm">
                                    {request.requesting_employee_name}
                                    {request.target_employee_name ? ` → ${request.target_employee_name}` : ' (Marketplace)'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {format(parseISO(request.shift_date), 'EEE, dd.MM.yyyy', { locale: de })} • {request.shift_time}
                                </p>
                                {request.reason && (
                                    <p className="text-xs text-muted-foreground italic mt-0.5">„{request.reason}"</p>
                                )}
                                {request.status === 'angenommen' && (
                                    <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] mt-1">
                                        Akzeptiert – wartet auf Bestätigung
                                    </Badge>
                                )}
                            </div>

                            {/* Direct swap (with target employee) — gilt auch für gegenseitige
                                Tausche (is_mutual_swap): approveMutation tauscht dann beide Schichten. */}
                            {!request.marketplace && request.target_employee_id && (
                                <div className="flex gap-2 pt-1">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => rejectMutation.mutate({ requestId: request.id, request })}
                                        disabled={rejectMutation.isPending}
                                        className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                                    >
                                        <X className="w-3 h-3 mr-1" />
                                        Ablehnen
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => approveMutation.mutate({
                                            requestId: request.id,
                                            shiftId: request.shift_id,
                                            newEmployeeId: request.target_employee_id,
                                            newEmployeeName: request.target_employee_name,
                                            request
                                        })}
                                        disabled={approveMutation.isPending}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                                    >
                                        <Check className="w-3 h-3 mr-1" />
                                        {request.is_mutual_swap
                                            ? 'Bestätigen & tauschen'
                                            : (request.status === 'angenommen' ? 'Bestätigen' : 'Genehmigen')}
                                    </Button>
                                </div>
                            )}

                            {/* Marketplace: show bidders */}
                            {request.marketplace && (
                                <div>
                                    {requestBids.length === 0 ? (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground">Noch keine Bewerber</p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => rejectMutation.mutate({ requestId: request.id, request })}
                                                className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                                            >
                                                <X className="w-3 h-3 mr-1" />
                                                Ablehnen
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            <p className="text-xs text-muted-foreground font-medium">Bewerber:</p>
                                            {requestBids.map(bid => (
                                                <div key={bid.id} className="flex items-center justify-between">
                                                    <span className="text-sm text-foreground">{bid.bidding_employee_name}</span>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => rejectMutation.mutate({ requestId: request.id, request })}
                                                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-7 px-2"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => approveMutation.mutate({
                                                                requestId: request.id,
                                                                shiftId: request.shift_id,
                                                                newEmployeeId: bid.bidding_employee_id,
                                                                newEmployeeName: bid.bidding_employee_name,
                                                                request
                                                            })}
                                                            className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-2"
                                                        >
                                                            <Check className="w-3 h-3 mr-1" />
                                                            Auswählen
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}