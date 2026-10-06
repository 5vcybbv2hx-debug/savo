/**
 * ShiftSwapSection — Schichttausch-Verwaltung (eingebettet in Meine Schichten)
 *
 * Extrahiert aus ShiftSwaps.jsx. Enthält die KOMPLETTE Funktionalität:
 *  - Marketplace-Button + Direkttausch-Button
 *  - Eingehende + ausgehende Tauschanfragen mit allen Status-Workflow-Aktionen
 *    (annehmen/ablehnen/stornieren, Manager-Genehmigung, 1:1-Bestätigung)
 *  - Manager-Genehmigungs-Liste (wenn isManager)
 *
 * Wird als aufklappbarer Abschnitt in MyShifts.jsx gerendert.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { RepeatIcon, Check, X, Clock, Calendar, AlertCircle, User, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { usePermissions } from '@/components/auth/usePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { format, isPast, parseISO, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ShiftSwapRequestModal from '@/components/shifts/ShiftSwapRequestModal';
import ShiftMarketplaceModal from '@/components/shifts/ShiftMarketplaceModal';
import DirectSwapModal from '@/components/shifts/DirectSwapModal';
import { ListSkeleton } from '@/components/ui/StateDisplay';
import {
    sortBidsByTimestamp,
    groupBidsByStatus,
    formatBidTime,
    notifyEmployee,
    invalidateAllSwapQueries,
} from '@/lib/shiftSwapHelpers';

export default function ShiftSwapSection({ myShifts = [] }) {
    const permissions = usePermissions();
    const queryClient = useQueryClient();
    const [expanded, setExpanded] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState(null);
    const [marketplaceOpen, setMarketplaceOpen] = useState(false);
    const [directSwapOpen, setDirectSwapOpen] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null);

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
            const { fetchUntilDateCovered } = await import('@/lib/adaptiveFetch');
            return fetchUntilDateCovered(
                (limit) => base44.entities.Shift.list('-date', limit),
                from, to
            );
        },
        staleTime: STALE.MEDIUM,
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data, request }) => {
            await base44.entities.ShiftSwapRequest.update(id, data);
            try {
                const requestingEmployee = employees.find(e => e.id === request.requesting_employee_id);
                if (requestingEmployee) {
                    const approved = data.status === 'genehmigt';
                    await notifyEmployee({
                        recipientId: requestingEmployee.id,
                        recipientEmail: requestingEmployee.email,
                        title: approved ? 'Schichttausch genehmigt ✓' : 'Schichttausch abgelehnt',
                        message: `Dein Schichttausch für ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} wurde ${approved ? 'genehmigt' : 'abgelehnt'}.`,
                        relatedId: id,
                    });
                }
            } catch (error) {
                console.error('Fehler beim Erstellen der Benachrichtigung:', error);
            }
        },
        onSuccess: (_, variables) => {
            invalidateAllSwapQueries(queryClient);
            setSelectedRequest(null);
            toast.success(variables.data.status === 'genehmigt' ? 'Tauschanfrage genehmigt' : 'Tauschanfrage abgelehnt');
        }
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

            if (request.is_mutual_swap && request.partner_shift_id) {
                await base44.entities.Shift.update(request.partner_shift_id, {
                    employee_id: request.requesting_employee_id,
                    employee_name: request.requesting_employee_name,
                });
            }

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
                    await notifyEmployee({
                        recipientId: requestingEmployee.id,
                        recipientEmail: requestingEmployee.email,
                        title: 'Schichttausch genehmigt ✓',
                        message: request.is_mutual_swap
                            ? `Dein gegenseitiger Tausch mit ${newEmployeeName} wurde genehmigt. Beide Schichten wurden getauscht.`
                            : `Dein Schichttausch für ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} wurde genehmigt. ${newEmployeeName} übernimmt deine Schicht.`,
                        relatedId: requestId,
                    });
                }

                if (targetEmployee) {
                    await notifyEmployee({
                        recipientId: targetEmployee.id,
                        recipientEmail: targetEmployee.email,
                        title: request.is_mutual_swap ? 'Gegenseitiger Tausch genehmigt ✓' : 'Schichttausch genehmigt – Du übernimmst die Schicht',
                        message: request.is_mutual_swap
                            ? `Euer gegenseitiger Tausch mit ${request.requesting_employee_name} wurde genehmigt. Beide Schichten wurden getauscht.`
                            : `Du übernimmst die Schicht von ${request.requesting_employee_name} am ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })}.`,
                        relatedId: requestId,
                    });
                }
            } catch (error) {
                console.error('Fehler beim Erstellen der Benachrichtigung:', error);
            }
        },
        onSuccess: () => {
            invalidateAllSwapQueries(queryClient);
            setSelectedRequest(null);
            toast.success('Schichttausch genehmigt – Kalender wurde aktualisiert');
        }
    });

    const handleApprove = (request, bidEmployeeId, bidEmployeeName) => {
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

    const currentEmployee = employees.find(e => e.email === currentUser?.email);

    const myRequests = swapRequests.filter(r =>
        r.requesting_employee_id === currentEmployee?.id ||
        r.target_employee_id === currentEmployee?.id
    );

    const isOpenStatus = (r) => r.status === 'offen' || r.status === 'ausstehend' || r.status === 'angenommen';
    const pendingRequests = swapRequests.filter(r => isOpenStatus(r));

    const myUpcomingShifts = shifts
        .filter(s =>
            s.employee_id === currentEmployee?.id &&
            !isPast(parseISO(s.date))
        )
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 10);

    const getStatusBadge = (status) => {
        if (status === 'ausstehend' || status === 'offen' || status === 'in_prüfung') {
            return (
                <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Clock className="w-3 h-3 mr-1" />
                    {status === 'offen' ? 'Offen' : status === 'in_prüfung' ? 'In Prüfung' : 'Ausstehend'}
                </Badge>
            );
        } else if (status === 'angenommen') {
            return (
                <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Clock className="w-3 h-3 mr-1" />
                    Akzeptiert – wartet auf Bestätigung
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

    const myOpenCount = myRequests.filter(r => isOpenStatus(r)).length;
    const managerOpenCount = pendingRequests.length;

    return (
        <div className="space-y-3">
            {/* Aufklappbarer Header */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-accent/20 transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <RepeatIcon className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold text-foreground">Tauschanfragen</p>
                        <p className="text-xs text-muted-foreground">
                            {myOpenCount > 0 ? `${myOpenCount} eigene Anfrage(n) offen` : 'Anfragen senden & verwalten'}
                            {permissions.isManager && managerOpenCount > 0 && ` · ${managerOpenCount} zu genehmigen`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {myOpenCount > 0 && (
                        <Badge className="bg-amber-500 text-slate-900 text-xs px-1.5 py-0">{myOpenCount}</Badge>
                    )}
                    {permissions.isManager && managerOpenCount > 0 && (
                        <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">{managerOpenCount}</Badge>
                    )}
                    {expanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
            </button>

            {expanded && (
                <div className="space-y-4 animate-fade-in">
                    {loadingRequests ? (
                        <ListSkeleton count={3} height="h-20" />
                    ) : (
                        <>
                            {/* Aktions-Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => setMarketplaceOpen(true)}
                                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white gap-2 flex-1"
                                >
                                    <Users className="w-4 h-4" />
                                    Marketplace
                                </Button>
                                <Button
                                    onClick={() => setDirectSwapOpen(true)}
                                    className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white gap-2 flex-1"
                                >
                                    <RepeatIcon className="w-4 h-4" />
                                    Direkt tauschen
                                </Button>
                            </div>

                            {/* Meine Anfragen */}
                            <div>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                                    <User className="w-3 h-3" /> Meine Anfragen
                                </p>
                                {myRequests.length > 0 ? (
                                    <div className="space-y-2">
                                        {myRequests.map(request => {
                                            const isRequester = request.requesting_employee_id === currentEmployee?.id;
                                            return (
                                                <Card key={request.id} className="p-4 bg-card border-border hover:border-amber-500/30 transition-all">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                                {getStatusBadge(request.status)}
                                                                <span className="text-xs text-muted-foreground">
                                                                    {format(parseISO(request.created_date), 'dd.MM.yyyy HH:mm', { locale: de })}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-medium text-foreground">
                                                                    {isRequester ? (
                                                                        <>Du → {request.target_employee_name || 'Marketplace'}</>
                                                                    ) : (
                                                                        <>{request.requesting_employee_name} → Du</>
                                                                    )}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {format(parseISO(request.shift_date), 'EEEE, d. MMMM yyyy', { locale: de })} • {request.shift_time}
                                                                </p>
                                                            </div>
                                                            {request.reason && (
                                                                <div className="mt-2 p-2.5 bg-secondary rounded-lg border border-border">
                                                                    <p className="text-xs text-muted-foreground mb-0.5">Grund:</p>
                                                                    <p className="text-sm text-foreground">{request.reason}</p>
                                                                </div>
                                                            )}
                                                            {request.approved_by && (
                                                                <p className="text-xs text-muted-foreground mt-2">
                                                                    {request.status === 'genehmigt' ? 'Genehmigt' : 'Abgelehnt'} von {request.approved_by} am {format(parseISO(request.response_date), 'dd.MM.yyyy', { locale: de })}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {isRequester && request.status === 'ausstehend' && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleWithdraw(request)}
                                                                className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"
                                                            >
                                                                <X className="w-4 h-4 mr-1.5" />
                                                                Zurückziehen
                                                            </Button>
                                                        )}
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <RepeatIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm font-medium text-foreground">Keine Tauschanfragen</p>
                                        <p className="text-xs mt-1">Nutze „Tauschen" auf einer deiner Schichten oder den Marketplace</p>
                                    </div>
                                )}
                            </div>

                            {/* Manager: Zu genehmigen */}
                            {permissions.isManager && pendingRequests.length > 0 && (
                                <div>
                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                                        <AlertCircle className="w-3 h-3" /> Zu genehmigen ({pendingRequests.length})
                                    </p>
                                    <div className="space-y-2">
                                        {pendingRequests.map(request => (
                                            <Card key={request.id} className="p-4 bg-card border-border hover:border-amber-500/30 transition-all border-l-4 border-l-amber-500">
                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            {getStatusBadge(request.status)}
                                                            <span className="text-xs text-muted-foreground">
                                                                {format(parseISO(request.created_date), 'dd.MM.yyyy HH:mm', { locale: de })}
                                                            </span>
                                                        </div>
                                                        <div className="space-y-1 mb-3">
                                                            <p className="text-sm font-semibold text-foreground">
                                                                {request.requesting_employee_name} → {request.target_employee_name || 'Marketplace'}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {format(parseISO(request.shift_date), 'EEEE, d. MMMM yyyy', { locale: de })} • {request.shift_time}
                                                            </p>
                                                        </div>
                                                        {request.reason && (
                                                            <div className="p-2.5 bg-secondary rounded-lg border border-border mb-3">
                                                                <p className="text-xs text-muted-foreground mb-0.5">Grund:</p>
                                                                <p className="text-sm text-foreground">{request.reason}</p>
                                                            </div>
                                                        )}

                                                        {/* Marketplace-Bewerber */}
                                                        {request.marketplace && (() => {
                                                            const requestBids = bids.filter(b => b.swap_request_id === request.id);
                                                            const sortedBids = sortBidsByTimestamp(requestBids);
                                                            const groupedBids = groupBidsByStatus(sortedBids);

                                                            if (sortedBids.length === 0) return (
                                                                <div className="p-2.5 bg-secondary rounded-lg border border-border">
                                                                    <p className="text-xs text-muted-foreground">Noch keine Reaktionen</p>
                                                                </div>
                                                            );

                                                            return (
                                                                <div className="p-2.5 bg-secondary rounded-lg border border-border space-y-2">
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

                                                    <div className="flex sm:flex-col gap-2 shrink-0">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleReject(request)}
                                                            className="flex-1 sm:flex-none border-red-500/30 text-red-400 hover:bg-red-500/10"
                                                        >
                                                            <X className="w-4 h-4 mr-1.5" />
                                                            Ablehnen
                                                        </Button>
                                                        {!request.marketplace && request.target_employee_id && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleApprove(request)}
                                                                className="flex-1 sm:flex-none bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                                                            >
                                                                <Check className="w-4 h-4 mr-1.5" />
                                                                {request.is_mutual_swap
                                                                    ? 'Bestätigen'
                                                                    : (request.status === 'angenommen' ? 'Bestätigen' : 'Genehmigen')}
                                                            </Button>
                                                        )}
                                                        {currentEmployee && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    approveMutation.mutate({
                                                                        requestId: request.id,
                                                                        shiftId: request.shift_id,
                                                                        newEmployeeId: currentEmployee.id,
                                                                        newEmployeeName: currentEmployee.name,
                                                                        request
                                                                    });
                                                                }}
                                                                className="flex-1 sm:flex-none border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                                            >
                                                                <User className="w-4 h-4 mr-1.5" />
                                                                Selbst übernehmen
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

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

            {/* Confirm Dialog */}
            <AlertDialog open={!!confirmDialog} onOpenChange={open => !open && setConfirmDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmDialog?.type === 'withdraw' && 'Anfrage zurückziehen?'}
                            {confirmDialog?.type === 'reject'   && 'Tausch ablehnen?'}
                            {confirmDialog?.type === 'approve'  && 'Tausch genehmigen?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDialog?.type === 'withdraw' && 'Die Tauschanfrage wird storniert und kann nicht wiederhergestellt werden.'}
                            {confirmDialog?.type === 'reject'   && 'Die Anfrage wird abgelehnt. Der Mitarbeiter wird benachrichtigt.'}
                            {confirmDialog?.type === 'approve'  && `${confirmDialog?.bidName || ''} übernimmt die Schicht. Der Kalender wird automatisch aktualisiert.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeConfirm}
                            className={confirmDialog?.type !== 'approve' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}>
                            {confirmDialog?.type === 'withdraw' && 'Zurückziehen'}
                            {confirmDialog?.type === 'reject'   && 'Ablehnen'}
                            {confirmDialog?.type === 'approve'  && 'Genehmigen'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}