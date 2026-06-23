import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { RepeatIcon, Check, X, Clock, ArrowRight, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

/**
 * Zeigt direkte Tausch-Anfragen an den eingeloggten Mitarbeiter (target_employee_id).
 * Direkt Annehmen/Ablehnen ohne Manager-Umweg für die erste Entscheidungsstufe.
 */
export default function PendingSwapRequestsCard({ currentEmployee }) {
    const queryClient = useQueryClient();

    const { data: allRequests = [] } = useQuery({
        queryKey: ['shift-swap-requests-for-me', currentEmployee?.id],
        queryFn: () => base44.entities.ShiftSwapRequest.filter(
            { target_employee_id: currentEmployee.id },
            '-created_date',
            50
        ),
        enabled: !!currentEmployee?.id,
        refetchInterval: 60000,
    });

    // Nur offene/ausstehende direkte Anfragen an mich
    const today = format(new Date(), 'yyyy-MM-dd');
    const pendingForMe = allRequests.filter(r =>
        (r.status === 'offen' || r.status === 'ausstehend') &&
        r.shift_date >= today
    );

    const respondMutation = useMutation({
        mutationFn: async ({ request, accepted }) => {
            const newStatus = accepted ? 'vergeben' : 'abgelehnt';
            await base44.entities.ShiftSwapRequest.update(request.id, {
                status: newStatus,
                response_date: new Date().toISOString(),
            });

            // Benachrichtigung an den anfragenden Mitarbeiter
            await base44.entities.Notification.create({
                type: 'general',
                category: 'schicht',
                priority: 'wichtig',
                title: accepted ? 'Schichttausch angenommen ✅' : 'Schichttausch abgelehnt ❌',
                message: accepted
                    ? `${currentEmployee.name} hat deinen Schichttausch für ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} (${request.shift_time || `${request.shift_start_time}–${request.shift_end_time}`}) angenommen. Warte auf Manager-Genehmigung.`
                    : `${currentEmployee.name} hat deinen Schichttausch für ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} abgelehnt.`,
                related_id: request.id,
                target_roles: ['admin', 'Manager'],
                read_by: []
            });

            // Bei Annahme: auch Manager benachrichtigen zur finalen Genehmigung
            if (accepted) {
                await base44.entities.Notification.create({
                    type: 'general',
                    category: 'schicht',
                    priority: 'wichtig',
                    title: '🔄 Schichttausch bereit zur Genehmigung',
                    message: `${currentEmployee.name} hat den Tausch mit ${request.requesting_employee_name} für ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} angenommen. Bitte genehmigen.`,
                    related_id: request.id,
                    target_roles: ['admin', 'Manager'],
                    read_by: []
                });
            }
        },
        onSuccess: (_, { accepted }) => {
            queryClient.invalidateQueries({ queryKey: ['shift-swap-requests-for-me'] });
            queryClient.invalidateQueries({ queryKey: ['shift-swap-requests'] });
            queryClient.invalidateQueries({ queryKey: ['shift-swap-requests-open'] });
            toast.success(accepted ? 'Tausch angenommen – Manager wird informiert.' : 'Tausch abgelehnt.');
        },
        onError: (e) => toast.error('Fehler: ' + e.message)
    });

    if (pendingForMe.length === 0) return null;

    return (
        <Card className="overflow-hidden bg-card border-amber-500/30 border">
            <div className="flex items-center gap-3 p-4 bg-amber-500/10 border-b border-amber-500/20">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <RepeatIcon className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1">
                    <p className="font-semibold text-foreground text-sm">Schichttausch-Anfragen an dich</p>
                    <p className="text-xs text-amber-400">
                        {pendingForMe.length} {pendingForMe.length === 1 ? 'Anfrage wartet' : 'Anfragen warten'} auf deine Antwort
                    </p>
                </div>
                <Badge className="bg-amber-500 text-amber-950 font-bold">{pendingForMe.length}</Badge>
            </div>

            <div className="divide-y divide-border">
                {pendingForMe.map(request => {
                    const shiftTime = request.shift_time || (request.shift_start_time && request.shift_end_time
                        ? `${request.shift_start_time}–${request.shift_end_time}`
                        : null);
                    const isPending = respondMutation.isPending;

                    return (
                        <div key={request.id} className="p-4">
                            <div className="flex items-start gap-3 mb-3">
                                <div className="w-9 h-9 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-300 font-bold text-sm shrink-0">
                                    {request.requesting_employee_name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground">
                                        {request.requesting_employee_name} fragt an
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                        <Calendar className="w-3 h-3" />
                                        <span className="font-medium text-foreground">
                                            {format(parseISO(request.shift_date), 'EEEE, dd. MMMM yyyy', { locale: de })}
                                        </span>
                                    </div>
                                    {shiftTime && (
                                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                                            <Clock className="w-3 h-3" />
                                            <span>{shiftTime}</span>
                                            {request.shift_type && <span>· {request.shift_type}</span>}
                                        </div>
                                    )}
                                    {request.reason && (
                                        <p className="text-xs text-muted-foreground italic mt-1.5 bg-background/50 rounded px-2 py-1">
                                            „{request.reason}"
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => respondMutation.mutate({ request, accepted: false })}
                                    disabled={isPending}
                                    className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10"
                                >
                                    <X className="w-3.5 h-3.5 mr-1" />
                                    Ablehnen
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => respondMutation.mutate({ request, accepted: true })}
                                    disabled={isPending}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <Check className="w-3.5 h-3.5 mr-1" />
                                    Annehmen
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="px-4 pb-3">
                <Link to={createPageUrl('ShiftSwaps')}>
                    <button className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-2 rounded-lg hover:bg-accent/30 transition-colors border border-border/50">
                        Alle Anfragen <ArrowRight className="w-3 h-3" />
                    </button>
                </Link>
            </div>
        </Card>
    );
}