import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import haptics from '@/components/utils/haptics';
import { toast } from 'sonner';

export function ShiftMarketplace() {
    const [selectedShift, setSelectedShift] = useState(null);
    const [offerMessage, setOfferMessage] = useState('');
    const queryClient = useQueryClient();

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me(),
    });

    const { data: currentEmployee } = useQuery({
        queryKey: ['currentEmployee', currentUser?.email],
        queryFn: async () => {
            if (!currentUser) return null;
            const employees = await base44.entities.Employee.filter({
                email: currentUser.email,
                is_active: true
            });
            return employees[0];
        },
        enabled: !!currentUser,
    });

    // Get open shift swap requests (marketplace=true means open to all)
    const { data: openRequests = [] } = useQuery({
        queryKey: ['openShiftSwaps'],
        queryFn: async () => {
            const allPending = await base44.entities.ShiftSwapRequest.filter({ status: 'ausstehend' });
            // marketplace flag OR no target_employee_id set = open for everyone
            return allPending.filter(r => r.marketplace === true || (!r.target_employee_id && !r.target_employee_name));
        },
    });

    // Get shifts for the requests
    const { data: shifts = [] } = useQuery({
        queryKey: ['marketplaceShifts'],
        queryFn: async () => {
            if (openRequests.length === 0) return [];
            // ⚠️ War Shift.filter({}) ohne Limit — bei 750+ Schichten im System
            // konnten benoetigte Schichten ausserhalb des SDK-Default-Batches
            // fehlen und gar nicht im Marktplatz erscheinen. Jetzt gezielt
            // pro ID geladen — unabhaengig von der Tabellengroesse korrekt.
            const shiftIds = [...new Set(openRequests.map(r => r.shift_id))];
            const results = await Promise.all(
                shiftIds.map(id => base44.entities.Shift.filter({ id }))
            );
            return results.flat();
        },
        enabled: openRequests.length > 0,
    });

    const offerToTakeMutation = useMutation({
        mutationFn: async ({ request, message }) => {
            return await base44.entities.ShiftSwapRequest.update(request.id, {
                target_employee_id: currentEmployee.id,
                target_employee_name: currentEmployee.name,
                response_note: message,
                status: 'ausstehend' // Still pending, waiting for admin approval
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['openShiftSwaps'] });
            haptics.success();
            toast.success('Angebot gesendet! Ein Manager wird es prüfen.');
            setSelectedShift(null);
            setOfferMessage('');
        },
    });

    const handleOffer = (request) => {
        setSelectedShift(request);
    };

    const submitOffer = () => {
        if (!selectedShift) return;
        offerToTakeMutation.mutate({ 
            request: selectedShift, 
            message: offerMessage 
        });
    };

    const getShiftForRequest = (request) => {
        return shifts.find(s => s.id === request.shift_id);
    };

    if (!currentEmployee) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Schicht-Marktplatz</h2>
                    <p className="text-sm text-slate-400">
                        Kollegen suchen jemanden, der ihre Schicht übernimmt
                    </p>
                </div>
                <Badge variant="outline" className="text-slate-300">
                    {openRequests.length} offen
                </Badge>
            </div>

            {openRequests.length === 0 ? (
                <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="py-12 text-center">
                        <CheckCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">
                            Aktuell sind keine Schichten verfügbar
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {openRequests.map((request) => {
                        const shift = getShiftForRequest(request);
                        if (!shift) return null;

                        return (
                            <Card key={request.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
                                <CardHeader>
                                    <CardTitle className="text-white text-base flex items-center justify-between">
                                        <span>{request.requesting_employee_name}</span>
                                        <Badge variant="outline" className="text-amber-400">
                                            Offen
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <Calendar className="w-4 h-4" />
                                            <span className="text-sm">
                                                {new Date(shift.date).toLocaleDateString('de-DE', {
                                                    weekday: 'long',
                                                    day: '2-digit',
                                                    month: 'long'
                                                })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <Clock className="w-4 h-4" />
                                            <span className="text-sm">
                                                {shift.start_time} - {shift.end_time} Uhr
                                            </span>
                                        </div>
                                    </div>

                                    {request.reason && (
                                        <div className="bg-slate-900/50 rounded-lg p-3">
                                            <p className="text-sm text-slate-400 italic">
                                                "{request.reason}"
                                            </p>
                                        </div>
                                    )}

                                    <Button 
                                        onClick={() => handleOffer(request)}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        Schicht übernehmen
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Offer Dialog */}
            <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
                <DialogContent className="bg-slate-800 border-slate-700">
                    <DialogHeader>
                        <DialogTitle className="text-white">Schicht übernehmen</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedShift && (() => {
                            const shift = getShiftForRequest(selectedShift);
                            return shift ? (
                                <>
                                    <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <User className="w-4 h-4" />
                                            <span className="text-sm">{selectedShift.requesting_employee_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <Calendar className="w-4 h-4" />
                                            <span className="text-sm">
                                                {new Date(shift.date).toLocaleDateString('de-DE')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <Clock className="w-4 h-4" />
                                            <span className="text-sm">
                                                {shift.start_time} - {shift.end_time} Uhr
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm text-slate-300 mb-2 block">
                                            Nachricht (optional)
                                        </label>
                                        <Textarea
                                            value={offerMessage}
                                            onChange={(e) => setOfferMessage(e.target.value)}
                                            placeholder="Z.B. 'Ich kann die Schicht gerne übernehmen...'"
                                            className="bg-slate-900 border-slate-700 text-white"
                                            rows={3}
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => setSelectedShift(null)}
                                            className="flex-1"
                                        >
                                            Abbrechen
                                        </Button>
                                        <Button
                                            onClick={submitOffer}
                                            disabled={offerToTakeMutation.isPending}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                        >
                                            {offerToTakeMutation.isPending ? 'Sende...' : 'Angebot senden'}
                                        </Button>
                                    </div>
                                </>
                            ) : null;
                        })()}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}