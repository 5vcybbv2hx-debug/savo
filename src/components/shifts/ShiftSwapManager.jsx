import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RepeatIcon, Check, X, Clock } from 'lucide-react';
import { usePermissions } from '@/components/auth/usePermissions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import { queueMutation } from '@/components/utils/offlineSync';
import { notifyEmployee, invalidateAllSwapQueries } from '@/lib/shiftSwapHelpers';

export default function ShiftSwapManager() {
    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [responseNote, setResponseNote] = useState('');

    const { data: swapRequests = [] } = useQuery({
        queryKey: ['shift-swap-requests'],
        queryFn: () => base44.entities.ShiftSwapRequest.list('-created_date')
    });

    const { data: currentUser } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me()
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data, request }) => {
            if (!navigator.onLine) {
                // Offline: wird gequeued und synct automatisch bei Netz.
                await queueMutation({ entityName: 'ShiftSwapRequest', type: 'update', id, data });
                return { _offline: true };
            }

            await base44.entities.ShiftSwapRequest.update(id, data);
            
            // Create notification for requesting employee
            try {
                const requestingEmployee = await base44.entities.Employee.filter({ id: request.requesting_employee_id });
                if (requestingEmployee[0]) {
                    await notifyEmployee({
                        recipientId: requestingEmployee[0].id,
                        recipientEmail: requestingEmployee[0].email,
                        title: 'Schichttausch abgelehnt',
                        message: `Dein Schichttausch für ${format(new Date(request.shift_date), 'dd.MM.yyyy', { locale: de })} wurde abgelehnt.`,
                        relatedId: id,
                    });
                }
            } catch (error) {
                console.error('Fehler beim Erstellen der Benachrichtigung:', error);
            }
        },
        onSuccess: (result) => {
            invalidateAllSwapQueries(queryClient);
            setSelectedRequest(null);
            setResponseNote('');
            toast.success(result?._offline
                ? 'Kein Netz — Ablehnung wird synchronisiert, sobald du wieder online bist ⚡'
                : 'Tauschanfrage abgelehnt');
        },
        onError: (error) => {
            toast.error('Fehler beim Ablehnen: ' + error.message);
        }
    });

    const approveMutation = useMutation({
        mutationFn: async ({ requestId, shiftId, newEmployeeId, request }) => {
            if (!navigator.onLine) {
                // Offline: beide Aenderungen (Anfrage + Schicht-Neuzuweisung)
                // werden gequeued und in Reihenfolge synct, sobald wieder
                // Netz da ist. Benachrichtigungen entfallen dabei bewusst
                // (nur ein Nice-to-have, kein kritischer Datenverlust).
                await queueMutation({
                    entityName: 'ShiftSwapRequest', type: 'update', id: requestId,
                    data: {
                        status: 'genehmigt',
                        approved_by: currentUser?.full_name || currentUser?.email,
                        response_date: new Date().toISOString(),
                        response_note: responseNote
                    }
                });
                await queueMutation({
                    entityName: 'Shift', type: 'update', id: shiftId,
                    data: { employee_id: newEmployeeId, employee_name: request.target_employee_name }
                });
                return { success: true, _offline: true };
            }

            try {
                // First, get the shift to get the employee name
                const shifts = await base44.entities.Shift.filter({ id: shiftId });
                const shift = shifts[0];
                
                if (!shift) {
                    throw new Error('Schicht nicht gefunden');
                }

                // Update swap request status first
                await base44.entities.ShiftSwapRequest.update(requestId, {
                    status: 'genehmigt',
                    approved_by: currentUser?.full_name || currentUser?.email,
                    response_date: new Date().toISOString(),
                    response_note: responseNote
                });
                
                // Update the actual shift with both ID and name
                await base44.entities.Shift.update(shiftId, {
                    employee_id: newEmployeeId,
                    employee_name: request.target_employee_name
                });

                // Create notifications for both employees
                try {
                    const requestingEmployee = await base44.entities.Employee.filter({ id: request.requesting_employee_id });
                    const targetEmployee = await base44.entities.Employee.filter({ id: request.target_employee_id });

                    if (requestingEmployee[0]) {
                        await notifyEmployee({
                            recipientId: requestingEmployee[0].id,
                            recipientEmail: requestingEmployee[0].email,
                            title: 'Schichttausch genehmigt ✓',
                            message: `Dein Schichttausch für ${format(new Date(request.shift_date), 'dd.MM.yyyy', { locale: de })} wurde genehmigt.`,
                            relatedId: requestId,
                        });
                    }

                    if (targetEmployee[0]) {
                        await notifyEmployee({
                            recipientId: targetEmployee[0].id,
                            recipientEmail: targetEmployee[0].email,
                            title: 'Schichttausch genehmigt',
                            message: `Der Schichttausch mit ${request.requesting_employee_name} am ${format(new Date(request.shift_date), 'dd.MM.yyyy', { locale: de })} wurde genehmigt.`,
                            relatedId: requestId,
                        });
                    }
                } catch (error) {
                    console.error('Fehler beim Erstellen der Benachrichtigung:', error);
                }

                return { success: true };
            } catch (error) {
                console.error('Approval error:', error);
                throw error;
            }
        },
        onSuccess: (result) => {
            invalidateAllSwapQueries(queryClient);
            setSelectedRequest(null);
            setResponseNote('');
            toast.success(result?._offline
                ? 'Kein Netz — Genehmigung wird synchronisiert, sobald du wieder online bist ⚡'
                : 'Tauschanfrage genehmigt');
        },
        onError: (error) => {
            toast.error('Fehler beim Genehmigen: ' + error.message);
        }
    });

    const handleApprove = (request) => {
        if (confirm('Schichttausch genehmigen?')) {
            approveMutation.mutate({
                requestId: request.id,
                shiftId: request.shift_id,
                newEmployeeId: request.target_employee_id,
                request: request
            });
        }
    };

    const handleReject = (request) => {
        if (confirm('Schichttausch ablehnen?')) {
            updateMutation.mutate({
                id: request.id,
                data: {
                    status: 'abgelehnt',
                    approved_by: currentUser?.full_name || currentUser?.email,
                    response_date: new Date().toISOString(),
                    response_note: responseNote
                },
                request: request
            });
        }
    };

    // 'angenommen' = Mitarbeiter hat via Inbox-Karte direkt zugesagt, wartet
    // noch auf die eigentliche Schicht-Übertragung durch den Manager — muss
    // hier sichtbar bleiben, sonst verschwindet die Anfrage ohne Reassignment.
    const pendingRequests = swapRequests.filter(r => r.status === 'ausstehend' || r.status === 'offen' || r.status === 'angenommen');
    const processedRequests = swapRequests.filter(r => !['ausstehend', 'offen', 'angenommen'].includes(r.status));

    // Nur Manager/Admins können Tauschanfragen verwalten
    if (!permissions.canApproveShiftSwaps) {
        return null;
    }

    return (
        <>
            <Button 
                variant="outline" 
                onClick={() => setModalOpen(true)}
                className="border-slate-600 hover:bg-slate-700 text-slate-300 relative"
            >
                <RepeatIcon className="w-4 h-4 mr-2" />
                Tauschanfragen
                {pendingRequests.length > 0 && (
                    <Badge className="ml-2 bg-red-500 text-white">{pendingRequests.length}</Badge>
                )}
            </Button>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Schichttausch Anfragen</DialogTitle>
                    </DialogHeader>

                    <Tabs defaultValue="pending" className="mt-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="pending">
                                Ausstehend ({pendingRequests.length})
                            </TabsTrigger>
                            <TabsTrigger value="processed">
                                Bearbeitet ({processedRequests.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="pending" className="space-y-3 mt-4">
                            {pendingRequests.length > 0 ? (
                                pendingRequests.map(request => (
                                    <Card key={request.id} className="p-4 bg-slate-50">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge className={request.status === 'angenommen' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}>
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {request.status === 'angenommen' ? 'Akzeptiert – wartet auf Bestätigung' : 'Ausstehend'}
                                                    </Badge>
                                                    <span className="text-xs text-slate-500">
                                                        {format(new Date(request.created_date), 'dd.MM.yyyy HH:mm', { locale: de })}
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-700">
                                                            {request.requesting_employee_name} → {request.target_employee_name}
                                                        </p>
                                                        <p className="text-sm text-slate-600">
                                                            {format(new Date(request.shift_date), 'EEEE, d. MMMM', { locale: de })} • {request.shift_time}
                                                        </p>
                                                    </div>
                                                    
                                                    {request.reason && (
                                                        <div className="p-2 bg-white rounded border border-slate-200">
                                                            <p className="text-xs text-slate-500 mb-1">Grund:</p>
                                                            <p className="text-sm text-slate-700">{request.reason}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Gegenseitige Tausche bestätigen sich selbst über die Inbox-Karte
                                            des Ziel-Mitarbeiters — kein Manager-Genehmigen hier, da die
                                            einfache Genehmigen-Logik nur EINE Schicht übertragen würde. */}
                                        {request.is_mutual_swap ? (
                                            <div className="mt-4 pt-3 border-t border-slate-200">
                                                <Badge className="bg-blue-100 text-blue-700">
                                                    🔁 Wartet auf Bestätigung von {request.target_employee_name}
                                                </Badge>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleReject(request)}
                                                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                                                >
                                                    <X className="w-4 h-4 mr-1" />
                                                    Ablehnen
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApprove(request)}
                                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                                >
                                                    <Check className="w-4 h-4 mr-1" />
                                                    {request.status === 'angenommen' ? 'Bestätigen & übertragen' : 'Genehmigen'}
                                                </Button>
                                            </div>
                                        )}
                                    </Card>
                                ))
                            ) : (
                                <div className="text-center py-12 text-slate-500">
                                    <RepeatIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>Keine ausstehenden Anfragen</p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="processed" className="space-y-3 mt-4">
                            {processedRequests.length > 0 ? (
                                processedRequests.map(request => (
                                    <Card key={request.id} className="p-4 bg-slate-50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge className={cn(
                                                request.status === 'genehmigt' 
                                                    ? "bg-green-100 text-green-700" 
                                                    : "bg-red-100 text-red-700"
                                            )}>
                                                {request.status === 'genehmigt' ? (
                                                    <Check className="w-3 h-3 mr-1" />
                                                ) : (
                                                    <X className="w-3 h-3 mr-1" />
                                                )}
                                                {request.status === 'genehmigt' ? 'Genehmigt' : 'Abgelehnt'}
                                            </Badge>
                                            <span className="text-xs text-slate-500">
                                                {format(new Date(request.response_date || request.created_date), 'dd.MM.yyyy', { locale: de })}
                                            </span>
                                        </div>
                                        
                                        <p className="text-sm text-slate-700">
                                            {request.requesting_employee_name} → {request.target_employee_name}
                                        </p>
                                        <p className="text-sm text-slate-600">
                                            {format(new Date(request.shift_date), 'dd.MM.yyyy', { locale: de })} • {request.shift_time}
                                        </p>
                                        
                                        {request.approved_by && (
                                            <p className="text-xs text-slate-500 mt-2">
                                                von {request.approved_by}
                                            </p>
                                        )}
                                    </Card>
                                ))
                            ) : (
                                <div className="text-center py-12 text-slate-500">
                                    <p>Keine bearbeiteten Anfragen</p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </>
    );
}