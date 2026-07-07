import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { RepeatIcon, Check, X, Clock, CalendarDays } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { notifyEmployee, invalidateAllSwapQueries } from '@/lib/shiftSwapHelpers';

export default function ShiftSwapInboxCard({ currentEmployee }) {
    const queryClient = useQueryClient();

    const { data: allRequests = [], isLoading } = useQuery({
        queryKey: ['shift-swap-inbox', currentEmployee?.id],
        queryFn: () => base44.entities.ShiftSwapRequest.list('-created_date', 200),
        enabled: !!currentEmployee?.id,
        staleTime: 30000,
    });

    const today = format(new Date(), 'yyyy-MM-dd');

    // Direkte Anfragen an mich (target_employee_id), offen/ausstehend, Datum in der Zukunft
    const directRequests = allRequests.filter(r =>
        r.target_employee_id === currentEmployee?.id &&
        (r.status === 'offen' || r.status === 'ausstehend') &&
        r.shift_date >= today
    );

    const respondMutation = useMutation({
        mutationFn: async ({ request, accepted }) => {
            // Gegenseitiger 1:1-Tausch (DirectSwapModal): Personaldecke bleibt
            // unverändert (beide decken sich gegenseitig ab), daher braucht es
            // hier KEINEN zusätzlichen Manager-Schritt — sobald der Ziel-
            // Mitarbeiter zustimmt, werden beide Schichten sofort getauscht.
            if (accepted && request.is_mutual_swap && request.partner_shift_id) {
                await base44.entities.Shift.update(request.shift_id, {
                    employee_id: currentEmployee.id,
                    employee_name: currentEmployee.name,
                });
                await base44.entities.Shift.update(request.partner_shift_id, {
                    employee_id: request.requesting_employee_id,
                    employee_name: request.requesting_employee_name,
                });
                await base44.entities.ShiftSwapRequest.update(request.id, {
                    status: 'genehmigt',
                    approved_by: `${currentEmployee.name} (Selbstbestätigung, gegenseitiger Tausch)`,
                    response_date: new Date().toISOString(),
                });

                await notifyEmployee({
                    recipientId: request.requesting_employee_id,
                    title: 'Gegenseitiger Tausch bestätigt ✅',
                    message: `${currentEmployee.name} hat deinen Tausch-Vorschlag angenommen. Beide Schichten wurden bereits getauscht.`,
                    relatedId: request.id,
                });
                return;
            }

            const newStatus = accepted ? 'angenommen' : 'abgelehnt';
            await base44.entities.ShiftSwapRequest.update(request.id, {
                status: newStatus,
                response_date: new Date().toISOString(),
            });

            const title = accepted ? 'Tausch angenommen ✅' : 'Tausch abgelehnt ❌';
            const message = accepted
                ? `${currentEmployee.name} hat deinen Schichttausch für den ${format(parseISO(request.shift_date), 'dd.MM.', { locale: de })} angenommen. Ein Manager muss die Schicht jetzt noch final übertragen.`
                : `${currentEmployee.name} hat deinen Schichttausch für den ${format(parseISO(request.shift_date), 'dd.MM.', { locale: de })} abgelehnt.`;

            // Notify requester (nur er/sie sieht das, dank recipientId)
            await notifyEmployee({
                recipientId: request.requesting_employee_id,
                title,
                message,
                relatedId: request.id,
            });

            // Wenn angenommen: zusätzlich alle Manager benachrichtigen, damit
            // die Schicht auch tatsächlich übertragen wird (siehe Pending-Tab
            // in ShiftSwaps.jsx / ShiftSwapManager.jsx / ShiftSwapApprovalCard.jsx,
            // die den Status 'angenommen' jetzt korrekt anzeigen und einen
            // "Bestätigen"-Button anbieten).
            if (accepted) {
                await base44.entities.Notification.create({
                    type: 'general',
                    category: 'schicht',
                    title: 'Schichttausch angenommen 🔄',
                    message: `${currentEmployee.name} hat den Tausch mit ${request.requesting_employee_name} für den ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} angenommen. Bitte bestätigen, damit die Schicht übertragen wird.`,
                    related_id: request.id,
                    target_roles: ['admin', 'Manager'],
                    read_by: [],
                });
            }
        },
        onSuccess: (_, { request, accepted }) => {
            invalidateAllSwapQueries(queryClient);
            if (accepted && request.is_mutual_swap) {
                toast.success('Gegenseitiger Tausch bestätigt – beide Schichten wurden getauscht!');
            } else {
                toast.success(accepted ? 'Tausch angenommen – Manager muss noch final bestätigen.' : 'Tausch abgelehnt.');
            }
        },
        onError: (e) => toast.error('Fehler: ' + e.message),
    });

    if (isLoading || directRequests.length === 0) return null;

    return (
        <Card className="overflow-hidden bg-card border-orange-500/30">
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                    <RepeatIcon className="w-4 h-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm leading-tight">Schichttausch-Anfragen</p>
                    <p className="text-xs text-muted-foreground">Direkte Anfragen an dich</p>
                </div>
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs shrink-0">
                    {directRequests.length} offen
                </Badge>
            </div>

            <div className="px-4 pb-4 pt-1 space-y-3">
                {directRequests.map((request, idx) => (
                    <div key={request.id} style={{ '--delay': `${idx*50}ms` }} className="p-3 rounded-xl animate-stagger bg-orange-500/5 border border-orange-500/20">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5">
                                {request.requesting_employee_name?.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-foreground text-sm truncate">
                                    {request.requesting_employee_name}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                                    <CalendarDays className="w-3 h-3 shrink-0" />
                                    <span>{format(parseISO(request.shift_date), 'EEEE, dd.MM.yyyy', { locale: de })}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    <span>
                                        {request.shift_start_time && request.shift_end_time
                                            ? `${request.shift_start_time}–${request.shift_end_time}`
                                            : request.shift_time || 'Keine Zeitangabe'}
                                    </span>
                                    {request.shift_type && (
                                        <Badge className="text-[10px] bg-blue-500/20 text-blue-300 border-blue-500/30 px-1.5 py-0">
                                            {request.shift_type}
                                        </Badge>
                                    )}
                                </div>
                                {request.reason && (
                                    <p className="text-xs text-muted-foreground italic mt-1 truncate">„{request.reason}"</p>
                                )}
                                {request.is_mutual_swap && (
                                    <div className="mt-2 p-2 rounded-lg bg-secondary/50 border border-border/50">
                                        <p className="text-[10px] font-semibold text-orange-400 mb-1">🔁 Gegenseitiger Tausch — du gibst dafür ab:</p>
                                        <p className="text-xs text-foreground">
                                            {request.partner_shift_date && format(parseISO(request.partner_shift_date), 'EEEE, dd.MM.yyyy', { locale: de })}
                                            {request.partner_shift_time ? ` • ${request.partner_shift_time}` : ''}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={() => respondMutation.mutate({ request, accepted: false })}
                                disabled={respondMutation.isPending}
                                variant="outline"
                                className="flex-1 h-9 border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs gap-1.5"
                            >
                                <X className="w-3.5 h-3.5" /> Ablehnen
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => respondMutation.mutate({ request, accepted: true })}
                                disabled={respondMutation.isPending}
                                className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white text-xs gap-1.5"
                            >
                                <Check className="w-3.5 h-3.5" /> Annehmen
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

/** Hook: Anzahl offener Anfragen für Badge-Counter im Navigationsmenü */
export function useSwapInboxCount(currentEmployee) {
    const { data: allRequests = [] } = useQuery({
        queryKey: ['shift-swap-inbox', currentEmployee?.id],
        queryFn: () => base44.entities.ShiftSwapRequest.list('-created_date', 200),
        enabled: !!currentEmployee?.id,
        staleTime: 30000,
    });

    const today = format(new Date(), 'yyyy-MM-dd');
    return allRequests.filter(r =>
        r.target_employee_id === currentEmployee?.id &&
        (r.status === 'offen' || r.status === 'ausstehend') &&
        r.shift_date >= today
    ).length;
}