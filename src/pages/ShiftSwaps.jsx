import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { RepeatIcon, Check, X, Clock, Calendar, AlertCircle, User, Search, Users } from 'lucide-react';
import { usePermissions } from '@/components/auth/usePermissions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { format, isPast, parseISO, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import { sendPushNotification } from '@/lib/pushService';
import ShiftSwapRequestModal from '@/components/shifts/ShiftSwapRequestModal';
import ShiftMarketplaceModal from '@/components/shifts/ShiftMarketplaceModal';
import DirectSwapModal from '@/components/shifts/DirectSwapModal';
import { LoadingState, ListSkeleton, ErrorState } from '@/components/ui/StateDisplay';
import { 
  sortBidsByTimestamp, 
  groupBidsByStatus, 
  formatBidTime, 
  getStatusLabel, 
  getStatusColor 
} from '@/lib/shiftSwapHelpers';

export default function ShiftSwaps() {
    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState(null);
    const [marketplaceOpen, setMarketplaceOpen] = useState(false);
    const [directSwapOpen, setDirectSwapOpen] = useState(false);
    // Confirm-Dialoge (statt confirm())
    const [confirmDialog, setConfirmDialog] = useState(null); // { type, request, bidId, bidName }

    const { data: swapRequests = [], isLoading: loadingRequests } = useQuery({
        queryKey: ['shift-swap-requests'],
        queryFn: () => base44.entities.ShiftSwapRequest.list('-created_date', 100)
    });

    const { data: bids = [] } = useQuery({
        queryKey: ['shift-swap-bids'],
        queryFn: () => base44.entities.ShiftSwapBid.filter({ status: 'ausstehend' }, '-created_date', 200)
    });

    const { data: currentUser } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me()
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true })
    });

    const { data: shifts = [] } = useQuery({
        queryKey: ['shifts'],
        queryFn: async () => {
            const from = format(new Date(), 'yyyy-MM-dd');
            const to = format(addDays(new Date(), 60), 'yyyy-MM-dd');
            // Base44 SDK unterstützt keine date_gte/date_lte Filter — clientseitig filtern
            const all = await base44.entities.Shift.list('date', 500);
            return all.filter(s => s.date >= from && s.date <= to);
        },
        staleTime: STALE.MEDIUM,
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data, request }) => {
            await base44.entities.ShiftSwapRequest.update(id, data);
            
            try {
                const requestingEmployee = employees.find(e => e.id === request.requesting_employee_id);
                if (requestingEmployee?.email) {
                    await base44.entities.Notification.create({
                        type: 'shift_swap',
                        title: data.status === 'genehmigt' ? 'Schichttausch genehmigt' : 'Schichttausch abgelehnt',
                        message: `Dein Schichttausch für ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} wurde ${data.status === 'genehmigt' ? 'genehmigt' : 'abgelehnt'}.`,
                        related_id: id,
                        read_by: []
                    });
                    sendPushNotification({
                        title: data.status === 'genehmigt' ? 'Schichttausch genehmigt ✓' : 'Schichttausch abgelehnt',
                        message: `Dein Schichttausch für ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} wurde ${data.status === 'genehmigt' ? 'genehmigt' : 'abgelehnt'}.`,
                        external_user_id: request.requesting_employee_id
                    }).catch(() => {});
                }
            } catch (error) {
                console.error('Fehler beim Erstellen der Benachrichtigung:', error);
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['shift-swap-requests'] });
            setSelectedRequest(null);
            toast.success(variables.data.status === 'genehmigt' ? 'Tauschanfrage genehmigt' : 'Tauschanfrage abgelehnt');
        }
    });

    const approveMutation = useMutation({
        mutationFn: async ({ requestId, shiftId, newEmployeeId, newEmployeeName, request }) => {
            // Update swap request status
            await base44.entities.ShiftSwapRequest.update(requestId, {
                status: 'genehmigt',
                target_employee_id: newEmployeeId,
                target_employee_name: newEmployeeName,
                approved_by: currentUser?.full_name || currentUser?.email,
                response_date: new Date().toISOString()
            });
            
            // Update the actual shift in the calendar
            await base44.entities.Shift.update(shiftId, {
                employee_id: newEmployeeId,
                employee_name: newEmployeeName
            });

            // Reject all other bids for this request
            try {
                const allBids = await base44.entities.ShiftSwapBid.filter({ swap_request_id: requestId });
                for (const bid of allBids) {
                    await base44.entities.ShiftSwapBid.update(bid.id, {
                        status: bid.bidding_employee_id === newEmployeeId ? 'akzeptiert' : 'abgelehnt'
                    });
                }
            } catch (error) {
                console.error('Fehler beim Aktualisieren der Bewerbungen:', error);
            }

            try {
                const requestingEmployee = employees.find(e => e.id === request.requesting_employee_id);
                const targetEmployee = employees.find(e => e.id === newEmployeeId);
                
                if (requestingEmployee) {
                    await base44.entities.Notification.create({
                        type: 'shift_swap',
                        title: 'Schichttausch genehmigt',
                        message: `Dein Schichttausch für ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} wurde genehmigt. ${newEmployeeName} übernimmt deine Schicht.`,
                        related_id: requestId,
                        read_by: []
                    });
                    sendPushNotification({
                        title: 'Schichttausch genehmigt ✓',
                        message: `Dein Schichttausch für ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} wurde genehmigt. ${newEmployeeName} übernimmt deine Schicht.`,
                        external_user_id: request.requesting_employee_id
                    }).catch(() => {});
                }
                
                if (targetEmployee) {
                    await base44.entities.Notification.create({
                        type: 'shift_swap',
                        title: 'Schichttausch genehmigt – Du übernimmst die Schicht',
                        message: `Du übernimmst die Schicht von ${request.requesting_employee_name} am ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })}.`,
                        related_id: requestId,
                        read_by: []
                    });
                    sendPushNotification({
                        title: 'Schichttausch genehmigt',
                        message: `Du übernimmst die Schicht von ${request.requesting_employee_name} am ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })}.`,
                        external_user_id: newEmployeeId
                    }).catch(() => {});
                }
            } catch (error) {
                console.error('Fehler beim Erstellen der Benachrichtigung:', error);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shift-swap-requests'] });
            queryClient.invalidateQueries({ queryKey: ['shift-swap-bids'] });
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
            setSelectedRequest(null);
            toast.success('Schichttausch genehmigt – Kalender wurde aktualisiert');
        }
    });

    const handleApprove = (request, bidEmployeeId, bidEmployeeName) => {
        // For marketplace requests, require selecting a bidder
        if (request.marketplace && !bidEmployeeId) {
            toast.error('Bitte wähle einen Bewerber aus');
            return;
        }
        const newEmployeeId = bidEmployeeId || request.target_employee_id;
        const newEmployeeName = bidEmployeeName || request.target_employee_name;
        setConfirmDialog({ type: 'approve', request, bidId: newEmployeeId, bidName: newEmployeeName });
    };

    const handleReject = (request) => {
        setConfirmDialog({ type: 'reject', request });
    };

    const handleWithdraw = (request) => {
        setConfirmDialog({ type: 'withdraw', request });
    };

    const handleCreateRequest = (shift) => {
        setSelectedShift(shift);
        setCreateModalOpen(true);
    };

    // Filter current employee
    const currentEmployee = employees.find(e => e.email === currentUser?.email);

    // Filter requests
    const myRequests = swapRequests.filter(r => 
        r.requesting_employee_id === currentEmployee?.id ||
        r.target_employee_id === currentEmployee?.id
    );

    // Offene Anfragen: beide Status-Werte (offen = neuer, ausstehend = Legacy)
    const isOpenStatus = (r) => r.status === 'offen' || r.status === 'ausstehend';
    const pendingRequests = swapRequests.filter(r => isOpenStatus(r));
    const processedRequests = swapRequests.filter(r => !isOpenStatus(r));

    // Filter my upcoming shifts
    const myUpcomingShifts = shifts
        .filter(s => 
            s.employee_id === currentEmployee?.id && 
            !isPast(parseISO(s.date))
        )
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 10);

    // Filter shifts based on search
    const filteredShifts = searchQuery 
        ? myUpcomingShifts.filter(s => 
            s.date.includes(searchQuery) || 
            s.shift_type?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : myUpcomingShifts;

    const getStatusBadge = (status) => {
        if (status === 'ausstehend' || status === 'offen' || status === 'in_prüfung') {
            return (
                <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Clock className="w-3 h-3 mr-1" />
                    {status === 'offen' ? 'Offen' : status === 'in_prüfung' ? 'In Prüfung' : 'Ausstehend'}
                </Badge>
            );
        } else if (status === 'genehmigt' || status === 'abgeschlossen') {
            return (
                <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">
                    <Check className="w-3 h-3 mr-1" />
                    {status === 'abgeschlossen' ? 'Abgeschlossen' : 'Genehmigt'}
                </Badge>
            );
        } else if (status === 'storniert' || status === 'abgelaufen') {
            return (
                <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30">
                    <X className="w-3 h-3 mr-1" />
                    {status === 'storniert' ? 'Storniert' : 'Abgelaufen'}
                </Badge>
            );
        } else {
            return (
                <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">
                    <X className="w-3 h-3 mr-1" />
                    Abgelehnt
                </Badge>
            );
        }
    };

    if (loadingRequests) return (
        <div className="min-h-screen bg-background px-4 py-6 space-y-4">
            <ListSkeleton count={1} height="h-10" />
            <ListSkeleton count={4} height="h-28" />
        </div>
    );

    // Confirm-Aktion ausführen
    const executeConfirm = () => {
        if (!confirmDialog) return;
        const { type, request, bidId, bidName } = confirmDialog;
        if (type === 'withdraw') {
            updateMutation.mutate({
                id: request.id,
                data: { status: 'storniert', response_date: new Date().toISOString() },
                request,
            });
        } else if (type === 'reject') {
            updateMutation.mutate({
                id: request.id,
                data: {
                    status: 'abgelehnt',
                    approved_by: currentUser?.full_name || currentUser?.email,
                    response_date: new Date().toISOString(),
                },
                request,
            });
        } else if (type === 'approve') {
            approveMutation.mutate({
                requestId: request.id,
                shiftId: request.shift_id,
                newEmployeeId: bidId,
                newEmployeeName: bidName,
                request,
            });
        }
        setConfirmDialog(null);
    };

    const confirmTexts = {
        withdraw: { title: 'Anfrage zurückziehen?', desc: 'Die Tauschanfrage wird storniert und kann nicht wiederhergestellt werden.', action: 'Zurückziehen', variant: 'destructive' },
        reject:   { title: 'Tausch ablehnen?', desc: 'Die Anfrage wird abgelehnt. Der Mitarbeiter wird benachrichtigt.', action: 'Ablehnen', variant: 'destructive' },
        approve:  { title: 'Tausch genehmigen?', desc: `${confirmDialog?.bidName || ''} übernimmt die Schicht. Der Kalender wird automatisch aktualisiert.`, action: 'Genehmigen', variant: 'default' },
    };

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <RepeatIcon className="w-7 h-7 text-slate-900" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Schichttausch</h1>
                            <p className="text-muted-foreground">Schichten anbieten, anfragen und genehmigen</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mb-6">
                    <Button
                        onClick={() => setMarketplaceOpen(true)}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white gap-2 flex-1 sm:flex-none"
                    >
                        <Users className="w-4 h-4" />
                        Marketplace
                    </Button>
                    <Button
                        onClick={() => setDirectSwapOpen(true)}
                        className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white gap-2 flex-1 sm:flex-none"
                    >
                        <RepeatIcon className="w-4 h-4" />
                        Direkt tauschen
                    </Button>
                </div>

                <Tabs defaultValue={permissions.isManager ? "pending" : "my-requests"} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid bg-card border border-border/50">
                        <TabsTrigger value="my-requests" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-slate-900">
                            <User className="w-4 h-4" />
                            Meine Anfragen
                            {myRequests.filter(r => isOpenStatus(r)).length > 0 && (
                                <Badge className="ml-1 bg-amber-500 text-slate-900 text-xs px-1.5 py-0">
                                    {myRequests.filter(r => isOpenStatus(r)).length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="my-shifts" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-slate-900">
                            <Calendar className="w-4 h-4" />
                            Meine Schichten
                        </TabsTrigger>
                        {permissions.isManager && (
                            <TabsTrigger value="pending" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-slate-900">
                                <AlertCircle className="w-4 h-4" />
                                Zu genehmigen
                                {pendingRequests.length > 0 && (
                                    <Badge className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0">
                                        {pendingRequests.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* My Requests Tab */}
                    <TabsContent value="my-requests" className="space-y-4">
                        {myRequests.length > 0 ? (
                            <div className="grid gap-4">
                                {myRequests.map(request => {
                                    const isRequester = request.requesting_employee_id === currentEmployee?.id;
                                    return (
                                        <Card key={request.id} className="p-5 bg-card border-border hover:border-amber-500/30 transition-all">
                                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                <div className="flex-1">
                                                   <div className="flex items-center gap-2 mb-3">
                                                       {getStatusBadge(request.status)}
                                                       <span className="text-xs text-muted-foreground">
                                                           {format(parseISO(request.created_date), 'dd.MM.yyyy HH:mm', { locale: de })}
                                                       </span>
                                                   </div>

                                                   <div className="space-y-2">
                                                       <div className="flex items-center gap-2">
                                                           <RepeatIcon className="w-4 h-4 text-muted-foreground" />
                                                           <p className="text-sm font-medium text-foreground">
                                                               {isRequester ? (
                                                                   <>Du → {request.target_employee_name}</>
                                                               ) : (
                                                                   <>{request.requesting_employee_name} → Du</>
                                                               )}
                                                           </p>
                                                       </div>
                                                       <div className="flex items-center gap-2">
                                                           <Calendar className="w-4 h-4 text-muted-foreground" />
                                                           <p className="text-sm text-muted-foreground">
                                                               {format(parseISO(request.shift_date), 'EEEE, d. MMMM yyyy', { locale: de })} • {request.shift_time}
                                                           </p>
                                                       </div>
                                                   </div>

                                                   {request.reason && (
                                                       <div className="mt-3 p-3 bg-secondary rounded-lg border border-border">
                                                           <p className="text-xs text-muted-foreground mb-1">Grund:</p>
                                                           <p className="text-sm text-foreground">{request.reason}</p>
                                                       </div>
                                                   )}

                                                   {request.approved_by && (
                                                       <p className="text-xs text-muted-foreground mt-3">
                                                           {request.status === 'genehmigt' ? 'Genehmigt' : 'Abgelehnt'} von {request.approved_by} am {format(parseISO(request.response_date), 'dd.MM.yyyy', { locale: de })}
                                                       </p>
                                                   )}
                                                </div>
                                                {isRequester && request.status === 'ausstehend' && (
                                                   <Button
                                                       variant="outline"
                                                       onClick={() => handleWithdraw(request)}
                                                       className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                                   >
                                                       <X className="w-4 h-4 mr-2" />
                                                       Zurückziehen
                                                   </Button>
                                                )}
                                                </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <Card className="p-12 bg-card border-border">
                                <div className="text-center text-muted-foreground">
                                    <RepeatIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p className="text-lg font-medium mb-1 text-foreground">Keine Tauschanfragen</p>
                                    <p className="text-sm">Gehe zu "Meine Schichten", um eine Schicht anzubieten</p>
                                </div>
                            </Card>
                        )}
                    </TabsContent>

                    {/* My Shifts Tab */}
                    <TabsContent value="my-shifts" className="space-y-4">
                        <div className="mb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <Input
                                    type="text"
                                    placeholder="Schichten durchsuchen..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        {filteredShifts.length > 0 ? (
                            <div className="grid gap-4">
                                {filteredShifts.map(shift => {
                                    const hasPendingRequest = swapRequests.some(r => 
                                        r.shift_id === shift.id && r.status === 'ausstehend'
                                    );
                                    return (
                                        <Card key={shift.id} className="p-5 bg-card border-border hover:border-amber-500/30 transition-all">
                                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                            {shift.shift_type}
                                                        </Badge>
                                                        {hasPendingRequest && (
                                                            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                                <Clock className="w-3 h-3 mr-1" />
                                                                Tausch läuft
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-lg font-semibold text-foreground mb-1">
                                                        {format(parseISO(shift.date), 'EEEE, d. MMMM yyyy', { locale: de })}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {shift.start_time} - {shift.end_time}
                                                    </p>
                                                    {shift.notes && (
                                                        <p className="text-xs text-muted-foreground mt-2">{shift.notes}</p>
                                                    )}
                                                </div>
                                                <div>
                                                    <Button
                                                        onClick={() => handleCreateRequest(shift)}
                                                        disabled={hasPendingRequest}
                                                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 disabled:opacity-50 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500"
                                                    >
                                                        <RepeatIcon className="w-4 h-4 mr-2" />
                                                        {hasPendingRequest ? 'Anfrage läuft' : 'Tausch anfragen'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <Card className="p-12 bg-card border-border">
                                <div className="text-center text-muted-foreground">
                                    <Calendar className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p className="text-lg font-medium mb-1 text-foreground">Keine Schichten gefunden</p>
                                    <p className="text-sm">Du hast aktuell keine bevorstehenden Schichten</p>
                                </div>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Manager Approval Tab */}
                    {permissions.isManager && (
                        <TabsContent value="pending" className="space-y-4">
                            {pendingRequests.length > 0 ? (
                                <div className="grid gap-4">
                                    {pendingRequests.map(request => (
                                        <Card key={request.id} className="p-5 bg-card border-border hover:border-amber-500/30 transition-all border-l-4 border-l-amber-500">
                                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            Ausstehend
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            {format(parseISO(request.created_date), 'dd.MM.yyyy HH:mm', { locale: de })}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-2 mb-4">
                                                        <p className="text-lg font-semibold text-foreground">
                                                            {request.requesting_employee_name} → {request.target_employee_name}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {format(parseISO(request.shift_date), 'EEEE, d. MMMM yyyy', { locale: de })} • {request.shift_time}
                                                        </p>
                                                    </div>

                                                    {request.reason && (
                                                       <div className="p-3 bg-secondary rounded-lg border border-border">
                                                           <p className="text-xs text-muted-foreground mb-1">Grund:</p>
                                                           <p className="text-sm text-foreground">{request.reason}</p>
                                                       </div>
                                                    )}

                                                     {/* Show bids for marketplace requests */}
                                                     {request.marketplace && (() => {
                                                        const requestBids = bids.filter(b => b.swap_request_id === request.id);
                                                        const sortedBids = sortBidsByTimestamp(requestBids);
                                                        const groupedBids = groupBidsByStatus(sortedBids);

                                                        if (sortedBids.length === 0) return (
                                                            <div className="p-3 bg-secondary rounded-lg border border-border">
                                                                <p className="text-xs text-muted-foreground">Noch keine Reaktionen</p>
                                                            </div>
                                                        );

                                                        return (
                                                            <div className="p-3 bg-secondary rounded-lg border border-border space-y-3">
                                                                <p className="text-xs text-muted-foreground font-medium">Reaktionen ({sortedBids.length}):</p>

                                                                {groupedBids.annehmen.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-medium text-green-400 mb-1 flex items-center gap-1">
                                                                            <Check className="w-3 h-3" />
                                                                            Möchte übernehmen ({groupedBids.annehmen.length})
                                                                        </p>
                                                                        <div className="space-y-1 ml-3">
                                                                            {groupedBids.annehmen.map((bid, idx) => (
                                                                                <div key={bid.id} className="flex items-center justify-between gap-2">
                                                                                    <span className="text-sm text-foreground">
                                                                                        {bid.bidding_employee_name}
                                                                                        {idx === 0 && <span className="ml-2 text-green-400 font-medium">⭐ Erste</span>}
                                                                                    </span>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        onClick={() => handleApprove(request, bid.bidding_employee_id, bid.bidding_employee_name)}
                                                                                        className="bg-green-600 hover:bg-green-700 text-white text-xs h-6 px-2"
                                                                                    >
                                                                                        <Check className="w-3 h-3 mr-1" />
                                                                                        Auswählen
                                                                                    </Button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {groupedBids.unter_umständen.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-medium text-yellow-400 mb-1">Vielleicht interessiert ({groupedBids.unter_umständen.length})</p>
                                                                        <div className="space-y-1 ml-3">
                                                                            {groupedBids.unter_umständen.map(bid => (
                                                                                <div key={bid.id} className="text-xs text-foreground flex items-center justify-between">
                                                                                    <span>{bid.bidding_employee_name}</span>
                                                                                    <span className="text-xs text-muted-foreground">{formatBidTime(bid.created_at)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {groupedBids.ablehnen.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-medium text-red-400 mb-1">Kein Interesse ({groupedBids.ablehnen.length})</p>
                                                                        <div className="space-y-1 ml-3">
                                                                            {groupedBids.ablehnen.map(bid => (
                                                                                <div key={bid.id} className="text-xs text-foreground flex items-center justify-between">
                                                                                    <span>{bid.bidding_employee_name}</span>
                                                                                    <span className="text-xs text-muted-foreground">{formatBidTime(bid.created_at)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                       );
                                                     })()}
                                                    </div>

                                                    <div className="flex lg:flex-col gap-2">
                                                    <Button
                                                      variant="outline"
                                                      onClick={() => handleReject(request)}
                                                      className="flex-1 lg:flex-none border-red-500/30 text-red-400 hover:bg-red-500/10"
                                                    >
                                                      <X className="w-4 h-4 mr-2" />
                                                      Ablehnen
                                                    </Button>
                                                    {/* Non-marketplace: Genehmigen wenn Ziel-Mitarbeiter gesetzt */}
                                                    {!request.marketplace && request.target_employee_id && (
                                                      <Button
                                                          onClick={() => handleApprove(request)}
                                                          className="flex-1 lg:flex-none bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                                                      >
                                                          <Check className="w-4 h-4 mr-2" />
                                                          Genehmigen
                                                      </Button>
                                                    )}
                                                    {/* Manager kann Schicht selbst übernehmen */}
                                                    {currentEmployee && (
                                                      <Button
                                                          variant="outline"
                                                          onClick={() => {
                                                              if (confirm(`Schicht selbst übernehmen? Du (${currentEmployee.name}) wirst als neuer Mitarbeiter eingetragen.`)) {
                                                                  approveMutation.mutate({
                                                                      requestId: request.id,
                                                                      shiftId: request.shift_id,
                                                                      newEmployeeId: currentEmployee.id,
                                                                      newEmployeeName: currentEmployee.name,
                                                                      request
                                                                  });
                                                              }
                                                          }}
                                                          className="flex-1 lg:flex-none border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                                      >
                                                          <User className="w-4 h-4 mr-2" />
                                                          Selbst übernehmen
                                                      </Button>
                                                    )}
                                                    </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <Card className="p-12 bg-card border-border">
                                    <div className="text-center text-muted-foreground">
                                        <Check className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                        <p className="text-lg font-medium mb-1 text-foreground">Keine ausstehenden Anfragen</p>
                                        <p className="text-sm">Alle Tauschanfragen wurden bearbeitet</p>
                                    </div>
                                </Card>
                            )}
                        </TabsContent>
                    )}
                </Tabs>
            </div>

            {/* Shift Swap Request Modal */}
             {selectedShift && (
                 <ShiftSwapRequestModal
                     shift={selectedShift}
                     open={createModalOpen}
                     onOpenChange={setCreateModalOpen}
                     onSuccess={() => {
                         setCreateModalOpen(false);
                         setSelectedShift(null);
                         queryClient.invalidateQueries({ queryKey: ['shift-swap-requests'] });
                     }}
                 />
             )}

             {/* Shift Marketplace Modal */}
             <ShiftMarketplaceModal
                 open={marketplaceOpen}
                 onOpenChange={setMarketplaceOpen}
             />

             {/* Direct Swap Modal */}
             <DirectSwapModal
                 open={directSwapOpen}
                 onOpenChange={setDirectSwapOpen}
                 myShifts={myUpcomingShifts}
             />
             </div>
             );
            }